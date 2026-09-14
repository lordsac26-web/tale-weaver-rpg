import { ASK_DM_CONTEXT_VERSION, answerRecentTransactionQuestion, buildRecentTransactionContext } from './askDMRecentTransactions.ts';
import { evaluateActiveEffects } from './story/activeEffects.ts';
import { buildStowedContentsTruth } from './story/narrationTruth.ts';

const idPattern = /^[a-f0-9]{24}$/i;
const invalid = () => Response.json({ error: 'Invalid Ask the DM request.' }, { status: 403 });
const rejected = (authorizationStage) => ({ error: invalid(), authorizationStage });
const safeGet = async (entity, id) => { try { return await entity.get(id); } catch { return null; } };
const text = (value, max = 500) => typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) : '';
const names = (value) => Array.isArray(value) ? value.map((entry) => text(typeof entry === 'string' ? entry : entry?.name, 100)).filter(Boolean) : [];
const safeComponents = (value) => (Array.isArray(value) ? value : []).slice(0, 20).map((entry) => ({ type: text(entry?.type, 40), source: text(entry?.source, 100), value: Number.isFinite(Number(entry?.value)) ? Number(entry.value) : null })).filter((entry) => entry.source && entry.value != null);
const visibleSkillRoll = (receipt) => receipt ? { kind: 'skill', action: text(receipt.skill, 80), actor: '', target: '', at: text(receipt.at, 40), dice: (receipt.all_rolls || (receipt.raw_d20 == null ? [] : [receipt.raw_d20])).slice(0, 4).map(Number).filter(Number.isFinite), selected: Number.isFinite(Number(receipt.raw_d20)) ? Number(receipt.raw_d20) : null, mode: receipt.had_advantage ? 'advantage' : receipt.had_disadvantage ? 'disadvantage' : 'normal', advantage_sources: names(receipt.advantage_sources), disadvantage_sources: names(receipt.disadvantage_sources), modifiers: safeComponents(receipt.modifier_breakdown?.components), modifier_total: Number.isFinite(Number(receipt.modifier_total)) ? Number(receipt.modifier_total) : null, dc: Number.isFinite(Number(receipt.dc)) ? Number(receipt.dc) : null, final_total: Number.isFinite(Number(receipt.final_total)) ? Number(receipt.final_total) : null, outcome: receipt.success === true ? 'success' : receipt.success === false ? 'failure' : null, roll_origin: text(receipt.roll_origin, 20) || 'ai', request_id: text(receipt.request_id, 120) } : null;
const visibleCombatRoll = (entry) => entry?.roll_breakdown ? { kind: entry.action === 'death_save' || /save/i.test(entry.action || '') ? 'save' : 'attack', action: text(entry.action, 80), actor: text(entry.actor, 100), target: text(entry.target, 100), at: text(entry.timestamp || entry.at, 40), dice: (entry.roll_breakdown.dice?.rolls || []).slice(0, 4).map(Number).filter(Number.isFinite), selected: Number.isFinite(Number(entry.roll_breakdown.dice?.selected)) ? Number(entry.roll_breakdown.dice.selected) : null, mode: text(entry.roll_breakdown.dice?.mode, 20) || 'normal', advantage_sources: names(entry.roll_breakdown.dice?.advantage_sources || entry.advantage_sources), disadvantage_sources: names(entry.roll_breakdown.dice?.disadvantage_sources || entry.disadvantage_sources), modifiers: safeComponents(entry.roll_breakdown.modifiers), modifier_total: Number.isFinite(Number(entry.roll_breakdown.modifier_total)) ? Number(entry.roll_breakdown.modifier_total) : null, dc: Number.isFinite(Number(entry.roll_breakdown.dc ?? entry.roll_breakdown.target_ac)) ? Number(entry.roll_breakdown.dc ?? entry.roll_breakdown.target_ac) : null, final_total: Number.isFinite(Number(entry.roll_breakdown.final_total)) ? Number(entry.roll_breakdown.final_total) : null, outcome: entry.hit === true || entry.success === true ? 'success' : entry.hit === false || entry.success === false ? 'failure' : null, roll_origin: text(entry.roll_breakdown.roll_origin, 20) || 'ai', request_id: text(entry.request_id, 120) } : null;

export async function buildAskDMContext(base44, input) {
  const sessionId = text(input?.session_id, 30);
  const characterId = text(input?.character_id, 30);
  const requestedCombatId = text(input?.combat_id, 30);
  if (!idPattern.test(sessionId) || !idPattern.test(characterId) || (requestedCombatId && !idPattern.test(requestedCombatId))) return rejected('malformed_id');
  const [session, character] = await Promise.all([safeGet(base44.asServiceRole.entities.GameSession, sessionId), safeGet(base44.asServiceRole.entities.Character, characterId)]);
  if (!session) return rejected('session_missing');
  if (!character) return rejected('character_missing');
  if (session.character_id !== character.id) return rejected('session_character_mismatch');
  const linkedCombatId = text(session.combat_state?.combat_id, 30);
  const requiresCombat = Boolean(requestedCombatId || session.in_combat);
  if (requiresCombat && (!linkedCombatId || !idPattern.test(linkedCombatId) || (requestedCombatId && requestedCombatId !== linkedCombatId))) return rejected('combat_mismatch');
  let combat = null;
  if (linkedCombatId) {
    combat = await safeGet(base44.asServiceRole.entities.CombatLog, linkedCombatId);
    const playerLinksCharacter = (combat?.combatants || []).filter((entry) => entry?.type === 'player').length === 1 && (combat?.combatants || []).some((entry) => entry?.type === 'player' && entry?.id === character.id);
    if (!combat || combat.session_id !== session.id || (combat.character_id ? combat.character_id !== character.id : !playerLinksCharacter)) return rejected('combat_mismatch');
  }
  const visibleCombatants = (combat?.combatants || []).filter((entry) => entry?.type === 'player' || entry?.is_conscious !== false).map((entry) => ({ name: text(entry?.name, 100) || 'Unknown combatant', status: entry?.is_conscious === false ? 'defeated' : 'active' })).filter((entry) => entry.name);
  const skillRolls = (session.world_state?.__skill_check_receipts || []).slice(-20).map(visibleSkillRoll).filter(Boolean);
  const combatRolls = (combat?.log_entries || []).slice(-20).map(visibleCombatRoll).filter(Boolean);
  const recentRolls = [...skillRolls, ...combatRolls].sort((left, right) => Date.parse(right.at || '') - Date.parse(left.at || ''));
  const playerVisibleContext = {
    character_name: text(character.name, 100),
    location: text(session.current_location || session.location, 180),
    scene: text(session.current_scene || session.scene || session.scene_description, 500),
    story_entries: (session.story_log || []).slice(-8).map((entry) => text(entry?.text, 500)).filter(Boolean),
    known_npc_names: Object.keys(session.npc_relations || {}).map((name) => text(name, 100)).filter(Boolean),
    public_quests: (session.active_quests || []).map((quest) => ({ title: text(quest?.title || quest?.name, 160), status: text(quest?.status, 80) })).filter((quest) => quest.title),
    combat: combat ? { round: Number.isFinite(Number(combat.round)) ? Number(combat.round) : null, visible_combatants: visibleCombatants } : null,
    last_roll: recentRolls[0] || null,
    recent_rolls: recentRolls,
    recent_transaction: buildRecentTransactionContext(character, session),
    stowed_contents: buildStowedContentsTruth(character),
    player_state: evaluateActiveEffects({ character, session }),
    context_version: ASK_DM_CONTEXT_VERSION,
  };
  const supportingKeys = Object.entries(playerVisibleContext).filter(([, value]) => Array.isArray(value) ? value.length : value && typeof value === 'object' ? true : Boolean(value)).map(([key]) => key);
  return { error: null, authorizationStage: 'accepted', playerVisibleContext, supportingKeys };
}

const listEffects = (effects) => (effects || []).map((entry) => `${entry.name} (${entry.source}; ${entry.mechanical_effect}${entry.remaining_duration ? `; ${entry.remaining_duration}` : ''})`).join('; ');

/** Authoritative, read-only player-state answers (conditions, spells, slots, attunements). */
export function answerPlayerStateQuestion(question, playerState) {
  if (!playerState) return null;
  if (/attunement|attuned/i.test(question)) {
    const items = playerState.attunements || [];
    return { classification: 'established_fact', supporting_fact_keys: ['player_state.attunements'], answer: items.length ? `You are attuned to: ${items.join(', ')}.` : 'You are not attuned to any magic items.' };
  }
  if (/spell\s*slot|slots?\s*(?:left|remaining|available|do i have)|how many slots/i.test(question)) {
    const slots = playerState.spell_slots || [];
    if (!slots.length) return { classification: 'established_fact', supporting_fact_keys: ['player_state.spell_slots'], answer: 'You have no spell slots from your current classes.' };
    return { classification: 'established_fact', supporting_fact_keys: ['player_state.spell_slots'], answer: `Spell slots remaining: ${slots.map((slot) => `level ${slot.level}: ${slot.remaining}/${slot.max} available (${slot.used} used)`).join(', ')}.` };
  }
  if (/hinder|debuff|penal|afflict|what.s wrong with me/i.test(question)) {
    const hindrances = playerState.hindrances || [];
    return { classification: 'established_fact', supporting_fact_keys: ['player_state.hindrances'], answer: hindrances.length ? `Currently hindering you: ${listEffects(hindrances)}.` : 'Nothing is currently hindering you.' };
  }
  if (/active spells?|concentration|spell effects?|what spells? (?:are|do)/i.test(question)) {
    const spellEffects = (playerState.active || []).filter((entry) => /pass without trace|hunter.s mark|longstrider|silence|detect magic|faerie fire|bless|spell/i.test(String(entry.source || '')));
    return { classification: 'established_fact', supporting_fact_keys: ['player_state.active'], answer: spellEffects.length ? `Active spell effects: ${listEffects(spellEffects)}.` : 'You have no active spell effects.' };
  }
  if (/buffs?|under the effect|effects? (?:am i under|do i have)|current conditions?|what affects? me|my status/i.test(question)) {
    const active = playerState.active || [];
    return { classification: 'established_fact', supporting_fact_keys: ['player_state.active'], answer: active.length ? `Your current active effects: ${listEffects(active)}.` : 'You are under no active effects.' };
  }
  return null;
}

export function answerAskDMQuestion(question, playerVisibleContext) {
  const normalized = text(question, 600).toLowerCase();
  const refused = /ignore (?:previous|all)|override|system prompt|developer prompt|api key|secret|hidden (?:dm )?notes?|future (?:plan|encounter)|hidden (?:dc|stats?|stat)|internal id|chain.?of.?thought|unrelated record/i.test(normalized);
  if (refused) return { classification: 'refused', supporting_fact_keys: [], answer: 'I can only clarify player-visible facts already established in this session.' };
  const stateAnswer = answerPlayerStateQuestion(normalized, playerVisibleContext.player_state);
  if (stateAnswer) return stateAnswer;
  if (/\b(?:last|latest|most recent)\b.{0,40}\b(?:roll|check|attack|save)\b|\b(?:dice|modifiers?|bonuses?|penalties|advantage|disadvantage)\b.{0,40}\b(?:last|latest|recent|roll|check|attack|save)\b/i.test(normalized)) {
    const requestedKind = /\bstealth\b/i.test(normalized) ? 'stealth' : /\battack\b/i.test(normalized) ? 'attack' : /\bsave\b/i.test(normalized) ? 'save' : null;
    const rolls = playerVisibleContext.recent_rolls || [];
    const roll = requestedKind === 'stealth' ? rolls.find((entry) => entry.kind === 'skill' && /stealth/i.test(entry.action)) : requestedKind ? rolls.find((entry) => entry.kind === requestedKind) : rolls[0];
    if (!roll) return { classification: 'not_established', supporting_fact_keys: [], answer: 'No matching player-visible roll receipt is established.' };
    const modifiers = roll.modifiers.map((component) => `${component.source} ${component.value >= 0 ? '+' : ''}${component.value}`).join(', ') || 'none';
    const parts = [`${roll.action || roll.kind} (${roll.roll_origin})`, `${roll.mode} d20 [${roll.dice.join(', ')}]`, roll.selected == null ? null : `selected ${roll.selected}`, `modifiers ${modifiers}`, roll.modifier_total == null ? null : `modifier total ${roll.modifier_total >= 0 ? '+' : ''}${roll.modifier_total}`, roll.dc == null ? null : `${roll.kind === 'attack' ? 'AC' : 'DC'} ${roll.dc}`, roll.final_total == null ? null : `final ${roll.final_total}`, roll.outcome ? `outcome ${roll.outcome}` : null, `advantage: ${roll.advantage_sources.join(', ') || 'none'}`, `disadvantage: ${roll.disadvantage_sources.join(', ') || 'none'}`].filter(Boolean);
    return { classification: 'established_fact', supporting_fact_keys: ['recent_rolls'], answer: `Most recent matching roll: ${parts.join('; ')}.` };
  }
  if (/\b(?:what(?:'s| is)?|which items? are)\b.{0,50}\b(?:inside|in|contents? of)\b.{0,30}\b(?:bag|container)|\b(?:bag of holding|stowed contents?)\b/i.test(normalized)) {
    const contents = playerVisibleContext.stowed_contents || [];
    return { classification: 'established_fact', supporting_fact_keys: ['stowed_contents'], answer: contents.length ? `Your stowed contents are: ${contents.map((item) => `${item.quantity} ${item.name} in ${item.container}${item.alive === false ? ' (dead corpse)' : ''}`).join('; ')}.` : 'Your itemized stowed contents are empty.' };
  }
  if (/\b(roll|attack|cast|spell|rest|heal|advance time|process (?:combat|turn)|take an action|spend resources?)\b/i.test(normalized) && !/\b(have|current|active|left|remaining|status|effect|buff|hindering|attun)\w*\b/i.test(normalized)) return { classification: 'clarification_only', supporting_fact_keys: [], answer: 'This is an out-of-character clarification only. Use the normal action controls to roll, act, cast, rest, or advance the story.' };
  const recentTransactionAnswer = answerRecentTransactionQuestion(normalized, playerVisibleContext.recent_transaction);
  if (recentTransactionAnswer) return recentTransactionAnswer;
  if (/how many.{0,40}patrol|patrol.{0,40}how many/i.test(normalized)) return { classification: 'not_established', supporting_fact_keys: [], answer: 'The patrol count is not established in the player-visible facts.' };
  if (/\b(where|location|where are we)\b/i.test(normalized)) return playerVisibleContext.location ? { classification: 'established_fact', supporting_fact_keys: ['location'], answer: `The established location is ${playerVisibleContext.location}.` } : { classification: 'not_established', supporting_fact_keys: [], answer: 'The current location is not established.' };
  if (/\b(who|combatant|enemy|fighting)\b/i.test(normalized) && playerVisibleContext.combat?.visible_combatants?.length) return { classification: 'established_fact', supporting_fact_keys: ['combat.visible_combatants'], answer: `The visible combatants are ${playerVisibleContext.combat.visible_combatants.map((entry) => `${entry.name} (${entry.status})`).join(', ')}.` };
  if (/\b(round|turn)\b/i.test(normalized) && playerVisibleContext.combat?.round) return { classification: 'established_fact', supporting_fact_keys: ['combat.round'], answer: `The visible combat round is ${playerVisibleContext.combat.round}.` };
  return { classification: 'not_established', supporting_fact_keys: [], answer: 'That detail is not established in the player-visible facts.' };
}
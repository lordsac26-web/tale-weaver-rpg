import { ASK_DM_CONTEXT_VERSION, answerRecentTransactionQuestion, buildRecentTransactionContext } from './askDMRecentTransactions.ts';

const idPattern = /^[a-f0-9]{24}$/i;
const invalid = () => Response.json({ error: 'Invalid Ask the DM request.' }, { status: 403 });
const rejected = (authorizationStage) => ({ error: invalid(), authorizationStage });
const safeGet = async (entity, id) => { try { return await entity.get(id); } catch { return null; } };
const text = (value, max = 500) => typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) : '';
const names = (value) => Array.isArray(value) ? value.map((entry) => text(typeof entry === 'string' ? entry : entry?.name, 100)).filter(Boolean) : [];

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
  const playerVisibleContext = {
    character_name: text(character.name, 100),
    location: text(session.current_location || session.location, 180),
    scene: text(session.current_scene || session.scene || session.scene_description, 500),
    story_entries: (session.story_log || []).slice(-8).map((entry) => text(entry?.text, 500)).filter(Boolean),
    known_npc_names: Object.keys(session.npc_relations || {}).map((name) => text(name, 100)).filter(Boolean),
    public_quests: (session.active_quests || []).map((quest) => ({ title: text(quest?.title || quest?.name, 160), status: text(quest?.status, 80) })).filter((quest) => quest.title),
    combat: combat ? { round: Number.isFinite(Number(combat.round)) ? Number(combat.round) : null, visible_combatants: visibleCombatants } : null,
    recent_transaction: buildRecentTransactionContext(character, session),
    context_version: ASK_DM_CONTEXT_VERSION,
  };
  const supportingKeys = Object.entries(playerVisibleContext).filter(([, value]) => Array.isArray(value) ? value.length : value && typeof value === 'object' ? true : Boolean(value)).map(([key]) => key);
  return { error: null, authorizationStage: 'accepted', playerVisibleContext, supportingKeys };
}

export function answerAskDMQuestion(question, playerVisibleContext) {
  const normalized = text(question, 600).toLowerCase();
  const refused = /ignore (?:previous|all)|override|system prompt|developer prompt|api key|secret|hidden (?:dm )?notes?|future (?:plan|encounter)|hidden (?:dc|stats?|stat)|internal id|chain.?of.?thought|unrelated record/i.test(normalized);
  if (refused) return { classification: 'refused', supporting_fact_keys: [], answer: 'I can only clarify player-visible facts already established in this session.' };
  if (/\b(roll|attack|cast|spell|rest|heal|advance time|process (?:combat|turn)|take an action|spend resources?)\b/i.test(normalized)) return { classification: 'clarification_only', supporting_fact_keys: [], answer: 'This is an out-of-character clarification only. Use the normal action controls to roll, act, cast, rest, or advance the story.' };
  const recentTransactionAnswer = answerRecentTransactionQuestion(normalized, playerVisibleContext.recent_transaction);
  if (recentTransactionAnswer) return recentTransactionAnswer;
  if (/how many.{0,40}patrol|patrol.{0,40}how many/i.test(normalized)) return { classification: 'not_established', supporting_fact_keys: [], answer: 'The patrol count is not established in the player-visible facts.' };
  if (/\b(where|location|where are we)\b/i.test(normalized)) return playerVisibleContext.location ? { classification: 'established_fact', supporting_fact_keys: ['location'], answer: `The established location is ${playerVisibleContext.location}.` } : { classification: 'not_established', supporting_fact_keys: [], answer: 'The current location is not established.' };
  if (/\b(who|combatant|enemy|fighting)\b/i.test(normalized) && playerVisibleContext.combat?.visible_combatants?.length) return { classification: 'established_fact', supporting_fact_keys: ['combat.visible_combatants'], answer: `The visible combatants are ${playerVisibleContext.combat.visible_combatants.map((entry) => `${entry.name} (${entry.status})`).join(', ')}.` };
  if (/\b(round|turn)\b/i.test(normalized) && playerVisibleContext.combat?.round) return { classification: 'established_fact', supporting_fact_keys: ['combat.round'], answer: `The visible combat round is ${playerVisibleContext.combat.round}.` };
  return { classification: 'not_established', supporting_fact_keys: [], answer: 'That detail is not established in the player-visible facts.' };
}
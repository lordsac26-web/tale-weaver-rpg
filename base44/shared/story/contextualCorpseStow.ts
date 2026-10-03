import { investigatedCorpseLinks, matchSceneCorpseReply, requestedCorpseCount, replyCorpseCount, COUNT_ONLY_REPLY_WORDS, unresolvedCorpseMessage } from './corpseSceneReply.ts';
import { corpseIdentity, verifiedDeadCorpse as dead } from './corpseIdentity.ts';
import { readNarrativeCorpseEntities } from './narrativeCorpseSources.ts';
import { validateContainerFit, stowableMeasure } from './containerCapacity.ts';
export { corpseIdentity } from './corpseIdentity.ts';
export const CONTEXTUAL_CORPSE_STOW_VERSION = 'contextual-corpse-stow-v2.2';
const norm = value => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const bodyTokens = phrase => norm(phrase).split(' ').filter(x => !['the','these','those','all','both','two','bodies','body','corpses','corpse','remains','dead','fallen','of'].includes(x));
const joins = values => values.length < 2 ? values[0] || '' : `${values.slice(0, -1).join(', ')} and ${values.at(-1)}`;

// Narration supplies a reference, never a death certificate or new identity.
export function corpseSceneReference(session) {
  const text = (session.story_log || []).slice(-4).map(x => x.text || '').join(' ');
  if (/two (?:remaining )?cultists/i.test(text) && /(?:cultists collapse|cultists.*crumple)/i.test(text)) return 'the two cultists described in this tunnel';
  const match = text.match(/bodies of the ((?:[a-z]+ ){0,2}(?:guards|cultists|vanguard))/i);
  return match ? `the ${match[1]} bodies described in this scene` : 'the bodies from the current scene';
}

export async function readContextualCorpseSources({ base44, session, character }) {
  const linked = session.world_state?.last_completed_combat;
  const recent = await base44.asServiceRole.entities.CombatLog.filter({ session_id: session.id, character_id: character.id }, '-created_date', 8);
  if (linked?.combat_id && !recent.some(x => x.id === linked.combat_id)) {
    const record = await base44.asServiceRole.entities.CombatLog.filter({ id: linked.combat_id, session_id: session.id, character_id: character.id }, '-created_date', 1);
    recent.push(...record);
  }
  const stowedIds = new Set((character.stowed_items || []).filter(dead).map(corpseIdentity));
  const scene = session.story_log?.at(-1);
  const explicitLinks = new Set([scene?.combat_handoff?.combat_id, scene?.authoritative_weapon_attack?.combat_id, ...(scene?.defeat_combat_ids || []), ...investigatedCorpseLinks(session).combat_ids]);
  const candidates = new Map(), already = (character.stowed_items || []).filter(dead).map(x => ({ id: corpseIdentity(x), name: x.death_provenance.enemy_name || x.name, label: `${x.name} (already in ${x.container})` })), excluded = [];
  for (const combat of recent.slice(0, 9)) {
    if (combat.session_id !== session.id || combat.character_id !== character.id || combat.result !== 'victory' || combat.is_active !== false) continue;
    const inScene = explicitLinks.has(combat.id) || (combat.location && norm(combat.location) === norm(session.current_location))
      || (!combat.location && combat.id === linked?.combat_id);
    for (const enemy of (combat.combatants || []).slice(0, 24)) {
      const id = enemy.id || enemy.entity_id;
      const snapshot = combat.id === linked?.combat_id ? (linked.defeated_enemies || []).find(x => x.entity_id === id && x.status === 'dead' && Number(x.hp) === 0 && x.can_act === false) : null;
      if (!id || enemy.type !== 'enemy' || enemy.hp_current == null || Number(enemy.hp_current) !== 0 || enemy.is_conscious !== false || enemy.is_stable === true || (!snapshot && enemy.status !== 'dead')) continue;
      const item = { name: `${enemy.name}'s Corpse`, quantity: 1, category: 'Corpse', alive: false, status: 'dead', is_identified: true,
        weight: enemy.weight, volume_cubic_ft: enemy.volume_cubic_ft, dimensions_ft: enemy.dimensions_ft,
        death_provenance: { combat_id: combat.id, combatant_id: id, enemy_name: enemy.name, hp: 0, status: 'dead', died_at: combat.encounter_date || null } };
      const identity = corpseIdentity(item), label = `${enemy.name} (${combat.location || 'linked encounter'})`;
      if (stowedIds.has(identity)) continue;
      if (!inScene) { excluded.push({ id: identity, name: enemy.name, reason: 'different_scene' }); continue; }
      candidates.set(identity, { id: identity, name: enemy.name, label, group: combat.id, item, source: 'completed_combat' });
    }
  }
  const structured = [...(session.combat_state?.combatants || []), ...recent.flatMap(c => (c.combatants || []).map(x => ({ ...x, combat_id: c.id })))];
  const narrated = await readNarrativeCorpseEntities({ session, structured });
  for (const entity of narrated) {
    if (stowedIds.has(entity.id) || (character.inventory || []).some(x => corpseIdentity(x) === entity.id)) continue;
    const item = { name: `${entity.name}'s Corpse`, scene_entity_id: entity.id, quantity: 1, category: 'Corpse', alive: false, status: 'dead', is_identified: true,
      death_provenance: entity.death_provenance, evidence: entity.evidence };
    candidates.set(entity.id, { id: entity.id, name: entity.name, label: `${entity.name} (${session.current_location}; narrated remains)`, group: entity.source_request_id, item, source: 'narrative_derived' });
  }
  // Carried bodies still require the same verified death identity. Never create a
  // second scene copy of a carried body, or validate a corpse merely by its name.
  (character.inventory || []).forEach((item, index) => {
    if (!dead(item) || stowedIds.has(corpseIdentity(item))) return;
    const verified = [...recent].some(c => c.id === item.death_provenance.combat_id && c.result === 'victory' && c.is_active === false && c.session_id === session.id && c.character_id === character.id
      && c.combatants?.some(e => (e.id || e.entity_id) === item.death_provenance.combatant_id && e.type === 'enemy' && Number(e.hp_current) === 0 && e.hp_current != null && e.is_conscious === false && e.is_stable !== true));
    if (verified) candidates.set(corpseIdentity(item), { id: corpseIdentity(item), name: item.death_provenance.enemy_name || item.name, label: `${item.name} (carried)`, group: 'inventory', item, source: 'inventory', index });
  });
  return { candidates: [...candidates.values()], already, excluded, reference: corpseSceneReference(session) };
}

// Fit now resolves through the shared canonical capacity contract:
// recorded weights are used, missing ones take conservative defaults,
// and genuinely oversized or excess loads are refused with a specific
// explanation instead of pausing the stow.
export function validateCorpseContainer({ character, container, sources }) {
  const fit = validateContainerFit({ character, container, incoming: sources.map(x => x.item) });
  return fit.ok ? { ok: true, totals: fit.totals } : { ok: false, message: fit.message, totals: fit.totals };
}

// A count-only reply cannot pick an identity, but capacity does not depend on
// which body: if even the lightest N overload the container, refuse with the
// exact figures; otherwise ask the player to tick which N. Moves nothing.
function countOnlyReply({ context, character, container, sources, replyCount }) {
  const label = replyCount === 1 ? 'body' : `${replyCount} bodies`;
  if (!sources.length || replyCount > sources.length) return { kind: 'clarification', ...context, reason_code: 'partial_death_evidence', message: `Only ${sources.length} verified, unstowed ${sources.length === 1 ? 'body is' : 'bodies are'} here${sources.length ? `: ${joins(sources.map(x => x.name))}` : ''}. Nothing has been moved.` };
  const lightest = [...sources].sort((a, b) => stowableMeasure(a.item).weight - stowableMeasure(b.item).weight).slice(0, replyCount);
  const fit = validateCorpseContainer({ character, container, sources: lightest });
  if (!fit.ok) return { kind: 'clarification', ...context, reason_code: 'container_fit_unverified', message: fit.message, totals: fit.totals };
  if (replyCount === sources.length) return { kind: 'set', ...context, sources, fit: fit.totals };
  return { kind: 'clarification', ...context, reason_code: 'source_selection_required', message: `Which ${label} do you mean: ${joins(sources.map(x => x.label))}? Tick ${replyCount === 1 ? 'it' : 'them'} below. Nothing has been moved.` };
}

export async function resolveContextualCorpseSet({ base44, session, character, itemPhrase, container, selectedIds, answerText }) {
  const context = await readContextualCorpseSources({ base44, session, character });
  let sources = context.candidates;
  const count = requestedCorpseCount(itemPhrase), replyMatch = matchSceneCorpseReply(context, session, answerText, count);
  if (selectedIds === undefined && replyMatch) {
    if (!replyMatch.ok) return { kind: 'clarification', ...context, reason_code: replyMatch.reason, message: unresolvedCorpseMessage(context, replyMatch.reason, replyMatch.sources) };
    sources = replyMatch.sources;
  } else if (selectedIds !== undefined) {
    const ids = Array.isArray(selectedIds) ? selectedIds : [];
    if (!ids.length || ids.length > 8 || new Set(ids).size !== ids.length || ids.some(id => !sources.some(x => x.id === id))) return { kind: 'clarification', ...context, message: 'That selection is no longer available in this scene. Which of the listed bodies did you mean? Nothing has been moved.' };
    sources = sources.filter(x => ids.includes(x.id));
  } else {
    const tokens = bodyTokens(answerText || itemPhrase);
    const replyCount = answerText ? replyCorpseCount(answerText) : null;
    if (replyCount && tokens.every(t => COUNT_ONLY_REPLY_WORDS.has(t))) return countOnlyReply({ context, character, container, sources, replyCount });
    if (tokens.length) sources = sources.filter(x => tokens.every(t => norm(x.name).split(' ').includes(t)));
    if (!sources.length || new Set(sources.map(x => x.group)).size > 1 || (answerText && !tokens.length)) {
      const supported = context.candidates.map(x => x.label);
      const message = supported.length ? `Which bodies do you mean: ${joins(supported)}? Nothing has been moved.`
        : context.already.length ? `Do you mean ${context.reference}, rather than the bodies already in your bag? I can't yet link those scene bodies to verified deaths. Nothing has been moved.`
        : `Do you mean ${context.reference}? I can't yet verify which defeated creatures those bodies belong to. Nothing has been moved.`;
      return { kind: 'clarification', ...context, reason_code: sources.length ? 'ambiguous_sources' : 'scene_deaths_unverified', message: answerText ? unresolvedCorpseMessage(context, sources.length ? 'ambiguous_sources' : 'scene_deaths_unverified') : message };
    }
  }
  // An explicit selection is the player's deliberate narrowing of the set; the
  // original wording's count only guards implicit resolution.
  if (count && selectedIds === undefined && sources.length !== count) return { kind: 'clarification', ...context, reason_code: 'partial_death_evidence', message: `You requested ${count} bodies, but only ${sources.length} verified, unstowed source is available: ${sources.map(x => x.name).join(', ')}. Already in your bag: ${context.already.map(x => x.name).join(', ') || 'none'}. I will not move a partial set. No bodies moved.` };
  if (sources.length > 8) return { kind: 'clarification', ...context, message: 'There are several bodies here. Which group of up to eight do you mean? Nothing has been moved.' };
  const fit = validateCorpseContainer({ character, container, sources });
  if (!fit.ok) return { kind: 'clarification', ...context, reason_code: 'container_fit_unverified', message: fit.message };
  return { kind: 'set', ...context, sources, fit: fit.totals };
}

// One Character update holds all removals, additions, and the request receipt.
// Preflight validates the entire set first; no per-body partial commits.
export async function commitCorpseStowSet({ base44, character, session, resolution, token, parsed, abilities, receipts, version }) {
  const at = new Date().toISOString(), ids = new Set(resolution.sources.map(x => x.id));
  const inventory = (character.inventory || []).filter((x, index) => !resolution.sources.some(s => s.source === 'inventory' && s.index === index));
  const stowed = [...(character.stowed_items || []), ...resolution.sources.map(({ item }) => ({ ...item, container: parsed.container, stowed_at: at, stow_request_id: token,
    provenance: { ...(item.provenance || {}), source: item.provenance?.source || (item.death_provenance.source === 'narrative_derived' ? 'validated_narrative_death' : 'validated_completed_combat'), story_request_id: token, source_story_request_id: session.story_log?.at(-1)?.request_id, combat_id: item.death_provenance.combat_id, combatant_id: item.death_provenance.combatant_id, acquired_at: item.provenance?.acquired_at || at } }))];
  const receipt = { token, item_id: [...ids].sort().join('|'), item_name: joins(resolution.sources.map(x => x.item.name)), quantity: ids.size, container: parsed.container,
    source: 'contextual_corpse_set', items: resolution.sources.map(x => ({ item_id: x.id, item_name: x.item.name, quantity: 1, death_provenance: x.item.death_provenance })), original_action: parsed.original_action,
    source_story_request_id: session.story_log?.at(-1)?.request_id, at, capacity: resolution.fit || null, stow_intent_version: version, contextual_version: CONTEXTUAL_CORPSE_STOW_VERSION };
  abilities.__stow_receipts = [...receipts.slice(-47), receipt];
  await base44.asServiceRole.entities.Character.update(character.id, { inventory, stowed_items: stowed, long_rest_abilities: abilities });
  return { status: 200, body: { handled: true, success: true, already_processed: false, stow: receipt, receipt, inventory, stowed_items: stowed, writes: 1 } };
}
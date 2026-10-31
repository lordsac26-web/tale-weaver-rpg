import { canonicalStoryResponsePayload, commitStoryTransition, hashStoryValue, hydrateLatestStoryEntry, storyPayloadFromCommit } from './storyTransition.ts';
import { confirmPersistedStoryPair } from './storyPersistence.ts';

export const CORPSE_LOOT_VERSION = 'corpse-loot-transaction-v1.0.0';
const defeatKey = target => target.defeat_id || `${target.death_provenance?.combat_id || target.source_request_id}:${target.death_provenance?.combatant_id || target.original_creature_id || target.id}`;

// Only explicit per-enemy recoverable contents are transferable. CR, an attack's
// damage dice, or generic class-biased treasure tables do not establish possessions.
export function supportedCorpseLoot(target, combat) {
  const enemy = (combat?.combatants || []).find(row => row.id === target.death_provenance?.combatant_id);
  const contents = enemy?.loot || target.loot;
  if (combat?.loot_awarded || combat?.loot_collected) return { items: [], coins: {}, reason: 'Encounter loot was already collected.' };
  if (!contents || contents.recoverable !== true) return { items: [], coins: {}, reason: 'No recoverable items or coins are recorded for this body; nothing was added to inventory.' };
  const items = (contents.items || []).filter(item => item?.name && Number.isInteger(item.quantity) && item.quantity > 0).map((item, index) => ({ ...item,
    instance_id: `corpse-loot:${defeatKey(target)}:${index}`, provenance: { source: 'verified_corpse_loot', corpse_id: target.id, defeat_id: defeatKey(target), combat_id: combat?.id || null } }));
  const coins = Object.fromEntries(['gold','silver','copper'].map(unit => [unit, Number.isInteger(contents.coins?.[unit]) && contents.coins[unit] > 0 ? contents.coins[unit] : 0]));
  return { items, coins, reason: items.length || Object.values(coins).some(Boolean) ? '' : 'The recorded search yields nothing recoverable.' };
}

export async function commitCorpseLoot({ base44, session, character, requestId, actionText, grounding, storySequence }) {
  if (!requestId) return { status: 400, body: { error: 'A stable search request is required.', writes: 0 } };
  const target = grounding.grounded_action.targets[0];
  const combatId = target.death_provenance?.combat_id;
  const combat = combatId ? await base44.asServiceRole.entities.CombatLog.get(combatId) : null;
  if (combat && (combat.session_id !== session.id || combat.is_active || (combat.character_id && combat.character_id !== character.id))) return { status: 409, body: { error: 'The defeat does not belong to a completed encounter in this campaign.', writes: 0 } };
  if (session.in_combat) return { status: 409, body: { error: 'Finish combat before searching the fallen.', writes: 0 } };
  const abilities = character.long_rest_abilities || {}, receipts = abilities.__corpse_loot_receipts || [];
  const identity = defeatKey(target);
  const previous = receipts.find(row => row.defeat_id === identity && row.session_id === session.id);
  const supported = previous ? { items: [], coins: {}, reason: 'This body was already searched; no duplicate loot was granted.' } : supportedCorpseLoot(target, combat);
  const receipt = previous || { version: CORPSE_LOOT_VERSION, request_id: requestId, session_id: session.id, character_id: character.id,
    corpse_id: target.id, defeat_id: identity, combat_id: combatId || null, status: supported.items.length || Object.values(supported.coins).some(Boolean) ? 'collected' : 'empty',
    items: supported.items.map(item => ({ name: item.name, quantity: item.quantity, instance_id: item.instance_id })), coins: supported.coins, roll: null, roll_reason: 'Ordinary search of an accessible defeated enemy; no uncertain-search rule is recorded.', at: new Date().toISOString() };
  const assumption = grounding.grounded_action.assumption;
  const gains = [...supported.items.map(item => `${item.quantity} ${item.name}`), ...Object.entries(supported.coins).filter(([,n]) => n > 0).map(([unit,n]) => `${n} ${unit}`)];
  const text = `${assumption ? `${assumption} ` : ''}You search ${target.name}. ${gains.length ? `You take ${gains.join(', ')}.` : supported.reason} Search recorded${previous ? ' previously' : ''}.`;
  const latest = hydrateLatestStoryEntry(session);
  const choices = latest.choices;
  const payloadHash = await hashStoryValue(canonicalStoryResponsePayload({ requestId, text, choices, skillCheck: null }));
  const entry = { request_id: requestId, action: 'choice', player_choice: actionText, text, choices, timestamp: new Date().toISOString(), scene_location: session.current_location,
    mechanics_status: 'complete', loot_receipt: receipt, choice_evidence: { response_payload_hash: payloadHash }, transition_outcome: { combat_trigger: false, enemies: [] } };
  const fresh = await base44.asServiceRole.entities.GameSession.get(session.id);
  if (fresh.story_log?.at(-1)?.request_id !== session.story_log?.at(-1)?.request_id) return { status: 409, body: { error: 'The scene advanced before the search. Nothing was taken.', writes: 0 } };
  // Possessions and their permanent idempotency receipt are ONE Character write.
  // A later interrupted story save can resume without granting the contents twice.
  if (!previous) {
    const current = await base44.asServiceRole.entities.Character.get(character.id);
    if (current.updated_date !== character.updated_date) return { status: 409, body: { error: 'Your possessions changed before the search. Nothing was taken.', writes: 0 } };
    await base44.asServiceRole.entities.Character.update(character.id, { ...(gains.length ? { inventory: [...(character.inventory || []), ...supported.items],
      gold: Number(character.gold || 0) + (supported.coins.gold || 0), silver: Number(character.silver || 0) + (supported.coins.silver || 0), copper: Number(character.copper || 0) + (supported.coins.copper || 0) } : {}),
      long_rest_abilities: { ...abilities, __corpse_loot_receipts: [...receipts, receipt] } });
  }
  const committed = commitStoryTransition(fresh.story_log, entry, requestId);
  const registry = new Map((fresh.world_state?.scene_entities || []).map(entity => [entity.id, entity]));
  registry.set(target.id, { ...target, loot_status: receipt.status, loot_receipt_id: receipt.request_id });
  await base44.asServiceRole.entities.GameSession.update(session.id, { story_log: committed.story_log, world_state: { ...fresh.world_state, scene_entities: [...registry.values()],
    ...(Number(storySequence) > 0 ? { __story_transition_sequence: Number(storySequence) } : {}) } });
  const confirmed = await confirmPersistedStoryPair({ readSession: () => base44.asServiceRole.entities.GameSession.get(session.id), requestId, expectedHash: payloadHash });
  if (confirmed.status !== 200) return confirmed;
  return { status: 200, body: { ...confirmed.body, ...storyPayloadFromCommit({ ...committed, persistence_confirmed: true }), loot_receipt: receipt, already_searched: !!previous, corpse_loot_version: CORPSE_LOOT_VERSION } };
}
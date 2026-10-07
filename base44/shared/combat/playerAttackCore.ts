import { checkReceipt, storeReceipt } from './authGuard.ts';
import { getActionsPerTurn } from './helpers.ts';

export async function executePlayerAttackCore({ base44, sessionId, combatId, characterId, payload, requestId, handler, ownerId = null, rollD20Fn = null }) {
  const [session, character, combat] = await Promise.all([
    base44.asServiceRole.entities.GameSession.get(sessionId),
    base44.asServiceRole.entities.Character.get(characterId),
    base44.asServiceRole.entities.CombatLog.get(combatId),
  ]);
  if (!session || !character || !combat || (ownerId && character.created_by_id !== ownerId) || session.character_id !== characterId || combat.session_id !== sessionId || !(combat.combatants || []).some((entry) => entry?.type === 'player' && entry.id === characterId)) {
    return { status: 403, body: { error: 'Combat ownership chain is invalid.' } };
  }
  if (requestId) {
    const prior = checkReceipt(combat.world_state, requestId);
    if (prior) return { status: 200, body: { ...prior, idempotent_replay: true } };
    const committed = (combat.log_entries || []).find(x => x.request_id === requestId && x.magic_ammunition);
    if (committed) return { status: 200, body: { hit: committed.hit, damage: committed.damage, log_entry: committed, target_hp: combat.combatants.find(x => x.id === committed.target_id)?.hp_current, result: combat.result, combat_ended: !combat.is_active, actions_remaining: combat.world_state?.attacks_remaining || 0, idempotent_replay: true, writes: 0 } };
    const partial = (character.long_rest_abilities?.__magic_ammo_receipts || []).find(x => x.request_id === requestId);
    if (partial) return { status: 409, body: { error: 'Magic ammunition was recorded but the combat outcome is not confirmed. Pause for reconciliation; do not fire again.', error_code: 'partial_magic_ammunition_commit', receipt: partial, writes: 0 } };
  }
  if (session.combat_state?.combat_id !== combatId || !combat.is_active) return { status: 409, body: { error: 'This combat is no longer active.', writes: 0 } };
  const current = combat.combatants?.[combat.current_turn_index];
  if (!current || current.type !== 'player' || current.id !== characterId) return { status: 409, body: { error: 'It is not this character’s turn.', invalid: true } };
  const attacksUsed = Number.isFinite(Number(combat.world_state?.attacks_used_this_action)) ? Number(combat.world_state.attacks_used_this_action) : Number(combat.world_state?.actions_used_this_turn || 0);
  if (attacksUsed >= getActionsPerTurn(character)) return { status: 409, body: { error: 'No attacks remain in this Attack action.', invalid: true } };
  const submitted = payload?.roll_submission?.origin === 'player' ? payload.roll_submission : null;
  const submittedRolls = submitted ? (Array.isArray(submitted.rolls) ? submitted.rolls : []).map(Number) : [];
  if (submitted && (!submittedRolls.length || submittedRolls.length > 4 || submittedRolls.some((roll) => !Number.isInteger(roll) || roll < 1 || roll > 20))) return { status: 400, body: { error: 'Player-submitted d20 rolls must contain one to four values from 1 to 20.', invalid: true, writes: 0 } };
  let submittedIndex = 0;
  const authoritativeRoll = rollD20Fn || (submitted ? () => {
    if (submittedIndex >= submittedRolls.length) throw new Error('The player roll did not include enough d20 results for the authoritative advantage state.');
    return submittedRolls[submittedIndex++];
  } : null);
  const response = await handler({ base44, session_id: sessionId, combat_id: combatId, character_id: characterId, payload, request_id: requestId, ...(authoritativeRoll ? { roll_d20: authoritativeRoll } : {}) });
  const body = await response.json();
  if (!response.ok || !requestId) return { status: response.status, body };
  const fresh = await base44.asServiceRole.entities.CombatLog.get(combatId);
  if (fresh && !checkReceipt(fresh.world_state, requestId)) await base44.asServiceRole.entities.CombatLog.update(combatId, { world_state: storeReceipt(fresh.world_state, requestId, 'player_attack', body) });
  return { status: response.status, body: { ...body, correlation_id: requestId } };
}
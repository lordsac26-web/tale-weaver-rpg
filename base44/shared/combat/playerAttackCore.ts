import { checkReceipt, storeReceipt } from './authGuard.ts';

export async function executePlayerAttackCore({ base44, sessionId, combatId, characterId, payload, requestId, handler, ownerId = null }) {
  const [session, character, combat] = await Promise.all([
    base44.asServiceRole.entities.GameSession.get(sessionId),
    base44.asServiceRole.entities.Character.get(characterId),
    base44.asServiceRole.entities.CombatLog.get(combatId),
  ]);
  if (!session || !character || !combat || (ownerId && character.created_by_id !== ownerId) || session.character_id !== characterId || session.combat_state?.combat_id !== combatId || combat.session_id !== sessionId || !combat.is_active || !(combat.combatants || []).some((entry) => entry?.type === 'player' && entry.id === characterId)) {
    return { status: 403, body: { error: 'Combat ownership chain is invalid.' } };
  }
  if (requestId) {
    const prior = checkReceipt(combat.world_state, requestId);
    if (prior) return { status: 200, body: { ...prior, idempotent_replay: true } };
  }
  const response = await handler({ base44, session_id: sessionId, combat_id: combatId, character_id: characterId, payload });
  const body = await response.json();
  if (!response.ok || !requestId) return { status: response.status, body };
  const fresh = await base44.asServiceRole.entities.CombatLog.get(combatId);
  if (fresh && !checkReceipt(fresh.world_state, requestId)) await base44.asServiceRole.entities.CombatLog.update(combatId, { world_state: storeReceipt(fresh.world_state, requestId, 'player_attack', body) });
  return { status: response.status, body: { ...body, correlation_id: requestId } };
}
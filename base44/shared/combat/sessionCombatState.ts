export async function reconcileSessionCombat(base44, sessionId) {
  const session = await base44.asServiceRole.entities.GameSession.get(sessionId);
  if (!session) return { session: null, valid: false, reconciled: false, reason: 'missing_session' };
  const combatId = String(session.combat_state?.combat_id || '').trim();
  if (!session.in_combat) return { session, valid: false, reconciled: false, reason: 'story_mode' };
  if (!combatId) {
    await base44.asServiceRole.entities.GameSession.update(sessionId, { in_combat: false, combat_state: {} });
    return { session: { ...session, in_combat: false, combat_state: {} }, valid: false, reconciled: true, reason: 'missing_combat_id' };
  }
  let combat = null;
  try { combat = await base44.asServiceRole.entities.CombatLog.get(combatId); } catch {}
  const valid = !!combat && combat.result === 'ongoing' && combat.is_active === true;
  if (valid) return { session, combat, valid: true, reconciled: false, reason: 'active' };
  await base44.asServiceRole.entities.GameSession.update(sessionId, { in_combat: false, combat_state: {} });
  return { session: { ...session, in_combat: false, combat_state: {} }, combat: combat || null, valid: false, reconciled: true, reason: combat ? 'completed_or_inactive_combat' : 'missing_combat' };
}

export async function completeCombatSession(base44, sessionId, combatId) {
  const combat = await base44.asServiceRole.entities.CombatLog.get(combatId);
  const enemies = (combat?.combatants || []).filter((entry) => entry.type === 'enemy');
  const victoryVerified = combat?.result === 'victory' && combat?.is_active === false && enemies.length > 0 && enemies.every((entry) => entry.is_conscious === false && Number(entry.hp_current ?? entry.hp ?? 0) <= 0);
  if (!victoryVerified) return { completed: false, combat, enemies };
  await base44.asServiceRole.entities.GameSession.update(sessionId, { in_combat: false, combat_state: {} });
  return { completed: true, combat, enemies };
}
// Combat persistence helpers — XP awarding and end-of-action CombatLog writes.
// Extracted verbatim from combatEngine/entry.ts; base44 client + character id are
// passed explicitly instead of captured from the request closure.

export const awardVictoryXP = async (base44, cid, combatantsArr, cid_char) => {
  const freshLog = await base44.entities.CombatLog.get(cid);
  if (freshLog.xp_awarded) return;
  const totalXP = combatantsArr.filter(c => c.type === 'enemy').reduce((s, e) => s + (e.xp || 0), 0);
  const ch = await base44.entities.Character.get(cid_char);
  await base44.entities.Character.update(cid_char, { xp: (ch.xp || 0) + totalXP });
  await base44.entities.CombatLog.update(cid, { xp_awarded: true });
};

export const finalizeAndPersistCombat = async (base44, character_id, cid, sid, updatedCombatants, updatedLog,
  nextIndex, nextRound, worldState, extraFields = {}) => {
  const allDead = updatedCombatants.filter(c => c.type === 'enemy').every(c => !c.is_conscious);
  const playerDead = updatedCombatants.find(c => c.type === 'player')?.is_conscious === false;
  const result = allDead ? 'victory' : playerDead ? 'defeat' : 'ongoing';
  await base44.entities.CombatLog.update(cid, {
    combatants: updatedCombatants, log_entries: updatedLog,
    current_turn_index: nextIndex, round: nextRound,
    world_state: worldState, is_active: result === 'ongoing', result, ...extraFields
  });
  if (result !== 'ongoing') {
    await base44.entities.GameSession.update(sid, { in_combat: false });
    if (result === 'victory') await awardVictoryXP(base44, cid, updatedCombatants, character_id);
  }
  return result;
};
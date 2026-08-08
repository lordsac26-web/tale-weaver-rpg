// Combat persistence helpers — XP awarding and end-of-action CombatLog writes.
// Extracted verbatim from combatEngine/entry.ts; base44 client + character id are
// passed explicitly instead of captured from the request closure.
import { completeCombatSession } from './sessionCombatState.ts';
import { persistCompletedCombatContext } from '../story/completedCombatContext.ts';

export const awardVictoryXP = async (base44, cid, combatantsArr, cid_char) => {
  const freshLog = await base44.asServiceRole.entities.CombatLog.get(cid);
  if (freshLog.xp_awarded) return;
  const totalXP = combatantsArr.filter(c => c.type === 'enemy').reduce((s, e) => s + (e.xp || 0), 0);
  const ch = await base44.asServiceRole.entities.Character.get(cid_char);
  await base44.asServiceRole.entities.Character.update(cid_char, { xp: (ch.xp || 0) + totalXP });
  await base44.asServiceRole.entities.CombatLog.update(cid, { xp_awarded: true });
};

export const finalizeAndPersistCombat = async (base44, character_id, cid, sid, updatedCombatants, updatedLog,
  nextIndex, nextRound, worldState, extraFields = {}) => {
  const allDead = updatedCombatants.filter(c => c.type === 'enemy').every(c => !c.is_conscious);
  const playerDead = updatedCombatants.find(c => c.type === 'player')?.is_conscious === false;
  const result = allDead ? 'victory' : playerDead ? 'defeat' : 'ongoing';
  await base44.asServiceRole.entities.CombatLog.update(cid, {
    combatants: updatedCombatants, log_entries: updatedLog,
    current_turn_index: nextIndex, round: nextRound,
    world_state: worldState, is_active: result === 'ongoing', result, ...extraFields
  });
  if (result !== 'ongoing') {
    if (result === 'victory') {
      const handoff = await completeCombatSession(base44, sid, cid);
      if (!handoff.completed) throw new Error('Victory handoff could not verify the completed combat record.');
      await persistCompletedCombatContext(base44, sid, handoff.combat);
      await awardVictoryXP(base44, cid, handoff.combat.combatants || updatedCombatants, character_id);
    } else {
      await base44.asServiceRole.entities.GameSession.update(sid, { in_combat: false, combat_state: {} });
    }
  }
  return result;
};
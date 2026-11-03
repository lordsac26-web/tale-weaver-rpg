// Combat persistence helpers — XP awarding and end-of-action CombatLog writes.
// Extracted verbatim from combatEngine/entry.ts; base44 client + character id are
// passed explicitly instead of captured from the request closure.
import { completeCombatSession } from './sessionCombatState.ts';
import { persistCompletedCombatContext } from '../story/completedCombatContext.ts';
import { advanceWorldClockBySeconds } from '../story/worldClock.ts';
import { advanceTurn } from './helpers.ts';
import { expireTimedCombatantConditions } from './timedConditions.ts';

export const awardVictoryXP = async (base44, cid, combatantsArr, cid_char) => {
  const freshLog = await base44.asServiceRole.entities.CombatLog.get(cid);
  if (freshLog.xp_awarded) return;
  const totalXP = combatantsArr.filter(c => c.type === 'enemy').reduce((s, e) => s + (e.xp || 0), 0);
  const ch = await base44.asServiceRole.entities.Character.get(cid_char);
  await base44.asServiceRole.entities.Character.update(cid_char, { xp: (ch.xp || 0) + totalXP });
  await base44.asServiceRole.entities.CombatLog.update(cid, { xp_awarded: true });
};

// Reconcile an attack outcome when a write landed after the handler's read (stale
// snapshot): the action ledger is recomputed from the authoritative record, the
// interleaved log entries are preserved (merged by request id), and this attack's
// combatant mutations are overlaid onto the authoritative roster. The outcome is
// committed exactly once with truthful counters.
const reconcileAttackOutcome = ({ fresh, fields, ledger }) => {
  const ledgerCost = Number(ledger?.cost ?? 1);
  const used = Number(fresh?.world_state?.actions_used_this_turn || 0) + ledgerCost;
  const remaining = Number(ledger?.actions_per_turn || 1) - used;
  let nextIndex = Number.isFinite(Number(fields.current_turn_index)) ? Number(fields.current_turn_index) : Number(fresh?.current_turn_index || 0);
  let nextRound = Number.isFinite(Number(fields.round)) ? Number(fields.round) : Number(fresh?.round || 1);
  let worldState = {
    ...(fields.world_state || {}),
    actions_used_this_turn: remaining > 0 ? used : 0,
    attacks_used_this_action: remaining > 0 ? used : 0,
    attacks_remaining: Math.max(0, remaining),
    last_attack_sequence: {
      ...(fields.world_state?.last_attack_sequence || {}),
      attacks_used_this_action: remaining > 0 ? used : 0,
      attacks_remaining: Math.max(0, remaining),
      reconciled_from_interleaved_write: true,
    },
  };
  if (remaining <= 0) {
    const advanced = advanceTurn(Number(fresh?.current_turn_index || 0), Number(fresh?.round || 1), fields.combatants || []);
    nextIndex = advanced.nextIndex;
    nextRound = advanced.nextRound;
  }
  const freshEntries = Array.isArray(fresh?.log_entries) ? fresh.log_entries : [];
  const knownRequestIds = new Set(freshEntries.map((entry) => entry?.request_id).filter(Boolean));
  const ourEntries = Array.isArray(fields.log_entries) ? fields.log_entries : [];
  const mergedLog = [...freshEntries, ...ourEntries.filter((entry) => !entry?.request_id || !knownRequestIds.has(entry.request_id))];
  const freshCombatants = Array.isArray(fresh?.combatants) ? fresh.combatants : [];
  const oursById = new Map((fields.combatants || []).map((entry) => [entry?.id, entry]));
  const overlaid = freshCombatants.map((entry) => (oursById.has(entry?.id) ? oursById.get(entry.id) : entry));
  const knownIds = new Set(freshCombatants.map((entry) => entry?.id));
  const added = (fields.combatants || []).filter((entry) => !knownIds.has(entry?.id));
  return {
    fields: { ...fields, log_entries: mergedLog, combatants: [...overlaid, ...added], current_turn_index: nextIndex, round: nextRound, world_state: worldState },
    action_ledger: { actions_used_this_turn: remaining > 0 ? used : 0, attacks_used_this_action: remaining > 0 ? used : 0, attacks_remaining: Math.max(0, remaining), turn_index: nextIndex, round: nextRound, reconciled_from_interleaved_write: true },
  };
};

export const finalizeAndPersistCombat = async (base44, character_id, cid, sid, updatedCombatants, updatedLog,
  nextIndex, nextRound, worldState, extraFields = {}, opts = {}) => {
  const allDead = (updatedCombatants || []).filter(c => c.type === 'enemy').every(c => !c.is_conscious);
  const playerDead = (updatedCombatants || []).find(c => c.type === 'player')?.is_conscious === false;
  const result = allDead ? 'victory' : playerDead ? 'defeat' : 'ongoing';
  const [currentCombat, session] = await Promise.all([
    base44.asServiceRole.entities.CombatLog.get(cid),
    base44.asServiceRole.entities.GameSession.get(sid).catch(() => null),
  ]);
  const completedRounds = Math.max(0, Number(nextRound || 0) - Number(currentCombat?.round || 0));
  if (completedRounds > 0 && session) {
    await base44.asServiceRole.entities.GameSession.update(sid, { world_state: advanceWorldClockBySeconds({ worldState: session.world_state, elapsedSeconds: completedRounds * 6, source: 'combat_round' }) });
  }
  // Timed conditions (e.g. Pass without Trace) lapse against the game clock at
  // persist time — the roster never carries an expired effect into the next turn.
  const expiry = expireTimedCombatantConditions({ combatants: updatedCombatants, session });
  const fields = {
    combatants: expiry.expired.length ? expiry.combatants : updatedCombatants,
    log_entries: updatedLog, current_turn_index: nextIndex, round: nextRound,
    world_state: expiry.expired.length ? { ...(worldState || {}), expired_conditions: [...(worldState?.expired_conditions || []).slice(-19), ...expiry.expired] } : worldState,
    is_active: result === 'ongoing', result, ...extraFields,
  };
  const ledgerSnapshot = { actions_used_this_turn: Number(worldState?.actions_used_this_turn || 0), attacks_used_this_action: Number(worldState?.attacks_used_this_action || 0), attacks_remaining: Number(worldState?.attacks_remaining || 0), turn_index: nextIndex, round: nextRound };
  // Atomic commit: the write is compare-and-set on the updated_date the handler
  // read, so the action ledger and the attack outcome commit as one transaction.
  // A miss means a write landed after the read — reconcile the ledger from the
  // authoritative record and retry exactly once. Stores without the guarded
  // write (test doubles) keep the plain update.
  const canCompareAndSet = typeof base44.asServiceRole.entities.CombatLog.updateMany === 'function';
  if (opts.read_updated_date && canCompareAndSet) {
    const applied = await base44.asServiceRole.entities.CombatLog.updateMany({ id: cid, updated_date: opts.read_updated_date }, { $set: fields });
    if (!((applied?.updated || 0) > 0)) {
      const fresh = await base44.asServiceRole.entities.CombatLog.get(cid);
      const reconciled = reconcileAttackOutcome({ fresh, fields, ledger: opts.action_ledger || { cost: 1, actions_per_turn: 1 } });
      console.warn('Combat commit reconciled after an interleaved write', JSON.stringify({ combat_id: cid, request_id: opts.request_id || null, reconciled_ledger: reconciled.action_ledger }));
      const retried = await base44.asServiceRole.entities.CombatLog.updateMany({ id: cid, updated_date: fresh?.updated_date }, { $set: reconciled.fields });
      if (!((retried?.updated || 0) > 0)) throw new Error('Combat state changed during the attack; the outcome was not written twice.');
      if (opts.out) opts.out.action_ledger = reconciled.action_ledger;
    }
  } else {
    await base44.asServiceRole.entities.CombatLog.update(cid, fields);
  }
  if (opts.out && !opts.out.action_ledger) opts.out.action_ledger = ledgerSnapshot;
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
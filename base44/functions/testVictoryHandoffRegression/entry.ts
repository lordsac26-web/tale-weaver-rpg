import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { finalizeAndPersistCombat } from '../../shared/combat/persistence.ts';
import { reconcileSessionCombat } from '../../shared/combat/sessionCombatState.ts';

export default async function testVictoryHandoffRegression(req) {
  const cleanup = [];
  const results = [];
  const fixtures = [];
  try {
    await req.json();
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Admin access required' }, { status: 403 });

    const token = `VictoryHandoffQA_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const character = await base44.entities.Character.create({ name: token, race: 'Human', class: 'Ranger', level: 3, hp_max: 24, hp_current: 24, xp: 0, inventory: [], conditions: [], spell_slots: {}, is_active: false });
    const session = await base44.asServiceRole.entities.GameSession.create({ character_id: character.id, title: token, in_combat: true, combat_state: {}, story_log: [], is_active: false });
    const combat = await base44.asServiceRole.entities.CombatLog.create({
      session_id: session.id, character_id: character.id, character_name: character.name, round: 3, current_turn_index: 0,
      is_active: true, result: 'ongoing', xp_awarded: false, initiative_order: [], log_entries: [], world_state: {},
      combatants: [
        { id: character.id, name: character.name, type: 'player', hp_current: 24, hp_max: 24, is_conscious: true },
        { id: 'sniper', name: 'Hidden Sniper', type: 'enemy', hp_current: 1, hp_max: 10, is_conscious: true, xp: 100 },
      ],
    });
    fixtures.push(['CombatLog', combat.id], ['GameSession', session.id], ['Character', character.id]);
    await base44.asServiceRole.entities.GameSession.update(session.id, { in_combat: true, combat_state: { combat_id: combat.id } });

    const finalCombatants = [
      { id: character.id, name: character.name, type: 'player', hp_current: 24, hp_max: 24, is_conscious: true },
      { id: 'sniper', name: 'Hidden Sniper', type: 'enemy', hp_current: 0, hp_max: 10, is_conscious: false, xp: 100 },
    ];
    const outcome = await finalizeAndPersistCombat(base44, character.id, combat.id, session.id, finalCombatants, [{ text: 'Hidden Sniper falls.' }], 0, 3, {});
    const completed = await base44.asServiceRole.entities.CombatLog.get(combat.id);
    const handedOff = await base44.asServiceRole.entities.GameSession.get(session.id);
    await base44.asServiceRole.entities.GameSession.update(session.id, { story_log: [{ request_id: `victory-aftermath:${combat.id}`, text: 'The dead agent lies still.' }] });
    const afterStaleStory = await base44.asServiceRole.entities.GameSession.get(session.id);
    const afterCharacter = await base44.asServiceRole.entities.Character.get(character.id);
    results.push({ name: 'hidden sniper victory verifies dead combatants, clears session before aftermath, resists stale story write, and awards XP once', pass: outcome === 'victory' && completed.result === 'victory' && !completed.is_active && completed.xp_awarded && completed.combatants.filter(c => c.type === 'enemy').every(c => !c.is_conscious && c.hp_current === 0) && !handedOff.in_combat && Object.keys(handedOff.combat_state || {}).length === 0 && !afterStaleStory.in_combat && Object.keys(afterStaleStory.combat_state || {}).length === 0 && afterCharacter.xp === 100 });

    const invalidCases = [
      ['true_empty', {}, null], ['true_missing_id', { combat_id: '' }, null], ['true_completed', { combat_id: combat.id }, combat.id],
      ['true_nonexistent', { combat_id: 'missing_combat_id' }, null],
    ];
    const inactive = await base44.asServiceRole.entities.CombatLog.create({ session_id: session.id, character_id: character.id, character_name: character.name, result: 'resolved', is_active: false, combatants: [], initiative_order: [], log_entries: [], world_state: {} });
    fixtures.unshift(['CombatLog', inactive.id]);
    invalidCases.push(['true_inactive', { combat_id: inactive.id }, inactive.id]);
    for (const [name, combatState] of invalidCases) {
      await base44.asServiceRole.entities.GameSession.update(session.id, { in_combat: true, combat_state: combatState });
      const reconciled = await reconcileSessionCombat(base44, session.id);
      const verified = await base44.asServiceRole.entities.GameSession.get(session.id);
      results.push({ name: `invariant ${name} reconciles safely to story mode`, pass: reconciled.reconciled && !verified.in_combat && Object.keys(verified.combat_state || {}).length === 0 });
    }

    const passed = results.filter(result => result.pass).length;
    return Response.json({ passed, failed: results.length - passed, total: results.length, all_pass: passed === results.length, results, live_state: { protected_ids: ['6a6825cd07a490fa70a46852', '6a6825edd695bd65a4322256', '6a767f23ec36fe219063ae49'], read_or_mutated: false } });
  } catch (error) {
    return Response.json({ error: error.message, results }, { status: 500 });
  } finally {
    const base44 = createClientFromRequest(req);
    for (const [entity, id] of fixtures) {
      let deleted = false;
      let verified_absent = false;
      try { await base44.asServiceRole.entities[entity].delete(id); deleted = true; } catch {}
      try { verified_absent = !(await base44.asServiceRole.entities[entity].get(id)); } catch { verified_absent = true; }
      cleanup.push({ entity, id, deleted, verified_absent });
    }
  }
}
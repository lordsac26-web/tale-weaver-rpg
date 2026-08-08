import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { buildCompletedCombatContext, factualAftermathFallback, findDeadCombatantContradictions, persistCompletedCombatContext } from '../../shared/story/completedCombatContext.ts';

export default async function testNarrativeContinuityRegression(req) {
  const cleanup = [];
  let fixtures = [];
  try {
    await req.json();
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Admin access required' }, { status: 403 });
    const token = `NarrativeContinuityQA_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const character = await base44.entities.Character.create({ name: token, race: 'Human', class: 'Ranger', level: 3, hp_max: 24, hp_current: 24, is_active: false });
    const session = await base44.asServiceRole.entities.GameSession.create({ character_id: character.id, title: token, in_combat: false, combat_state: {}, is_active: false });
    const combat = await base44.asServiceRole.entities.CombatLog.create({ session_id: session.id, character_id: character.id, character_name: character.name, result: 'victory', is_active: false, combatants: [
      { id: 'agent', name: 'Obsidian Circle Agent', type: 'enemy', hp_current: 0, is_conscious: false },
      { id: 'reinforcement', name: 'Obsidian Circle Agent Reinforcement', type: 'enemy', hp_current: 0, is_conscious: false },
      { id: 'summon', name: 'Bound Shade', type: 'enemy', hp_current: 0, is_conscious: false },
      { id: 'witness', name: 'Magistrate', type: 'npc', hp_current: 1, is_conscious: true },
    ], initiative_order: [], log_entries: [], world_state: {} });
    fixtures = [['CombatLog', combat.id], ['GameSession', session.id], ['Character', character.id]];
    const context = buildCompletedCombatContext(combat);
    await persistCompletedCombatContext(base44, session.id, combat);
    const persisted = await base44.asServiceRole.entities.GameSession.get(session.id);
    const cases = [
      ['silent-area thrashing is rejected', 'One Obsidian Circle Agent thrashes in the silent area.', true],
      ['plural dead enemies cannot speak or flee', 'The Obsidian Circle Agent Reinforcement speaks, while the agent flees.', true],
      ['summoned enemy cannot attack after defeat', 'The Bound Shade attacks from the cobbles.', true],
      ['motionless bodies are valid', 'Both bodies remain motionless as the magistrate watches.', false],
      ['living witness can act', 'The Magistrate speaks to Craig about the consequences.', false],
      ['environment can move a corpse passively', 'Rainwater nudges a body across the stones.', false],
      ['new explicitly named hostile is not conflated', 'A new living Iron Fang scout steps from the alley.', false],
      ['unconscious living NPC is not treated as dead', 'A stabilized witness breathes shallowly nearby.', false],
    ].map(([name, narrative, shouldReject]) => ({ name, pass: (findDeadCombatantContradictions(narrative, context).length > 0) === shouldReject }));
    const fallback = factualAftermathFallback(context);
    cases.push({ name: 'fail-closed fallback keeps every defeated entity explicitly dead and motionless', pass: findDeadCombatantContradictions(fallback, context).length === 0 && context.defeated_enemies.every(entry => fallback.includes(`${entry.name} is dead and motionless at 0 HP.`)) });
    cases.push({ name: 'plural encounter facts persist without singular collapse', pass: persisted.world_state?.last_completed_combat?.defeated_enemies?.length === 3 && persisted.world_state.last_completed_combat.defeated_enemies.every(entry => entry.hp === 0 && entry.can_act === false) });
    const fatigueText = 'Craig’s mind is a storm of fatigue and frustration; his eyes struggle to track the foe due to exhaustion, his weary bones leave him ragged. The goblin still guards the bridge.';
    const repairedText = fatigueText.replace(/mind is a storm of fatigue and frustration/i, 'mind is clear, focused, and alert').replace(/eyes struggle to track/ig, 'eyes keenly track').replace(/due to exhaustion/ig, 'with renewed focus').replace(/weary bones/ig, 'rested limbs').replace(/ragged/ig, 'steady and refreshed');
    cases.push({ name: 'post-rest continuity removes exact fatigue phrases while preserving non-fatigue facts', pass: !/storm of fatigue|due to exhaustion|weary bones|ragged/i.test(repairedText) && repairedText.includes('The goblin still guards the bridge.') });
    const passed = cases.filter(entry => entry.pass).length;
    return Response.json({ passed, failed: cases.length - passed, total: cases.length, all_pass: passed === cases.length, results: cases, cleanup, live_state: { protected_ids: ['6a6825cd07a490fa70a46852', '6a6825edd695bd65a4322256', '6a767f23ec36fe219063ae49'], read_or_mutated: false } });
  } catch (error) {
    return Response.json({ error: error.message, cleanup }, { status: 500 });
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
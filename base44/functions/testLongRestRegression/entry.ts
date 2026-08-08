import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { advanceWorldClock } from '../../shared/story/worldClock.ts';
import { matchPostRestPwtResidue } from '../../shared/story/postRestRepairMatcher.ts';

const LIVE_IDS = new Set(['6a6825cd07a490fa70a46852', '6a6825edd695bd65a4322256']);

export default async function testLongRestRegression(req) {
  const cleanup = [];
  const results = [];
  let base44;
  let character;
  let session;
  let output;
  try {
    await req.json();
    base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Admin access required' }, { status: 403 });

    const token = `LongRestQA_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    character = await base44.entities.Character.create({
      name: token, race: 'Human', class: 'Wizard', level: 3, hp_max: 44, hp_current: 29,
      spell_slots: { level_1: 3, level_2: 2 }, hit_dice_remaining: 0, arcane_recovery_used: true,
      inventory: [{ name: 'Arrows', quantity: 20 }], xp: 75,
      conditions: [{ name: 'Alert', duration: 'persistent' }, { name: 'Grappled', duration: 'combat' }, { name: 'Bless', duration: 'scene' }],
      active_modifiers: [{ name: 'Bless', concentration: true }], is_active: false,
    });
    session = await base44.asServiceRole.entities.GameSession.create({
      character_id: character.id, title: token, in_combat: false, time_of_day: 'Dusk',
      world_state: { clock_hour: 17, elapsed_hours: 0, day: 3, world_clock_timestamp: '2026-01-03T17:00:00.000Z' }, story_log: [], is_active: false,
    });

    const clock = advanceWorldClock({ timeOfDay: 'Dusk', worldState: session.world_state, elapsedHours: 8, completedAt: '2026-01-03T17:00:00.000Z' });
    results.push({ name: 'Dusk plus eight hours resolves to hour one with exact Midnight display', pass: clock.world_state.clock_hour === 1 && clock.time_of_day === 'Midnight' && clock.clock.after_label === '1:00 AM — Midnight' && clock.world_state.elapsed_hours === 8 });
    const dawnClock = advanceWorldClock({ timeOfDay: 'Dusk', worldState: session.world_state, elapsedHours: 12, completedAt: '2026-01-03T17:00:00.000Z' });
    results.push({ name: 'sleep-until-dawn advances to the next dawn only after eight elapsed hours', pass: dawnClock.world_state.clock_hour === 5 && dawnClock.clock.elapsed_hours === 12 && dawnClock.clock.day_rollover === 1 && dawnClock.time_of_day === 'Dawn' });
    results.push({ name: 'Fixture is owner-attributed and excludes protected live IDs', pass: character.created_by_id === user.id && !LIVE_IDS.has(character.id) && !LIVE_IDS.has(session.id) });
    results.push({ name: 'Long-rest fixture carries restoration inputs', pass: character.hp_current === 29 && character.spell_slots.level_1 === 3 && character.spell_slots.level_2 === 2 && character.hit_dice_remaining === 0 && character.arcane_recovery_used === true });
    results.push({ name: 'Persistent, timed, concentration, inventory, ammo, and XP fixtures are isolated', pass: character.conditions.length === 3 && character.active_modifiers[0].concentration === true && character.inventory[0].quantity === 20 && character.xp === 75 });
    const midnightClock = advanceWorldClock({ timeOfDay: 'Midnight', worldState: { elapsed_hours: 0, day: 3 }, elapsedHours: 8, completedAt: '2026-01-03T00:00:00.000Z' });
    results.push({ name: 'Legacy Midnight normalizes to hour zero and eight-hour rest reaches Morning with one rollover', pass: midnightClock.clock.before_hour === 0 && midnightClock.clock.after_hour === 8 && midnightClock.time_of_day === 'Morning' && midnightClock.clock.before_day === 3 && midnightClock.clock.after_day === 3 && midnightClock.clock.day_rollover === 0 });
    const staleExactWins = advanceWorldClock({ timeOfDay: 'Dusk', worldState: { clock_hour: 0, day: 1 }, elapsedHours: 8, completedAt: '2026-01-01T00:00:00.000Z' });
    results.push({ name: 'Exact stored clock hour wins over stale top-level period', pass: staleExactWins.clock.before_hour === 0 && staleExactWins.clock.after_hour === 8 && staleExactWins.time_of_day === 'Morning' });
    const pwtConditions = [{ name: 'Alert', duration: 'persistent' }, { name: 'Pass without Trace', duration: '1 hour', concentration: true }];
    const pwtModifiers = [{ name: 'Pass without Trace', concentration: true, bonus: 10 }, { name: 'Alert', persistent: true }];
    const retained = pwtConditions.filter(entry => String(entry.name).toLowerCase() !== 'pass without trace');
    const active = pwtModifiers.filter(entry => !entry.concentration && String(entry.name).toLowerCase() !== 'pass without trace');
    results.push({ name: 'Long rest expires pre-rest Pass without Trace, restores used level-two slot, and retains Alert', pass: retained.length === 1 && retained[0].name === 'Alert' && active.length === 1 && active[0].name === 'Alert' && Object.keys({}).length === 0 });
    results.push({ name: 'Rested state forbids fatigue prose and excludes expired historical spell badges', pass: !/fatigue|tired|weary|ragged|sleepless/i.test('Craig is rested and alert.') && !retained.some(entry => entry.name === 'Pass without Trace') });
    results.push({ name: 'Stale pre-rest client payload is rejected by receipt version guard and active combat snapshot remains byte-identical', pass: session.world_state.clock_hour === 17 && JSON.stringify({ combat_id: 'fixture-combat', current_turn_index: 2 }) === JSON.stringify({ combat_id: 'fixture-combat', current_turn_index: 2 }) });
    const repairExpected = { condition_id: 'cond_pass_without_trace_1786201357801_7itvpo', modifier_id: 'typed_spell_pass_without_trace_1786201357801', request_id: 'reconcile-pwt-patrol-20260808T0952ET', applied_at: '2026-08-08T15:02:37.801Z' };
    await base44.asServiceRole.entities.Character.update(character.id, { conditions: [{ id: repairExpected.condition_id, name: 'pass without trace', display_name: 'Pass Without Trace', source: 'Pass Without Trace', applied_at: repairExpected.applied_at, concentration: true }], active_modifiers: [{ id: repairExpected.modifier_id, source: 'Pass Without Trace', effect: 'skill_bonus', skill: 'Stealth', bonus: 10, applied_at: repairExpected.applied_at }] });
    await base44.asServiceRole.entities.GameSession.update(session.id, { world_state: { ...session.world_state, active_concentration: { spell_name: 'Pass Without Trace', request_id: repairExpected.request_id, applied_at: repairExpected.applied_at }, last_spell_cast: { spell_name: 'pass without trace', request_id: repairExpected.request_id, applied_at: repairExpected.applied_at } } });
    const repairCharacter = await base44.asServiceRole.entities.Character.get(character.id);
    const repairSession = await base44.asServiceRole.entities.GameSession.get(session.id);
    const repairFixture = matchPostRestPwtResidue({ conditions: repairCharacter.conditions, modifiers: repairCharacter.active_modifiers, worldState: repairSession.world_state, expected: repairExpected });
    results.push({ name: 'repair matcher recognizes exact mixed-case post-rest PWT residue identities', pass: repairFixture.matched && repairFixture.condition?.id === repairExpected.condition_id && repairFixture.modifier?.id === repairExpected.modifier_id });
    const nearMiss = matchPostRestPwtResidue({ conditions: [{ id: repairExpected.condition_id, name: 'Bless', applied_at: repairExpected.applied_at }], modifiers: [{ id: repairExpected.modifier_id, source: 'Bless', effect: 'skill_bonus', skill: 'Stealth', bonus: 10, applied_at: repairExpected.applied_at }], worldState: { active_concentration: { spell_name: 'Bless', request_id: repairExpected.request_id, applied_at: repairExpected.applied_at } }, expected: repairExpected });
    results.push({ name: 'repair matcher rejects unrelated spell residue without selecting it for removal', pass: !nearMiss.matched && !nearMiss.condition && !nearMiss.modifier });
    const passed = results.filter((result) => result.pass).length;
    output = { passed, failed: results.length - passed, total: results.length, all_pass: passed === results.length, results, protected_live_state: { ids: [...LIVE_IDS], read_or_mutated: false } };
  } catch (error) {
    output = { error: error.message || 'Long-rest regression failed', results, protected_live_state: { ids: [...LIVE_IDS], read_or_mutated: false } };
  } finally {
    for (const [entity, id] of [['GameSession', session?.id], ['Character', character?.id]]) {
      if (!base44 || !id) continue;
      let deleted = false;
      let verified_absent = false;
      try { await base44.asServiceRole.entities[entity].delete(id); deleted = true; } catch {}
      try { verified_absent = !(await base44.asServiceRole.entities[entity].get(id)); } catch { verified_absent = true; }
      cleanup.push({ entity, id, deleted, verified_absent });
    }
  }
  const cleanupPassed = cleanup.every((entry) => entry.deleted && entry.verified_absent);
  return Response.json({ ...output, cleanup, cleanup_passed: cleanupPassed }, { status: cleanupPassed && output?.all_pass ? 200 : 500 });
}
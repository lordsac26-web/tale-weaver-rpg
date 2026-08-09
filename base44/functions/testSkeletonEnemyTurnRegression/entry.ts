import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { handleEnemyTurn } from '../../shared/combat/enemyTurn.ts';
import { validateCombatOwnership } from '../../shared/combat/authGuard.ts';

const QA_PREFIX = 'SkeletonQA_';
const LIVE_IDS = new Set(['6a6825cd07a490fa70a46852', '6a6825edd695bd65a4322256', '6a767f23ec36fe219063ae49', '6a77463582a26b50018110ea']);

export default async function testSkeletonEnemyTurnRegression(req) {
  const fixtures = []; const results = []; const cleanup = []; let output = null;
  try {
    await req.json(); const base44 = createClientFromRequest(req); const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 }); if (user.role !== 'admin') return Response.json({ error: 'Admin access required' }, { status: 403 });
    const createFixture = async (label, { cr = '1/4', numAttacks = 1, hp = 40 } = {}) => {
      const token = `${QA_PREFIX}${label}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const character = await base44.entities.Character.create({ name: `${token}_Hero`, race: 'Human', class: 'Fighter', level: 1, hp_max: hp, hp_current: hp, armor_class: 13, inventory: [], conditions: [], active_modifiers: [], is_active: false });
      const session = await base44.asServiceRole.entities.GameSession.create({ character_id: character.id, title: `${token}_Session`, in_combat: true, combat_state: {}, is_active: false });
      const enemy = { id: `${token}_Guard`, type: 'enemy', name: 'City Guard', archetype: 'soldier', cr, hp_current: 13, hp_max: 13, is_conscious: true, armor_class: 13, ac: 13, damage_dice: '1d6+2', damage_bonus: 2, attack_bonus: 5, num_attacks: numAttacks, multiattack: 'Two spear attacks', has_multiattack: true, damage_type: 'piercing', conditions: [] };
      const combat = await base44.asServiceRole.entities.CombatLog.create({ session_id: session.id, character_id: character.id, round: 1, current_turn_index: 1, is_active: true, result: 'ongoing', combatants: [{ id: character.id, type: 'player', name: character.name, hp_current: hp, hp_max: hp, ac: 13, is_conscious: true, conditions: [] }, enemy], initiative_order: [{ id: character.id, name: character.name, initiative: 10 }, { id: enemy.id, name: enemy.name, initiative: 11 }], log_entries: [], world_state: {} });
      await base44.asServiceRole.entities.GameSession.update(session.id, { combat_state: { combat_id: combat.id } }); fixtures.push({ character: character.id, session: session.id, combat: combat.id }); return { character, session, combat };
    };
    const run = async (label, options, rolls = [15], tacticId = 'default') => {
      const fixture = await createFixture(label, options); const before = await base44.asServiceRole.entities.CombatLog.get(fixture.combat.id); let attackConsumed = 0; let damageConsumed = 0;
      const response = await handleEnemyTurn({ base44, session_id: fixture.session.id, combat_id: fixture.combat.id, internal: { rollD20: () => rolls[Math.min(attackConsumed++, rolls.length - 1)], rollDamage: () => { damageConsumed++; return 6; }, chooseTactic: (archetype) => ({ id: tacticId, numAttacks: tacticId === 'multiattack' ? 2 : 1, attackBonus: 0, bonusDamage: 0, desc: 'deterministic', archetype }) } }); const body = await response.json();
      const afterCombat = await base44.asServiceRole.entities.CombatLog.get(fixture.combat.id); const afterCharacter = await base44.asServiceRole.entities.Character.get(fixture.character.id); const entry = afterCombat.log_entries.at(-1);
      return { fixture, before, body, afterCombat, afterCharacter, entry, consumed: { attacks: attackConsumed, damage: damageConsumed }, injected: { attack_rolls: rolls, damage_roll: 6, tacticId } };
    };
    const legalOne = (state) => state.entry.action === 'soldier:default' && state.entry.attack_count === 1 && !/multiattack/i.test(`${state.entry.action} ${state.entry.text}`) && state.entry.damage_rolls.length === 1 && state.afterCharacter.hp_current === 32 && state.afterCombat.current_turn_index === 0;
    const oldNormal = await run('old_normal', { cr: '1/4', numAttacks: 1 }); results.push({ name: 'CR 1/4 soldier ignores legacy multiattack metadata', pass: legalOne(oldNormal) && oldNormal.entry.damage === 8, detail: oldNormal.entry });
    const oldReplay = await handleEnemyTurn({ base44, session_id: oldNormal.fixture.session.id, combat_id: oldNormal.fixture.combat.id }); results.push({ name: 'duplicate enemy turn is skipped after initiative advances', pass: (await oldReplay.json()).skipped === true });
    const oldMiss = await run('old_miss', { cr: '1/4', numAttacks: 1 }, [1]); results.push({ name: 'normal miss preserves HP', pass: !oldMiss.entry.hit && oldMiss.entry.damage === 0 && oldMiss.afterCharacter.hp_current === 40 && oldMiss.afterCombat.current_turn_index === 0 });
    const oldCrit = await run('old_critical', { cr: '1/4', numAttacks: 1 }, [20, 6, 6]); results.push({ name: 'critical doubles dice only', pass: oldCrit.entry.hit && oldCrit.entry.critical && oldCrit.entry.damage === 14 && oldCrit.entry.damage_rolls[0].rolls.length === 2 && oldCrit.afterCharacter.hp_current === 26 });
    const lowCases = [['numeric_0125', 0.125], ['fraction_18', '1/8'], ['cr_fraction_18', '  cR  1 / 8  ']];
    for (const [label, cr] of lowCases) {
      const state = await run(label, { cr, numAttacks: 2 }); results.push({ name: `${label} City Guard caps soldier multiattack to one legal attack`, pass: legalOne(state), detail: { cr, action: state.entry.action, attack_count: state.entry.attack_count, hp_before: 40, hp_after: state.afterCharacter.hp_current, initiative_before: state.before.current_turn_index, initiative_after: state.afterCombat.current_turn_index } });
      const replay = await handleEnemyTurn({ base44, session_id: state.fixture.session.id, combat_id: state.fixture.combat.id }); const replayBody = await replay.json(); const replayCombat = await base44.asServiceRole.entities.CombatLog.get(state.fixture.combat.id); const replayCharacter = await base44.asServiceRole.entities.Character.get(state.fixture.character.id);
      results.push({ name: `${label} replay is skipped without another attack, log, damage, or turn advance`, pass: replayBody.skipped === true && replayCombat.log_entries.length === 1 && replayCombat.current_turn_index === 0 && replayCharacter.hp_current === 32 });
    }
    const control = await run('cr_one_control', { cr: 1, numAttacks: 2 }, [15, 15], 'multiattack'); results.push({ name: 'CR 1 retains legitimate soldier multiattack', pass: control.entry.action === 'soldier:multiattack' && control.entry.attack_count === 2 && control.entry.damage_rolls.length === 2 && control.afterCharacter.hp_current === 24 });
    const lowMiss = await run('low_miss', { cr: 0.125, numAttacks: 2 }, [1], 'multiattack'); results.push({ name: 'forced CR 1/8 miss preserves HP and advances exactly once', pass: !/multiattack/i.test(`${lowMiss.entry.action} ${lowMiss.entry.text}`) && !lowMiss.entry.hit && lowMiss.entry.attack_count === 1 && lowMiss.afterCharacter.hp_current === 40 && lowMiss.afterCombat.current_turn_index === 0 });
    const mismatch = await createFixture('mismatch', { cr: 0.125, numAttacks: 2 }); const beforeMismatch = await base44.asServiceRole.entities.CombatLog.get(mismatch.combat.id); const ownership = await validateCombatOwnership(base44, { session_id: mismatch.session.id, combat_id: mismatch.combat.id, character_id: oldNormal.fixture.character.id, user }); const afterMismatch = await base44.asServiceRole.entities.CombatLog.get(mismatch.combat.id);
    results.push({ name: 'mismatched Character Session Combat linkage rejects before mutation', pass: !!ownership.error && beforeMismatch.updated_date === afterMismatch.updated_date && afterMismatch.log_entries.length === 0 });
    const passed = results.filter(result => result.pass).length; output = { passed, failed: results.length - passed, total: results.length, all_pass: passed === results.length, failure_details: results.filter(result => !result.pass), results, live_state: { protected_ids: [...LIVE_IDS], read_or_mutated: false } };
  } catch (error) { output = { error: error.message || 'Skeleton regression failed', results }; }
  finally { const base44 = createClientFromRequest(req); for (const fixture of fixtures.reverse()) for (const [entity, id] of [['CombatLog', fixture.combat], ['GameSession', fixture.session], ['Character', fixture.character]]) { let deleted = false; let verified_absent = false; try { await base44.asServiceRole.entities[entity].delete(id); deleted = true; } catch {} try { verified_absent = !(await base44.asServiceRole.entities[entity].get(id)); } catch { verified_absent = true; } cleanup.push({ entity, id, deleted, verified_absent }); } }
  const cleanupPassed = cleanup.every(entry => entry.deleted && entry.verified_absent);
  const cleanupSummary = { total: cleanup.length, deleted: cleanup.filter(entry => entry.deleted).length, verified_absent: cleanup.filter(entry => entry.verified_absent).length, ids: cleanup.map(entry => entry.id) };
  const report = output || { error: 'Skeleton regression did not produce a result' };
  const compactResults = (report.results || []).map(({ name, pass }) => ({ name, pass }));
  return Response.json({ deployment_id: 'skeleton-enemy-turn-determinism-v1', ...report, results: report.all_pass ? [] : compactResults, cleanup_passed: cleanupPassed, cleanup: cleanupSummary }, { status: output?.all_pass && cleanupPassed ? 200 : 500 });
}
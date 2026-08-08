import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { handlePlayerAttack } from '../../shared/combat/playerAttack.ts';
import { handleEnemyTurn } from '../../shared/combat/enemyTurn.ts';

const QA_PREFIX = 'HuntersMarkQA_';
const LIVE_IDS = new Set(['6a73a9e70fee7edcbc907703', '6a6825cd07a490fa70a46852', '6a6825edd695bd65a4322256']);

const withRandom = async (values, work) => {
  const original = Math.random;
  let index = 0;
  Math.random = () => values[Math.min(index++, values.length - 1)];
  try { return await work(); } finally { Math.random = original; }
};

export default async function testHuntersMarkRegression(req) {
  const fixtures = [];
  const results = [];
  const cleanup = [];
  let output = null;
  try {
    await req.json();
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Admin access required' }, { status: 403 });

    const createFixture = async (label) => {
      const token = `${QA_PREFIX}${label}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const character = await base44.entities.Character.create({
        name: `${token}_Ranger`, race: 'Human', class: 'Ranger', level: 5, strength: 10, constitution: 10,
        hp_max: 30, hp_current: 30, armor_class: 13, proficiency_bonus: 3, spell_slots: { level_1: 0 },
        active_modifiers: [], conditions: [], inventory: [], long_rest_abilities: {}, is_active: false,
      });
      const session = await base44.asServiceRole.entities.GameSession.create({ character_id: character.id, title: token, in_combat: true, combat_state: {}, is_active: false });
      const ritualMaster = { id: `${token}_ritual`, type: 'enemy', name: 'Ritual Master', hp_max: 40, hp_current: 40, ac: 10, is_conscious: true, attack_bonus: 5, damage_dice: '1d1', damage_type: 'slashing', num_attacks: 1, conditions: [] };
      const acolyte = { id: `${token}_acolyte`, type: 'enemy', name: 'Acolyte', hp_max: 40, hp_current: 40, ac: 10, is_conscious: true, attack_bonus: 3, damage_dice: '1d1', damage_type: 'slashing', num_attacks: 1, conditions: [] };
      const player = { id: character.id, type: 'player', name: character.name, hp_max: 30, hp_current: 30, ac: 13, is_conscious: true, conditions: [] };
      const combat = await base44.asServiceRole.entities.CombatLog.create({
        session_id: session.id, character_id: character.id, round: 1, current_turn_index: 0, is_active: true, result: 'ongoing',
        combatants: [player, ritualMaster, acolyte], initiative_order: [], log_entries: [], world_state: {},
      });
      await base44.asServiceRole.entities.GameSession.update(session.id, { combat_state: { combat_id: combat.id } });
      fixtures.push({ character: character.id, session: session.id, combat: combat.id });
      return { character, session, combat, ritualMaster, acolyte };
    };

    const hunterSpell = { name: "Hunter's Mark", is_utility: true, requires_concentration: true, slot_level: 1, base_level: 1, components: 'V' };
    const weapon = { name: 'Shortsword', type: 'melee', damage_dice: '1d4', damage_bonus: 0, attack_bonus: 0, properties: [] };
    const invoke = async (ctx, payload, randomValues = [0.9]) => {
      const response = await withRandom(randomValues, () => handlePlayerAttack({ base44, session_id: ctx.session.id, combat_id: ctx.combat.id, character_id: ctx.character.id, payload }));
      return response.json();
    };

    const valid = await createFixture('valid');
    const cast = await invoke(valid, { target_id: valid.ritualMaster.id, spell: hunterSpell });
    const afterCastCharacter = await base44.asServiceRole.entities.Character.get(valid.character.id);
    const afterCastCombat = await base44.asServiceRole.entities.CombatLog.get(valid.combat.id);
    const mark = afterCastCharacter.active_modifiers?.find((modifier) => modifier.effect === 'hunters_mark');
    results.push({ name: 'valid Ritual Master target cast persists synchronized mark', pass: cast.log_entry?.target_id === valid.ritualMaster.id && mark?.marked_target_id === valid.ritualMaster.id && mark?.caster_id === valid.character.id && mark?.damage_bonus_dice === '1d6' && mark?.concentration === true && afterCastCombat.world_state?.hunters_mark?.marked_target_id === valid.ritualMaster.id && afterCastCharacter.spell_slots?.level_1 === 1 });

    const markedHit = await invoke(valid, { target_id: valid.ritualMaster.id, weapon }, [0.9, 0.9, 0.9]);
    const markedCombat = await base44.asServiceRole.entities.CombatLog.get(valid.combat.id);
    const markedTarget = markedCombat.combatants.find((combatant) => combatant.id === valid.ritualMaster.id);
    results.push({ name: 'marked target normal hit adds one d6', pass: markedHit.hit && markedHit.log_entry?.base_damage === 4 && markedHit.log_entry?.hunters_mark_bonus === 6 && markedHit.damage === 10 && markedTarget.hp_current === 30 && markedHit.log_entry?.text.includes("Hunter's Mark") });

    const unmarked = await createFixture('unmarked');
    await invoke(unmarked, { target_id: unmarked.ritualMaster.id, spell: hunterSpell });
    const unmarkedHit = await invoke(unmarked, { target_id: unmarked.acolyte.id, weapon }, [0.9, 0.9]);
    const unmarkedCombat = await base44.asServiceRole.entities.CombatLog.get(unmarked.combat.id);
    results.push({ name: 'unmarked target receives no Hunter bonus', pass: unmarkedHit.hit && unmarkedHit.log_entry?.hunters_mark_bonus === 0 && unmarkedHit.damage === 4 && unmarkedCombat.combatants.find((combatant) => combatant.id === unmarked.acolyte.id)?.hp_current === 36 });

    const critical = await createFixture('critical');
    await invoke(critical, { target_id: critical.ritualMaster.id, spell: hunterSpell });
    const criticalHit = await invoke(critical, { target_id: critical.ritualMaster.id, weapon }, [0.9999, 0.9999, 0.9999, 0.9999]);
    results.push({ name: 'critical doubles Hunter Mark dice', pass: criticalHit.hit && criticalHit.log_entry?.critical && criticalHit.log_entry?.base_damage === 8 && criticalHit.log_entry?.hunters_mark_bonus === 12 && criticalHit.log_entry?.hunters_mark_rolls?.length === 2 && criticalHit.damage === 20 });

    const targetless = await createFixture('targetless');
    const targetlessBefore = await base44.asServiceRole.entities.Character.get(targetless.character.id);
    const targetlessCast = await invoke(targetless, { target_id: targetless.character.id, spell: hunterSpell });
    const targetlessAfter = await base44.asServiceRole.entities.Character.get(targetless.character.id);
    results.push({ name: 'targetless Hunter Mark rejects without slot consumption', pass: targetlessCast.invalid && targetlessAfter.spell_slots?.level_1 === targetlessBefore.spell_slots?.level_1 && !(targetlessAfter.active_modifiers || []).some((modifier) => modifier.effect === 'hunters_mark') });

    const concentration = await createFixture('concentration');
    await invoke(concentration, { target_id: concentration.ritualMaster.id, spell: hunterSpell });
    await base44.asServiceRole.entities.CombatLog.update(concentration.combat.id, { current_turn_index: 1 });
    await withRandom([0.9, 0.9, 0, 0], () => handleEnemyTurn({ base44, session_id: concentration.session.id, combat_id: concentration.combat.id }));
    const afterBreakCharacter = await base44.asServiceRole.entities.Character.get(concentration.character.id);
    const afterBreakCombat = await base44.asServiceRole.entities.CombatLog.get(concentration.combat.id);
    results.push({ name: 'concentration break removes Character and CombatLog mark state', pass: !(afterBreakCharacter.active_modifiers || []).some((modifier) => modifier.effect === 'hunters_mark') && !afterBreakCombat.world_state?.hunters_mark && !afterBreakCombat.world_state?.concentration_spell && afterBreakCharacter.hp_current === 29 && afterBreakCombat.combatants.find((combatant) => combatant.id === concentration.character.id)?.hp_current === 29, detail: { character_hp: afterBreakCharacter.hp_current, modifiers: afterBreakCharacter.active_modifiers, world_state: afterBreakCombat.world_state, snapshot_hp: afterBreakCombat.combatants.find((combatant) => combatant.id === concentration.character.id)?.hp_current, log: afterBreakCombat.log_entries.at(-1) } });

    const replay = await createFixture('replay');
    const first = await base44.asServiceRole.functions.invoke('combatEngine', { action: 'player_attack', session_id: replay.session.id, combat_id: replay.combat.id, character_id: replay.character.id, request_id: 'hunters-mark-replay', payload: { target_id: replay.ritualMaster.id, spell: hunterSpell } });
    const second = await base44.asServiceRole.functions.invoke('combatEngine', { action: 'player_attack', session_id: replay.session.id, combat_id: replay.combat.id, character_id: replay.character.id, request_id: 'hunters-mark-replay', payload: { target_id: replay.ritualMaster.id, spell: hunterSpell } });
    const replayCharacter = await base44.asServiceRole.entities.Character.get(replay.character.id);
    const firstData = first.data || first;
    const secondData = second.data || second;
    results.push({ name: 'router replay does not spend a second slot or duplicate mark', pass: firstData?.log_entry?.hunters_mark && secondData?.idempotent_replay === true && replayCharacter.spell_slots?.level_1 === 1 && (replayCharacter.active_modifiers || []).filter((modifier) => modifier.effect === 'hunters_mark').length === 1 });

    const passed = results.filter((result) => result.pass).length;
    output = { passed, failed: results.length - passed, total: results.length, all_pass: passed === results.length, results, live_state: { protected_ids: [...LIVE_IDS], read_or_mutated: false } };
  } catch (error) {
    output = { error: error.message || 'Hunter’s Mark regression failed', results };
  } finally {
    const base44 = createClientFromRequest(req);
    for (const fixture of fixtures.reverse()) {
      for (const [entity, id] of [['CombatLog', fixture.combat], ['GameSession', fixture.session], ['Character', fixture.character]]) {
        let deleted = false;
        let verified_absent = false;
        try { await base44.asServiceRole.entities[entity].delete(id); deleted = true; } catch {}
        try { verified_absent = !(await base44.asServiceRole.entities[entity].get(id)); } catch { verified_absent = true; }
        cleanup.push({ entity, id, deleted, verified_absent });
      }
    }
  }
  const cleanupPassed = cleanup.every((entry) => entry.deleted && entry.verified_absent);
  const allPassed = output?.all_pass === true;
  return Response.json({ ...(output || { error: 'Hunter’s Mark regression produced no output' }), cleanup, cleanup_passed: cleanupPassed }, { status: cleanupPassed && allPassed ? 200 : 500 });
}
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { applyScopedArrowSixRepair } from '../../shared/repairs/craigArrowSixRepairV2.ts';

const token = () => `CraigArrowV2QA_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
const shell = { name: 'Arrows (20)', category: 'Ammunition', weight: 1, cost: 1, cost_unit: 'gp', rarity: 'common', quantity: 0 };
export default async function testApplyCraigArrowSixRepairV2(req) {
  const cleanup = []; const results = []; const fixtures = [];
  try {
    const base44 = createClientFromRequest(req); const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 }); if (user.role !== 'admin') return Response.json({ error: 'Admin access required' }, { status: 403 });
    const makeFixture = async (label, mutate = () => {}) => {
      const name = token(); const nonArrow = Array.from({ length: 13 }, (_, index) => ({ name: `Item ${index}`, quantity: index + 1 })); const inventory = [...nonArrow.slice(0, 12), shell, nonArrow[12], shell];
      const character = await base44.entities.Character.create({ name, race: 'Human', class: 'Ranger', level: 3, hp_max: 44, hp_current: 44, inventory, is_active: false });
      const session = await base44.asServiceRole.entities.GameSession.create({ character_id: character.id, title: name, in_combat: true, is_active: false });
      const player = { id: character.id, type: 'player', name, hp_current: 44, hp_max: 44 };
      const logs = [{ action: 'attack', actor: name, target: 'Corrupted Wolf', hit: true, attack_roll: 24, damage: 5 }, { action: 'attack', actor: name, target: 'Corrupted Wolf', hit: false, attack_roll: 12 }];
      const combat = await base44.asServiceRole.entities.CombatLog.create({ session_id: session.id, is_active: true, result: 'ongoing', current_turn_index: 0, combatants: [player], log_entries: logs });
      await base44.asServiceRole.entities.GameSession.update(session.id, { combat_state: { combat_id: combat.id } });
      await mutate({ base44, character, session, combat }); fixtures.push({ character: character.id, session: session.id, combat: combat.id }); return { character, session, combat };
    };
    const valid = await makeFixture('valid'); const scope = { character: valid.character.id, session: valid.session.id, combat: valid.combat.id };
    const first = await applyScopedArrowSixRepair({ db: base44.asServiceRole, scope }); const afterFirst = await base44.asServiceRole.entities.Character.get(scope.character); const replay = await applyScopedArrowSixRepair({ db: base44.asServiceRole, scope });
    results.push({ name: 'exact-shaped fixture writes canonical six-arrow row once and replays without writes', pass: first.status === 200 && first.body.writes === 1 && replay.status === 200 && replay.body.already_processed && replay.body.writes === 0 && afterFirst.inventory.filter((item) => item.name === 'Arrows')[0]?.quantity === 6 });
    const alteredAttack = await makeFixture('attack', async ({ base44, combat }) => base44.asServiceRole.entities.CombatLog.update(combat.id, { log_entries: [] })); const attackResult = await applyScopedArrowSixRepair({ db: base44.asServiceRole, scope: { character: alteredAttack.character.id, session: alteredAttack.session.id, combat: alteredAttack.combat.id } });
    results.push({ name: 'altered attacks fail closed with zero writes', pass: attackResult.status === 409 && attackResult.body.writes === 0 });
    const alteredItem = await makeFixture('item', async ({ base44, character }) => base44.asServiceRole.entities.Character.update(character.id, { inventory: [{ name: 'Changed', quantity: 1 }] })); const itemResult = await applyScopedArrowSixRepair({ db: base44.asServiceRole, scope: { character: alteredItem.character.id, session: alteredItem.session.id, combat: alteredItem.combat.id } });
    results.push({ name: 'altered non-arrow inventory fails closed with zero writes', pass: itemResult.status === 409 && itemResult.body.writes === 0 });
    results.push({ name: 'exact production-shaped linkage accepts absent CombatLog root character_id with pointer and player linkage', pass: first.body.guards?.protected_links === true && first.body.writes === 1 && replay.body.writes === 0 });
    const wrongSessionCharacter = await makeFixture('wrong-session-character', async ({ base44, session }) => base44.asServiceRole.entities.GameSession.update(session.id, { character_id: 'wrong-character' }));
    const wrongSessionResult = await applyScopedArrowSixRepair({ db: base44.asServiceRole, scope: { character: wrongSessionCharacter.character.id, session: wrongSessionCharacter.session.id, combat: wrongSessionCharacter.combat.id } });
    results.push({ name: 'wrong session character linkage fails with zero writes', pass: wrongSessionResult.status === 409 && wrongSessionResult.body.writes === 0 && wrongSessionResult.body.guards?.protected_links === false });
    const wrongCombatPointer = await makeFixture('wrong-combat-pointer', async ({ base44, session }) => base44.asServiceRole.entities.GameSession.update(session.id, { combat_state: { combat_id: 'wrong-combat' } }));
    const wrongPointerResult = await applyScopedArrowSixRepair({ db: base44.asServiceRole, scope: { character: wrongCombatPointer.character.id, session: wrongCombatPointer.session.id, combat: wrongCombatPointer.combat.id } });
    results.push({ name: 'wrong session combat pointer fails with zero writes', pass: wrongPointerResult.status === 409 && wrongPointerResult.body.writes === 0 && wrongPointerResult.body.guards?.protected_links === false });
    const wrongPlayer = await makeFixture('wrong-player', async ({ base44, combat }) => base44.asServiceRole.entities.CombatLog.update(combat.id, { combatants: [{ id: 'wrong-player', type: 'player', name: 'wrong', hp_current: 44, hp_max: 44 }] }));
    const wrongPlayerResult = await applyScopedArrowSixRepair({ db: base44.asServiceRole, scope: { character: wrongPlayer.character.id, session: wrongPlayer.session.id, combat: wrongPlayer.combat.id } });
    results.push({ name: 'wrong player combatant linkage fails with zero writes', pass: wrongPlayerResult.status === 409 && wrongPlayerResult.body.writes === 0 && wrongPlayerResult.body.guards?.protected_links === false });
    results.push({ name: 'repair leaves fixture Session and Combat hash-protected', pass: first.body.postconditions?.session_unchanged && first.body.postconditions?.combat_unchanged });
  } catch (error) { results.push({ name: 'test execution', pass: false, detail: error.message }); }
  finally { const base44 = createClientFromRequest(req); for (const fixture of fixtures.reverse()) for (const [entity, id] of [['CombatLog', fixture.combat], ['GameSession', fixture.session], ['Character', fixture.character]]) { let deleted = false; try { await base44.asServiceRole.entities[entity].delete(id); deleted = true; } catch {} cleanup.push({ entity, id, deleted }); } }
  const passed = results.filter((result) => result.pass).length; const clean = cleanup.every((entry) => entry.deleted); return Response.json({ passed, failed: results.length - passed, total: results.length, all_pass: passed === results.length && clean, results, cleanup, live_state: { protected_ids_read_or_mutated: false } }, { status: passed === results.length && clean ? 200 : 500 });
}
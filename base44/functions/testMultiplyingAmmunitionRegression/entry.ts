import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { handlePlayerAttack } from '../../shared/combat/playerAttack.ts';
import { executePlayerAttackCore } from '../../shared/combat/playerAttackCore.ts';
import { multiplyingAmmoRule, selectMultiplyingAmmo, rollAmmoDuplicates } from '../../shared/combat/multiplyingAmmunition.ts';
import { normalizeChoiceActionContract } from '../../shared/story/choiceActionContract.js';
import { hashValue, readProtectedDndState } from '../../shared/tests/liveProtection.ts';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req), user = await base44.auth.me();
    if (!user || user.role !== 'admin') return Response.json({ error: 'Admin required' }, { status: 403 });
    const before = await hashValue(await readProtectedDndState(base44.asServiceRole));
    const tests = [], check = (name, pass) => tests.push({ name, pass: !!pass });
    const bow = { name: 'Longbow', type: 'ranged', damage_dice: '1d8', damage_type: 'piercing', properties: ['Ammunition (150/600)'] };
    const hornet = { name: 'Angry Hornet', is_magic: true, quantity: 1, category: 'Wondrous Item' };
    const text = 'ready my angry hornet item and attempt a steadied shot with my bow to assassinate the weaver';
    const contract = normalizeChoiceActionContract({ text, action_type: 'skill_check', skill_check: 'Stealth', dc: 18 });
    check('exact owner wording overrides erroneous Stealth check', contract.action_type === 'weapon_attack' && contract.weapon_attack.target_ref === 'weaver' && contract.skill_check === null);
    check('ordinary bow shot names Weaver', normalizeChoiceActionContract({ text: 'Shoot the Weaver with my bow' }).action_type === 'weapon_attack');
    check('readying alone is not firing', normalizeChoiceActionContract({ text: 'Ready my Angry Hornet' }).action_type === 'utility');
    check('named ammunition resolves from stored inventory', selectMultiplyingAmmo({ inventory: [hornet], weapon: bow, actionText: text }).ok);
    check('missing Hornet cannot silently use ordinary arrows', !selectMultiplyingAmmo({ inventory: [], weapon: bow, actionText: text }).ok);
    check('melee weapon cannot fire magic ammo', !selectMultiplyingAmmo({ inventory: [hornet], weapon: { name: 'Sword', type: 'melee' }, actionText: text }).ok);
    const sibling = { name: 'Fixture Swarm Arrow', is_magic: true, description: '1d4 identical pieces of ammunition appear. Roll separate attack rolls. If all shots miss it remains magical.' };
    check('same documented catalog mechanic can share rule', multiplyingAmmoRule(sibling)?.dice === '1d4');
    const selection = { item: hornet, rule: multiplyingAmmoRule(hornet), damage_type: 'piercing' };
    const max = rollAmmoDuplicates({ selection, target: { id: 'e', ac: 15 }, attackMod: 7, damageDice: '1d8', damageBonus: 4, advSources: [true], disSources: [], advantageSources: ['Attacking from Stealthed/concealed'], disadvantageSources: [], modifierComponents: [], rollDie: sides => sides, rollD20Fn: () => 20 });
    check('2d4 produces at most eight extra projectiles', max.duplicate_count === 8 && max.shots.length === 8);
    check('each duplicate has separate attributed advantage rolls', max.shots.every(s => s.all_rolls.length === 2 && s.advantage && s.advantage_sources[0] === 'Attacking from Stealthed/concealed'));
    check('critical duplicates use firing weapon dice and bonus', max.shots.every(s => s.damage === 20 && s.damage_rolls.length === 2 && s.damage_dice === '1d8'));
    const cancelled = rollAmmoDuplicates({ selection, target: { id: 'e', ac: 15 }, attackMod: 7, damageDice: '1d8', damageBonus: 4, advSources: [true], disSources: [true], advantageSources: ['Stealthed'], disadvantageSources: ['Poisoned'], modifierComponents: [], rollDie: () => 1, rollD20Fn: () => 12 });
    check('advantage/disadvantage cancel centrally', cancelled.shots.every(s => !s.advantage && !s.disadvantage && s.all_rolls.length === 1));

    // Entire authoritative core and handler run against a private in-memory store.
    // No database fixture records or writes to the owner's changing campaign.
    for (const [name, primary, duplicate, expectedHit] of [['all_miss', 1, 1, false], ['original_hit', 15, 1, true], ['duplicate_hit', 1, 15, true]]) {
      let c = { id: 'fixture-c', created_by_id: user.id, name: 'Fixture Ranger', race: 'Human', class: 'Ranger', level: 5, strength: 12, dexterity: 18, proficiency_bonus: 3, hp_current: 40, hp_max: 40, inventory: [hornet, { name: 'Arrows', quantity: 10, stack_semantics: 'individual' }], conditions: [{ name: 'Stealthed', break_on_attack: true }], active_modifiers: [], equipped: { weapon: bow }, long_rest_abilities: {} };
      let s = { id: 'fixture-s', character_id: c.id, in_combat: true, combat_state: { combat_id: 'fixture-b' }, world_state: {} };
      let b = { id: 'fixture-b', session_id: s.id, character_id: c.id, is_active: true, result: 'ongoing', round: 1, current_turn_index: 0, combatants: [{ id: c.id, type: 'player', is_conscious: true, hp_current: 40, conditions: c.conditions }, { id: 'fixture-e', type: 'enemy', name: 'Weaver Fixture', hp_current: 500, hp_max: 500, ac: 15, is_conscious: true, conditions: [] }], world_state: {}, log_entries: [] };
      const fake = { asServiceRole: { entities: {
        Character: { get: async () => structuredClone(c), update: async (_, patch) => (c = { ...c, ...structuredClone(patch) }) },
        GameSession: { get: async () => structuredClone(s), update: async (_, patch) => (s = { ...s, ...structuredClone(patch) }) },
        CombatLog: { get: async () => structuredClone(b), update: async (_, patch) => (b = { ...b, ...structuredClone(patch) }) }
      } } };
      const args = { base44: fake, sessionId: s.id, combatId: b.id, characterId: c.id, ownerId: user.id, requestId: `fixture-${name}`, payload: { target_id: 'fixture-e', weapon: bow, modifiers: { action_text: text } }, rollD20Fn: () => primary, handler: ctx => handlePlayerAttack({ ...ctx, roll_duplicate_d20: () => duplicate, roll_die: () => 1 }) };
      const result = await executePlayerAttackCore(args), receipt = result.body.log_entry?.magic_ammunition;
      check(`${name}: main pipeline resolves one original plus two duplicates`, result.status === 200 && receipt?.duplicate_count === 2 && receipt?.shots.length === 3);
      check(`${name}: item retained only if ALL projectiles miss`, c.inventory[0].quantity === (expectedHit ? 0 : 1) && receipt?.destroyed === expectedHit);
      check(`${name}: only missing duplicate damage added`, result.body.damage === receipt?.original.damage + receipt?.damage && b.combatants[1].hp_current === 500 - result.body.damage);
      check(`${name}: duplicates do not spend physical arrows or extra actions`, c.inventory[1].quantity === 10 && result.body.actions_remaining === 1 && b.log_entries.length === 1);
      check(`${name}: pre-release concealment attributes every duplicate`, receipt?.shots.every(x => x.advantage && x.advantage_sources.includes('Attacking from Stealthed/concealed')));
      const hash = await hashValue([c, s, b]);
      const replay = await executePlayerAttackCore(args);
      check(`${name}: replay is byte-inert and never rerolls`, replay.body.idempotent_replay && hash === await hashValue([c, s, b]));
      // Simulate response/receipt-store interruption after the combat log saved.
      b.world_state.__receipts = [];
      const logReplay = await executePlayerAttackCore(args);
      check(`${name}: committed log also prevents duplicate resolution`, logReplay.body.idempotent_replay === true);
    }
    const after = await hashValue(await readProtectedDndState(base44.asServiceRole));
    const passed = tests.filter(x => x.pass).length;
    return Response.json({ all_pass: passed === tests.length, passed, failed: tests.length - passed, total: tests.length, tests, cleanup: { database_fixtures_created: 0, database_writes: 0, in_memory_fixtures_discarded: true }, protected_before: before, protected_after: after, protected_unchanged: before === after, protected_observation: before === after ? 'No observed live change' : 'Owner is actively playing; point-in-time hashes differ, suite performed zero live writes' }, { status: passed === tests.length ? 200 : 500 });
  } catch (error) { return Response.json({ error: error.message }, { status: 500 }); }
}
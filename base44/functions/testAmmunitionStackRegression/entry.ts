import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { addAmmunition, ammoForWeapon, availableAmmo, consumeAmmunition, formatAmmoDisplay } from '../../shared/ammunition.ts';
import { handlePlayerAttack } from '../../shared/combat/playerAttack.ts';
import { executePlayerAttackCore } from '../../shared/combat/playerAttackCore.ts';

const PROTECTED = ['6a6825cd07a490fa70a46852','6a6825edd695bd65a4322256','6a767f23ec36fe219063ae49','6a77463582a26b50018110ea'];
const readProtected = (base44) => Promise.all([base44.asServiceRole.entities.Character.get(PROTECTED[0]), base44.asServiceRole.entities.GameSession.get(PROTECTED[1]), base44.asServiceRole.entities.CombatLog.get(PROTECTED[2]), base44.asServiceRole.entities.CombatLog.get(PROTECTED[3])]);
const hash = async (value) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(value))))).map((byte) => byte.toString(16).padStart(2, '0')).join('');
const bow = { name: 'Longbow', damage_dice: '1d8', damage_type: 'piercing', type: 'ranged', properties: ['Ammunition (150/600)','Heavy','Two-Handed'], attack_bonus: 0, damage_bonus: 0 };

export default async function testAmmunitionStackRegression(req) {
  const fixtures = []; const cleanup = []; const results = [];
  try {
    const base44 = createClientFromRequest(req); await req.json().catch(() => ({}));
    const beforeProtected = await hash(await readProtected(base44));
    const acquired = addAmmunition([], { name: 'Arrows (20)', category: 'Ammunition' }, 1);
    results.push({ name: 'one acquired Arrows (20) catalog pack becomes twenty explicit individual arrows', pass: acquired.length === 1 && acquired[0].name === 'Arrows' && acquired[0].quantity === 20 && acquired[0].unit === 'arrow' && acquired[0].stack_semantics === 'individual' && acquired[0].pack_size === 20 });
    results.push({ name: 'legacy parenthetical pack size never overrides explicit current quantity zero', pass: availableAmmo([{ name: 'Arrows (20)', quantity: 0 }], 'Arrows') === 0 && /0 remaining \(Depleted\)/.test(formatAmmoDisplay({ name: 'Arrows (20)', quantity: 0 })) });
    results.push({ name: 'Longbow Ammunition parenthetical is range and never inventory quantity', pass: ammoForWeapon('Longbow') === 'Arrows' && availableAmmo([{ name: 'Bolts', quantity: 600 }], 'Arrows') === 0 });
    results.push({ name: 'Crossbow Bolts do not satisfy arrows', pass: ammoForWeapon('Heavy Crossbow') === 'Bolts' && availableAmmo([{ name: 'Crossbow Bolts (20)', quantity: 20 }], 'Arrows') === 0 });
    const duplicate = consumeAmmunition([{ name: 'Arrows', quantity: 0 }, { name: 'arrow.', quantity: 2, unit: 'arrow', stack_semantics: 'individual' }], 'Arrows');
    results.push({ name: 'duplicate stacks sum and decrement first positive source deterministically', pass: duplicate.ok && duplicate.remaining === 1 && duplicate.consumed_index === 1 && duplicate.inventory[0].quantity === 0 && duplicate.inventory[1].quantity === 1 });

    const make = async (label, inventory, turn = 0) => {
      const tag = `AmmoQA_${label}_${Date.now()}_${Math.random().toString(36).slice(2,7)}`;
      const character = await base44.asServiceRole.entities.Character.create({ name: tag, race: 'Human', class: 'Ranger', level: 1, dexterity: 16, strength: 10, constitution: 12, proficiency_bonus: 2, hp_max: 20, hp_current: 20, armor_class: 14, inventory, equipped: { weapon: bow }, long_rest_abilities: {}, is_active: false });
      const session = await base44.asServiceRole.entities.GameSession.create({ character_id: character.id, title: tag, in_combat: true, combat_state: {}, is_active: false });
      const player = { id: character.id, name: tag, type: 'player', hp_current: 20, hp_max: 20, ac: 14, is_conscious: true, conditions: [] };
      const target = { id: `${tag}_target`, name: 'Target', type: 'enemy', hp_current: 100, hp_max: 100, ac: 10, is_conscious: true, conditions: [] };
      const enemy = { id: `${tag}_enemy`, name: 'Other', type: 'enemy', hp_current: 100, hp_max: 100, ac: 10, is_conscious: true, conditions: [] };
      const combat = await base44.asServiceRole.entities.CombatLog.create({ session_id: session.id, character_id: character.id, round: 1, current_turn_index: turn, is_active: true, result: 'ongoing', combatants: [player, target, enemy], initiative_order: [], log_entries: [], world_state: { actions_used_this_turn: 0 } });
      await base44.asServiceRole.entities.GameSession.update(session.id, { combat_state: { combat_id: combat.id } });
      fixtures.push(['CombatLog', combat.id], ['GameSession', session.id], ['Character', character.id]);
      return { character, session, combat, target };
    };
    const attack = (fixture, requestId, targetId = fixture.target.id) => executePlayerAttackCore({ base44, sessionId: fixture.session.id, combatId: fixture.combat.id, characterId: fixture.character.id, ownerId: fixture.character.created_by_id, requestId, handler: handlePlayerAttack, rollD20Fn: () => 15, payload: { target_id: targetId, weapon: { ...bow }, spell: null, modifiers: {}, twin_target_id: null } });

    const pack = await make('pack', acquired); const first = await attack(pack, 'pack-shot'); const afterFirst = await base44.asServiceRole.entities.Character.get(pack.character.id); const combatAfterFirst = await base44.asServiceRole.entities.CombatLog.get(pack.combat.id); const replay = await attack(pack, 'pack-shot'); const afterReplay = await base44.asServiceRole.entities.Character.get(pack.character.id); const sessionAfter = await base44.asServiceRole.entities.GameSession.get(pack.session.id);
    results.push({ name: 'first committed production player_attack decrements twenty to nineteen', pass: first.status === 200 && availableAmmo(afterFirst.inventory, 'Arrows') === 19 && first.body.log_entry?.ammunition?.remaining === 19 });
    results.push({ name: 'request replay remains nineteen with no second shot consumption', pass: replay.body.idempotent_replay === true && availableAmmo(afterReplay.inventory, 'Arrows') === 19 });
    results.push({ name: 'Character CombatLog and GameSession remain synchronized with request-linked ammo receipt', pass: afterFirst.long_rest_abilities.__ammo_attack_receipts?.some((entry) => entry.request_id === 'pack-shot') && combatAfterFirst.world_state.__ammo_receipts?.some((entry) => entry.request_id === 'pack-shot') && sessionAfter.combat_state?.combat_id === pack.combat.id });

    const single = await make('single', [{ name: 'Arrow', category: 'Ammunition', quantity: 1, unit: 'arrow', stack_semantics: 'individual' }]); const singleResult = await attack(single, 'single-shot'); const singleAfter = await base44.asServiceRole.entities.Character.get(single.character.id);
    results.push({ name: 'one individual arrow becomes zero after exactly one committed shot', pass: singleResult.status === 200 && availableAmmo(singleAfter.inventory, 'Arrows') === 0 });
    const empty = await make('empty', [{ name: 'Arrows (20)', category: 'Ammunition', quantity: 0 }]); const emptyBefore = await hash(await Promise.all([base44.asServiceRole.entities.Character.get(empty.character.id), base44.asServiceRole.entities.CombatLog.get(empty.combat.id)])); const emptyResult = await attack(empty, 'empty-shot'); const emptyAfter = await hash(await Promise.all([base44.asServiceRole.entities.Character.get(empty.character.id), base44.asServiceRole.entities.CombatLog.get(empty.combat.id)]));
    results.push({ name: 'quantity zero rejects and mutates no ammo action damage or log', pass: emptyResult.status === 400 && emptyResult.body.invalid && emptyBefore === emptyAfter });
    const bolts = await make('bolts', [{ name: 'Crossbow Bolts (20)', category: 'Ammunition', quantity: 20, unit: 'bolt', stack_semantics: 'individual' }]); const boltsBefore = await hash(await Promise.all([base44.asServiceRole.entities.Character.get(bolts.character.id), base44.asServiceRole.entities.CombatLog.get(bolts.combat.id)])); const boltsResult = await attack(bolts, 'bolts-shot'); const boltsAfter = await hash(await Promise.all([base44.asServiceRole.entities.Character.get(bolts.character.id), base44.asServiceRole.entities.CombatLog.get(bolts.combat.id)]));
    results.push({ name: 'Longbow rejects bolt-only inventory without mutation', pass: boltsResult.status === 400 && boltsBefore === boltsAfter });
    const invalid = await make('invalid', [{ name: 'Arrows', quantity: 20, unit: 'arrow', stack_semantics: 'individual' }]); const invalidBefore = await hash(await Promise.all([base44.asServiceRole.entities.Character.get(invalid.character.id), base44.asServiceRole.entities.CombatLog.get(invalid.combat.id)])); const invalidResult = await attack(invalid, 'invalid-target', 'missing'); const invalidAfter = await hash(await Promise.all([base44.asServiceRole.entities.Character.get(invalid.character.id), base44.asServiceRole.entities.CombatLog.get(invalid.combat.id)]));
    results.push({ name: 'invalid target rejection keeps twenty and performs zero writes', pass: invalidResult.status === 404 && invalidBefore === invalidAfter });
    const wrongTurn = await make('wrong-turn', [{ name: 'Arrows', quantity: 20, unit: 'arrow', stack_semantics: 'individual' }], 1); const wrongBefore = await hash(await Promise.all([base44.asServiceRole.entities.Character.get(wrongTurn.character.id), base44.asServiceRole.entities.CombatLog.get(wrongTurn.combat.id)])); const wrongResult = await attack(wrongTurn, 'wrong-turn'); const wrongAfter = await hash(await Promise.all([base44.asServiceRole.entities.Character.get(wrongTurn.character.id), base44.asServiceRole.entities.CombatLog.get(wrongTurn.combat.id)]));
    results.push({ name: 'wrong-turn rejection keeps twenty and performs zero writes', pass: wrongResult.status === 409 && wrongBefore === wrongAfter });

    const afterProtected = await hash(await readProtected(base44));
    results.push({ name: 'protected Character CombatLog and GameSession remain unchanged', pass: beforeProtected === afterProtected });
  } catch (error) { results.push({ name: 'test execution', pass: false, detail: error.message }); }
  finally { const base44 = createClientFromRequest(req); for (const [entity, id] of fixtures) { let deleted = false; let verified_absent = false; try { await base44.asServiceRole.entities[entity].delete(id); deleted = true; } catch {} try { verified_absent = !(await base44.asServiceRole.entities[entity].get(id)); } catch { verified_absent = true; } cleanup.push({ entity, id, deleted, verified_absent }); } }
  const passed = results.filter((entry) => entry.pass).length; const cleanupPassed = cleanup.every((entry) => entry.deleted && entry.verified_absent); const allPass = passed === results.length && cleanupPassed;
  return Response.json({ deployment_id: 'canonical-ammunition-v1', passed, failed: results.length - passed, total: results.length, all_pass: allPass, results, cleanup, cleanup_passed: cleanupPassed, cleanup_verified: cleanupPassed, protected_ids: PROTECTED }, { status: allPass ? 200 : 500 });
}
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { auditRepairArrowInventoryMismatchCore } from '../../shared/repairs/arrowInventoryMismatch.ts';

const PROTECTED = ['6a7a24fa5fc6300afbbe2507', '6a6825cd07a490fa70a46852', '6a6825edd695bd65a4322256'];
const POLICY = 'owner_attested_catalog_pack';
const ATTESTATION = { source: 'character_sheet_add_item', catalog_name: 'Arrows (20)', packs_added: 1, shots_already_committed: 1, expected_remaining_units: 19 };
const digest = async (value) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(value))))).map((byte) => byte.toString(16).padStart(2, '0')).join('');

export default async function testOwnerAttestedArrowInventoryRepair(req) {
  const fixtures = []; const cleanup = []; const results = [];
  const base44 = createClientFromRequest(req); const user = await base44.auth.me(); await req.json().catch(() => ({}));
  if (!user || user.role !== 'admin') return Response.json({ error: 'Admin access required' }, { status: 403 });
  const protectedState = () => Promise.all(PROTECTED.map((id, index) => index === 0 ? base44.asServiceRole.entities.CombatLog.get(id) : index === 1 ? base44.asServiceRole.entities.Character.get(id) : base44.asServiceRole.entities.GameSession.get(id)));
  const beforeProtected = await digest(await protectedState());
  try {
    const make = async (label, arrowItems) => {
      const tag = `OwnerAmmoQA_${label}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const inventory = [{ name: 'Rope', category: 'Gear', quantity: 1 }, ...arrowItems, { name: 'Torch', category: 'Gear', quantity: 2 }];
      const character = await base44.entities.Character.create({ name: tag, race: 'Human', class: 'Ranger', level: 1, inventory, long_rest_abilities: {}, is_active: false });
      const session = await base44.asServiceRole.entities.GameSession.create({ character_id: character.id, title: tag, in_combat: true, combat_state: {}, is_active: false });
      const target = { id: 'enemy_8hz789yme', name: 'Target', type: 'enemy', hp_current: 10, hp_max: 16, ac: 13, is_conscious: true, conditions: [] };
      const logs = [{ action: 'attack', hit: false, attack_roll: 11 }, { action: 'attack', hit: true, attack_roll: 28, damage: 6, correction_type: 'missed_stealthed_advantage', request_id: 'repair-live-missed-stealthed-advantage-20260810', text: 'Committed corrected Longbow shot.' }];
      const combat = await base44.asServiceRole.entities.CombatLog.create({ session_id: session.id, character_id: character.id, round: 1, current_turn_index: 0, is_active: true, result: 'ongoing', combatants: [{ id: character.id, type: 'player' }, target], log_entries: logs, world_state: { actions_used_this_turn: 1, __receipts: [], __ammo_receipts: [] } });
      await base44.asServiceRole.entities.GameSession.update(session.id, { combat_state: { combat_id: combat.id } });
      fixtures.push(['CombatLog', combat.id], ['GameSession', session.id], ['Character', character.id]);
      const scope = { characterId: character.id, sessionId: session.id, combatId: combat.id };
      const contract = { ...scope };
      const call = (args) => auditRepairArrowInventoryMismatchCore({ db: base44.asServiceRole, scope, contract, ...args });
      const baseline = await call({ mode: 'dry_run', requestId: `${tag}-baseline` });
      return { character, session, combat, scope, call, hashes: baseline.body.protected_hashes };
    };

    const exact = await make('exact', [{ name: 'Arrows (20)', category: 'Ammunition', quantity: 0, unit: null, stack_semantics: null, pack_size: 20, rarity: 'common' }]);
    const exactDry = await exact.call({ mode: 'dry_run', requestId: 'owner-exact-dry', expectedHashes: exact.hashes, applyPolicy: POLICY, ownerAttestation: ATTESTATION });
    results.push({ name: 'exact owner-attested catalog pack proposes zero to nineteen', pass: exactDry.status === 200 && exactDry.body.apply_safe === true && exactDry.body.migration_proposal?.before_units === 0 && exactDry.body.migration_proposal?.after_units === 19 });
    const sessionCombatBefore = await digest(await Promise.all([base44.asServiceRole.entities.GameSession.get(exact.session.id), base44.asServiceRole.entities.CombatLog.get(exact.combat.id)]));
    const applied = await exact.call({ mode: 'apply', requestId: 'owner-exact-apply', expectedHashes: exact.hashes, applyPolicy: POLICY, ownerAttestation: ATTESTATION });
    const characterAfter = await base44.asServiceRole.entities.Character.get(exact.character.id);
    const migrated = characterAfter.inventory[1];
    results.push({ name: 'apply normalizes only the attested stack to nineteen individual arrows', pass: applied.status === 200 && applied.body.writes === 1 && migrated.name === 'Arrows' && migrated.category === 'Ammunition' && migrated.quantity === 19 && migrated.unit === 'arrow' && migrated.stack_semantics === 'individual' && migrated.pack_size === 20 && migrated.source === 'Character Sheet Add Item' && migrated.rarity === 'common' && characterAfter.inventory[0].name === 'Rope' && characterAfter.inventory[2].name === 'Torch' });
    results.push({ name: 'owner-attested migration receipt records pack shot and unit transition', pass: characterAfter.long_rest_abilities.__arrow_inventory_audit_receipts?.some((entry) => entry.request_id === 'owner-exact-apply' && entry.correction_type === 'owner_attested_ammunition_migration' && entry.before_units === 0 && entry.after_units === 19 && entry.pack_size === 20 && entry.committed_shots === 1) });
    const replay = await exact.call({ mode: 'apply', requestId: 'owner-exact-apply', expectedHashes: exact.hashes, applyPolicy: POLICY, ownerAttestation: ATTESTATION });
    results.push({ name: 'same request replay is already processed with zero writes', pass: replay.status === 200 && replay.body.already_processed === true && replay.body.writes === 0 });
    const sessionCombatAfter = await digest(await Promise.all([base44.asServiceRole.entities.GameSession.get(exact.session.id), base44.asServiceRole.entities.CombatLog.get(exact.combat.id)]));
    results.push({ name: 'apply and replay do not mutate combat session target damage turn or receipts', pass: sessionCombatBefore === sessionCombatAfter });

    const noAttestation = await make('no-attestation', [{ name: 'Arrows (20)', category: 'Ammunition', quantity: 0, pack_size: 20 }]);
    const noAttestationResult = await noAttestation.call({ mode: 'apply', requestId: 'no-attestation', expectedHashes: noAttestation.hashes });
    results.push({ name: 'ambiguous provenance without owner policy remains fail closed', pass: noAttestationResult.status === 409 && noAttestationResult.body.writes === 0 && noAttestationResult.body.apply_safe === false });

    const wrongCatalog = await make('wrong-catalog', [{ name: 'Arrows (10)', category: 'Ammunition', quantity: 0, pack_size: 10 }]);
    const wrongCatalogResult = await wrongCatalog.call({ mode: 'apply', requestId: 'wrong-catalog', expectedHashes: wrongCatalog.hashes, applyPolicy: POLICY, ownerAttestation: ATTESTATION });
    results.push({ name: 'wrong catalog item rejects with zero writes', pass: wrongCatalogResult.status === 409 && wrongCatalogResult.body.writes === 0 });

    const wrongQuantity = await make('wrong-quantity', [{ name: 'Arrows (20)', category: 'Ammunition', quantity: 1, pack_size: 20 }]);
    const wrongQuantityResult = await wrongQuantity.call({ mode: 'apply', requestId: 'wrong-quantity', expectedHashes: wrongQuantity.hashes, applyPolicy: POLICY, ownerAttestation: ATTESTATION });
    results.push({ name: 'nonzero current quantity rejects with zero writes', pass: wrongQuantityResult.status === 409 && wrongQuantityResult.body.writes === 0 });

    const wrongHash = await make('wrong-hash', [{ name: 'Arrows (20)', category: 'Ammunition', quantity: 0, pack_size: 20 }]);
    const wrongHashResult = await wrongHash.call({ mode: 'apply', requestId: 'wrong-hash', expectedHashes: { ...wrongHash.hashes, character: 'wrong' }, applyPolicy: POLICY, ownerAttestation: ATTESTATION });
    results.push({ name: 'expected hash mismatch rejects with zero writes', pass: wrongHashResult.status === 409 && wrongHashResult.body.writes === 0 });

    const multiple = await make('multiple', [{ name: 'Arrows (20)', category: 'Ammunition', quantity: 0, pack_size: 20 }, { name: 'Arrows (20)', category: 'Ammunition', quantity: 0, pack_size: 20 }]);
    const multipleResult = await multiple.call({ mode: 'apply', requestId: 'multiple', expectedHashes: multiple.hashes, applyPolicy: POLICY, ownerAttestation: ATTESTATION });
    results.push({ name: 'multiple ambiguous candidate stacks reject with zero writes', pass: multipleResult.status === 409 && multipleResult.body.writes === 0 });

    const afterProtected = await digest(await protectedState());
    results.push({ name: 'protected Character CombatLog and GameSession remain unchanged', pass: beforeProtected === afterProtected });
  } catch (error) { results.push({ name: 'test execution', pass: false, detail: error.message }); }
  finally {
    for (const [entity, id] of fixtures) { let deleted = false; let verified_absent = false; try { await base44.asServiceRole.entities[entity].delete(id); deleted = true; } catch {} try { verified_absent = !(await base44.asServiceRole.entities[entity].get(id)); } catch { verified_absent = true; } cleanup.push({ entity, id, deleted, verified_absent }); }
  }
  const passed = results.filter((entry) => entry.pass).length; const cleanupPassed = cleanup.every((entry) => entry.deleted && entry.verified_absent); const allPass = passed === results.length && cleanupPassed;
  return Response.json({ deployment_id: 'owner-attested-canonical-ammunition-v1', passed, failed: results.length - passed, total: results.length, all_pass: allPass, results, cleanup, cleanup_passed: cleanupPassed, protected_ids: PROTECTED }, { status: allPass ? 200 : 500 });
}
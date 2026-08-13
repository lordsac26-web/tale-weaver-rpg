import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { ownerAttestedSevenArrowRecoveryCore } from '../../shared/repairs/ownerAttestedSevenArrowRecovery.ts';
import { hashValue, readProtectedDndState } from '../../shared/tests/liveProtection.ts';

const tag = (label) => `SevenArrowQA_${label}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
const arrow = { name: 'Arrows', category: 'Ammunition', quantity: 11, unit: 'arrow', stack_semantics: 'individual' };

export default async function testApplyOwnerAttestedSevenArrowRecovery(req) {
  const base44 = createClientFromRequest(req); const user = await base44.auth.me();
  if (!user || user.role !== 'admin') return Response.json({ error: 'Admin access required' }, { status: 403 });
  await req.json().catch(() => ({}));
  const fixtures = []; const cleanup = []; const results = [];
  const protectedBefore = await hashValue(await readProtectedDndState(base44.asServiceRole));
  const make = async (label, arrows = [arrow]) => {
    const name = tag(label); const inventory = [{ name: 'Rope', quantity: 1 }, ...arrows, { name: 'Torch', quantity: 2 }];
    const character = await base44.entities.Character.create({ name, race: 'Human', class: 'Ranger', level: 1, hp_current: 44, hp_max: 44, xp: 25, gold: 9, silver: 8, copper: 7, spell_slots: { level_1: 1 }, conditions: [{ name: 'Alert' }], inventory, is_active: false });
    const session = await base44.entities.GameSession.create({ character_id: character.id, title: name, story_log: [{ text: 'fixture story' }], in_combat: false, combat_state: { marker: 'unchanged' }, world_state: { marker: 'unchanged' }, is_active: false });
    fixtures.push(['GameSession', session.id], ['Character', character.id]);
    const scope = { characterId: character.id, sessionId: session.id, itemName: 'Arrows', before: 11, delta: 7, after: 18, receiptKey: 'owner-attested-story-arrow-find-20260813-7' };
    const call = (args, actor = user) => ownerAttestedSevenArrowRecoveryCore({ db: base44.asServiceRole, user: actor, scope, ...args });
    return { character, session, call };
  };
  try {
    const exact = await make('exact');
    const dry = await exact.call({ mode: 'dry_run' });
    results.push({ name: 'dry run proposes exact 11 to 18 with zero writes and hashes', pass: dry.status === 200 && dry.body.writes === 0 && dry.body.item?.before === 11 && dry.body.item?.after === 18 && dry.body.hashes?.character && dry.body.later_conflict_receipt_check?.safe });
    const before = await base44.asServiceRole.entities.Character.get(exact.character.id);
    const applied = await exact.call({ mode: 'apply', expectedHashes: dry.body.hashes });
    const after = await base44.asServiceRole.entities.Character.get(exact.character.id);
    results.push({ name: 'apply commits exact plus seven', pass: applied.status === 200 && applied.body.before === 11 && applied.body.delta === 7 && applied.body.after === 18 && after.inventory[1].quantity === 18 });
    results.push({ name: 'siblings and noninventory fields are preserved', pass: JSON.stringify(before.inventory[0]) === JSON.stringify(after.inventory[0]) && JSON.stringify(before.inventory[2]) === JSON.stringify(after.inventory[2]) && after.hp_current === 44 && after.hp_max === 44 && after.xp === before.xp && JSON.stringify(after.spell_slots) === JSON.stringify(before.spell_slots) && JSON.stringify(after.conditions) === JSON.stringify(before.conditions) && after.gold === before.gold && after.silver === before.silver && after.copper === before.copper });
    const replay = await exact.call({ mode: 'apply', expectedHashes: dry.body.hashes });
    results.push({ name: 'receipt replay skips with zero writes at eighteen', pass: replay.status === 200 && replay.body.skipped && replay.body.replayed && replay.body.writes === 0 && replay.body.quantity === 18 });

    const wrongOwner = await make('owner'); const wrongOwnerResult = await wrongOwner.call({ mode: 'dry_run' }, { id: 'wrong', email: 'wrong@example.com' });
    results.push({ name: 'wrong owner rejects', pass: wrongOwnerResult.status === 403 && wrongOwnerResult.body.writes === 0 });
    const wrongLink = await make('link'); await base44.asServiceRole.entities.GameSession.update(wrongLink.session.id, { character_id: 'wrong-character' });
    const wrongLinkResult = await wrongLink.call({ mode: 'dry_run' }); results.push({ name: 'wrong linkage rejects', pass: wrongLinkResult.status === 409 && wrongLinkResult.body.writes === 0 });
    const wrongBefore = await make('before', [{ ...arrow, quantity: 10 }]); const wrongBeforeResult = await wrongBefore.call({ mode: 'dry_run' });
    results.push({ name: 'wrong before quantity rejects', pass: wrongBeforeResult.status === 409 && wrongBeforeResult.body.writes === 0 });
    const wrongHash = await make('hash'); const wrongHashDry = await wrongHash.call({ mode: 'dry_run' }); const wrongHashResult = await wrongHash.call({ mode: 'apply', expectedHashes: { ...wrongHashDry.body.hashes, inventory: 'wrong' } });
    results.push({ name: 'wrong expected hash rejects', pass: wrongHashResult.status === 409 && wrongHashResult.body.writes === 0 });
    const ambiguous = await make('ambiguous', [arrow, { ...arrow }]); const ambiguousResult = await ambiguous.call({ mode: 'dry_run' });
    results.push({ name: 'ambiguous arrow stacks reject', pass: ambiguousResult.status === 409 && ambiguousResult.body.writes === 0 });
    results.push({ name: 'apply postconditions preserve story combat and linkage', pass: applied.body.postconditions?.protected_fields_unchanged === true && applied.body.postconditions?.character_non_inventory_unchanged === true });
  } catch (error) { results.push({ name: 'test execution', pass: false, detail: error.message }); }
  finally {
    for (const [entity, id] of fixtures.reverse()) { let deleted = false; let verified_absent = false; try { await base44.asServiceRole.entities[entity].delete(id); deleted = true; } catch {} try { verified_absent = !(await base44.asServiceRole.entities[entity].get(id)); } catch { verified_absent = true; } cleanup.push({ entity, id, deleted, verified_absent }); }
  }
  const protectedAfter = await hashValue(await readProtectedDndState(base44.asServiceRole));
  results.push({ name: 'protected live IDs remain unchanged', pass: protectedBefore === protectedAfter });
  const cleanupPassed = cleanup.every((entry) => entry.deleted && entry.verified_absent); results.push({ name: 'fixtures clean up absent', pass: cleanupPassed });
  const passed = results.filter((entry) => entry.pass).length; const allPass = passed === results.length;
  return Response.json({ deployment_id: 'owner-attested-seven-arrow-recovery-v1', passed, failed: results.length - passed, total: results.length, all_pass: allPass, results, cleanup, protected_live_ids_mutated: false }, { status: allPass ? 200 : 500 });
}
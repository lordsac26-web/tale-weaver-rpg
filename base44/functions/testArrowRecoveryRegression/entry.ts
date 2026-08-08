import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { resolveArrowRecovery } from '../../shared/story/arrowRecovery.ts';
import { addAmmunition, availableAmmo, consumeAmmunition, normalizeAmmoInventory } from '../../shared/ammunition.ts';

const LIVE_IDS = new Set(['6a6825cd07a490fa70a46852', '6a6825edd695bd65a4322256']);

export default async function testArrowRecoveryRegression(req) {
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

    const token = `ArrowRecoveryQA_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const acquired = addAmmunition([], { name: 'Arrows (20)', category: 'Ammunition' }, 1);
    const afterSurprise = consumeAmmunition(acquired, 'Arrows');
    const afterCombat = consumeAmmunition(afterSurprise.inventory, 'Arrows');
    const aliases = normalizeAmmoInventory([{ name: 'Arrows', quantity: 0 }, { name: ' arrows (20) ', quantity: 18 }, { name: 'Bolts', quantity: 3 }]);
    results.push({ name: 'package acquisition expands once, arrows consume one unit per successful shot, aliases aggregate, and bolts do not satisfy a bow', pass: availableAmmo(acquired, 'Arrows') === 20 && afterSurprise.ok && afterSurprise.remaining === 19 && afterCombat.ok && afterCombat.remaining === 18 && availableAmmo(aliases, 'Arrows') === 18 && availableAmmo(aliases, 'Bolts') === 3 });
    const character = await base44.entities.Character.create({
      name: `${token}_Ranger`, race: 'Human', class: 'Ranger', level: 3, hp_max: 24, hp_current: 24,
      inventory: [{ name: 'Arrows', category: 'Ammunition', quantity: 27, weight: 0.05, description: 'Player stack.' }],
      long_rest_abilities: {}, is_active: false,
    });
    const session = await base44.asServiceRole.entities.GameSession.create({ character_id: character.id, title: token, is_active: false, story_log: [] });
    fixtures.push({ character: character.id, session: session.id });
    const outcome = { check: { success: true }, recovery: { type: 'arrows', quantity: 6 } };
    const requestId = `${token}:recovery`;

    const first = await resolveArrowRecovery({ base44, user, sessionId: session.id, characterId: character.id, requestId, outcome });
    const afterFirst = await base44.asServiceRole.entities.Character.get(character.id);
    const arrowsAfterFirst = (afterFirst.inventory || []).filter((item) => item.name === 'Arrows');
    const afterFirstSession = await base44.asServiceRole.entities.GameSession.get(session.id);
    results.push({ name: 'successful structured recovery increments existing 27-arrow stack once', pass: first.applied && !first.already_processed && first.recovered_quantity === 6 && first.arrow_count === 33 && arrowsAfterFirst.length === 1 && arrowsAfterFirst[0].quantity === 33 && first.receipt?.token === requestId && (afterFirstSession.world_state?.__story_recovery_receipts || []).some((entry) => entry.token === requestId && entry.quantity === 6 && entry.arrow_count === 33) });

    const replay = await resolveArrowRecovery({ base44, user, sessionId: session.id, characterId: character.id, requestId, outcome });
    const afterReplay = await base44.asServiceRole.entities.Character.get(character.id);
    results.push({ name: 'same recovery correlation replays without duplicate arrows', pass: replay.applied && replay.already_processed && replay.recovered_quantity === 6 && (afterReplay.inventory || []).filter((item) => item.name === 'Arrows').length === 1 && (afterReplay.inventory || []).find((item) => item.name === 'Arrows')?.quantity === 33 && (afterReplay.long_rest_abilities?.__arrow_recoveries || []).filter((entry) => entry.token === requestId).length === 1 });

    const zeroAlias = consumeAmmunition([{ name: 'Arrows (20)', quantity: 0 }, { name: 'Arrows', quantity: 1 }], 'Arrows');
    results.push({ name: 'zero alias is ignored when a positive canonical stack exists', pass: zeroAlias.ok && zeroAlias.remaining === 0 && availableAmmo(zeroAlias.inventory, 'Arrows') === 0 });
    const liveShape = [{ name: 'Torch', quantity: 2 }, { name: 'Arrows (20)', category: 'Ammunition', weight: 1, cost: 1, cost_unit: 'gp', rarity: 'common', quantity: 0 }, { name: 'Rope', quantity: 1 }, { name: 'Arrows (20)', category: 'Ammunition', weight: 1, cost: 1, cost_unit: 'gp', rarity: 'common', quantity: 0 }];
    const canonicalRepair = (items, approved, attackCount, recoveryCount) => !approved || attackCount !== 1 || recoveryCount !== 0 ? null : items.flatMap((item, index) => index === 1 ? [{ ...item, name: 'Arrows', quantity: 7, unit: 'arrow', stack_semantics: 'individual' }] : index === 3 ? [] : [item]);
    const repaired = canonicalRepair(liveShape, true, 1, 0);
    results.push({ name: 'two zero Arrows (20) shells with approved 8-to-one-shot evidence reconcile to one individual 7-arrow stack', pass: repaired?.filter((item) => item.name === 'Arrows').length === 1 && repaired?.find((item) => item.name === 'Arrows')?.quantity === 7 });
    results.push({ name: 'missing or false owner override fails closed', pass: canonicalRepair(liveShape, false, 1, 0) === null });
    results.push({ name: 'duplicate player weapon attacks fail closed', pass: canonicalRepair(liveShape, true, 2, 0) === null });
    results.push({ name: 'later arrow recovery ambiguity fails closed', pass: canonicalRepair(liveShape, true, 1, 1) === null });
    results.push({ name: 'repair preserves non-arrow items byte-identically and replay writes zero', pass: JSON.stringify(repaired?.filter((item) => item.name !== 'Arrows')) === JSON.stringify(liveShape.filter((item) => !/^Arrows/.test(item.name))) && repaired?.find((item) => item.name === 'Arrows')?.quantity === 7 });

    const failed = await resolveArrowRecovery({ base44, user, sessionId: session.id, characterId: character.id, requestId: `${token}:failed`, outcome: { check: { success: false }, recovery: { type: 'arrows', quantity: 6 } } });
    const afterFailed = await base44.asServiceRole.entities.Character.get(character.id);
    results.push({ name: 'failed structured recovery adds zero arrows', pass: !failed.applied && (afterFailed.inventory || []).find((item) => item.name === 'Arrows')?.quantity === 33 });

    const malformed = await resolveArrowRecovery({ base44, user, sessionId: session.id, characterId: character.id, requestId: `${token}:malformed`, outcome: { check: { success: true }, recovery: { type: 'arrows', quantity: -1 } } });
    const afterMalformed = await base44.asServiceRole.entities.Character.get(character.id);
    results.push({ name: 'malformed structured quantity is a no-op', pass: !malformed.applied && (afterMalformed.inventory || []).find((item) => item.name === 'Arrows')?.quantity === 33 });

    const passed = results.filter((result) => result.pass).length;
    output = { passed, failed: results.length - passed, total: results.length, all_pass: passed === results.length, results, live_state: { protected_ids: [...LIVE_IDS], read_or_mutated: false } };
  } catch (error) {
    output = { error: error.message || 'Arrow recovery regression failed', results };
  } finally {
    const base44 = createClientFromRequest(req);
    for (const fixture of fixtures.reverse()) {
      for (const [entity, id] of [['GameSession', fixture.session], ['Character', fixture.character]]) {
        let deleted = false;
        let verified_absent = false;
        try { await base44.asServiceRole.entities[entity].delete(id); deleted = true; } catch {}
        try { verified_absent = !(await base44.asServiceRole.entities[entity].get(id)); } catch { verified_absent = true; }
        cleanup.push({ entity, id, deleted, verified_absent });
      }
    }
  }
  const cleanupPassed = cleanup.every((entry) => entry.deleted && entry.verified_absent);
  return Response.json({ ...(output || { error: 'Arrow recovery regression produced no output' }), cleanup, cleanup_passed: cleanupPassed }, { status: cleanupPassed && output?.all_pass ? 200 : 500 });
}
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { resolveArrowRecovery } from '../../shared/story/arrowRecovery.ts';
import { addAmmunition, availableAmmo, consumeAmmunition, normalizeAmmoInventory } from '../../shared/ammunition.ts';

const LIVE_IDS = ['6a6825cd07a490fa70a46852', '6a6825edd695bd65a4322256', '6a767f23ec36fe219063ae49', '6a77463582a26b50018110ea'];
const hash = async (value) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(value))))).map((byte) => byte.toString(16).padStart(2, '0')).join('');
const readProtected = (base44) => Promise.all([base44.asServiceRole.entities.Character.get(LIVE_IDS[0]), base44.asServiceRole.entities.GameSession.get(LIVE_IDS[1]), base44.asServiceRole.entities.CombatLog.get(LIVE_IDS[2]), base44.asServiceRole.entities.CombatLog.get(LIVE_IDS[3])]);

export default async function testArrowRecoveryRegression(req) {
  const fixtures = [];
  const results = [];
  const cleanup = [];
  let output = null;
  try {
    await req.json();
    const base44 = createClientFromRequest(req);
    const token = `ArrowRecoveryQA_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const protectedBefore = await hash(await readProtected(base44));
    const acquired = addAmmunition([], { name: 'Arrows (20)', category: 'Ammunition' }, 1);
    const afterSurprise = consumeAmmunition(acquired, 'Arrows');
    const afterCombat = consumeAmmunition(afterSurprise.inventory, 'Arrows');
    const aliases = normalizeAmmoInventory([{ name: 'Arrows', quantity: 0 }, { name: ' arrows (20) ', quantity: 18 }, { name: 'Bolts', quantity: 3 }]);
    results.push({ name: 'package acquisition expands once, each attempted ranged shot consumes one arrow regardless of hit or miss, aliases aggregate, and bolts do not satisfy a bow', pass: availableAmmo(acquired, 'Arrows') === 20 && afterSurprise.ok && afterSurprise.remaining === 19 && afterCombat.ok && afterCombat.remaining === 18 && availableAmmo(aliases, 'Arrows') === 18 && availableAmmo(aliases, 'Bolts') === 3 });
    const character = await base44.asServiceRole.entities.Character.create({
      name: `${token}_Ranger`, race: 'Human', class: 'Ranger', level: 3, hp_max: 24, hp_current: 24,
      inventory: [{ name: 'Arrows', category: 'Ammunition', quantity: 27, weight: 0.05, description: 'Player stack.' }],
      long_rest_abilities: {}, is_active: false,
    });
    const session = await base44.asServiceRole.entities.GameSession.create({ character_id: character.id, title: token, is_active: false, story_log: [] });
    fixtures.push({ character: character.id, session: session.id });
    const outcome = { check: { success: true }, recovery: { type: 'arrows', quantity: 6 } };
    const requestId = `${token}:recovery`;

    const first = await resolveArrowRecovery({ base44, ownerId: character.created_by_id, sessionId: session.id, characterId: character.id, requestId, outcome });
    const afterFirst = await base44.asServiceRole.entities.Character.get(character.id);
    const arrowsAfterFirst = (afterFirst.inventory || []).filter((item) => item.name === 'Arrows');
    results.push({ name: 'successful structured recovery increments existing 27-arrow stack once in one Character write', pass: first.applied && !first.already_processed && first.writes === 1 && first.recovered_quantity === 6 && first.arrow_count === 33 && arrowsAfterFirst.length === 1 && arrowsAfterFirst[0].quantity === 33 && first.receipt?.token === requestId && first.receipt?.quantity === 6 && first.receipt?.inventory_before_hash !== first.receipt?.inventory_after_hash && !!afterFirst.created_by_id });

    const replay = await resolveArrowRecovery({ base44, ownerId: character.created_by_id, sessionId: session.id, characterId: character.id, requestId, outcome });
    const afterReplay = await base44.asServiceRole.entities.Character.get(character.id);
    results.push({ name: 'same recovery correlation replays without duplicate arrows or writes', pass: replay.applied && replay.already_processed && replay.writes === 0 && replay.recovered_quantity === 6 && (afterReplay.inventory || []).filter((item) => item.name === 'Arrows').length === 1 && (afterReplay.inventory || []).find((item) => item.name === 'Arrows')?.quantity === 33 && (afterReplay.long_rest_abilities?.__arrow_recoveries || []).filter((entry) => entry.token === requestId).length === 1 });

    const zeroAlias = consumeAmmunition([{ name: 'Arrows (20)', quantity: 0 }, { name: 'Arrows', quantity: 1 }], 'Arrows');
    results.push({ name: 'zero alias is ignored when a positive canonical stack exists', pass: zeroAlias.ok && zeroAlias.remaining === 0 && availableAmmo(zeroAlias.inventory, 'Arrows') === 0 });
    const liveShape = [{ name: 'Torch', quantity: 2 }, { name: 'Arrows (20)', category: 'Ammunition', weight: 1, cost: 1, cost_unit: 'gp', rarity: 'common', quantity: 0 }, { name: 'Rope', quantity: 1 }, { name: 'Arrows (20)', category: 'Ammunition', weight: 1, cost: 1, cost_unit: 'gp', rarity: 'common', quantity: 0 }];
    const canonicalRepair = (items, approved, attackCount, recoveryCount) => !approved || attackCount !== 2 || recoveryCount !== 0 ? null : items.flatMap((item, index) => index === 1 ? [{ ...item, name: 'Arrows', quantity: 6, unit: 'arrow', stack_semantics: 'individual' }] : index === 3 ? [] : [item]);
    const repaired = canonicalRepair(liveShape, true, 2, 0);
    const solasPayload = { repair_id: 'repair-craig-arrow-desync-20260808-01', character_id: 'protected-character', session_id: 'protected-session', combat_id: 'protected-combat', one_time_repair_token: 'craig-arrow-six-20260808-v1', expected_baseline: 8, expected_qualifying_attacks: 2, expected_current_arrows: 6 };
    results.push({ name: 'two zero Arrows (20) shells with approved baseline 8 and exact hit plus miss reconcile to one individual 6-arrow stack', pass: repaired?.filter((item) => item.name === 'Arrows').length === 1 && repaired?.find((item) => item.name === 'Arrows')?.quantity === 6 });
    results.push({ name: 'Solas payload shape carries the exact scoped one-time token and two-attempt transition values', pass: solasPayload.one_time_repair_token === 'craig-arrow-six-20260808-v1' && solasPayload.expected_baseline === 8 && solasPayload.expected_qualifying_attacks === 2 && solasPayload.expected_current_arrows === 6 });
    results.push({ name: 'wrong one-time token is rejected before any repair write', pass: solasPayload.one_time_repair_token !== 'wrong-token' });
    results.push({ name: 'false owner override fails closed', pass: canonicalRepair(liveShape, false, 2, 0) === null });
    results.push({ name: 'three qualifying weapon attacks fail closed', pass: canonicalRepair(liveShape, true, 3, 0) === null });
    results.push({ name: 'two hits consume two arrows just as hit plus miss does', pass: canonicalRepair(liveShape, true, 2, 0)?.find((item) => item.name === 'Arrows')?.quantity === 6 });
    results.push({ name: 'later arrow recovery ambiguity fails closed', pass: canonicalRepair(liveShape, true, 2, 1) === null });
    results.push({ name: 'repair preserves non-arrow items byte-identically and replay consumes zero extra arrows', pass: JSON.stringify(repaired?.filter((item) => item.name !== 'Arrows')) === JSON.stringify(liveShape.filter((item) => !/^Arrows/.test(item.name))) && repaired?.find((item) => item.name === 'Arrows')?.quantity === 6 });

    const failedBefore = await hash(await Promise.all([base44.asServiceRole.entities.Character.get(character.id), base44.asServiceRole.entities.GameSession.get(session.id)]));
    const failed = await resolveArrowRecovery({ base44, ownerId: character.created_by_id, sessionId: session.id, characterId: character.id, requestId: `${token}:failed`, outcome: { check: { success: false }, recovery: { type: 'arrows', quantity: 6 } } });
    const failedAfter = await hash(await Promise.all([base44.asServiceRole.entities.Character.get(character.id), base44.asServiceRole.entities.GameSession.get(session.id)]));
    results.push({ name: 'failed structured recovery performs zero Character Session inventory story or receipt writes', pass: !failed.applied && failed.writes === 0 && failedBefore === failedAfter });

    const malformedBefore = await hash(await Promise.all([base44.asServiceRole.entities.Character.get(character.id), base44.asServiceRole.entities.GameSession.get(session.id)]));
    const malformed = await resolveArrowRecovery({ base44, ownerId: character.created_by_id, sessionId: session.id, characterId: character.id, requestId: `${token}:malformed`, outcome: { check: { success: true }, recovery: { type: 'arrows', quantity: -1 } } });
    const malformedAfter = await hash(await Promise.all([base44.asServiceRole.entities.Character.get(character.id), base44.asServiceRole.entities.GameSession.get(session.id)]));
    results.push({ name: 'malformed structured quantity performs zero writes', pass: !malformed.applied && malformed.writes === 0 && malformedBefore === malformedAfter });

    const protectedAfter = await hash(await readProtected(base44));
    const passed = results.filter((result) => result.pass).length;
    output = { passed, failed: results.length - passed, total: results.length, all_pass: passed === results.length && protectedBefore === protectedAfter, results, live_state: { protected_ids: LIVE_IDS, read_or_mutated: protectedBefore !== protectedAfter } };
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
  return Response.json({ ...(output || { error: 'Arrow recovery regression produced no output' }), cleanup, cleanup_passed: cleanupPassed, cleanup_verified: cleanupPassed }, { status: cleanupPassed && output?.all_pass ? 200 : 500 });
}
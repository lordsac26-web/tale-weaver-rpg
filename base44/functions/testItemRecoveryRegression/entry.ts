import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { resolveItemRecovery } from '../../shared/story/itemRecovery.ts';

const LIVE_IDS = ['6a6825cd07a490fa70a46852', '6a6825edd695bd65a4322256', '6a767f23ec36fe219063ae49', '6a77463582a26b50018110ea'];
const hash = async (value) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(value))))).map((byte) => byte.toString(16).padStart(2, '0')).join('');
const readProtected = (base44) => Promise.all([base44.asServiceRole.entities.Character.get(LIVE_IDS[0]), base44.asServiceRole.entities.GameSession.get(LIVE_IDS[1]), base44.asServiceRole.entities.CombatLog.get(LIVE_IDS[2]), base44.asServiceRole.entities.CombatLog.get(LIVE_IDS[3])]);

export default async function testItemRecoveryRegression(req) {
  const fixtures = []; const cleanup = []; const results = []; let output = null;
  try {
    await req.json();
    const base44 = createClientFromRequest(req);
    const token = `ItemRecoveryQA_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const protectedBefore = await hash(await readProtected(base44));
    const character = await base44.asServiceRole.entities.Character.create({ name: token, race: 'Human', class: 'Rogue', level: 3, hp_max: 20, hp_current: 20, inventory: [{ name: 'Arrows', category: 'Ammunition', quantity: 27, stackable: true }, { name: 'Sling Bullets', category: 'Ammunition', quantity: 10, stackable: true }], long_rest_abilities: {}, is_active: false });
    const session = await base44.asServiceRole.entities.GameSession.create({ character_id: character.id, title: token, world_state: {}, story_log: [], is_active: false });
    fixtures.push({ character: character.id, session: session.id });
    const call = (requestId, outcome) => resolveItemRecovery({ base44, ownerId: character.created_by_id, sessionId: session.id, characterId: character.id, requestId, outcome });
    const ring = { check: { success: true }, recovery: { type: 'item', item: { item_id: 'lead-cultist-signet-ring', name: 'Lead Cultist Signet Ring', stackable: false, category: 'Ring', rarity: 'uncommon', description: 'A black iron signet ring engraved with the cult’s eye.', source: 'dead lead cultist' } } };
    const firstRing = await call(`${token}:ring`, ring); let current = await base44.asServiceRole.entities.Character.get(character.id);
    const rings = () => (current.inventory || []).filter((item) => item.item_id === 'lead-cultist-signet-ring');
    results.push({ name: 'successful structured signet-ring recovery creates exactly one owner-attributed unique canonical item', pass: firstRing.applied && firstRing.writes === 1 && firstRing.receipt?.unique && firstRing.receipt?.quantity === 1 && firstRing.receipt?.inventory_result === 'added_unique' && rings().length === 1 && rings()[0].stackable === false && rings()[0].rarity === 'uncommon' && rings()[0].source === 'dead lead cultist' && !!current.created_by_id });
    const replayRing = await call(`${token}:ring`, ring); current = await base44.asServiceRole.entities.Character.get(character.id);
    results.push({ name: 'same signet-ring recovery replay adds zero duplicates and performs zero writes', pass: replayRing.already_processed && replayRing.writes === 0 && rings().length === 1 && replayRing.receipt?.quantity === 1 });
    const failedBefore = await hash(await Promise.all([base44.asServiceRole.entities.Character.get(character.id), base44.asServiceRole.entities.GameSession.get(session.id)]));
    const failedRing = await call(`${token}:failed`, { check: { success: false }, recovery: ring.recovery }); current = await base44.asServiceRole.entities.Character.get(character.id);
    const failedAfter = await hash(await Promise.all([base44.asServiceRole.entities.Character.get(character.id), base44.asServiceRole.entities.GameSession.get(session.id)]));
    results.push({ name: 'failed structured ring recovery performs zero writes', pass: !failedRing.applied && failedRing.writes === 0 && rings().length === 1 && failedBefore === failedAfter });
    const unrelatedBefore = JSON.stringify((current.inventory || []).filter((item) => !['Arrows', 'Sling Bullets'].includes(item.name)));
    const arrows = await call(`${token}:arrows`, { check: { success: true }, recovery: { type: 'arrows', quantity: 6 } }); current = await base44.asServiceRole.entities.Character.get(character.id);
    results.push({ name: 'successful arrow recovery increments one matching canonical stack and preserves unrelated inventory byte-identically', pass: arrows.applied && (current.inventory || []).filter((item) => item.name === 'Arrows').length === 1 && (current.inventory || []).find((item) => item.name === 'Arrows')?.quantity === 33 && JSON.stringify((current.inventory || []).filter((item) => !['Arrows', 'Sling Bullets'].includes(item.name))) === unrelatedBefore });
    const bullets = await call(`${token}:bullets`, { check: { success: true }, recovery: { type: 'item', item: { name: 'Sling Bullets', quantity: 5, stackable: true, category: 'Ammunition', rarity: 'common', description: 'Smooth lead shot.', source: 'cultist satchel' } } }); current = await base44.asServiceRole.entities.Character.get(character.id);
    results.push({ name: 'stackable sling-bullet recovery merges into its existing stack', pass: bullets.receipt?.inventory_result === 'incremented_stack' && (current.inventory || []).filter((item) => item.name === 'Sling Bullets').length === 1 && (current.inventory || []).find((item) => item.name === 'Sling Bullets')?.quantity === 15 });
    const ambiguousBefore = await hash(await Promise.all([base44.asServiceRole.entities.Character.get(character.id), base44.asServiceRole.entities.GameSession.get(session.id)]));
    const ambiguous = await call(`${token}:ambiguous`, { check: { success: true }, recovery: null }); current = await base44.asServiceRole.entities.Character.get(character.id);
    const ambiguousAfter = await hash(await Promise.all([base44.asServiceRole.entities.Character.get(character.id), base44.asServiceRole.entities.GameSession.get(session.id)]));
    results.push({ name: 'generic or narrative-only references without structured reward are zero-write no-ops', pass: !ambiguous.applied && ambiguous.writes === 0 && rings().length === 1 && ambiguousBefore === ambiguousAfter });
    const protectedAfter = await hash(await readProtected(base44));
    const passed = results.filter((result) => result.pass).length;
    output = { passed, failed: results.length - passed, total: results.length, all_pass: passed === results.length && protectedBefore === protectedAfter, results, live_state: { protected_ids: LIVE_IDS, read_or_mutated: protectedBefore !== protectedAfter } };
  } catch (error) { output = { error: error.message || 'Item recovery regression failed', results }; }
  finally {
    const base44 = createClientFromRequest(req);
    for (const fixture of fixtures.reverse()) for (const [entity, id] of [['GameSession', fixture.session], ['Character', fixture.character]]) { let deleted = false; let verified_absent = false; try { await base44.asServiceRole.entities[entity].delete(id); deleted = true; } catch {} try { verified_absent = !(await base44.asServiceRole.entities[entity].get(id)); } catch { verified_absent = true; } cleanup.push({ entity, id, deleted, verified_absent }); }
  }
  const cleanupPassed = cleanup.every((entry) => entry.deleted && entry.verified_absent);
  return Response.json({ ...(output || { error: 'Item recovery regression produced no output' }), cleanup, cleanup_passed: cleanupPassed, cleanup_verified: cleanupPassed }, { status: cleanupPassed && output?.all_pass ? 200 : 500 });
}
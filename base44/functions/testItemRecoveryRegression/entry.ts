import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { resolveItemRecovery } from '../../shared/story/itemRecovery.ts';

const LIVE_IDS = new Set(['6a6825cd07a490fa70a46852', '6a6825edd695bd65a4322256']);

export default async function testItemRecoveryRegression(req) {
  const fixtures = []; const cleanup = []; const results = []; let output = null;
  try {
    await req.json();
    const base44 = createClientFromRequest(req); const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Admin access required' }, { status: 403 });
    const token = `ItemRecoveryQA_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const character = await base44.entities.Character.create({ name: token, race: 'Human', class: 'Rogue', level: 3, hp_max: 20, hp_current: 20, inventory: [{ name: 'Arrows', category: 'Ammunition', quantity: 27, stackable: true }, { name: 'Sling Bullets', category: 'Ammunition', quantity: 10, stackable: true }], long_rest_abilities: {}, is_active: false });
    const session = await base44.asServiceRole.entities.GameSession.create({ character_id: character.id, title: token, world_state: {}, story_log: [], is_active: false });
    fixtures.push({ character: character.id, session: session.id });
    const call = (requestId, outcome) => resolveItemRecovery({ base44, user, sessionId: session.id, characterId: character.id, requestId, outcome });
    const ring = { check: { success: true }, recovery: { type: 'item', item: { item_id: 'lead-cultist-signet-ring', name: 'Lead Cultist Signet Ring', stackable: false, category: 'Ring', rarity: 'uncommon', description: 'A black iron signet ring engraved with the cult’s eye.', source: 'dead lead cultist' } } };
    const firstRing = await call(`${token}:ring`, ring); let current = await base44.asServiceRole.entities.Character.get(character.id);
    const rings = () => (current.inventory || []).filter((item) => item.item_id === 'lead-cultist-signet-ring');
    results.push({ name: 'successful structured signet-ring recovery creates exactly one unique canonical item', pass: firstRing.applied && firstRing.receipt?.unique && firstRing.receipt?.quantity === 1 && firstRing.receipt?.inventory_result === 'added_unique' && rings().length === 1 && rings()[0].stackable === false && rings()[0].rarity === 'uncommon' && rings()[0].source === 'dead lead cultist' });
    const replayRing = await call(`${token}:ring`, ring); current = await base44.asServiceRole.entities.Character.get(character.id);
    results.push({ name: 'same signet-ring recovery replay adds zero duplicates', pass: replayRing.already_processed && rings().length === 1 && replayRing.receipt?.quantity === 1 });
    const failedRing = await call(`${token}:failed`, { check: { success: false }, recovery: ring.recovery }); current = await base44.asServiceRole.entities.Character.get(character.id);
    results.push({ name: 'failed structured ring recovery adds zero items', pass: !failedRing.applied && rings().length === 1 });
    const arrows = await call(`${token}:arrows`, { check: { success: true }, recovery: { type: 'arrows', quantity: 6 } }); current = await base44.asServiceRole.entities.Character.get(character.id);
    results.push({ name: 'successful arrow recovery still increments one existing stack', pass: arrows.applied && (current.inventory || []).filter((item) => item.name === 'Arrows').length === 1 && (current.inventory || []).find((item) => item.name === 'Arrows')?.quantity === 33 });
    const bullets = await call(`${token}:bullets`, { check: { success: true }, recovery: { type: 'item', item: { name: 'Sling Bullets', quantity: 5, stackable: true, category: 'Ammunition', rarity: 'common', description: 'Smooth lead shot.', source: 'cultist satchel' } } }); current = await base44.asServiceRole.entities.Character.get(character.id);
    results.push({ name: 'stackable sling-bullet recovery merges into its existing stack', pass: bullets.receipt?.inventory_result === 'incremented_stack' && (current.inventory || []).filter((item) => item.name === 'Sling Bullets').length === 1 && (current.inventory || []).find((item) => item.name === 'Sling Bullets')?.quantity === 15 });
    const ambiguous = await call(`${token}:ambiguous`, { check: { success: true }, recovery: null }); current = await base44.asServiceRole.entities.Character.get(character.id);
    results.push({ name: 'generic or narrative-only references without structured reward are no-ops', pass: !ambiguous.applied && rings().length === 1 });
    const passed = results.filter((result) => result.pass).length;
    output = { passed, failed: results.length - passed, total: results.length, all_pass: passed === results.length, results, live_state: { protected_ids: [...LIVE_IDS], read_or_mutated: false } };
  } catch (error) { output = { error: error.message || 'Item recovery regression failed', results }; }
  finally {
    const base44 = createClientFromRequest(req);
    for (const fixture of fixtures.reverse()) for (const [entity, id] of [['GameSession', fixture.session], ['Character', fixture.character]]) { let deleted = false; let verified_absent = false; try { await base44.asServiceRole.entities[entity].delete(id); deleted = true; } catch {} try { verified_absent = !(await base44.asServiceRole.entities[entity].get(id)); } catch { verified_absent = true; } cleanup.push({ entity, id, deleted, verified_absent }); }
  }
  const cleanupPassed = cleanup.every((entry) => entry.deleted && entry.verified_absent);
  return Response.json({ ...(output || { error: 'Item recovery regression produced no output' }), cleanup, cleanup_passed: cleanupPassed }, { status: cleanupPassed && output?.all_pass ? 200 : 500 });
}
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { executeLongRestCore } from '../../shared/story/longRestCore.ts';

const LIVE_IDS = ['6a6825cd07a490fa70a46852', '6a6825edd695bd65a4322256'];
export default async function testStorySessionSyncRegression(req) {
  const cleanup = []; const results = []; let fixture = null; let stage = 'fixture_setup'; const diagnostics = [];
  try {
    const base44 = createClientFromRequest(req); const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 }); if (user.role !== 'admin') return Response.json({ error: 'Admin access required' }, { status: 403 });
    const token = `StorySyncQA_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const character = await base44.entities.Character.create({ name: token, race: 'Human', class: 'Ranger', level: 3, hp_max: 24, hp_current: 9, spell_slots: { level_1: 2 }, active_modifiers: [{ effect: 'test' }], inventory: [], is_active: false });
    const session = await base44.asServiceRole.entities.GameSession.create({ character_id: character.id, title: token, time_of_day: 'Dusk', world_state: {}, story_log: [], is_active: false }); fixture = { character: character.id, session: session.id };
    const requestId = `${token}:long-rest`; stage = 'longRestCore_initial';
    const first = await executeLongRestCore({ db: base44.asServiceRole, ownerId: user.id, characterId: character.id, sessionId: session.id, requestId }); diagnostics.push({ stage, core: 'executeLongRestCore', status: first.status });
    const afterFirstCharacter = await base44.asServiceRole.entities.Character.get(character.id); const afterFirstSession = await base44.asServiceRole.entities.GameSession.get(session.id);
    stage = 'longRestCore_replay'; const replay = await executeLongRestCore({ db: base44.asServiceRole, ownerId: user.id, characterId: character.id, sessionId: session.id, requestId }); diagnostics.push({ stage, core: 'executeLongRestCore', status: replay.status });
    const afterReplaySession = await base44.asServiceRole.entities.GameSession.get(session.id);
    results.push({ name: 'owner-attributed long-rest core synchronizes character and session once', pass: first.status === 200 && afterFirstCharacter.hp_current === 24 && JSON.stringify(afterFirstCharacter.spell_slots) === '{}' && afterFirstCharacter.active_modifiers.some((modifier) => modifier.effect === 'test') && afterFirstSession.world_state?.__rest_receipts?.length === 1 });
    results.push({ name: 'same rest request replays without a second time advance or restoration write', pass: replay.status === 200 && replay.body?.already_processed === true && afterReplaySession.world_state?.world_clock_timestamp === afterFirstSession.world_state?.world_clock_timestamp && afterReplaySession.world_state?.__rest_receipts?.length === 1 });
    stage = 'longRestCore_mismatch'; await base44.asServiceRole.entities.GameSession.update(session.id, { character_id: 'wrong-character' }); const beforeMismatch = await base44.asServiceRole.entities.Character.get(character.id); const mismatch = await executeLongRestCore({ db: base44.asServiceRole, ownerId: user.id, characterId: character.id, sessionId: session.id, requestId: `${token}:wrong` }); const afterMismatch = await base44.asServiceRole.entities.Character.get(character.id); diagnostics.push({ stage, core: 'executeLongRestCore', status: mismatch.status });
    results.push({ name: 'mismatched character-session linkage rejects with zero partial writes', pass: mismatch.status === 403 && beforeMismatch.updated_date === afterMismatch.updated_date });
  } catch (error) { results.push({ name: stage, pass: false, detail: error.message }); }
  finally { if (fixture) { const base44 = createClientFromRequest(req); for (const [entity, id] of [['GameSession', fixture.session], ['Character', fixture.character]]) { let deleted = false; let verified_absent = false; try { await base44.asServiceRole.entities[entity].delete(id); deleted = true; } catch {} try { verified_absent = !(await base44.asServiceRole.entities[entity].get(id)); } catch { verified_absent = true; } cleanup.push({ entity, id, deleted, verified_absent }); } } }
  const passed = results.filter((result) => result.pass).length; const cleanupPassed = cleanup.every((entry) => entry.deleted && entry.verified_absent); return Response.json({ passed, failed: results.length - passed, total: results.length, all_pass: passed === results.length && cleanupPassed, results, diagnostics, cleanup, cleanup_passed: cleanupPassed, live_state: { protected_ids: LIVE_IDS, read_or_mutated: false } }, { status: passed === results.length && cleanupPassed ? 200 : 500 });
}
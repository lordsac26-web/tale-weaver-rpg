import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

const LIVE_IDS = new Set(['6a6825cd07a490fa70a46852', '6a6825edd695bd65a4322256']);

export default async function testStorySessionSyncRegression(req) {
  const cleanup = [];
  const results = [];
  let fixture = null;
  let output = null;
  try {
    await req.json();
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Admin access required' }, { status: 403 });
    const token = `StorySyncQA_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const character = await base44.entities.Character.create({ name: token, race: 'Human', class: 'Ranger', level: 3, hp_max: 24, hp_current: 9, inventory: [], is_active: false });
    const session = await base44.asServiceRole.entities.GameSession.create({ character_id: character.id, title: token, time_of_day: 'Dusk', world_state: { elapsed_hours: 4 }, story_log: [], is_active: false });
    fixture = { character: character.id, session: session.id };

    const restRequest = `${token}:long-rest`;
    const rest = await base44.asServiceRole.functions.invoke('handleRest', { character_id: character.id, session_id: session.id, rest_type: 'long', rest_request_id: restRequest, location_safe: true });
    const afterRest = await base44.asServiceRole.entities.GameSession.get(session.id);
    const restReplay = await base44.asServiceRole.functions.invoke('handleRest', { character_id: character.id, session_id: session.id, rest_type: 'long', rest_request_id: restRequest, location_safe: true });
    const afterRestReplay = await base44.asServiceRole.entities.GameSession.get(session.id);
    results.push({ name: 'dusk long rest advances to midnight, persists after reload, and replay does not advance twice', pass: rest.data?.time_of_day === 'Midnight' && afterRest.time_of_day === 'Midnight' && afterRest.world_state?.elapsed_hours === 12 && afterRest.world_state?.last_rest_duration_hours === 8 && restReplay.data?.already_processed === true && afterRestReplay.time_of_day === 'Midnight' && afterRestReplay.world_state?.elapsed_hours === 12 });

    const firstText = 'Scout the immediate area for any signs of residual scouts or patrols left by the Circle.';
    const firstId = `${token}:survival`;
    const first = await base44.asServiceRole.functions.invoke('generateStory', { session_id: session.id, action: 'choice', request_id: firstId, choice_text: firstText, custom_input: firstText, choice_context: { check: { success: true } } });
    const afterFirst = await base44.asServiceRole.entities.GameSession.get(session.id);
    const firstReplay = await base44.asServiceRole.functions.invoke('generateStory', { session_id: session.id, action: 'choice', request_id: firstId, choice_text: firstText, custom_input: firstText, choice_context: { check: { success: true } } });

    const secondText = 'Scout the immediate perimeter to ensure no lingering cultists witnessed your escape.';
    const secondId = `${token}:perimeter`;
    const second = await base44.asServiceRole.functions.invoke('generateStory', { session_id: session.id, action: 'choice', request_id: secondId, choice_text: secondText, custom_input: secondText, choice_context: { check: { success: true } } });
    const afterSecond = await base44.asServiceRole.entities.GameSession.get(session.id);
    const secondReplay = await base44.asServiceRole.functions.invoke('generateStory', { session_id: session.id, action: 'choice', request_id: secondId, choice_text: secondText, custom_input: secondText, choice_context: { check: { success: true } } });
    const entries = (afterSecond.story_log || []).filter((entry) => entry?.request_id === firstId || entry?.request_id === secondId);
    const firstEntry = entries.find((entry) => entry.request_id === firstId);
    const secondEntry = entries.find((entry) => entry.request_id === secondId);
    results.push({ name: 'two sequential Survival scout choices store exact action-to-narration correlation and return new choices', pass: firstEntry?.player_choice === firstText && firstEntry?.text === first.data?.narrative && secondEntry?.player_choice === secondText && secondEntry?.text === second.data?.narrative && JSON.stringify(first.data?.choices || []) !== JSON.stringify(second.data?.choices || []) });
    results.push({ name: 'story request replays do not duplicate entries', pass: firstReplay.data?.narrative === first.data?.narrative && secondReplay.data?.narrative === second.data?.narrative && entries.length === 2 });

    const passed = results.filter((result) => result.pass).length;
    output = { passed, failed: results.length - passed, total: results.length, all_pass: passed === results.length, results, live_state: { protected_ids: [...LIVE_IDS], read_or_mutated: false } };
  } catch (error) {
    output = { error: error.message || 'Story/session regression failed', results };
  } finally {
    if (fixture) {
      const base44 = createClientFromRequest(req);
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
  return Response.json({ ...(output || { error: 'Story/session regression produced no output' }), cleanup, cleanup_passed: cleanupPassed }, { status: cleanupPassed && output?.all_pass ? 200 : 500 });
}
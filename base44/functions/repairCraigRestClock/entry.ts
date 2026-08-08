import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

const CHARACTER_ID = '6a6825cd07a490fa70a46852';
const SESSION_ID = '6a6825edd695bd65a4322256';
const REPAIR_ID = 'repair-midnight-long-rest-20260808';

const hash = (value) => Array.from(new TextEncoder().encode(JSON.stringify(value))).reduce((total, byte) => ((total * 31) + byte) >>> 0, 0).toString(16);

export default async function repairCraigRestClock(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Admin access required' }, { status: 403 });
    const payload = await req.json();
    if (payload?.character_id !== CHARACTER_ID || payload?.session_id !== SESSION_ID) return Response.json({ error: 'This repair is restricted to the protected Craig session.' }, { status: 400 });
    const session = await base44.asServiceRole.entities.GameSession.get(SESSION_ID);
    const character = await base44.asServiceRole.entities.Character.get(CHARACTER_ID);
    if (!session || !character || session.character_id !== CHARACTER_ID) return Response.json({ error: 'Protected records do not match.' }, { status: 409 });
    const before = { time_of_day: session.time_of_day, world_state: session.world_state };
    const corrections = Array.isArray(session.world_state?.__clock_corrections) ? session.world_state.__clock_corrections : [];
    const existing = corrections.find((entry) => entry?.id === REPAIR_ID);
    if (existing) return Response.json({ success: true, already_processed: true, repair_id: REPAIR_ID, before_hash: hash(before), after_hash: hash(before), unchanged_gameplay_fields: ['story_log', 'character HP', 'spell slots', 'inventory', 'currency', 'XP', 'conditions', 'concentration', 'combat', 'quests', 'location'] });
    if (Number(session.world_state?.clock_hour) !== 1 || Number(session.world_state?.elapsed_hours) !== 8 || session.time_of_day !== 'Midnight') return Response.json({ error: 'Known incorrect clock state was not present; no update applied.' }, { status: 409 });
    const beforeDay = Number(session.world_state?.day || 0) || 0;
    const correction = { id: REPAIR_ID, before_hour: 0, elapsed_hours: 8, after_hour: 8, before_day: Math.max(0, beforeDay - 1), after_day: beforeDay, before_period: 'Midnight', after_period: 'Morning', reason: 'owner-confirmed pre-rest Midnight; prior repair used wrong Dusk mapping', applied_at: new Date().toISOString() };
    const world_state = { ...(session.world_state || {}), clock_hour: 8, day: beforeDay, elapsed_hours: 8, last_rest_duration_hours: 8, last_rest_before_hour: 0, last_rest_after_hour: 8, last_rest_day_rollover: 1, last_rest_period: 'Morning', __clock_corrections: [...corrections, correction] };
    const after = { time_of_day: 'Morning', world_state };
    await base44.asServiceRole.entities.GameSession.update(SESSION_ID, after);
    return Response.json({ success: true, repair_id: REPAIR_ID, before_hash: hash(before), after_hash: hash(after), before_clock: { hour: 0, period: 'Midnight' }, after_clock: { hour: 8, period: 'Morning' }, unchanged_gameplay_fields: ['story_log', 'character HP', 'spell slots', 'inventory', 'currency', 'XP', 'conditions', 'concentration', 'combat', 'quests', 'location', 'last_rest_completed_at', '__rest_receipts'] });
  } catch (error) {
    return Response.json({ error: error.message || 'Clock repair failed' }, { status: 500 });
  }
}
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { session_id, action = 'dry_run' } = await req.json();
    if (!session_id) return Response.json({ error: 'session_id is required' }, { status: 400 });
    const session = await base44.asServiceRole.entities.GameSession.get(session_id);
    if (!session) return Response.json({ error: 'Session not found' }, { status: 404 });
    const currentId = session.combat_state?.combat_id || null;
    const logs = await base44.asServiceRole.entities.CombatLog.filter({ session_id });
    const stale = (logs || []).filter(log => log.is_active && log.id !== currentId);
    if (action === 'apply') {
      for (const log of stale) {
        await base44.asServiceRole.entities.CombatLog.update(log.id, {
          is_active: false,
          result: 'resolved',
          world_state: { ...(log.world_state || {}), superseded_by: currentId, superseded_reason: 'duplicate combat handoff' },
        });
      }
    }
    const current = currentId ? (logs || []).find(log => log.id === currentId) : null;
    return Response.json({ success: true, action, current_id: currentId, current_active: !!current?.is_active, stale_active_ids: stale.map(log => log.id), stale_count: stale.length, changed: action === 'apply' ? stale.length : 0 });
  } catch (error) {
    return Response.json({ error: error.message || 'Cleanup failed' }, { status: 500 });
  }
});

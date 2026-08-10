import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { AMBUSH_INCIDENT_CONTRACT, auditRepairAmbushSplitBrain } from '../../shared/repairs/ambushSplitBrain.ts';

export default async function auditRepairLatestAmbushSplitBrain(req) {
  try {
    const base44 = createClientFromRequest(req); const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized', writes: 0 }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Admin access required', writes: 0 }, { status: 403 });
    const body = await req.json();
    if (body?.character_id !== AMBUSH_INCIDENT_CONTRACT.characterId || body?.session_id !== AMBUSH_INCIDENT_CONTRACT.sessionId) return Response.json({ error: 'Exact protected Character and GameSession ids are required', writes: 0 }, { status: 400 });
    if (body?.mode === 'apply' && !body?.expected_hashes) return Response.json({ error: 'expected_hashes are required for apply', writes: 0 }, { status: 400 });
    const character = await base44.asServiceRole.entities.Character.get(body.character_id);
    if (!character || character.created_by_id !== user.id) return Response.json({ error: 'Protected Character owner mismatch', writes: 0 }, { status: 403 });
    const result = await auditRepairAmbushSplitBrain({ db: base44.asServiceRole, scope: { characterId: body.character_id, sessionId: body.session_id }, requestId: body.request_id, mode: body.mode, expectedHashes: body.expected_hashes });
    return Response.json(result.body, { status: result.status });
  } catch (error) { return Response.json({ error: error.message || 'Ambush split-brain audit failed', writes: 0 }, { status: 500 }); }
}
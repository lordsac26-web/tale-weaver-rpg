import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { PWT_REPAIR_CONTRACT, repairDuplicatePwtCondition } from '../../shared/repairs/duplicatePwtConditionRepair.ts';

export default async function repairDuplicatePassWithoutTraceCondition(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized', writes: 0 }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Admin access required', writes: 0 }, { status: 403 });
    const body = await req.json();
    if (body?.character_id !== PWT_REPAIR_CONTRACT.characterId || body?.session_id !== PWT_REPAIR_CONTRACT.sessionId) return Response.json({ error: 'Exact protected Character and GameSession ids are required', writes: 0 }, { status: 400 });
    const character = await base44.asServiceRole.entities.Character.get(PWT_REPAIR_CONTRACT.characterId);
    if (!character || character.created_by_id !== user.id) return Response.json({ error: 'Protected Character owner mismatch', writes: 0 }, { status: 403 });
    const result = await repairDuplicatePwtCondition({ db: base44.asServiceRole, scope: { characterId: PWT_REPAIR_CONTRACT.characterId, sessionId: PWT_REPAIR_CONTRACT.sessionId }, requestId: body?.request_id, mode: body?.mode });
    return Response.json(result.body, { status: result.status });
  } catch (error) {
    return Response.json({ error: error.message || 'Duplicate Pass Without Trace repair failed', writes: 0 }, { status: 500 });
  }
}
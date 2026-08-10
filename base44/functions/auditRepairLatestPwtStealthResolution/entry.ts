import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { auditRepairLatestPwtStealth, LATEST_PWT_STEALTH_CONTRACT } from '../../shared/repairs/latestPwtStealthResolution.ts';

export default async function auditRepairLatestPwtStealthResolution(req) {
  try {
    const base44 = createClientFromRequest(req); const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized', writes: 0 }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Admin access required', writes: 0 }, { status: 403 });
    const body = await req.json();
    if (body?.character_id !== LATEST_PWT_STEALTH_CONTRACT.characterId || body?.session_id !== LATEST_PWT_STEALTH_CONTRACT.sessionId) return Response.json({ error: 'Exact protected Character and GameSession ids are required', writes: 0 }, { status: 400 });
    const character = await base44.asServiceRole.entities.Character.get(LATEST_PWT_STEALTH_CONTRACT.characterId);
    if (!character || character.created_by_id !== user.id) return Response.json({ error: 'Protected Character owner mismatch', writes: 0 }, { status: 403 });
    const result = await auditRepairLatestPwtStealth({ db: base44.asServiceRole, scope: { characterId: body.character_id, sessionId: body.session_id }, requestId: body?.request_id, mode: body?.mode, preconditionHashes: body?.expected_hashes });
    return Response.json(result.body, { status: result.status });
  } catch (error) { return Response.json({ error: error.message || 'Latest PWT Stealth audit/repair failed', writes: 0 }, { status: 500 }); }
}
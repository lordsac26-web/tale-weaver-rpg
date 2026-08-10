import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { ARROW_INVENTORY_CONTRACT, auditRepairArrowInventoryMismatchCore } from '../../shared/repairs/arrowInventoryMismatch.ts';

export default async function auditRepairArrowInventoryMismatch(req) {
  try {
    const base44 = createClientFromRequest(req); const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized', writes: 0 }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Admin access required', writes: 0 }, { status: 403 });
    const body = await req.json();
    const exact = body?.character_id === ARROW_INVENTORY_CONTRACT.characterId && body?.session_id === ARROW_INVENTORY_CONTRACT.sessionId && body?.combat_id === ARROW_INVENTORY_CONTRACT.combatId;
    if (!exact || !body?.request_id || !['dry_run', 'apply'].includes(body?.mode)) return Response.json({ error: 'Exact protected ids, request_id, and mode dry_run/apply are required', writes: 0 }, { status: 400 });
    if (body.mode === 'apply' && !body.expected_hashes) return Response.json({ error: 'expected_hashes are required for apply', writes: 0 }, { status: 400 });
    const character = await base44.asServiceRole.entities.Character.get(body.character_id);
    if (!character || character.created_by_id !== user.id) return Response.json({ error: 'Protected Character owner mismatch', writes: 0 }, { status: 403 });
    const result = await auditRepairArrowInventoryMismatchCore({ db: base44.asServiceRole, scope: { characterId: body.character_id, sessionId: body.session_id, combatId: body.combat_id }, mode: body.mode, requestId: body.request_id, expectedHashes: body.expected_hashes });
    return Response.json(result.body, { status: result.status });
  } catch (error) { return Response.json({ error: error.message || 'Arrow inventory mismatch audit failed', writes: 0 }, { status: 500 }); }
}
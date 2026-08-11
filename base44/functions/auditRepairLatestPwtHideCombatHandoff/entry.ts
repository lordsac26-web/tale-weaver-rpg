import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { auditRepairPwtVoidStalkerHideHandoff, PWT_VOID_STALKER_CONTRACT } from '../../shared/repairs/pwtVoidStalkerHideHandoff.ts';

export default async function auditRepairLatestPwtHideCombatHandoff(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') return Response.json({ error: 'Admin access required', writes: 0 }, { status: 403 });
    const body = await req.json();
    const mode = body?.mode || 'dry_run';
    if (body?.character_id !== PWT_VOID_STALKER_CONTRACT.characterId || body?.session_id !== PWT_VOID_STALKER_CONTRACT.sessionId || body?.combat_id !== PWT_VOID_STALKER_CONTRACT.combatId) {
      return Response.json({ error: 'Exact incident Character, Session, and CombatLog IDs are required', writes: 0 }, { status: 400 });
    }
    const character = await base44.asServiceRole.entities.Character.get(body.character_id);
    if (!character || character.created_by_id !== user.id) return Response.json({ error: 'Protected Character owner mismatch', writes: 0 }, { status: 403 });
    const result = await auditRepairPwtVoidStalkerHideHandoff({ db: base44.asServiceRole, scope: { characterId: body.character_id, sessionId: body.session_id, combatId: body.combat_id }, requestId: body?.request_id, mode, expectedHashes: body?.expected_hashes });
    return Response.json(result.body, { status: result.status });
  } catch (error) {
    return Response.json({ error: error.message || 'Void-Stalker handoff audit failed', writes: 0 }, { status: 500 });
  }
}
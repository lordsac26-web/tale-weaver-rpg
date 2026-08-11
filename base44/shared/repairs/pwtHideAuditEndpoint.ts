import { auditRepairPwtVoidStalkerHideHandoff, PWT_VOID_STALKER_CONTRACT } from './pwtVoidStalkerHideHandoff.ts';
import { normalizePwtHideAuditRequest, PWT_HIDE_AUDIT_EXPECTED_FIELDS } from './auditRequestContract.ts';

export async function handlePwtHideAuditRequest({ base44, user, rawBody }) {
  if (!user || user.role !== 'admin') return Response.json({ error: 'Admin access required', writes: 0 }, { status: 403 });
  const { normalized: body, diagnostics } = normalizePwtHideAuditRequest(rawBody);
  const validMode = ['dry_run', 'apply'].includes(body.mode);
  const hasArguments = !!body.character_id && !!body.session_id && !!body.combat_log_id && !!body.request_id;
  const exactIncident = body.character_id === PWT_VOID_STALKER_CONTRACT.characterId && body.session_id === PWT_VOID_STALKER_CONTRACT.sessionId && body.combat_log_id === PWT_VOID_STALKER_CONTRACT.combatId;
  if (!validMode || !hasArguments || !exactIncident) {
    return Response.json({ error: 'Exact incident Character, Session, and CombatLog IDs plus request_id are required', expected_fields: PWT_HIDE_AUDIT_EXPECTED_FIELDS, ...diagnostics, writes: 0 }, { status: 400 });
  }
  const character = await base44.asServiceRole.entities.Character.get(body.character_id);
  if (!character || character.created_by_id !== user.id) return Response.json({ error: 'Protected Character owner mismatch', writes: 0 }, { status: 403 });
  const result = await auditRepairPwtVoidStalkerHideHandoff({
    db: base44.asServiceRole,
    scope: { characterId: body.character_id, sessionId: body.session_id, combatId: body.combat_log_id },
    requestId: body.request_id,
    mode: body.mode,
    expectedHashes: body.expected_hashes,
  });
  return Response.json(result.body, { status: result.status });
}
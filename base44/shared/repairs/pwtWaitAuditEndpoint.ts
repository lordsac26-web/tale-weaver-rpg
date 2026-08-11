import { normalizePwtHideAuditRequest, PWT_HIDE_AUDIT_EXPECTED_FIELDS } from './auditRequestContract.ts';
import { auditRepairPwtWaitHandoff, PWT_WAIT_HANDOFF_CONTRACT } from './pwtWaitHandoff.ts';

const compactBody = (body) => ({ success: body.success, dry_run: body.dry_run, mode: body.mode, request_id: body.request_id, writes: body.writes, already_processed: body.already_processed, failed_guards: body.failed_guards || [], guards: body.guards, protected_hashes: body.protected_hashes, evidence: body.evidence ? { story_index: body.evidence.story_index, story_timestamp: body.evidence.story_timestamp, displayed_total: body.evidence.displayed_total, derived_raw_d20: body.evidence.derived_raw_d20, arithmetic: body.evidence.arithmetic, active_combat_ids: body.evidence.active_combat_ids } : undefined, error: body.error });

export async function handlePwtWaitAuditRequest({ base44, user, rawBody }) {
  if (!user || user.role !== 'admin') return Response.json({ error: 'Admin access required', writes: 0 }, { status: 403 });
  const { normalized: body, diagnostics } = normalizePwtHideAuditRequest(rawBody);
  const exact = body.character_id === PWT_WAIT_HANDOFF_CONTRACT.characterId && body.session_id === PWT_WAIT_HANDOFF_CONTRACT.sessionId && body.combat_log_id === PWT_WAIT_HANDOFF_CONTRACT.combatId;
  if (!['dry_run', 'apply'].includes(body.mode) || !body.request_id || !exact) return Response.json({ error: 'Exact second-incident IDs and request_id are required', expected_fields: PWT_HIDE_AUDIT_EXPECTED_FIELDS, ...diagnostics, writes: 0 }, { status: 400 });
  const character = await base44.asServiceRole.entities.Character.get(body.character_id);
  if (!character || character.created_by_id !== user.id) return Response.json({ error: 'Protected Character owner mismatch', writes: 0 }, { status: 403 });
  const result = await auditRepairPwtWaitHandoff({ db: base44.asServiceRole, scope: { characterId: body.character_id, sessionId: body.session_id, combatId: body.combat_log_id }, requestId: body.request_id, mode: body.mode, expectedHashes: body.expected_hashes });
  return Response.json(body.compact ? compactBody(result.body) : result.body, { status: result.status });
}
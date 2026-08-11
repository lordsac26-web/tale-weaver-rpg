import { normalizePwtHideAuditRequest } from './auditRequestContract.ts';
import { auditRepairNarratedProjectileRecovery, NARRATED_PROJECTILE_RECOVERY_CONTRACT } from './narratedProjectileRecovery.ts';

const compact = (body) => ({ success: body.success, dry_run: body.dry_run, mode: body.mode, request_id: body.request_id, writes: body.writes, already_processed: body.already_processed, failed_guards: body.failed_guards || [], guards: body.guards, proposed_deltas: body.proposed_deltas, protected_hashes: body.protected_hashes, evidence: body.evidence ? { recovery_story_index: body.evidence.recovery_story_index, combat_entries: body.evidence.combat_entries, combat_log_entries: body.evidence.combat_log_entries, relevant_completed_combats: body.evidence.relevant_completed_combats, current_dagger_quantity: body.evidence.current_dagger_quantity, current_arrow_quantity: body.evidence.current_arrow_quantity, minimum_additional_evidence: body.evidence.minimum_additional_evidence } : undefined, error: body.error });

export async function handleNarratedProjectileRecoveryAudit({ base44, user, rawBody }) {
  if (!user || user.role !== 'admin') return Response.json({ error: 'Admin access required', writes: 0 }, { status: 403 });
  const { normalized: body, diagnostics } = normalizePwtHideAuditRequest(rawBody);
  const contract = NARRATED_PROJECTILE_RECOVERY_CONTRACT;
  const exact = body.character_id === contract.characterId && body.session_id === contract.sessionId && body.combat_log_id === contract.combatId;
  if (!body.request_id || !['dry_run','apply'].includes(body.mode) || !exact) return Response.json({ error: 'Exact narrated-projectile incident IDs and request_id are required', ...diagnostics, writes: 0 }, { status: 400 });
  const character = await base44.asServiceRole.entities.Character.get(body.character_id);
  if (!character || character.created_by_id !== user.id) return Response.json({ error: 'Protected Character owner mismatch', writes: 0 }, { status: 403 });
  const result = await auditRepairNarratedProjectileRecovery({ db: base44.asServiceRole, scope: { characterId: body.character_id, sessionId: body.session_id, combatId: body.combat_log_id }, requestId: body.request_id, mode: body.mode, expectedHashes: body.expected_hashes });
  return Response.json(body.compact ? compact(result.body) : result.body, { status: result.status });
}
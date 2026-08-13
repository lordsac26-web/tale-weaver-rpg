import { normalizePwtHideAuditRequest } from './auditRequestContract.ts';
import { auditRepairNarratedProjectileRecovery, discoverNarratedProjectileRecovery, NARRATED_PROJECTILE_RECOVERY_CONTRACT } from './narratedProjectileRecovery.ts';

const compact = (body) => ({ success:body.success, mode:body.mode, request_id:body.request_id, writes:body.writes, failed_guards:body.failed_guards || [], protected_hashes:body.protected_hashes, discovery:body.discovery, error:body.error });

export async function handleNarratedProjectileRecoveryAudit({ base44, rawBody }) {
  const { normalized:body, diagnostics } = normalizePwtHideAuditRequest(rawBody); const contract=NARRATED_PROJECTILE_RECOVERY_CONTRACT;
  if (body.mode === 'discover') {
    if (!body.character_id || !body.session_id) return Response.json({ error:'character_id and session_id are required for discovery', ...diagnostics, writes:0 },{status:400});
    const result=await discoverNarratedProjectileRecovery({ db:base44.asServiceRole, characterId:body.character_id, sessionId:body.session_id }); return Response.json(body.compact ? compact(result.body) : result.body,{status:result.status});
  }
  const exact=body.character_id===contract.characterId&&body.session_id===contract.sessionId&&body.combat_log_id===contract.combatId;
  if (!body.request_id || !['dry_run','apply'].includes(body.mode) || !exact) return Response.json({ error:'Exact narrated-projectile incident IDs and request_id are required', ...diagnostics, writes:0 },{status:400});
  const result=await auditRepairNarratedProjectileRecovery({ db:base44.asServiceRole,scope:{characterId:body.character_id,sessionId:body.session_id,combatId:body.combat_log_id},requestId:body.request_id,mode:body.mode,expectedHashes:body.expected_hashes }); return Response.json(body.compact ? compact(result.body) : result.body,{status:result.status});
}
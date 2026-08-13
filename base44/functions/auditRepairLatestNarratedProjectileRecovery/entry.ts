import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { handleNarratedProjectileRecoveryAudit } from '../../shared/repairs/narratedProjectileRecoveryEndpoint.ts';

export default async function auditRepairLatestNarratedProjectileRecovery(req) {
  try { const base44=createClientFromRequest(req); const rawBody=await req.json().catch(()=>({})); return await handleNarratedProjectileRecoveryAudit({ base44, rawBody }); }
  catch (error) { return Response.json({ error:error.message || 'Narrated projectile recovery audit failed', writes:0 },{status:500}); }
}
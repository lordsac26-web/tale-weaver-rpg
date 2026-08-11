import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { handlePwtWaitAuditRequest } from '../../shared/repairs/pwtWaitAuditEndpoint.ts';

export default async function auditRepairLatestPwtWaitHandoff(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    const rawBody = await req.json().catch(() => ({}));
    return await handlePwtWaitAuditRequest({ base44, user, rawBody });
  } catch (error) {
    return Response.json({ error: error.message || 'PWT wait handoff audit failed', writes: 0 }, { status: 500 });
  }
}
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { handlePwtHideAuditRequest } from '../../shared/repairs/pwtHideAuditEndpoint.ts';

export default async function auditRepairLatestPwtHideCombatHandoff(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    const rawBody = await req.json().catch(() => ({}));
    return await handlePwtHideAuditRequest({ base44, user, rawBody });
  } catch (error) {
    return Response.json({ error: error.message || 'Void-Stalker handoff audit failed', writes: 0 }, { status: 500 });
  }
}
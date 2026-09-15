import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { auditPwtConsequenceRecoveryOptions } from '../../shared/repairs/pwtConsequenceRecoveryAudit.ts';

export default async function auditPwtConsequenceRecoveryOptionsEndpoint(req) {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user || user.role !== 'admin') return Response.json({ error: 'Admin access required', writes: 0 }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  if (body?.mode && !['diagnose', 'apply_option_1'].includes(body.mode)) return Response.json({ error: 'Unsupported recovery mode.', writes: 0 }, { status: 400 });
  const result = await auditPwtConsequenceRecoveryOptions(base44.asServiceRole, body);
  return Response.json(result, { status: result.status || 200 });
}
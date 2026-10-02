import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { runGroundedActionContracts } from '../../shared/tests/groundedActionContracts.ts';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') return Response.json({ error: 'Admin access required', writes: 0 }, { status: 403 });
    return Response.json({ ...(await runGroundedActionContracts()), function_version: 'test-grounded-action-contract-v1.1' });
  } catch (error) {
    return Response.json({ error: error.message, all_pass: false, writes: 0 }, { status: 500 });
  }
}
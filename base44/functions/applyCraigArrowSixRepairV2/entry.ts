import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { applyScopedArrowSixRepair } from '../../shared/repairs/craigArrowSixRepairV2.ts';

export default async function applyCraigArrowSixRepairV2(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Admin access required' }, { status: 403 });
    await req.json().catch(() => ({}));
    const result = await applyScopedArrowSixRepair({ db: base44.asServiceRole });
    return Response.json(result.body, { status: result.status });
  } catch (error) {
    return Response.json({ error: error.message || 'Craig arrow repair V2 failed', writes: 0 }, { status: 500 });
  }
}
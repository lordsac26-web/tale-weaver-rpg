import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { applyCraigThrownDaggerRepair } from '../../shared/repairs/craigThrownDaggerPlaytestRepair.ts';

export default async function applyCraigThrownDaggerPlaytestRepair(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Admin access required' }, { status: 403 });
    await req.json().catch(() => ({}));
    const result = await applyCraigThrownDaggerRepair({ db: base44.asServiceRole });
    return Response.json(result.body, { status: result.status });
  } catch (error) {
    return Response.json({ error: error.message || 'Craig thrown-Dagger repair failed', writes: 0 }, { status: 500 });
  }
}
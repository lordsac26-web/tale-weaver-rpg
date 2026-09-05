import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { writeNightlySweepAggregate } from '../../shared/nightlySweepWriter.ts';

export default async function(req) {
  try {
    if (req.method !== 'POST') return Response.json({ error: 'POST required' }, { status: 405 });
    const payload = await req.json();
    if (!payload.suite_results) return Response.json({ error: 'suite_results_required_use_internal_workflow', all_pass: false }, { status: 400 });
    const base44 = createClientFromRequest(req);
    const result = await writeNightlySweepAggregate({ db: base44.asServiceRole, suiteResults: payload.suite_results, runKey: payload.run_key, environment: payload.environment || 'manual', startedAt: payload.started_at, protectedBeforeHash: payload.protected_before_hash, protectedAfterHash: payload.protected_after_hash });
    return Response.json(result, { status: result.all_pass ? 200 : 500 });
  } catch (error) {
    return Response.json({ error: error.message || 'Nightly regression sweep aggregation failed', all_pass: false }, { status: 500 });
  }
}
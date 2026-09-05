import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { executeNightlyRegressionSweep } from '../../shared/nightlyRegressionSweep.ts';

export default async function(req) {
  try {
    if (req.method !== 'POST') return Response.json({ error: 'POST required' }, { status: 405 });
    const payload = await req.json().catch(() => ({}));
    const base44 = createClientFromRequest(req);
    const result = await executeNightlyRegressionSweep({ base44, runKey: payload.run_key, environment: payload.environment || 'production' });
    return Response.json(result, { status: result.all_pass ? 200 : 500 });
  } catch (error) {
    return Response.json({ error: error.message || 'Nightly regression sweep failed', all_pass: false }, { status: 500 });
  }
}
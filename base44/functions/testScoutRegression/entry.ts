import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { runScoutRegressionSuite } from '../../shared/combat/scoutRegression.ts';

export default async function testScoutRegression(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    return Response.json(runScoutRegressionSuite());
  } catch (error) {
    return Response.json({ error: error.message, stack: error.stack }, { status: 500 });
  }
}
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { resolveUnifiedStorySkillCheck } from '../../shared/story/unifiedStorySkillResolution.ts';

export default async function resolveStorySkillCheckEndpoint(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await req.json();
    const outcome = await resolveUnifiedStorySkillCheck({ db: base44.asServiceRole, user, payload: body });
    return Response.json(outcome.body, { status: outcome.status });
  } catch (error) {
    return Response.json({ error: error.message || 'Story skill check could not be resolved', writes: 0 }, { status: 500 });
  }
}
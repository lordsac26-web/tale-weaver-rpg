import { createClientFromRequest } from 'npm:@base44/sdk@0.8.57';
import { characterBelongsToUser } from '../../shared/combat/authGuard.ts';
import resumeStorySession from '../../shared/story/resumeStorySession.ts';
import { buildGameHydration } from '../../shared/story/storyBootstrap.ts';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(error => error.status === 401 ? null : Promise.reject(error));
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const { session_id } = await req.json().catch(() => ({}));
    if (!session_id) return Response.json({ error: 'Session is required' }, { status: 400 });
    const session = await base44.asServiceRole.entities.GameSession.get(session_id).catch(error => error.status === 404 ? null : Promise.reject(error));
    if (!session) return Response.json({ error: 'Session not found' }, { status: 404 });
    const character = await base44.asServiceRole.entities.Character.get(session.character_id);
    if (!characterBelongsToUser(character, user)) return Response.json({ error: 'This adventure does not belong to you' }, { status: 403 });
    const recovered = await resumeStorySession({ base44, sessionId: session_id });
    if (recovered.blocked) return Response.json(recovered.blocked.body, { status: recovered.blocked.status });
    const freshCharacter = await base44.asServiceRole.entities.Character.get(session.character_id);
    return Response.json({ ...buildGameHydration(recovered.session, freshCharacter), recovery: recovered.recovery, story_recovery: null, recovered: true });
  } catch (error) {
    console.error('Story reconciliation failed', JSON.stringify({ error: error.message, stack: error.stack }));
    return Response.json({ error: 'The saved action could not be reconciled yet. No new action was rolled.', recovery_available: true }, { status: 500 });
  }
}
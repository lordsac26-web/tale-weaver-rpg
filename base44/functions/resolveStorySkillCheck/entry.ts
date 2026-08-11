import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { characterBelongsToUser } from '../../shared/combat/authGuard.ts';
import { resolveStorySkillCheck } from '../../shared/story/storySkillCheck.ts';

export default async function resolveStorySkillCheckEndpoint(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await req.json();
    const [session, character] = await Promise.all([
      base44.asServiceRole.entities.GameSession.get(body?.session_id),
      base44.asServiceRole.entities.Character.get(body?.character_id),
    ]);
    if (!session || !character || session.character_id !== character.id || !characterBelongsToUser(character, user)) {
      return Response.json({ error: 'Character and session linkage is invalid', writes: 0 }, { status: 403 });
    }
    const resolution = resolveStorySkillCheck({
      character, session, skill: body?.skill, dc: body?.dc, requestId: body?.request_id,
      raw: body?.raw_d20 ?? null, allRolls: body?.all_rolls || [], advantageSources: body?.advantage_sources || [],
    });
    if (!resolution.ok) return Response.json({ error: resolution.error, writes: 0 }, { status: 409 });
    return Response.json({ ...resolution, writes: 0 });
  } catch (error) {
    return Response.json({ error: error.message || 'Story skill check could not be resolved', writes: 0 }, { status: 500 });
  }
}
import { executeStowAction } from './stowIntent.ts';
import { hydrateLatestStoryEntry } from './storyTransition.ts';
import { buildStoryClarification } from './storyPersistence.ts';

export async function resolveStoryStowTransition({ base44, ownerId, session, characterId, requestId, actionText, check }) {
  const stow = await executeStowAction({ base44, ownerId, payload: { session_id: session.id, character_id: characterId, request_id: requestId, action_text: actionText, check } });
  if (stow.status >= 400) return { stow: stow.body, response: stow };
  if (stow.body?.clarification_required) {
    const response = await buildStoryClarification({ db: base44.asServiceRole, sessionId: session.id, characterId, requestId, sourceRequestId: hydrateLatestStoryEntry(session).request_id, stow: stow.body });
    return { stow: stow.body, response };
  }
  return { stow: stow.body?.handled ? stow.body : null, response: null };
}
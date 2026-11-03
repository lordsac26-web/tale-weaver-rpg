import { reconcileStorySession } from './storyCommitRecovery.ts';
import { handleStartCombat } from '../combat/startCombat.ts';

// Call only after the session's Character ownership has been authorized.
export default async function resumeStorySession({ base44, sessionId, requestId }) {
  const recovered = await reconcileStorySession({ base44, sessionId, preserveRequestId: requestId });
  if (recovered.blocked) return recovered;
  let session = recovered.session;
  const entry = session.story_log?.at(-1);
  if (!session.in_combat && entry?.mechanics_status === 'complete' && entry.transition_outcome?.combat_trigger && (entry.mechanics_commit || entry.mechanics_reconciliation)) {
    const response = await handleStartCombat({ base44, session_id: sessionId, payload: {
      enemies: entry.transition_outcome.enemies, story_request_id: entry.request_id,
      story_skill_handoff: entry.transition_outcome.combat_handoff,
      ambush_setup: entry.transition_outcome.pending_ambush_attack,
    } });
    if (!response.ok) return { ...recovered, blocked: { status: response.status, body: { ...await response.json(), recovery_available: true } } };
    session = await base44.asServiceRole.entities.GameSession.get(sessionId);
  }
  return { ...recovered, session };
}
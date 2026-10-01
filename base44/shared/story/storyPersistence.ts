import { canonicalStoryResponsePayload, hashStoryValue, storyPayloadFromCommit } from './storyTransition.ts';

export const STORY_PERSISTENCE_VERSION = 'story-persistence-v1.0.0';
const failure = (reason, afterWrite = false) => ({ status: 409, body: { error: `Story persistence requires reconciliation: ${reason}. No new action was replayed.`, error_code: reason, persistence_confirmed: false, preserve_scene: true, partial_write_possible: afterWrite, writes: afterWrite ? null : 0, story_persistence_version: STORY_PERSISTENCE_VERSION } });

// Confirmation comes from a fresh authoritative read, never from the update input.
export async function confirmPersistedStoryPair({ readSession, requestId, expectedHash, allowPending = false, afterWrite = false }) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const session = await readSession();
    const matches = (session?.story_log || []).map((entry, index) => ({ entry, index })).filter(x => x.entry?.request_id === requestId);
    if (matches.length > 1) return failure('ambiguous_request_entries', afterWrite);
    if (matches.length === 1) {
      const { entry, index } = matches[0];
      if (entry.mechanics_status === 'pending' && !allowPending) return failure('partial_mechanics_commit', true);
      const hash = await hashStoryValue(canonicalStoryResponsePayload({ requestId, text: entry.text, choices: entry.choices, skillCheck: entry.skill_check }));
      if (!entry.text || entry.choices?.length !== 4 || !entry.choice_evidence?.response_payload_hash || hash !== entry.choice_evidence.response_payload_hash || (expectedHash && hash !== expectedHash)) return failure('persisted_pair_hash_mismatch', afterWrite);
      if (index !== session.story_log.length - 1) return failure('superseded_persisted_pair', afterWrite);
      return { status: 200, session, body: { ...(entry.transition_outcome || {}), ...storyPayloadFromCommit({ entry, index, persistence_confirmed: true }), story_persistence_version: STORY_PERSISTENCE_VERSION } };
    }
    if (attempt < 2) await new Promise(resolve => setTimeout(resolve, 40 * (attempt + 1)));
  }
  return failure('authoritative_entry_not_visible', afterWrite);
}

// A clarification is NOT a new narrative commit. It confirms the preserved source
// scene and the separately persisted roll, and explicitly reports zero item writes.
export async function buildStoryClarification({ db, sessionId, characterId, requestId, sourceRequestId, stow }) {
  const confirmed = await confirmPersistedStoryPair({ readSession: () => db.entities.GameSession.get(sessionId), requestId: sourceRequestId });
  if (confirmed.status !== 200) return confirmed;
  if (confirmed.session.character_id !== characterId) return failure('character_session_mismatch');
  const receipts = (confirmed.session.world_state?.__skill_check_receipts || []).filter(x => x.request_id === requestId);
  if (receipts.length > 1 || (receipts[0] && receipts[0].source_story_request_id !== sourceRequestId)) return failure('ambiguous_clarification_receipt');
  return { status: 200, body: { ...confirmed.body, response_kind: 'clarification', session_id: sessionId, character_id: characterId, persistence_scope: 'existing_scene', requested_request_id: requestId, preserve_scene: true, clarification_required: true, clarification_message: stow.message, stow_transaction: stow, check_receipt: receipts[0] || null, writes: 0 } };
}

// Stage before consequences, complete only afterwards. An interrupted consequence
// path cannot replay as completed or silently apply damage/resources twice.
export async function finishStoryPersistence({ db, sessionId, requestId, expectedHash }) {
  const staged = await confirmPersistedStoryPair({ readSession: () => db.entities.GameSession.get(sessionId), requestId, expectedHash, allowPending: true, afterWrite: true });
  if (staged.status !== 200) return staged;
  const entry = staged.body.story_entry;
  if (entry.mechanics_status === 'pending') {
    const story_log = staged.session.story_log.map(x => x.request_id === requestId ? { ...x, mechanics_status: 'complete' } : x);
    await db.entities.GameSession.update(sessionId, { story_log });
  }
  return confirmPersistedStoryPair({ readSession: () => db.entities.GameSession.get(sessionId), requestId, expectedHash, afterWrite: true });
}
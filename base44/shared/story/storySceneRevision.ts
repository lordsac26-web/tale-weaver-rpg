import { hydrateLatestStoryEntry } from './storyTransition.ts';

export const STORY_SCENE_REVISION_VERSION = 'story-scene-revision-v1.0.0';

/**
 * Scene-revision lock for clicked story options.
 *
 * The client sends the request_id of the story entry whose choice list it rendered
 * (source_entry_request_id). A click whose source no longer matches the authoritative
 * latest entry is rejected zero-write: the scene advanced between render and click, so
 * executing it would act on a stale screen. Replays of an already-committed request are
 * handled before this guard and are therefore unaffected.
 */
export function isClickedStoryOption({ action, choiceIndex, choiceText } = {}) {
  if (action !== 'choice') return false;
  const indexed = choiceIndex !== undefined && choiceIndex !== null && choiceIndex !== '';
  return indexed || Boolean(String(choiceText || '').trim());
}

export function checkStorySceneRevision({ action, choiceIndex, choiceText, sourceEntryRequestId, session } = {}) {
  if (!isClickedStoryOption({ action, choiceIndex, choiceText })) return { ok: true, enforced: false, reason: 'not_a_clicked_option' };
  // Older clients send no revision claim: there is nothing to verify, so the
  // authoritative choice-matching contract still governs the click.
  if (!sourceEntryRequestId) return { ok: true, enforced: false, reason: 'no_revision_claim' };
  const latest = hydrateLatestStoryEntry(session).request_id;
  if (String(sourceEntryRequestId) === String(latest || '')) return { ok: true, enforced: true, reason: 'current_revision', latest_request_id: latest || null };
  return {
    ok: false,
    enforced: true,
    reason: 'stale_scene_revision',
    status: 409,
    body: {
      error: 'The scene advanced since that option list was shown, so the click was not executed. The current scene and its options are reloading now.',
      error_code: 'stale_scene_revision',
      stale_scene_revision: true,
      refresh_required: true,
      preserve_scene: true,
      writes: 0,
      expected_request_id: latest || null,
      provided_request_id: String(sourceEntryRequestId),
      revision_version: STORY_SCENE_REVISION_VERSION,
    },
  };
}
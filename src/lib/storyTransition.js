export const STORY_TRANSITION_VERSION = 'story-transition-v2.5.0';
export const normalizeStoryChoices = value => Array.isArray(value) ? value : [];
export function hydrateLatestStoryEntry(session) {
  const storyLog = Array.isArray(session?.story_log) ? session.story_log : [];
  const index = storyLog.length - 1, entry = storyLog[index] || null;
  return { index, request_id: entry?.request_id || null, text: String(entry?.text || ''), choices: normalizeStoryChoices(entry?.choices), entry };
}
export function acceptSequencedStoryPayload(payload, sequence, latestSequence) {
  if (sequence !== latestSequence) return { accepted: false, reason: 'superseded' };
  if (payload?.persistence_confirmed !== true) return { accepted: false, reason: 'persistence_unconfirmed' };
  const entry = payload.story_entry, choices = normalizeStoryChoices(entry?.choices);
  const matched = !!entry?.request_id && String(entry?.text || '') && choices.length === 4
    && payload.hydration?.request_id === entry.request_id && String(payload.hydration?.text || '') === String(entry.text)
    && JSON.stringify(normalizeStoryChoices(payload.hydration?.choices)) === JSON.stringify(choices)
    && String(payload.narrative || '') === String(entry.text)
    && JSON.stringify(normalizeStoryChoices(payload.choices)) === JSON.stringify(choices)
    && payload.response_payload_hash === entry.choice_evidence?.response_payload_hash;
  if (!matched) return { accepted: false, reason: 'persisted_pair_mismatch' };
  return { accepted: true, hydration: { ...payload.hydration, choices } };
}
export const STORY_TRANSITION_VERSION = 'story-transition-v2.1.0';

export const normalizeStoryChoices = (value) => Array.isArray(value) ? value : [];

export function commitStoryTransition(storyLog, completedEntry, requestId, limit = 60) {
  const source = Array.isArray(storyLog) ? storyLog : [];
  const existingIndex = requestId ? source.findIndex((entry) => entry?.request_id === requestId) : -1;
  const normalizedEntry = { ...completedEntry, choices: normalizeStoryChoices(completedEntry?.choices) };
  const next = existingIndex >= 0
    ? source.map((entry, index) => index === existingIndex ? normalizedEntry : entry)
    : [...source, normalizedEntry];
  const story_log = next.slice(-limit);
  const index = story_log.findIndex((entry) => requestId && entry?.request_id === requestId);
  return { story_log, entry: normalizedEntry, index: index >= 0 ? index : story_log.length - 1, replayed: existingIndex >= 0 };
}

export function hydrateLatestStoryEntry(session) {
  const storyLog = Array.isArray(session?.story_log) ? session.story_log : [];
  const index = storyLog.length - 1;
  const entry = index >= 0 ? storyLog[index] : null;
  return {
    index,
    request_id: entry?.request_id || null,
    text: String(entry?.text || ''),
    choices: normalizeStoryChoices(entry?.choices),
    entry,
  };
}

export function storyPayloadFromCommit(commit) {
  return {
    transition_version: STORY_TRANSITION_VERSION,
    story_entry: commit.entry,
    hydration: {
      index: commit.index,
      request_id: commit.entry?.request_id || null,
      text: String(commit.entry?.text || ''),
      choices: normalizeStoryChoices(commit.entry?.choices),
    },
  };
}

export function acceptSequencedStoryPayload(payload, sequence, latestSequence) {
  if (sequence !== latestSequence) return { accepted: false, reason: 'superseded' };
  const hydration = payload?.hydration || (payload?.story_entry ? {
    request_id: payload.story_entry.request_id || null,
    text: String(payload.story_entry.text || ''),
    choices: normalizeStoryChoices(payload.story_entry.choices),
  } : {
    request_id: null,
    text: String(payload?.narrative || ''),
    choices: normalizeStoryChoices(payload?.choices),
  });
  return { accepted: true, hydration: { ...hydration, choices: normalizeStoryChoices(hydration.choices) } };
}
export const NARRATION_TRUTH_VERSION = 'narration-truth-v1.0.0';

// Applied ONLY when the authoritative skill check FAILED: narration must show the
// failure consequence, never a completed task.
const SUCCESS_COMPLETION_PATTERNS = [
  /\bno\s+trail\b/i,
  /\bwithout\s+(?:a\s+)?trace\b/i,
  /\bleaving\s+no\s+(?:trace|sign|mark|witness)\b/i,
  /\b(?:the\s+)?(?:bod(?:y|ies)|corpses?|remains?|evidence)\b[^.]{0,80}\b(?:fed|swallowed|claimed|consumed|vanish(?:es|ed)?|disappear(?:s|ed)?|gone)\b/i,
  /\byou\s+(?:successfully|effortlessly|deftly|cleanly)\b/i,
  /\byour\s+(?:attempt|effort)\s+(?:succeeds|succeeded|pays off|is successful)\b/i,
  /\b(?:task|disposal|job|work)\s+(?:is|was)\s+(?:done|complete[d]?|accomplished)\b/i,
];

export function findFailedCheckSuccessContradictions(narrative) {
  const text = String(narrative || '');
  return SUCCESS_COMPLETION_PATTERNS.filter((pattern) => pattern.test(text)).map((pattern) => pattern.source);
}

export const FAILED_CHECK_CORRECTION_INSTRUCTION = 'Rewrite the complete response: the authoritative check FAILED, so the narration must show the real failure consequence (a partial outcome, a complication, or an alternative that is still possible). The task itself is NOT completed. Preserve the authoritative roll result and return exactly four choices that include an actionable alternative way to retry or work around the failed task.';

export function failedCheckFallbackNarrative(actionText) {
  const task = String(actionText || '').trim().replace(/\.$/, '');
  return `The attempt falls short. ${task ? `Despite your effort, you cannot complete the attempt to ${task.charAt(0).toLowerCase()}${task.slice(1)}.` : 'Despite your effort, the task is not completed.'} The situation remains as it was — but there are still ways forward.`;
}

const cleanSpells = (spells) => (Array.isArray(spells) ? spells.filter(Boolean).map(String) : []).slice(0, 20);

/**
 * Corpse contract for the story prompt: dead entities are definitively dead and
 * cannot provide information through any intermediary unless the player actually
 * knows a spell that mechanically permits it (e.g. Speak with Dead).
 */
export function buildCorpseContractLine(knownSpells = []) {
  const spells = cleanSpells(knownSpells);
  const hasSpeakWithDead = spells.some((spell) => /speak with dead/i.test(spell));
  return `CORPSE CONTRACT: defeated enemies and dead NPCs are definitively dead. Corpses cannot speak, answer, negotiate, remember, or reveal information through any intermediary (a druid, a ritual, a magic item, or an ally) unless the player casts a spell they actually know that mechanically permits it (for example, Speak with Dead).${spells.length ? ` The character's known spells are authoritative: ${spells.join(', ')}.` : ''}${hasSpeakWithDead ? '' : ' The character does NOT know Speak with Dead — never allow dead-NPC dialogue, interrogation, or testimony, by any means.'}`;
}
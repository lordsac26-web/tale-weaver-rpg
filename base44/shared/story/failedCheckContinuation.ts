import { classifyStowIntent, executeStowAction } from './stowIntent.ts';
import { containsExactRecoveryClaim } from './narratedStoryInventoryCommit.ts';
import { FAILED_CHECK_CORRECTION_INSTRUCTION, findFailedCheckSuccessContradictions } from './narrationTruth.ts';

export const FAILED_CHECK_CONTINUATION_VERSION = 'failed-check-continuation-v1.0.0';
const unsafe = (candidate) => containsExactRecoveryClaim(candidate?.narrative) || !!classifyStowIntent(candidate?.narrative) || findFailedCheckSuccessContradictions(candidate?.narrative).length > 0;
const withoutAwards = (candidate) => ({ ...candidate, current_recovery: null, crafting_outcome: null, loot: [], loot_coins: { gold: 0, silver: 0, copper: 0 }, xp_earned: 0 });

// A failed roll is a domain outcome, not an execution error. Correct only the
// uncommitted model candidate; never change the receipt or accepted history.
export async function resolveFailedCheckCandidate({ candidate, check, regenerate }) {
  if (check?.success !== false) return candidate;
  let result = candidate;
  if (unsafe(result) && regenerate) result = await regenerate(FAILED_CHECK_CORRECTION_INSTRUCTION);
  if (!result || unsafe(result)) result = { ...candidate, narrative: `The ${check.skill || 'skill'} check falls short (${check.final_total} against DC ${check.dc}). The intended task is not completed. You must reconsider your approach; no possessions change.`, combat_trigger: false, enemies: [], key_event: '' };
  return { ...withoutAwards(result), failed_check_continuation_version: FAILED_CHECK_CONTINUATION_VERSION };
}

// Narration is not permission to perform a task that the immutable roll failed.
// Genuine execution failures and unresolved successful placements still propagate.
export async function resolveNarratedStowCandidate({ base44, ownerId, sessionId, characterId, requestId, candidate, check }) {
  if (check?.success === false) return { status: 200, body: { handled: false, reason: 'failed_check', writes: 0 } };
  return executeStowAction({ base44, ownerId, payload: { session_id: sessionId, character_id: characterId, request_id: requestId, action_text: candidate?.narrative, check } });
}
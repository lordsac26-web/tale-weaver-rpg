import { confirmPersistedStoryPair, finishStoryPersistence } from './storyPersistence.ts';
import { commitStoryConsequencePlan } from './storyConsequenceCommit.ts';
import { commitItemDispositions } from './itemDispositionCommit.ts';
import { materializeNarratedLoot } from './narratedLootMaterialization.ts';
import { retireReceiptsIntoLedger } from './orphanSkillReceipt.ts';

export const STORY_COMMIT_RECOVERY_VERSION = 'story-commit-recovery-v1';
export const recoveryBlocked = (reason, requestId) => ({ status: 409, body: {
  error: 'The saved action needs reconciliation. Use Resolve and continue; do not roll or repeat the action.',
  error_code: 'partial_mechanics_commit', recovery_reason: reason, recovery_available: true,
  request_id: requestId, preserve_scene: true, persistence_confirmed: false, gameplay_writes: 0,
} });

// Shared by the initial commit and recovery. Every step uses saved inputs and is
// independently idempotent; no generation, skill roll, clock advance or resource cast.
export async function finishPendingStoryCommit({ base44, sessionId, requestId, recovered = false }) {
  const db = base44.asServiceRole;
  const staged = await confirmPersistedStoryPair({ readSession: () => db.entities.GameSession.get(sessionId), requestId, allowPending: true, afterWrite: true });
  if (staged.status !== 200) return recoveryBlocked(staged.body.error_code, requestId);
  const entry = staged.body.story_entry;
  if (entry.mechanics_status !== 'pending') return staged;
  if (entry.mechanics_commit?.version !== STORY_COMMIT_RECOVERY_VERSION) return recoveryBlocked('legacy_commit_missing_durable_postprocessing_inputs', requestId);
  const plan = entry.item_disposition_plan?.plan || (entry.item_disposition_plan?.records ? entry.item_disposition_plan : null);
  if (plan) {
    const disposed = await commitItemDispositions({ db, sessionId, characterId: staged.session.character_id, plan });
    if (!disposed.ok) return recoveryBlocked(disposed.body?.error_code || 'disposition_unconfirmed', requestId);
  }
  const consequences = await commitStoryConsequencePlan({ db, characterId: staged.session.character_id, plan: entry.mechanics_commit.character_consequences });
  if (!consequences.ok) return recoveryBlocked(consequences.reason, requestId);
  const loot = await materializeNarratedLoot({ base44, sessionId, characterId: staged.session.character_id, requestId, narrative: entry.text, storyIndex: staged.body.hydration.index });
  const recoveryReceipt = recovered ? { reconciliation_id: `story-recovery:${requestId}`, request_id: requestId, at: new Date().toISOString(), outcome: 'finished_saved_postprocessing', dice_rolled: 0, version: STORY_COMMIT_RECOVERY_VERSION } : null;
  const finished = await finishStoryPersistence({ db, sessionId, requestId, expectedHash: entry.choice_evidence.response_payload_hash, recoveryReceipt });
  return { ...finished, body: { ...finished.body, ...(loot.applied ? { narrated_loot: loot } : {}), ...(recoveryReceipt ? { recovery: recoveryReceipt } : {}) } };
}

export async function reconcileStorySession({ base44, sessionId, preserveRequestId = null }) {
  const db = base44.asServiceRole;
  let session = await db.entities.GameSession.get(sessionId);
  const pending = (session.story_log || []).filter(entry => entry.mechanics_status === 'pending');
  let recovery = null;
  if (pending.length) {
    if (pending.length !== 1 || session.story_log.at(-1) !== pending[0]) return { session, blocked: recoveryBlocked('ambiguous_pending_entries', pending[0].request_id) };
    const finished = await finishPendingStoryCommit({ base44, sessionId, requestId: pending[0].request_id, recovered: true });
    if (finished.status !== 200) return { session, blocked: finished };
    session = finished.session;
    recovery = finished.body.recovery;
    console.info('Story mechanics recovered', JSON.stringify(recovery));
  }
  // Only receipts tied to a retained source that has since advanced are orphans.
  // Absence from a pruned log alone is NOT evidence of a failed old action.
  const entries = session.story_log || [], latestId = entries.at(-1)?.request_id;
  const targets = (session.world_state?.__skill_check_receipts || []).filter(receipt =>
    (pending.length > 0 || receipt.request_id !== preserveRequestId) && !entries.some(entry => entry.request_id === receipt.request_id)
    && entries.some(entry => entry.request_id === receipt.source_story_request_id)
    && receipt.source_story_request_id !== latestId);
  if (targets.length) {
    const retired = await retireReceiptsIntoLedger({ db, session, targets, reason: 'source_scene_advanced_without_story_commit' });
    if (retired.retired) { session = await db.entities.GameSession.get(sessionId); recovery = recovery || { outcome: 'retired_orphan_receipts', dice_rolled: 0 }; }
  }
  return { session, recovery, blocked: null };
}
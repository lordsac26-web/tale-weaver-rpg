import { commitNarratedStoryInventoryRecovery, validateNarratedRecovery } from './narratedStoryInventoryCommit.ts';

export async function guardAndCommitNarratedRecovery({ base44, sessionId, characterId, requestId, check, narrative, recovery }) {
  const validation = validateNarratedRecovery({ narrative, recovery });
  if (!validation.ok) return { status: 409, body: { applied: false, reason: validation.status, recovery_transaction: { status: validation.status, claim: validation.claim }, writes: 0 } };
  if (validation.status === 'non_acquisition' || validation.status === 'vague_ambiguous') return { status: 200, body: { applied: false, reason: 'not_applicable', recovery_transaction: { status: validation.status, claim: validation.claim }, writes: 0 } };
  const committed = await commitNarratedStoryInventoryRecovery({ base44, sessionId, characterId, requestId, check, recovery });
  return { ...committed, body: { ...committed.body, recovery_transaction: { status: committed.body?.applied ? (committed.body?.already_processed ? 'replayed' : 'committed') : committed.body?.reason, claim: validation.claim } } };
}
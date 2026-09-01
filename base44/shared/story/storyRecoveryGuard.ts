import { commitNarratedStoryInventoryRecovery, NARRATED_RECOVERY_PARSER_VERSION, validateNarratedRecovery } from './narratedStoryInventoryCommit.ts';

export async function guardAndCommitNarratedRecovery({ base44, sessionId, characterId, requestId, check, narrative, recovery }) {
  const validation = validateNarratedRecovery({ narrative, recovery });
  const diagnostics = { parser_version: NARRATED_RECOVERY_PARSER_VERSION, classification: validation.status, claim: validation.claim };
  if (!validation.ok) return { status: 409, body: { applied: false, reason: validation.status, parser_version: NARRATED_RECOVERY_PARSER_VERSION, classification: validation.status, recovery_transaction: { status: validation.status, ...diagnostics }, writes: 0 } };
  if (validation.status === 'non_acquisition' || validation.status === 'vague_ambiguous') return { status: 200, body: { applied: false, reason: 'not_applicable', parser_version: NARRATED_RECOVERY_PARSER_VERSION, classification: validation.status, recovery_transaction: { status: validation.status, ...diagnostics }, writes: 0 } };
  const committed = await commitNarratedStoryInventoryRecovery({ base44, sessionId, characterId, requestId, check, recovery });
  return { ...committed, body: { ...committed.body, parser_version: NARRATED_RECOVERY_PARSER_VERSION, classification: validation.status, recovery_transaction: { status: committed.body?.applied ? (committed.body?.already_processed ? 'replayed' : 'committed') : committed.body?.reason, ...diagnostics } } };
}
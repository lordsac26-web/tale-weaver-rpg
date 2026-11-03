// Nov 2/3 class fix: when a story turn is refused before its commit (disposal-audit
// refusal, invariant refusal, or an exception mid-commit), the authoritative roll
// receipt that resolveStorySkillCheck already persisted must not linger as a
// resolvable result. Retire it by moving it to the session's orphan ledger with
// superseded + non_resolving markers: every resume and replay path
// (unifiedStorySkillResolution, storySkillReceiptCompatibility, the stow-resume
// lookup) already treats those markers as terminal, and a fresh attempt rolls a
// fresh request id. The Oct 31 misrouted Athletics receipt established this ledger
// convention; this module makes it the standing behavior for every refused commit.

const committedRequestIds = (session) => new Set((session?.story_log || []).filter((entry) => entry?.text && entry?.request_id).map((entry) => entry.request_id));

const retireTargets = ({ session, requestIds }) => {
  const receipts = [...(session?.world_state?.__skill_check_receipts || [])];
  const targets = receipts.filter((receipt) => requestIds.includes(receipt?.request_id) && receipt.superseded !== true && receipt.non_resolving !== true);
  return { receipts, targets };
};

// Retire receipts in place: removed from the resolvable list, preserved in the
// orphan ledger with retired provenance. Never touches a receipt whose story
// entry actually committed.
export const retireReceiptsIntoLedger = async ({ db, session, targets, reason }) => {
  const worldState = session.world_state || {};
  const receipts = worldState.__skill_check_receipts || [];
  const ledger = [...(worldState.__orphan_skill_receipts || [])];
  const retiredAt = new Date().toISOString();
  const kept = receipts.filter((receipt) => !targets.includes(receipt));
  for (const receipt of targets) ledger.push({ ...receipt, superseded: true, non_resolving: true, retired_at: retiredAt, retired_reason: reason });
  const retiredIds = [...new Set([...(worldState.__retired_story_request_ids || []), ...ledger.map(receipt => receipt.request_id)])];
  await db.entities.GameSession.updateMany({ id: session.id, updated_date: session.updated_date }, { $set: { world_state: { ...worldState, __skill_check_receipts: kept, __orphan_skill_receipts: ledger.slice(-60), __retired_story_request_ids: retiredIds } } });
  const saved = await db.entities.GameSession.get(session.id);
  const confirmed = targets.every(receipt => saved.world_state?.__retired_story_request_ids?.includes(receipt.request_id));
  return { retired: confirmed ? targets.length : 0, reason, confirmed };
};

export const retireUnsavedActionReceipt = async ({ db, sessionId, requestId, reason }) => {
  try {
    if (!sessionId || !requestId) return { retired: 0, skipped: 'no_ids' };
    const session = await db.entities.GameSession.get(sessionId);
    if (!session) return { retired: 0, skipped: 'no_session' };
    if (committedRequestIds(session).has(requestId)) return { retired: 0, skipped: 'story_entry_committed' };
    const { targets } = retireTargets({ session, requestIds: [requestId] });
    if (!targets.length) return { retired: 0, skipped: 'no_receipt' };
    return await retireReceiptsIntoLedger({ db, session, targets, reason });
  } catch (error) {
    console.warn('Orphan receipt retirement failed', JSON.stringify({ sessionId, requestId, reason, error: String(error?.message || error) }));
    return { retired: 0, skipped: 'retire_failed' };
  }
};

// A receipt is an orphan when no committed story entry carries its request id and
// it is older than the grace window (a live in-flight roll stays untouched).
export const findOrphanSkillReceipts = ({ session, graceMinutes = 15 }) => {
  const committed = committedRequestIds(session);
  const cutoff = Date.now() - graceMinutes * 60000;
  return (session?.world_state?.__skill_check_receipts || []).filter((receipt) =>
    receipt?.request_id && receipt.superseded !== true && receipt.non_resolving !== true
    && !committed.has(receipt.request_id)
    && (Date.parse(receipt.at || receipt.created_at || '') || 0) < cutoff);
};

export const sweepOrphanSkillReceipts = async ({ db, sessionId, graceMinutes = 15, reason = 'story_commit_refused_sweep' }) => {
  try {
    const session = await db.entities.GameSession.get(sessionId);
    if (!session) return { retired: 0, skipped: 'no_session' };
    const orphans = findOrphanSkillReceipts({ session, graceMinutes });
    if (!orphans.length) return { retired: 0, skipped: 'no_orphans' };
    return await retireReceiptsIntoLedger({ db, session, targets: orphans, reason });
  } catch (error) {
    return { retired: 0, skipped: 'sweep_failed', error: String(error?.message || error) };
  }
};
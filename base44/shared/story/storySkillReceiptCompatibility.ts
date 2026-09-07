export const STORY_SKILL_RECEIPT_COMPATIBILITY_VERSION = 'story-skill-receipt-compatibility-v1.0.0';

const numberMatches = (left, right) => Number.isFinite(Number(left)) && Number(left) === Number(right);
const receiptBody = (incoming) => incoming?.receipt && typeof incoming.receipt === 'object' ? incoming.receipt : incoming;

export function matchPersistedStorySkillReceipt({ persisted, incoming, requestId }) {
  const candidate = receiptBody(incoming);
  if (!persisted || !candidate || persisted.unified_story_skill_resolution !== true || persisted.request_id !== requestId) {
    return { ok: false, reason: 'missing_persisted_resolution' };
  }
  const incomingRequestId = candidate.request_id || candidate.id || null;
  if (incomingRequestId && incomingRequestId !== requestId) return { ok: false, reason: 'request_id_mismatch' };
  const timestamp = candidate.receipt_timestamp || candidate.at || null;
  const fieldsMatch = String(candidate.skill || '') === String(persisted.skill || '')
    && numberMatches(candidate.dc, persisted.dc)
    && numberMatches(candidate.raw_d20 ?? candidate.raw, persisted.raw_d20)
    && numberMatches(candidate.modifier_total ?? candidate.modifier, persisted.modifier_total)
    && numberMatches(candidate.final_total ?? candidate.final, persisted.final_total)
    && candidate.success === persisted.success
    && (!timestamp || timestamp === persisted.at);
  if (!fieldsMatch) return { ok: false, reason: 'mechanical_resolution_mismatch' };
  return {
    ok: true,
    receipt: persisted,
    format: JSON.stringify(candidate) === JSON.stringify(persisted) ? 'canonical_exact' : 'legacy_compact',
    version: STORY_SKILL_RECEIPT_COMPATIBILITY_VERSION,
  };
}
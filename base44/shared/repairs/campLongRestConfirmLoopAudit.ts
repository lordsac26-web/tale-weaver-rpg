import { getClockHour } from '../story/worldClock.ts';
import { hashValue } from '../tests/liveProtection.ts';

export const CAMP_LONG_REST_AUDIT_VERSION = 'camp-long-rest-confirm-loop-audit-v1.0.0';

export async function auditCampLongRestConfirmLoop({ character, session }) {
  const worldState = session.world_state || {};
  const requests = Array.isArray(worldState.__rest_requests) ? worldState.__rest_requests : [];
  const receipts = Array.isArray(worldState.__rest_receipts) ? worldState.__rest_receipts : [];
  const latestRequest = [...requests].filter((entry) => entry?.character_id === character.id && entry?.session_id === session.id).sort((a, b) => String(b.dispatched_at || '').localeCompare(String(a.dispatched_at || '')))[0] || null;
  const matchingReceipt = latestRequest ? receipts.find((entry) => entry?.token === latestRequest.request_id) : null;
  // A historical receipt without a matching dispatch record is not evidence for this UI incident.
  // Fail closed rather than attributing an older completed rest to the latest confirmation attempt.
  const exactOwnerEvidence = !!(latestRequest && latestRequest.owner_id === character.created_by_id && ['long_rest_8h', 'sleep_until_dawn'].includes(latestRequest.intent));
  const receiptFound = !!matchingReceipt;
  const mechanicsCommitted = receiptFound;
  const dispatched = !!latestRequest;
  const classification = !dispatched ? 'no_request_dispatched' : mechanicsCommitted ? 'request_committed' : 'request_dispatched_uncommitted';
  const safeToRepair = classification === 'request_dispatched_uncommitted' && exactOwnerEvidence;
  const currentClock = { time_of_day: session.time_of_day, hour: getClockHour({ timeOfDay: session.time_of_day, worldState }), elapsed_hours: Number(worldState.elapsed_hours) || 0 };
  const hashes = { character: await hashValue(character), session: await hashValue(session), clock_slots: await hashValue({ clock: currentClock, spell_slots: character.spell_slots || {} }) };
  return {
    audit_version: CAMP_LONG_REST_AUDIT_VERSION,
    classification,
    dispatched,
    receipt_found: receiptFound,
    mechanics_committed: mechanicsCommitted,
    safe_to_repair: safeToRepair,
    writes: 0,
    request_id: latestRequest?.request_id || matchingReceipt?.token || null,
    current_clock: currentClock,
    used_slots: character.spell_slots || {},
    recommendation: classification === 'no_request_dispatched' ? 'Publish the fixed frontend, then retry the long rest. Do not retroactively apply a rest.' : mechanicsCommitted ? 'Reconcile the UI from the authoritative receipt; do not perform a second rest.' : safeToRepair ? 'A guarded repair may be proposed from exact server evidence, but no repair was applied.' : 'Fail closed; do not repair without exact owner-confirmed server evidence.',
    hashes,
  };
}
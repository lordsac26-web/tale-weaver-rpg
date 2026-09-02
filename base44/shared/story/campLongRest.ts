import { executeLongRestCore } from './longRestCore.ts';

export const CAMP_LONG_REST_BACKEND_VERSION = 'camp-long-rest-backend-v1.0.0';

export async function executeCampLongRest({ base44, user, character, session, payload }) {
  const requestId = String(payload.rest_request_id || '').slice(0, 120);
  if (!requestId) return { status: 400, body: { error: 'A stable rest_request_id is required for a long rest.' } };
  const receipts = Array.isArray(session.world_state?.__rest_receipts) ? session.world_state.__rest_receipts : [];
  const prior = receipts.find((entry) => entry.token === requestId);
  if (prior?.response) return { status: 200, body: { ...prior.response, already_processed: true, backend_version: CAMP_LONG_REST_BACKEND_VERSION } };
  if (!['long_rest_8h', 'sleep_until_dawn'].includes(payload.rest_intent)) return { status: 400, body: { error: 'Invalid long-rest intent' } };

  if (!payload.location_safe && Math.random() < 0.2) {
    return { status: 200, body: { interrupted: true, encounter_message: 'Your rest is interrupted! A creature stirs in the darkness...' } };
  }

  const requests = Array.isArray(session.world_state?.__rest_requests) ? session.world_state.__rest_requests : [];
  if (!requests.some((entry) => entry.request_id === requestId)) {
    const requestRecord = { request_id: requestId, character_id: character.id, session_id: session.id, owner_id: user.id, intent: payload.rest_intent, dispatched_at: new Date().toISOString(), status: 'dispatched' };
    await base44.asServiceRole.entities.GameSession.update(session.id, { world_state: { ...(session.world_state || {}), __rest_requests: [...requests, requestRecord].slice(-25) } });
  }

  const core = await executeLongRestCore({ db: base44.asServiceRole, ownerId: user.id, characterId: character.id, sessionId: session.id, requestId, intent: payload.rest_intent });
  return { status: core.status, body: { ...core.body, backend_version: CAMP_LONG_REST_BACKEND_VERSION } };
}
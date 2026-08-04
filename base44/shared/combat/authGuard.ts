// Shared combat auth + idempotency guard. Used by combatEngine, useConsumable,
// and related P0 transition endpoints to validate the ownership chain and
// prevent duplicate/retried requests from double-spending resources.
//
// Ownership chain (defect #4):
//   CombatLog → GameSession → Character → User
// CombatLog records are service-role-created, so we NEVER authorize against
// CombatLog.created_by. We validate: CombatLog.session_id === GameSession.id,
// GameSession.character_id === Character.id, and Character belongs to caller
// (created_by_id === user.id OR created_by === user.email).
//
// Idempotency (defect #3):
//   Request IDs supplied by the frontend are stored in a bounded receipt map
//   inside CombatLog.world_state.__receipts (max 50 entries, FIFO). A retried
//   request with the same ID returns the stored outcome without re-processing.

const MAX_RECEIPTS = 50;

// ─── User validation ──────────────────────────────────────────────────────
// Returns the authenticated user or throws a 401 response. All externally
// user-invoked combat mutations must pass through this.
export async function requireUser(base44) {
  const user = await base44.auth.me();
  if (!user) {
    return { user: null, error: Response.json({ error: 'Unauthorized' }, { status: 401 }) };
  }
  return { user, error: null };
}

// ─── Character ownership ──────────────────────────────────────────────────
// Validates that the character belongs to the caller. Supports both
// created_by_id (newer records) and created_by (legacy email field).
export function characterBelongsToUser(character, user) {
  if (!character || !user) return false;
  if (character.created_by_id && character.created_by_id === user.id) return true;
  const createdByEmail = String(character.created_by || '').toLowerCase().trim();
  const userEmail = String(user.email || '').toLowerCase().trim();
  return !!(createdByEmail && userEmail && createdByEmail === userEmail);
}

// ─── Full ownership chain validation ───────────────────────────────────────
// Validates: Character → caller, GameSession.character_id === Character.id,
// CombatLog.session_id === GameSession.id (when combat_id provided).
// Returns { session, character, combat, error }.
// Does NOT authorize against CombatLog.created_by (service-role-created).
export async function validateCombatOwnership(base44, { session_id, combat_id, character_id, user }) {
  if (!user) {
    return { error: Response.json({ error: 'Unauthorized' }, { status: 401 }) };
  }
  if (!session_id || !character_id) {
    return { error: Response.json({ error: 'session_id and character_id are required' }, { status: 400 }) };
  }

  const character = await base44.asServiceRole.entities.Character.get(character_id);
  if (!character) {
    return { error: Response.json({ error: 'Character not found' }, { status: 404 }) };
  }
  if (!characterBelongsToUser(character, user)) {
    return { error: Response.json({ error: 'Character does not belong to the authenticated user' }, { status: 403 }) };
  }

  const session = await base44.asServiceRole.entities.GameSession.get(session_id);
  if (!session) {
    return { error: Response.json({ error: 'Session not found' }, { status: 404 }) };
  }
  if (session.character_id !== character_id) {
    return { error: Response.json({ error: 'Session does not belong to this character' }, { status: 403 }) };
  }

  let combat = null;
  if (combat_id) {
    combat = await base44.asServiceRole.entities.CombatLog.get(combat_id);
    if (!combat) {
      return { error: Response.json({ error: 'Combat log not found' }, { status: 404 }) };
    }
    if (combat.session_id !== session_id) {
      return { error: Response.json({ error: 'Combat does not belong to this session' }, { status: 403 }) };
    }
    // Cross-check: the session's referenced combat_id should match (when set)
    const referencedId = session.combat_state?.combat_id;
    if (referencedId && referencedId !== combat_id) {
      return { error: Response.json({ error: 'Combat ID mismatch with session reference', combat_id, referenced_combat_id: referencedId }, { status: 409 }) };
    }
  }

  return { session, character, combat, error: null };
}

// ─── Idempotency receipt check ─────────────────────────────────────────────
// Returns the stored outcome if this request_id was already processed.
// Receipts live in CombatLog.world_state.__receipts (bounded FIFO).
export function checkReceipt(worldState, requestId) {
  if (!requestId) return null;
  const ws = worldState || {};
  const receipts = Array.isArray(ws.__receipts) ? ws.__receipts : [];
  const prior = receipts.find((r) => r?.id === requestId);
  if (!prior) return null;
  return prior.outcome || null;
}

// ─── Idempotency receipt store ─────────────────────────────────────────────
// Returns an updated world_state with the new receipt appended (bounded).
export function storeReceipt(worldState, requestId, action, outcome) {
  if (!requestId) return worldState || {};
  const ws = { ...(worldState || {}) };
  const receipts = Array.isArray(ws.__receipts) ? [...ws.__receipts] : [];
  // Remove any prior entry with the same id (defensive — should not happen)
  const filtered = receipts.filter((r) => r?.id !== requestId);
  filtered.push({ id: requestId, action, at: new Date().toISOString(), outcome: outcome || null });
  // Bound the map (FIFO — drop oldest)
  ws.__receipts = filtered.slice(-MAX_RECEIPTS);
  return ws;
}

// ─── Generate a receipt-safe world_state update ───────────────────────────
// Helper: merges receipt storage into an existing world_state update object.
export function withReceipt(worldStateUpdate, worldState, requestId, action, outcome) {
  if (!requestId) return worldStateUpdate;
  const updated = storeReceipt(worldState, requestId, action, outcome);
  return { ...worldStateUpdate, __receipts: updated.__receipts };
}
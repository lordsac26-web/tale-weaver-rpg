import { canonicalAmmoName } from '../ammunition.ts';
import { characterBelongsToUser } from '../combat/authGuard.ts';

export const RECOVERABLE_LEDGER_KEY = '__recoverable_items';
export const RECOVERY_RECEIPTS_KEY = '__item_recovery_receipts';
const MAX_LEDGER = 100;
const normalize = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const stableIdentity = (item) => String(item?.equipment_id || item?.item_id || '').trim() || null;
const canonicalItem = (value) => canonicalAmmoName(value) || (normalize(value) === 'dagger' ? 'Dagger' : null);
const sameLocation = (a, b) => normalize(a) === normalize(b);

export function buildRecoverableItem({ originRequestId, characterId, sessionId, combatId = null, location, canonicalName, quantity = 1, sourceAction, itemSnapshot = null }) {
  const canonical = canonicalItem(canonicalName || itemSnapshot?.name);
  if (!originRequestId || !characterId || !sessionId || !canonical || !Number.isInteger(quantity) || quantity < 1) return null;
  const itemId = stableIdentity(itemSnapshot);
  return {
    ledger_id: `${originRequestId}:${canonical}:${itemId || 'canonical'}`,
    origin_request_id: originRequestId,
    owner_character_id: characterId,
    session_id: sessionId,
    combat_id: combatId || null,
    location: String(location || '').trim(),
    canonical_item: canonical,
    item_id: itemId,
    quantity,
    quantity_remaining: quantity,
    recovery_status: 'recoverable',
    source_action: sourceAction,
    item_snapshot: itemSnapshot ? { ...itemSnapshot } : null,
    created_at: new Date().toISOString(),
  };
}

export function appendRecoverableItem(abilities, entry) {
  const next = { ...(abilities || {}) };
  const ledger = Array.isArray(next[RECOVERABLE_LEDGER_KEY]) ? next[RECOVERABLE_LEDGER_KEY] : [];
  if (!entry || ledger.some((item) => item?.ledger_id === entry.ledger_id)) return next;
  next[RECOVERABLE_LEDGER_KEY] = [...ledger.slice(-(MAX_LEDGER - 1)), entry];
  return next;
}

export function availableRecoverySummary(character, session) {
  return (character?.long_rest_abilities?.[RECOVERABLE_LEDGER_KEY] || [])
    .filter((entry) => entry?.recovery_status === 'recoverable' && entry?.owner_character_id === character.id && entry?.session_id === session?.id && sameLocation(entry?.location, session?.current_location))
    .map((entry) => ({ origin_request_id: entry.origin_request_id, combat_id: entry.combat_id, canonical_item: entry.canonical_item, quantity: entry.quantity_remaining, location: entry.location }));
}

function requestedFromOutcome(outcome, actionText, ledger, session) {
  const structured = outcome?.recovery;
  if (structured?.type === 'recover_owned_items' && Array.isArray(structured.items)) return structured.items;
  if (structured?.origin_request_id && structured?.type === 'arrows') return [{ canonical_item: 'Arrows', quantity: structured.quantity, origin_request_id: structured.origin_request_id }];
  if (structured?.origin_request_id && structured?.type === 'item') return [{ canonical_item: structured.item?.name, quantity: structured.item?.quantity || 1, origin_request_id: structured.origin_request_id }];
  const text = normalize(actionText);
  if (!/\b(retrieve|recover|reclaim|collect|pick up|pull out)\b/.test(text) || !/\b(my|our)\b/.test(text)) return [];
  const wantsArrow = /\b(arrow)\b/.test(text) && !/\barrows\b/.test(text);
  const wantsDagger = /\bdagger\b/.test(text);
  const requested = [];
  for (const canonical of [wantsArrow ? 'Arrows' : null, wantsDagger ? 'Dagger' : null].filter(Boolean)) {
    const candidates = ledger.filter((entry) => entry?.recovery_status === 'recoverable' && entry?.canonical_item === canonical && entry?.session_id === session.id && sameLocation(entry?.location, session.current_location));
    if (candidates.length !== 1) return [{ invalid: true, canonical_item: canonical }];
    requested.push({ canonical_item: canonical, quantity: 1, origin_request_id: candidates[0].origin_request_id });
  }
  return requested;
}

function addRecoveredInventory(inventory, entry, quantity) {
  const next = [...inventory];
  if (entry.canonical_item === 'Arrows') {
    const matches = next.map((item, index) => ({ item, index })).filter(({ item }) => canonicalAmmoName(item?.name) === 'Arrows' && item?.unit === 'arrow' && item?.stack_semantics === 'individual');
    if (matches.length > 1) return { ok: false, reason: 'ambiguous_arrow_stack' };
    if (matches.length === 1) next[matches[0].index] = { ...matches[0].item, quantity: Math.max(0, Number(matches[0].item.quantity) || 0) + quantity };
    else next.push({ name: 'Arrows', category: 'Ammunition', quantity, unit: 'arrow', stack_semantics: 'individual' });
    return { ok: true, inventory: next };
  }
  const identity = entry.item_id;
  const matches = next.map((item, index) => ({ item, index })).filter(({ item }) => identity ? stableIdentity(item) === identity : normalize(item?.name) === 'dagger' && normalize(item?.category) === 'weapon');
  if (matches.length > 1) return { ok: false, reason: 'ambiguous_dagger_stack' };
  if (matches.length === 1) next[matches[0].index] = { ...matches[0].item, quantity: Math.max(0, Number(matches[0].item.quantity) || 0) + quantity };
  else if (entry.item_snapshot) next.push({ ...entry.item_snapshot, quantity });
  else return { ok: false, reason: 'missing_dagger_snapshot' };
  return { ok: true, inventory: next };
}

export async function executeRecoveryTransaction({ base44, user = null, ownerId = null, sessionId, characterId, combatId = null, requestId, outcome, actionText = '' }) {
  if (!requestId) return { status: 400, body: { applied: false, error: 'request_id is required', writes: 0 } };
  if (outcome?.check?.success !== true) return { status: 200, body: { applied: false, reason: 'failed_recovery_check', recovered_items: [], writes: 0 } };
  const [session, character] = await Promise.all([base44.asServiceRole.entities.GameSession.get(sessionId), base44.asServiceRole.entities.Character.get(characterId)]);
  if (!session || !character || session.character_id !== characterId || (user && !characterBelongsToUser(character, user)) || (ownerId && character.created_by_id !== ownerId)) return { status: 403, body: { applied: false, error: 'Character and Session linkage is invalid', writes: 0 } };
  const abilities = { ...(character.long_rest_abilities || {}) };
  const receipts = Array.isArray(abilities[RECOVERY_RECEIPTS_KEY]) ? abilities[RECOVERY_RECEIPTS_KEY] : [];
  const prior = receipts.find((receipt) => receipt?.request_id === requestId);
  if (prior) return { status: 200, body: { applied: true, already_processed: true, recovered_items: prior.recovered_items, receipt: prior, inventory: character.inventory || [], writes: 0 } };
  const ledger = Array.isArray(abilities[RECOVERABLE_LEDGER_KEY]) ? abilities[RECOVERABLE_LEDGER_KEY] : [];
  const requested = requestedFromOutcome(outcome, actionText, ledger, session);
  if (!requested.length) return { status: 200, body: { applied: false, reason: 'no_explicit_owned_item_recovery', recovered_items: [], writes: 0 } };
  if (requested.some((item) => item?.invalid)) return { status: 409, body: { applied: false, error: 'Recovery origin is ambiguous', writes: 0 } };

  const selected = [];
  for (const request of requested) {
    const canonical = canonicalItem(request?.canonical_item);
    const quantity = Number(request?.quantity);
    const candidates = ledger.filter((entry) => entry?.origin_request_id === request?.origin_request_id && entry?.canonical_item === canonical && entry?.recovery_status === 'recoverable');
    if (candidates.length !== 1 || !Number.isInteger(quantity) || quantity < 1) return { status: 409, body: { applied: false, error: 'No unique recoverable origin matches the request', writes: 0 } };
    const entry = candidates[0];
    if (entry.owner_character_id !== characterId || entry.session_id !== sessionId || (combatId && entry.combat_id !== combatId) || !sameLocation(entry.location, session.current_location) || quantity > Number(entry.quantity_remaining || 0)) return { status: 409, body: { applied: false, error: 'Recovery owner, combat, location, or quantity does not match', writes: 0 } };
    if (selected.some((item) => item.entry.ledger_id === entry.ledger_id)) return { status: 409, body: { applied: false, error: 'Duplicate recovery origin', writes: 0 } };
    selected.push({ entry, quantity });
  }

  let inventory = Array.isArray(character.inventory) ? character.inventory : [];
  for (const selection of selected) {
    const added = addRecoveredInventory(inventory, selection.entry, selection.quantity);
    if (!added.ok) return { status: 409, body: { applied: false, error: added.reason, writes: 0 } };
    inventory = added.inventory;
  }
  const recoveredAt = new Date().toISOString();
  const selectedById = new Map(selected.map((item) => [item.entry.ledger_id, item]));
  const nextLedger = ledger.map((entry) => {
    const selectedItem = selectedById.get(entry.ledger_id);
    if (!selectedItem) return entry;
    const remaining = Number(entry.quantity_remaining) - selectedItem.quantity;
    return { ...entry, quantity_remaining: remaining, recovery_status: remaining === 0 ? 'recovered' : 'partially_recovered', recovered_by_request_id: requestId, recovered_at: recoveredAt };
  });
  const recoveredItems = selected.map(({ entry, quantity }) => ({ canonical_item: entry.canonical_item, quantity, origin_request_id: entry.origin_request_id, combat_id: entry.combat_id, location: entry.location }));
  const receipt = { request_id: requestId, transaction_type: 'owned_item_recovery', recovered_items: recoveredItems, at: recoveredAt };
  abilities[RECOVERABLE_LEDGER_KEY] = nextLedger;
  abilities[RECOVERY_RECEIPTS_KEY] = [...receipts.slice(-49), receipt];
  await base44.asServiceRole.entities.Character.update(characterId, { inventory, long_rest_abilities: abilities });
  return { status: 200, body: { applied: true, already_processed: false, recovered_items: recoveredItems, receipt, inventory, writes: 1 } };
}
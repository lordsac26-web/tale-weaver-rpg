import { canonicalAmmoName } from '../ammunition.ts';

export const RECOVERABLE_LEDGER_KEY = '__recoverable_items';
export const RECOVERY_RECEIPTS_KEY = '__item_recovery_receipts';
const MAX_RECEIPTS = 50;
const normalize = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const stableIdentity = (item) => String(item?.equipment_id || item?.item_id || '').trim() || null;
const stableHash = async (value) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(value))))).map((byte) => byte.toString(16).padStart(2, '0')).join('');
const validQuantity = (value) => Number.isInteger(Number(value)) && Number(value) > 0;

export function buildRecoverableItem({ originRequestId, characterId, sessionId, combatId = null, location, canonicalName, quantity = 1, sourceAction, itemSnapshot = null }) {
  const canonical = canonicalAmmoName(canonicalName || itemSnapshot?.name) || String(canonicalName || itemSnapshot?.name || '').trim();
  if (!originRequestId || !characterId || !sessionId || !canonical || !validQuantity(quantity)) return null;
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
    quantity: Number(quantity),
    quantity_remaining: Number(quantity),
    recovery_status: 'recoverable',
    source_action: sourceAction,
    item_snapshot: itemSnapshot ? { ...itemSnapshot } : null,
    created_at: new Date().toISOString(),
  };
}

export function appendRecoverableItem(abilities, entry) {
  const next = { ...(abilities || {}) };
  const ledger = Array.isArray(next[RECOVERABLE_LEDGER_KEY]) ? next[RECOVERABLE_LEDGER_KEY] : [];
  if (entry && !ledger.some((item) => item?.ledger_id === entry.ledger_id)) next[RECOVERABLE_LEDGER_KEY] = [...ledger.slice(-99), entry];
  return next;
}

function parseDirectRecovery(recovery) {
  if (!recovery || typeof recovery !== 'object') return { ok: false, reason: 'missing_structured_recovery' };
  if (recovery.type === 'arrows') {
    if (!validQuantity(recovery.quantity)) return { ok: false, reason: 'invalid_quantity' };
    return { ok: true, items: [{ kind: 'stack', canonical_item: 'Arrows', quantity: Number(recovery.quantity), item: { name: 'Arrows', category: 'Ammunition', stackable: true } }] };
  }
  if (recovery.type === 'item' && recovery.item && typeof recovery.item === 'object') {
    const item = recovery.item;
    const quantity = item.quantity == null ? 1 : Number(item.quantity);
    if (!String(item.name || '').trim() || !validQuantity(quantity)) return { ok: false, reason: 'invalid_quantity_or_item' };
    const ammo = canonicalAmmoName(item.name);
    if (ammo) return { ok: true, items: [{ kind: 'stack', canonical_item: ammo, quantity, item: { ...item, name: ammo } }] };
    if (item.stackable === true) return { ok: true, items: [{ kind: 'stack', canonical_item: String(item.name).trim(), quantity, item }] };
    if (quantity !== 1 || !stableIdentity(item)) return { ok: false, reason: 'unique_item_requires_identity_and_quantity_one' };
    return { ok: true, items: [{ kind: 'unique', canonical_item: String(item.name).trim(), quantity: 1, item }] };
  }
  return { ok: false, reason: 'missing_structured_recovery' };
}

function applyStack(inventory, request) {
  const ammo = canonicalAmmoName(request.canonical_item);
  const candidates = inventory.map((item, index) => ({ item, index })).filter(({ item }) => ammo ? canonicalAmmoName(item?.name) === ammo : normalize(item?.name) === normalize(request.canonical_item));
  const positive = candidates.filter(({ item }) => Number(item?.quantity) > 0);
  if (positive.length > 1) return { ok: false, reason: 'ambiguous_positive_stack' };
  const target = positive[0] || null;
  if (target) {
    const next = inventory.map((item, index) => index === target.index ? { ...item, quantity: Number(item.quantity) + request.quantity } : item);
    return { ok: true, inventory: next, inventory_result: 'incremented_stack' };
  }
  const created = ammo
    ? { ...request.item, name: ammo, category: 'Ammunition', stackable: true, quantity: request.quantity, unit: ammo === 'Arrows' ? 'arrow' : ammo === 'Bolts' ? 'bolt' : 'sling bullet', stack_semantics: 'individual' }
    : { ...request.item, quantity: request.quantity };
  return { ok: true, inventory: [...inventory, created], inventory_result: 'added_stack' };
}

function applyUnique(inventory, request) {
  const id = stableIdentity(request.item);
  const matches = inventory.filter((item) => stableIdentity(item) === id);
  if (matches.length > 1) return { ok: false, reason: 'duplicate_unique_identity' };
  if (matches.length === 1) return { ok: true, inventory, inventory_result: 'already_owned' };
  return { ok: true, inventory: [...inventory, { ...request.item, quantity: 1 }], inventory_result: 'added_unique' };
}

function parseLedgerRecovery(recovery, ledger, { characterId, sessionId, combatId, location }) {
  if (recovery?.type !== 'recover_owned_items' || !Array.isArray(recovery.items) || recovery.items.length === 0) return null;
  const selected = [];
  for (const request of recovery.items) {
    if (!validQuantity(request?.quantity) || !request?.origin_request_id) return { ok: false, reason: 'invalid_ledger_request' };
    const canonical = canonicalAmmoName(request.canonical_item) || String(request.canonical_item || '').trim();
    const matches = ledger.filter((entry) => entry?.origin_request_id === request.origin_request_id && entry?.canonical_item === canonical && entry?.recovery_status === 'recoverable');
    if (matches.length !== 1) return { ok: false, reason: 'missing_or_ambiguous_origin' };
    const entry = matches[0];
    if (entry.owner_character_id !== characterId || entry.session_id !== sessionId || (combatId && entry.combat_id !== combatId) || normalize(entry.location) !== normalize(location) || Number(request.quantity) > Number(entry.quantity_remaining || 0) || selected.some((item) => item.entry.ledger_id === entry.ledger_id)) return { ok: false, reason: 'ledger_linkage_precondition_failed' };
    const item = entry.item_snapshot || { name: canonical, category: canonicalAmmoName(canonical) ? 'Ammunition' : 'Item', stackable: !!canonicalAmmoName(canonical) };
    selected.push({ entry, request: { kind: item.stackable || canonicalAmmoName(canonical) ? 'stack' : 'unique', canonical_item: canonical, quantity: Number(request.quantity), item } });
  }
  return { ok: true, selected };
}

export async function executeRecoveryTransaction({ base44, ownerId = null, sessionId, characterId, combatId = null, requestId, outcome }) {
  if (!requestId || !sessionId || !characterId) return { status: 400, body: { applied: false, reason: 'missing_scope', writes: 0 } };
  const [session, character] = await Promise.all([
    base44.asServiceRole.entities.GameSession.get(sessionId),
    base44.asServiceRole.entities.Character.get(characterId),
  ]);
  if (!session || !character || session.character_id !== characterId || (ownerId && character.created_by_id !== ownerId)) return { status: 403, body: { applied: false, reason: 'character_session_mismatch', writes: 0 } };
  if (outcome?.check?.success !== true) return { status: 200, body: { applied: false, reason: 'failed_check', writes: 0 } };

  const abilities = { ...(character.long_rest_abilities || {}) };
  const receipts = Array.isArray(abilities[RECOVERY_RECEIPTS_KEY]) ? abilities[RECOVERY_RECEIPTS_KEY] : [];
  const inputHash = await stableHash({ sessionId, characterId, combatId: combatId || null, recovery: outcome?.recovery });
  const prior = receipts.find((receipt) => receipt?.token === requestId);
  if (prior) {
    if (prior.input_hash !== inputHash || prior.character_id !== characterId || prior.session_id !== sessionId) return { status: 409, body: { applied: false, reason: 'idempotency_scope_mismatch', writes: 0 } };
    return { status: 200, body: { applied: true, already_processed: true, recovered_items: prior.recovered_items, receipt: prior, inventory: character.inventory || [], writes: 0 } };
  }

  const ledger = Array.isArray(abilities[RECOVERABLE_LEDGER_KEY]) ? abilities[RECOVERABLE_LEDGER_KEY] : [];
  const ledgerRequest = parseLedgerRecovery(outcome?.recovery, ledger, { characterId, sessionId, combatId, location: session.current_location });
  const direct = ledgerRequest || parseDirectRecovery(outcome?.recovery);
  if (!direct?.ok) return { status: 200, body: { applied: false, reason: direct?.reason || 'missing_structured_recovery', writes: 0 } };
  const work = ledgerRequest ? ledgerRequest.selected.map((selection) => selection.request) : direct.items;
  let inventory = Array.isArray(character.inventory) ? character.inventory : [];
  const results = [];
  for (const request of work) {
    const applied = request.kind === 'unique' ? applyUnique(inventory, request) : applyStack(inventory, request);
    if (!applied.ok) return { status: 409, body: { applied: false, reason: applied.reason, writes: 0 } };
    inventory = applied.inventory;
    results.push({ canonical_item: request.canonical_item, quantity: request.quantity, inventory_result: applied.inventory_result, unique: request.kind === 'unique' });
  }

  const beforeHash = await stableHash(character.inventory || []);
  const afterHash = await stableHash(inventory);
  const at = new Date().toISOString();
  const receipt = {
    token: requestId,
    transaction_type: 'structured_item_recovery',
    character_id: characterId,
    session_id: sessionId,
    combat_id: combatId || null,
    input_hash: inputHash,
    inventory_before_hash: beforeHash,
    inventory_after_hash: afterHash,
    item_name: results.length === 1 ? results[0].canonical_item : results.map((item) => item.canonical_item).join(' and '),
    quantity: results.reduce((sum, item) => sum + item.quantity, 0),
    unique: results.length === 1 && results[0].unique,
    inventory_result: results.length === 1 ? results[0].inventory_result : 'combined_recovery',
    recovered_items: results,
    at,
  };

  if (ledgerRequest) {
    const selectedById = new Map(ledgerRequest.selected.map((selection) => [selection.entry.ledger_id, selection.request.quantity]));
    abilities[RECOVERABLE_LEDGER_KEY] = ledger.map((entry) => {
      const quantity = selectedById.get(entry.ledger_id);
      if (!quantity) return entry;
      const remaining = Number(entry.quantity_remaining) - quantity;
      return { ...entry, quantity_remaining: remaining, recovery_status: remaining === 0 ? 'recovered' : 'partially_recovered', recovered_by_request_id: requestId, recovered_at: at };
    });
  }
  abilities[RECOVERY_RECEIPTS_KEY] = [...receipts.slice(-(MAX_RECEIPTS - 1)), receipt];
  if (results.length === 1 && results[0].canonical_item === 'Arrows') abilities.__arrow_recoveries = [...(abilities.__arrow_recoveries || []).filter((entry) => entry?.token !== requestId).slice(-49), receipt];
  await base44.asServiceRole.entities.Character.update(characterId, { inventory, long_rest_abilities: abilities });
  return { status: 200, body: { applied: true, already_processed: false, recovered_items: results, receipt, inventory, writes: 1 } };
}
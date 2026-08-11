import { appendRecoverableItem, buildRecoverableItem, executeRecoveryTransaction } from './recoveryTransaction.ts';

const RECEIPTS = '__thrown_weapon_actions';
const normalize = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const properties = (item) => (item?.properties || []).map(normalize);
const identity = (item) => String(item?.equipment_id || item?.item_id || '').trim();
const isThrown = (item) => properties(item).some((property) => property === 'thrown' || property.startsWith('thrown range '));
const parseName = (text) => String(text || '').match(/\b(?:throw|throws|threw|hurl|hurls|hurled|toss|tosses|tossed)\s+(?:my|the|a|an)?\s*([a-z][a-z -]{1,40}?)(?:\s+(?:at|toward|towards|into)\b)/i)?.[1]?.trim() || null;

export function parseThrownWeaponIntent(actionText) {
  const itemName = parseName(actionText);
  return itemName ? { type: 'thrown_weapon_attack', item_name: itemName } : null;
}

const baseRead = async (base44, sessionId, characterId) => {
  const [session, character] = await Promise.all([
    base44.asServiceRole.entities.GameSession.get(sessionId),
    base44.asServiceRole.entities.Character.get(characterId),
  ]);
  return { session, character };
};

export async function executeThrownWeaponAction({ base44, ownerId = null, payload }) {
  const parsed = parseThrownWeaponIntent(payload?.action_text);
  if (!parsed) return { status: 200, body: { handled: false } };
  const token = String(payload?.request_id || '').slice(0, 120);
  if (!token) return { status: 400, body: { handled: true, error: 'request_id is required.', writes: 0 } };
  const { session, character } = await baseRead(base44, payload.session_id, payload.character_id);
  if (!session || !character || session.character_id !== character.id || (ownerId && character.created_by_id !== ownerId)) return { status: 403, body: { handled: true, error: 'Character and Session linkage is invalid.', writes: 0 } };
  const abilities = { ...(character.long_rest_abilities || {}) };
  const receipts = Array.isArray(abilities[RECEIPTS]) ? abilities[RECEIPTS] : [];
  const prior = receipts.find((receipt) => receipt?.token === token);
  if (prior) return { status: 200, body: { handled: true, success: true, already_processed: true, writes: 0, receipt: prior, weapon_attack: prior } };

  const attack = payload?.weapon_attack;
  const requestedId = String(attack?.item_id || attack?.equipment_id || '').trim();
  const target = String(attack?.target || '').trim();
  const outcome = attack?.outcome;
  if (!target || !outcome || outcome.committed !== true || typeof outcome.hit !== 'boolean') return { status: 400, body: { handled: true, error: 'A structured committed target and hit/miss outcome are required before narration.', writes: 0 } };
  const inventory = Array.isArray(character.inventory) ? character.inventory : [];
  const named = inventory.map((item, index) => ({ item, index })).filter(({ item }) => normalize(item?.name) === normalize(parsed.item_name));
  const candidates = requestedId ? named.filter(({ item }) => identity(item) === requestedId) : named;
  if (!requestedId && candidates.length !== 1) return { status: 409, body: { handled: true, error: 'Thrown weapon selection is ambiguous; select a stable item identity.', writes: 0 } };
  if (candidates.length !== 1) return { status: 409, body: { handled: true, error: 'The selected thrown weapon identity was not found uniquely.', writes: 0 } };
  const selected = candidates[0];
  if (!identity(selected.item)) return { status: 409, body: { handled: true, error: 'The selected thrown weapon lacks a stable identity.', writes: 0 } };
  if (!isThrown(selected.item)) return { status: 400, body: { handled: true, error: 'The selected item does not have the thrown property.', writes: 0 } };
  const quantity = Number(selected.item.quantity);
  if (!Number.isInteger(quantity) || quantity <= 0) return { status: 409, body: { handled: true, error: 'The selected thrown weapon has no available quantity.', writes: 0 } };

  const nextInventory = quantity === 1 ? inventory.filter((_, index) => index !== selected.index) : inventory.map((item, index) => index === selected.index ? { ...item, quantity: quantity - 1 } : item);
  const receipt = { token, item_id: identity(selected.item), item_name: selected.item.name, target, hit: outcome.hit, kill: outcome.kill === true, consumed: 1, quantity_before: quantity, quantity_after: quantity - 1, at: new Date().toISOString() };
  abilities[RECEIPTS] = [...receipts.slice(-47), receipt];
  const recoverable = buildRecoverableItem({ originRequestId: token, characterId: character.id, sessionId: session.id, combatId: payload?.combat_id || null, location: payload?.location || session.current_location, canonicalName: selected.item.name, quantity: 1, sourceAction: 'thrown_weapon_attack', itemSnapshot: selected.item });
  const nextAbilities = appendRecoverableItem(abilities, recoverable);
  await base44.asServiceRole.entities.Character.update(character.id, { inventory: nextInventory, long_rest_abilities: nextAbilities });
  return { status: 200, body: { handled: true, success: true, already_processed: false, writes: 1, receipt, weapon_attack: receipt, recoverable_item: recoverable, inventory: nextInventory } };
}

export async function recoverThrownWeapon({ base44, ownerId = null, payload }) {
  const token = String(payload?.request_id || '').slice(0, 120);
  if (!token) return { status: 400, body: { error: 'request_id is required.', writes: 0 } };
  const result = await executeRecoveryTransaction({
    base44, ownerId, sessionId: payload.session_id, characterId: payload.character_id,
    combatId: payload.combat_id || null, requestId: token,
    outcome: { check: payload.check, recovery: { type: 'recover_owned_items', items: [{ canonical_item: payload.item?.name || 'Dagger', quantity: 1, origin_request_id: payload.attack_request_id }] } },
  });
  if (result.status >= 400) return result;
  return { status: 200, body: { success: !!result.body.applied, already_processed: !!result.body.already_processed, recovered: result.body.applied && !result.body.already_processed ? 1 : 0, writes: result.body.writes || 0, receipt: result.body.receipt, inventory: result.body.inventory, reason: result.body.reason } };
}
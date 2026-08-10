import { characterBelongsToUser } from '../combat/authGuard.ts';

const RECEIPTS = '__thrown_weapon_actions';
const RECOVERIES = '__thrown_weapon_recoveries';
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

export async function executeThrownWeaponAction({ base44, user, payload }) {
  const parsed = parseThrownWeaponIntent(payload?.action_text);
  if (!parsed) return { status: 200, body: { handled: false } };
  const token = String(payload?.request_id || '').slice(0, 120);
  if (!token) return { status: 400, body: { handled: true, error: 'request_id is required.', writes: 0 } };
  const { session, character } = await baseRead(base44, payload.session_id, payload.character_id);
  if (!session || !character || session.character_id !== character.id || !characterBelongsToUser(character, user)) return { status: 403, body: { handled: true, error: 'Character and Session linkage is invalid.', writes: 0 } };
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
  await base44.asServiceRole.entities.Character.update(character.id, { inventory: nextInventory, long_rest_abilities: abilities });
  return { status: 200, body: { handled: true, success: true, already_processed: false, writes: 1, receipt, weapon_attack: receipt, inventory: nextInventory } };
}

export async function recoverThrownWeapon({ base44, user, payload }) {
  const token = String(payload?.request_id || '').slice(0, 120);
  if (!token) return { status: 400, body: { error: 'request_id is required.', writes: 0 } };
  const { session, character } = await baseRead(base44, payload.session_id, payload.character_id);
  if (!session || !character || session.character_id !== character.id || !characterBelongsToUser(character, user)) return { status: 403, body: { error: 'Character and Session linkage is invalid.', writes: 0 } };
  if (payload?.check?.success !== true) return { status: 200, body: { success: false, recovered: 0, writes: 0, reason: 'failed_recovery' } };
  const abilities = { ...(character.long_rest_abilities || {}) };
  const attacks = Array.isArray(abilities[RECEIPTS]) ? abilities[RECEIPTS] : [];
  const recoveries = Array.isArray(abilities[RECOVERIES]) ? abilities[RECOVERIES] : [];
  const prior = recoveries.find((receipt) => receipt?.token === token);
  if (prior) return { status: 200, body: { success: true, already_processed: true, recovered: 0, writes: 0, receipt: prior } };
  const attack = attacks.find((receipt) => receipt?.token === payload?.attack_request_id && receipt?.consumed === 1);
  if (!attack || String(payload?.item_id || '') !== attack.item_id) return { status: 409, body: { error: 'No matching committed thrown-weapon receipt exists.', writes: 0 } };
  if (recoveries.some((receipt) => receipt?.attack_request_id === attack.token)) return { status: 409, body: { error: 'That thrown weapon was already recovered.', writes: 0 } };
  const inventory = Array.isArray(character.inventory) ? character.inventory : [];
  const matches = inventory.filter((item) => identity(item) === attack.item_id);
  if (matches.length > 1) return { status: 409, body: { error: 'Recovery identity is ambiguous.', writes: 0 } };
  const template = payload?.item;
  if (!template || identity(template) !== attack.item_id || !isThrown(template) || normalize(template.name) !== normalize(attack.item_name)) return { status: 400, body: { error: 'A matching canonical thrown item snapshot is required.', writes: 0 } };
  const nextInventory = matches.length === 1
    ? inventory.map((item) => identity(item) === attack.item_id ? { ...item, quantity: (Number(item.quantity) || 0) + 1 } : item)
    : [...inventory, { ...template, quantity: 1 }];
  const receipt = { token, attack_request_id: attack.token, item_id: attack.item_id, item_name: attack.item_name, quantity: 1, at: new Date().toISOString() };
  abilities[RECOVERIES] = [...recoveries.slice(-47), receipt];
  await base44.asServiceRole.entities.Character.update(character.id, { inventory: nextInventory, long_rest_abilities: abilities });
  return { status: 200, body: { success: true, already_processed: false, recovered: 1, writes: 1, receipt, inventory: nextInventory } };
}
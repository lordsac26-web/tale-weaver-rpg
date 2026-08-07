import { characterBelongsToUser } from '../combat/authGuard.ts';

const RECEIPTS_KEY = '__story_item_recoveries';
const MAX_QUANTITY = 999;
const normalize = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '').trim();

const normalizeRecovery = (recovery) => {
  if (recovery?.type === 'arrows') {
    const quantity = Number(recovery.quantity);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 20) return null;
    return { name: 'Arrows', quantity, stackable: true, category: 'Ammunition', weight: 0.05, description: 'Ammunition for a bow. Twenty arrows weigh 1 lb.', source: 'structured_story_recovery' };
  }
  if (recovery?.type !== 'item' || !recovery.item || typeof recovery.item !== 'object') return null;
  const item = recovery.item;
  const name = String(item.name || '').trim();
  const stackable = item.stackable === true;
  const quantity = stackable ? Number(item.quantity) : 1;
  if (!name || !Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QUANTITY) return null;
  return { name, quantity, stackable, item_id: String(item.item_id || '').trim() || undefined, category: String(item.category || '').trim() || undefined, rarity: String(item.rarity || '').trim() || undefined, description: String(item.description || '').trim() || undefined, source: String(item.source || 'structured_story_recovery').trim(), weight: Number.isFinite(Number(item.weight)) ? Number(item.weight) : undefined };
};

const identityOf = (item) => normalize(item?.item_id || item?.name);
const cleanItem = (item) => Object.fromEntries(Object.entries(item).filter(([, value]) => value !== undefined));

export async function resolveItemRecovery({ base44, user, sessionId, characterId, requestId, outcome }) {
  const recovery = normalizeRecovery(outcome?.recovery);
  if (outcome?.check?.success !== true || !recovery) return { applied: false, reason: 'not_a_successful_structured_item_recovery' };
  const token = String(requestId || '').slice(0, 120);
  if (!token) return { applied: false, reason: 'missing_recovery_correlation' };
  const session = await base44.asServiceRole.entities.GameSession.get(sessionId);
  const character = await base44.asServiceRole.entities.Character.get(characterId);
  if (!session || session.character_id !== characterId) return { applied: false, reason: 'session_character_mismatch' };
  if (!character || !characterBelongsToUser(character, user)) return { applied: false, reason: 'character_ownership_mismatch' };

  const abilities = { ...(character.long_rest_abilities || {}) };
  const receiptKey = recovery.name === 'Arrows' ? '__arrow_recoveries' : RECEIPTS_KEY;
  const receipts = Array.isArray(abilities[receiptKey]) ? abilities[receiptKey] : [];
  const prior = receipts.find((receipt) => receipt?.token === token);
  if (prior) return { applied: true, already_processed: true, item_recovery: prior, receipt: prior, inventory: character.inventory || [] };

  const inventory = Array.isArray(character.inventory) ? [...character.inventory] : [];
  const identity = identityOf(recovery);
  const matchingIndexes = inventory.map((item, index) => identityOf(item) === identity ? index : -1).filter((index) => index >= 0);
  let inventory_result = 'added_unique';
  let awarded_quantity = recovery.quantity;
  if (recovery.stackable) {
    const primaryIndex = matchingIndexes.find((index) => inventory[index]?.stackable !== false) ?? -1;
    if (primaryIndex >= 0) {
      inventory[primaryIndex] = { ...inventory[primaryIndex], quantity: Math.max(0, Number(inventory[primaryIndex].quantity) || 0) + recovery.quantity, stackable: true };
      inventory_result = 'incremented_stack';
    } else inventory.push(cleanItem({ ...recovery, stackable: true }));
  } else if (matchingIndexes.length > 0) {
    inventory_result = 'already_owned';
    awarded_quantity = 0;
  } else inventory.push(cleanItem({ ...recovery, quantity: 1, stackable: false }));

  const receipt = { token, item_name: recovery.name, item_id: recovery.item_id || null, quantity: awarded_quantity, unique: !recovery.stackable, inventory_result, at: new Date().toISOString() };
  abilities[receiptKey] = [...receipts.filter((entry) => entry?.token !== token).slice(-48), receipt];
  await base44.asServiceRole.entities.Character.update(characterId, { inventory, long_rest_abilities: abilities });
  const worldState = { ...(session.world_state || {}) };
  const storyReceipts = Array.isArray(worldState.__story_recovery_receipts) ? worldState.__story_recovery_receipts : [];
  worldState.__story_recovery_receipts = [...storyReceipts.filter((entry) => entry?.token !== token).slice(-48), receipt];
  await base44.asServiceRole.entities.GameSession.update(sessionId, { world_state: worldState });
  return { applied: true, already_processed: false, item_recovery: receipt, receipt, inventory };
}
import { characterBelongsToUser } from '../combat/authGuard.ts';

const ARROW_RECEIPTS_KEY = '__arrow_recoveries';
const MAX_RECOVERY = 20;
const normalize = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '').trim();

const canonicalArrowStack = (quantity) => ({
  name: 'Arrows',
  category: 'Ammunition',
  quantity,
  weight: 0.05,
  description: 'Ammunition for a bow. Twenty arrows weigh 1 lb.',
});

export async function resolveArrowRecovery({ base44, user, sessionId, characterId, requestId, outcome }) {
  const recovery = outcome?.recovery;
  const success = outcome?.check?.success === true;
  if (!recovery || recovery.type !== 'arrows' || !success) return { applied: false, reason: 'not_a_successful_structured_arrow_recovery' };

  const quantity = Number(recovery.quantity);
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_RECOVERY) {
    return { applied: false, reason: 'invalid_structured_recovery_quantity' };
  }

  const token = String(requestId || '').slice(0, 120);
  if (!token) return { applied: false, reason: 'missing_recovery_correlation' };

  const session = await base44.asServiceRole.entities.GameSession.get(sessionId);
  if (!session || session.character_id !== characterId) return { applied: false, reason: 'session_character_mismatch' };
  const character = await base44.asServiceRole.entities.Character.get(characterId);
  if (!character || !characterBelongsToUser(character, user)) return { applied: false, reason: 'character_ownership_mismatch' };

  const abilities = { ...(character.long_rest_abilities || {}) };
  const receipts = Array.isArray(abilities[ARROW_RECEIPTS_KEY]) ? abilities[ARROW_RECEIPTS_KEY] : [];
  const prior = receipts.find((receipt) => receipt?.token === token);
  if (prior) {
    return { applied: true, already_processed: true, recovered_quantity: prior.quantity, arrow_count: prior.arrow_count, receipt: prior, inventory: character.inventory || [] };
  }

  const inventory = Array.isArray(character.inventory) ? [...character.inventory] : [];
  const arrowIndexes = inventory.map((item, index) => normalize(item?.name) === 'arrows' ? index : -1).filter((index) => index >= 0);
  const primaryIndex = arrowIndexes[0] ?? -1;
  if (primaryIndex >= 0) {
    const stack = inventory[primaryIndex];
    inventory[primaryIndex] = { ...stack, quantity: Math.max(0, Number(stack.quantity) || 0) + quantity };
  } else {
    inventory.push(canonicalArrowStack(quantity));
  }

  const arrowCount = inventory.filter((item) => normalize(item?.name) === 'arrows').reduce((total, item) => total + Math.max(0, Number(item.quantity) || 0), 0);
  const receipt = { token, quantity, arrow_count: arrowCount, at: new Date().toISOString() };
  abilities[ARROW_RECEIPTS_KEY] = [...receipts.filter((entry) => entry?.token !== token).slice(-24), receipt];
  await base44.asServiceRole.entities.Character.update(characterId, { inventory, long_rest_abilities: abilities });

  const worldState = { ...(session.world_state || {}) };
  const storyReceipts = Array.isArray(worldState.__story_recovery_receipts) ? worldState.__story_recovery_receipts : [];
  worldState.__story_recovery_receipts = [...storyReceipts.filter((entry) => entry?.token !== token).slice(-24), receipt];
  await base44.asServiceRole.entities.GameSession.update(sessionId, { world_state: worldState });

  return { applied: true, already_processed: false, recovered_quantity: quantity, arrow_count: arrowCount, receipt, inventory };
}
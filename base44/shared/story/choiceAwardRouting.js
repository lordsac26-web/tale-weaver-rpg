export const CHOICE_AWARD_ROUTING_VERSION = 'choice-award-routing-v1.0.0';

const positiveInteger = (value) => Number.isInteger(Number(value)) && Number(value) > 0;
const craftingLanguage = (value) => /\b(?:craft|crafting|make|making|shape|shaping|knap|knapping|fletch|fletching)\w*\b/i.test(String(value || ''));
const completedAwardLanguage = (value) => /\b(?:crafted|produced|received|added to (?:your|the) (?:inventory|quiver))\b/i.test(String(value || ''));

export function normalizeDeclaredRecovery(recovery) {
  if (!recovery || typeof recovery !== 'object') return null;
  if (recovery.type === 'arrows') return positiveInteger(recovery.quantity) ? recovery : null;
  if (recovery.type === 'item') return recovery.item && positiveInteger(recovery.item.quantity ?? 1) ? recovery : null;
  if (recovery.type === 'recover_owned_items') return Array.isArray(recovery.items) && recovery.items.some((item) => positiveInteger(item?.quantity)) ? recovery : null;
  return null;
}

export function classifyCraftingAwardIntent({ actionText, craftingOutcome, narrative } = {}) {
  const candidate = craftingOutcome && typeof craftingOutcome === 'object' ? craftingOutcome : null;
  const explicitContract = !!candidate && (
    candidate.crafting_contract === true ||
    ['recipe_id', 'completed', 'time_minutes', 'tool', 'output', 'ingredients', 'provenance', 'invocation_type'].some((key) => Object.prototype.hasOwnProperty.call(candidate, key))
  );
  const nonzeroDeclaredYield = positiveInteger(candidate?.yield_quantity);
  const narratedCompletedCraft = craftingLanguage(actionText) && completedAwardLanguage(narrative);
  return {
    requires_validation: explicitContract || nonzeroDeclaredYield || narratedCompletedCraft,
    explicit_contract: explicitContract,
    nonzero_declared_yield: nonzeroDeclaredYield,
    narrated_completed_craft: narratedCompletedCraft,
  };
}
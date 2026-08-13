import { executeRecoveryTransaction } from './recoveryTransaction.ts';

const exactQuantity = (value) => Number.isInteger(Number(value)) && Number(value) > 0;

export const isStructuredNarratedRecovery = (recovery) => {
  if (!recovery || typeof recovery !== 'object') return false;
  if (recovery.type === 'recover_owned_items') return Array.isArray(recovery.items) && recovery.items.length > 0;
  if (recovery.type === 'arrows') return exactQuantity(recovery.quantity);
  return recovery.type === 'item' && recovery.item && typeof recovery.item === 'object' && typeof recovery.item.name === 'string' && recovery.item.name.trim() && exactQuantity(recovery.item.quantity ?? 1);
};

export const containsExactRecoveryClaim = (narrative) => /\b(?:found|find|recovered|recover|retrieve|retrieved|collected|collect)\b[^.]{0,100}\b\d+\s+(?:arrow|arrows|bolt|bolts|sling bullet|sling bullets)\b/i.test(String(narrative || ''));

export async function commitNarratedStoryInventoryRecovery({ base44, sessionId, characterId, requestId, check, recovery }) {
  if (!requestId || !sessionId || !characterId || !isStructuredNarratedRecovery(recovery)) return { status: 409, body: { applied:false, reason:'missing_exact_structured_recovery', writes:0 } };
  if (check?.success !== true) return { status: 200, body: { applied:false, reason:'failed_check', writes:0 } };
  const combatId = recovery.type === 'recover_owned_items' ? recovery.combat_id : null;
  return executeRecoveryTransaction({ base44, sessionId, characterId, combatId, requestId, outcome:{ check, recovery } });
}

export const narrationMayPublishRecovery = ({ narrative, committed }) => !containsExactRecoveryClaim(narrative) || committed === true;
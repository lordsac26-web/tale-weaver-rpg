import { executeRecoveryTransaction } from './recoveryTransaction.ts';

export async function resolveItemRecovery({ base44, user, sessionId, characterId, requestId, outcome, actionText = '', combatId = null }) {
  const result = await executeRecoveryTransaction({ base44, user, sessionId, characterId, combatId, requestId, outcome, actionText });
  if (!result.body?.applied) return { applied: false, status: result.status, reason: result.body?.reason, error: result.body?.error, writes: 0 };
  const recoveredItems = result.body.recovered_items || [];
  const itemRecovery = {
    request_id: requestId,
    recovered_items: recoveredItems,
    quantity: recoveredItems.reduce((sum, item) => sum + Number(item.quantity || 0), 0),
    item_name: recoveredItems.length === 1 ? recoveredItems[0].canonical_item : recoveredItems.map((item) => item.canonical_item).join(' and '),
    inventory_result: 'recovered_owned_items',
  };
  return { applied: true, already_processed: !!result.body.already_processed, item_recovery: itemRecovery, receipt: result.body.receipt, inventory: result.body.inventory, recovered_items: recoveredItems, writes: result.body.writes };
}
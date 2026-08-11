import { resolveItemRecovery } from './itemRecovery.ts';

export async function resolveArrowRecovery(args) {
  const result = await resolveItemRecovery(args);
  if (!result.applied || result.receipt?.item_name !== 'Arrows') return result;
  const arrowCount = (result.inventory || []).filter((item) => String(item?.name || '').toLowerCase() === 'arrows').reduce((total, item) => total + Math.max(0, Number(item.quantity) || 0), 0);
  return { ...result, recovered_quantity: result.receipt.quantity, arrow_count: arrowCount, receipt: { ...result.receipt, arrow_count: arrowCount } };
}
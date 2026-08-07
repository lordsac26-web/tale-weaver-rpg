import { resolveItemRecovery } from './itemRecovery.ts';

export async function resolveArrowRecovery(args) {
  const result = await resolveItemRecovery(args);
  if (!result.applied || result.receipt?.item_name !== 'Arrows') return result;
  const arrowCount = (result.inventory || []).filter((item) => String(item?.name || '').toLowerCase() === 'arrows').reduce((total, item) => total + Math.max(0, Number(item.quantity) || 0), 0);
  const receipt = { ...result.receipt, arrow_count: arrowCount };
  if (!result.already_processed) {
    const character = await args.base44.asServiceRole.entities.Character.get(args.characterId);
    const abilities = { ...(character.long_rest_abilities || {}) };
    abilities.__arrow_recoveries = (abilities.__arrow_recoveries || []).map((entry) => entry?.token === receipt.token ? receipt : entry);
    await args.base44.asServiceRole.entities.Character.update(args.characterId, { long_rest_abilities: abilities });
    const session = await args.base44.asServiceRole.entities.GameSession.get(args.sessionId);
    const worldState = { ...(session.world_state || {}) };
    worldState.__story_recovery_receipts = (worldState.__story_recovery_receipts || []).map((entry) => entry?.token === receipt.token ? receipt : entry);
    await args.base44.asServiceRole.entities.GameSession.update(args.sessionId, { world_state: worldState });
  }
  return { ...result, recovered_quantity: receipt.quantity, arrow_count: arrowCount, receipt };
}
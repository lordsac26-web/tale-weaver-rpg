import { corpseIdentity, verifiedDeadCorpse } from './corpseIdentity.ts';
export async function confirmCorpseStowReceipt(db, characterId, requestId, container) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const character = await db.entities.Character.get(characterId);
    const receipt = character.long_rest_abilities?.__stow_receipts?.find(x => x.token === requestId);
    if (receipt?.items?.length && receipt.container === container && receipt.quantity === receipt.items.length && receipt.items.every(source =>
      character.stowed_items?.some(x => x.stow_request_id === requestId && x.container === container && verifiedDeadCorpse(x)
        && corpseIdentity(x) === source.item_id))) return { ok: true, character, receipt };
    if (attempt < 2) await new Promise(resolve => setTimeout(resolve, 40 * (attempt + 1)));
  }
  return { ok: false };
}
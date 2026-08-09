import { addAmmunition } from './ammunition.ts';
import { canonicalValueCopper, currencyCopper, currencyFields, quoteItem } from './vendorEconomy.ts';

const normal = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const owns = (character, user) => character?.created_by_id === user?.id || character?.created_by_id === user?.email;
const stockItem = (vendor, itemName) => (vendor.items || []).find((item) => normal(item.name) === normal(itemName));
const inventoryItem = (character, itemName) => (character.inventory || []).find((item) => normal(item.name) === normal(itemName));

function addInventory(inventory, item, quantity) {
  if (item.category === 'Ammunition') return addAmmunition(inventory || [], item, quantity);
  const copy = [...(inventory || [])]; const index = copy.findIndex((entry) => entry.stackable && item.stackable && normal(entry.name) === normal(item.name) && entry.category === item.category);
  if (index >= 0) copy[index] = { ...copy[index], quantity: (Number(copy[index].quantity) || 1) + quantity };
  else copy.push({ ...item, quantity, stackable: !!item.stackable });
  return copy;
}
function removeInventory(inventory, itemName, quantity) {
  const copy = [...(inventory || [])]; const index = copy.findIndex((item) => normal(item.name) === normal(itemName));
  if (index < 0) return null;
  const available = Number(copy[index].quantity) || 1;
  if (available < quantity) return null;
  if (available === quantity) copy.splice(index, 1); else copy[index] = { ...copy[index], quantity: available - quantity };
  return copy;
}

export async function executeVendorTrade({ db, user, characterId, sessionId, vendorId, itemName, direction, quantity, quoteId, requestId }) {
  if (!Number.isInteger(quantity) || quantity <= 0 || !['buy_from_vendor', 'sell_to_vendor'].includes(direction) || !requestId) return { status: 400, body: { error: 'invalid_trade_request' } };
  const [character, session, vendor] = await Promise.all([db.entities.Character.get(characterId), db.entities.GameSession.get(sessionId), db.entities.Vendor.get(vendorId)]);
  if (!character || !session || !vendor || !owns(character, user) || session.character_id !== characterId) return { status: 403, body: { error: 'linkage_mismatch' } };
  const receipts = Array.isArray(character.long_rest_abilities?.__vendor_trade_receipts) ? character.long_rest_abilities.__vendor_trade_receipts : [];
  const prior = receipts.find((receipt) => receipt.request_id === requestId);
  if (prior) return { status: 200, body: { success: true, already_processed: true, receipt: prior } };
  const source = direction === 'buy_from_vendor' ? stockItem(vendor, itemName) : inventoryItem(character, itemName);
  if (!source) return { status: 404, body: { error: 'unknown_item' } };
  if (!canonicalValueCopper(source)) return { status: 400, body: { error: 'price_unavailable' } };
  const quote = quoteItem({ vendor, item: source, direction });
  if (quote.status !== 'ok' || quote.quote_id !== quoteId) return { status: 409, body: { error: 'stale_quote' } };
  const totalCopper = quote.unit_copper * quantity;
  const characterBefore = currencyCopper(character); const reserveBefore = Math.round(Number(vendor.gold_reserve || 0) * 100);
  if (direction === 'buy_from_vendor' && ((Number(source.stock) || 0) < quantity || characterBefore < totalCopper)) return { status: 400, body: { error: (Number(source.stock) || 0) < quantity ? 'insufficient_stock' : 'insufficient_funds' } };
  if (direction === 'sell_to_vendor' && (reserveBefore < totalCopper || !removeInventory(character.inventory, itemName, quantity))) return { status: 400, body: { error: reserveBefore < totalCopper ? 'insufficient_reserve' : 'insufficient_inventory' } };
  const inventoryAfter = direction === 'buy_from_vendor' ? addInventory(character.inventory, source, quantity) : removeInventory(character.inventory, itemName, quantity);
  const vendorItemsAfter = direction === 'buy_from_vendor' ? (vendor.items || []).map((item) => normal(item.name) === normal(itemName) ? { ...item, stock: (Number(item.stock) || 0) - quantity } : item) : (() => { const existing = stockItem(vendor, itemName); return existing ? (vendor.items || []).map((item) => normal(item.name) === normal(itemName) ? { ...item, stock: (Number(item.stock) || 0) + quantity } : item) : [...(vendor.items || []), { ...source, stock: quantity }]; })();
  const characterAfter = direction === 'buy_from_vendor' ? characterBefore - totalCopper : characterBefore + totalCopper;
  const reserveAfter = direction === 'buy_from_vendor' ? reserveBefore + totalCopper : reserveBefore - totalCopper;
  const receipt = { request_id: requestId, vendor_id: vendorId, item_name: source.name, direction, quantity, quote, total_copper: totalCopper, at: new Date().toISOString() };
  const abilities = { ...(character.long_rest_abilities || {}), __vendor_trade_receipts: [...receipts.slice(-24), receipt] };
  await db.entities.Character.update(characterId, { ...currencyFields(characterAfter), inventory: inventoryAfter, long_rest_abilities: abilities });
  try { await db.entities.Vendor.update(vendorId, { items: vendorItemsAfter, gold_reserve: reserveAfter / 100 }); }
  catch (error) { await db.entities.Character.update(characterId, { ...currencyFields(characterBefore), inventory: character.inventory || [], long_rest_abilities: character.long_rest_abilities || {} }); return { status: 500, body: { error: 'trade_rolled_back' } }; }
  return { status: 200, body: { success: true, already_processed: false, receipt, quote, character_before: currencyFields(characterBefore), character_after: currencyFields(characterAfter), vendor_reserve_before: reserveBefore, vendor_reserve_after: reserveAfter, inventory: inventoryAfter } };
}
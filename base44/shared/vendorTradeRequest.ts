import { iconForItem, quoteInventoryForVendor, quoteItem, VENDOR_ECONOMY_VERSION } from './vendorEconomy.ts';
import { quotedVendorCatalog, catalogItemForTrade } from './vendorCatalog.ts';
import { resolveVendorHaggle } from './vendorHaggle.ts';
import { executeVendorTrade } from './vendorTradeCore.ts';

export const VENDOR_TRADE_REQUEST_VERSION = 'vendor-trade-request-v1.2.0';

export async function handleVendorTradeRequest({ payload = {}, db, user, catalogItems = [] }) {
  const action = String(payload.request_kind || payload.action || '').trim();
  console.info('Vendor request dispatch', JSON.stringify({ version: VENDOR_TRADE_REQUEST_VERSION, action, action_field: payload.action || null, request_kind: payload.request_kind || null, has_item: !!payload.item_name, has_quantity: payload.quantity != null, has_direction: !!payload.direction, has_request_id: !!payload.request_id }));

  if (action === 'catalog') {
    const vendor = await db.entities.Vendor.get(payload.vendor_id);
    if (!vendor) return { status: 404, body: { error: 'vendor_not_found' } };
    const term = String(payload.search || '').toLowerCase().trim();
    const eligible = quotedVendorCatalog(vendor, catalogItems).filter((item) => !term || `${item.name} ${item.category} ${item.rarity}`.toLowerCase().includes(term));
    const pageSize = Math.min(40, Math.max(1, Number(payload.page_size) || 24));
    const page = Math.max(0, Number(payload.page) || 0);
    return { status: 200, body: { success: true, eligible_count: eligible.length, reachable_count: eligible.length, page, page_size: pageSize, items: eligible.slice(page * pageSize, (page + 1) * pageSize).map((item) => ({ ...item, icon: iconForItem(item) })) } };
  }

  if (action === 'sell_quotes') {
    const [vendor, character] = await Promise.all([db.entities.Vendor.get(payload.vendor_id), db.entities.Character.get(payload.character_id)]);
    if (!vendor || !character) return { status: 404, body: { error: 'unknown_market_context' } };
    return { status: 200, body: { success: true, quotes: quoteInventoryForVendor(vendor, character.inventory || []), request_version: VENDOR_TRADE_REQUEST_VERSION, vendor_economy_version: VENDOR_ECONOMY_VERSION } };
  }

  if (action === 'quote') {
    const [vendor, character] = await Promise.all([db.entities.Vendor.get(payload.vendor_id), db.entities.Character.get(payload.character_id)]);
    const source = payload.direction === 'buy_from_vendor' ? catalogItemForTrade(vendor, catalogItems, payload.item_name) : (character?.inventory || []).find((item) => item.name === payload.item_name);
    if (!vendor || !source) return { status: 404, body: { error: 'unknown_item' } };
    return { status: 200, body: { quote: quoteItem({ vendor, item: source, direction: payload.direction }), request_version: VENDOR_TRADE_REQUEST_VERSION, vendor_economy_version: VENDOR_ECONOMY_VERSION } };
  }

  if (action === 'haggle') {
    return resolveVendorHaggle({ db, user, characterId: payload.character_id, sessionId: payload.session_id, vendorId: payload.vendor_id, itemName: payload.item_name, visitId: payload.visit_id, skill: payload.skill, catalogItems });
  }

  const legacyTrade = !action && payload.direction && payload.item_name;
  if (action === 'trade' || legacyTrade) {
    return executeVendorTrade({ db, user, characterId: payload.character_id, sessionId: payload.session_id, vendorId: payload.vendor_id, itemName: payload.item_name, direction: payload.direction, quantity: payload.quantity, quoteId: payload.quote_id, requestId: payload.request_id, catalogItems });
  }

  return { status: 400, body: { error: 'unsupported_market_request', request_version: VENDOR_TRADE_REQUEST_VERSION } };
}
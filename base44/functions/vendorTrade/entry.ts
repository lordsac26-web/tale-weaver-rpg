import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { eligibleCatalogItems, iconForItem, quoteItem } from '../../shared/vendorEconomy.ts';
import { executeVendorTrade } from '../../shared/vendorTradeCore.ts';

export default async function vendorTrade(req) {
  try {
    const base44 = createClientFromRequest(req); const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const payload = await req.json(); const db = base44.asServiceRole;
    if (payload.action === 'catalog') {
      const vendor = await db.entities.Vendor.get(payload.vendor_id); if (!vendor) return Response.json({ error: 'vendor_not_found' }, { status: 404 });
      const catalog = await db.entities.VendorItem.list('name', 500); const term = String(payload.search || '').toLowerCase().trim();
      const eligible = eligibleCatalogItems(vendor, catalog).filter((item) => !term || `${item.name} ${item.category} ${item.rarity}`.toLowerCase().includes(term));
      const pageSize = Math.min(40, Math.max(1, Number(payload.page_size) || 24)); const page = Math.max(0, Number(payload.page) || 0);
      return Response.json({ success: true, eligible_count: eligible.length, reachable_count: eligible.length, page, page_size: pageSize, items: eligible.slice(page * pageSize, (page + 1) * pageSize).map((item) => ({ ...item, icon: iconForItem(item) })) });
    }
    if (payload.action === 'quote') {
      const [vendor, character] = await Promise.all([db.entities.Vendor.get(payload.vendor_id), db.entities.Character.get(payload.character_id)]);
      const source = payload.direction === 'buy_from_vendor' ? (vendor?.items || []).find((item) => item.name === payload.item_name) : (character?.inventory || []).find((item) => item.name === payload.item_name);
      if (!vendor || !source) return Response.json({ error: 'unknown_item' }, { status: 404 });
      const quote = quoteItem({ vendor, item: source, direction: payload.direction }); return Response.json({ quote }, { status: quote.status === 'ok' ? 200 : 400 });
    }
    const result = await executeVendorTrade({ db, user, characterId: payload.character_id, sessionId: payload.session_id, vendorId: payload.vendor_id, itemName: payload.item_name, direction: payload.direction, quantity: payload.quantity, quoteId: payload.quote_id, requestId: payload.request_id });
    return Response.json(result.body, { status: result.status });
  } catch (error) { return Response.json({ error: error.message || 'Vendor trade failed' }, { status: 500 }); }
}
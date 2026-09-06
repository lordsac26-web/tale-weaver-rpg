import { eligibleCatalogItems, iconForItem, quoteItem } from './vendorEconomy.ts';

const normal = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

export function materializeVendorCatalog(vendor, catalogItems = []) {
  const stocked = new Map((vendor?.items || []).map((item) => [normal(item.name), item]));
  const eligible = eligibleCatalogItems(vendor, catalogItems);
  const merged = new Map();
  for (const item of eligible) {
    const stockItem = stocked.get(normal(item.name));
    merged.set(normal(item.name), { ...item, ...(stockItem || {}), stock: Math.max(0, Number(stockItem?.stock ?? item.stock ?? 99) || 0) });
  }
  for (const item of vendor?.items || []) merged.set(normal(item.name), { ...item, stock: Math.max(0, Number(item.stock) || 0) });
  return [...merged.values()].sort((a, b) => String(a.name).localeCompare(String(b.name)));
}

export function catalogItemForTrade(vendor, catalogItems, itemName) {
  return materializeVendorCatalog(vendor, catalogItems).find((item) => normal(item.name) === normal(itemName)) || null;
}

export function quotedVendorCatalog(vendor, catalogItems = []) {
  return materializeVendorCatalog(vendor, catalogItems).map((item) => ({ ...item, icon: iconForItem(item), quote: quoteItem({ vendor, item, direction: 'buy_from_vendor' }) }));
}
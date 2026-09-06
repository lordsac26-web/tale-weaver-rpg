export const MARKET_UX_BUNDLE_VERSION = 'market-ux-v1.0.0';

export function formatCharacterFunds(character = {}) {
  const parts = [];
  if (Number(character.gold) > 0) parts.push(`${Number(character.gold)} gp`);
  if (Number(character.silver) > 0) parts.push(`${Number(character.silver)} sp`);
  if (Number(character.copper) > 0) parts.push(`${Number(character.copper)} cp`);
  return parts.length ? parts.join(' · ') : '0 gp';
}

export function mergeCatalogPages(pages = [], eligibleCount = 0) {
  const items = pages.flatMap((page) => Array.isArray(page?.items) ? page.items : []);
  const unique = [...new Map(items.map((item) => [String(item.name || '').toLowerCase(), item])).values()];
  return { items: unique, complete: unique.length >= Number(eligibleCount || 0), reachable_count: unique.length };
}

export const normalizeMarketText = (value) => String(value || '').toLowerCase().trim();

export function marketCategories(items = []) {
  const categories = new Map();
  for (const item of items) {
    const label = String(item?.category || 'Misc').trim() || 'Misc';
    categories.set(normalizeMarketText(label), label);
  }
  return ['All', ...categories.values()];
}

export function marketCategoryMatches(item, category) {
  return category === 'All' || normalizeMarketText(item?.category || 'Misc') === normalizeMarketText(category);
}

export function marketSearchMatches(item, search) {
  const haystack = normalizeMarketText(`${item?.name || ''} ${item?.category || ''} ${item?.rarity || ''}`);
  return haystack.includes(normalizeMarketText(search));
}

export function clampTradeQuantity(value, available) {
  return Math.max(1, Math.min(Math.max(1, Number(available) || 1), Math.floor(Number(value) || 1)));
}

export function marketRequestId(direction, vendorId, itemName) {
  const item = String(itemName || 'item').toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 50);
  return `market:${direction}:${vendorId}:${item}:${crypto.randomUUID()}`;
}
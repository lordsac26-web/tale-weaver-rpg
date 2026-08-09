const COPPER = { cp: 1, sp: 10, ep: 50, gp: 100, pp: 1000 };

export const VENDOR_CATEGORIES = {
  alchemist: ['Potion', 'Bomb', 'Poison', 'Component', 'Tool'], blacksmith: ['Weapon', 'Ammunition', 'Tool'], armorer: ['Armor', 'Shield', 'Tool'], general: ['Tool', 'Clothing', 'Trinket', 'Misc', 'Ammunition', 'Food'], tavern_inn: ['Food', 'Drink', 'Service'], tavern_pub: ['Food', 'Drink'], brothel: ['Service', 'Misc'], traveling: ['Weapon', 'Armor', 'Potion', 'Tool', 'Trinket', 'Misc', 'Clothing', 'Scroll'],
};

const clean = (value) => String(value || '').trim().toLowerCase();
const wholeCopper = (amount, unit) => {
  const text = String(amount).trim();
  if (!/^-?\d+(?:\.\d+)?$/.test(text) || !COPPER[unit]) return null;
  const [whole, decimal = ''] = text.replace('+', '').split('.');
  const digits = `${whole}${decimal}`;
  const scaled = BigInt(digits) * BigInt(COPPER[unit]);
  const divisor = 10n ** BigInt(decimal.length);
  return Number(scaled / divisor);
};

export function parseCopper(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return wholeCopper(value, 'gp');
  if (typeof value === 'string') {
    const matches = [...value.toLowerCase().matchAll(/(-?\d+(?:\.\d+)?)\s*(cp|sp|ep|gp|pp)\b/g)];
    if (!matches.length) return null;
    const totals = matches.map(([, amount, unit]) => wholeCopper(amount, unit));
    return totals.every(Number.isInteger) ? totals.reduce((sum, amount) => sum + amount, 0) : null;
  }
  if (value && typeof value === 'object') {
    if ('amount' in value && 'unit' in value) return wholeCopper(value.amount, clean(value.unit));
    const entries = Object.entries(value).filter(([unit]) => unit in COPPER);
    if (!entries.length) return null;
    const totals = entries.map(([unit, amount]) => wholeCopper(amount, unit));
    return totals.every(Number.isInteger) ? totals.reduce((sum, amount) => sum + amount, 0) : null;
  }
  return null;
}

export function canonicalValueCopper(item) {
  for (const field of ['base_price', 'price', 'cost', 'value']) {
    const copper = parseCopper(item?.[field]);
    if (Number.isInteger(copper) && copper > 0) return copper;
  }
  return null;
}

export function formatCopper(copper) {
  const value = Number(copper);
  if (!Number.isInteger(value) || value < 0) return 'price_unavailable';
  if (value % 100 === 0) return `${value / 100} gp`;
  if (value % 10 === 0) return `${value / 10} sp`;
  return `${value} cp`;
}

export function quoteItem({ vendor, item, direction }) {
  const canonicalCopper = canonicalValueCopper(item);
  if (!canonicalCopper) return { status: 'price_unavailable', direction, item_name: item?.name || null };
  const modifier = Math.round(Number(vendor?.reputation_modifier) || 0);
  const baseCopper = direction === 'sell_to_vendor' ? Math.floor(canonicalCopper / 2) : canonicalCopper;
  const totalCopper = Math.max(1, baseCopper + Math.round((baseCopper * modifier) / 100));
  return {
    status: 'ok', direction, item_name: item.name, canonical_copper: canonicalCopper,
    unit_copper: totalCopper, unit_display: formatCopper(totalCopper),
    quote_id: `${vendor.id}|${direction}|${item.name}|${canonicalCopper}|${Number(item.stock) || 0}|${modifier}`,
  };
}

export function eligibleCatalogItems(vendor, items) {
  const categories = VENDOR_CATEGORIES[vendor?.type] || VENDOR_CATEGORIES.general;
  return (items || []).filter((item) => item && ((item.vendor_types || []).includes(vendor?.type) || !(item.vendor_types || []).length || categories.includes(item.category)))
    .sort((a, b) => String(a.name).localeCompare(String(b.name)));
}

export function iconForItem(item) {
  const categories = { Weapon: '⚔️', Armor: '🛡️', Shield: '🛡️', Potion: '🧪', Scroll: '📜', Food: '🍖', Drink: '🍺', Service: '🛏️', Tool: '🔧', Clothing: '👘', Trinket: '💎', Component: '🌿', Poison: '☠️', Bomb: '💣', Ammunition: '🏹', Misc: '📦' };
  const rarity = { common: '○', uncommon: '●', rare: '◆', legendary: '★' };
  return item?.icon || `${categories[item?.category] || '📦'}${rarity[clean(item?.rarity)] || '○'}`;
}

export function currencyCopper(character) { return Math.max(0, Math.round(Number(character?.gold || 0) * 100) + Math.round(Number(character?.silver || 0) * 10) + Math.round(Number(character?.copper || 0))); }
export function currencyFields(copper) { const total = Math.max(0, Math.trunc(copper)); return { gold: Math.floor(total / 100), silver: Math.floor((total % 100) / 10), copper: total % 10 }; }
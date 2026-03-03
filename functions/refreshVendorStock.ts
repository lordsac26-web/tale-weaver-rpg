import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Vendor type → item categories they carry + slot counts
const VENDOR_CONFIG = {
  alchemist:  { categories: ['Potion','Bomb','Poison','Component','Tool'], baseSlots: 10, rotateSlots: 4 },
  blacksmith: { categories: ['Weapon','Ammunition','Tool'], baseSlots: 10, rotateSlots: 3 },
  armorer:    { categories: ['Armor','Shield','Tool'], baseSlots: 8, rotateSlots: 3 },
  general:    { categories: ['Tool','Clothing','Trinket','Misc','Ammunition','Food'], baseSlots: 12, rotateSlots: 5 },
  tavern_inn: { categories: ['Food','Drink','Service'], baseSlots: 8, rotateSlots: 2 },
  tavern_pub: { categories: ['Food','Drink'], baseSlots: 6, rotateSlots: 2 },
  brothel:    { categories: ['Service','Misc'], baseSlots: 5, rotateSlots: 2 },
  traveling:  { categories: ['Weapon','Armor','Potion','Tool','Trinket','Misc','Clothing','Scroll'], baseSlots: 10, rotateSlots: 6 },
};

// Rarity weights by vendor type (more magical for traveling/general)
const RARITY_WEIGHTS = {
  alchemist:  { common: 50, uncommon: 30, rare: 15, legendary: 5 },
  blacksmith: { common: 55, uncommon: 30, rare: 13, legendary: 2 },
  armorer:    { common: 55, uncommon: 28, rare: 14, legendary: 3 },
  general:    { common: 60, uncommon: 28, rare: 10, legendary: 2 },
  tavern_inn: { common: 80, uncommon: 18, rare: 2,  legendary: 0 },
  tavern_pub: { common: 85, uncommon: 15, rare: 0,  legendary: 0 },
  brothel:    { common: 75, uncommon: 20, rare: 5,  legendary: 0 },
  traveling:  { common: 40, uncommon: 35, rare: 20, legendary: 5 },
};

function weightedRarity(weights) {
  const total = Object.values(weights).reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (const [rarity, weight] of Object.entries(weights)) {
    r -= weight;
    if (r <= 0) return rarity;
  }
  return 'common';
}

function pickItems(pool, count, vendorType) {
  const weights = RARITY_WEIGHTS[vendorType] || RARITY_WEIGHTS.general;
  const picked = [];
  const usedNames = new Set();

  // Try to match desired rarity distribution
  for (let i = 0; i < count * 3 && picked.length < count; i++) {
    const targetRarity = weightedRarity(weights);
    const candidates = pool.filter(item =>
      item.rarity === targetRarity && !usedNames.has(item.name)
    );
    const fallback = pool.filter(item => !usedNames.has(item.name));
    const source = candidates.length > 0 ? candidates : fallback;
    if (source.length === 0) break;
    const chosen = source[Math.floor(Math.random() * source.length)];
    picked.push(chosen);
    usedNames.add(chosen.name);
  }
  return picked;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    // Fetch all item pool and vendors
    const [allItems, vendors] = await Promise.all([
      base44.asServiceRole.entities.VendorItem.list('-created_date', 500),
      base44.asServiceRole.entities.Vendor.list('-created_date', 100),
    ]);

    const now = new Date();
    const REFRESH_INTERVAL_DAYS = 3;
    let refreshedCount = 0;
    const results = [];

    for (const vendor of vendors) {
      if (!vendor.is_active || vendor.is_traveling) continue;

      const lastRefresh = vendor.last_stock_refresh ? new Date(vendor.last_stock_refresh) : null;
      const daysSince = lastRefresh ? (now - lastRefresh) / (1000 * 60 * 60 * 24) : 999;

      if (daysSince < REFRESH_INTERVAL_DAYS) {
        results.push({ vendor: vendor.name, skipped: true, daysSince: Math.floor(daysSince) });
        continue;
      }

      const config = VENDOR_CONFIG[vendor.type] || VENDOR_CONFIG.general;
      const vendorCategories = config.categories;
      const rotateSlots = config.rotateSlots;
      const baseSlots = config.baseSlots;

      // Filter pool to matching categories
      const eligibleItems = allItems.filter(item =>
        item.vendor_types?.includes(vendor.type) ||
        (item.vendor_types?.length === 0) ||
        vendorCategories.includes(item.category)
      );

      if (eligibleItems.length === 0) {
        results.push({ vendor: vendor.name, skipped: true, reason: 'no eligible items' });
        continue;
      }

      // Separate always-stocked from rotating
      const alwaysStocked = eligibleItems.filter(i => i.is_always_stocked);
      const rotatable = eligibleItems.filter(i => !i.is_always_stocked && i.is_rotating !== false);

      // Build new rotating items
      const newRotatingItems = pickItems(rotatable, Math.min(rotateSlots + baseSlots - alwaysStocked.length, rotatable.length), vendor.type);

      // Combine and format into vendor items array
      const allForVendor = [
        ...alwaysStocked.map(item => ({
          name: item.name, category: item.category, rarity: item.rarity,
          base_price: item.base_price, stock: item.rarity === 'legendary' ? 1 : item.rarity === 'rare' ? 1 : item.rarity === 'uncommon' ? 2 : 5,
          weight: item.weight || 1, description: item.description || '', effect: item.effect || '',
          icon: item.icon || '📦', is_magic: item.is_magic || false,
        })),
        ...newRotatingItems.map(item => ({
          name: item.name, category: item.category, rarity: item.rarity,
          base_price: item.base_price,
          stock: item.rarity === 'legendary' ? 1 : item.rarity === 'rare' ? 1 : item.rarity === 'uncommon' ? Math.floor(Math.random() * 2) + 1 : Math.floor(Math.random() * 5) + 2,
          weight: item.weight || 1, description: item.description || '', effect: item.effect || '',
          icon: item.icon || '📦', is_magic: item.is_magic || false,
        })),
      ];

      await base44.asServiceRole.entities.Vendor.update(vendor.id, {
        items: allForVendor,
        last_stock_refresh: now.toISOString(),
        gold_reserve: vendor.gold_reserve || 300,
      });

      refreshedCount++;
      results.push({ vendor: vendor.name, refreshed: true, itemCount: allForVendor.length });
    }

    return Response.json({ success: true, refreshedCount, results });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
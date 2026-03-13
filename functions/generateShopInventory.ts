import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const SHOP_INVENTORIES = {
  alchemist: {
    base: [
      { name: 'Healing Potion', category: 'Potion', rarity: 'common', base_price: 50, weight: 0.5, effect: 'Restore 2d4+2 HP', icon: '🧪' },
      { name: 'Antidote', category: 'Potion', rarity: 'common', base_price: 25, weight: 0.2, effect: 'Cure poison', icon: '💊' },
      { name: 'Acid Flask', category: 'Potion', rarity: 'common', base_price: 25, weight: 1, effect: '2d6 acid damage', icon: '⚗️' },
      { name: 'Alchemist Fire', category: 'Potion', rarity: 'common', base_price: 50, weight: 1, effect: '1d4 fire damage per turn', icon: '🔥' },
    ],
    uncommon: [
      { name: 'Greater Healing Potion', category: 'Potion', rarity: 'uncommon', base_price: 150, weight: 0.5, effect: 'Restore 4d4+4 HP', icon: '🧪' },
      { name: 'Potion of Climbing', category: 'Potion', rarity: 'uncommon', base_price: 100, weight: 0.5, effect: 'Climb speed for 1 hour', icon: '🧗' },
      { name: 'Potion of Invisibility', category: 'Potion', rarity: 'uncommon', base_price: 250, weight: 0.5, effect: 'Invisible for 1 hour', icon: '👻' },
    ],
    rare: [
      { name: 'Superior Healing Potion', category: 'Potion', rarity: 'rare', base_price: 500, weight: 0.5, effect: 'Restore 8d4+8 HP', icon: '🧪' },
      { name: 'Potion of Flying', category: 'Potion', rarity: 'rare', base_price: 600, weight: 0.5, effect: 'Fly for 1 hour', icon: '🪽' },
    ],
  },
  blacksmith: {
    base: [
      { name: 'Longsword', category: 'Weapon', rarity: 'common', base_price: 15, weight: 3, effect: '1d8 slashing', icon: '⚔️' },
      { name: 'Battleaxe', category: 'Weapon', rarity: 'common', base_price: 10, weight: 4, effect: '1d8 slashing', icon: '🪓' },
      { name: 'Warhammer', category: 'Weapon', rarity: 'common', base_price: 15, weight: 2, effect: '1d8 bludgeoning', icon: '🔨' },
      { name: 'Dagger', category: 'Weapon', rarity: 'common', base_price: 2, weight: 1, effect: '1d4 piercing', icon: '🗡️' },
    ],
    uncommon: [
      { name: 'Greatsword', category: 'Weapon', rarity: 'uncommon', base_price: 50, weight: 6, effect: '2d6 slashing', icon: '⚔️' },
      { name: '+1 Longsword', category: 'Weapon', rarity: 'uncommon', base_price: 200, weight: 3, effect: '1d8+1 slashing', icon: '⚔️' },
    ],
    rare: [
      { name: '+2 Longsword', category: 'Weapon', rarity: 'rare', base_price: 800, weight: 3, effect: '1d8+2 slashing', icon: '⚔️' },
      { name: 'Flame Tongue', category: 'Weapon', rarity: 'rare', base_price: 1500, weight: 3, effect: '+2d6 fire damage', icon: '🔥' },
    ],
  },
  armorer: {
    base: [
      { name: 'Leather Armor', category: 'Armor', rarity: 'common', base_price: 10, weight: 10, effect: 'AC 11 + Dex', icon: '🛡️' },
      { name: 'Chain Shirt', category: 'Armor', rarity: 'common', base_price: 50, weight: 20, effect: 'AC 13 + Dex (max 2)', icon: '🛡️' },
      { name: 'Shield', category: 'Armor', rarity: 'common', base_price: 10, weight: 6, effect: '+2 AC', icon: '🛡️' },
    ],
    uncommon: [
      { name: 'Half Plate', category: 'Armor', rarity: 'uncommon', base_price: 750, weight: 40, effect: 'AC 15 + Dex (max 2)', icon: '🛡️' },
      { name: '+1 Leather Armor', category: 'Armor', rarity: 'uncommon', base_price: 300, weight: 10, effect: 'AC 12 + Dex', icon: '🛡️' },
    ],
    rare: [
      { name: 'Plate Armor', category: 'Armor', rarity: 'rare', base_price: 1500, weight: 65, effect: 'AC 18', icon: '🛡️' },
      { name: '+1 Plate Armor', category: 'Armor', rarity: 'rare', base_price: 3000, weight: 65, effect: 'AC 19', icon: '🛡️' },
    ],
  },
  general: {
    base: [
      { name: 'Rope (50 ft)', category: 'Gear', rarity: 'common', base_price: 1, weight: 10, icon: '🪢' },
      { name: 'Torch', category: 'Gear', rarity: 'common', base_price: 0.1, weight: 1, icon: '🔦' },
      { name: 'Rations (1 day)', category: 'Food', rarity: 'common', base_price: 0.5, weight: 2, icon: '🍖' },
      { name: 'Bedroll', category: 'Gear', rarity: 'common', base_price: 1, weight: 7, icon: '🛏️' },
      { name: 'Backpack', category: 'Gear', rarity: 'common', base_price: 2, weight: 5, icon: '🎒' },
      { name: 'Waterskin', category: 'Gear', rarity: 'common', base_price: 0.2, weight: 5, icon: '🧴' },
    ],
    uncommon: [
      { name: 'Climber\'s Kit', category: 'Tool', rarity: 'uncommon', base_price: 25, weight: 12, icon: '⛏️' },
      { name: 'Thieves\' Tools', category: 'Tool', rarity: 'uncommon', base_price: 25, weight: 1, icon: '🔧' },
    ],
    rare: [],
  },
  tavern_inn: {
    base: [
      { name: 'Ale', category: 'Drink', rarity: 'common', base_price: 0.4, weight: 1, icon: '🍺' },
      { name: 'Wine', category: 'Drink', rarity: 'common', base_price: 2, weight: 1, icon: '🍷' },
      { name: 'Meal', category: 'Food', rarity: 'common', base_price: 0.5, weight: 1, icon: '🍖' },
      { name: 'Room (1 night)', category: 'Service', rarity: 'common', base_price: 5, weight: 0, effect: 'Long rest in comfort', icon: '🛏️' },
    ],
    uncommon: [
      { name: 'Fine Wine', category: 'Drink', rarity: 'uncommon', base_price: 10, weight: 1, icon: '🍷' },
      { name: 'Luxury Suite', category: 'Service', rarity: 'uncommon', base_price: 20, weight: 0, effect: 'Long rest + inspiration', icon: '🏨' },
    ],
    rare: [],
  },
};

function generateStock(type, level) {
  const inventory = SHOP_INVENTORIES[type] || SHOP_INVENTORIES.general;
  const items = [];

  // Base items always available
  inventory.base.forEach(item => {
    items.push({ ...item, stock: Math.floor(Math.random() * 5) + 3 });
  });

  // Uncommon items at level 3+
  if (level >= 3 && inventory.uncommon) {
    const uncommonCount = Math.min(inventory.uncommon.length, Math.floor(level / 3) + 1);
    const shuffled = [...inventory.uncommon].sort(() => Math.random() - 0.5);
    shuffled.slice(0, uncommonCount).forEach(item => {
      items.push({ ...item, stock: Math.floor(Math.random() * 3) + 1 });
    });
  }

  // Rare items at level 8+
  if (level >= 8 && inventory.rare) {
    const rareCount = Math.min(inventory.rare.length, Math.floor((level - 5) / 5) + 1);
    const shuffled = [...inventory.rare].sort(() => Math.random() - 0.5);
    shuffled.slice(0, rareCount).forEach(item => {
      if (Math.random() < 0.4) { // 40% chance for rare items
        items.push({ ...item, stock: Math.floor(Math.random() * 2) + 1 });
      }
    });
  }

  return items;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { vendor_type, character_level, location, vendor_name } = await req.json();

    if (!vendor_type || !character_level) {
      return Response.json({ error: 'vendor_type and character_level required' }, { status: 400 });
    }

    const level = Math.max(1, Math.min(20, character_level));
    const items = generateStock(vendor_type, level);

    // Calculate gold reserve based on level
    const baseReserve = 100;
    const goldReserve = baseReserve + (level * 50);

    return Response.json({
      success: true,
      items,
      gold_reserve: goldReserve,
      level_tier: level <= 4 ? 'low' : level <= 10 ? 'mid' : level <= 16 ? 'high' : 'epic',
      generated_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Shop generation error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
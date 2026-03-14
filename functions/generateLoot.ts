import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const LOOT_TABLES = {
  // Coin ranges by CR
  coins: {
    trivial: { gold: [0, 5], silver: [5, 20], copper: [10, 50] },
    low: { gold: [5, 15], silver: [10, 30], copper: [20, 100] },
    medium: { gold: [15, 50], silver: [30, 80], copper: [50, 200] },
    high: { gold: [50, 150], silver: [80, 200], copper: [100, 500] },
    legendary: { gold: [150, 500], silver: [200, 500], copper: [500, 1000] },
  },

  // Common item pool
  commonItems: [
    { name: 'Healing Potion', type: 'consumable', rarity: 'common', effect: 'Restore 2d4+2 HP', weight: 0.5, value: 50 },
    { name: 'Antidote Vial', type: 'consumable', rarity: 'common', effect: 'Cure poison', weight: 0.2, value: 25 },
    { name: 'Rations (1 day)', type: 'consumable', rarity: 'common', effect: 'Sustains for 1 day', weight: 2, value: 5 },
    { name: 'Rope (50 ft)', type: 'gear', rarity: 'common', weight: 10, value: 10 },
    { name: 'Torch', type: 'gear', rarity: 'common', weight: 1, value: 1 },
    { name: 'Lockpicks', type: 'tool', rarity: 'common', weight: 0.1, value: 25 },
    { name: 'Caltrops', type: 'gear', rarity: 'common', weight: 2, value: 10 },
    { name: 'Oil Flask', type: 'consumable', rarity: 'common', weight: 1, value: 5 },
  ],

  // Uncommon items
  uncommonItems: [
    { name: 'Greater Healing Potion', type: 'consumable', rarity: 'uncommon', effect: 'Restore 4d4+4 HP', weight: 0.5, value: 150 },
    { name: 'Potion of Speed', type: 'consumable', rarity: 'uncommon', effect: 'Double movement for 1 minute', weight: 0.5, value: 200 },
    { name: 'Potion of Invisibility', type: 'consumable', rarity: 'uncommon', effect: 'Become invisible for 1 hour', weight: 0.5, value: 250 },
    { name: 'Scroll of Fireball', type: 'consumable', rarity: 'uncommon', effect: 'Cast Fireball (3rd level)', weight: 0.1, value: 300 },
    { name: 'Wand of Magic Missiles', type: 'weapon', rarity: 'uncommon', effect: '7 charges, recharge daily', weight: 1, value: 500 },
    { name: 'Cloak of Protection', type: 'armor', rarity: 'uncommon', effect: '+1 AC and saving throws', weight: 2, value: 400 },
    { name: '+1 Weapon', type: 'weapon', rarity: 'uncommon', effect: '+1 to attack and damage rolls', weight: 3, value: 600 },
    { name: 'Bracers of Archery', type: 'armor', rarity: 'uncommon', effect: '+2 damage with longbow/shortbow', weight: 1, value: 500 },
    { name: 'Boots of Elvenkind', type: 'armor', rarity: 'uncommon', effect: 'Advantage on Stealth (Dexterity)', weight: 1, value: 450 },
  ],

  // Rare items
  rareItems: [
    { name: 'Superior Healing Potion', type: 'consumable', rarity: 'rare', effect: 'Restore 8d4+8 HP', weight: 0.5, value: 500 },
    { name: 'Ring of Protection', type: 'accessory', rarity: 'rare', effect: '+1 AC and saving throws', weight: 0.1, value: 1000 },
    { name: 'Bag of Holding', type: 'gear', rarity: 'rare', effect: 'Holds 500 lbs in extradimensional space', weight: 15, value: 1500 },
    { name: 'Boots of Speed', type: 'armor', rarity: 'rare', effect: 'Double movement speed (bonus action)', weight: 2, value: 1200 },
    { name: 'Amulet of Health', type: 'accessory', rarity: 'rare', effect: 'Constitution becomes 19', weight: 0.2, value: 2000 },
    { name: 'Flame Tongue Sword', type: 'weapon', rarity: 'rare', effect: '+2d6 fire damage when activated', weight: 3, value: 2500 },
    { name: '+2 Weapon', type: 'weapon', rarity: 'rare', effect: '+2 to attack and damage rolls', weight: 3, value: 2000 },
    { name: 'Belt of Giant Strength (Hill)', type: 'accessory', rarity: 'rare', effect: 'Strength becomes 21', weight: 1, value: 3000 },
    { name: 'Cloak of Displacement', type: 'armor', rarity: 'rare', effect: 'Attackers have disadvantage', weight: 2, value: 2500 },
    { name: 'Necklace of Fireballs', type: 'accessory', rarity: 'rare', effect: '5 beads, each casts Fireball', weight: 0.2, value: 1800 },
  ],

  // Legendary items
  legendaryItems: [
    { name: 'Supreme Healing Potion', type: 'consumable', rarity: 'legendary', effect: 'Restore 10d4+20 HP', weight: 0.5, value: 1500 },
    { name: 'Vorpal Sword', type: 'weapon', rarity: 'legendary', effect: 'Nat 20 decapitates (DC 15 CON)', weight: 3, value: 10000 },
    { name: 'Ring of Three Wishes', type: 'accessory', rarity: 'legendary', effect: 'Grant 3 wishes', weight: 0.1, value: 50000 },
    { name: 'Belt of Storm Giant Strength', type: 'accessory', rarity: 'legendary', effect: 'Strength becomes 29', weight: 1, value: 8000 },
    { name: 'Staff of Power', type: 'weapon', rarity: 'legendary', effect: '+2 to spell attacks, 20 charges', weight: 4, value: 15000 },
  ],

  // Enemy type modifiers
  enemyTypes: {
    undead: { coinMultiplier: 0.5, itemBonus: ['Holy Water', 'Silver Dust'] },
    dragon: { coinMultiplier: 3, itemBonus: ['Dragon Scale', 'Precious Gem'] },
    demon: { coinMultiplier: 0.8, itemBonus: ['Infernal Iron', 'Demon Ichor'] },
    beast: { coinMultiplier: 0.3, itemBonus: ['Hide', 'Claws', 'Teeth'] },
    humanoid: { coinMultiplier: 1, itemBonus: ['Weapon', 'Armor Piece'] },
    construct: { coinMultiplier: 0.2, itemBonus: ['Scrap Metal', 'Mechanical Part'] },
    elemental: { coinMultiplier: 0.1, itemBonus: ['Elemental Core', 'Mana Crystal'] },
  },
};

function rollDice(count, sides) {
  let total = 0;
  for (let i = 0; i < count; i++) {
    total += Math.floor(Math.random() * sides) + 1;
  }
  return total;
}

function randomInRange(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function determineTier(level) {
  if (level <= 4) return 'trivial';
  if (level <= 10) return 'low';
  if (level <= 16) return 'medium';
  if (level <= 20) return 'high';
  return 'legendary';
}

function determineTierByCR(cr) {
  const crNum = parseFloat(cr) || 0;
  if (crNum < 1) return 'trivial';
  if (crNum < 5) return 'low';
  if (crNum < 11) return 'medium';
  if (crNum < 17) return 'high';
  return 'legendary';
}

function generateCoins(tier, enemyType = 'humanoid') {
  const coinData = LOOT_TABLES.coins[tier];
  const multiplier = LOOT_TABLES.enemyTypes[enemyType]?.coinMultiplier || 1;

  return {
    gold: Math.floor(randomInRange(coinData.gold[0], coinData.gold[1]) * multiplier),
    silver: Math.floor(randomInRange(coinData.silver[0], coinData.silver[1]) * multiplier),
    copper: Math.floor(randomInRange(coinData.copper[0], coinData.copper[1]) * multiplier),
  };
}

function generateItems(tier, level, enemyType = 'humanoid', cr = null) {
  const items = [];
  // Use CR to determine item count if available
  const effectiveLevel = cr ? Math.ceil(parseFloat(cr) * 2.5) : level;
  const itemCount = effectiveLevel <= 4 ? 1 : effectiveLevel <= 10 ? rollDice(1, 3) : effectiveLevel <= 16 ? rollDice(1, 4) : rollDice(2, 3);

  // Enemy-specific bonus items
  const enemyData = LOOT_TABLES.enemyTypes[enemyType];
  if (enemyData?.itemBonus && Math.random() < 0.4) {
    const bonusItem = enemyData.itemBonus[Math.floor(Math.random() * enemyData.itemBonus.length)];
    items.push({
      name: bonusItem,
      type: 'material',
      rarity: 'common',
      weight: 1,
      value: randomInRange(10, 50),
    });
  }

  // Generate random items based on tier
  for (let i = 0; i < itemCount; i++) {
    const roll = Math.random();
    let pool;

    if (tier === 'trivial' || tier === 'low') {
      pool = roll < 0.9 ? LOOT_TABLES.commonItems : LOOT_TABLES.uncommonItems;
    } else if (tier === 'medium') {
      pool = roll < 0.6 ? LOOT_TABLES.commonItems : roll < 0.95 ? LOOT_TABLES.uncommonItems : LOOT_TABLES.rareItems;
    } else if (tier === 'high') {
      pool = roll < 0.4 ? LOOT_TABLES.uncommonItems : roll < 0.9 ? LOOT_TABLES.rareItems : LOOT_TABLES.legendaryItems;
    } else {
      pool = roll < 0.5 ? LOOT_TABLES.rareItems : LOOT_TABLES.legendaryItems;
    }

    const item = pool[Math.floor(Math.random() * pool.length)];
    items.push({ ...item, quantity: item.type === 'consumable' ? rollDice(1, 3) : 1 });
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

    const { level, enemy_type, enemy_cr, num_enemies = 1 } = await req.json();

    // Determine tier by CR if provided, otherwise use character level
    const tier = enemy_cr ? determineTierByCR(enemy_cr) : level ? determineTier(level) : 'low';
    const effectiveEnemyType = enemy_type?.toLowerCase() || 'humanoid';

    // Generate loot
    const coins = generateCoins(tier, effectiveEnemyType);
    const items = generateItems(tier, level || 1, effectiveEnemyType, enemy_cr);

    // Scale coins by number of enemies
    coins.gold *= num_enemies;
    coins.silver *= num_enemies;
    coins.copper *= num_enemies;

    // Generate magical artifact chance based on CR or level
    const effectiveLevel = enemy_cr ? Math.ceil(parseFloat(enemy_cr) * 2) : level;
    const artifactChance = Math.min(0.05 + (effectiveLevel * 0.02), 0.5);
    let artifact = null;

    if (Math.random() < artifactChance) {
      const artifactTier = effectiveLevel <= 5 ? 'uncommon' : effectiveLevel <= 10 ? 'rare' : effectiveLevel <= 15 ? 'rare' : 'legendary';
      const artifactPools = {
        uncommon: LOOT_TABLES.uncommonItems,
        rare: LOOT_TABLES.rareItems,
        legendary: LOOT_TABLES.legendaryItems,
      };
      artifact = artifactPools[artifactTier][Math.floor(Math.random() * artifactPools[artifactTier].length)];
    }

    return Response.json({
      success: true,
      tier,
      cr_used: enemy_cr || null,
      coins,
      items,
      artifact,
      summary: {
        total_gold_value: coins.gold + Math.floor(coins.silver / 10) + Math.floor(coins.copper / 100),
        item_count: items.length + (artifact ? 1 : 0),
        rarest_item: artifact?.rarity || items.reduce((max, item) => {
          const rarities = ['common', 'uncommon', 'rare', 'legendary'];
          return rarities.indexOf(item.rarity) > rarities.indexOf(max) ? item.rarity : max;
        }, 'common'),
        enemies_defeated: num_enemies,
      },
    });
  } catch (error) {
    console.error('Loot generation error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
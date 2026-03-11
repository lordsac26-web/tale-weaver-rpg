/**
 * Procedural Loot Generation Engine
 * Creates unique items based on creature CR, type, and rarity tiers.
 * Generates custom names, descriptions, stat bonuses, and enchantments.
 */

import { MAGIC_PROPERTIES } from './itemData';

// ─── Name Generation Parts ──────────────────────────────────────────────────

const PREFIXES_BY_RARITY = {
  common:    ['Battered', 'Worn', 'Simple', 'Crude', 'Rusty', 'Plain', 'Ordinary', 'Tarnished'],
  uncommon:  ['Fine', 'Sturdy', 'Tempered', 'Polished', 'Reinforced', 'Keen', 'Well-Crafted', 'Gleaming'],
  rare:      ['Enchanted', 'Arcane', 'Blessed', 'Runic', 'Masterwork', 'Dwarven', 'Elven', 'Forged'],
  very_rare: ['Mythic', 'Ancient', 'Celestial', 'Infernal', 'Primordial', 'Astral', 'Shadowforged', 'Dragonforged'],
  legendary: ['Legendary', 'Divine', 'Godforged', 'World-Ender', 'Eternal', 'Titan\'s', 'Archon\'s', 'Epoch'],
};

const SUFFIXES_BY_TYPE = {
  weapon: {
    fire: ['of Flames', 'of the Inferno', 'of Scorching', 'the Ember Blade', 'of Cinders'],
    cold: ['of Frost', 'of the Glacier', 'of Winter', 'the Ice Fang', 'of Permafrost'],
    lightning: ['of Thunder', 'of the Storm', 'of Lightning', 'the Spark', 'of Tempests'],
    necrotic: ['of Withering', 'of the Grave', 'of Soul Rend', 'the Deathkiss', 'of Blight'],
    radiant: ['of Radiance', 'of Dawn', 'of the Sun', 'the Holy Avenger', 'of Brilliance'],
    poison: ['of Venom', 'of the Serpent', 'of Toxin', 'the Fangbite', 'of Bane'],
    force: ['of Force', 'of the Arcane', 'of Shattering', 'the Mindbreaker', 'of Ruin'],
    generic: ['of Might', 'of the Champion', 'of Valor', 'of the Warrior', 'of Glory'],
  },
  armor: {
    fire: ['of Fireward', 'of the Salamander', 'of Embers', 'the Ashen Bulwark'],
    cold: ['of Frostguard', 'of the Tundra', 'of Rime', 'the Frozen Bastion'],
    generic: ['of Protection', 'of the Sentinel', 'of Fortitude', 'of Warding', 'of the Aegis'],
  },
  accessory: {
    generic: ['of Insight', 'of the Seer', 'of Power', 'of Cunning', 'of the Archmage', 'of Fortune'],
  },
};

const WEAPON_BASES = [
  { name: 'Longsword', icon: '⚔️', damage_dice: '1d8', damage_type: 'slashing', weight: 3 },
  { name: 'Shortsword', icon: '🗡️', damage_dice: '1d6', damage_type: 'piercing', weight: 2 },
  { name: 'Greataxe', icon: '🪓', damage_dice: '1d12', damage_type: 'slashing', weight: 7 },
  { name: 'Warhammer', icon: '🔨', damage_dice: '1d8', damage_type: 'bludgeoning', weight: 5 },
  { name: 'Rapier', icon: '🤺', damage_dice: '1d8', damage_type: 'piercing', weight: 2 },
  { name: 'Dagger', icon: '🗡️', damage_dice: '1d4', damage_type: 'piercing', weight: 1 },
  { name: 'Staff', icon: '🪄', damage_dice: '1d6', damage_type: 'bludgeoning', weight: 4 },
  { name: 'Bow', icon: '🏹', damage_dice: '1d8', damage_type: 'piercing', weight: 2 },
  { name: 'Crossbow', icon: '🏹', damage_dice: '1d10', damage_type: 'piercing', weight: 6 },
  { name: 'Mace', icon: '🔱', damage_dice: '1d6', damage_type: 'bludgeoning', weight: 4 },
  { name: 'Spear', icon: '🔱', damage_dice: '1d6', damage_type: 'piercing', weight: 3 },
  { name: 'Flail', icon: '⚔️', damage_dice: '1d8', damage_type: 'bludgeoning', weight: 4 },
];

const ARMOR_BASES = [
  { name: 'Leather Armor', icon: '🥋', armor_class: 11, armor_type: 'light', weight: 10 },
  { name: 'Studded Leather', icon: '🥋', armor_class: 12, armor_type: 'light', weight: 13 },
  { name: 'Chain Shirt', icon: '🛡️', armor_class: 13, armor_type: 'medium', weight: 20 },
  { name: 'Scale Mail', icon: '🛡️', armor_class: 14, armor_type: 'medium', weight: 45 },
  { name: 'Breastplate', icon: '🛡️', armor_class: 14, armor_type: 'medium', weight: 20 },
  { name: 'Half Plate', icon: '🛡️', armor_class: 15, armor_type: 'medium', weight: 40 },
  { name: 'Chain Mail', icon: '⛑️', armor_class: 16, armor_type: 'heavy', weight: 55 },
  { name: 'Plate', icon: '⛑️', armor_class: 18, armor_type: 'heavy', weight: 65 },
  { name: 'Shield', icon: '🛡️', armor_class: 2, armor_type: 'shield', weight: 6 },
];

const ACCESSORY_BASES = [
  { name: 'Ring', icon: '💍', category: 'Ring', equip_slot: 'ring', weight: 0 },
  { name: 'Amulet', icon: '📿', category: 'Amulet', equip_slot: 'amulet', weight: 0 },
  { name: 'Circlet', icon: '👑', category: 'Helmet', equip_slot: 'helmet', weight: 1 },
  { name: 'Cloak', icon: '🧥', category: 'Cloak', equip_slot: 'cloak', weight: 1 },
  { name: 'Bracers', icon: '🧤', category: 'Gloves', equip_slot: 'gloves', weight: 1 },
  { name: 'Belt', icon: '🔗', category: 'Belt', equip_slot: 'belt', weight: 1 },
  { name: 'Boots', icon: '👢', category: 'Boots', equip_slot: 'boots', weight: 2 },
];

// ─── Element by enemy type ──────────────────────────────────────────────────

const ENEMY_ELEMENT_MAP = {
  Undead: 'necrotic', Fiend: 'fire', Fey: 'force', Dragon: 'fire',
  Elemental: 'lightning', Aberration: 'force', Beast: 'generic',
  Humanoid: 'generic', Construct: 'force', Celestial: 'radiant',
  Monstrosity: 'poison', Plant: 'poison', Ooze: 'poison',
};

// ─── Rarity from CR ─────────────────────────────────────────────────────────

function rarityFromCR(cr) {
  const r = Math.random();
  if (cr >= 17) {
    if (r < 0.05) return 'legendary';
    if (r < 0.20) return 'very_rare';
    if (r < 0.50) return 'rare';
    return 'uncommon';
  }
  if (cr >= 11) {
    if (r < 0.02) return 'legendary';
    if (r < 0.10) return 'very_rare';
    if (r < 0.35) return 'rare';
    if (r < 0.70) return 'uncommon';
    return 'common';
  }
  if (cr >= 5) {
    if (r < 0.01) return 'very_rare';
    if (r < 0.10) return 'rare';
    if (r < 0.40) return 'uncommon';
    return 'common';
  }
  if (cr >= 2) {
    if (r < 0.05) return 'rare';
    if (r < 0.25) return 'uncommon';
    return 'common';
  }
  if (r < 0.10) return 'uncommon';
  return 'common';
}

// ─── Enchantment selection ──────────────────────────────────────────────────

const WEAPON_ENCHANTMENTS = {
  common: [],
  uncommon: ['+1_weapon'],
  rare: ['+1_weapon', 'flaming', 'frost', 'shock', 'venom', 'radiant_burst', 'soul_drain'],
  very_rare: ['+2_weapon', 'flaming', 'frost', 'shock', 'thunderstrike', 'radiant_burst', 'soul_drain'],
  legendary: ['+3_weapon', 'vorpal', 'sharpness', 'thunderstrike', 'radiant_burst'],
};

const ARMOR_ENCHANTMENTS = {
  common: [],
  uncommon: ['mithral'],
  rare: ['+1_armor', 'resistance_fire', 'resistance_cold', 'resistance_lightning', 'adamantine'],
  very_rare: ['+2_armor', 'resistance_fire', 'resistance_cold', 'resistance_poison', 'adamantine'],
  legendary: ['+3_armor', 'resistance_fire', 'resistance_cold', 'adamantine'],
};

const ACCESSORY_ENCHANTMENTS = {
  common: [],
  uncommon: ['darkvision', 'str_plus1', 'dex_plus1', 'con_plus1'],
  rare: ['saving_throw_plus1', 'spellcasting_plus1', 'concentration_adv', 'featherfall', 'luck'],
  very_rare: ['saving_throw_plus2', 'spellcasting_plus2', 'regeneration', 'true_sight', 'free_action'],
  legendary: ['saving_throw_plus2', 'spellcasting_plus2', 'regeneration', 'str_of_giant', 'con_19'],
};

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function getEnchantments(itemType, rarity, element) {
  const pool = itemType === 'weapon' ? WEAPON_ENCHANTMENTS
    : itemType === 'armor' ? ARMOR_ENCHANTMENTS
    : ACCESSORY_ENCHANTMENTS;
  const available = pool[rarity] || [];
  if (available.length === 0) return [];

  // Pick 1 enchantment, rare+ may get 2
  const count = (rarity === 'very_rare' || rarity === 'legendary') && Math.random() < 0.3 ? 2 : 1;
  const chosen = new Set();
  for (let i = 0; i < count && i < available.length; i++) {
    let pick_val = pick(available);
    let tries = 0;
    while (chosen.has(pick_val) && tries < 5) { pick_val = pick(available); tries++; }
    chosen.add(pick_val);
  }

  // Add element-themed enchant for weapons
  if (itemType === 'weapon' && element && element !== 'generic' && rarity !== 'common') {
    const eleMap = { fire: 'flaming', cold: 'frost', lightning: 'shock', necrotic: 'soul_drain', radiant: 'radiant_burst', poison: 'venom' };
    if (eleMap[element] && Math.random() < 0.4) chosen.add(eleMap[element]);
  }
  return [...chosen];
}

// ─── Description Generation ─────────────────────────────────────────────────

const DESC_TEMPLATES = {
  weapon: {
    common: [
      'A standard {base} showing signs of use. Serviceable but unremarkable.',
      'This {base} has seen better days, but still holds an edge.',
      'A basic {base} of simple construction.',
    ],
    uncommon: [
      'A well-crafted {base} with {element} runes etched along the blade.',
      'This {base} hums with faint magical energy when drawn.',
      'Forged with uncommon skill, this {base} feels perfectly balanced.',
    ],
    rare: [
      'An exquisite {base} that radiates {element} energy. The air crackles when it\'s swung.',
      'Ancient runes of power spiral along this {base}. It whispers promises of victory.',
      'This masterwork {base} was clearly forged by a legendary artisan. {element} magic pulses through it.',
    ],
    very_rare: [
      'This {base} was forged in the heart of a dying star. {element} energy courses through every atom.',
      'Legends speak of this {base} — it has tasted the blood of gods and demons alike.',
      'A weapon of terrible beauty, this {base} bends reality around its edge.',
    ],
    legendary: [
      'This {base} exists between planes of reality. To wield it is to command {element} itself.',
      'Forged at the dawn of creation, this {base} has shaped the fate of empires.',
      'The mere presence of this {base} causes the air to shimmer with {element} force.',
    ],
  },
  armor: {
    common: ['Basic {base} offering standard protection.', 'Functional {base} with minor scuffs.'],
    uncommon: ['Well-maintained {base} with reinforced joints.', 'This {base} gleams with a subtle magical sheen.'],
    rare: ['This {base} is inscribed with protective wards. It feels lighter than it should.', 'Masterfully crafted {base} infused with arcane defenses.'],
    very_rare: ['This {base} shifts and adapts to threats. Ancient magic protects the wearer.', 'Forged from otherworldly materials, this {base} is nearly indestructible.'],
    legendary: ['This {base} was worn by a legendary hero. It radiates divine protection.', 'Reality itself bends around this {base}, deflecting blows before they land.'],
  },
  accessory: {
    common: ['A simple {base} of modest quality.', 'An ordinary {base} with no notable features.'],
    uncommon: ['This {base} pulses with faint magical energy.', 'Subtle enchantments are woven into this {base}.'],
    rare: ['Powerful magic is bound within this {base}. It seems to respond to your will.', 'This {base} radiates an aura of power.'],
    very_rare: ['This {base} was crafted by an archmage. Reality warps subtly around it.', 'Ancient and powerful, this {base} hums with barely-contained energy.'],
    legendary: ['A relic of immense power. This {base} could shift the balance of the world.', 'This {base} exists partially outside of time. Its power is beyond mortal comprehension.'],
  },
};

function generateDescription(itemType, rarity, baseName, element) {
  const templates = DESC_TEMPLATES[itemType]?.[rarity] || DESC_TEMPLATES[itemType]?.common || ['A {base}.'];
  const template = pick(templates);
  return template.replace(/{base}/g, baseName.toLowerCase()).replace(/{element}/g, element || 'magical');
}

// ─── Stat Bonus Calculation ─────────────────────────────────────────────────

function computeModifiers(itemType, rarity, enchantments, base) {
  const mods = {};
  if (itemType === 'weapon') {
    mods.damage_dice = base.damage_dice;
    let atkBonus = 0, dmgBonus = 0;
    enchantments.forEach(e => {
      const prop = MAGIC_PROPERTIES[e];
      if (prop?.effect?.attack_bonus) atkBonus += prop.effect.attack_bonus;
      if (prop?.effect?.damage_bonus) dmgBonus += prop.effect.damage_bonus;
    });
    if (atkBonus) mods.attack_bonus = atkBonus;
    if (dmgBonus) mods.damage_bonus = dmgBonus;
  } else if (itemType === 'armor') {
    mods.armor_class = base.armor_class;
    enchantments.forEach(e => {
      const prop = MAGIC_PROPERTIES[e];
      if (prop?.effect?.ac_bonus) mods.armor_class += prop.effect.ac_bonus;
    });
  }
  // stat bonuses from enchantments
  enchantments.forEach(e => {
    const prop = MAGIC_PROPERTIES[e];
    if (prop?.effect?.stat_bonus) {
      Object.entries(prop.effect.stat_bonus).forEach(([k, v]) => { mods[k] = (mods[k] || 0) + v; });
    }
    if (prop?.effect?.save_bonus) mods.save_bonus = (mods.save_bonus || 0) + prop.effect.save_bonus;
  });
  return mods;
}

// ─── Price Calculation ──────────────────────────────────────────────────────

const BASE_PRICES = { common: 15, uncommon: 100, rare: 500, very_rare: 2500, legendary: 10000 };

function computePrice(rarity, enchantments) {
  let price = BASE_PRICES[rarity] || 15;
  price += enchantments.length * (BASE_PRICES[rarity] * 0.3);
  price = Math.floor(price * (0.8 + Math.random() * 0.4)); // ±20% variance
  return price;
}

// ─── Main Generator ─────────────────────────────────────────────────────────

/**
 * Generate a single procedural item based on creature CR and type.
 * @param {number} cr - Challenge rating of the source creature
 * @param {string} enemyType - Type: Undead, Beast, Humanoid, Dragon, etc.
 * @param {string} enemyName - Name of the source enemy
 * @returns {object} A fully-formed item object ready for inventory
 */
export function generateProceduralItem(cr, enemyType, enemyName) {
  const rarity = rarityFromCR(cr);
  const element = ENEMY_ELEMENT_MAP[enemyType] || 'generic';

  // Choose item type weighted by CR
  const typeRoll = Math.random();
  const itemType = typeRoll < 0.45 ? 'weapon' : typeRoll < 0.75 ? 'armor' : 'accessory';

  let base, category, equipSlot;
  if (itemType === 'weapon') {
    base = pick(WEAPON_BASES);
    category = 'Weapon';
    equipSlot = 'mainhand';
  } else if (itemType === 'armor') {
    base = pick(ARMOR_BASES);
    category = base.armor_type === 'shield' ? 'Shield' : 'Armor';
    equipSlot = base.armor_type === 'shield' ? 'offhand' : 'armor';
  } else {
    base = pick(ACCESSORY_BASES);
    category = base.category;
    equipSlot = base.equip_slot;
  }

  // Generate enchantments
  const enchantments = getEnchantments(itemType, rarity, element);
  const requiresAttunement = rarity === 'rare' || rarity === 'very_rare' || rarity === 'legendary';

  // Generate name
  const prefix = pick(PREFIXES_BY_RARITY[rarity] || PREFIXES_BY_RARITY.common);
  const suffixPool = SUFFIXES_BY_TYPE[itemType]?.[element] || SUFFIXES_BY_TYPE[itemType]?.generic || [''];
  const suffix = enchantments.length > 0 ? pick(suffixPool) : '';
  const itemName = `${prefix} ${base.name}${suffix ? ' ' + suffix : ''}`;

  // Generate description
  const description = generateDescription(itemType, rarity, base.name, element);

  // Compute modifiers
  const modifiers = computeModifiers(itemType, rarity, enchantments, base);

  // Compute price
  const basePrice = computePrice(rarity, enchantments);

  return {
    name: itemName,
    icon: base.icon,
    category,
    equip_slot: equipSlot,
    rarity,
    requires_attunement: requiresAttunement,
    description,
    base_price: basePrice,
    weight: base.weight || 0,
    modifiers,
    magic_properties: enchantments,
    is_magic: enchantments.length > 0,
    is_procedural: true,
    source_enemy: enemyName,
    damage: base.damage_dice || null,
    damage_type: base.damage_type || null,
    armor_class: base.armor_class || null,
    armor_type: base.armor_type || null,
    quantity: 1,
  };
}

/**
 * Generate a full loot drop for an encounter.
 * Mixes procedural items with the existing type-based loot tables.
 * @param {Array} enemies - Array of {name, type, cr} objects
 * @returns {object} { items: [], gold, silver, copper }
 */
export function generateEncounterLoot(enemies) {
  const allItems = [];
  let totalGold = 0, totalSilver = 0, totalCopper = 0;

  const enemyList = enemies?.length > 0 ? enemies : [{ name: 'Unknown', type: 'Humanoid', cr: 1 }];

  enemyList.forEach(enemy => {
    const cr = parseFloat(enemy.cr || enemy.challenge) || 1;
    const type = enemy.type || 'Humanoid';

    // Each enemy has a chance to drop a procedural item (higher CR = higher chance)
    const proceduralChance = Math.min(0.15 + cr * 0.05, 0.85);
    if (Math.random() < proceduralChance) {
      allItems.push(generateProceduralItem(cr, type, enemy.name));
    }

    // Additional procedural items for high CR
    if (cr >= 10 && Math.random() < 0.4) {
      allItems.push(generateProceduralItem(cr, type, enemy.name));
    }

    // Coins scale with CR
    const coinMult = { Undead: 0.6, Beast: 0.3, Humanoid: 1.2, Dragon: 3.0, Fiend: 0.8, Fey: 0.5, Construct: 0.4, Aberration: 0.5, Elemental: 0.3 }[type] || 1.0;
    totalGold   += Math.floor((cr * 5  + Math.random() * cr * 3)  * coinMult);
    totalSilver += Math.floor((cr * 8  + Math.random() * cr * 5)  * coinMult);
    totalCopper += Math.floor((cr * 12 + Math.random() * cr * 8)  * coinMult);
  });

  // Deduplicate by name
  const seen = new Set();
  const unique = allItems.filter(it => {
    if (seen.has(it.name)) return false;
    seen.add(it.name);
    return true;
  });

  return { items: unique, gold: totalGold, silver: totalSilver, copper: totalCopper };
}
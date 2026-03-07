// Enemy-type specific loot tables for distinct, thematic drops

export const ENEMY_TYPE_LOOT = {
  // Undead drop necrotic/cursed items, bones, dark essences
  Undead: {
    flavor_prefix: "From the crumbling remains",
    coin_multiplier: 0.6,
    items: [
      { name: "Bone Shard", icon: "🦴", category: "material", rarity: "common", description: "A sharp fragment of bone. Useful for certain rituals.", base_price: 2 },
      { name: "Tattered Soul Cloth", icon: "🧣", category: "clothing", rarity: "common", description: "Rotted fabric suffused with necrotic energy.", base_price: 3 },
      { name: "Grave Dust", icon: "✨", category: "material", rarity: "common", description: "Dust from a restless grave. Alchemists prize it.", base_price: 5 },
      { name: "Cursed Amulet", icon: "📿", category: "accessory", rarity: "uncommon", description: "A dark amulet. Something feels wrong about wearing it.", base_price: 25, modifiers: { charisma: -1 }, requires_identification: true },
      { name: "Death Knight's Helm Fragment", icon: "⛑️", category: "armor", rarity: "uncommon", description: "A cracked piece of spectral plate armor.", base_price: 40, modifiers: { armor_class: 1 } },
      { name: "Phylactery Shard", icon: "💎", category: "magical", rarity: "rare", description: "A fragment of a lich's phylactery. Radiates cold energy.", base_price: 150 },
      { name: "Wand of Withering", icon: "🪄", category: "weapon", rarity: "rare", description: "Deals necrotic damage. 3 charges, regains 1d3 at dawn.", base_price: 200 },
    ],
    weights: [40, 30, 20, 5, 3, 1.5, 0.5],
  },

  // Beasts drop pelts, claws, fangs, natural materials
  Beast: {
    flavor_prefix: "Harvested from the beast's carcass",
    coin_multiplier: 0.3,
    items: [
      { name: "Beast Pelt", icon: "🧶", category: "material", rarity: "common", description: "A rough but sturdy animal hide. Useful for crafting.", base_price: 4 },
      { name: "Sharp Claw", icon: "🦅", category: "material", rarity: "common", description: "A large predator claw. Could be fashioned into a blade.", base_price: 3 },
      { name: "Thick Hide Scraps", icon: "🛡️", category: "material", rarity: "common", description: "Pieces of tough hide that could reinforce armor.", base_price: 6 },
      { name: "Venomous Fang", icon: "🐍", category: "material", rarity: "uncommon", description: "A hollow fang still dripping with venom. (DC 14 Constitution save or 2d6 poison)", base_price: 30 },
      { name: "Alpha Hide Armor", icon: "🥋", category: "armor", rarity: "uncommon", description: "Armor crafted from the hide of an apex predator. AC 12 + DEX.", base_price: 60, modifiers: { armor_class: 12 } },
      { name: "Predator's Eye", icon: "👁️", category: "magical", rarity: "rare", description: "Grants Advantage on Perception checks. Attunement required.", base_price: 120, requires_attunement: true },
      { name: "Manticore Spine Dagger", icon: "🗡️", category: "weapon", rarity: "rare", description: "+1 dagger. On a critical hit, target must save vs. paralysis.", base_price: 250 },
    ],
    weights: [35, 30, 20, 8, 4, 2, 1],
  },

  // Humanoids drop coins, gear, mundane equipment
  Humanoid: {
    flavor_prefix: "Looted from the fallen warrior",
    coin_multiplier: 1.2,
    items: [
      { name: "Soldier's Rations", icon: "🍖", category: "consumable", rarity: "common", description: "A day's worth of hard tack and dried meat.", base_price: 1 },
      { name: "Iron Dagger", icon: "🗡️", category: "weapon", rarity: "common", description: "A standard-issue iron dagger. Damage: 1d4 piercing.", base_price: 5, modifiers: { damage_dice: "1d4" } },
      { name: "Leather Armor", icon: "🥋", category: "armor", rarity: "common", description: "Worn but functional leather armor. AC 11 + DEX.", base_price: 10, modifiers: { armor_class: 11 } },
      { name: "Bandit Captain's Shortsword", icon: "⚔️", category: "weapon", rarity: "uncommon", description: "A well-balanced shortsword. Damage: 1d6+1 piercing.", base_price: 50, modifiers: { damage_dice: "1d6", attack_bonus: 1 } },
      { name: "Chain Shirt", icon: "🛡️", category: "armor", rarity: "uncommon", description: "Interlocked metal rings. AC 13 + DEX (max 2).", base_price: 50, modifiers: { armor_class: 13 } },
      { name: "Potion of Healing", icon: "🧪", category: "consumable", rarity: "uncommon", description: "Restores 2d4+2 hit points when consumed.", base_price: 50 },
      { name: "Ring of Protection", icon: "💍", category: "accessory", rarity: "rare", description: "+1 AC and +1 to all saving throws. Requires attunement.", base_price: 300, modifiers: { armor_class: 1 }, requires_attunement: true },
    ],
    weights: [30, 25, 20, 10, 8, 5, 2],
  },

  // Dragons drop scales, hoarded treasure, draconic items
  Dragon: {
    flavor_prefix: "From the dragon's hoard",
    coin_multiplier: 3.0,
    items: [
      { name: "Dragon Scale", icon: "🐉", category: "material", rarity: "uncommon", description: "A single iridescent scale. Highly valued by armorers.", base_price: 60 },
      { name: "Dragon Tooth", icon: "🦷", category: "material", rarity: "uncommon", description: "Razor-sharp and magically dense. Could be carved into a blade.", base_price: 80 },
      { name: "Breath Vial", icon: "⚗️", category: "consumable", rarity: "uncommon", description: "A bottled sample of dragon breath. Throw for 3d6 elemental damage in a 15ft cone (DC 14 DEX).", base_price: 120 },
      { name: "Dragonscale Shield", icon: "🛡️", category: "armor", rarity: "rare", description: "A shield crafted from dragon scales. AC +2, resistance to the dragon's damage type.", base_price: 400, modifiers: { armor_class: 2 } },
      { name: "Dragon-forged Longsword", icon: "⚔️", category: "weapon", rarity: "rare", description: "+2 longsword. Deals an extra 1d6 elemental damage matching the dragon's type.", base_price: 500, modifiers: { damage_dice: "1d8", attack_bonus: 2 } },
      { name: "Amulet of Dragon Sight", icon: "📿", category: "accessory", rarity: "very_rare", description: "Darkvision 120ft. Advantage on saving throws vs. dragon breath.", base_price: 800, requires_attunement: true },
      { name: "Scales of the Wyrm Armor", icon: "🥋", category: "armor", rarity: "legendary", description: "Full suit of dragon plate. AC 18. Resistance to the attuned dragon's damage type.", base_price: 2000, modifiers: { armor_class: 18 }, requires_attunement: true },
    ],
    weights: [30, 25, 20, 12, 8, 4, 1],
  },

  // Fiends drop infernal materials, dark contracts, cursed items
  Fiend: {
    flavor_prefix: "Recovered from the fiend's ashes",
    coin_multiplier: 0.8,
    items: [
      { name: "Brimstone Shard", icon: "🔴", category: "material", rarity: "common", description: "A fragment of hellfire-hardened rock. Alchemists use it in fire-based potions.", base_price: 8 },
      { name: "Infernal Contract Fragment", icon: "📜", category: "document", rarity: "uncommon", description: "A torn piece of a soul-binding contract. Scholars would pay well for this.", base_price: 40 },
      { name: "Hellfire Oil", icon: "🧪", category: "consumable", rarity: "uncommon", description: "Coat a weapon. Next hit deals an extra 2d6 fire damage. Single use.", base_price: 65 },
      { name: "Barbed Devil Spine", icon: "🌵", category: "weapon", rarity: "uncommon", description: "+1 dagger. On a hit, the target takes 1d4 piercing damage at the start of each of its turns until it uses an action to remove the barb.", base_price: 85, modifiers: { attack_bonus: 1 } },
      { name: "Fiendish Plate Shard", icon: "⛑️", category: "armor", rarity: "rare", description: "A fragment of a devil's natural armor. Can be added to existing heavy armor for +1 AC.", base_price: 250, modifiers: { armor_class: 1 } },
      { name: "Staff of the Lower Planes", icon: "🪄", category: "weapon", rarity: "rare", description: "Casts Fireball (3rd level) 1/day, Inflict Wounds (3d10) 1/day. 10 charges total.", base_price: 600, modifiers: { attack_bonus: 1 } },
      { name: "Infernal Ring of Command", icon: "💍", category: "accessory", rarity: "very_rare", description: "Cast Dominate Person 1/day (DC 17). Requires attunement. A faint whispering follows the wearer.", base_price: 1200, requires_attunement: true },
    ],
    weights: [30, 25, 20, 12, 8, 4, 1],
  },

  // Fey drop magical trinkets, nature items, glamour objects
  Fey: {
    flavor_prefix: "Left behind as the fey magic fades",
    coin_multiplier: 0.5,
    items: [
      { name: "Glimmerdust Pouch", icon: "✨", category: "material", rarity: "common", description: "A pinch of faerie dust. Throw to impose Disadvantage on one creature's next saving throw.", base_price: 15 },
      { name: "Pixie Wing Fragment", icon: "🦋", category: "material", rarity: "common", description: "A shimmering wing shard. Used in illusion spells and potions.", base_price: 12 },
      { name: "Enchanted Acorn", icon: "🌰", category: "consumable", rarity: "uncommon", description: "Plant it to instantly grow a fully-formed tree. Or eat it for 1d6+2 temp HP.", base_price: 30 },
      { name: "Glamour Cloak", icon: "🧥", category: "armor", rarity: "uncommon", description: "When you take the Hide action, you can cast Minor Illusion for free.", base_price: 100, modifiers: { armor_class: 0 } },
      { name: "Fey Step Ring", icon: "💍", category: "accessory", rarity: "rare", description: "Teleport up to 30ft to a visible location as a bonus action. 1/short rest.", base_price: 350, requires_attunement: true },
      { name: "Wand of Wonder", icon: "🪄", category: "weapon", rarity: "rare", description: "Roll 1d100 on the Wand of Wonder table when activated. Chaotic, unpredictable magic. 7 charges.", base_price: 400 },
      { name: "Titania's Blessing Circlet", icon: "👑", category: "accessory", rarity: "legendary", description: "+2 CHA, +2 WIS. Immune to the charmed condition. You can speak with any creature.", base_price: 3000, modifiers: { charisma: 2, wisdom: 2 }, requires_attunement: true },
    ],
    weights: [30, 25, 20, 12, 8, 4, 1],
  },

  // Constructs drop mechanical parts, arcane components
  Construct: {
    flavor_prefix: "Salvaged from the wreckage",
    coin_multiplier: 0.4,
    items: [
      { name: "Gear Assembly", icon: "⚙️", category: "material", rarity: "common", description: "Precision-machined bronze gears. Useful for repairs or crafting.", base_price: 5 },
      { name: "Arcane Power Core", icon: "💠", category: "material", rarity: "uncommon", description: "A pulsing gem that stores magical energy. Powers mechanical devices.", base_price: 45 },
      { name: "Adamantine Plating", icon: "🛡️", category: "material", rarity: "uncommon", description: "Near-indestructible metal plates. Can be attached to armor for +1 AC vs. bludgeoning.", base_price: 80, modifiers: { armor_class: 1 } },
      { name: "Golem Fist Gauntlet", icon: "🥊", category: "armor", rarity: "uncommon", description: "A massive mechanical gauntlet. Unarmed strikes deal 1d8 bludgeoning.", base_price: 120, modifiers: { damage_dice: "1d8" } },
      { name: "Arcane Turret Module", icon: "🔫", category: "weapon", rarity: "rare", description: "+1 heavy crossbow. Can fire twice per turn. Requires attunement.", base_price: 400, modifiers: { attack_bonus: 1 }, requires_attunement: true },
      { name: "Guardian Automaton Eye", icon: "👁️", category: "magical", rarity: "rare", description: "Truesight 30ft. Can detect invisible creatures and illusions. Implant or mount.", base_price: 550, requires_attunement: true },
      { name: "Apparatus Core: Invincibility Mode", icon: "🤖", category: "magical", rarity: "legendary", description: "When your HP drops to 0, this core activates: you regain 50 HP. 1/week.", base_price: 5000, requires_attunement: true },
    ],
    weights: [30, 25, 20, 12, 8, 4, 1],
  },

  // Aberrations drop alien/eldrich components
  Aberration: {
    flavor_prefix: "Torn from the aberration's alien form",
    coin_multiplier: 0.5,
    items: [
      { name: "Mindflayer Tentacle", icon: "🐙", category: "material", rarity: "common", description: "Still twitching. Alchemists use it for Potions of Mind Reading.", base_price: 10 },
      { name: "Beholder Eye Stalk", icon: "👁️", category: "material", rarity: "uncommon", description: "A preserved eye that still crackles with magical energy.", base_price: 55 },
      { name: "Psychic Dampening Crystal", icon: "💎", category: "accessory", rarity: "uncommon", description: "Advantage on saving throws against psychic damage and the charmed/frightened conditions.", base_price: 90 },
      { name: "Far Realm Lens", icon: "🔭", category: "accessory", rarity: "rare", description: "Truesight 60ft. Once per day, cast Detect Thoughts (DC 15). Requires attunement.", base_price: 380, requires_attunement: true },
      { name: "Tentacle Whip", icon: "⚡", category: "weapon", rarity: "rare", description: "+1 whip. Grapple attempt on hit (DC 13 STR). Reach 15ft.", base_price: 300, modifiers: { attack_bonus: 1 } },
      { name: "Mindshield Helm", icon: "⛑️", category: "armor", rarity: "very_rare", description: "Immunity to psychic damage. Any creature that tries to read your mind takes 4d6 psychic damage.", base_price: 900, requires_attunement: true },
      { name: "Elder Brain Conduit", icon: "🧠", category: "magical", rarity: "legendary", description: "Cast Dominate Monster 1/day. Telepathy 120ft. Attunement warps your appearance slightly.", base_price: 6000, requires_attunement: true },
    ],
    weights: [30, 25, 20, 12, 8, 4, 1],
  },

  // Elemental — based on element, drop energy cores and elemental materials
  Elemental: {
    flavor_prefix: "Condensed from the elemental's essence",
    coin_multiplier: 0.3,
    items: [
      { name: "Elemental Spark", icon: "⚡", category: "material", rarity: "common", description: "A bottled mote of elemental energy. Used in crafting elemental weapons.", base_price: 12 },
      { name: "Elemental Core Shard", icon: "💠", category: "material", rarity: "uncommon", description: "A dense fragment of elemental power. Radiates energy.", base_price: 50 },
      { name: "Elemental Resistance Charm", icon: "📿", category: "accessory", rarity: "uncommon", description: "Resistance to one elemental damage type (determined by the source elemental).", base_price: 100 },
      { name: "Elemental Infused Weapon", icon: "⚔️", category: "weapon", rarity: "rare", description: "+1 weapon that deals an extra 1d6 elemental damage on hit (matching source element).", base_price: 400, modifiers: { attack_bonus: 1 } },
      { name: "Cloak of the Elements", icon: "🧥", category: "armor", rarity: "rare", description: "Resistance to fire, cold, lightning, and thunder damage. Requires attunement.", base_price: 750, requires_attunement: true },
      { name: "Elemental Tome", icon: "📖", category: "magical", rarity: "very_rare", description: "Learn two additional elemental spells of 4th level or lower. They become always prepared.", base_price: 1100 },
      { name: "Heart of the Plane", icon: "❤️", category: "magical", rarity: "legendary", description: "Immunity to one elemental damage type. Spells of that type are cast at +2 levels.", base_price: 8000, requires_attunement: true },
    ],
    weights: [30, 25, 20, 12, 8, 4, 1],
  },
};

// Default fallback loot table for generic/unknown enemy types
export const GENERIC_LOOT = {
  flavor_prefix: "Among the remains",
  coin_multiplier: 1.0,
  items: [
    { name: "Adventurer's Pack", icon: "🎒", category: "general", rarity: "common", description: "Miscellaneous adventuring supplies.", base_price: 5 },
    { name: "Healing Salve", icon: "🧪", category: "consumable", rarity: "common", description: "Apply to a wound to regain 1d4 HP.", base_price: 8 },
    { name: "Mysterious Gemstone", icon: "💎", category: "gem", rarity: "uncommon", description: "A polished gem of unknown origin. Worth selling.", base_price: 50 },
    { name: "Battle-Worn Sword", icon: "⚔️", category: "weapon", rarity: "common", description: "A serviceable but nicked longsword. Damage: 1d8 slashing.", base_price: 15, modifiers: { damage_dice: "1d8" } },
    { name: "Potion of Healing", icon: "🧪", category: "consumable", rarity: "common", description: "Restores 2d4+2 HP when consumed.", base_price: 50 },
    { name: "Ring of Protection", icon: "💍", category: "accessory", rarity: "rare", description: "+1 to AC and saving throws. Requires attunement.", base_price: 300, modifiers: { armor_class: 1 }, requires_attunement: true },
    { name: "Cloak of Elvenkind", icon: "🧥", category: "armor", rarity: "rare", description: "Advantage on Stealth checks. Requires attunement.", base_price: 500, requires_attunement: true },
  ],
  weights: [30, 25, 20, 12, 8, 4, 1],
};

// Rarity display config — matches existing itemData patterns
export const LOOT_RARITY = {
  common:    { label: 'Common',    color: '#d1d5db', border: 'rgba(209,213,219,0.3)',  bg: 'rgba(50,50,60,0.5)',  glow: '' },
  uncommon:  { label: 'Uncommon',  color: '#4ade80', border: 'rgba(74,222,128,0.3)',  bg: 'rgba(15,45,20,0.5)',  glow: '0 0 10px rgba(74,222,128,0.15)' },
  rare:      { label: 'Rare',      color: '#60a5fa', border: 'rgba(96,165,250,0.35)', bg: 'rgba(10,30,55,0.55)', glow: '0 0 12px rgba(96,165,250,0.18)' },
  very_rare: { label: 'Very Rare', color: '#c084fc', border: 'rgba(192,132,252,0.4)', bg: 'rgba(40,10,70,0.55)', glow: '0 0 14px rgba(192,132,252,0.22)' },
  legendary: { label: 'Legendary', color: '#f59e0b', border: 'rgba(245,158,11,0.45)', bg: 'rgba(55,30,0,0.6)',  glow: '0 0 18px rgba(245,158,11,0.25)' },
};

/**
 * Select a random loot item from a table using weighted probability.
 */
function weightedRandom(items, weights) {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}

/**
 * Generate loot items for a single enemy based on its type and CR.
 * Returns an array of item objects.
 */
export function generateLootForEnemy(enemyName, enemyType, cr = 1) {
  const table = ENEMY_TYPE_LOOT[enemyType] || GENERIC_LOOT;
  const crNum = parseFloat(cr) || 1;

  // Number of items scales with CR
  const itemCount = crNum < 1 ? 0 : crNum <= 2 ? 1 : crNum <= 5 ? 2 : crNum <= 10 ? 3 : 4;

  const dropped = [];
  const usedIndices = new Set();

  for (let i = 0; i < itemCount; i++) {
    let item = weightedRandom(table.items, table.weights);
    // Avoid complete duplicates (allow at most one retry)
    if (usedIndices.has(item.name)) {
      item = weightedRandom(table.items, table.weights);
    }
    usedIndices.add(item.name);
    dropped.push({ ...item, source_enemy: enemyName, quantity: 1 });
  }

  return dropped;
}

/**
 * Generate coin amounts for an enemy based on CR and table multiplier.
 */
export function generateCoinsForEnemy(enemyType, cr = 1) {
  const table = ENEMY_TYPE_LOOT[enemyType] || GENERIC_LOOT;
  const crNum = parseFloat(cr) || 1;
  const mult = table.coin_multiplier;

  const baseGold   = Math.floor((crNum * 5  + Math.random() * crNum * 3)  * mult);
  const baseSilver = Math.floor((crNum * 8  + Math.random() * crNum * 5)  * mult);
  const baseCopper = Math.floor((crNum * 12 + Math.random() * crNum * 8)  * mult);

  return { gold: baseGold, silver: baseSilver, copper: baseCopper };
}
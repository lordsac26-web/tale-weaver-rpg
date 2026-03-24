/**
 * D&D 5E Standard (Non-Magic) Equipment Database
 * Weapons, Armor, Adventuring Gear, Tools, Packs per SRD/PHB
 */

// ─── Simple Melee Weapons ─────────────────────────────────────────────────────
export const SIMPLE_MELEE_WEAPONS = [
  { name: 'Club', category: 'Weapon', equip_slot: 'mainhand', damage: '1d4 bludgeoning', damage_type: 'bludgeoning', weight: 2, cost: 0.1, cost_unit: 'gp', properties: ['Light'], rarity: 'common', quantity: 1 },
  { name: 'Dagger', category: 'Weapon', equip_slot: 'mainhand', damage: '1d4 piercing', damage_type: 'piercing', weight: 1, cost: 2, cost_unit: 'gp', properties: ['Finesse', 'Light', 'Thrown'], rarity: 'common', quantity: 1 },
  { name: 'Greatclub', category: 'Weapon', equip_slot: 'mainhand', damage: '1d8 bludgeoning', damage_type: 'bludgeoning', weight: 10, cost: 0.2, cost_unit: 'gp', properties: ['Two-Handed'], rarity: 'common', quantity: 1 },
  { name: 'Handaxe', category: 'Weapon', equip_slot: 'mainhand', damage: '1d6 slashing', damage_type: 'slashing', weight: 2, cost: 5, cost_unit: 'gp', properties: ['Light', 'Thrown'], rarity: 'common', quantity: 1 },
  { name: 'Javelin', category: 'Weapon', equip_slot: 'mainhand', damage: '1d6 piercing', damage_type: 'piercing', weight: 2, cost: 0.5, cost_unit: 'gp', properties: ['Thrown'], rarity: 'common', quantity: 1 },
  { name: 'Light Hammer', category: 'Weapon', equip_slot: 'mainhand', damage: '1d4 bludgeoning', damage_type: 'bludgeoning', weight: 2, cost: 2, cost_unit: 'gp', properties: ['Light', 'Thrown'], rarity: 'common', quantity: 1 },
  { name: 'Mace', category: 'Weapon', equip_slot: 'mainhand', damage: '1d6 bludgeoning', damage_type: 'bludgeoning', weight: 4, cost: 5, cost_unit: 'gp', properties: [], rarity: 'common', quantity: 1 },
  { name: 'Quarterstaff', category: 'Weapon', equip_slot: 'mainhand', damage: '1d6 bludgeoning', damage_type: 'bludgeoning', weight: 4, cost: 0.2, cost_unit: 'gp', properties: ['Versatile'], rarity: 'common', quantity: 1 },
  { name: 'Sickle', category: 'Weapon', equip_slot: 'mainhand', damage: '1d4 slashing', damage_type: 'slashing', weight: 2, cost: 1, cost_unit: 'gp', properties: ['Light'], rarity: 'common', quantity: 1 },
  { name: 'Spear', category: 'Weapon', equip_slot: 'mainhand', damage: '1d6 piercing', damage_type: 'piercing', weight: 3, cost: 1, cost_unit: 'gp', properties: ['Thrown', 'Versatile'], rarity: 'common', quantity: 1 },
];

// ─── Martial Melee Weapons ────────────────────────────────────────────────────
export const MARTIAL_MELEE_WEAPONS = [
  { name: 'Battleaxe', category: 'Weapon', equip_slot: 'mainhand', damage: '1d8 slashing', damage_type: 'slashing', weight: 4, cost: 10, cost_unit: 'gp', properties: ['Versatile'], rarity: 'common', quantity: 1 },
  { name: 'Flail', category: 'Weapon', equip_slot: 'mainhand', damage: '1d8 bludgeoning', damage_type: 'bludgeoning', weight: 2, cost: 10, cost_unit: 'gp', properties: [], rarity: 'common', quantity: 1 },
  { name: 'Glaive', category: 'Weapon', equip_slot: 'mainhand', damage: '1d10 slashing', damage_type: 'slashing', weight: 6, cost: 20, cost_unit: 'gp', properties: ['Heavy', 'Reach', 'Two-Handed'], rarity: 'common', quantity: 1 },
  { name: 'Greataxe', category: 'Weapon', equip_slot: 'mainhand', damage: '1d12 slashing', damage_type: 'slashing', weight: 7, cost: 30, cost_unit: 'gp', properties: ['Heavy', 'Two-Handed'], rarity: 'common', quantity: 1 },
  { name: 'Greatsword', category: 'Weapon', equip_slot: 'mainhand', damage: '2d6 slashing', damage_type: 'slashing', weight: 6, cost: 50, cost_unit: 'gp', properties: ['Heavy', 'Two-Handed'], rarity: 'common', quantity: 1 },
  { name: 'Halberd', category: 'Weapon', equip_slot: 'mainhand', damage: '1d10 slashing', damage_type: 'slashing', weight: 6, cost: 20, cost_unit: 'gp', properties: ['Heavy', 'Reach', 'Two-Handed'], rarity: 'common', quantity: 1 },
  { name: 'Lance', category: 'Weapon', equip_slot: 'mainhand', damage: '1d12 piercing', damage_type: 'piercing', weight: 6, cost: 10, cost_unit: 'gp', properties: ['Reach', 'Special'], rarity: 'common', quantity: 1 },
  { name: 'Longsword', category: 'Weapon', equip_slot: 'mainhand', damage: '1d8 slashing', damage_type: 'slashing', weight: 3, cost: 15, cost_unit: 'gp', properties: ['Versatile'], rarity: 'common', quantity: 1 },
  { name: 'Maul', category: 'Weapon', equip_slot: 'mainhand', damage: '2d6 bludgeoning', damage_type: 'bludgeoning', weight: 10, cost: 10, cost_unit: 'gp', properties: ['Heavy', 'Two-Handed'], rarity: 'common', quantity: 1 },
  { name: 'Morningstar', category: 'Weapon', equip_slot: 'mainhand', damage: '1d8 piercing', damage_type: 'piercing', weight: 4, cost: 15, cost_unit: 'gp', properties: [], rarity: 'common', quantity: 1 },
  { name: 'Pike', category: 'Weapon', equip_slot: 'mainhand', damage: '1d10 piercing', damage_type: 'piercing', weight: 18, cost: 5, cost_unit: 'gp', properties: ['Heavy', 'Reach', 'Two-Handed'], rarity: 'common', quantity: 1 },
  { name: 'Rapier', category: 'Weapon', equip_slot: 'mainhand', damage: '1d8 piercing', damage_type: 'piercing', weight: 2, cost: 25, cost_unit: 'gp', properties: ['Finesse'], rarity: 'common', quantity: 1 },
  { name: 'Scimitar', category: 'Weapon', equip_slot: 'mainhand', damage: '1d6 slashing', damage_type: 'slashing', weight: 3, cost: 25, cost_unit: 'gp', properties: ['Finesse', 'Light'], rarity: 'common', quantity: 1 },
  { name: 'Shortsword', category: 'Weapon', equip_slot: 'mainhand', damage: '1d6 piercing', damage_type: 'piercing', weight: 2, cost: 10, cost_unit: 'gp', properties: ['Finesse', 'Light'], rarity: 'common', quantity: 1 },
  { name: 'Trident', category: 'Weapon', equip_slot: 'mainhand', damage: '1d6 piercing', damage_type: 'piercing', weight: 4, cost: 5, cost_unit: 'gp', properties: ['Thrown', 'Versatile'], rarity: 'common', quantity: 1 },
  { name: 'War Pick', category: 'Weapon', equip_slot: 'mainhand', damage: '1d8 piercing', damage_type: 'piercing', weight: 2, cost: 5, cost_unit: 'gp', properties: [], rarity: 'common', quantity: 1 },
  { name: 'Warhammer', category: 'Weapon', equip_slot: 'mainhand', damage: '1d8 bludgeoning', damage_type: 'bludgeoning', weight: 2, cost: 15, cost_unit: 'gp', properties: ['Versatile'], rarity: 'common', quantity: 1 },
  { name: 'Whip', category: 'Weapon', equip_slot: 'mainhand', damage: '1d4 slashing', damage_type: 'slashing', weight: 3, cost: 2, cost_unit: 'gp', properties: ['Finesse', 'Reach'], rarity: 'common', quantity: 1 },
];

// ─── Ranged Weapons ───────────────────────────────────────────────────────────
export const RANGED_WEAPONS = [
  { name: 'Light Crossbow', category: 'Weapon', equip_slot: 'mainhand', damage: '1d8 piercing', damage_type: 'piercing', type: 'ranged', weight: 5, cost: 25, cost_unit: 'gp', properties: ['Ammunition', 'Loading', 'Two-Handed'], rarity: 'common', quantity: 1 },
  { name: 'Shortbow', category: 'Weapon', equip_slot: 'mainhand', damage: '1d6 piercing', damage_type: 'piercing', type: 'ranged', weight: 2, cost: 25, cost_unit: 'gp', properties: ['Ammunition', 'Two-Handed'], rarity: 'common', quantity: 1 },
  { name: 'Longbow', category: 'Weapon', equip_slot: 'mainhand', damage: '1d8 piercing', damage_type: 'piercing', type: 'ranged', weight: 2, cost: 50, cost_unit: 'gp', properties: ['Ammunition', 'Heavy', 'Two-Handed'], rarity: 'common', quantity: 1 },
  { name: 'Heavy Crossbow', category: 'Weapon', equip_slot: 'mainhand', damage: '1d10 piercing', damage_type: 'piercing', type: 'ranged', weight: 18, cost: 50, cost_unit: 'gp', properties: ['Ammunition', 'Heavy', 'Loading', 'Two-Handed'], rarity: 'common', quantity: 1 },
  { name: 'Hand Crossbow', category: 'Weapon', equip_slot: 'mainhand', damage: '1d6 piercing', damage_type: 'piercing', type: 'ranged', weight: 3, cost: 75, cost_unit: 'gp', properties: ['Ammunition', 'Light', 'Loading'], rarity: 'common', quantity: 1 },
  { name: 'Dart', category: 'Weapon', equip_slot: 'mainhand', damage: '1d4 piercing', damage_type: 'piercing', type: 'ranged', weight: 0.25, cost: 0.05, cost_unit: 'gp', properties: ['Finesse', 'Thrown'], rarity: 'common', quantity: 10 },
  { name: 'Sling', category: 'Weapon', equip_slot: 'mainhand', damage: '1d4 bludgeoning', damage_type: 'bludgeoning', type: 'ranged', weight: 0, cost: 0.1, cost_unit: 'gp', properties: ['Ammunition'], rarity: 'common', quantity: 1 },
];

// ─── Armor ────────────────────────────────────────────────────────────────────
export const ARMOR = [
  { name: 'Padded Armor', category: 'Armor', equip_slot: 'armor', armor_class: 11, armor_type: 'light', weight: 8, cost: 5, cost_unit: 'gp', rarity: 'common', description: 'AC 11 + Dex. Stealth disadvantage.', quantity: 1 },
  { name: 'Leather Armor', category: 'Armor', equip_slot: 'armor', armor_class: 11, armor_type: 'light', weight: 10, cost: 10, cost_unit: 'gp', rarity: 'common', description: 'AC 11 + Dex.', quantity: 1 },
  { name: 'Studded Leather', category: 'Armor', equip_slot: 'armor', armor_class: 12, armor_type: 'light', weight: 13, cost: 45, cost_unit: 'gp', rarity: 'common', description: 'AC 12 + Dex.', quantity: 1 },
  { name: 'Hide Armor', category: 'Armor', equip_slot: 'armor', armor_class: 12, armor_type: 'medium', weight: 12, cost: 10, cost_unit: 'gp', rarity: 'common', description: 'AC 12 + Dex (max 2).', quantity: 1 },
  { name: 'Chain Shirt', category: 'Armor', equip_slot: 'armor', armor_class: 13, armor_type: 'medium', weight: 20, cost: 50, cost_unit: 'gp', rarity: 'common', description: 'AC 13 + Dex (max 2).', quantity: 1 },
  { name: 'Scale Mail', category: 'Armor', equip_slot: 'armor', armor_class: 14, armor_type: 'medium', weight: 45, cost: 50, cost_unit: 'gp', rarity: 'common', description: 'AC 14 + Dex (max 2). Stealth disadvantage.', quantity: 1 },
  { name: 'Breastplate', category: 'Armor', equip_slot: 'armor', armor_class: 14, armor_type: 'medium', weight: 20, cost: 400, cost_unit: 'gp', rarity: 'common', description: 'AC 14 + Dex (max 2).', quantity: 1 },
  { name: 'Half Plate', category: 'Armor', equip_slot: 'armor', armor_class: 15, armor_type: 'medium', weight: 40, cost: 750, cost_unit: 'gp', rarity: 'common', description: 'AC 15 + Dex (max 2). Stealth disadvantage.', quantity: 1 },
  { name: 'Ring Mail', category: 'Armor', equip_slot: 'armor', armor_class: 14, armor_type: 'heavy', weight: 40, cost: 30, cost_unit: 'gp', rarity: 'common', description: 'AC 14. Stealth disadvantage.', quantity: 1 },
  { name: 'Chain Mail', category: 'Armor', equip_slot: 'armor', armor_class: 16, armor_type: 'heavy', weight: 55, cost: 75, cost_unit: 'gp', rarity: 'common', description: 'AC 16. STR 13 required. Stealth disadvantage.', quantity: 1 },
  { name: 'Splint Armor', category: 'Armor', equip_slot: 'armor', armor_class: 17, armor_type: 'heavy', weight: 60, cost: 200, cost_unit: 'gp', rarity: 'common', description: 'AC 17. STR 15 required. Stealth disadvantage.', quantity: 1 },
  { name: 'Plate Armor', category: 'Armor', equip_slot: 'armor', armor_class: 18, armor_type: 'heavy', weight: 65, cost: 1500, cost_unit: 'gp', rarity: 'common', description: 'AC 18. STR 15 required. Stealth disadvantage.', quantity: 1 },
  { name: 'Shield', category: 'Shield', equip_slot: 'offhand', armor_class: 2, weight: 6, cost: 10, cost_unit: 'gp', rarity: 'common', description: '+2 AC.', quantity: 1 },
];

// ─── Adventuring Gear ─────────────────────────────────────────────────────────
export const ADVENTURING_GEAR = [
  { name: 'Backpack', category: 'Adventuring Gear', weight: 5, cost: 2, cost_unit: 'gp', rarity: 'common', quantity: 1 },
  { name: 'Bedroll', category: 'Adventuring Gear', weight: 7, cost: 1, cost_unit: 'gp', rarity: 'common', quantity: 1 },
  { name: 'Rope (50 ft, hemp)', category: 'Adventuring Gear', weight: 10, cost: 1, cost_unit: 'gp', rarity: 'common', quantity: 1 },
  { name: 'Rope (50 ft, silk)', category: 'Adventuring Gear', weight: 5, cost: 10, cost_unit: 'gp', rarity: 'common', quantity: 1 },
  { name: 'Torch', category: 'Adventuring Gear', weight: 1, cost: 0.01, cost_unit: 'gp', rarity: 'common', quantity: 10 },
  { name: 'Lantern (hooded)', category: 'Adventuring Gear', weight: 2, cost: 5, cost_unit: 'gp', rarity: 'common', quantity: 1 },
  { name: 'Oil (flask)', category: 'Adventuring Gear', weight: 1, cost: 0.1, cost_unit: 'gp', rarity: 'common', quantity: 1 },
  { name: 'Rations (1 day)', category: 'Adventuring Gear', weight: 2, cost: 0.5, cost_unit: 'gp', rarity: 'common', quantity: 10 },
  { name: 'Waterskin', category: 'Adventuring Gear', weight: 5, cost: 0.2, cost_unit: 'gp', rarity: 'common', quantity: 1 },
  { name: 'Tinderbox', category: 'Adventuring Gear', weight: 1, cost: 0.5, cost_unit: 'gp', rarity: 'common', quantity: 1 },
  { name: 'Grappling Hook', category: 'Adventuring Gear', weight: 4, cost: 2, cost_unit: 'gp', rarity: 'common', quantity: 1 },
  { name: 'Piton', category: 'Adventuring Gear', weight: 0.25, cost: 0.05, cost_unit: 'gp', rarity: 'common', quantity: 10 },
  { name: 'Crowbar', category: 'Adventuring Gear', weight: 5, cost: 2, cost_unit: 'gp', rarity: 'common', quantity: 1 },
  { name: 'Chain (10 ft)', category: 'Adventuring Gear', weight: 10, cost: 5, cost_unit: 'gp', rarity: 'common', quantity: 1 },
  { name: 'Caltrops (bag of 20)', category: 'Adventuring Gear', weight: 2, cost: 1, cost_unit: 'gp', rarity: 'common', quantity: 1 },
  { name: 'Ball Bearings (bag of 1000)', category: 'Adventuring Gear', weight: 2, cost: 1, cost_unit: 'gp', rarity: 'common', quantity: 1 },
  { name: 'Chalk (1 piece)', category: 'Adventuring Gear', weight: 0, cost: 0.01, cost_unit: 'gp', rarity: 'common', quantity: 1 },
  { name: 'Hunting Trap', category: 'Adventuring Gear', weight: 25, cost: 5, cost_unit: 'gp', rarity: 'common', quantity: 1 },
  { name: 'Mirror (steel)', category: 'Adventuring Gear', weight: 0.5, cost: 5, cost_unit: 'gp', rarity: 'common', quantity: 1 },
  { name: 'Manacles', category: 'Adventuring Gear', weight: 6, cost: 2, cost_unit: 'gp', rarity: 'common', quantity: 1 },
  { name: 'Healer\'s Kit', category: 'Adventuring Gear', weight: 3, cost: 5, cost_unit: 'gp', rarity: 'common', quantity: 1, description: '10 uses. Stabilize a creature at 0 HP without a Medicine check.' },
  { name: 'Component Pouch', category: 'Adventuring Gear', weight: 2, cost: 25, cost_unit: 'gp', rarity: 'common', quantity: 1 },
  { name: 'Arcane Focus (Crystal)', category: 'Adventuring Gear', weight: 1, cost: 10, cost_unit: 'gp', rarity: 'common', quantity: 1 },
  { name: 'Arcane Focus (Staff)', category: 'Adventuring Gear', weight: 4, cost: 5, cost_unit: 'gp', rarity: 'common', quantity: 1 },
  { name: 'Holy Symbol', category: 'Adventuring Gear', weight: 1, cost: 5, cost_unit: 'gp', rarity: 'common', quantity: 1 },
  { name: 'Druidic Focus (Sprig of Mistletoe)', category: 'Adventuring Gear', weight: 0, cost: 1, cost_unit: 'gp', rarity: 'common', quantity: 1 },
  { name: 'Spellbook', category: 'Adventuring Gear', weight: 3, cost: 50, cost_unit: 'gp', rarity: 'common', quantity: 1 },
  { name: 'Arrows (20)', category: 'Ammunition', weight: 1, cost: 1, cost_unit: 'gp', rarity: 'common', quantity: 1 },
  { name: 'Bolts (20)', category: 'Ammunition', weight: 1.5, cost: 1, cost_unit: 'gp', rarity: 'common', quantity: 1 },
  { name: 'Sling Bullets (20)', category: 'Ammunition', weight: 1.5, cost: 0.04, cost_unit: 'gp', rarity: 'common', quantity: 1 },
];

// ─── Tools ────────────────────────────────────────────────────────────────────
export const TOOLS = [
  { name: "Thieves' Tools", category: 'Tool', weight: 1, cost: 25, cost_unit: 'gp', rarity: 'common', quantity: 1, description: 'Required for picking locks and disarming traps.' },
  { name: "Herbalism Kit", category: 'Tool', weight: 3, cost: 5, cost_unit: 'gp', rarity: 'common', quantity: 1 },
  { name: "Poisoner's Kit", category: 'Tool', weight: 2, cost: 50, cost_unit: 'gp', rarity: 'common', quantity: 1 },
  { name: "Smith's Tools", category: 'Tool', weight: 8, cost: 20, cost_unit: 'gp', rarity: 'common', quantity: 1 },
  { name: "Alchemist's Supplies", category: 'Tool', weight: 8, cost: 50, cost_unit: 'gp', rarity: 'common', quantity: 1 },
  { name: "Brewer's Supplies", category: 'Tool', weight: 9, cost: 20, cost_unit: 'gp', rarity: 'common', quantity: 1 },
  { name: "Carpenter's Tools", category: 'Tool', weight: 8, cost: 8, cost_unit: 'gp', rarity: 'common', quantity: 1 },
  { name: "Cartographer's Tools", category: 'Tool', weight: 6, cost: 15, cost_unit: 'gp', rarity: 'common', quantity: 1 },
  { name: "Cook's Utensils", category: 'Tool', weight: 8, cost: 1, cost_unit: 'gp', rarity: 'common', quantity: 1 },
  { name: "Disguise Kit", category: 'Tool', weight: 3, cost: 25, cost_unit: 'gp', rarity: 'common', quantity: 1 },
  { name: "Forgery Kit", category: 'Tool', weight: 5, cost: 15, cost_unit: 'gp', rarity: 'common', quantity: 1 },
  { name: "Navigator's Tools", category: 'Tool', weight: 2, cost: 25, cost_unit: 'gp', rarity: 'common', quantity: 1 },
  { name: "Lute", category: 'Tool', weight: 2, cost: 35, cost_unit: 'gp', rarity: 'common', quantity: 1 },
  { name: "Flute", category: 'Tool', weight: 1, cost: 2, cost_unit: 'gp', rarity: 'common', quantity: 1 },
  { name: "Drum", category: 'Tool', weight: 3, cost: 6, cost_unit: 'gp', rarity: 'common', quantity: 1 },
];

// ─── Equipment Packs ──────────────────────────────────────────────────────────
export const EQUIPMENT_PACKS = {
  "Explorer's Pack": {
    cost: 10, items: ['Backpack', 'Bedroll', 'Mess Kit', 'Tinderbox', 'Torch ×10', 'Rations ×10', 'Waterskin', 'Rope (50 ft, hemp)'],
    weight: 59,
  },
  "Dungeoneer's Pack": {
    cost: 12, items: ['Backpack', 'Crowbar', 'Hammer', 'Piton ×10', 'Torch ×10', 'Tinderbox', 'Rations ×10', 'Waterskin', 'Rope (50 ft, hemp)'],
    weight: 61,
  },
  "Burglar's Pack": {
    cost: 16, items: ['Backpack', 'Ball Bearings ×1000', 'String (10 ft)', 'Bell', 'Candle ×5', 'Crowbar', 'Hammer', 'Piton ×10', 'Lantern (hooded)', 'Oil ×2', 'Rations ×5', 'Tinderbox', 'Waterskin', 'Rope (50 ft, hemp)'],
    weight: 44,
  },
  "Priest's Pack": {
    cost: 19, items: ['Backpack', 'Blanket', 'Candle ×10', 'Tinderbox', 'Alms box', 'Incense ×2', 'Censer', 'Vestments', 'Rations ×2', 'Waterskin'],
    weight: 24,
  },
  "Scholar's Pack": {
    cost: 40, items: ['Backpack', 'Book of Lore', 'Ink', 'Ink Pen', 'Parchment ×10', 'Little bag of sand', 'Small knife'],
    weight: 22,
  },
  "Diplomat's Pack": {
    cost: 39, items: ['Chest', 'Map Case ×2', 'Fine Clothes', 'Ink', 'Ink Pen', 'Lamp', 'Oil ×2', 'Paper ×5', 'Perfume', 'Sealing Wax', 'Soap'],
    weight: 36,
  },
};

// ─── All items combined for search ────────────────────────────────────────────
export const ALL_STANDARD_ITEMS = [
  ...SIMPLE_MELEE_WEAPONS,
  ...MARTIAL_MELEE_WEAPONS,
  ...RANGED_WEAPONS,
  ...ARMOR,
  ...ADVENTURING_GEAR,
  ...TOOLS,
];

// ─── Category groupings for browsing ──────────────────────────────────────────
export const ITEM_CATEGORIES = [
  { key: 'all', label: 'All Items', icon: '📦' },
  { key: 'simple_melee', label: 'Simple Melee', icon: '🗡️' },
  { key: 'martial_melee', label: 'Martial Melee', icon: '⚔️' },
  { key: 'ranged', label: 'Ranged', icon: '🏹' },
  { key: 'armor', label: 'Armor & Shields', icon: '🛡️' },
  { key: 'gear', label: 'Adventuring Gear', icon: '🎒' },
  { key: 'tools', label: 'Tools & Kits', icon: '🔧' },
  { key: 'ammo', label: 'Ammunition', icon: '🏹' },
];

export function getItemsByCategory(key) {
  switch (key) {
    case 'simple_melee': return SIMPLE_MELEE_WEAPONS;
    case 'martial_melee': return MARTIAL_MELEE_WEAPONS;
    case 'ranged': return RANGED_WEAPONS;
    case 'armor': return ARMOR;
    case 'gear': return ADVENTURING_GEAR.filter(i => i.category === 'Adventuring Gear');
    case 'tools': return TOOLS;
    case 'ammo': return ADVENTURING_GEAR.filter(i => i.category === 'Ammunition');
    default: return ALL_STANDARD_ITEMS;
  }
}

// Search items by name/category
export function searchItems(query, items = ALL_STANDARD_ITEMS) {
  if (!query?.trim()) return items;
  const q = query.toLowerCase();
  return items.filter(it =>
    it.name.toLowerCase().includes(q) ||
    (it.category || '').toLowerCase().includes(q) ||
    (it.damage_type || '').toLowerCase().includes(q) ||
    (it.description || '').toLowerCase().includes(q) ||
    (it.properties || []).some(p => p.toLowerCase().includes(q))
  );
}
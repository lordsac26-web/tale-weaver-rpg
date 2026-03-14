/**
 * Common magic item bonuses and effects
 * Used for parsing and applying equipment bonuses
 */

export const COMMON_MAGIC_ITEMS = {
  '+1 Ring of Protection': {
    type: 'ring',
    rarity: 'rare',
    bonuses: { ac: 1, saving_throws: 1 },
    description: 'Grants +1 bonus to AC and saving throws while worn.',
    requires_attunement: true
  },
  '+2 Ring of Protection': {
    type: 'ring',
    rarity: 'very rare',
    bonuses: { ac: 2, saving_throws: 2 },
    description: 'Grants +2 bonus to AC and saving throws while worn.',
    requires_attunement: true
  },
  'Belt of Giant Strength (Hill)': {
    type: 'belt',
    slot: 'waist',
    rarity: 'rare',
    bonuses: { ability_scores: { strength: 21 } },
    description: 'Your Strength score becomes 21 while wearing this belt.',
    requires_attunement: true,
    set_ability: true // sets ability to exact value, not additive
  },
  'Headband of Intellect': {
    type: 'headgear',
    slot: 'head',
    rarity: 'uncommon',
    bonuses: { ability_scores: { intelligence: 19 } },
    description: 'Your Intelligence score becomes 19 while wearing this headband.',
    requires_attunement: true,
    set_ability: true
  },
  'Amulet of Health': {
    type: 'amulet',
    slot: 'neck',
    rarity: 'rare',
    bonuses: { ability_scores: { constitution: 19 } },
    description: 'Your Constitution score becomes 19 while wearing this amulet.',
    requires_attunement: true,
    set_ability: true
  },
  'Cloak of Protection': {
    type: 'cloak',
    slot: 'back',
    rarity: 'uncommon',
    bonuses: { ac: 1, saving_throws: 1 },
    description: 'Grants +1 bonus to AC and saving throws.',
    requires_attunement: true
  },
  '+1 Weapon': {
    type: 'weapon',
    rarity: 'uncommon',
    bonuses: { attack: 1, damage: 1 },
    description: 'You have a +1 bonus to attack and damage rolls made with this magic weapon.'
  },
  '+2 Weapon': {
    type: 'weapon',
    rarity: 'rare',
    bonuses: { attack: 2, damage: 2 },
    description: 'You have a +2 bonus to attack and damage rolls made with this magic weapon.'
  },
  '+3 Weapon': {
    type: 'weapon',
    rarity: 'very rare',
    bonuses: { attack: 3, damage: 3 },
    description: 'You have a +3 bonus to attack and damage rolls made with this magic weapon.'
  },
  '+1 Armor': {
    type: 'armor',
    slot: 'chest',
    rarity: 'rare',
    bonuses: { ac: 1 },
    description: 'While wearing this armor, you have a +1 bonus to AC.'
  },
  '+1 Shield': {
    type: 'shield',
    slot: 'offhand',
    rarity: 'uncommon',
    bonuses: { ac: 1 },
    description: 'While holding this shield, you have a +1 bonus to AC.'
  },
  'Boots of Speed': {
    type: 'boots',
    slot: 'feet',
    rarity: 'rare',
    bonuses: {},
    description: 'While worn, you can use a bonus action to click the heels together, doubling your walking speed for 10 minutes.',
    requires_attunement: true,
    special: 'speed_double'
  },
  'Gauntlets of Ogre Power': {
    type: 'gauntlets',
    slot: 'hands',
    rarity: 'uncommon',
    bonuses: { ability_scores: { strength: 19 } },
    description: 'Your Strength score becomes 19 while you wear these gauntlets.',
    requires_attunement: true,
    set_ability: true
  },
  'Bracers of Defense': {
    type: 'bracers',
    slot: 'hands',
    rarity: 'rare',
    bonuses: { ac: 2 },
    description: 'While wearing these bracers, you gain a +2 bonus to AC if you are wearing no armor and using no shield.',
    requires_attunement: true,
    condition: 'no_armor'
  },
};

/**
 * Parse item bonuses from description text using common patterns
 */
export function parseItemBonuses(itemName, description) {
  const bonuses = {};
  const text = (itemName + ' ' + (description || '')).toLowerCase();

  // AC bonuses
  const acMatch = text.match(/\+(\d+).*?(ac|armor class)/i);
  if (acMatch) bonuses.ac = parseInt(acMatch[1]);

  // Attack bonuses
  const atkMatch = text.match(/\+(\d+).*?attack/i);
  if (atkMatch) bonuses.attack = parseInt(atkMatch[1]);

  // Damage bonuses
  const dmgMatch = text.match(/\+(\d+).*?damage/i);
  if (dmgMatch) bonuses.damage = parseInt(dmgMatch[1]);

  // Saving throw bonuses
  const saveMatch = text.match(/\+(\d+).*?saving throw/i);
  if (saveMatch) bonuses.saving_throws = parseInt(saveMatch[1]);

  // Ability score bonuses
  const stats = ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'];
  stats.forEach(stat => {
    const statMatch = text.match(new RegExp(`${stat}.*?(\\d+)`, 'i'));
    if (statMatch) {
      if (!bonuses.ability_scores) bonuses.ability_scores = {};
      bonuses.ability_scores[stat] = parseInt(statMatch[1]);
    }
  });

  return Object.keys(bonuses).length > 0 ? bonuses : null;
}
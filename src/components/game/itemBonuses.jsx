/**
 * Common magic item bonuses and effects
 * Used for parsing and applying equipment bonuses
 */

// Normalise a name to lowercase, trimmed, no extra spaces
const norm = (s) => (s || '').toLowerCase().trim().replace(/\s+/g, ' ');

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
 * Parse item bonuses from description text using common patterns.
 * ability_scores = "set" values (e.g. CON becomes 19).
 * ability_score_adds = "+N" additive bonuses (e.g. +1 DEX).
 */
export function parseItemBonuses(itemName, description) {
  const bonuses = {};
  const text = (itemName + ' ' + (description || '')).toLowerCase();

  // AC bonuses — match "+N ... AC/armor class" but NOT "score ... N"
  const acMatch = text.match(/\+(\d+).*?(?:ac|armor class)/i);
  if (acMatch) bonuses.ac = parseInt(acMatch[1]);

  // Also match "bonus to AC" patterns like "grants +1 bonus to AC"
  if (!bonuses.ac) {
    const acMatch2 = text.match(/\+(\d+)\s*bonus.*?(?:ac|armor class)/i);
    if (acMatch2) bonuses.ac = parseInt(acMatch2[1]);
  }

  // Attack bonuses
  const atkMatch = text.match(/\+(\d+).*?attack/i);
  if (atkMatch) bonuses.attack = parseInt(atkMatch[1]);

  // Damage bonuses
  const dmgMatch = text.match(/\+(\d+).*?(?:dmg|damage)/i);
  if (dmgMatch) bonuses.damage = parseInt(dmgMatch[1]);

  // Saving throw bonuses — broader matching
  const saveMatch = text.match(/\+(\d+).*?saving throw/i);
  if (saveMatch) bonuses.saving_throws = parseInt(saveMatch[1]);
  if (!bonuses.saving_throws) {
    const saveMatch2 = text.match(/\+(\d+)\s*bonus.*?saving/i);
    if (saveMatch2) bonuses.saving_throws = parseInt(saveMatch2[1]);
  }

  // Ability score handling — distinguish "set" from "add"
  const stats = ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'];
  stats.forEach(stat => {
    // "Set" pattern: "Your [stat] score is/becomes N" (Amulet of Health, Belt of Giant Strength, etc.)
    const setPattern = new RegExp(`${stat}[^.]*?(?:score|becomes|is)\\s*(?:is|becomes)?\\s*(\\d+)`, 'i');
    const setMatch = text.match(setPattern);
    if (setMatch) {
      const val = parseInt(setMatch[1]);
      if (val >= 13) { // "set" items are always 13+ (Headband=19, Gauntlets=19, Belt=21+)
        if (!bonuses.ability_scores) bonuses.ability_scores = {};
        bonuses.ability_scores[stat] = val;
        return; // don't also parse as additive
      }
    }

    // "Add" pattern: "+N to [stat]" or "+N [stat]"
    const addPattern = new RegExp(`\\+(\\d+)\\s*(?:to\\s+)?${stat}`, 'i');
    const addMatch = text.match(addPattern);
    // Also match "[stat] +N" or "+N [stat]"
    const addPattern2 = new RegExp(`${stat}.*?\\+(\\d+)`, 'i');
    const addMatch2 = !addMatch ? text.match(addPattern2) : null;
    const finalAdd = addMatch || addMatch2;
    if (finalAdd) {
      const val = parseInt(finalAdd[1]);
      if (val <= 5) { // reasonable additive range
        if (!bonuses.ability_score_adds) bonuses.ability_score_adds = {};
        bonuses.ability_score_adds[stat] = val;
      }
    }
  });

  return Object.keys(bonuses).length > 0 ? bonuses : null;
}

/**
 * Resolve bonuses for an item.
 * Priority:
 * 1. item.bonuses (if already set explicitly)
 * 2. COMMON_MAGIC_ITEMS lookup by name (fuzzy match)
 * 3. Explicit numeric fields on item (attack_bonus, armor_class from custom form)
 * 4. parseItemBonuses regex on name+description
 *
 * Always returns a bonuses object (may be empty {}).
 * Also mutates item.bonuses as cache for future calls.
 */
export function resolveItemBonuses(item) {
  if (!item) return {};

  // 1. Already has explicit bonuses object with content
  if (item.bonuses && Object.keys(item.bonuses).length > 0) return item.bonuses;

  // 2. Try COMMON_MAGIC_ITEMS lookup (exact and fuzzy)
  const itemName = norm(item.name);
  let knownBonuses = null;
  for (const [key, val] of Object.entries(COMMON_MAGIC_ITEMS)) {
    const normKey = norm(key);
    // Exact match or contains
    if (itemName === normKey || itemName.includes(normKey) || normKey.includes(itemName)) {
      knownBonuses = { ...val.bonuses };
      break;
    }
  }
  if (knownBonuses && Object.keys(knownBonuses).length > 0) {
    item.bonuses = knownBonuses;
    return knownBonuses;
  }

  // 3. Check explicit numeric fields from custom form / item data
  const formBonuses = {};
  if (item.ac_bonus && item.ac_bonus > 0) formBonuses.ac = item.ac_bonus;
  if (item.attack_bonus && item.attack_bonus > 0) formBonuses.attack = item.attack_bonus;
  if (item.damage_bonus && item.damage_bonus > 0) formBonuses.damage = item.damage_bonus;

  // 4. Regex parse from name + description
  const parsed = parseItemBonuses(item.name || '', item.description || '') || {};

  // Merge: explicit form fields take priority over regex
  const merged = { ...parsed, ...formBonuses };
  if (Object.keys(merged).length > 0) {
    item.bonuses = merged;
    return merged;
  }

  // 5. Check modifiers field (some items store bonuses there)
  if (item.modifiers && typeof item.modifiers === 'object' && Object.keys(item.modifiers).length > 0) {
    item.bonuses = item.modifiers;
    return item.modifiers;
  }

  return {};
}
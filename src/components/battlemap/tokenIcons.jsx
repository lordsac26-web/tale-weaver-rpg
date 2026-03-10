// ─── Token Icon Mapping ─────────────────────────────────────────────────────
// Uses game-icons.net SVGs (CC BY 3.0) for D&D creature/character tokens.
// URL pattern: https://game-icons.net/icons/{fg}/{bg}/1x1/{author}/{name}.svg

const BASE = 'https://game-icons.net/icons';

// Build a game-icons.net URL with custom colors
// fg/bg are hex without # (e.g. 'ffffff', '000000')
function gi(author, name, fg = 'ffffff', bg = '00000000') {
  return `${BASE}/${fg}/${bg}/1x1/${author}/${name}.svg`;
}

// ── Player class icons ──────────────────────────────────────────────────────
export const CLASS_ICONS = {
  Fighter:   gi('delapouite', 'sword-brandish'),
  Barbarian: gi('lorc', 'axe-swing'),
  Rogue:     gi('lorc', 'hooded-assassin'),
  Wizard:    gi('lorc', 'wizard-staff'),
  Sorcerer:  gi('lorc', 'bolt-spell-cast'),
  Warlock:   gi('lorc', 'bleeding-eye'),
  Cleric:    gi('delapouite', 'ankh'),
  Paladin:   gi('lorc', 'winged-sword'),
  Ranger:    gi('lorc', 'pocket-bow'),
  Druid:     gi('lorc', 'oak'),
  Monk:      gi('delapouite', 'meditation'),
  Bard:      gi('delapouite', 'harp'),
  Artificer: gi('delapouite', 'gear-hammer'),
};

// ── Race icons (fallback if no class match) ─────────────────────────────────
export const RACE_ICONS = {
  Human:    gi('delapouite', 'person'),
  Elf:      gi('delapouite', 'elf-ear'),
  Dwarf:    gi('delapouite', 'dwarf-helmet'),
  Halfling: gi('delapouite', 'hobbit-dwelling'),
  Gnome:    gi('cathelineau', 'bad-gnome'),
  Tiefling: gi('lorc', 'horned-helm'),
  Dragonborn: gi('faithtoken', 'dragon-head'),
  'Half-Orc': gi('delapouite', 'orc-head'),
  'Half-Elf': gi('delapouite', 'elf-ear'),
  Aasimar:  gi('lorc', 'angel-wings'),
  Goliath:  gi('delapouite', 'giant'),
  Tabaxi:   gi('lorc', 'cat'),
  Kenku:    gi('delapouite', 'kenku-head'),
  Firbolg:  gi('delapouite', 'sasquatch'),
  Triton:   gi('skoll', 'sea-creature'),
  Lizardfolk: gi('delapouite', 'horned-reptile'),
};

// ── Monster/creature name → icon mapping ────────────────────────────────────
// Fuzzy matched by keyword in the creature name
const CREATURE_KEYWORDS = [
  // Dragons
  { keywords: ['dragon', 'drake', 'wyrm', 'wyvern'], icon: gi('delapouite', 'spiked-dragon-head') },
  // Undead
  { keywords: ['skeleton', 'skeletal'], icon: gi('lorc', 'half-dead') },
  { keywords: ['zombie', 'undead'], icon: gi('delapouite', 'shambling-zombie') },
  { keywords: ['ghost', 'specter', 'spectre', 'wraith', 'phantom', 'spirit'], icon: gi('delapouite', 'floating-ghost') },
  { keywords: ['vampire', 'nosferatu'], icon: gi('delapouite', 'female-vampire') },
  { keywords: ['lich', 'necromancer'], icon: gi('lorc', 'crowned-skull') },
  { keywords: ['mummy'], icon: gi('delapouite', 'mummy-head') },
  // Humanoids
  { keywords: ['goblin'], icon: gi('delapouite', 'goblin-head') },
  { keywords: ['orc', 'ork'], icon: gi('delapouite', 'orc-head') },
  { keywords: ['ogre'], icon: gi('delapouite', 'ogre') },
  { keywords: ['troll'], icon: gi('skoll', 'troll') },
  { keywords: ['gnoll', 'hyena'], icon: gi('lorc', 'wolf-head') },
  { keywords: ['kobold', 'lizard'], icon: gi('delapouite', 'horned-reptile') },
  { keywords: ['bandit', 'thug', 'rogue', 'assassin', 'thief'], icon: gi('lorc', 'hooded-assassin') },
  { keywords: ['knight', 'guard', 'soldier', 'warrior', 'captain'], icon: gi('delapouite', 'sword-brandish') },
  { keywords: ['mage', 'wizard', 'sorcerer', 'warlock', 'cultist'], icon: gi('lorc', 'wizard-staff') },
  { keywords: ['priest', 'cleric', 'acolyte'], icon: gi('delapouite', 'ankh') },
  // Beasts
  { keywords: ['wolf', 'worg', 'dire wolf'], icon: gi('lorc', 'wolf-head') },
  { keywords: ['bear', 'owlbear'], icon: gi('delapouite', 'bear-head') },
  { keywords: ['spider', 'arachnid'], icon: gi('delapouite', 'spider-eye') },
  { keywords: ['rat', 'swarm'], icon: gi('lorc', 'rat') },
  { keywords: ['snake', 'serpent', 'naga', 'yuan-ti'], icon: gi('delapouite', 'snake-bite') },
  { keywords: ['bat'], icon: gi('lorc', 'bat-wing') },
  // Monstrosities
  { keywords: ['mimic'], icon: gi('delapouite', 'mimic-chest') },
  { keywords: ['golem', 'construct'], icon: gi('delapouite', 'rock-golem') },
  { keywords: ['elemental', 'fire', 'flame'], icon: gi('lorc', 'fire') },
  { keywords: ['water', 'ice'], icon: gi('delapouite', 'ice-golem') },
  { keywords: ['demon', 'devil', 'fiend'], icon: gi('delapouite', 'devil-mask') },
  { keywords: ['slime', 'ooze', 'jelly', 'cube'], icon: gi('delapouite', 'slime') },
  { keywords: ['medusa', 'gorgon'], icon: gi('cathelineau', 'medusa-head') },
  { keywords: ['centaur'], icon: gi('delapouite', 'centaur') },
  { keywords: ['gargoyle'], icon: gi('delapouite', 'gargoyle') },
  { keywords: ['giant'], icon: gi('delapouite', 'giant') },
  { keywords: ['beholder', 'eye'], icon: gi('lorc', 'bleeding-eye') },
  { keywords: ['mind flayer', 'illithid', 'tentacle'], icon: gi('delapouite', 'brain-tentacle') },
  { keywords: ['treant', 'tree'], icon: gi('cathelineau', 'tree-face') },
  { keywords: ['plant', 'vine'], icon: gi('delapouite', 'carnivorous-plant') },
  // Fey
  { keywords: ['fairy', 'fey', 'pixie', 'sprite'], icon: gi('delapouite', 'fairy') },
  // Celestial
  { keywords: ['angel', 'celestial'], icon: gi('lorc', 'angel-wings') },
  // Catch-all NPCs
  { keywords: ['merchant', 'shopkeeper', 'innkeeper', 'villager', 'commoner', 'peasant', 'npc'], icon: gi('delapouite', 'person') },
];

// Generic fallback icons by token type
const TYPE_FALLBACKS = {
  player:  gi('delapouite', 'sword-brandish'),
  ally:    gi('delapouite', 'person'),
  enemy:   gi('lorc', 'spiked-halo'),
  neutral: gi('delapouite', 'person'),
};

/**
 * Resolve an icon URL for a token/combatant.
 * @param {object} params - { name, type, characterClass, race }
 * @returns {string} SVG URL
 */
export function getTokenIcon({ name = '', type = 'enemy', characterClass, race }) {
  // 1. Player tokens — match by class, then race
  if (type === 'player' || type === 'ally') {
    if (characterClass && CLASS_ICONS[characterClass]) return CLASS_ICONS[characterClass];
    if (race && RACE_ICONS[race]) return RACE_ICONS[race];
  }

  // 2. Fuzzy-match creature name against keywords
  const lower = name.toLowerCase();
  for (const entry of CREATURE_KEYWORDS) {
    if (entry.keywords.some(kw => lower.includes(kw))) return entry.icon;
  }

  // 3. Fallback by type
  return TYPE_FALLBACKS[type] || TYPE_FALLBACKS.enemy;
}
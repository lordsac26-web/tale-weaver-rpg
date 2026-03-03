/**
 * Open5e API Integration
 * Fetches live D&D 5E data from https://api.open5e.com
 * Used to expand spells, races, items, monsters dynamically
 */

const BASE = 'https://api.open5e.com/v1';

// Generic fetch with cache (sessionStorage)
async function fetchOpen5e(endpoint, params = {}) {
  const query = new URLSearchParams({ limit: 100, ...params }).toString();
  const url = `${BASE}${endpoint}?${query}`;
  const cacheKey = `open5e:${url}`;

  try {
    const cached = sessionStorage.getItem(cacheKey);
    if (cached) return JSON.parse(cached);

    const res = await fetch(url);
    if (!res.ok) throw new Error(`Open5e API error: ${res.status}`);
    const data = await res.json();
    sessionStorage.setItem(cacheKey, JSON.stringify(data));
    return data;
  } catch (e) {
    console.warn('Open5e fetch failed:', e.message);
    return null;
  }
}

// Fetch all pages of a resource
async function fetchAll(endpoint, params = {}) {
  let results = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const data = await fetchOpen5e(endpoint, { ...params, limit: 100, page });
    if (!data) break;
    results = [...results, ...(data.results || [])];
    hasMore = !!data.next && results.length < (data.count || 0) && page < 10; // cap at 10 pages
    page++;
  }
  return results;
}

// ─── Spells ───────────────────────────────────────────────────────────────────
export async function fetchSpellsForClass(className, maxLevel = 9) {
  const cls = className.toLowerCase();
  const data = await fetchOpen5e('/spells/', {
    document__slug: 'wotc-srd',
    limit: 500,
  });
  if (!data) return [];

  return (data.results || [])
    .filter(s => {
      const lists = s.spell_lists || [];
      const dndClass = (s.dnd_class || '').toLowerCase();
      return lists.includes(cls) || dndClass.includes(cls);
    })
    .filter(s => (s.spell_level || 0) <= maxLevel)
    .map(normalizeSpell);
}

export async function fetchSpellBySlug(slug) {
  const data = await fetchOpen5e(`/spells/${slug}/`);
  return data ? normalizeSpell(data) : null;
}

export async function searchSpells(query) {
  const data = await fetchOpen5e('/spells/', { search: query, document__slug: 'wotc-srd', limit: 20 });
  return (data?.results || []).map(normalizeSpell);
}

function normalizeSpell(s) {
  return {
    slug: s.slug,
    name: s.name,
    level: s.spell_level ?? s.level_int ?? 0,
    school: s.school ? (s.school.charAt(0).toUpperCase() + s.school.slice(1)) : 'Unknown',
    casting_time: s.casting_time || '1 action',
    range: s.range || 'Self',
    components: s.components || 'V, S',
    duration: s.duration || 'Instantaneous',
    description: s.desc || '',
    higher_levels: s.higher_level || '',
    ritual: s.ritual === 'yes' || s.can_be_cast_as_ritual === true,
    concentration: s.concentration === 'yes' || s.requires_concentration === true,
    classes: s.spell_lists || (s.dnd_class ? s.dnd_class.split(', ') : []),
    source: s.document__title || 'SRD',
  };
}

// ─── Races ────────────────────────────────────────────────────────────────────
export async function fetchAllRaces() {
  const data = await fetchOpen5e('/races/', { document__slug: 'wotc-srd', limit: 50 });
  return (data?.results || []).map(normalizeRace);
}

function normalizeRace(r) {
  const statBonuses = {};
  (r.asi || []).forEach(a => {
    (a.attributes || []).forEach(attr => {
      statBonuses[attr.toLowerCase()] = (statBonuses[attr.toLowerCase()] || 0) + (a.value || 0);
    });
  });
  return {
    name: r.name,
    slug: r.slug,
    description: r.desc || '',
    stat_bonuses: statBonuses,
    speed: r.speed?.walk || 30,
    size: r.size_raw || 'Medium',
    traits: parseBoldItems(r.traits || ''),
    languages: r.languages || '',
    vision: r.vision || '',
    subraces: (r.subraces || []).map(sr => ({
      name: sr.name,
      description: sr.desc || '',
      stat_bonuses: (sr.asi || []).reduce((acc, a) => {
        (a.attributes || []).forEach(attr => { acc[attr.toLowerCase()] = a.value || 0; });
        return acc;
      }, {}),
      traits: parseBoldItems(sr.traits || ''),
    })),
    source: r.document__title || 'SRD',
  };
}

function parseBoldItems(text) {
  const matches = text.match(/\*\*\*([^*]+)\*\*\*/g) || [];
  return matches.map(m => m.replace(/\*\*\*/g, '').replace(/\..*/, '').trim());
}

// ─── Classes & Subclasses ─────────────────────────────────────────────────────
export async function fetchClassDetails(className) {
  const data = await fetchOpen5e('/classes/', { document__slug: 'wotc-srd', limit: 50 });
  if (!data) return null;
  const cls = (data.results || []).find(c => c.name.toLowerCase() === className.toLowerCase());
  return cls || null;
}

// ─── Magic Items ──────────────────────────────────────────────────────────────
export async function fetchMagicItems(params = {}) {
  const data = await fetchOpen5e('/magicitems/', { document__slug: 'wotc-srd', limit: 100, ...params });
  return (data?.results || []).map(normalizeMagicItem);
}

export async function searchMagicItems(query) {
  const data = await fetchOpen5e('/magicitems/', { search: query, limit: 20 });
  return (data?.results || []).map(normalizeMagicItem);
}

function normalizeMagicItem(item) {
  const typeStr = (item.type || '').toLowerCase();
  let category = 'Wondrous Item';
  let equip_slot = 'trinket';

  if (typeStr.includes('weapon') || typeStr.includes('sword') || typeStr.includes('axe')) { category = 'Weapon'; equip_slot = 'mainhand'; }
  else if (typeStr.includes('armor') || typeStr.includes('chain') || typeStr.includes('plate') || typeStr.includes('leather')) { category = 'Armor'; equip_slot = 'armor'; }
  else if (typeStr.includes('shield')) { category = 'Shield'; equip_slot = 'offhand'; }
  else if (typeStr.includes('helm') || typeStr.includes('hat') || typeStr.includes('circlet') || typeStr.includes('crown')) { category = 'Helmet'; equip_slot = 'helmet'; }
  else if (typeStr.includes('cloak') || typeStr.includes('cape') || typeStr.includes('mantle')) { category = 'Cloak'; equip_slot = 'cloak'; }
  else if (typeStr.includes('gloves') || typeStr.includes('gauntlets') || typeStr.includes('bracers')) { category = 'Gloves'; equip_slot = 'gloves'; }
  else if (typeStr.includes('boots') || typeStr.includes('slippers') || typeStr.includes('shoes')) { category = 'Boots'; equip_slot = 'boots'; }
  else if (typeStr.includes('ring')) { category = 'Ring'; equip_slot = 'ring'; }
  else if (typeStr.includes('amulet') || typeStr.includes('necklace') || typeStr.includes('pendant') || typeStr.includes('medallion')) { category = 'Amulet'; equip_slot = 'amulet'; }
  else if (typeStr.includes('belt') || typeStr.includes('girdle')) { category = 'Belt'; equip_slot = 'belt'; }
  else if (typeStr.includes('potion')) { category = 'Potion'; equip_slot = null; }
  else if (typeStr.includes('wondrous')) { category = 'Wondrous Item'; equip_slot = 'trinket'; }

  const rarityMap = { common: 'common', uncommon: 'uncommon', rare: 'rare', 'very rare': 'epic', legendary: 'legendary' };
  const rarity = rarityMap[(item.rarity || '').toLowerCase()] || 'common';

  return {
    name: item.name,
    slug: item.slug,
    category,
    equip_slot,
    rarity,
    requires_attunement: !!item.requires_attunement && item.requires_attunement !== '',
    description: item.desc || '',
    weight: 0,
    cost: 0,
    cost_unit: 'gp',
    quantity: 1,
    magic_properties: [],
    source: item.document__title || 'SRD',
    is_magic: true,
  };
}

// ─── Feats ────────────────────────────────────────────────────────────────────
export async function fetchFeats() {
  const data = await fetchOpen5e('/feats/', { document__slug: 'wotc-srd', limit: 50 });
  return (data?.results || []).map(f => ({
    name: f.name,
    slug: f.slug,
    description: f.desc || '',
    prerequisite: f.prerequisite || null,
    source: f.document__title || 'SRD',
  }));
}

// ─── Skills ───────────────────────────────────────────────────────────────────
export const SKILLS_FULL = [
  { name: 'Acrobatics',      ability: 'dexterity',     description: 'Balance, tumble, stay upright in difficult situations.' },
  { name: 'Animal Handling', ability: 'wisdom',        description: 'Calm animals, intuit animal intentions, control mounts.' },
  { name: 'Arcana',          ability: 'intelligence',  description: 'Recall lore about spells, magic items, planes, and magical traditions.' },
  { name: 'Athletics',       ability: 'strength',      description: 'Climb, jump, swim, and physical feats of strength.' },
  { name: 'Deception',       ability: 'charisma',      description: 'Conceal the truth through word, action, or disguise.' },
  { name: 'History',         ability: 'intelligence',  description: 'Recall historical events, legendary people, wars, and kingdoms.' },
  { name: 'Insight',         ability: 'wisdom',        description: 'Determine true intentions and detect deception.' },
  { name: 'Intimidation',    ability: 'charisma',      description: 'Influence through overt threats, hostile actions, and physical violence.' },
  { name: 'Investigation',   ability: 'intelligence',  description: 'Look for clues, deduce information, research topics.' },
  { name: 'Medicine',        ability: 'wisdom',        description: 'Stabilize the dying, diagnose illness, identify poison.' },
  { name: 'Nature',          ability: 'intelligence',  description: 'Recall lore about terrain, plants, animals, seasons, and weather.' },
  { name: 'Perception',      ability: 'wisdom',        description: 'Spot, hear, or otherwise detect the presence of something.' },
  { name: 'Performance',     ability: 'charisma',      description: 'Delight an audience with music, dance, acting, or storytelling.' },
  { name: 'Persuasion',      ability: 'charisma',      description: 'Influence others through tact, social graces, and good nature.' },
  { name: 'Religion',        ability: 'intelligence',  description: 'Recall lore about deities, rites, prayer, and religious hierarchies.' },
  { name: 'Sleight of Hand', ability: 'dexterity',     description: 'Pickpocket, conceal objects, perform manual tricks.' },
  { name: 'Stealth',         ability: 'dexterity',     description: 'Conceal yourself from enemies, sneak past guards, hide in shadows.' },
  { name: 'Survival',        ability: 'wisdom',        description: 'Follow tracks, hunt, navigate wilderness, predict weather.' },
];

// ─── Multiclassing Rules (D&D 5E SRD) ─────────────────────────────────────────
export const MULTICLASS_REQUIREMENTS = {
  Barbarian:  { strength: 13 },
  Bard:       { charisma: 13 },
  Cleric:     { wisdom: 13 },
  Druid:      { wisdom: 13 },
  Fighter:    { strength: 13, dexterity: 13 },  // either
  Monk:       { dexterity: 13, wisdom: 13 },
  Paladin:    { strength: 13, charisma: 13 },
  Ranger:     { dexterity: 13, wisdom: 13 },
  Rogue:      { dexterity: 13 },
  Sorcerer:   { charisma: 13 },
  Warlock:    { charisma: 13 },
  Wizard:     { intelligence: 13 },
};

export const MULTICLASS_PROFICIENCIES = {
  Barbarian:  { armor: ['light armor', 'medium armor', 'shields'], weapons: ['simple weapons', 'martial weapons'] },
  Bard:       { armor: ['light armor'], weapons: [], tools: ['one musical instrument'] },
  Cleric:     { armor: ['light armor', 'medium armor', 'shields'], weapons: [] },
  Druid:      { armor: ['light armor', 'medium armor', 'shields'], weapons: [] },
  Fighter:    { armor: ['light armor', 'medium armor', 'armor', 'shields'], weapons: ['simple weapons', 'martial weapons'] },
  Monk:       { armor: [], weapons: ['simple weapons', 'shortswords'] },
  Paladin:    { armor: ['light armor', 'medium armor', 'shields'], weapons: ['simple weapons', 'martial weapons'] },
  Ranger:     { armor: ['light armor', 'medium armor', 'shields'], weapons: ['simple weapons', 'martial weapons'] },
  Rogue:      { armor: ['light armor'], weapons: [], tools: ["thieves' tools"] },
  Sorcerer:   { armor: [], weapons: [] },
  Warlock:    { armor: ['light armor'], weapons: ['simple weapons'] },
  Wizard:     { armor: [], weapons: [] },
};

export function canMulticlass(character, targetClass) {
  const reqs = MULTICLASS_REQUIREMENTS[targetClass];
  if (!reqs) return { allowed: false, reason: 'Unknown class.' };

  // Fighter needs STR *or* DEX
  if (targetClass === 'Fighter') {
    const ok = (character.strength || 10) >= 13 || (character.dexterity || 10) >= 13;
    return ok ? { allowed: true } : { allowed: false, reason: 'Requires STR 13 or DEX 13.' };
  }

  for (const [stat, min] of Object.entries(reqs)) {
    if ((character[stat] || 10) < min) {
      return { allowed: false, reason: `Requires ${stat.charAt(0).toUpperCase() + stat.slice(1)} ${min}.` };
    }
  }
  return { allowed: true };
}

// Multiclass spell slot table (combined levels) - DMG table
export const MULTICLASS_SPELL_SLOTS = {
  1:  [2,0,0,0,0,0,0,0,0],
  2:  [3,0,0,0,0,0,0,0,0],
  3:  [4,2,0,0,0,0,0,0,0],
  4:  [4,3,0,0,0,0,0,0,0],
  5:  [4,3,2,0,0,0,0,0,0],
  6:  [4,3,3,0,0,0,0,0,0],
  7:  [4,3,3,1,0,0,0,0,0],
  8:  [4,3,3,2,0,0,0,0,0],
  9:  [4,3,3,3,1,0,0,0,0],
  10: [4,3,3,3,2,0,0,0,0],
  11: [4,3,3,3,2,1,0,0,0],
  12: [4,3,3,3,2,1,0,0,0],
  13: [4,3,3,3,2,1,1,0,0],
  14: [4,3,3,3,2,1,1,0,0],
  15: [4,3,3,3,2,1,1,1,0],
  16: [4,3,3,3,2,1,1,1,0],
  17: [4,3,3,3,2,1,1,1,1],
  18: [4,3,3,3,3,1,1,1,1],
  19: [4,3,3,3,3,2,1,1,1],
  20: [4,3,3,3,3,2,2,1,1],
};

// Caster levels for multiclassing (half/third casters)
export const CASTER_LEVEL_MULTIPLIER = {
  Wizard: 1, Sorcerer: 1, Cleric: 1, Druid: 1, Bard: 1,
  Paladin: 0.5, Ranger: 0.5,
  'Eldritch Knight': 0.333, 'Arcane Trickster': 0.333,
  Warlock: 0, // pact magic, special
};
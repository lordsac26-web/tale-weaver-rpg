// ─────────────────────────────────────────────────────────────────────────────
// racialSpells.jsx
// Racial innate spellcasting data (PHB / EE / Volo's / SCAG).
// Maps race/subrace → innate spells with level-gating and spellcasting stat.
//
// Used by:
//   - characterBuilder.js (character creation)
//   - autoLevelUp/entry.ts (level-up spell unlock)
//
// Per PHB p.12: racial spells use the specified stat as spellcasting ability.
// Cantrips are at-will; higher-level spells are 1/long rest unless noted.
// ─────────────────────────────────────────────────────────────────────────────

// Format: { subrace_or_race_name: { stat, spells: [{ name, level, type, uses }] } }
// type: 'cantrip' | 'spell'
// uses: 'at_will' | 'long_rest' | 'unlimited' (for utility cantrips)
export const RACIAL_SPELLS = {
  // ── Drow (Dark Elf) — PHB p.24 ── CHA ──
  'Drow (Dark Elf)': {
    stat: 'charisma',
    spells: [
      { name: 'Dancing Lights', level: 1, type: 'cantrip', uses: 'at_will' },
      { name: 'Faerie Fire',    level: 3, type: 'spell',   uses: 'long_rest' },
      { name: 'Darkness',       level: 5, type: 'spell',   uses: 'long_rest' },
    ],
  },

  // ── Tiefling sub-lineages — PHB p.43 / SCAG / MToF ── CHA ──
  'Asmodeus (Standard)': {
    stat: 'charisma',
    spells: [
      { name: 'Thaumaturgy',    level: 1, type: 'cantrip', uses: 'at_will' },
      { name: 'Hellish Rebuke', level: 3, type: 'spell',   uses: 'long_rest' },
      { name: 'Darkness',       level: 5, type: 'spell',   uses: 'long_rest' },
    ],
  },
  Dispater: {
    stat: 'charisma',
    spells: [
      { name: 'Thaumaturgy',     level: 1, type: 'cantrip', uses: 'at_will' },
      { name: 'Disguise Self',  level: 3, type: 'spell',   uses: 'long_rest' },
      { name: 'Detect Thoughts', level: 5, type: 'spell',  uses: 'long_rest' },
    ],
  },
  Fierna: {
    stat: 'charisma',
    spells: [
      { name: 'Friends',       level: 1, type: 'cantrip', uses: 'at_will' },
      { name: 'Charm Person',  level: 3, type: 'spell',   uses: 'long_rest' },
      { name: 'Suggestion',    level: 5, type: 'spell',   uses: 'long_rest' },
    ],
  },
  Glasya: {
    stat: 'charisma',
    spells: [
      { name: 'Minor Illusion',  level: 1, type: 'cantrip', uses: 'at_will' },
      { name: 'Disguise Self',  level: 3, type: 'spell',   uses: 'long_rest' },
      { name: 'Invisibility',   level: 5, type: 'spell',   uses: 'long_rest' },
    ],
  },
  Levistus: {
    stat: 'charisma',
    spells: [
      { name: 'Ray of Frost',      level: 1, type: 'cantrip', uses: 'at_will' },
      { name: 'Armor of Agathys', level: 3, type: 'spell',   uses: 'long_rest' },
      { name: 'Darkness',         level: 5, type: 'spell',   uses: 'long_rest' },
    ],
  },
  Mammon: {
    stat: 'charisma',
    spells: [
      { name: 'Mage Hand',               level: 1, type: 'cantrip', uses: 'at_will' },
      { name: "Tenser's Floating Disk",   level: 3, type: 'spell',   uses: 'long_rest' },
      { name: 'Arcane Lock',             level: 5, type: 'spell',   uses: 'long_rest' },
    ],
  },
  Mephistopheles: {
    stat: 'charisma',
    spells: [
      { name: 'Mage Hand',     level: 1, type: 'cantrip', uses: 'at_will' },
      { name: 'Burning Hands', level: 3, type: 'spell',   uses: 'long_rest' },
      { name: 'Flame Blade',   level: 5, type: 'spell',   uses: 'long_rest' },
    ],
  },
  Zariel: {
    stat: 'charisma',
    spells: [
      { name: 'Thaumaturgy',   level: 1, type: 'cantrip', uses: 'at_will' },
      { name: 'Searing Smite', level: 3, type: 'spell',   uses: 'long_rest' },
      { name: 'Branding Smite', level: 5, type: 'spell',  uses: 'long_rest' },
    ],
  },
  Baalzebul: {
    stat: 'charisma',
    spells: [
      { name: 'Thaumaturgy',      level: 1, type: 'cantrip', uses: 'at_will' },
      { name: 'Ray of Sickness',  level: 3, type: 'spell',   uses: 'long_rest' },
      { name: 'Crown of Madness', level: 5, type: 'spell',   uses: 'long_rest' },
    ],
  },

  // ── Forest Gnome — PHB p.37 ── INT ──
  'Forest Gnome': {
    stat: 'intelligence',
    spells: [
      { name: 'Minor Illusion', level: 1, type: 'cantrip', uses: 'at_will' },
    ],
  },

  // ── Genasi — EE p.9 ── CON ──
  'Air Genasi': {
    stat: 'constitution',
    spells: [
      { name: 'Levitate', level: 1, type: 'spell', uses: 'long_rest' },
    ],
  },
  'Earth Genasi': {
    stat: 'constitution',
    spells: [
      { name: 'Pass Without Trace', level: 1, type: 'spell', uses: 'long_rest' },
    ],
  },
  'Fire Genasi': {
    stat: 'constitution',
    spells: [
      { name: 'Produce Flame',  level: 1, type: 'cantrip', uses: 'at_will' },
      { name: 'Burning Hands',  level: 3, type: 'spell',   uses: 'long_rest' },
    ],
  },
  'Water Genasi': {
    stat: 'constitution',
    spells: [
      { name: 'Shape Water',              level: 1, type: 'cantrip', uses: 'at_will' },
      { name: 'Create or Destroy Water',  level: 1, type: 'spell',   uses: 'long_rest' },
    ],
  },

  // ── Yuan-ti Pureblood — Volo's p.121 ── CHA ──
  'Yuan-ti Pureblood': {
    stat: 'charisma',
    spells: [
      { name: 'Poison Spray',      level: 1, type: 'cantrip', uses: 'at_will' },
      { name: 'Animal Friendship', level: 1, type: 'spell',   uses: 'at_will', note: 'snakes only' },
      { name: 'Suggestion',        level: 3, type: 'spell',   uses: 'long_rest' },
    ],
  },

  // ── Aarakocra — EE p.4 ── WIS ──
  Aarakocra: {
    stat: 'wisdom',
    spells: [
      { name: 'Gust of Wind', level: 3, type: 'spell', uses: 'long_rest' },
    ],
  },

  // ── Base Tiefling (no lineage chosen) — Infernal Legacy, PHB p.43 ── CHA ──
  Tiefling: {
    stat: 'charisma',
    spells: [
      { name: 'Thaumaturgy',    level: 1, type: 'cantrip', uses: 'at_will' },
      { name: 'Hellish Rebuke', level: 3, type: 'spell',   uses: 'long_rest' },
      { name: 'Darkness',       level: 5, type: 'spell',   uses: 'long_rest' },
    ],
  },

  // ── Triton — Control Air and Water, Volo's p.118 ── CHA ──
  Triton: {
    stat: 'charisma',
    spells: [
      { name: 'Fog Cloud',     level: 1, type: 'spell', uses: 'long_rest' },
      { name: 'Gust of Wind',  level: 3, type: 'spell', uses: 'long_rest' },
      { name: 'Wall of Water', level: 5, type: 'spell', uses: 'long_rest' },
    ],
  },

  // ── Aasimar — Light Bearer, Volo's p.105 ── CHA ──
  Aasimar: {
    stat: 'charisma',
    spells: [
      { name: 'Light', level: 1, type: 'cantrip', uses: 'at_will' },
    ],
  },

  // ── Firbolg — Firbolg Magic, Volo's p.107 ── WIS ── 1/short rest each ──
  Firbolg: {
    stat: 'wisdom',
    spells: [
      { name: 'Detect Magic',  level: 1, type: 'spell', uses: 'short_rest' },
      { name: 'Disguise Self', level: 1, type: 'spell', uses: 'short_rest' },
    ],
  },
};

/**
 * Returns all racial spells available to a character at the given level.
 * Checks subrace first, then race.
 *
 * @param {string} race - Character race (e.g., 'Elf', 'Tiefling')
 * @param {string} subrace - Character subrace (e.g., 'Drow (Dark Elf)')
 * @param {number} level - Character level
 * @returns {Array<{ name, level, type, uses, stat }>}
 */
export function getRacialSpells(race, subrace, level = 1) {
  const key = subrace || race;
  const entry = RACIAL_SPELLS[key] || RACIAL_SPELLS[race];
  if (!entry) return [];
  return entry.spells
    .filter(s => s.level <= level)
    .map(s => ({ ...s, stat: entry.stat }));
}

/**
 * Returns ALL racial spells for a character (not filtered by level).
 * Used to check if any will unlock at a specific level.
 */
export function getAllRacialSpells(race, subrace) {
  const key = subrace || race;
  const entry = RACIAL_SPELLS[key] || RACIAL_SPELLS[race];
  if (!entry) return [];
  return entry.spells.map(s => ({ ...s, stat: entry.stat }));
}

/**
 * Returns the racial spellcasting ability for a character.
 * Returns null if the race/subrace has no innate spellcasting.
 */
export function getRacialSpellcastingStat(race, subrace) {
  const key = subrace || race;
  const entry = RACIAL_SPELLS[key] || RACIAL_SPELLS[race];
  return entry?.stat || null;
}

/**
 * Apply racial spells to a character object.
 * Adds qualifying spells to spells_known and spells_prepared.
 * Does NOT mutate the input; returns updates to merge.
 *
 * @param {Object} character - Character with race, subrace, level, spells_known
 * @returns {Object} Updates to merge ({ spells_known, spells_prepared, features })
 */
export function applyRacialSpells(character) {
  const race = character.race;
  const subrace = character.subrace;
  const level = character.level || 1;

  const racialSpells = getRacialSpells(race, subrace, level);
  if (racialSpells.length === 0) return {};

  const knownSet = new Set(character.spells_known || []);
  const preparedSet = new Set(character.spells_prepared || []);
  const features = [...(character.features || [])];
  const stat = getRacialSpellcastingStat(race, subrace);

  let added = [];
  for (const spell of racialSpells) {
    if (!knownSet.has(spell.name)) {
      knownSet.add(spell.name);
      added.push(spell.name);
    }
    // Racial cantrips and spells are always "prepared" (innate)
    preparedSet.add(spell.name);
  }

  // Add a feature note about racial spellcasting if not already present
  const featureNote = `Racial Spellcasting (${stat?.toUpperCase() || 'CHA'})`;
  if (added.length > 0 && !features.includes(featureNote)) {
    features.push(featureNote);
  }

  const updates = {};
  if (knownSet.size > (character.spells_known || []).length) {
    updates.spells_known = Array.from(knownSet);
  }
  if (preparedSet.size > (character.spells_prepared || []).length) {
    updates.spells_prepared = Array.from(preparedSet);
  }
  if (features.length > (character.features || []).length) {
    updates.features = features;
  }

  return updates;
}
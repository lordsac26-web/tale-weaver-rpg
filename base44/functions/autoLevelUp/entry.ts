import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
 
/**
 * Automated Leveling System
 * Checks XP thresholds and automatically levels up characters.
 * Updates: HP max, proficiency bonus, new features, spell slots,
 * armor class (Monk/Barbarian/natural-armor races), and initiative.
 */
 
const XP_THRESHOLDS = [0, 300, 900, 2700, 6500, 14000, 23000, 34000, 48000, 64000, 85000, 100000, 120000, 140000, 165000, 195000, 225000, 265000, 305000, 355000];
const PROFICIENCY_BY_LEVEL = [2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 6, 6, 6, 6];
 
const CLASS_HIT_DICE = {
  Barbarian: 12, Fighter: 10, Paladin: 10, Ranger: 10,
  Bard: 8, Cleric: 8, Druid: 8, Monk: 8, Rogue: 8, Warlock: 8, Artificer: 8,
  Wizard: 6, Sorcerer: 6,
};
 
const RACIAL_HP_BONUSES = {
  'Hill Dwarf': 1, // Dwarven Toughness: +1 HP per level (PHB p.20)
};
 
const calcStatMod = (stat) => Math.floor(((stat || 10) - 10) / 2);
 
// ── Spell slot tables per class per level (index 0 = 1st-level slots, etc.) ──
const SPELL_SLOTS = {
  Wizard:   { 1:[2,0,0,0,0,0,0,0,0], 2:[3,0,0,0,0,0,0,0,0], 3:[4,2,0,0,0,0,0,0,0], 4:[4,3,0,0,0,0,0,0,0], 5:[4,3,2,0,0,0,0,0,0], 6:[4,3,3,0,0,0,0,0,0], 7:[4,3,3,1,0,0,0,0,0], 8:[4,3,3,2,0,0,0,0,0], 9:[4,3,3,3,1,0,0,0,0], 10:[4,3,3,3,2,0,0,0,0], 11:[4,3,3,3,2,1,0,0,0], 12:[4,3,3,3,2,1,0,0,0], 13:[4,3,3,3,2,1,1,0,0], 14:[4,3,3,3,2,1,1,0,0], 15:[4,3,3,3,2,1,1,1,0], 16:[4,3,3,3,2,1,1,1,0], 17:[4,3,3,3,2,1,1,1,1], 18:[4,3,3,3,3,1,1,1,1], 19:[4,3,3,3,3,2,1,1,1], 20:[4,3,3,3,3,2,2,1,1] },
  Sorcerer: { 1:[2,0,0,0,0,0,0,0,0], 2:[3,0,0,0,0,0,0,0,0], 3:[4,2,0,0,0,0,0,0,0], 4:[4,3,0,0,0,0,0,0,0], 5:[4,3,2,0,0,0,0,0,0], 6:[4,3,3,0,0,0,0,0,0], 7:[4,3,3,1,0,0,0,0,0], 8:[4,3,3,2,0,0,0,0,0], 9:[4,3,3,3,1,0,0,0,0], 10:[4,3,3,3,2,0,0,0,0], 11:[4,3,3,3,2,1,0,0,0], 12:[4,3,3,3,2,1,0,0,0], 13:[4,3,3,3,2,1,1,0,0], 14:[4,3,3,3,2,1,1,0,0], 15:[4,3,3,3,2,1,1,1,0], 16:[4,3,3,3,2,1,1,1,0], 17:[4,3,3,3,2,1,1,1,1], 18:[4,3,3,3,3,1,1,1,1], 19:[4,3,3,3,3,2,1,1,1], 20:[4,3,3,3,3,2,2,1,1] },
  Cleric:   { 1:[2,0,0,0,0,0,0,0,0], 2:[3,0,0,0,0,0,0,0,0], 3:[4,2,0,0,0,0,0,0,0], 4:[4,3,0,0,0,0,0,0,0], 5:[4,3,2,0,0,0,0,0,0], 6:[4,3,3,0,0,0,0,0,0], 7:[4,3,3,1,0,0,0,0,0], 8:[4,3,3,2,0,0,0,0,0], 9:[4,3,3,3,1,0,0,0,0], 10:[4,3,3,3,2,0,0,0,0], 11:[4,3,3,3,2,1,0,0,0], 12:[4,3,3,3,2,1,0,0,0], 13:[4,3,3,3,2,1,1,0,0], 14:[4,3,3,3,2,1,1,0,0], 15:[4,3,3,3,2,1,1,1,0], 16:[4,3,3,3,2,1,1,1,0], 17:[4,3,3,3,2,1,1,1,1], 18:[4,3,3,3,3,1,1,1,1], 19:[4,3,3,3,3,2,1,1,1], 20:[4,3,3,3,3,2,2,1,1] },
  Druid:    { 1:[2,0,0,0,0,0,0,0,0], 2:[3,0,0,0,0,0,0,0,0], 3:[4,2,0,0,0,0,0,0,0], 4:[4,3,0,0,0,0,0,0,0], 5:[4,3,2,0,0,0,0,0,0], 6:[4,3,3,0,0,0,0,0,0], 7:[4,3,3,1,0,0,0,0,0], 8:[4,3,3,2,0,0,0,0,0], 9:[4,3,3,3,1,0,0,0,0], 10:[4,3,3,3,2,0,0,0,0], 11:[4,3,3,3,2,1,0,0,0], 12:[4,3,3,3,2,1,0,0,0], 13:[4,3,3,3,2,1,1,0,0], 14:[4,3,3,3,2,1,1,0,0], 15:[4,3,3,3,2,1,1,1,0], 16:[4,3,3,3,2,1,1,1,0], 17:[4,3,3,3,2,1,1,1,1], 18:[4,3,3,3,3,1,1,1,1], 19:[4,3,3,3,3,2,1,1,1], 20:[4,3,3,3,3,2,2,1,1] },
  Bard:     { 1:[2,0,0,0,0,0,0,0,0], 2:[3,0,0,0,0,0,0,0,0], 3:[4,2,0,0,0,0,0,0,0], 4:[4,3,0,0,0,0,0,0,0], 5:[4,3,2,0,0,0,0,0,0], 6:[4,3,3,0,0,0,0,0,0], 7:[4,3,3,1,0,0,0,0,0], 8:[4,3,3,2,0,0,0,0,0], 9:[4,3,3,3,1,0,0,0,0], 10:[4,3,3,3,2,0,0,0,0], 11:[4,3,3,3,2,1,0,0,0], 12:[4,3,3,3,2,1,0,0,0], 13:[4,3,3,3,2,1,1,0,0], 14:[4,3,3,3,2,1,1,0,0], 15:[4,3,3,3,2,1,1,1,0], 16:[4,3,3,3,2,1,1,1,0], 17:[4,3,3,3,2,1,1,1,1], 18:[4,3,3,3,3,1,1,1,1], 19:[4,3,3,3,3,2,1,1,1], 20:[4,3,3,3,3,2,2,1,1] },
  Paladin:  { 1:[0,0,0,0,0,0,0,0,0], 2:[2,0,0,0,0,0,0,0,0], 3:[3,0,0,0,0,0,0,0,0], 4:[3,0,0,0,0,0,0,0,0], 5:[4,2,0,0,0,0,0,0,0], 6:[4,2,0,0,0,0,0,0,0], 7:[4,3,0,0,0,0,0,0,0], 8:[4,3,0,0,0,0,0,0,0], 9:[4,3,2,0,0,0,0,0,0], 10:[4,3,2,0,0,0,0,0,0], 11:[4,3,3,0,0,0,0,0,0], 12:[4,3,3,0,0,0,0,0,0], 13:[4,3,3,1,0,0,0,0,0], 14:[4,3,3,1,0,0,0,0,0], 15:[4,3,3,2,0,0,0,0,0], 16:[4,3,3,2,0,0,0,0,0], 17:[4,3,3,3,1,0,0,0,0], 18:[4,3,3,3,1,0,0,0,0], 19:[4,3,3,3,2,0,0,0,0], 20:[4,3,3,3,2,0,0,0,0] },
  Ranger:   { 1:[0,0,0,0,0,0,0,0,0], 2:[2,0,0,0,0,0,0,0,0], 3:[3,0,0,0,0,0,0,0,0], 4:[3,0,0,0,0,0,0,0,0], 5:[4,2,0,0,0,0,0,0,0], 6:[4,2,0,0,0,0,0,0,0], 7:[4,3,0,0,0,0,0,0,0], 8:[4,3,0,0,0,0,0,0,0], 9:[4,3,2,0,0,0,0,0,0], 10:[4,3,2,0,0,0,0,0,0], 11:[4,3,3,0,0,0,0,0,0], 12:[4,3,3,0,0,0,0,0,0], 13:[4,3,3,1,0,0,0,0,0], 14:[4,3,3,1,0,0,0,0,0], 15:[4,3,3,2,0,0,0,0,0], 16:[4,3,3,2,0,0,0,0,0], 17:[4,3,3,3,1,0,0,0,0], 18:[4,3,3,3,1,0,0,0,0], 19:[4,3,3,3,2,0,0,0,0], 20:[4,3,3,3,2,0,0,0,0] },
  Warlock:  { 1:[1,0,0,0,0,0,0,0,0], 2:[2,0,0,0,0,0,0,0,0], 3:[0,2,0,0,0,0,0,0,0], 4:[0,2,0,0,0,0,0,0,0], 5:[0,0,2,0,0,0,0,0,0], 6:[0,0,2,0,0,0,0,0,0], 7:[0,0,0,2,0,0,0,0,0], 8:[0,0,0,2,0,0,0,0,0], 9:[0,0,0,0,2,0,0,0,0], 10:[0,0,0,0,2,0,0,0,0], 11:[0,0,0,0,3,0,0,0,0], 12:[0,0,0,0,3,0,0,0,0], 13:[0,0,0,0,3,0,0,0,0], 14:[0,0,0,0,3,0,0,0,0], 15:[0,0,0,0,3,0,0,0,0], 16:[0,0,0,0,3,0,0,0,0], 17:[0,0,0,0,4,0,0,0,0], 18:[0,0,0,0,4,0,0,0,0], 19:[0,0,0,0,4,0,0,0,0], 20:[0,0,0,0,4,0,0,0,0] },
  Artificer:{ 1:[2,0,0,0,0,0,0,0,0], 2:[2,0,0,0,0,0,0,0,0], 3:[3,0,0,0,0,0,0,0,0], 4:[3,0,0,0,0,0,0,0,0], 5:[4,2,0,0,0,0,0,0,0], 6:[4,2,0,0,0,0,0,0,0], 7:[4,3,0,0,0,0,0,0,0], 8:[4,3,0,0,0,0,0,0,0], 9:[4,3,2,0,0,0,0,0,0], 10:[4,3,2,0,0,0,0,0,0], 11:[4,3,3,0,0,0,0,0,0], 12:[4,3,3,0,0,0,0,0,0], 13:[4,3,3,1,0,0,0,0,0], 14:[4,3,3,1,0,0,0,0,0], 15:[4,3,3,2,0,0,0,0,0], 16:[4,3,3,2,0,0,0,0,0], 17:[4,3,3,3,1,0,0,0,0], 18:[4,3,3,3,1,0,0,0,0], 19:[4,3,3,3,2,0,0,0,0], 20:[4,3,3,3,2,0,0,0,0] },
};
 
const NON_CASTERS = ['Fighter', 'Barbarian', 'Rogue', 'Monk'];

// Multiclass spellcaster slot table, indexed by COMBINED caster level (PHB p.164-165).
// Index 0 = caster level 1. Warlock Pact Magic is tracked separately and excluded.
const MULTICLASS_SLOTS = [
  [2],[3],[4,2],[4,3],[4,3,2],[4,3,3],[4,3,3,1],[4,3,3,2],[4,3,3,3,1],[4,3,3,3,2],
  [4,3,3,3,2,1],[4,3,3,3,2,1],[4,3,3,3,2,1,1],[4,3,3,3,2,1,1],[4,3,3,3,2,1,1,1],
  [4,3,3,3,2,1,1,1],[4,3,3,3,2,1,1,1,1],[4,3,3,3,3,1,1,1,1],[4,3,3,3,3,2,1,1,1],[4,3,3,3,3,2,2,1,1],
];

// Racial innate spellcasting data (mirrors racialSpells.jsx — used on level-up to
// unlock spells at the correct level gate).
// Format: { subrace_or_race: { stat, spells: [{ name, level, type, uses }] } }
const RACIAL_SPELLS_DATA = {
  'Drow (Dark Elf)': { stat: 'charisma', spells: [
    { name: 'Dancing Lights', level: 1, type: 'cantrip' }, { name: 'Faerie Fire', level: 3, type: 'spell' }, { name: 'Darkness', level: 5, type: 'spell' } ] },
  'Asmodeus (Standard)': { stat: 'charisma', spells: [
    { name: 'Thaumaturgy', level: 1, type: 'cantrip' }, { name: 'Hellish Rebuke', level: 3, type: 'spell' }, { name: 'Darkness', level: 5, type: 'spell' } ] },
  Dispater: { stat: 'charisma', spells: [
    { name: 'Thaumaturgy', level: 1, type: 'cantrip' }, { name: 'Disguise Self', level: 3, type: 'spell' }, { name: 'Detect Thoughts', level: 5, type: 'spell' } ] },
  Fierna: { stat: 'charisma', spells: [
    { name: 'Friends', level: 1, type: 'cantrip' }, { name: 'Charm Person', level: 3, type: 'spell' }, { name: 'Suggestion', level: 5, type: 'spell' } ] },
  Glasya: { stat: 'charisma', spells: [
    { name: 'Minor Illusion', level: 1, type: 'cantrip' }, { name: 'Disguise Self', level: 3, type: 'spell' }, { name: 'Invisibility', level: 5, type: 'spell' } ] },
  Levistus: { stat: 'charisma', spells: [
    { name: 'Ray of Frost', level: 1, type: 'cantrip' }, { name: 'Armor of Agathys', level: 3, type: 'spell' }, { name: 'Darkness', level: 5, type: 'spell' } ] },
  Mammon: { stat: 'charisma', spells: [
    { name: 'Mage Hand', level: 1, type: 'cantrip' }, { name: "Tenser's Floating Disk", level: 3, type: 'spell' }, { name: 'Arcane Lock', level: 5, type: 'spell' } ] },
  Mephistopheles: { stat: 'charisma', spells: [
    { name: 'Mage Hand', level: 1, type: 'cantrip' }, { name: 'Burning Hands', level: 3, type: 'spell' }, { name: 'Flame Blade', level: 5, type: 'spell' } ] },
  Zariel: { stat: 'charisma', spells: [
    { name: 'Thaumaturgy', level: 1, type: 'cantrip' }, { name: 'Searing Smite', level: 3, type: 'spell' }, { name: 'Branding Smite', level: 5, type: 'spell' } ] },
  Baalzebul: { stat: 'charisma', spells: [
    { name: 'Thaumaturgy', level: 1, type: 'cantrip' }, { name: 'Ray of Sickness', level: 3, type: 'spell' }, { name: 'Crown of Madness', level: 5, type: 'spell' } ] },
  'Forest Gnome': { stat: 'intelligence', spells: [
    { name: 'Minor Illusion', level: 1, type: 'cantrip' } ] },
  'Air Genasi': { stat: 'constitution', spells: [
    { name: 'Levitate', level: 1, type: 'spell' } ] },
  'Earth Genasi': { stat: 'constitution', spells: [
    { name: 'Pass Without Trace', level: 1, type: 'spell' } ] },
  'Fire Genasi': { stat: 'constitution', spells: [
    { name: 'Produce Flame', level: 1, type: 'cantrip' }, { name: 'Burning Hands', level: 3, type: 'spell' } ] },
  'Water Genasi': { stat: 'constitution', spells: [
    { name: 'Shape Water', level: 1, type: 'cantrip' }, { name: 'Create or Destroy Water', level: 1, type: 'spell' } ] },
  'Yuan-ti Pureblood': { stat: 'charisma', spells: [
    { name: 'Poison Spray', level: 1, type: 'cantrip' }, { name: 'Animal Friendship', level: 1, type: 'spell' }, { name: 'Suggestion', level: 3, type: 'spell' } ] },
  Aarakocra: { stat: 'wisdom', spells: [
    { name: 'Gust of Wind', level: 3, type: 'spell' } ] },
  // Base Tiefling (no lineage) — Infernal Legacy (PHB p.43)
  Tiefling: { stat: 'charisma', spells: [
    { name: 'Thaumaturgy', level: 1, type: 'cantrip' }, { name: 'Hellish Rebuke', level: 3, type: 'spell' }, { name: 'Darkness', level: 5, type: 'spell' } ] },
  // Triton — Control Air and Water (Volo's p.118)
  Triton: { stat: 'charisma', spells: [
    { name: 'Fog Cloud', level: 1, type: 'spell' }, { name: 'Gust of Wind', level: 3, type: 'spell' }, { name: 'Wall of Water', level: 5, type: 'spell' } ] },
  // Aasimar — Light Bearer (Volo's p.105)
  Aasimar: { stat: 'charisma', spells: [
    { name: 'Light', level: 1, type: 'cantrip' } ] },
  // Firbolg — Firbolg Magic (Volo's p.107)
  Firbolg: { stat: 'wisdom', spells: [
    { name: 'Detect Magic', level: 1, type: 'spell' }, { name: 'Disguise Self', level: 1, type: 'spell' } ] },
};

// Compute combined caster level for a (possibly multiclassed) character.
// Same logic as handleRest's computeCasterLevel — full/half/third progression.
function computeCombinedCasterLevel(char) {
  const levels = {};
  levels[char.class] = char.level || 1;
  (char.multiclass || []).forEach(mc => {
    if (mc?.class) levels[mc.class] = (levels[mc.class] || 0) + (mc.levels || 0);
  });

  let casterLevel = 0;
  for (const [cls, lvls] of Object.entries(levels)) {
    const sub = cls === char.class ? (char.subclass || '') : (char.multiclass || []).find(m => m.class === cls)?.subclass || '';
    const s = (sub || '').toLowerCase();
    if (['Wizard', 'Sorcerer', 'Bard', 'Cleric', 'Druid'].includes(cls)) casterLevel += lvls;
    else if (['Paladin', 'Ranger', 'Artificer'].includes(cls)) casterLevel += Math.floor(lvls / 2);
    else if (s.includes('eldritch knight') || s.includes('arcane trickster')) casterLevel += Math.floor(lvls / 3);
  }
  return casterLevel;
}

/** Total character level = primary level + all multiclass levels. */
function getTotalLevel(character) {
  const primary = character.level || 1;
  const mcLevels = (character.multiclass || []).reduce((sum, mc) => sum + (mc.levels || 0), 0);
  return primary + mcLevels;
}

/**
 * Returns the per-class level breakdown as a flat lookup:
 * { [className]: levelsInThatClass }. The primary class uses character.level.
 */
function getClassLevels(character) {
  const levels = { [character.class]: character.level || 1 };
  (character.multiclass || []).forEach(mc => {
    if (!mc.class) return;
    levels[mc.class] = (levels[mc.class] || 0) + (mc.levels || 0);
  });
  return levels;
}
 
/** Build a fresh spell_slots object (tracks slots used, starting at 0). */
function buildSpellSlots(charClass, level) {
  const table = SPELL_SLOTS[charClass];
  if (!table || NON_CASTERS.includes(charClass)) return {};
  const slots = table[level] || [];
  const result = {};
  slots.forEach((max, i) => {
    if (max > 0) result[`level_${i + 1}`] = 0;
  });
  return result;
}
 
/** Recalculate armor class for classes/races that derive AC from stats. */
function recalcArmorClass(character) {
  const dexMod = calcStatMod(character.dexterity || 10);
  const wisMod = calcStatMod(character.wisdom    || 10);
  const conMod = calcStatMod(character.constitution || 10);
 
  // Skip if character is wearing armor — AC is set by the armor, not stats
  const equippedArmor = character.equipped && character.equipped.armor;
  if (equippedArmor) return null;
 
  if (character.class === 'Monk')       return 10 + dexMod + wisMod;
  if (character.class === 'Barbarian')  return 10 + dexMod + conMod;
  if (character.race  === 'Lizardfolk') return 13 + dexMod;
  if (character.race  === 'Tortle')     return 17;
  if (character.race  === 'Warforged')  return 11 + dexMod;
  return null;
}
 
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const body = await req.json();

    // Support both: entity automation payload AND direct frontend invocation
    // Entity automation sends: { event: { entity_id, type, entity_name }, data, old_data }
    // Frontend sends: { character_id }
    const character_id = body.event?.entity_id || body.character_id;

    if (!character_id) {
      return Response.json({ error: 'No character_id provided' }, { status: 400 });
    }

    // C2 fix: direct frontend calls must be authenticated and own the character.
    // Automation payloads (body.event) run without a user session — they keep
    // service role, unchanged, so the XP-change automation still works.
    const isAutomation = !!body.event;
    let authedUser = null;
    if (!isAutomation) {
      authedUser = await base44.auth.me();
      if (!authedUser) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // When called from an entity automation, check if XP actually changed
    // to avoid unnecessary processing on non-XP updates
    if (body.data && body.old_data) {
      const newXP = body.data.xp ?? 0;
      const oldXP = body.old_data.xp ?? 0;
      if (newXP <= oldXP) {
        return Response.json({ leveled_up: false, message: 'XP did not increase, skipping' });
      }
    }

    // Use service role to read character (automation context has no user session)
    const character = await base44.asServiceRole.entities.Character.get(character_id);
    if (!character) return Response.json({ error: 'Character not found' }, { status: 404 });

    // C2 fix: for direct calls, verify the caller OWNS this character before any
    // service-role write. (Character RLS keys on created_by; created_by_id also checked.)
    if (!isAutomation) {
      const ownsCharacter = character.created_by_id === authedUser.id || character.created_by === authedUser.email;
      if (!ownsCharacter) return Response.json({ error: 'Forbidden' }, { status: 403 });
    }
 
    // Multiclass: gating, proficiency bonus, and XP use TOTAL character level
    // (primary + all secondary class levels) per 5e rules. Per-class levels
    // still drive HP hit dice and class features.
    const currentTotalLevel = getTotalLevel(character);
    const currentXP         = character.xp || 0;
 
    if (currentTotalLevel >= 20) {
      return Response.json({ leveled_up: false, message: 'Already at max level (20)', current_level: currentTotalLevel });
    }
 
    const nextLevelThreshold = XP_THRESHOLDS[currentTotalLevel];
    if (currentXP < nextLevelThreshold) {
      return Response.json({
        leveled_up: false, message: 'Not enough XP',
        current_xp: currentXP, xp_needed: nextLevelThreshold, current_level: currentTotalLevel,
      });
    }
 
    // Determine how many total levels are earned by current XP
    let newTotalLevel = currentTotalLevel;
    while (newTotalLevel < 20 && currentXP >= XP_THRESHOLDS[newTotalLevel]) newTotalLevel++;
 
    const levelsGained = newTotalLevel - currentTotalLevel;
    if (levelsGained === 0) {
      return Response.json({ leveled_up: false, message: 'No level gain' });
    }
 
    // ── Which class receives the new level(s)? (player chooses) ──────────────
    // Frontend passes `level_into_class`. If a multiclass character is eligible
    // and no class was specified, return a pending choice instead of guessing.
    const requestedClass = body.level_into_class;
    const isMulticlass   = (character.multiclass || []).length > 0;
 
    if (isMulticlass && !requestedClass) {
      const heldClasses = Object.keys(getClassLevels(character));
      return Response.json({
        leveled_up: false,
        needs_class_choice: true,
        levels_available: levelsGained,
        held_classes: heldClasses,
        new_total_level: newTotalLevel,
        message: `Choose which class to advance (${levelsGained} level${levelsGained > 1 ? 's' : ''} available).`,
      });
    }
 
    // The class receiving the new level(s): explicit choice, or primary class.
    const receivingClass = requestedClass || character.class;
 
    // Per-class level the receiving class reaches AFTER this level-up
    const classLevelsBefore = getClassLevels(character);
    const receivingBefore   = classLevelsBefore[receivingClass] || 0;
    const receivingAfter    = receivingBefore + levelsGained;
 
    // ── HP increase (uses hit die of the RECEIVING class) ────────────────────
    const hitDie        = CLASS_HIT_DICE[receivingClass] || 8;
    const conMod        = calcStatMod(character.constitution || 10);
    const racialHPBonus = RACIAL_HP_BONUSES[character.race] || 0;
    const avgHPPerLevel = Math.floor(hitDie / 2) + 1 + conMod + racialHPBonus;
    const hpIncrease    = levelsGained * avgHPPerLevel;
    const newMaxHP      = (character.hp_max || 0) + hpIncrease;
    // Proficiency bonus is based on TOTAL level (5e PHB p.45)
    const newProfBonus  = PROFICIENCY_BY_LEVEL[newTotalLevel - 1];
 
    // ── Spell slots ──────────────────────────────────────────────────────────
    // Multiclass casters use a COMBINED caster level (PHB p.164-165) against the
    // multiclass slot table. Single-class characters keep their own progression.
    // Warlock Pact Magic is excluded from the combined pool (tracked separately).
    const isMulticlassedAfter = (character.multiclass || []).length > 0 ||
      (requestedClass && requestedClass !== character.class);

    // Build class levels AFTER level-up for caster level computation
    const classLevelsAfter = { ...getClassLevels(character) };
    classLevelsAfter[receivingClass] = receivingAfter;

    let newSlotTable;
    if (isMulticlassedAfter) {
      let combinedCasterLevel = 0;
      for (const [cls, lvls] of Object.entries(classLevelsAfter)) {
        const sub = cls === character.class ? (character.subclass || '') :
          (character.multiclass || []).find(m => m.class === cls)?.subclass || '';
        const s = (sub || '').toLowerCase();
        if (['Wizard', 'Sorcerer', 'Bard', 'Cleric', 'Druid'].includes(cls)) combinedCasterLevel += lvls;
        else if (['Paladin', 'Ranger', 'Artificer'].includes(cls)) combinedCasterLevel += Math.floor(lvls / 2);
        else if (s.includes('eldritch knight') || s.includes('arcane trickster')) combinedCasterLevel += Math.floor(lvls / 3);
      }
      if (combinedCasterLevel > 0) {
        newSlotTable = MULTICLASS_SLOTS[Math.min(20, combinedCasterLevel) - 1] || [];
      } else {
        // No caster levels in the combined pool — fall back to per-class (Warlock)
        newSlotTable = (SPELL_SLOTS[receivingClass] && SPELL_SLOTS[receivingClass][receivingAfter]) || [];
      }
    } else {
      newSlotTable = (SPELL_SLOTS[receivingClass] && SPELL_SLOTS[receivingClass][receivingAfter]) || [];
    }

    const newSpellSlots = {};
    newSlotTable.forEach((max, i) => { if (max > 0) newSpellSlots[`level_${i + 1}`] = 0; });
    // Preserve used-slot counts (capped at the new maximum)
    const existingUsed  = character.spell_slots || {};
    Object.keys(newSpellSlots).forEach(key => {
      const lvlIdx        = parseInt(key.replace('level_', '')) - 1;
      const maxAtNewLevel = newSlotTable[lvlIdx] || 0;
      const prevUsed      = existingUsed[key] || 0;
      newSpellSlots[key]  = Math.min(prevUsed, maxAtNewLevel);
    });
 
    // ── AC recalculation ─────────────────────────────────────────────────────
    // H2 fix: do NOT write initiative here. character.initiative is a MISC bonus
    // added ON TOP of the dex mod at combat start (see combatEngine start_combat) —
    // writing the dex mod into it double-counted DEX on every initiative roll.
    const newAC         = recalcArmorClass(character);
 
    // ── Class features for gained levels ────────────────────────────────────
    const newFeatures = [];
    const CLASS_FEATURES = {
      Fighter: {
        1: ['Fighting Style', 'Second Wind'],
        2: ['Action Surge'],
        3: ['Martial Archetype'],
        4: ['Ability Score Improvement'],
        5: ['Extra Attack'],
        6: ['Ability Score Improvement'],
        7: ['Archetype Feature'],
        8: ['Ability Score Improvement'],
        9: ['Indomitable'],
        11: ['Extra Attack (2)'],
        12: ['Ability Score Improvement'],
        14: ['Ability Score Improvement'],
        15: ['Archetype Feature'],
        16: ['Ability Score Improvement'],
        17: ['Action Surge (2)', 'Indomitable (2)'],
        18: ['Archetype Feature'],
        19: ['Ability Score Improvement'],
        20: ['Extra Attack (3)'],
      },
      Rogue: {
        1: ['Expertise', 'Sneak Attack (1d6)', "Thieves' Cant"],
        2: ['Cunning Action'],
        3: ['Roguish Archetype'],
        4: ['Ability Score Improvement'],
        5: ['Uncanny Dodge'],
        7: ['Evasion'],
        8: ['Ability Score Improvement'],
        10: ['Ability Score Improvement'],
        11: ['Reliable Talent'],
        12: ['Ability Score Improvement'],
        14: ['Blindsense'],
        15: ['Slippery Mind'],
        16: ['Ability Score Improvement'],
        18: ['Elusive'],
        19: ['Ability Score Improvement'],
        20: ['Stroke of Luck'],
      },
      Wizard: {
        1: ['Spellcasting', 'Arcane Recovery'],
        2: ['Arcane Tradition'],
        4: ['Ability Score Improvement'],
        8: ['Ability Score Improvement'],
        12: ['Ability Score Improvement'],
        16: ['Ability Score Improvement'],
        18: ['Spell Mastery'],
        19: ['Ability Score Improvement'],
        20: ['Signature Spells'],
      },
      Cleric: {
        1: ['Spellcasting', 'Divine Domain'],
        2: ['Channel Divinity', 'Turn Undead'],
        4: ['Ability Score Improvement'],
        5: ['Destroy Undead (CR ½)'],
        8: ['Ability Score Improvement', 'Destroy Undead (CR 1)', 'Divine Strike'],
        10: ['Divine Intervention'],
        12: ['Ability Score Improvement'],
        14: ['Destroy Undead (CR 3)'],
        16: ['Ability Score Improvement'],
        17: ['Destroy Undead (CR 4)'],
        19: ['Ability Score Improvement'],
        20: ['Divine Intervention Improvement'],
      },
      Ranger: {
        1: ['Favored Enemy', 'Natural Explorer'],
        2: ['Fighting Style', 'Spellcasting'],
        3: ['Ranger Archetype', 'Primeval Awareness'],
        4: ['Ability Score Improvement'],
        5: ['Extra Attack'],
        8: ['Ability Score Improvement', 'Land\'s Stride'],
        10: ['Hide in Plain Sight'],
        12: ['Ability Score Improvement'],
        14: ['Vanish'],
        16: ['Ability Score Improvement'],
        18: ['Feral Senses'],
        19: ['Ability Score Improvement'],
        20: ['Foe Slayer'],
      },
      Paladin: {
        1: ['Divine Sense', 'Lay on Hands'],
        2: ['Fighting Style', 'Spellcasting', 'Divine Smite'],
        3: ['Divine Health', 'Sacred Oath'],
        4: ['Ability Score Improvement'],
        5: ['Extra Attack'],
        6: ['Aura of Protection'],
        8: ['Ability Score Improvement'],
        10: ['Aura of Courage'],
        11: ['Improved Divine Smite'],
        12: ['Ability Score Improvement'],
        14: ['Cleansing Touch'],
        16: ['Ability Score Improvement'],
        18: ['Aura improvements'],
        19: ['Ability Score Improvement'],
        20: ['Sacred Oath Capstone'],
      },
      Barbarian: {
        1: ['Rage', 'Unarmored Defense'],
        2: ['Reckless Attack', 'Danger Sense'],
        3: ['Primal Path'],
        4: ['Ability Score Improvement'],
        5: ['Extra Attack', 'Fast Movement'],
        7: ['Feral Instinct'],
        8: ['Ability Score Improvement'],
        9: ['Brutal Critical (1 die)'],
        11: ['Relentless Rage'],
        12: ['Ability Score Improvement'],
        13: ['Brutal Critical (2 dice)'],
        15: ['Persistent Rage'],
        16: ['Ability Score Improvement'],
        17: ['Brutal Critical (3 dice)'],
        18: ['Indomitable Might'],
        19: ['Ability Score Improvement'],
        20: ['Primal Champion'],
      },
      Bard: {
        1: ['Spellcasting', 'Bardic Inspiration (d6)'],
        2: ['Jack of All Trades', 'Song of Rest'],
        3: ['Bard College', 'Expertise'],
        4: ['Ability Score Improvement'],
        5: ['Bardic Inspiration (d8)', 'Font of Inspiration'],
        6: ['Countercharm'],
        8: ['Ability Score Improvement'],
        10: ['Bardic Inspiration (d10)', 'Magical Secrets'],
        12: ['Ability Score Improvement'],
        14: ['Magical Secrets'],
        15: ['Bardic Inspiration (d12)'],
        16: ['Ability Score Improvement'],
        19: ['Ability Score Improvement'],
        20: ['Superior Inspiration'],
      },
      Druid: {
        1: ['Druidic', 'Spellcasting'],
        2: ['Wild Shape', 'Druid Circle'],
        4: ['Ability Score Improvement', 'Wild Shape improvement (CR ½)'],
        8: ['Ability Score Improvement', 'Wild Shape improvement (CR 1)'],
        12: ['Ability Score Improvement'],
        16: ['Ability Score Improvement'],
        18: ['Timeless Body', 'Beast Spells'],
        19: ['Ability Score Improvement'],
        20: ['Archdruid'],
      },
      Monk: {
        1: ['Unarmored Defense', 'Martial Arts'],
        2: ['Ki', 'Unarmored Movement'],
        3: ['Monastic Tradition', 'Deflect Missiles'],
        4: ['Ability Score Improvement', 'Slow Fall'],
        5: ['Extra Attack', 'Stunning Strike'],
        6: ['Ki-Empowered Strikes'],
        7: ['Evasion', 'Stillness of Mind'],
        8: ['Ability Score Improvement'],
        10: ['Purity of Body'],
        12: ['Ability Score Improvement'],
        13: ['Tongue of the Sun and Moon'],
        14: ['Diamond Soul'],
        15: ['Timeless Body'],
        16: ['Ability Score Improvement'],
        18: ['Empty Body'],
        19: ['Ability Score Improvement'],
        20: ['Perfect Self'],
      },
      Sorcerer: {
        1: ['Spellcasting', 'Sorcerous Origin'],
        2: ['Font of Magic'],
        3: ['Metamagic (2)'],
        4: ['Ability Score Improvement'],
        8: ['Ability Score Improvement'],
        10: ['Metamagic (3)'],
        12: ['Ability Score Improvement'],
        16: ['Ability Score Improvement'],
        17: ['Metamagic (4)'],
        19: ['Ability Score Improvement'],
        20: ['Sorcerous Restoration'],
      },
      Warlock: {
        1: ['Otherworldly Patron', 'Pact Magic'],
        2: ['Eldritch Invocations'],
        3: ['Pact Boon'],
        4: ['Ability Score Improvement'],
        8: ['Ability Score Improvement'],
        11: ['Mystic Arcanum (6th)'],
        12: ['Ability Score Improvement'],
        13: ['Mystic Arcanum (7th)'],
        15: ['Mystic Arcanum (8th)'],
        16: ['Ability Score Improvement'],
        17: ['Mystic Arcanum (9th)'],
        19: ['Ability Score Improvement'],
        20: ['Eldritch Master'],
      },
      Artificer: {
        1: ['Magical Tinkering', 'Spellcasting'],
        2: ['Infuse Item'],
        3: ['Artificer Specialist'],
        4: ['Ability Score Improvement'],
        5: ['Infuse Item (4 items)'],
        6: ['Tool Expertise'],
        7: ['Flash of Genius'],
        8: ['Ability Score Improvement'],
        9: ['Infuse Item (5 items)'],
        10: ['Magic Item Adept'],
        11: ['Spell-Storing Item'],
        12: ['Ability Score Improvement'],
        13: ['Infuse Item (6 items)'],
        14: ['Magic Item Savant'],
        16: ['Ability Score Improvement'],
        17: ['Infuse Item (7 items)'],
        18: ['Magic Item Master'],
        19: ['Ability Score Improvement'],
        20: ['Soul of Artifice'],
      },
    };
 
    // Class features for the RECEIVING class's newly gained per-class levels.
    for (let lvl = receivingBefore + 1; lvl <= receivingAfter; lvl++) {
      const classFeatures = CLASS_FEATURES[receivingClass];
      if (classFeatures && classFeatures[lvl]) {
        newFeatures.push(...classFeatures[lvl]);
      }
    }

    // ── Subclass features for gained levels ──────────────────────────────────
    // Resolve the subclass tied to the receiving class: primary uses
    // character.subclass; a secondary class uses its multiclass entry's subclass.
    let receivingSubclass = '';
    if (receivingClass === character.class) {
      receivingSubclass = character.subclass || '';
    } else {
      const mcEntry = (character.multiclass || []).find(mc => mc.class === receivingClass);
      receivingSubclass = mcEntry?.subclass || '';
    }
 
    if (receivingSubclass) {
      try {
        const scMatches = await base44.asServiceRole.entities.Subclass.filter({
          class_name: receivingClass, name: receivingSubclass,
        }, 'name', 1);
        const sc = scMatches?.[0];
        if (sc?.features_by_level) {
          for (let lvl = receivingBefore + 1; lvl <= receivingAfter; lvl++) {
            const feats = sc.features_by_level[lvl] || sc.features_by_level[String(lvl)];
            if (feats) {
              (Array.isArray(feats) ? feats : [feats]).forEach(f => {
                const name = typeof f === 'string' ? f : (f?.name || '');
                if (name) newFeatures.push(name);
              });
            }
          }
        }
      } catch (e) {
        console.error('Subclass feature lookup failed:', e.message);
      }
    }
 
    // ── Build update payload ─────────────────────────────────────────────────
    const updates = {
      hp_max:            newMaxHP,
      hp_current:        character.hp_current + hpIncrease,
      proficiency_bonus: newProfBonus,
    };
 
    // Write the gained level(s) into the correct class slot.
    if (receivingClass === character.class) {
      // Advancing the primary class → bump character.level
      updates.level = (character.level || 1) + levelsGained;
    } else {
      // Advancing a secondary class → bump its multiclass entry (create if new)
      const mc = (character.multiclass || []).map(m => ({ ...m }));
      const idx = mc.findIndex(m => m.class === receivingClass);
      if (idx >= 0) {
        mc[idx].levels = (mc[idx].levels || 0) + levelsGained;
      } else {
        mc.push({ class: receivingClass, subclass: receivingSubclass || '', levels: levelsGained });
      }
      updates.multiclass = mc;
    }
 
    if (newAC !== null) updates.armor_class = newAC;
 
    if (Object.keys(newSpellSlots).length > 0) {
      updates.spell_slots = newSpellSlots;
    }
 
    const existingFeatures = character.features || [];
    const mergedFeatures = [...new Set([...existingFeatures, ...newFeatures])];
    if (newFeatures.length > 0) updates.features = mergedFeatures;

    // ── Racial innate spellcasting (unlock spells at level gates) ────────────
    // Drow, Tiefling, Forest Gnome, Genasi, Yuan-ti, Aarakocra gain innate
    // spells at specific character levels. Unlock any that are newly available.
    const racialKey = character.subrace || character.race;
    const racialEntry = RACIAL_SPELLS_DATA[racialKey] || RACIAL_SPELLS_DATA[character.race];
    if (racialEntry) {
      const knownSet = new Set(character.spells_known || []);
      const preparedSet = new Set(character.spells_prepared || []);
      let addedRacial = false;
      for (const spell of racialEntry.spells) {
        if (spell.level <= newTotalLevel) {
          if (!knownSet.has(spell.name)) { knownSet.add(spell.name); addedRacial = true; }
          preparedSet.add(spell.name);
        }
      }
      if (addedRacial) {
        updates.spells_known = Array.from(knownSet);
        updates.spells_prepared = Array.from(preparedSet);
        const racialFeat = `Racial Spellcasting (${racialEntry.stat.toUpperCase()})`;
        if (!mergedFeatures.includes(racialFeat)) {
          mergedFeatures.push(racialFeat);
          updates.features = mergedFeatures;
        }
      }
    }

    await base44.asServiceRole.entities.Character.update(character_id, updates);
 
    return Response.json({
      leveled_up:            true,
      old_total_level:       currentTotalLevel,
      new_total_level:       newTotalLevel,
      levels_gained:         levelsGained,
      advanced_class:        receivingClass,
      advanced_class_level:  receivingAfter,
      hp_increase:           hpIncrease,
      new_hp_max:            newMaxHP,
      new_proficiency_bonus: newProfBonus,
      new_features:          newFeatures,
      spell_slots_updated:   Object.keys(newSpellSlots).length > 0,
      ac_updated:            newAC !== null,
      message:               `🎉 Level Up! ${character.name} advanced ${receivingClass} to level ${receivingAfter} (total ${newTotalLevel})!`,
    });
 
  } catch (error) {
    console.error('Level up error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
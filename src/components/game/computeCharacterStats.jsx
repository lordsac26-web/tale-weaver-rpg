/**
 * Computes final character stats by scanning all equipped items,
 * including stat bonuses, AC adjustments, magical effects, and multiclass features.
 * Returns a "computed" overlay object that can be read alongside the raw character.
 */
import { CLASSES, calcStatMod, PROFICIENCY_BY_LEVEL, SKILL_STAT_MAP, SPELLCASTING_CLASSES } from './gameData';
import { MAGIC_PROPERTIES, ARMOR_TYPES, computeAC as baseComputeAC, getActiveEffects } from './itemData';

const STATS = ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'];

// ─── Multiclass Helpers ──────────────────────────────────────────────────────

// Full casters contribute their level; half-casters contribute half; third-casters a third
const CASTER_WEIGHT = {
  Wizard: 1, Sorcerer: 1, Bard: 1, Cleric: 1, Druid: 1, Oracle: 1, Witch: 1,
  Paladin: 0.5, Ranger: 0.5, Artificer: 0.5,
  Warlock: 0, // pact magic — separate
  Fighter: 0, Rogue: 0, Barbarian: 0, Monk: 0,
};

// Eldritch Knight / Arcane Trickster are 1/3 casters
const THIRD_CASTER_SUBCLASSES = ['Eldritch Knight', 'Arcane Trickster'];

/**
 * Given a multiclass array [{class, subclass, level}], compute the effective
 * caster level for the multiclass spell slot table.
 */
export function getMulticlassCasterLevel(multiclasses) {
  if (!multiclasses?.length) return 0;
  let total = 0;
  for (const mc of multiclasses) {
    const weight = CASTER_WEIGHT[mc.class] ?? 0;
    if (weight > 0) {
      total += Math.floor(mc.level * weight);
    } else if (THIRD_CASTER_SUBCLASSES.includes(mc.subclass)) {
      total += Math.floor(mc.level / 3);
    }
  }
  return total;
}

/**
 * Compute effective total character level from base + multiclass levels.
 */
export function getTotalLevel(character) {
  const baseLvl = character.level || 1;
  const mcLevels = (character.multiclass || []).reduce((sum, mc) => sum + (mc.level || 0), 0);
  return baseLvl + mcLevels;
}

/**
 * Get combined proficiency bonus based on total character level.
 */
export function getEffectiveProficiency(character) {
  const total = getTotalLevel(character);
  return PROFICIENCY_BY_LEVEL[Math.min(total, 20) - 1] || 2;
}

/**
 * Get merged saving throw proficiencies from base class + all multiclasses.
 */
export function getMergedSaves(character) {
  const saves = new Set(CLASSES[character.class]?.saves || []);
  // Multiclass rules: you only gain proficiency from your first class,
  // but some features explicitly grant saves. We'll include them for gameplay fun.
  // The PHB technically only grants some proficiencies from multiclass,
  // but we'll show all class saves for simplicity.
  for (const mc of (character.multiclass || [])) {
    const mcClass = CLASSES[mc.class];
    if (mcClass?.saves) mcClass.saves.forEach(s => saves.add(s));
  }
  return saves;
}

/**
 * Collect all class features unlocked across all classes at their respective levels.
 */
export function getAllClassFeatures(character) {
  const features = [];
  // Base class
  const baseClass = CLASSES[character.class];
  if (baseClass?.features) {
    Object.entries(baseClass.features).forEach(([lvl, feats]) => {
      if (parseInt(lvl) <= (character.level || 1)) {
        feats.forEach(f => features.push({ name: f, source: character.class, level: parseInt(lvl) }));
      }
    });
  }
  // Multiclass features
  for (const mc of (character.multiclass || [])) {
    const mcClass = CLASSES[mc.class];
    if (mcClass?.features) {
      Object.entries(mcClass.features).forEach(([lvl, feats]) => {
        if (parseInt(lvl) <= (mc.level || 1)) {
          feats.forEach(f => features.push({ name: f, source: mc.class, level: parseInt(lvl) }));
        }
      });
    }
  }
  return features;
}

/**
 * Determine if any class (base or multiclass) is a spellcaster.
 */
export function isAnyCaster(character) {
  if (SPELLCASTING_CLASSES.includes(character.class)) return true;
  return (character.multiclass || []).some(mc => SPELLCASTING_CLASSES.includes(mc.class));
}

// ─── Equipment Stat Computation ──────────────────────────────────────────────

/**
 * Scan all equipped items and return cumulative stat bonuses.
 * Supports both `magic_properties` array (SRD keys) and `modifiers` object (procedural items).
 */
function getEquippedStatBonuses(equipped) {
  const bonuses = {};
  const statSets = {};

  Object.values(equipped || {}).forEach(item => {
    if (!item) return;

    // From magic_properties (SRD-style keys into MAGIC_PROPERTIES)
    (item.magic_properties || []).forEach(propKey => {
      const prop = MAGIC_PROPERTIES[propKey];
      if (!prop?.effect) return;
      if (prop.effect.stat_bonus) {
        for (const [stat, val] of Object.entries(prop.effect.stat_bonus)) {
          bonuses[stat] = (bonuses[stat] || 0) + val;
        }
      }
      if (prop.effect.stat_set) {
        for (const [stat, val] of Object.entries(prop.effect.stat_set)) {
          statSets[stat] = Math.max(statSets[stat] || 0, val);
        }
      }
    });

    // From modifiers object (procedural items)
    const mods = item.modifiers || {};
    for (const stat of STATS) {
      if (mods[stat]) bonuses[stat] = (bonuses[stat] || 0) + mods[stat];
      if (mods[`${stat}_bonus`]) bonuses[stat] = (bonuses[stat] || 0) + mods[`${stat}_bonus`];
    }
  });

  return { bonuses, statSets };
}

/**
 * Compute AC considering equipped armor, shields, magic bonuses, procedural AC modifiers,
 * and class features like Unarmored Defense.
 */
function computeFullAC(character, equipped) {
  let ac = baseComputeAC(character, equipped);

  // Ring2 AC bonus
  const ring2 = equipped?.ring2;
  if (ring2?.ac_bonus) ac += ring2.ac_bonus;

  // Trinket/other slot AC bonuses
  ['trinket', 'helmet', 'gloves', 'boots', 'belt'].forEach(slot => {
    const item = equipped?.[slot];
    if (!item) return;
    if (item.ac_bonus) ac += item.ac_bonus;
    (item.magic_properties || []).forEach(pk => {
      const prop = MAGIC_PROPERTIES[pk];
      if (prop?.effect?.ac_bonus) ac += prop.effect.ac_bonus;
    });
    if (item.modifiers?.armor_class) ac += item.modifiers.armor_class;
  });

  // Procedural armor_class modifiers from mainhand/offhand
  ['mainhand', 'offhand'].forEach(slot => {
    const item = equipped?.[slot];
    if (item?.modifiers?.armor_class) ac += item.modifiers.armor_class;
  });

  // Unarmored Defense (Barbarian: 10 + DEX + CON, Monk: 10 + DEX + WIS)
  const allClasses = [character.class, ...(character.multiclass || []).map(mc => mc.class)];
  if (!equipped?.armor) {
    const dexMod = calcStatMod(character.dexterity || 10);
    if (allClasses.includes('Barbarian')) {
      const conMod = calcStatMod(character.constitution || 10);
      ac = Math.max(ac, 10 + dexMod + conMod);
    }
    if (allClasses.includes('Monk')) {
      const wisMod = calcStatMod(character.wisdom || 10);
      ac = Math.max(ac, 10 + dexMod + wisMod);
    }
  }

  return ac;
}

// ─── Main: computeCharacterStats ─────────────────────────────────────────────

/**
 * Returns a "computed" object with final effective values, accounting for:
 * - Base ability scores
 * - Equipment stat bonuses / stat sets
 * - Equipment AC
 * - Active magic effects (resistances, save bonuses, etc.)
 * - Multiclass proficiency, saves, features
 *
 * Usage: const computed = computeCharacterStats(character);
 *        computed.strength  // final STR (with item bonuses)
 *        computed.armor_class
 *        computed.proficiency_bonus
 *        computed.effects   // { resistances, save_bonus, spell_attack_bonus, ... }
 *        computed.allFeatures // [{ name, source, level }]
 */
export default function computeCharacterStats(character) {
  if (!character) return null;

  const equipped = character.equipped || {};
  const { bonuses, statSets } = getEquippedStatBonuses(equipped);
  const effects = getActiveEffects(equipped);

  // Build effective stats: apply stat sets first (e.g. "STR becomes 21"), then add bonuses
  const effectiveStats = {};
  for (const stat of STATS) {
    let base = character[stat] || 10;
    // Stat sets override if higher
    if (statSets[stat] && statSets[stat] > base) base = statSets[stat];
    // Add bonuses (cap at 30 for D&D 5E)
    base += (bonuses[stat] || 0);
    // Also add effects.stat_bonuses from getActiveEffects (which reads magic_properties)
    if (effects.stat_bonuses?.[stat]) base += effects.stat_bonuses[stat];
    // Apply stat sets from effects too
    if (effects.stat_sets?.[stat] && effects.stat_sets[stat] > base) base = effects.stat_sets[stat];
    effectiveStats[stat] = Math.min(base, 30);
  }

  // Proficiency from total level
  const profBonus = getEffectiveProficiency(character);

  // AC
  // Temporarily override character stats with effective stats for AC calculation
  const charForAC = { ...character, ...effectiveStats };
  const ac = computeFullAC(charForAC, equipped);

  // Saves
  const mergedSaves = getMergedSaves(character);

  // Features
  const allFeatures = getAllClassFeatures(character);

  // Caster info
  const caster = isAnyCaster(character);

  // Speed adjustments from items
  let speed = character.speed || 30;
  Object.values(equipped).forEach(item => {
    if (item?.modifiers?.speed) speed += item.modifiers.speed;
  });

  // Attack bonuses from weapon
  const weapon = equipped.mainhand || equipped.weapon;
  let meleeAttackBonus = 0;
  let meleeExtraDamage = '';
  if (weapon) {
    meleeAttackBonus += (weapon.attack_bonus || 0);
    if (weapon.modifiers?.attack_bonus) meleeAttackBonus += weapon.modifiers.attack_bonus;
    // Collect extra damage from magic properties
    const extras = [];
    (weapon.magic_properties || []).forEach(pk => {
      const prop = MAGIC_PROPERTIES[pk];
      if (prop?.effect?.extra_damage) {
        extras.push(`+${prop.effect.extra_damage} ${prop.effect.extra_damage_type || ''}`);
      }
    });
    meleeExtraDamage = extras.join(', ');
  }

  // Compile item summary for UI display
  const itemBonusSummary = [];
  for (const stat of STATS) {
    const total = (bonuses[stat] || 0) + (effects.stat_bonuses?.[stat] || 0);
    if (total) itemBonusSummary.push({ stat, bonus: total, type: 'bonus' });
  }
  for (const [stat, val] of Object.entries(statSets)) {
    itemBonusSummary.push({ stat, value: val, type: 'set' });
  }
  if (effects.stat_sets) {
    for (const [stat, val] of Object.entries(effects.stat_sets)) {
      if (!statSets[stat]) itemBonusSummary.push({ stat, value: val, type: 'set' });
    }
  }

  return {
    // Effective ability scores
    ...effectiveStats,
    // Derived
    armor_class: ac,
    proficiency_bonus: profBonus,
    total_level: getTotalLevel(character),
    speed,
    // Combat
    melee_attack_bonus: meleeAttackBonus,
    melee_extra_damage: meleeExtraDamage,
    // Magic effects
    effects: {
      resistances: effects.resistances || [],
      save_bonus: effects.save_bonus || 0,
      spell_attack_bonus: effects.spell_attack_bonus || 0,
      spell_save_dc_bonus: effects.spell_save_dc_bonus || 0,
      no_crits: effects.no_crits || false,
      regeneration: effects.regeneration || null,
      luck: effects.luck || 0,
    },
    // Multiclass
    merged_saves: mergedSaves,
    all_features: allFeatures,
    is_caster: caster,
    multiclass_caster_level: getMulticlassCasterLevel([
      { class: character.class, subclass: character.subclass, level: character.level || 1 },
      ...(character.multiclass || []),
    ]),
    // Item bonus breakdown for tooltip display
    item_bonus_summary: itemBonusSummary,
  };
}
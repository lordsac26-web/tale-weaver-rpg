import { CLASSES, PROFICIENCY_BY_LEVEL } from './gameData';
import {
  SPELLS_BY_CLASS,
  SPELLCASTING_ABILITY,
  SPELL_SLOTS_BY_CLASS_LEVEL,
  CANTRIPS_KNOWN,
  SPELL_DETAILS,
} from './spellData';

const FULL_CASTERS = ['Wizard', 'Sorcerer', 'Bard', 'Cleric', 'Druid'];
const HALF_CASTERS = ['Paladin', 'Ranger', 'Artificer'];
const THIRD_CASTER_CLASSES = ['Fighter', 'Rogue'];

const isArcaneSubclass = (subclass = '') => {
  const value = String(subclass).toLowerCase();
  return value.includes('eldritch') || value.includes('arcane');
};

export function getClassBreakdown(character = {}) {
  return [
    {
      className: character.class,
      subclass: character.subclass || '',
      levels: character.level || 1,
      primary: true,
    },
    ...(character.multiclass || []).map(mc => ({
      className: mc.class,
      subclass: mc.subclass || '',
      levels: mc.levels || 1,
      primary: false,
    })),
  ].filter(entry => entry.className);
}

export function getTotalCharacterLevel(character = {}) {
  return getClassBreakdown(character).reduce((sum, entry) => sum + (entry.levels || 0), 0) || 1;
}

export function getTotalProficiencyBonus(character = {}) {
  return PROFICIENCY_BY_LEVEL[getTotalCharacterLevel(character) - 1] || 2;
}

export function getSpellcastingEntries(character = {}) {
  return getClassBreakdown(character)
    .map(entry => {
      if (SPELLS_BY_CLASS[entry.className]) {
        return {
          ...entry,
          spellClass: entry.className,
          ability: SPELLCASTING_ABILITY[entry.className],
        };
      }

      if (THIRD_CASTER_CLASSES.includes(entry.className) && isArcaneSubclass(entry.subclass)) {
        return {
          ...entry,
          spellClass: 'Wizard',
          ability: 'intelligence',
          thirdCaster: true,
        };
      }

      return null;
    })
    .filter(Boolean);
}

export function characterHasSpellcasting(character = {}) {
  return getSpellcastingEntries(character).length > 0;
}

export function getPrimarySpellcastingEntry(character = {}) {
  const entries = getSpellcastingEntries(character);
  return entries.find(entry => entry.primary) || entries[0] || null;
}

export function getMaxSpellLevelForEntry(entry) {
  const effectiveLevel = entry.thirdCaster ? Math.max(1, Math.floor((entry.levels || 1) / 3)) : entry.levels;
  const slots = SPELL_SLOTS_BY_CLASS_LEVEL[entry.spellClass]?.[effectiveLevel] || [];
  for (let i = slots.length - 1; i >= 0; i--) {
    if ((slots[i] || 0) > 0) return i + 1;
  }
  return 0;
}

export function getCombinedSpellList(character = {}) {
  const combined = { cantrips: [] };

  getSpellcastingEntries(character).forEach(entry => {
    const spellList = SPELLS_BY_CLASS[entry.spellClass] || {};
    const maxSpellLevel = getMaxSpellLevelForEntry(entry);

    (spellList.cantrips || []).forEach(name => {
      if (!combined.cantrips.includes(name)) combined.cantrips.push(name);
    });

    for (let level = 1; level <= maxSpellLevel; level++) {
      combined[level] = combined[level] || [];
      (spellList[level] || []).forEach(name => {
        if (!combined[level].includes(name)) combined[level].push(name);
      });
    }
  });

  return combined;
}

export function getMaxCantripsKnown(character = {}) {
  return getSpellcastingEntries(character).reduce((total, entry) => {
    return total + (CANTRIPS_KNOWN[entry.spellClass]?.[entry.levels - 1] || 0);
  }, 0);
}

export function getMaxSpellsKnown(character = {}) {
  const entries = getSpellcastingEntries(character);
  if (entries.some(entry => ['Cleric', 'Druid', 'Paladin', 'Ranger', 'Artificer'].includes(entry.className))) {
    return 999;
  }

  return entries.reduce((total, entry) => {
    if (entry.className === 'Wizard') return total + 6 + entry.levels;
    if (entry.className === 'Sorcerer') return total + Math.ceil(entry.levels / 2) + entry.levels;
    if (entry.className === 'Bard') return total + Math.ceil(entry.levels / 2) + entry.levels;
    if (entry.className === 'Warlock') return total + Math.ceil(entry.levels / 2) + 1;
    if (entry.thirdCaster) return total + Math.max(1, Math.ceil(entry.levels / 3));
    return total;
  }, 0);
}

export function getMulticlassSpellSlots(character = {}) {
  const entries = getSpellcastingEntries(character);
  if (entries.length === 0) return [0,0,0,0,0,0,0,0,0];

  // Separate Warlock (Pact Magic) from standard spellcasting classes
  const warlockEntry = entries.find(e => e.className === 'Warlock');
  const standardEntries = entries.filter(e => e.className !== 'Warlock');

  let standardSlots = [0,0,0,0,0,0,0,0,0];

  if (standardEntries.length === 1 && entries.length === 1) {
    // Single class (not Warlock)
    standardSlots = SPELL_SLOTS_BY_CLASS_LEVEL[standardEntries[0].spellClass]?.[standardEntries[0].levels] || [0,0,0,0,0,0,0,0,0];
  } else if (standardEntries.length > 0) {
    // Multiclass standard casters
    let casterLevel = 0;
    standardEntries.forEach(entry => {
      if (FULL_CASTERS.includes(entry.className)) casterLevel += entry.levels;
      else if (entry.className === 'Artificer') casterLevel += Math.ceil(entry.levels / 2);
      else if (HALF_CASTERS.includes(entry.className)) casterLevel += Math.floor(entry.levels / 2);
      else if (entry.thirdCaster) casterLevel += Math.floor(entry.levels / 3);
    });

    casterLevel = Math.max(1, Math.min(20, casterLevel));
    standardSlots = SPELL_SLOTS_BY_CLASS_LEVEL.Wizard[casterLevel] || [0,0,0,0,0,0,0,0,0];
  }

  // Combine standard slots with Pact Magic slots if character has Warlock levels
  if (warlockEntry) {
    const warlockSlots = SPELL_SLOTS_BY_CLASS_LEVEL.Warlock[warlockEntry.levels] || [0,0,0,0,0,0,0,0,0];
    return standardSlots.map((val, i) => val + (warlockSlots[i] || 0));
  }

  return standardSlots;
}

export function getMulticlassHitPoints(character = {}, conMod = 0) {
  const classes = getClassBreakdown(character);
  if (classes.length === 0) return 1;

  return classes.reduce((total, entry, index) => {
    const hitDie = CLASSES[entry.className]?.hit_die || 8;
    const averageGain = Math.floor(hitDie / 2) + 1 + conMod;
    if (index === 0) {
      return total + hitDie + conMod + Math.max(0, entry.levels - 1) * averageGain;
    }
    return total + entry.levels * averageGain;
  }, 0);
}

export function getClassFeatureSections(character = {}) {
  return getClassBreakdown(character).map(entry => {
    const classData = CLASSES[entry.className] || {};
    const features = [];

    Object.entries(classData.features || {}).forEach(([level, names]) => {
      if (parseInt(level) <= entry.levels) {
        names.forEach(name => features.push({ name, level: parseInt(level), source: entry.className }));
      }
    });

    const subclassData = (classData.subclasses || []).find(sub => sub.name === entry.subclass);
    Object.entries(subclassData?.features || {}).forEach(([level, names]) => {
      if (parseInt(level) <= entry.levels) {
        names.forEach(name => features.push({ name, level: parseInt(level), source: entry.subclass || entry.className }));
      }
    });

    return { ...entry, features };
  });
}

export function getSpellLevel(spellName) {
  return SPELL_DETAILS[spellName]?.level ?? 1;
}

/**
 * Returns an array of { name, level, sourceClass } for all spells available
 * across all spellcasting entries. Each spell is tagged with the class it
 * comes from so the UI can group/filter by source. Deduplicates by name —
 * if the same spell appears on multiple lists, the first source wins.
 */
export function getCombinedSpellListWithSource(character = {}) {
  const seen = new Set();
  const result = [];

  getSpellcastingEntries(character).forEach(entry => {
    const spellList = SPELLS_BY_CLASS[entry.spellClass] || {};
    const maxSpellLevel = getMaxSpellLevelForEntry(entry);

    (spellList.cantrips || []).forEach(name => {
      if (!seen.has(name)) { seen.add(name); result.push({ name, level: 0, sourceClass: entry.className }); }
    });

    for (let level = 1; level <= maxSpellLevel; level++) {
      (spellList[level] || []).forEach(name => {
        if (!seen.has(name)) { seen.add(name); result.push({ name, level, sourceClass: entry.className }); }
      });
    }
  });

  return result;
}

/**
 * For each spellcasting entry, compute the max prepared count using that
 * entry's class level + that entry's spellcasting modifier.
 * Returns an array of { className, maxPrepared, ability, abilityMod, classLevel }.
 */
const PREPARATION_CLASSES = ['Wizard', 'Cleric', 'Druid', 'Paladin'];

export function getPreparationLimits(character = {}) {
  const entries = getSpellcastingEntries(character);
  const calcMod = (score) => Math.floor(((score || 10) - 10) / 2);

  return entries
    .filter(e => PREPARATION_CLASSES.includes(e.className))
    .map(entry => {
      const ability = entry.ability;
      const abilityMod = calcMod(character[ability] || 10);
      const maxPrepared = Math.max(1, entry.levels + abilityMod);
      return { className: entry.className, maxPrepared, ability, abilityMod, classLevel: entry.levels };
    });
}
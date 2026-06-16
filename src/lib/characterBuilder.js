// ─────────────────────────────────────────────────────────────────────────────
// characterBuilder.js
// Pure character-finalization helpers extracted from pages/CharacterCreation.
// These take a character draft and layer on racial bonuses, feats, class
// choices, derived stats, features, spell slots, and skills.
//
// Keeping these here (instead of inline in the page) makes them reusable
// (e.g. for review previews, level-up flows) and keeps the page focused on UI.
// ─────────────────────────────────────────────────────────────────────────────
import { base44 } from '@/api/base44Client';
import {
  RACES, CLASSES, BACKGROUNDS,
  calcStatMod,
  PROFICIENCY_BY_LEVEL,
} from '@/components/game/gameData';
import { computeFeatEffects } from '@/components/game/featEffects';
import {
  getMulticlassHitPoints,
  getMulticlassSpellSlots,
  getTotalCharacterLevel,
} from '@/components/game/multiclassUtils';

const STATS = ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'];

// Apply racial + subrace ability score bonuses (including player stat choices).
export function applyRacialBonuses(char) {
  const race = RACES[char.race];
  if (!race) return char;

  let bonuses = { ...race.stat_bonuses };

  // Apply subrace bonuses
  if (char.subrace && race.subraces?.length > 0) {
    const subrace = race.subraces.find(s => s.name === char.subrace);
    if (subrace?.stat_bonuses) {
      Object.entries(subrace.stat_bonuses).forEach(([stat, val]) => {
        bonuses[stat] = (bonuses[stat] || 0) + val;
      });
    }

    // Handle stat_choices for subraces (e.g., Variant Human)
    if (subrace?.stat_choices && char.chosen_stat_bonuses?.length > 0) {
      char.chosen_stat_bonuses.forEach(stat => {
        bonuses[stat] = (bonuses[stat] || 0) + 1;
      });
    }
  }

  // Handle stat_choices for main race (e.g., Half-Elf)
  if (race.stat_choices && char.chosen_stat_bonuses?.length > 0 && !char.subrace) {
    char.chosen_stat_bonuses.forEach(stat => {
      bonuses[stat] = (bonuses[stat] || 0) + 1;
    });
  }

  const updated = { ...char };
  STATS.forEach(stat => { updated[stat] = (updated[stat] || 10) + (bonuses[stat] || 0); });
  return updated;
}

// Compute HP, AC, initiative, speed, proficiency bonus, and save proficiencies.
export function updateDerivedStats(char) {
  const conMod = calcStatMod(char.constitution);
  const dexMod = calcStatMod(char.dexterity);
  const wisMod = calcStatMod(char.wisdom);
  const totalLevel = getTotalCharacterLevel(char);
  const profBonus = PROFICIENCY_BY_LEVEL[totalLevel - 1] || 2;
  const hp = getMulticlassHitPoints(char, conMod);

  // ── Armor Class ────────────────────────────────────────────────────────
  // Per D&D 5e: choose the BEST applicable AC formula
  let armorClass = 10 + dexMod;

  // Class Unarmored Defense
  if (char.class === 'Monk') {
    armorClass = Math.max(armorClass, 10 + dexMod + wisMod);
  } else if (char.class === 'Barbarian') {
    armorClass = Math.max(armorClass, 10 + dexMod + conMod);
  }

  // Racial / feat Natural Armor — always an option, pick highest
  if (char.race === 'Tortle') {
    armorClass = Math.max(armorClass, 17);
  } else if (char.race === 'Lizardfolk') {
    armorClass = Math.max(armorClass, 13 + dexMod);
  } else if (char.race === 'Warforged') {
    armorClass = Math.max(armorClass, 11 + dexMod);
  }
  if ((char.feats || []).includes('Dragon Hide')) {
    armorClass = Math.max(armorClass, 13 + dexMod);
  }

  const hasFeat = (name) => (char.feats || []).includes(name);
  const featHpBonus = hasFeat('Tough') ? 2 * totalLevel : 0;
  const featInitiativeBonus = hasFeat('Alert') ? 5 : 0;
  const featSpeedBonus = (hasFeat('Mobile') ? 10 : 0) + (hasFeat('Squat Nimbleness') ? 5 : 0);

  // ── Saving Throw Proficiencies ─────────────────────────────────────────
  const classSaves = CLASSES[char.class]?.saves || [];
  const saving_throws = {};
  STATS.forEach(s => { saving_throws[s] = classSaves.includes(s); });
  Object.assign(saving_throws, char.saving_throws || {});

  return {
    ...char,
    hp_max: hp + featHpBonus,
    hp_current: hp + featHpBonus,
    armor_class: armorClass,
    initiative: dexMod + featInitiativeBonus,
    speed: (RACES[char.race]?.speed || 30) + featSpeedBonus,
    proficiency_bonus: profBonus,
    saving_throws,
  };
}

// Merge primary class level-appropriate features into char.features.
export function buildClassFeatures(char) {
  const classData = CLASSES[char.class];
  const features = [...(char.features || [])];
  Object.entries(classData?.features || {}).forEach(([lvl, feats]) => {
    if (parseInt(lvl) <= (char.level || 1)) feats.forEach(f => {
      if (!features.includes(f)) features.push(f);
    });
  });
  return { ...char, features };
}

// Merge the chosen subclass's level-appropriate features (reads Subclass entity).
// Async; safely no-ops if no subclass is selected.
export async function buildSubclassFeatures(char) {
  if (!char.subclass) return char;
  const matches = await base44.entities.Subclass.filter({
    class_name: char.class, name: char.subclass,
  }, 'name', 1);
  const sc = matches?.[0];
  if (!sc?.features_by_level) return char;
  const features = [...(char.features || [])];
  Object.entries(sc.features_by_level).forEach(([lvl, feats]) => {
    if (parseInt(lvl) <= (char.level || 1)) {
      (Array.isArray(feats) ? feats : [feats]).forEach(f => {
        const name = typeof f === 'string' ? f : (f?.name || '');
        if (name && !features.includes(name)) features.push(name);
      });
    }
  });
  return { ...char, features };
}

// Apply class_choices (fighting style, expertise, etc.).
export function applyClassChoices(char) {
  const cc = char.class_choices || {};
  const updated = { ...char };

  // Fighting Style → stored on character.fighting_style (combat engine reads it)
  if (cc.fighting_style) {
    updated.fighting_style = cc.fighting_style;
  }

  // Expertise → mark skills as 'expert' in skills object
  if (cc.expertise && Array.isArray(cc.expertise)) {
    const skills = { ...updated.skills };
    cc.expertise.forEach(s => { if (skills[s]) skills[s] = 'expert'; });
    updated.skills = skills;
  }

  return updated;
}

// Initialize used-spell-slot tracking based on (multiclass) caster level.
export function buildSpellSlots(char) {
  const slots = getMulticlassSpellSlots(char);
  const spell_slots = {};
  slots.forEach((max, i) => { if (max > 0) spell_slots[`level_${i + 1}`] = 0; });
  return { ...char, spell_slots };
}

// Apply racial skill proficiencies (e.g. Elf → Perception). Won't overwrite picks.
export function buildRacialSkills(char) {
  const raceData = RACES[char.race];
  if (!raceData?.skill_proficiencies?.length) return char;
  const skills = { ...char.skills };
  raceData.skill_proficiencies.forEach(skill => {
    if (!skills[skill]) skills[skill] = 'proficient';
  });
  return { ...char, skills };
}

// Apply all feat mechanical effects via the centralized engine.
export function applyFeatBonuses(char) {
  const featUpdates = computeFeatEffects(char, char.feats || [], char.feat_stat_choices || {});
  return { ...char, ...featUpdates };
}

// Merge multiclass (secondary classes + their subclasses) features in place.
function applyMulticlassFeatures(finalChar) {
  const multiclass = finalChar.multiclass || [];
  if (multiclass.length === 0) return finalChar;
  multiclass.forEach(mc => {
    const mcClassData = CLASSES[mc.class];
    if (!mcClassData) return;
    Object.entries(mcClassData.features || {}).forEach(([lvl, feats]) => {
      if (parseInt(lvl) <= (mc.levels || 1)) {
        feats.forEach(f => { if (!finalChar.features.includes(f)) finalChar.features.push(f); });
      }
    });
    const mcSubclass = (mcClassData.subclasses || []).find(sub => sub.name === mc.subclass);
    Object.entries(mcSubclass?.features || {}).forEach(([lvl, feats]) => {
      if (parseInt(lvl) <= (mc.levels || 1)) {
        feats.forEach(f => { if (!finalChar.features.includes(f)) finalChar.features.push(f); });
      }
    });
  });
  return finalChar;
}

// Apply background skill proficiencies + starting equipment.
function applyBackground(finalChar) {
  const bgData = BACKGROUNDS.find(b => b.name === finalChar.background);
  if (!bgData) return finalChar;
  const skills = { ...finalChar.skills };
  bgData.skills.forEach(s => { if (!skills[s]) skills[s] = 'proficient'; });
  finalChar = { ...finalChar, skills };
  if (!finalChar.inventory?.length) {
    finalChar.inventory = bgData.equipment.map(e => ({ name: e, type: 'gear', weight: 1 }));
  }
  return finalChar;
}

// Strip transient creation-only fields before persisting.
function stripCreationFields(finalChar) {
  delete finalChar._gear_customized;
  delete finalChar.chosen_stat_bonuses;
  delete finalChar.feat_stat_choices;
  delete finalChar._feat_choices_complete;
  delete finalChar._feat_ac_bonus;
  delete finalChar._feat_flags;
  delete finalChar._stats_method;
  delete finalChar._standard_complete;
  return finalChar;
}

// Full finalization pipeline used on save. Returns a clean, persistable character.
export async function finalizeCharacter(character) {
  let finalChar = applyRacialBonuses(character);
  finalChar = applyFeatBonuses(finalChar);   // feats before derived stats so HP/AC use final values
  finalChar = applyClassChoices(finalChar);  // fighting style, expertise, etc.
  finalChar = updateDerivedStats(finalChar);
  finalChar = buildClassFeatures(finalChar);
  finalChar = await buildSubclassFeatures(finalChar);
  finalChar = buildSpellSlots(finalChar);
  finalChar = buildRacialSkills(finalChar);

  finalChar = applyMulticlassFeatures(finalChar);

  // Apply feat AC bonus (e.g. Dual Wielder +1)
  if (finalChar._feat_ac_bonus) {
    finalChar.armor_class = (finalChar.armor_class || 10) + finalChar._feat_ac_bonus;
  }

  finalChar = applyBackground(finalChar);
  finalChar = stripCreationFields(finalChar);
  return finalChar;
}

// Lightweight build used for the live Review preview (no DB / no persistence).
export function buildReviewCharacter(character) {
  const reviewCharBase = applyFeatBonuses(applyRacialBonuses(character));
  const reviewChar = updateDerivedStats(reviewCharBase);
  if (reviewCharBase._feat_ac_bonus) {
    reviewChar.armor_class = (reviewChar.armor_class || 10) + reviewCharBase._feat_ac_bonus;
  }
  return reviewChar;
}
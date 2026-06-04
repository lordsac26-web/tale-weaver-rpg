/**
 * Centralized feat effects engine — used by both character creation and in-game growth.
 * Maps feat names to their mechanical effects and provides an applicator function.
 *
 * All numeric stat bonuses, HP bonuses, AC bonuses, initiative bonuses, speed bonuses,
 * and special flags are defined here so that:
 * - CharacterCreation.applyFeatBonuses()
 * - CharacterGrowthTab.handlePurchaseFeat()
 * both produce identical, correct results.
 */

import { FEATS } from './featData';
import { SPELL_FEAT_CONFIG, SKILL_FEAT_CONFIG } from './featChoiceConfig';

// ─── Static effect map for feats that grant automatic mechanical bonuses ─────
// Keys match feat names from featData.js exactly.
// Only feats with mechanical stat-like effects need entries here;
// feats that are purely narrative or handled by the combat engine (e.g. Sentinel)
// don't need entries — they're tracked by name in character.feats.
export const FEAT_EFFECTS = {
  // ── Stat bonuses (fixed) ──
  'Actor':               { stat_bonus: { charisma: 1 } },
  'Durable':             { stat_bonus: { constitution: 1 } },
  'Keen Mind':           { stat_bonus: { intelligence: 1 } },
  'Linguist':            { stat_bonus: { intelligence: 1 } },
  'Grappler':            { stat_bonus: { strength: 1 } },
  'Heavily Armored':     { stat_bonus: { strength: 1 } },
  'Infernal Constitution': { stat_bonus: { constitution: 1 } },

  // ── Stat bonuses (player choice — handled via feat_stat_choices) ──
  // These are applied separately via applyFeatStatChoices()

  // ── HP bonuses ──
  'Tough':               { hp_per_level: 2 },

  // ── AC bonuses ──
  'Dual Wielder':        { ac_bonus: 1, note: 'Only when dual wielding — enforced by combat engine' },

  // ── Initiative bonuses ──
  'Alert':               { initiative: 5 },

  // ── Speed bonuses ──
  'Mobile':              { speed: 10 },
  'Squat Nimbleness':    { speed: 5 },

  // ── Saving throw proficiency (choice-based — via Resilient) ──
  // Resilient's +1 stat and save prof are handled in applyFeatStatChoices()

  // ── Special flags (checked by name in combat/skill engines) ──
  'Lucky':               { flag: 'lucky', luck_points: 3 },
  'War Caster':          { flag: 'war_caster' },
  'Mage Slayer':         { flag: 'mage_slayer' },
  'Sentinel':            { flag: 'sentinel' },
  'Great Weapon Master':  { flag: 'great_weapon_master' },
  'Sharpshooter':        { flag: 'sharpshooter' },
  'Polearm Master':      { flag: 'polearm_master' },
  'Crossbow Expert':     { flag: 'crossbow_expert' },
  'Shield Master':       { flag: 'shield_master' },
  'Savage Attacker':     { flag: 'savage_attacker' },
  'Charger':             { flag: 'charger' },
  'Mounted Combatant':   { flag: 'mounted_combatant' },

  // ── Passive perception / investigation ──
  'Observant':           { passive_perception: 5, passive_investigation: 5 },

  // ── Damage reduction ──
  'Heavy Armor Master':  { stat_bonus: { strength: 1 }, damage_reduction_bps: 3 },
};

/**
 * Apply all feat effects to a character object.
 * Call this during character creation (final step) or when a feat is gained in-game.
 *
 * @param {Object} character - The character to modify (will not be mutated)
 * @param {string[]} featNames - Array of feat name strings
 * @param {Object} featStatChoices - Map of featName → chosen stat (for feats with asi_choices)
 * @returns {Object} updates - Fields to merge into the character
 */
export function computeFeatEffects(character, featNames, featStatChoices = {}) {
  const updates = {};
  const statBonuses = {};
  let hpBonus = 0;
  let acBonus = 0;
  let initBonus = 0;
  let speedBonus = 0;
  let luckPoints = 0;
  const extraSaveProfs = {};
  const flags = [];
  const knownSpells = new Set(character.spells_known || []);
  const preparedSpells = new Set(character.spells_prepared || []);
  const features = new Set(character.features || []);
  const skills = { ...(character.skills || {}) };
  const featSpellChoices = character.class_choices?.feat_spell_choices || {};
  const featSkillChoices = character.class_choices?.feat_skill_choices || {};
  const resistances = new Set(character.resistances || []);

  for (const featName of featNames) {
    const feat = FEATS.find(f => f.name === featName) || { name: featName };

    // 1) Fixed stat bonuses from asi_bonus in featData
    if (feat.asi_bonus) {
      Object.entries(feat.asi_bonus).forEach(([stat, val]) => {
        statBonuses[stat] = (statBonuses[stat] || 0) + val;
      });
    }

    // 2) Player-chosen stat bonuses (Athlete, Resilient, etc.)
    if (feat.asi_choices && featStatChoices[featName]) {
      const chosen = featStatChoices[featName];
      if (feat.asi_choices.includes(chosen)) {
        statBonuses[chosen] = (statBonuses[chosen] || 0) + 1;
      }
    }

    // 3) Resilient: also grants saving throw proficiency
    if (feat.grants_save_proficiency && featStatChoices[featName]) {
      extraSaveProfs[featStatChoices[featName]] = true;
    }

    // 4) Effects from our static map
    const effect = FEAT_EFFECTS[featName];
    if (effect) {
      if (effect.stat_bonus) {
        Object.entries(effect.stat_bonus).forEach(([stat, val]) => {
          // Don't double-count if the same stat is already in feat.asi_bonus
          if (!feat.asi_bonus?.[stat]) {
            statBonuses[stat] = (statBonuses[stat] || 0) + val;
          }
        });
      }
      if (effect.hp_per_level) hpBonus += effect.hp_per_level * (character.level || 1);
      if (effect.ac_bonus) acBonus += effect.ac_bonus;
      if (effect.initiative) initBonus += effect.initiative;
      if (effect.speed) speedBonus += effect.speed;
      if (effect.flag) flags.push(effect.flag);
      // Lucky feat: grant luck points (PHB p.167)
      if (effect.luck_points) luckPoints += effect.luck_points;
    }

    // 5) Feats with spell choices (Magic Initiate, Mystical Talent, etc.)
    if (SPELL_FEAT_CONFIG[featName]) {
      const choice = featSpellChoices[featName];
      if (choice?.className) {
        (choice.cantrips || []).forEach(spell => knownSpells.add(spell));
        (choice.spells || []).forEach(spell => {
          knownSpells.add(spell);
          preparedSpells.add(spell);
        });
        features.add(`${featName}: ${choice.className} spell list`);
      }
    }

    // 6) Feats with skill choices
    if (SKILL_FEAT_CONFIG[featName]) {
      const chosenSkills = featSkillChoices[featName]?.skills || [];
      chosenSkills.forEach(skill => {
        if (featName === 'Prodigy' && (skills[skill] === 'proficient' || skills[skill] === true)) skills[skill] = 'expert';
        else if (!skills[skill]) skills[skill] = 'proficient';
      });
    }

    // 7) Fixed feat properties not covered by numeric bonuses
    if (featName === 'Infernal Constitution') {
      resistances.add('cold');
      resistances.add('poison');
    }
    if (featName === 'Dragon Hide') features.add('Dragon Hide Natural Armor (AC 13 + DEX)');
    if (featName === 'Heavily Armored') features.add('Heavy Armor Proficiency');
    if (featName === 'Lightly Armored') features.add('Light Armor Proficiency');
    if (featName === 'Moderately Armored') features.add('Medium Armor and Shield Proficiency');
    if (featName === 'Weapon Master') features.add('Weapon Master: four weapon proficiencies');
    if (featName === 'Martial Adept') features.add('Martial Adept: two maneuvers and one superiority die (d6)');
    if (featName === 'Drow High Magic') ['Detect Magic', 'Levitate', 'Dispel Magic'].forEach(spell => knownSpells.add(spell));
    if (featName === 'Fey Teleportation') knownSpells.add('Misty Step');
    if (featName === 'Wood Elf Magic') ['Druidcraft', 'Longstrider', 'Pass without Trace'].forEach(spell => knownSpells.add(spell));
  }

  // Apply stat bonuses (cap at 20 per D&D rules)
  const STATS = ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'];
  STATS.forEach(stat => {
    if (statBonuses[stat]) {
      updates[stat] = Math.min(20, (character[stat] || 10) + statBonuses[stat]);
    }
  });

  // HP
  if (hpBonus > 0) {
    updates.hp_max = (character.hp_max || 0) + hpBonus;
    updates.hp_current = (character.hp_current || 0) + hpBonus;
  }

  // AC (additive — Dual Wielder)
  if (acBonus > 0) {
    updates._feat_ac_bonus = acBonus; // stored separately, applied by AC calculation
  }

  // Initiative
  if (initBonus > 0) {
    updates.initiative = (character.initiative || 0) + initBonus;
  }

  // Speed
  if (speedBonus > 0) {
    updates.speed = (character.speed || 30) + speedBonus;
  }

  // Saving throw proficiencies from Resilient
  if (Object.keys(extraSaveProfs).length > 0) {
    updates.saving_throws = { ...(character.saving_throws || {}), ...extraSaveProfs };
  }

  // Feat flags (for combat engine to check)
  if (flags.length > 0) {
    updates._feat_flags = flags;
  }

  // Lucky feat: set max luck points and top up current
  if (luckPoints > 0) {
    updates.luck_points_max = luckPoints;
    updates.luck_points_remaining = luckPoints;
  }

  if (knownSpells.size > (character.spells_known || []).length) {
    updates.spells_known = Array.from(knownSpells);
  }
  if (preparedSpells.size > (character.spells_prepared || []).length) {
    updates.spells_prepared = Array.from(preparedSpells);
  }
  if (Object.keys(skills).length !== Object.keys(character.skills || {}).length || Object.entries(skills).some(([k, v]) => character.skills?.[k] !== v)) {
    updates.skills = skills;
  }
  if (features.size > (character.features || []).length) {
    updates.features = Array.from(features);
  }
  if (resistances.size > (character.resistances || []).length) {
    updates.resistances = Array.from(resistances);
  }

  return updates;
}

/**
 * Get a human-readable summary of what a feat grants mechanically.
 * Used in UI tooltips and confirmation dialogs.
 */
export function getFeatEffectSummary(featName) {
  const feat = FEATS.find(f => f.name === featName);
  if (!feat) return [];
  const lines = [];

  if (feat.asi_bonus) {
    Object.entries(feat.asi_bonus).forEach(([stat, val]) => {
      lines.push(`+${val} ${stat.charAt(0).toUpperCase() + stat.slice(1)}`);
    });
  }
  if (feat.asi_choices) {
    lines.push(`+1 to chosen ability (${feat.asi_choices.map(s => s.slice(0,3).toUpperCase()).join('/')})`);
  }

  const effect = FEAT_EFFECTS[featName];
  if (effect) {
    if (effect.hp_per_level) lines.push(`+${effect.hp_per_level} HP per level`);
    if (effect.ac_bonus) lines.push(`+${effect.ac_bonus} AC`);
    if (effect.initiative) lines.push(`+${effect.initiative} Initiative`);
    if (effect.speed) lines.push(`+${effect.speed} ft speed`);
    if (effect.passive_perception) lines.push(`+${effect.passive_perception} passive Perception/Investigation`);
    if (effect.damage_reduction_bps) lines.push(`-${effect.damage_reduction_bps} non-magical B/P/S damage`);
    if (effect.luck_points) lines.push(`${effect.luck_points} luck points per long rest`);
  }
  if (feat.grants_save_proficiency) {
    lines.push('Saving throw proficiency in chosen ability');
  }

  return lines;
}
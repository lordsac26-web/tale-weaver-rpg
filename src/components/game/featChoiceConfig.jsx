import { ALL_SKILLS } from './gameData';
import { SPELLS_BY_CLASS, SPELL_DETAILS } from './spellData';

export const SPELL_FEAT_CONFIG = {
  'Magic Initiate': {
    classes: ['Bard', 'Cleric', 'Druid', 'Sorcerer', 'Warlock', 'Wizard'],
    cantripCount: 2,
    levelOneCount: 1,
    abilityChoices: ['intelligence', 'wisdom', 'charisma'],
  },
  'Mystical Talent': {
    classes: ['Bard', 'Cleric', 'Druid', 'Sorcerer', 'Warlock', 'Wizard'],
    cantripCount: 2,
    levelOneCount: 1,
    abilityByClass: {
      Bard: 'charisma',
      Cleric: 'wisdom',
      Druid: 'wisdom',
      Sorcerer: 'charisma',
      Wizard: 'intelligence',
    },
    abilityChoicesByClass: { Warlock: ['intelligence', 'wisdom', 'charisma'] },
  },
  'Spell Sniper': {
    classes: ['Bard', 'Cleric', 'Druid', 'Sorcerer', 'Warlock', 'Wizard'],
    cantripCount: 1,
    levelOneCount: 0,
    attackCantripsOnly: true,
    abilityChoices: ['intelligence', 'wisdom', 'charisma'],
  },
  'Ritual Caster': {
    classes: ['Bard', 'Cleric', 'Druid', 'Sorcerer', 'Warlock', 'Wizard'],
    cantripCount: 0,
    levelOneCount: 2,
    abilityChoices: ['intelligence', 'wisdom'],
  },
};

export const SKILL_FEAT_CONFIG = {
  Skilled: { count: 3, options: ALL_SKILLS, mode: 'proficiency' },
  Prodigy: { count: 1, options: ALL_SKILLS, mode: 'proficiency_and_expertise' },
  'Squat Nimbleness': { count: 1, options: ['Acrobatics', 'Athletics'], mode: 'proficiency' },
};

export function getSpellOptionsForFeat(featName, className, level = 'cantrips') {
  const config = SPELL_FEAT_CONFIG[featName];
  const classSpells = SPELLS_BY_CLASS[className] || {};
  let spells = level === 'cantrips' ? (classSpells.cantrips || []) : (classSpells[1] || []);
  if (level === 'cantrips' && config?.attackCantripsOnly) {
    spells = spells.filter(spell => ['ranged_spell_attack', 'melee_spell_attack', 'saving_throw'].includes(SPELL_DETAILS[spell]?.attack_type));
  }
  return spells;
}

export function getSpellcastingAbilityOptions(featName, className) {
  const config = SPELL_FEAT_CONFIG[featName];
  if (!config) return [];
  if (config.abilityByClass?.[className]) return [config.abilityByClass[className]];
  if (config.abilityChoicesByClass?.[className]) return config.abilityChoicesByClass[className];
  return config.abilityChoices || [];
}

export function hasFeatChoicesComplete(featName, character) {
  const spellConfig = SPELL_FEAT_CONFIG[featName];
  const skillConfig = SKILL_FEAT_CONFIG[featName];
  const featSpellChoices = character.class_choices?.feat_spell_choices || {};
  const featSkillChoices = character.class_choices?.feat_skill_choices || {};

  if (spellConfig) {
    const choice = featSpellChoices[featName] || {};
    const cantrips = choice.cantrips || [];
    const spells = choice.spells || [];
    return !!choice.className &&
      !!choice.spellcastingAbility &&
      cantrips.length === spellConfig.cantripCount &&
      spells.length === spellConfig.levelOneCount;
  }

  if (skillConfig) {
    const choice = featSkillChoices[featName] || {};
    return (choice.skills || []).length === skillConfig.count;
  }

  return true;
}
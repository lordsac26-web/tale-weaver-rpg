export const MULTICLASS_RULES_VERSION = 'multiclass-rules-v1.0.0';

export const MULTICLASS_PREREQUISITES = {
  Barbarian: [[['strength', 13]]], Bard: [[['charisma', 13]]], Cleric: [[['wisdom', 13]]],
  Druid: [[['wisdom', 13]]], Fighter: [[['strength', 13]], [['dexterity', 13]]],
  Monk: [[['dexterity', 13], ['wisdom', 13]]], Paladin: [[['strength', 13], ['charisma', 13]]],
  Ranger: [[['wisdom', 13], ['strength', 13]], [['wisdom', 13], ['dexterity', 13]]],
  Rogue: [[['dexterity', 13]]], Sorcerer: [[['charisma', 13]]],
  Warlock: [[['charisma', 13]]], Wizard: [[['intelligence', 13]]], Artificer: [[['intelligence', 13]]],
};

export const SUBCLASS_LEVEL = {
  Cleric: 1, Sorcerer: 1, Warlock: 1, Druid: 2, Wizard: 2,
  Artificer: 3, Barbarian: 3, Bard: 3, Fighter: 3, Monk: 3,
  Paladin: 3, Ranger: 3, Rogue: 3,
};

export const ROGUE_ONE_FEATURES = [
  { name: 'Sneak Attack (1d6)', description: 'Once per turn, deal an extra 1d6 damage with a finesse or ranged weapon when you have advantage, or when an active ally is within 5 feet of the target and you do not have disadvantage.' },
  { name: "Thieves' Cant", description: 'You know the secret mix of dialect, jargon, and code used by rogues to hide messages in ordinary conversation.' },
];

const scoreLabel = (key) => ({ strength: 'Strength', dexterity: 'Dexterity', constitution: 'Constitution', intelligence: 'Intelligence', wisdom: 'Wisdom', charisma: 'Charisma' }[key] || key);
const optionPasses = (character, option) => option.every(([ability, minimum]) => Number(character?.[ability] || 0) >= minimum);

export function validateClassPrerequisites(character, className) {
  const options = MULTICLASS_PREREQUISITES[className];
  if (!options) return { ok: false, reason: `Unsupported multiclass: ${className}.`, checks: [] };
  const checks = options.map(option => ({
    label: option.map(([ability, minimum]) => `${scoreLabel(ability)} ${minimum}`).join(' and '),
    passed: optionPasses(character, option),
  }));
  const ok = checks.some(check => check.passed);
  return { ok, checks, reason: ok ? null : `${className} requires ${checks.map(check => check.label).join(' or ')}.` };
}

export function validateMulticlassApplication(character, className, subclass = '', classLevel = 1) {
  const current = validateClassPrerequisites(character, character?.class);
  const target = validateClassPrerequisites(character, className);
  const gate = SUBCLASS_LEVEL[className];
  if (!current.ok) return { ok: false, reason: `Current class prerequisite unmet: ${current.reason}`, current, target, subclass_level: gate };
  if (!target.ok) return { ok: false, reason: target.reason, current, target, subclass_level: gate };
  if (subclass && classLevel < gate) return { ok: false, reason: `${className} subclasses unlock at class level ${gate}; ${subclass} cannot be selected at level ${classLevel}.`, current, target, subclass_level: gate };
  return { ok: true, reason: null, current, target, subclass_level: gate };
}

export function rogueLevel(character = {}) {
  const primary = character.class === 'Rogue' ? Math.max(1, Number(character.level || 1) - (character.multiclass || []).reduce((sum, entry) => sum + Number(entry?.levels || 0), 0)) : 0;
  return primary + (character.multiclass || []).filter(entry => entry?.class === 'Rogue').reduce((sum, entry) => sum + Number(entry.levels || 0), 0);
}

export function proficiencyForLevel(level) {
  return level >= 17 ? 6 : level >= 13 ? 5 : level >= 9 ? 4 : level >= 5 ? 3 : 2;
}

export function applyRogueExpertise(skills = {}, choices = [], previousChoices = []) {
  const unique = [...new Set(choices)];
  if (unique.length !== 2) return { ok: false, reason: 'Rogue Expertise requires exactly two different proficient skills.' };
  if (unique.some(skill => !['proficient', 'expert', true].includes(skills?.[skill]))) return { ok: false, reason: 'Expertise can only be assigned to proficient skills.' };
  const next = { ...skills };
  previousChoices.filter(skill => !unique.includes(skill)).forEach(skill => { if (next[skill] === 'expert') next[skill] = 'proficient'; });
  unique.forEach(skill => { next[skill] = 'expert'; });
  return { ok: true, skills: next, choices: unique };
}
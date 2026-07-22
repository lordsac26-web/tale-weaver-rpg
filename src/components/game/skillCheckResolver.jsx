// Resolves AI-generated skill check labels (e.g. "STR Athletics",
// "Athletics (Strength)", "athletics", "Strength check") to the canonical
// skill name and governing ability so modifiers always calculate correctly.
import { SKILL_STAT_MAP, ALL_SKILLS } from './gameData';

const STAT_ALIASES = {
  str: 'strength', strength: 'strength',
  dex: 'dexterity', dexterity: 'dexterity',
  con: 'constitution', constitution: 'constitution',
  int: 'intelligence', intelligence: 'intelligence',
  wis: 'wisdom', wisdom: 'wisdom',
  cha: 'charisma', charisma: 'charisma',
};

// Longest names first so "Sleight of Hand" wins before partial words match
const SKILLS_BY_LENGTH = [...ALL_SKILLS].sort((a, b) => b.length - a.length);

/**
 * Returns { skill, stat } where:
 *  - skill: canonical skill name ("Athletics") or null for raw ability checks
 *  - stat: governing ability ("strength") or null if unrecognized
 */
export function resolveSkillCheck(raw) {
  if (!raw) return { skill: null, stat: null };
  const text = String(raw).toLowerCase();

  // Find a known skill name anywhere in the label
  const skill = SKILLS_BY_LENGTH.find(s => text.includes(s.toLowerCase()));
  if (skill) return { skill, stat: SKILL_STAT_MAP[skill] };

  // No skill — treat as a raw ability check ("Strength", "STR check")
  const alias = Object.keys(STAT_ALIASES).find(a => new RegExp(`\\b${a}\\b`).test(text));
  if (alias) return { skill: null, stat: STAT_ALIASES[alias] };

  return { skill: null, stat: null };
}

/** Canonical skill name for lookups (falls back to the raw label). */
export function canonicalSkillName(raw) {
  return resolveSkillCheck(raw).skill || raw;
}
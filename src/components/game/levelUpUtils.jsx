// Shared XP / level-up helpers used by the in-game progression wizard.

export const XP_THRESHOLDS = [0, 300, 900, 2700, 6500, 14000, 23000, 34000, 48000, 64000, 85000, 100000, 120000, 140000, 165000, 195000, 225000, 265000, 305000, 355000];

/** Total character level = primary level + all multiclass levels (5e rule). */
export function getTotalLevel(character) {
  if (!character) return 1;
  const primary = character.level || 1;
  const mcLevels = (character.multiclass || []).reduce((sum, mc) => sum + (mc.levels || 0), 0);
  return primary + mcLevels;
}

/**
 * Returns true when the character has earned enough XP to advance to the next
 * level (and isn't already at the level-20 cap).
 */
export function canLevelUp(character) {
  if (!character) return false;
  const total = getTotalLevel(character);
  if (total >= 20) return false;
  const threshold = XP_THRESHOLDS[total];
  return (character.xp || 0) >= threshold;
}
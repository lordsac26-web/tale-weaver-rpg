export const findHuntersMark = (modifiers = [], casterId, targetId) =>
  (modifiers || []).find((modifier) =>
    modifier?.effect === 'hunters_mark' &&
    modifier?.concentration === true &&
    modifier?.caster_id === casterId &&
    modifier?.marked_target_id === targetId
  ) || null;

export const rollHuntersMarkBonus = (modifier, isCritical, rollDie) => {
  const match = String(modifier?.damage_bonus_dice || '1d6').match(/^(\d+)d(\d+)$/i);
  if (!match) return { dice: modifier?.damage_bonus_dice || null, rolls: [], damage: 0 };
  const count = Number(match[1]) * (isCritical ? 2 : 1);
  const sides = Number(match[2]);
  const rolls = Array.from({ length: count }, () => rollDie(sides));
  return { dice: `${match[1]}d${match[2]}`, rolls, damage: rolls.reduce((sum, roll) => sum + roll, 0) };
};

export const removeHuntersMark = (modifiers = [], casterId) =>
  (modifiers || []).filter((modifier) => !(modifier?.effect === 'hunters_mark' && modifier?.caster_id === casterId));
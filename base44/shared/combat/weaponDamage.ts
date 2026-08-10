export function rollWeaponBaseDamage({ damageDice, damageBonus = 0, diceCountOverride = null, rollDie }) {
  const match = String(damageDice || '').match(/(\d+)d(\d+)/);
  if (!match) return { parsed: false, damage: 0, rolls: [] };
  const count = diceCountOverride == null ? Number(match[1]) : Number(diceCountOverride);
  const sides = Number(match[2]);
  if (!Number.isInteger(count) || count < 1 || !Number.isInteger(sides) || sides < 1 || typeof rollDie !== 'function') return { parsed: false, damage: 0, rolls: [] };
  const rolls = Array.from({ length: count }, () => rollDie(sides));
  return { parsed: true, damage: rolls.reduce((sum, roll) => sum + roll, 0) + Number(damageBonus || 0), rolls, count, sides };
}
import { rogueLevel } from '../multiclassRules.ts';

export const SNEAK_ATTACK_VERSION = 'sneak-attack-v1.0.0';

const featureName = (feature) => String(typeof feature === 'string' ? feature : feature?.name || '').toLowerCase();

export function resolveSneakAttack({ character = {}, weapon = {}, advantage = false, disadvantage = false, allyAdjacent = false, adjacentAllyIncapacitated = false, alreadyUsed = false } = {}) {
  const level = rogueLevel(character);
  const hasFeature = level > 0 && (character.features || []).some(feature => featureName(feature).includes('sneak attack'));
  const properties = (weapon.properties || []).map(value => String(value).toLowerCase());
  const legalWeapon = weapon.type === 'ranged' || properties.includes('finesse');
  const advantageEligible = advantage === true && disadvantage !== true;
  const allyEligible = allyAdjacent === true && adjacentAllyIncapacitated !== true && disadvantage !== true;
  const eligible = hasFeature && legalWeapon && !alreadyUsed && (advantageEligible || allyEligible);
  const dice = `${Math.ceil(Math.max(1, level) / 2)}d6`;
  return {
    eligible, dice, rogue_level: level,
    attribution: advantageEligible ? 'Sneak Attack: advantage on the attack' : allyEligible ? 'Sneak Attack: active ally within 5 ft of the target' : null,
    version: SNEAK_ATTACK_VERSION,
  };
}
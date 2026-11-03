import { evaluateEffectDuration } from '../effectDuration.ts';

export const COMBAT_TIMED_CONDITIONS_VERSION = 'combat-timed-conditions-v1.0.0';

// Combat-side expiry against the SESSION GAME CLOCK (the same clock the story
// layer uses). A condition whose game-time expiry has passed is removed from the
// combatant roster; untimestamped, persistent, and save-ends conditions are
// untouched. Returns the new roster plus a removal record for each lapse.
export function expireTimedCombatantConditions({ combatants = [], session = null } = {}) {
  const expired = [];
  const next = (combatants || []).map((combatant) => {
    const conditions = Array.isArray(combatant?.conditions) ? combatant.conditions : [];
    if (!conditions.length) return combatant;
    const kept = conditions.filter((condition) => {
      if (typeof condition !== 'object' || condition === null) return true;
      const evaluation = evaluateEffectDuration({ entry: condition, session, name: condition.display_name || condition.name || '' });
      if (!evaluation.expired) return true;
      expired.push({
        combatant: combatant?.name || combatant?.id || 'combatant',
        condition: condition.display_name || condition.name || 'condition',
        basis: evaluation.basis,
        at: new Date().toISOString(),
      });
      return false;
    });
    return kept.length === conditions.length ? combatant : { ...combatant, conditions: kept };
  });
  return { combatants: next, expired, version: COMBAT_TIMED_CONDITIONS_VERSION };
}
import { canonicalStoryConditionName, normalizeStoryConditions } from './activeEffects.ts';
import { canonicalStoryStealthedCondition, withCanonicalStoryStealthed } from './stealthSetupHandoff.ts';
import { isPwt } from './postRestResiduals.ts';

const CONDITION_PLACEHOLDERS = new Set(['', 'none', 'normal', 'no condition', 'no conditions', 'n/a', 'null', 'undefined']);
const TEMPORARY_STORY_CONDITIONS = new Set(['silenced', 'silence', 'blinded', 'charmed', 'deafened', 'frightened', 'grappled', 'incapacitated', 'invisible', 'paralyzed', 'petrified', 'poisoned', 'prone', 'restrained', 'stunned', 'unconscious', 'hidden', 'marked target', 'alert', 'rejuvenated']);
const conditionName = value => String(typeof value === 'string' ? value : value?.name || '').trim();
const conditionKey = value => conditionName(value).toLowerCase();
const validConditionName = value => !CONDITION_PLACEHOLDERS.has(conditionKey(value));

// Extracted without changing the pre-existing condition, HP or XP rules.
export async function applyStoryCharacterConsequences({ base44, character, session, sessionId, requestId, result, action, stealthSetupIntent, choiceContext }) {
  if (!character) return;
  const freshChar = await base44.asServiceRole.entities.Character.get(character.id);
  const authoritativeExhaustion = Number((freshChar || character).exhaustion_level || 0);
  const originalConditions = Array.isArray((freshChar || character).conditions) ? (freshChar || character).conditions : [];
  const incoming = result.condition_update && typeof result.condition_update === 'object' ? result.condition_update : { target: 'none', add: '', remove: [], duration: 'scene' };
  const removals = new Set((Array.isArray(incoming.remove) ? incoming.remove : []).map(conditionKey).filter(Boolean));
  const changingLocation = !!(result.location_update && result.location_update !== session.current_location);
  const leavingCombat = action === 'choice' && !result.combat_trigger && !session.in_combat;
  let nextConditions = originalConditions.filter(cond => {
    const key = conditionKey(cond);
    if (!validConditionName(cond) || removals.has(key)) return false;
    if ((key === 'exhausted' || key === 'exhaustion') && authoritativeExhaustion <= 0) return false;
    const duration = typeof cond === 'object' ? cond.duration : null;
    if (duration === 'scene' && changingLocation) return false;
    if (duration === 'combat' && leavingCombat) return false;
    if (!duration && typeof cond === 'object' && cond.source === 'story' && !session.in_combat && TEMPORARY_STORY_CONDITIONS.has(key)) return false;
    return true;
  });
  if (stealthSetupIntent?.establishes_concealment) {
    const stealthCondition = canonicalStoryStealthedCondition({ characterId: character.id, sessionId, requestId, receipt: choiceContext.check });
    nextConditions = withCanonicalStoryStealthed(nextConditions, stealthCondition);
  } else if (incoming.target === 'player' && validConditionName(incoming.add)) {
    const name = canonicalStoryConditionName(conditionName(incoming.add));
    const key = name.toLowerCase();
    const isInvalidExhaustionAdd = (key === 'exhausted' || key === 'exhaustion') && authoritativeExhaustion <= 0;
    if (key === 'stealthed') {
      let foundStealthed = false;
      nextConditions = nextConditions.filter(cond => {
        if (conditionKey(cond) !== 'stealthed') return true;
        if (foundStealthed) return false;
        foundStealthed = true;
        return true;
      });
    }
    if (!isInvalidExhaustionAdd && !isPwt(name) && !nextConditions.some(cond => conditionKey(cond) === key)) {
      const pwtAttributed = key === 'stealthed' && choiceContext?.check?.modifier_breakdown?.pwt_active === true;
      nextConditions.push({ name, source: pwtAttributed ? 'Pass without Trace' : 'story', duration: incoming.duration || 'scene', applied_at: new Date().toISOString(), ...(pwtAttributed ? { caster_id: session.world_state?.active_concentration?.caster_id, target_id: character.id } : {}) });
    }
  }
  nextConditions = normalizeStoryConditions(nextConditions);
  if (JSON.stringify(nextConditions) !== JSON.stringify(originalConditions)) await base44.asServiceRole.entities.Character.update(character.id, { conditions: nextConditions });
  if (result.hp_change) {
    const newHp = Math.max(0, Math.min(character.hp_max || 0, (character.hp_current || 0) + result.hp_change));
    if (newHp !== character.hp_current) await base44.asServiceRole.entities.Character.update(character.id, { hp_current: newHp });
  }
  if (result.xp_earned) await base44.asServiceRole.entities.Character.update(character.id, { xp: (character.xp || 0) + result.xp_earned });
}
import { isPassWithoutTraceIdentity, preferStructuredCondition } from '../spells/conditionIdentity.js';

const SKILL_ABILITIES = {
  Acrobatics: 'dexterity', 'Animal Handling': 'wisdom', Arcana: 'intelligence', Athletics: 'strength',
  Deception: 'charisma', History: 'intelligence', Insight: 'wisdom', Intimidation: 'charisma',
  Investigation: 'intelligence', Medicine: 'wisdom', Nature: 'intelligence', Perception: 'wisdom',
  Performance: 'charisma', Persuasion: 'charisma', Religion: 'intelligence', 'Sleight of Hand': 'dexterity',
  Stealth: 'dexterity', Survival: 'wisdom',
};
const normalize = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
export const canonicalSkill = (value) => Object.keys(SKILL_ABILITIES).find((skill) => normalize(value).includes(normalize(skill))) || null;
const statModifier = (score) => Math.floor(((Number(score) || 10) - 10) / 2);
const gameClockExpired = (effect, session) => {
  if (effect?.game_time_expired === true || Number(effect?.remaining_duration_minutes) === 0) return true;
  const gameNow = Date.parse(session?.world_state?.world_clock_timestamp || '');
  const applied = Date.parse(effect?.applied_at || '');
  const expires = Date.parse(effect?.expires_at || '');
  return Number.isFinite(gameNow) && Number.isFinite(applied) && Number.isFinite(expires) && gameNow >= applied && gameNow >= expires;
};

export function resolveAuthoritativeSkillModifier({ character, session, skill: requestedSkill }) {
  const skill = canonicalSkill(requestedSkill);
  if (!character || !skill) return { ok: false, error: 'Character and canonical skill are required', skill, total: 0, components: [] };
  if (session && session.character_id !== character.id) return { ok: false, error: 'Session and character linkage is invalid', skill, total: 0, components: [] };
  const ability = SKILL_ABILITIES[skill];
  const abilityBonus = statModifier(character[ability]);
  const proficiencyBonus = Number(character.proficiency_bonus) || 2;
  const training = character.skills?.[skill];
  const proficiency = training === 'expert' ? proficiencyBonus * 2 : (training === 'proficient' || training === true) ? proficiencyBonus : 0;
  const components = [
    { type: 'ability', source: ability, value: abilityBonus },
    { type: 'proficiency', source: training === 'expert' ? `${skill} expertise` : `${skill} proficiency`, value: proficiency },
  ];
  const baseSkill = abilityBonus + proficiency;
  const matchingModifiers = (character.active_modifiers || []).filter((modifier) => modifier?.effect === 'skill_bonus' && canonicalSkill(modifier.skill) === skill);
  const pwtModifiers = matchingModifiers.filter(isPassWithoutTraceIdentity);
  const pwtConditions = (character.conditions || []).filter(isPassWithoutTraceIdentity);
  const structuredPwt = preferStructuredCondition(pwtConditions, 'Pass without Trace');
  const concentration = session?.world_state?.active_concentration;
  const pwtLinkActive = skill === 'Stealth' && pwtModifiers.length === 1 && pwtConditions.filter((condition) => condition?.id && condition?.target_id && condition?.caster_id && condition?.concentration === true).length === 1
    && structuredPwt?.target_id === character.id && structuredPwt?.caster_id === character.id
    && isPassWithoutTraceIdentity(concentration) && concentration?.concentration === true && concentration?.character_id === character.id && concentration?.target_id === character.id && concentration?.caster_id === character.id
    && concentration?.broken !== true && !gameClockExpired(concentration, session) && !gameClockExpired(structuredPwt, session) && !gameClockExpired(pwtModifiers[0], session);
  if (skill === 'Stealth' && (pwtModifiers.length > 1 || pwtConditions.filter((condition) => condition?.id && condition?.concentration === true).length > 1)) return { ok: false, error: 'Ambiguous duplicate Pass without Trace effects', skill, base_skill: baseSkill, total: baseSkill, components, ambiguity: true };
  const otherBonuses = matchingModifiers.filter((modifier) => !isPassWithoutTraceIdentity(modifier) && !gameClockExpired(modifier, session));
  for (const modifier of otherBonuses) components.push({ type: 'effect', source: modifier.source || modifier.name || 'Skill bonus', value: Number(modifier.bonus) || 0, id: modifier.id || null });
  if (pwtLinkActive) components.push({ type: 'effect', source: 'Pass without Trace', value: 10, id: pwtModifiers[0].id, concentration: true });
  const effectBonus = components.filter((component) => component.type === 'effect').reduce((sum, component) => sum + component.value, 0);
  return { ok: true, skill, ability, ability_bonus: abilityBonus, proficiency, base_skill: baseSkill, effect_bonus: effectBonus, bonus: effectBonus, total: baseSkill + effectBonus, components, pwt_active: pwtLinkActive, concentration_linked: pwtLinkActive };
}

export function buildSkillCheckReceipt({ requestId, raw, allRolls = [], dc, success, breakdown, advantageSources = [], at = new Date().toISOString() }) {
  return { id: requestId, request_id: requestId, skill: breakdown.skill, raw_d20: raw, all_rolls: allRolls, dc: Number(dc), modifier_total: breakdown.total, final_total: Number(raw) + breakdown.total, success: !!success, modifier_breakdown: breakdown, advantage_sources: advantageSources, at };
}
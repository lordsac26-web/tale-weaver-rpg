export const CHOICE_ACTION_CONTRACT_VERSION = 'choice-action-contract-v1.0.0';
import { parseCompositeAction } from './compositeActionContract.js';
import { normalizeDeclaredRecovery } from './choiceAwardRouting.js';
export const CHOICE_ACTION_FRONTEND_VERSION = 'choice-action-transition-v1.2.0';
export const CHOICE_ACTION_TYPES = ['skill_check', 'weapon_attack', 'spell_cast', 'composite_action', 'utility', 'social', 'movement', 'rest', 'item_use', 'combat_transition'];
export const CANONICAL_SKILLS = ['Acrobatics','Animal Handling','Arcana','Athletics','Deception','History','Insight','Intimidation','Investigation','Medicine','Nature','Perception','Performance','Persuasion','Religion','Sleight of Hand','Stealth','Survival'];

const normalize = (value) => String(value || '').toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
const rangedAttackPattern = /\b(take\s+(?:a\s+)?precision\s+shot|precision\s+shot|shoot|fire\s+(?:an?\s+)?arrow|loose\s+(?:an?\s+)?arrow|attack\s+with\s+(?:a\s+)?longbow|snipe|release\s+(?:an?\s+)?arrow)\b/i;

export function canonicalSkill(value) {
  const key = normalize(typeof value === 'object' ? value?.skill || value?.name : value).replace(/\bdc\s*\d+\b/g, '').trim();
  return CANONICAL_SKILLS.find((skill) => normalize(skill) === key) || null;
}

export function classifyLegacyChoiceAction(text) {
  const source = String(text || '').trim();
  if (rangedAttackPattern.test(source)) {
    const target = source.match(/\b(?:guard|cultist|scout|ritualist|necromancer|archer|soldier|bandit|goblin|orc|wolf)\b/i)?.[0] || null;
    const nonlethal = /\b(incapacitate|nonlethal|knock\s+out|subdue|disable)\b/i.test(source);
    return { action_type: 'weapon_attack', evidence: 'deterministic_ranged_phrase', weapon_attack: { target_ref: target, weapon_hint: /crossbow|bolt/i.test(source) ? 'Crossbow' : 'Longbow', attack_mode: 'ranged', declared_attack_count: 1, intent: nonlethal ? 'incapacitate_requested' : 'damage', nonlethal_guaranteed: false } };
  }
  return null;
}

export function normalizeChoiceActionContract(choice = {}) {
  const text = String(choice?.text || '').trim();
  const composite = parseCompositeAction(text);
  if (composite) return { ...choice, ...composite, text, skill_check: null, dc: null, recovery: null, weapon_attack: null, contract_version: CHOICE_ACTION_CONTRACT_VERSION };
  const legacyAttack = classifyLegacyChoiceAction(text);
  if (legacyAttack) return { ...choice, ...legacyAttack, text, skill_check: null, dc: null, recovery: null, contract_version: CHOICE_ACTION_CONTRACT_VERSION };
  const requestedType = CHOICE_ACTION_TYPES.includes(choice?.action_type) ? choice.action_type : null;
  const skill = canonicalSkill(choice?.skill_check);
  const dc = Number(choice?.dc ?? choice?.skill_check?.dc);
  if (requestedType === 'skill_check' || (!requestedType && skill && Number.isFinite(dc))) return { ...choice, text, action_type: 'skill_check', skill_check: skill, dc: Number.isFinite(dc) ? dc : null, recovery: normalizeDeclaredRecovery(choice.recovery), weapon_attack: null, contract_version: CHOICE_ACTION_CONTRACT_VERSION };
  return { ...choice, text, action_type: requestedType || 'utility', skill_check: null, dc: null, recovery: normalizeDeclaredRecovery(choice.recovery), weapon_attack: requestedType === 'weapon_attack' ? choice.weapon_attack || null : null, contract_version: CHOICE_ACTION_CONTRACT_VERSION };
}
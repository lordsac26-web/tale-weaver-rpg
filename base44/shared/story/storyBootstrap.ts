import { hydrateLatestStoryEntry, normalizeStoryChoices } from './storyTransition.ts';

export const STORY_BOOTSTRAP_VERSION = 'story-bootstrap-v1.0.0';

const dcFrom = (choice) => {
  const direct = Number(choice?.dc ?? choice?.skill_check?.dc);
  if (Number.isFinite(direct)) return direct;
  const match = String(choice?.skill_check || '').match(/\bDC\s*(\d{1,2})\b/i);
  return match ? Number(match[1]) : null;
};

const skillFrom = (choice) => {
  if (typeof choice?.skill_check === 'string') return choice.skill_check.replace(/\s*DC\s*\d{1,2}\b/i, '').trim();
  return String(choice?.skill_check?.skill || choice?.skill_check?.name || '').trim();
};

export function normalizeGeneratedChoices(value) {
  return normalizeStoryChoices(value).map((choice) => ({
    ...choice,
    text: String(choice?.text || '').trim(),
    skill_check: skillFrom(choice) || null,
    dc: dcFrom(choice),
  })).filter((choice) => choice.text).slice(0, 4);
}

export function groundedFallbackChoices({ location = 'the current area' } = {}) {
  return [
    { text: `Observe ${location} carefully before moving.`, skill_check: 'Perception', dc: 10, risk_level: 'low' },
    { text: `Investigate the most unusual detail in ${location}.`, skill_check: 'Investigation', dc: 12, risk_level: 'medium' },
    { text: 'Move forward cautiously and stay ready for danger.', skill_check: 'Stealth', dc: 11, risk_level: 'medium' },
    { text: 'Pause to assess your gear and choose the safest route.', skill_check: 'Survival', dc: 10, risk_level: 'low' },
  ];
}

export function finalizeGeneratedStoryResult(result, context = {}) {
  const choices = normalizeGeneratedChoices(result?.choices);
  const needsChoices = !result?.combat_trigger;
  return { ...result, choices: needsChoices && choices.length < 4 ? groundedFallbackChoices(context) : choices };
}

export function deriveCharacterActions(character) {
  const equipped = character?.equipped?.weapon || character?.equipped?.mainhand || null;
  const inventoryWeapons = (character?.inventory || []).filter((item) => {
    const category = String(item?.category || item?.type || '').toLowerCase();
    return ['weapon', 'melee', 'ranged'].includes(category) || !!item?.damage || !!item?.damage_dice;
  });
  const attacks = [...(equipped ? [equipped] : []), ...inventoryWeapons.filter((item) => item !== equipped)].map((item) => ({ name: item.name || 'Weapon Attack', damage_dice: item.damage_dice || item.damage || '1d6', source: item === equipped ? 'equipped' : 'inventory' }));
  if (!attacks.length) attacks.push({ name: 'Unarmed Strike', damage_dice: '1d4', source: 'fallback' });
  return { attacks };
}

export function buildGameHydration(session, character) {
  const hydration = hydrateLatestStoryEntry(session);
  return { function_version: STORY_BOOTSTRAP_VERSION, session, character, hydration, actions: deriveCharacterActions(character), mobile: { narrative: hydration.text ? [{ type: 'narration', text: hydration.text }] : [], choices: hydration.choices, in_combat: !!session?.in_combat } };
}
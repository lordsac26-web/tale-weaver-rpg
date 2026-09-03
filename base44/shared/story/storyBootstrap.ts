import { hydrateLatestStoryEntry, normalizeStoryChoices } from './storyTransition.ts';
import { normalizeChoiceActionContract } from './choiceActionContract.js';

export const STORY_BOOTSTRAP_VERSION = 'story-bootstrap-v1.1.0';

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
  return normalizeStoryChoices(value).map((choice) => normalizeChoiceActionContract({
    ...choice,
    text: String(choice?.text || '').trim(),
    skill_check: skillFrom(choice) || null,
    dc: dcFrom(choice),
  })).filter((choice) => choice.text).slice(0, 4);
}

const validChoiceSet = (choices) => choices.length === 4 && new Set(choices.map((choice) => choice.text.toLowerCase())).size === 4 && choices.every((choice) => choice.text && (choice.action_type !== 'skill_check' || (choice.skill_check && Number.isFinite(Number(choice.dc)))));
const choiceTokens=(value)=>new Set(normalizeGeneratedChoices(value).flatMap((choice)=>String(choice.text||'').toLowerCase().replace(/[^a-z0-9 ]/g,' ').split(/ +/).filter((token)=>token.length>2)));
const choiceSimilarity=(left,right)=>{const a=choiceTokens(left),b=choiceTokens(right),intersection=[...a].filter((token)=>b.has(token)).length,union=new Set([...a,...b]).size;return union?intersection/union:0;};
const sameChoices = (left, right) => JSON.stringify(normalizeGeneratedChoices(left)) === JSON.stringify(normalizeGeneratedChoices(right)) || choiceSimilarity(left,right)>=.82;

export function groundedFallbackChoices({ location = 'the current area', requestId = '', previousChoices = [] } = {}) {
  const seed = [...String(requestId)].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const openings = ['Reassess', 'Survey', 'Study', 'Examine'];
  const first = openings[seed % openings.length];
  const choices = [
    { text: `${first} ${location} from a safer position before moving.`, action_type: 'skill_check', skill_check: 'Perception', dc: 10, risk_level: 'low' },
    { text: `Investigate the clearest unresolved detail in ${location}.`, action_type: 'skill_check', skill_check: 'Investigation', dc: 12, risk_level: 'medium' },
    { text: `Advance cautiously through ${location} while avoiding notice.`, action_type: 'skill_check', skill_check: 'Stealth', dc: 11, risk_level: 'medium' },
    { text: `Use the terrain around ${location} to choose a safer route.`, action_type: 'skill_check', skill_check: 'Survival', dc: 10, risk_level: 'low' },
  ];
  if (sameChoices(choices, previousChoices)) choices[0] = { ...choices[0], text: `${choices[0].text} Check it from a different angle.` };
  return choices;
}

export function finalizeGeneratedStoryResult(result, context = {}) {
  const choices = normalizeGeneratedChoices(result?.choices);
  const needsChoices = !result?.combat_trigger;
  if (!needsChoices) return { ...result, choices, choice_guard: { replaced: false, reason: 'combat' } };
  const malformed = !validChoiceSet(choices);
  const identical = !malformed && sameChoices(choices, context.previousChoices);
  const replacement = malformed || identical ? groundedFallbackChoices(context) : choices;
  return { ...result, choices: replacement, choice_guard: { replaced: malformed || identical, reason: malformed ? 'missing_or_malformed' : identical ? 'identical_to_preceding' : 'valid_generated' } };
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
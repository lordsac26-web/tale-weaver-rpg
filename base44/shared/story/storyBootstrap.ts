import { hydrateLatestStoryEntry, normalizeStoryChoices } from './storyTransition.ts';
import { normalizeChoiceActionContract } from './choiceActionContract.js';

export const STORY_BOOTSTRAP_VERSION = 'story-bootstrap-v1.2.0';

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
const choiceTokens = (value) => new Set(String(value || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/ +/).filter((token) => token.length > 2));
const textOverlap = (left, right) => { const a = choiceTokens(left), b = choiceTokens(right); const shared = [...a].filter((token) => b.has(token)).length; const union = new Set([...a, ...b]).size; return union ? shared / union : 0; };
const choiceTokensAcross = (value) => new Set(normalizeGeneratedChoices(value).flatMap((choice) => [...choiceTokens(choice.text)]));
export const choiceSetSimilarity = (left, right) => { const a = choiceTokensAcross(left), b = choiceTokensAcross(right); const shared = [...a].filter((token) => b.has(token)).length; const union = new Set([...a, ...b]).size; return union ? shared / union : 0; };
const normalizeChoiceText = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

// A new set repeats the previous list when most options restate the previous option
// at the SAME position. Comparison is deliberately positional: every option shares
// the scene location, so whole-set token overlap scores genuinely different sets as
// repeats — that false positive previously replaced real options with one static
// template, which then repeated forever and looked like a frozen list.
export const choicesRepeatPrevious = (left, right) => {
  const a = normalizeGeneratedChoices(left), b = normalizeGeneratedChoices(right);
  if (!a.length || a.length !== b.length) return false;
  if (JSON.stringify(a) === JSON.stringify(b)) return true;
  const repeated = a.filter((choice, index) => textOverlap(choice.text, b[index]?.text) >= 0.75).length;
  return repeated >= Math.max(3, Math.ceil(a.length * 0.75));
};
const sameChoices = choicesRepeatPrevious;

// Deterministic yet genuinely advancing. The pool is much wider than a single set,
// and the previous turn's options overlap themselves perfectly, so they always rank
// last and can never be re-selected. The option just performed is excluded outright.
const FALLBACK_FRAMES = [
  { skill: 'Perception', dc: 11, text: (place) => `Scan the approaches to ${place} for tracks, tripwires, or anything recently disturbed.` },
  { skill: 'Survival', dc: 12, text: (place) => `Follow the freshest trail leading away from ${place} and see where it ends.` },
  { skill: 'Stealth', dc: 12, text: (place) => `Slip closer to ${place} under cover, staying out of any line of sight.` },
  { skill: 'Investigation', dc: 13, text: (place) => `Look for a maker's mark, seam, or hinge on ${place} that shows how it was made.` },
  { skill: 'Arcana', dc: 12, text: (place) => `Recall what you know of the rites tied to ${place} before touching anything.` },
  { skill: 'Perception', dc: 10, text: (place) => `Stop and listen for any change in the ambient sound around ${place}.` },
  { skill: 'Persuasion', dc: 13, text: (place) => `Call out to whatever might be listening near ${place} and offer a parley.` },
  { skill: 'Acrobatics', dc: 12, text: (place) => `Test the footing and clearance of the fastest way past ${place}.` },
  { skill: 'Insight', dc: 11, text: (place) => `Hold position and let the moment at ${place} develop before committing.` },
  { skill: 'Investigation', dc: 11, text: (place) => `Search the ground at ${place} for a dropped token or a sign of passage.` },
  { skill: 'Survival', dc: 10, text: (place) => `Mark a retreat line from ${place} in case this turns hostile.` },
  { skill: 'Intimidation', dc: 13, text: (place) => `Make your presence known at ${place} and demand whoever is hiding there step out.` },
];

export function groundedFallbackChoices({ location = 'the current area', requestId = '', previousChoices = [], lastPlayerAction = '' } = {}) {
  const place = String(location || 'the current area').trim().replace(/[.!?]+$/, '') || 'the current area';
  const previous = normalizeGeneratedChoices(previousChoices).map((choice) => choice.text);
  const performed = normalizeChoiceText(lastPlayerAction);
  const seed = [...String(requestId)].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const evaluated = FALLBACK_FRAMES.map((frame) => {
    const text = frame.text(place);
    const worst = previous.reduce((max, prior) => Math.max(max, textOverlap(text, prior)), 0);
    const reoffersDoneAction = !!performed && (normalizeChoiceText(text) === performed || textOverlap(text, lastPlayerAction) >= 0.8);
    return { text, skill_check: frame.skill, dc: frame.dc, risk_level: frame.dc >= 13 ? 'medium' : 'low', action_type: 'skill_check', worst, reoffersDoneAction };
  });
  const available = evaluated.filter((option) => !option.reoffersDoneAction);
  const pool = available.length >= 4 ? available : evaluated;
  const rotated = pool.map((_, offset, list) => list[(offset + seed) % list.length]);
  const ranked = [...rotated].sort((left, right) => left.worst - right.worst);
  const distinctSkills = ranked.filter((option, index, list) => list.findIndex((alt) => alt.skill_check === option.skill_check) === index);
  const chosen = distinctSkills.slice(0, 4);
  for (const option of ranked) { if (chosen.length >= 4) break; if (!chosen.includes(option)) chosen.push(option); }
  return chosen.slice(0, 4).map(({ text, action_type, skill_check, dc, risk_level }) => ({ text, action_type, skill_check, dc, risk_level }));
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
import { executeRecoveryTransaction } from './recoveryTransaction.ts';

export const NARRATED_RECOVERY_PARSER_VERSION = 'narrated-recovery-parser-v2.4.0';
const exactQuantity = (value) => Number.isInteger(Number(value)) && Number(value) > 0;

export const isStructuredNarratedRecovery = (recovery) => {
  if (!recovery || typeof recovery !== 'object') return false;
  if (recovery.type === 'recover_owned_items') return Array.isArray(recovery.items) && recovery.items.length > 0;
  if (recovery.type === 'arrows') return exactQuantity(recovery.quantity);
  return recovery.type === 'item' && recovery.item && typeof recovery.item === 'object' && typeof recovery.item.name === 'string' && recovery.item.name.trim() && exactQuantity(recovery.item.quantity ?? 1);
};

const NUMBER_WORDS: Record<string, number> = { one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,ten:10,eleven:11,twelve:12,thirteen:13,fourteen:14,fifteen:15,sixteen:16,seventeen:17,eighteen:18,nineteen:19,twenty:20 };
const QUANTITY = '(?:[1-9]\\d?|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty)';
const ITEM_KIND = '(?:arrows?|bolts?|sling\\s+bullets?|daggers?|shortswords?|longswords?|bows?|crossbows?|battleaxes?|handaxes?|maces?|spears?|shields?|potions?|elixirs?|scrolls?|staffs?|wands?|rings?|amulets?|necklaces?|cloaks?|boots?|gloves?|helms?|keys?|vials?|gold(?:\\s+pieces?)?|silver(?:\\s+pieces?)?|copper(?:\\s+pieces?)?)';
const POSSESSION_ACQUISITION = '(?:recover|recovered|retrieve|retrieved|collect|collected|salvage|salvaged|obtain|obtained|gain|gained|pick(?:ed)?\\s+up|take|took|stow|stowed|claim(?:ed)?)';
const DISCOVERY = '(?:find|found|discover|discovered|spot|spotted|notice|noticed)';
const HISTORICAL_OR_EXISTING = /\b(?:remember|remembered|recall|recalled|previously|earlier|yesterday|last time|already|already-carried|carried|holding|held|remains? in|still in|in (?:your|the) (?:hand|pack|satchel|quiver|inventory))\b/i;
const ABSTRACT_OR_STATE = /\b(?:footing|balance|breath|composure|strength|momentum|ground|bearings?|focus|memories?|information|knowledge|clues?|route|path|way|trail|passage|direction|opening|confidence|hope|control)\b/i;
const MODAL_OR_UNCERTAIN = /\b(?:might|may|could|possibly|perhaps|potentially|possible|likely|appears? to|seems? to)\b/i;
const VAGUE_KIND = '(?:something useful|useful things?|treasures?|rewards?|supplies?|loot|gear|equipment|items?|valuables?|resources?)';
const VAGUE_REWARD = new RegExp(`\\b${VAGUE_KIND}\\b`, 'i');
const CONCRETE_CLAIM = new RegExp(`\\b${POSSESSION_ACQUISITION}\\b\\s+(?:exactly\\s+)?(?:(?<quantity>${QUANTITY})\\s+)?(?:(?:a|an|the|your)\\s+)?(?<item>(?:[A-Za-z][A-Za-z'’-]*\\s+){0,4}${ITEM_KIND})\\b`, 'i');
const DISCOVERY_MENTION = new RegExp(`\\b${DISCOVERY}\\b(?:\\s+\\w+){0,6}\\s+(?:${ITEM_KIND}|${VAGUE_KIND})\\b`, 'i');
const normalizeName = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim().replace(/s$/,'');
const quantityValue = (value) => value ? (Number.isInteger(Number(value)) ? Number(value) : NUMBER_WORDS[value.toLowerCase()]) : 1;

// Indefinite references ("retrieve my arrows", "recover your bolts") are requests,
// not published quantities — they cover a structured recovery of the same kind
// regardless of the structured amount. Only explicitly counted claims must match
// the structured quantity exactly.
const FILLER = /^(?:of|my|your|the|a|an|his|her|their|this|that|these|those|all|remaining|spent|several|some)\b/i;
const stripFiller = (value) => { let name = String(value || '').trim(); while (FILLER.test(name)) name = name.replace(FILLER, '').trim(); return name; };
const kindsMatch = (structured, claimed) => {
  const left = normalizeName(stripFiller(structured));
  const right = normalizeName(stripFiller(claimed));
  return !!left && !!right && (left === right || left.includes(right) || right.includes(left));
};

export function classifyNarratedAcquisitions(narrative) {
  const concrete = [];
  let vague = null;
  for (const sentence of String(narrative || '').split(/(?<=[.!?])\s+|\n+/)) {
    const text=sentence.trim(); if(!text||HISTORICAL_OR_EXISTING.test(text)||ABSTRACT_OR_STATE.test(text)) continue;
    const match=text.match(CONCRETE_CLAIM);
    if(match?.groups?.item&&!MODAL_OR_UNCERTAIN.test(text)) { concrete.push({ classification:'concrete_acquisition', claimed:true, sentence:text, item_name:match.groups.item.trim(), quantity:quantityValue(match.groups.quantity), explicit_quantity:!!match.groups.quantity }); continue; }
    if(MODAL_OR_UNCERTAIN.test(text)||VAGUE_REWARD.test(text)||DISCOVERY_MENTION.test(text)||match) vague={ classification:'vague_ambiguous', claimed:false, sentence:text, item_name:null, quantity:null };
  }
  return { concrete, vague, terminal: vague||{ classification:'non_acquisition', claimed:false, sentence:null, item_name:null, quantity:null } };
}

export const classifyNarratedAcquisition = (narrative) => {
  const parsed = classifyNarratedAcquisitions(narrative);
  return parsed.concrete[0] || parsed.terminal;
};

const structuredEntriesFrom = (recovery, loot) => {
  const entries = [];
  if (isStructuredNarratedRecovery(recovery)) {
    if (recovery.type === 'arrows') entries.push({ name: 'Arrows', quantity: Number(recovery.quantity), explicit: true, source: 'current_recovery' });
    else if (recovery.type === 'item') entries.push({ name: recovery.item.name, quantity: Number(recovery.item.quantity ?? 1), explicit: true, source: 'current_recovery' });
    else for (const item of recovery.items || []) entries.push({ name: item?.canonical_item || '', quantity: Number(item?.quantity) || 1, explicit: false, source: 'recover_owned_items' });
  }
  for (const entry of Array.isArray(loot) ? loot : []) {
    if (entry?.name) entries.push({ name: String(entry.name), quantity: Number(entry?.quantity ?? 1), explicit: Number.isFinite(Number(entry?.quantity)), source: 'loot' });
  }
  return entries;
};

export const validateNarratedRecovery = ({ narrative, recovery, loot = [] }) => {
  const parsed = classifyNarratedAcquisitions(narrative);
  const claims = parsed.concrete;
  if (!claims.length) return { ok:true, status: parsed.terminal.classification, claim: parsed.terminal, uncovered: [] };
  const structured = isStructuredNarratedRecovery(recovery);
  const entries = structuredEntriesFrom(recovery, loot);
  const uncovered = claims.filter((claim) => !entries.some((entry) => kindsMatch(entry.name, claim.item_name) && (!claim.explicit_quantity || !entry.explicit || entry.quantity === claim.quantity)));
  const claim = uncovered[0] || claims[0];
  if (!uncovered.length) return { ok:true, status: structured ? 'matched_structured_recovery' : 'matched_loot_acquisition', claim, uncovered: [] };
  if (!entries.length) return { ok:false, status:'missing_exact_structured_recovery', claim, uncovered };
  const primary = entries[0];
  return { ok:false, status:'mismatched_exact_structured_recovery', claim, uncovered, structured_item: primary.source === 'current_recovery' ? (recovery.type === 'arrows' ? 'Arrows' : recovery.item?.name) : primary.name, structured_quantity: primary.quantity };
};

export const containsExactRecoveryClaim = (narrative) => classifyNarratedAcquisition(narrative).classification==='concrete_acquisition';

export async function commitNarratedStoryInventoryRecovery({ base44, sessionId, characterId, requestId, check, recovery }) {
  if (!requestId || !sessionId || !characterId || !isStructuredNarratedRecovery(recovery)) return { status: 409, body: { applied:false, reason:'missing_exact_structured_recovery', writes:0 } };
  if (check?.success !== true) return { status: 200, body: { applied:false, reason:'failed_check', writes:0 } };
  const combatId = recovery.type === 'recover_owned_items' ? recovery.combat_id : null;
  return executeRecoveryTransaction({ base44, sessionId, characterId, combatId, requestId, outcome:{ check, recovery } });
}

export const narrationMayPublishRecovery = ({ narrative, committed }) => !containsExactRecoveryClaim(narrative) || committed === true;
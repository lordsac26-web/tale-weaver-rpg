import { executeRecoveryTransaction } from './recoveryTransaction.ts';

export const NARRATED_RECOVERY_PARSER_VERSION = 'narrated-recovery-parser-v2.0.0';
const exactQuantity = (value) => Number.isInteger(Number(value)) && Number(value) > 0;

export const isStructuredNarratedRecovery = (recovery) => {
  if (!recovery || typeof recovery !== 'object') return false;
  if (recovery.type === 'recover_owned_items') return Array.isArray(recovery.items) && recovery.items.length > 0;
  if (recovery.type === 'arrows') return exactQuantity(recovery.quantity);
  return recovery.type === 'item' && recovery.item && typeof recovery.item === 'object' && typeof recovery.item.name === 'string' && recovery.item.name.trim() && exactQuantity(recovery.item.quantity ?? 1);
};

const NUMBER_WORDS: Record<string, number> = { one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,ten:10,eleven:11,twelve:12,thirteen:13,fourteen:14,fifteen:15,sixteen:16,seventeen:17,eighteen:18,nineteen:19,twenty:20 };
const QUANTITY = '(?:[1-9]\\d?|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty)';
const ITEM_KIND = '(?:arrows?|bolts?|sling\\s+bullets?|daggers?|swords?|bows?|crossbows?|axes?|maces?|spears?|shields?|armor|gear|potions?|elixirs?|scrolls?|wands?|rings?|amulets?|necklaces?|cloaks?|boots?|gloves?|helms?|gold(?:\\s+pieces?)?|silver(?:\\s+pieces?)?|copper(?:\\s+pieces?)?)';
const ACQUISITION = '(?:find|found|recover|recovered|retrieve|retrieved|collect|collected|salvage|salvaged|obtain|obtained|gain|gained|pick(?:ed)?\\s+up)';
const HISTORICAL_OR_EXISTING = /\b(?:remember|remembered|recall|recalled|previously|earlier|yesterday|last time|already|already-carried|carried|holding|held|in (?:your|the) (?:hand|pack|satchel|quiver|inventory))\b/i;
const ABSTRACT_OR_ENVIRONMENTAL = /\b(?:footing|balance|breath|composure|strength|momentum|ground|bearings?|focus|memories?|information|knowledge|clues?|route|path|way|trail|passage|direction|opening|confidence|hope|control|door|gate|wall|stone|branch|tracks?|landmark)\b/i;
const CLAIM = new RegExp(`\\b${ACQUISITION}\\b\\s+(?:exactly\\s+)?(?:(?<quantity>${QUANTITY})\\s+)?(?:(?:a|an|the|your)\\s+)?(?<item>(?:[A-Z][A-Za-z'’-]*\\s+){0,4}${ITEM_KIND})\\b`, 'i');
const normalizeName = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim().replace(/s$/,'');
const quantityValue = (value) => value ? (/^\\d+$/.test(value) ? Number(value) : NUMBER_WORDS[value.toLowerCase()]) : 1;

export const classifyNarratedAcquisition = (narrative) => {
  for (const sentence of String(narrative || '').split(/(?<=[.!?])\s+|\n+/)) {
    const text=sentence.trim(); if(!text||HISTORICAL_OR_EXISTING.test(text)) continue;
    const match=text.match(CLAIM); if(match?.groups?.item) return { claimed:true, sentence:text, item_name:match.groups.item.trim(), quantity:quantityValue(match.groups.quantity) };
  }
  return { claimed:false, sentence:null, item_name:null, quantity:null };
};

export const validateNarratedRecovery = ({ narrative, recovery }) => {
  const claim=classifyNarratedAcquisition(narrative); const structured=isStructuredNarratedRecovery(recovery);
  if(!claim.claimed&&!structured) return { ok:true, status:'not_applicable', claim };
  if(claim.claimed&&!structured) return { ok:false, status:'missing_exact_structured_recovery', claim };
  if(!claim.claimed&&structured) return { ok:true, status:'structured_recovery', claim };
  const itemName=recovery.type==='arrows'?'Arrows':recovery.item?.name; const quantity=recovery.type==='arrows'?Number(recovery.quantity):Number(recovery.item?.quantity??1);
  const matches=normalizeName(itemName)===normalizeName(claim.item_name)&&quantity===claim.quantity;
  return { ok:matches, status:matches?'matched_structured_recovery':'mismatched_exact_structured_recovery', claim, structured_item:itemName, structured_quantity:quantity };
};

export const containsExactRecoveryClaim = (narrative) => classifyNarratedAcquisition(narrative).claimed;

export async function commitNarratedStoryInventoryRecovery({ base44, sessionId, characterId, requestId, check, recovery }) {
  if (!requestId || !sessionId || !characterId || !isStructuredNarratedRecovery(recovery)) return { status: 409, body: { applied:false, reason:'missing_exact_structured_recovery', writes:0 } };
  if (check?.success !== true) return { status: 200, body: { applied:false, reason:'failed_check', writes:0 } };
  const combatId = recovery.type === 'recover_owned_items' ? recovery.combat_id : null;
  return executeRecoveryTransaction({ base44, sessionId, characterId, combatId, requestId, outcome:{ check, recovery } });
}

export const narrationMayPublishRecovery = ({ narrative, committed }) => !containsExactRecoveryClaim(narrative) || committed === true;
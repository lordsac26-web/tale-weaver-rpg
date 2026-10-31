// One authoritative router for what the player actually asked for.
//
// The Oct 31 cascade was an intent resolved by three different components in three
// different vocabularies: an explicit attack was classified as a skill check, then
// narrated as prose, then audited by the possession-disposal validator. Every hop
// looked reasonable alone. The fix is one ordered answer that every hop reads, so an
// intent lands in exactly one pipeline and cannot fall through into another.
export const INTENT_ROUTER_VERSION = 'story-intent-router-v1.1.0';

// Shown to the player when a turn cannot be saved. Deliberately says nothing about
// evidence, catalogues, quotes, or any other internal validator vocabulary.
export const PLAYER_FACING_UNSAVED_ACTION = 'Nothing was written — that action could not be saved safely, so your last saved scene is still in effect. Try describing it a different way, or pick an option from the list.';

const DISPOSE_VERB = /\b(?:drop|drops|dropping|discard|discards|toss|tosses|abandon|abandons|destroy|destroys|shatter|shatters|burn|burns|consume|consumes|drink|drinks|eat|eats|swallow|swallows|expend|expends|use up|leave behind|leaves behind)\b/i;
const STOW_VERB = /\b(?:stow|stows|stow away|put|puts|place|places|pack|packs|store|stores|sheathe|sheathes|insert|inserts|set|sets)\b/i;
const CONTAINER_REF = /\b(?:bag|bag of holding|backpack|pack|satchel|pouch|case|container|chest|coffer|sack|crate|box|sheath|quiver|holster|fissure|crack|crevice|seam|socket|slot|aperture|inventory)\b/i;
const SPELL_VERB = /\b(?:cast|casts|casting|invoke|invokes|channel|channels|conjure|conjures|summon|summons|enchant|enchants|hex|hexes)\b/i;
const SHOVE_VERB = /\b(?:shove|shoves|shoving|push|pushes|pushing|bull rush|grapple|grapples|grappling|trip|trips|tackle|tackles|knock (?:him|her|it|them) (?:down|over|prone))\b/i;
const THROWN_VERB = /\b(?:throw|throws|throwing|hurl|hurls|hurling|fling|flings|flinging|lob|lobs|lobbing)\b/i;
const HOSTILE_REF = /\b(?:cultists?|enemies|enemy|guards?|sentinels?|sentries|soldiers?|raiders?|bandits?|skeletons?|zombies?|ghouls?|acolytes?|ritualists?|necromancers?|creatures?|monsters?|hostiles?|nearest|cultist|him|her|them|it)\b/i;

// Combat pipelines never touch the possession-disposal validator: a strike cannot
// dispose of an item, so surfacing inventory-evidence requirements there is nonsense.
const COMBAT_PIPELINES = new Set(['combat_attack', 'thrown_weapon', 'spell', 'shove']);
export const dispositionAuditApplies = (route) => !COMBAT_PIPELINES.has(route?.pipeline);

/**
 * @returns {{ pipeline: string, reason: string, is_combat: boolean, target_hint: string|null, version: string }}
 * pipeline: combat_attack | thrown_weapon | spell | shove | stow | dispose | narrative
 */
export function routePlayerIntent({ actionText, session, attackIntent = null } = {}) {
  const text = String(actionText || '');
  const base = { is_combat: false, target_hint: null, version: INTENT_ROUTER_VERSION };
  if (!text.trim()) return { ...base, pipeline: 'narrative', reason: 'empty' };

  // An explicit attack on established hostiles is the strongest signal there is —
  // the attack classification wins over every verb that could reinterpret it.
  if (attackIntent?.required || (attackIntent?.reason === 'no_established_hostiles' && attackIntent.target_hint)) return { ...base, pipeline: 'combat_attack', reason: attackIntent.reason, is_combat: true, target_hint: attackIntent.target_hint };

  if (THROWN_VERB.test(text) && HOSTILE_REF.test(text)) return { ...base, pipeline: 'thrown_weapon', reason: 'thrown_weapon_at_target', is_combat: true };
  if (SPELL_VERB.test(text)) return { ...base, pipeline: 'spell', reason: 'explicit_spell_cast', is_combat: /\b(?:at|on|toward|against)\b/i.test(text) };
  if (SHOVE_VERB.test(text) && HOSTILE_REF.test(text)) return { ...base, pipeline: 'shove', reason: 'contested_physical_maneuver', is_combat: true };
  if (STOW_VERB.test(text) && CONTAINER_REF.test(text)) return { ...base, pipeline: 'stow', reason: 'placement_into_receptacle' };
  if (DISPOSE_VERB.test(text)) return { ...base, pipeline: 'dispose', reason: 'possession_removal' };
  return { ...base, pipeline: 'narrative', reason: 'no_mechanical_pipeline' };
}
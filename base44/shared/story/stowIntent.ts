export const STOW_INTENT_VERSION = 'stow-intent-v1.1.0';
export const STOW_RECEIPTS_KEY = '__stow_receipts';

const normalize = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const STOW_VERB = /\b(?:toss(?:es|ed)?|throw(?:s|ing|ed)?|threw|stash(?:es|ed)?|stow(?:s|ed)?|place[ds]?|put|slip(?:s|ped)?|deposit(?:s|ed)?|drop(?:s|ped)?|tuck(?:s|ed)?)\b/i;
// "pack"/"bag of <creatures>" (a pack of gnolls) is a thrown-attack target, not a container.
const CONTAINER_DESTINATION = /\b(?:into|in|inside|within)\b[\s\S]{0,40}?\b(bag\s+of\s+holding|bag(?!\s+of)|backpack|pack(?!\s+of)|satchel|pouch|case|container)\b/i;
const WHOLE_STACK = /\b(?:all|entire|whole|every)\b/i;

/**
 * Classify "toss/throw/stash X into (my) bag/container/pack" as a STOW intent.
 * A destination phrase that is not a container (the pit, the mire, a creature)
 * is never a stow, so genuine thrown-weapon attacks keep working.
 */
export function classifyStowIntent(actionText) {
  const text = String(actionText || '');
  if (!STOW_VERB.test(text)) return null;
  const destinations = text.match(new RegExp(CONTAINER_DESTINATION.source, 'gi'));
  if (!destinations || !destinations.length) return null;
  // The final named container is the destination ("X in the quiver into my bag of holding").
  const last = destinations.at(-1);
  const container = String(last).match(/\b(bag\s+of\s+holding|bag|backpack|pack|satchel|pouch|case|container)\b/i)?.[1]?.replace(/\s+/g, ' ').trim() || null;
  const lastStart = text.toLowerCase().lastIndexOf(last.toLowerCase());
  const verbMatch = text.match(STOW_VERB);
  const verbEnd = verbMatch.index + verbMatch[0].length;
  if (lastStart <= verbEnd) return null;
  const itemPhrase = text.slice(verbEnd, lastStart).replace(/^\s*(?:the|a|an|my|his|her|their)\s+/i, '').replace(/\s+(?:in|into|inside|within)\s*$/i, '').trim();
  if (!itemPhrase) return null;
  return { type: 'stow', item_phrase: itemPhrase.slice(0, 120), container: container === 'bag of holding' ? 'Bag of Holding' : container, whole_stack: WHOLE_STACK.test(itemPhrase), version: STOW_INTENT_VERSION };
}

const STOP_TOKENS = new Set(['the', 'a', 'an', 'my', 'of', 'in', 'into', 'inside', 'within', 'this', 'that', 'these', 'those', 'some', 'all', 'entire', 'whole', 'every', 'newly', 'acquired', 'quiver', 'bag', 'holding', 'tainted', 'iron', 'shaft', 'shafts']);
const scoredTokens = (value) => normalize(value).split(' ').filter((token) => token.length > 2 && !STOP_TOKENS.has(token));

/**
 * Resolve the stow item phrase against carried inventory via token overlap.
 * Returns { kind: 'unique', item, index } | { kind: 'ambiguous', candidates } | { kind: 'unresolved' }.
 */
export function resolveStowTarget(character, itemPhrase) {
  const inventory = Array.isArray(character.inventory) ? character.inventory : [];
  const phraseTokens = scoredTokens(itemPhrase);
  if (!phraseTokens.length) return { kind: 'unresolved', candidates: [] };
  const matches = inventory.map((item, index) => {
    const nameTokens = scoredTokens(item?.name);
    const overlap = nameTokens.filter((token) => phraseTokens.includes(token)).length;
    return { item, index, name: String(item?.name || '').trim(), coverage: nameTokens.length ? overlap / nameTokens.length : 0, overlap };
  }).filter((entry) => entry.overlap > 0 && (entry.coverage >= 0.5 || phraseTokens.includes(normalize(entry.name))));
  const distinct = new Set(matches.map((entry) => entry.name));
  if (matches.length === 1 && distinct.size === 1) return { kind: 'unique', item: matches[0].item, index: matches[0].index };
  if (matches.length > 1) return { kind: 'ambiguous', candidates: [...distinct] };
  return { kind: 'unresolved', candidates: [] };
}

const stableIdentity = (item) => String(item?.equipment_id || item?.item_id || '').trim() || (item?.death_provenance?.combat_id && item?.death_provenance?.combatant_id ? `corpse:${item.death_provenance.combat_id}:${item.death_provenance.combatant_id}` : `name:${normalize(item?.name)}`);
const corpseWordsOnly = (value) => normalize(value).split(' ').filter((word) => !['the','a','an','body','corpse','remains','dead','fallen','defeated','overseer'].includes(word));
const hash = async (value) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(value))))).map((byte) => byte.toString(16).padStart(2, '0')).join('');

export async function resolveCompletedCombatCorpse({ base44, session, character, itemPhrase, requestId }) {
  if (!/\b(?:body|corpse|remains|dead|fallen|defeated)\b/i.test(String(itemPhrase || ''))) return { kind: 'unresolved', candidates: [] };
  const completed = session?.world_state?.last_completed_combat;
  const combatId = String(completed?.combat_id || '');
  if (!combatId) return { kind: 'unresolved', candidates: [] };
  const combat = await base44.asServiceRole.entities.CombatLog.get(combatId).catch(() => null);
  if (!combat || combat.session_id !== session.id || combat.character_id !== character.id || combat.result !== 'victory' || combat.is_active !== false) return { kind: 'unresolved', candidates: [] };
  const defeated = (completed?.defeated_enemies || completed?.combatants || []).filter((entry) => entry?.type === 'enemy' && Number(entry?.hp) === 0 && entry?.status === 'dead' && entry?.can_act === false);
  const phraseTokens = corpseWordsOnly(itemPhrase);
  const matches = defeated.filter((entry) => {
    const nameTokens = corpseWordsOnly(entry?.name);
    return !phraseTokens.length || nameTokens.some((word) => phraseTokens.includes(word));
  });
  if (matches.length !== 1) return { kind: matches.length ? 'ambiguous' : 'unresolved', candidates: matches.map((entry) => `${entry.name}'s Corpse`) };
  const dead = matches[0];
  const combatant = (combat.combatants || []).find((entry) => (entry?.id || entry?.entity_id) === dead.entity_id);
  if (!combatant || Number(combatant.hp_current) !== 0 || combatant.is_conscious !== false) return { kind: 'unresolved', candidates: [] };
  const existing = (character.stowed_items || []).find((item) => item?.death_provenance?.combat_id === combatId && item?.death_provenance?.combatant_id === dead.entity_id);
  if (existing) return { kind: 'already_stowed', item: existing };
  const storyIndex = (session.story_log || []).findIndex((entry) => entry?.request_id === requestId);
  const at = new Date().toISOString();
  return { kind: 'unique', source: 'completed_combat', item: {
    name: `${dead.name}'s Corpse`, quantity: 1, category: 'Corpse', description: `The remains of ${dead.name}, defeated in the completed encounter.`,
    alive: false, status: 'dead', is_identified: true,
    death_provenance: { combat_id: combatId, combatant_id: dead.entity_id, enemy_name: dead.name, hp: 0, status: 'dead', died_at: combat.encounter_date || null },
    provenance: { source: 'story_log_stow', story_index: storyIndex >= 0 ? storyIndex : (session.story_log || []).length, story_request_id: requestId, acquired_at: at, combat_id: combatId, combatant_id: dead.entity_id },
  }, combat };
}

/**
 * Authoritative stow: move a carried item or an established defeated creature
 * into a container sub-inventory.
 * (character.stowed_items). Idempotent per request token; ambiguous or
 * unresolvable item phrases request in-narration clarification instead of
 * hard-erroring after a passed check.
 */
export async function executeStowAction({ base44, ownerId = null, payload }) {
  const parsed = classifyStowIntent(payload?.action_text);
  if (!parsed) return { status: 200, body: { handled: false, writes: 0 } };
  const token = String(payload?.request_id || '').slice(0, 120);
  if (!token) return { status: 400, body: { handled: true, error: 'request_id is required.', writes: 0 } };
  const [session, character] = await Promise.all([
    base44.asServiceRole.entities.GameSession.get(payload.session_id).catch(() => null),
    base44.asServiceRole.entities.Character.get(payload.character_id).catch(() => null),
  ]);
  if (!session || !character || session.character_id !== character.id || (ownerId && character.created_by_id !== ownerId)) return { status: 403, body: { handled: true, error: 'Character and Session linkage is invalid.', writes: 0 } };
  const abilities = { ...(character.long_rest_abilities || {}) };
  const receipts = Array.isArray(abilities[STOW_RECEIPTS_KEY]) ? abilities[STOW_RECEIPTS_KEY] : [];
  const prior = receipts.find((receipt) => receipt?.token === token);
  if (prior) return { status: 200, body: { handled: true, success: true, already_processed: true, stow: prior, receipt: prior, stowed_items: character.stowed_items || [], inventory: character.inventory || [], writes: 0 } };
  if (payload?.check?.success === false) return { status: 200, body: { handled: true, success: false, reason: 'failed_check', writes: 0 } };

  let resolution = resolveStowTarget(character, parsed.item_phrase);
  if (resolution.kind === 'unresolved') resolution = await resolveCompletedCombatCorpse({ base44, session, character, itemPhrase: parsed.item_phrase, requestId: token });
  if (resolution.kind === 'already_stowed') return { status: 200, body: { handled: true, success: true, already_processed: true, stow: { token, item_id: stableIdentity(resolution.item), item_name: resolution.item.name, quantity: 1, container: resolution.item.container, source: 'completed_combat', stow_intent_version: STOW_INTENT_VERSION }, receipt: null, stowed_items: character.stowed_items || [], inventory: character.inventory || [], writes: 0 } };
  if (resolution.kind !== 'unique') return { status: 200, body: { handled: true, success: false, clarification_required: true, item_phrase: parsed.item_phrase, container: parsed.container, candidates: resolution.candidates, message: `Which established item or defeated creature do you want to stow? The phrase "${parsed.item_phrase}" does not resolve to one source.`, writes: 0 } };

  const [latestSession, latestCharacter] = await Promise.all([
    base44.asServiceRole.entities.GameSession.get(session.id),
    base44.asServiceRole.entities.Character.get(character.id),
  ]);
  if (latestSession.updated_date !== session.updated_date || latestCharacter.updated_date !== character.updated_date) return { status: 409, body: { handled: true, error: 'State changed before stow; refresh and retry.', concurrency_conflict: true, writes: 0 } };

  const selected = resolution.item;
  const source = resolution.source || 'inventory';
  const quantity = Number(selected.quantity) || 1;
  const stowQuantity = source === 'completed_combat' ? 1 : parsed.whole_stack ? quantity : 1;
  const remaining = source === 'completed_combat' ? 0 : quantity - stowQuantity;
  const inventory = Array.isArray(character.inventory) ? [...character.inventory] : [];
  if (source === 'inventory') {
    if (remaining <= 0) inventory.splice(resolution.index, 1);
    else inventory[resolution.index] = { ...selected, quantity: remaining };
  }
  const at = new Date().toISOString();
  const receipt = { token, item_id: stableIdentity(selected), item_name: selected.name, quantity: stowQuantity, container: parsed.container, source, quantity_before: quantity, quantity_after: remaining, at, state_hash_before: await hash({ inventory: character.inventory || [], stowed_items: character.stowed_items || [] }), stow_intent_version: STOW_INTENT_VERSION };
  const stowed = Array.isArray(character.stowed_items) ? [...character.stowed_items] : [];
  const existingSlot = source === 'inventory' ? stowed.find((entry) => entry?.name === selected.name && entry?.container === parsed.container) : null;
  if (existingSlot) existingSlot.quantity = (Number(existingSlot.quantity) || 0) + stowQuantity;
  else stowed.push({ ...selected, quantity: stowQuantity, container: parsed.container, stowed_at: at, stow_request_id: token, provenance: { ...(selected.provenance || {}), source: selected.provenance?.source || 'player_action', story_request_id: token, acquired_at: selected.provenance?.acquired_at || at } });
  receipt.state_hash_after = await hash({ inventory, stowed_items: stowed });
  abilities[STOW_RECEIPTS_KEY] = [...receipts.slice(-47), receipt];
  await base44.asServiceRole.entities.Character.update(character.id, { inventory, stowed_items: stowed, long_rest_abilities: abilities });
  return { status: 200, body: { handled: true, success: true, already_processed: false, stow: receipt, receipt, stowed_items: stowed, inventory, writes: 1 } };
}
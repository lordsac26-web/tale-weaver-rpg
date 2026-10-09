/**
 * Narrated Item Depletion — the mirror of narratedLootMaterialization.
 *
 * When committed narration transfers an item OUT of the player's possession
 * (giving to an NPC, dropping, leaving behind, selling, sacrificing), this
 * module detects the transfer and depletes the item from inventory or
 * stowed_items, recording the recipient/destination provenance in the
 * session's world_items so the item remains interactable in the world.
 */

export const NARRATED_DEPLETION_VERSION = 'narrated-depletion-v1.0.0';

// Verbs that indicate the player is transferring an item away from themselves.
const TRANSFER_OUT_VERBS = '(?:give(?:s|n)?|giving|gave|hand(?:s|ed)?|handing|hand over|hands over|handed over|entrust(?:s|ed|ing)?|deliver(?:s|ed|ing)?|offer(?:s|ed|ing)?|present(?:s|ed|ing)?|surrender(?:s|ed|ing)?|donate(?:s|d)?|contribut(?:e|es|ed|ing)?|gift(?:s|ed)?|bestow(?:s|ed|ing)?|sacrifice(?:s|d)?|relinquish(?:es|ed|ing)?|yield(?:s|ed)?|cede(?:s|d)?|transfer(?:s|red|ring)?|pass(?:es|ed)?|passing|return(?:s|ed|ing)?|restore(?:s|d)?|hand back|hands back|handed back|drop(?:s|ped|ping)?|leave(?:s|ing)?|leaves behind|left behind|discard(?:s|ed|ing)?|abandon(?:s|ed|ing)?|set down|sets down|place down|places down|deposit(?:s|ed|ing)?|sell(?:s|ing)?|sold|trade(?:s|d)?|exchang(?:e|es|ed|ing)?)';

// Recipient indicators — captures who/what received the item.
const RECIPIENT_PATTERN = '(?:to|for|toward|towards|unto)\\s+(?<recipient>[^,.\\n;]{2,60})';

// Pattern: transfer verb + optional "the" + named item(s) + recipient preposition
const NAMED_TRANSFER_PATTERN = new RegExp(
  `\\b${TRANSFER_OUT_VERBS}\\b\\s+(?:the\\s+|your\\s+|a\\s+|an\\s+)?(?<items>[^,.\\n;]+?)\\s+${RECIPIENT_PATTERN}`,
  'i'
);

// Also match "entrust X to Y" / "hand X over to Y" / "give X to Y"
const TRANSFER_OVER_PATTERN = new RegExp(
  `\\b${TRANSFER_OUT_VERBS}\\b\\s+(?:the\\s+|your\\s+|a\\s+|an\\s+)?(?<items>[^,.\\n;]+?)\\s+(?:over\\s+)?${RECIPIENT_PATTERN}`,
  'i'
);

// Drop/leave pattern without explicit recipient: "drop the X", "leave the X behind".
// Trailing group is REQUIRED (not optional) so the non-greedy items group matches
// enough to reach it — otherwise it collapses to a single character.
const DROP_LEAVE_PATTERN = new RegExp(
  `\\b(?:drop(?:s|ped|ping)?|leave(?:s|ing)?|discard(?:s|ed|ing)?|abandon(?:s|ed|ing)?|set(?:s)?\\s+down)\\b\\s+(?:the\\s+|your\\s+|a\\s+|an\\s+)?(?<items>[^,.\\n;]+?)(?:\\s+behind\\b|\\s+(?:in|on|at|near|by)\\b[^.\\n;]{2,50})`,
  'i'
);

const splitItemNames = (itemsText) => {
  if (!itemsText) return [];
  return itemsText
    .split(/\s+and\s+|,\s*|\s*,\s*/)
    .map(s => s.trim())
    .filter(s => s && s.length > 2 && s.length < 80)
    .map(s => s.replace(/^(?:the|a|an|my|your|his|her|their|this|that|these|those)\s+/i, '').trim())
    .filter(s => s && s.length > 2);
};

const normalizeItemName = (name) => {
  return name.trim().replace(/\s+/g, ' ').replace(/^(?:the|a|an)\s+/i, '').trim();
};

/**
 * Find a matching item in the character's inventory or stowed_items.
 * Uses fuzzy matching: exact, includes, or partial match on the name.
 */
const findOwnedItem = (character, itemName) => {
  const normalized = normalizeItemName(itemName).toLowerCase();
  if (!normalized || normalized.length < 3) return null;
  const inventory = character?.inventory || [];
  const stowed = character?.stowed_items || [];
  // Prefer exact match, then includes match
  const allItems = [
    ...inventory.map(i => ({ ...i, _location: 'inventory', _list: inventory })),
    ...stowed.map(i => ({ ...i, _location: 'stowed', _list: stowed })),
  ];
  // Exact match
  let match = allItems.find(item => normalizeItemName(item?.name || '').toLowerCase() === normalized);
  if (match) return match;
  // Includes match (item name contains the search term or vice versa)
  match = allItems.find(item => {
    const existing = normalizeItemName(item?.name || '').toLowerCase();
    return existing.includes(normalized) || normalized.includes(existing);
  });
  return match || null;
};

/**
 * Extract narrated item transfers OUT of the player's possession.
 * Returns array of { name, recipient, sentence }.
 */
export function extractNarratedDepletions(narrative) {
  const text = String(narrative || '');
  if (!text) return [];
  const found = [];
  const patterns = [NAMED_TRANSFER_PATTERN, TRANSFER_OVER_PATTERN, DROP_LEAVE_PATTERN];
  for (const pattern of patterns) {
    const matches = text.matchAll(new RegExp(pattern.source, 'gi'));
    for (const match of matches) {
      const itemsText = match.groups?.items;
      const recipient = match.groups?.recipient?.trim() || 'the scene';
      if (!itemsText) continue;
      const names = splitItemNames(itemsText);
      for (const name of names) {
        if (name && name.length > 2 && name.length < 80) {
          found.push({ name: normalizeItemName(name), recipient: recipient.slice(0, 80), sentence: match[0].trim() });
        }
      }
    }
  }
  // Deduplicate on name
  const seen = new Set();
  return found.filter(item => {
    const key = item.name.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Detect and commit narrated item depletions.
 * Removes matched items from inventory or stowed_items and records
 * them in the session's world_items with recipient provenance.
 *
 * Only items that already exist in the player's possession are depleted.
 * This prevents false positives from narration about items the player
 * never owned.
 */
export async function materializeNarratedDepletion({ base44, sessionId, characterId, requestId, narrative, storyIndex }) {
  const db = base44.asServiceRole;
  const depletions = extractNarratedDepletions(narrative);
  if (!depletions.length) return { applied: false, depleted: [], writes: 0 };

  const [session, character] = await Promise.all([
    db.entities.GameSession.get(sessionId).catch(() => null),
    db.entities.Character.get(characterId).catch(() => null),
  ]);
  if (!session || !character) return { applied: false, depleted: [], writes: 0 };

  // Only deplete items the player actually owns
  const ownedDepletions = [];
  for (const dep of depletions) {
    const owned = findOwnedItem(character, dep.name);
    if (owned) {
      ownedDepletions.push({ ...dep, owned });
    }
  }
  if (!ownedDepletions.length) return { applied: false, depleted: [], writes: 0 };

  const inventory = Array.isArray(character.inventory) ? [...character.inventory] : [];
  const stowed = Array.isArray(character.stowed_items) ? [...character.stowed_items] : [];
  const worldItems = Array.isArray(session.world_state?.world_items) ? [...session.world_state.world_items] : [];

  const depletedRecords = [];
  for (const dep of ownedDepletions) {
    const owned = dep.owned;
    // Remove from the appropriate list
    if (owned._location === 'inventory') {
      const idx = inventory.findIndex(i => i === owned);
      if (idx >= 0) inventory.splice(idx, 1);
    } else if (owned._location === 'stowed') {
      const idx = stowed.findIndex(i => i === owned);
      if (idx >= 0) stowed.splice(idx, 1);
    }
    // Record in world_items with recipient provenance
    const worldEntry = {
      name: owned.name,
      quantity: owned.quantity || 1,
      category: owned.category || 'Item',
      description: owned.description || `Transferred from ${character.name}'s possession via narration.`,
      location: session.current_location || 'Unknown',
      holder: dep.recipient,
      status: 'transferred',
      provenance: {
        source: 'narrated_depletion',
        previous_owner: character.name,
        story_index: storyIndex ?? null,
        story_request_id: requestId || null,
        handoff_narration: dep.sentence?.slice(0, 300) || '',
        transferred_at: new Date().toISOString(),
        previous_provenance: owned.provenance || null,
      },
    };
    worldItems.push(worldEntry);
    depletedRecords.push({ name: owned.name, quantity: owned.quantity || 1, recipient: dep.recipient, previous_location: owned._location });
  }

  const updateData = {};
  if (stowed.length !== (character.stowed_items || []).length) updateData.stowed_items = stowed;
  if (inventory.length !== (character.inventory || []).length) updateData.inventory = inventory;

  if (Object.keys(updateData).length === 0) return { applied: false, depleted: [], writes: 0 };

  await db.entities.Character.update(characterId, updateData);

  // Update session world_state with world_items
  const currentWorldState = session.world_state || {};
  await db.entities.GameSession.update(sessionId, {
    world_state: { ...currentWorldState, world_items: worldItems },
  });

  return {
    applied: true,
    depleted: depletedRecords,
    writes: 2,
    version: NARRATED_DEPLETION_VERSION,
  };
}
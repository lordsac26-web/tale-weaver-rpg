import { classifyNarratedAcquisitions } from './narratedStoryInventoryCommit.ts';

export const NARRATED_LOOT_VERSION = 'narrated-loot-v1.0.0';

// Extended item kinds beyond the recovery parser's combat-focused list.
// Covers magic items, jewelry, containers, and unique named objects.
const EXTENDED_ITEM_KIND = '(?:medallions?|pendants?|talismans?|orbs?|crystals?|spheres?|cylinders?|vials?|flasks?|bottles?|jars?|boxes?|chests?|caskets?|urns?|relics?|artifacts?|totems?|idols?|statuettes?|figurines?|gems?|jewels?|stones?|shards?|fragments?|seals?|signets?|badges?|insignias?|tokens?|charms?|fetishes?|phylacteries?|scepters?|sceptres?|crowns?|tiaras?|diadems?|circlets?|bands?|bracers?|gauntlets?|greaves?|pauldrons?|mantles?|cloaks?|robes?|vestments?|vests?|tunics?|tabards?|sashes?|belts?|girdles?|sandals?|slippers?|boots?|shoes?|helmets?|helms?|hoods?|masks?|veils?|blinders?|lenses?|goggles?|monocles?|eyepieces?|rings?|bands?|circles?|hoops?|bangles?|bracelets?|armbands?|armlets?|earrings?|studs?|pins?|brooches?|clasps?|buckles?|chains?|necklaces?|amulets?|lockets?|chokers?|collars?|torcs?|pendants?|fobs?|watches?|clocks?|hourglasses?|astrolabes?|compasses?|sextants?|maps?|charts?|scrolls?|tomes?|books?|ledgers?|journals?|diaries?|grimoires?|spellbooks?|manuals?|treatises?|codices?|tablets?|steles?|obelisks?|runestones?|keystones?|keystones?|keys?|locks?|padlocks?|bolts?|latches?|chains?|manacles?|shackles?|irons?|cuffs?|restraints?|bonds?|fetters?|ropes?|cords?|strings?|lines?|tethers?|leashes?|lassoes?|lassos?|nooses?|snares?|traps?|pits?|snares?|nets?|webs?|meshes?|grids?|lattices?|trellises?|arbors?|pergolas?|gazebos?|pavilions?|tents?|canopies?|awnings?|tarps?|covers?|cloths?|fabrics?|textiles?|garments?|apparel?|attire?|raiment?|habiliments?|vestments?|regalia?|panoply?|accoutrements?|equipage?|trappings?|furnishings?|appointments?|accessories?|adornments?|decorations?|ornaments?|trinkets?|baubles?|knickknacks?|curios?|novelties?|souvenirs?|mementos?|keepsakes?|heirlooms?|antiques?|relics?|remnants?|remains?|fragments?|shards?|splinters?|chips?|flakes?|specks?|grains?|particles?|motes?|specks?|dusts?|powders?|ashes?|cinders?|embers?|coals?|bricks?|blocks?|stones?|rocks?|boulders?|pebbles?|gravels?|sands?|silts?|clays?|muds?|dirts?|soils?|earths?|grounds?|dusts?|powders?|substances?|materials?|matters?|stuffs?|things?|objects?|items?|pieces?)';

const LOOT_ACQUISITION = '(?:scoop(?:ed)?|scoop(?:ed)?\\s+up|gather(?:ed)?|collect(?:ed)?|retrieve(?:d)?|recover(?:ed)?|take(?:s)?|took|pick(?:ed)?\\s+up|grab(?:bed)?|snatch(?:ed)?|seize(?:d)?|claim(?:ed)?|secure(?:d)?|pocket(?:ed)?|stash(?:ed)?|stow(?:ed)?|place(?:d)?|put|deposit(?:ed)?|loot(?:ed)?|plunder(?:ed)?|salvage(?:d)?)';
const LOOT_DESTINATION = '(?:bag|backpack|pack|satchel|pouch|case|container|quiver|pocket|inventory|pack|holdings?|bag of holding| extradimensional|void|pocket dimension)';

// Pattern: acquisition verb + "the" + named item(s) + optional destination
const NAMED_LOOT_PATTERN = new RegExp(
  `\\b${LOOT_ACQUISITION}\\b\\s+(?:the\\s+)?(?<items>[^,.\\n]+?)\\s+(?:into|onto|in|inside|within|to|at|up|to)\\s+(?:the\\s+|your\\s+|a\\s+|an\\s+|my\\s+)?(?:${LOOT_DESTINATION})\\b`,
  'i'
);

// Also match "X and Y" patterns in the items group
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

const itemExists = (character, itemName) => {
  const normalized = normalizeItemName(itemName).toLowerCase();
  const inventory = character?.inventory || [];
  const stowed = character?.stowed_items || [];
  return [...inventory, ...stowed].some(item => {
    const existing = normalizeItemName(item?.name || '').toLowerCase();
    return existing === normalized || existing.includes(normalized) || normalized.includes(existing);
  });
};

const inferCategory = (itemName) => {
  const lower = itemName.toLowerCase();
  if (/medallion|pendant|talisman|amulet|necklace|locket|choker|collar|torc|ring|bracelet|armband|earring|brooch|clasp|buckle|chain|pin|stud/i.test(lower)) return 'Jewelry';
  if (/cylinder|vial|flask|bottle|jar|box|chest|casket|urn|container|canister|capsule/i.test(lower)) return 'Container';
  if (/scroll|tome|book|ledger|journal|diary|grimoire|spellbook|manual|treatise|codex|tablet/i.test(lower)) return 'Document';
  if (/orb|crystal|sphere|gem|jewel|stone|shard|fragment|seal|signet|badge|insignia|token|charm|fetish|phylactery|relic|artifact|totem|idol|statuette|figurine/i.test(lower)) return 'Magic Item';
  if (/scepter|sceptre|crown|tiara|diadem|circlet|band|bracer|gauntlet|greave|pauldron|mantle|cloak|robe|vestment|vest|tunic|tabard|sash|belt|girdle|sandal|slipper|boot|shoe|helmet|helm|hood|mask|veil|lens|goggle|monocle|eyepiece/i.test(lower)) return 'Equipment';
  return 'Item';
};

const inferWeight = (itemName) => {
  const lower = itemName.toLowerCase();
  if (/medallion|pendant|ring|bracelet|earring|brooch|clasp|buckle|chain|pin|stud|token|charm|badge|insignia|signet|seal/i.test(lower)) return 0.5;
  if (/cylinder|vial|flask|bottle|jar|box|orb|crystal|sphere|gem|jewel|stone|shard|fragment|relic|totem|idol|statuette|figurine/i.test(lower)) return 2;
  if (/scroll|tome|book|ledger|journal|diary|grimoire|spellbook|manual|treatise|codex|tablet|cloak|robe|vestment|vest|tunic|tabard/i.test(lower)) return 3;
  if (/chest|casket|urn|scepter|sceptre|crown|tiara|diadem|circlet|bracer|gauntlet|greave|pauldron|mantle|helmet|helm|hood|mask/i.test(lower)) return 5;
  return 1;
};

export function extractNarratedLoot(narrative) {
  const text = String(narrative || '');
  if (!text) return [];
  const found = [];
  // Pattern 1: "scoop the X and Y into the bag"
  const matches = text.matchAll(new RegExp(NAMED_LOOT_PATTERN.source, 'gi'));
  for (const match of matches) {
    const itemsText = match.groups?.items;
    if (!itemsText) continue;
    const names = splitItemNames(itemsText);
    for (const name of names) {
      if (name && name.length > 2 && name.length < 80) found.push({ name: normalizeItemName(name), sentence: match[0].trim() });
    }
  }
  // Pattern 2: Use existing concrete acquisition parser for standard item types
  const parsed = classifyNarratedAcquisitions(text);
  for (const claim of parsed.concrete || []) {
    if (claim?.item_name) {
      const name = normalizeItemName(claim.item_name);
      if (name && name.length > 2 && !found.some(f => f.name.toLowerCase() === name.toLowerCase())) {
        found.push({ name, sentence: claim.sentence });
      }
    }
  }
  // Deduplicate
  const seen = new Set();
  return found.filter(item => {
    const key = item.name.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function materializeNarratedLoot({ base44, sessionId, characterId, requestId, narrative, storyIndex }) {
  const db = base44.asServiceRole;
  const loot = extractNarratedLoot(narrative);
  if (!loot.length) return { applied: false, materialized: [], writes: 0 };

  const [session, character] = await Promise.all([
    db.entities.GameSession.get(sessionId).catch(() => null),
    db.entities.Character.get(characterId).catch(() => null),
  ]);
  if (!session || !character) return { applied: false, materialized: [], writes: 0 };

  // Filter out items that already exist in inventory or stowed_items
  const newItems = loot.filter(item => !itemExists(character, item.name));
  if (!newItems.length) return { applied: false, materialized: [], writes: 0 };

  // Determine if narration mentions Bag of Holding as destination
  const bagMentioned = /bag of holding|extradimensional|pocket dimension/i.test(narrative);

  const stowed = Array.isArray(character.stowed_items) ? [...character.stowed_items] : [];
  const inventory = Array.isArray(character.inventory) ? [...character.inventory] : [];
  const provenance = {
    source: 'narrated_loot',
    story_index: storyIndex ?? null,
    story_request_id: requestId || null,
    acquired_at: new Date().toISOString(),
  };

  for (const item of newItems) {
    const entry = {
      name: item.name,
      quantity: 1,
      category: inferCategory(item.name),
      is_identified: false,
      description: `Recovered from the scene: ${item.name}. Narrated acquisition: "${item.sentence?.slice(0, 200) || ''}"`,
      weight: inferWeight(item.name),
      stowed_at: new Date().toISOString(),
      stow_request_id: `narrated-loot:${requestId || 'unknown'}:${item.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
      provenance,
    };
    if (bagMentioned) {
      entry.container = 'Bag of Holding';
      stowed.push(entry);
    } else {
      inventory.push(entry);
    }
  }

  const updateData = {};
  if (stowed.length !== (character.stowed_items || []).length) updateData.stowed_items = stowed;
  if (inventory.length !== (character.inventory || []).length) updateData.inventory = inventory;

  if (Object.keys(updateData).length === 0) return { applied: false, materialized: [], writes: 0 };

  await db.entities.Character.update(characterId, updateData);
  return {
    applied: true,
    materialized: newItems.map(item => ({ name: item.name, category: inferCategory(item.name), weight: inferWeight(item.name), container: bagMentioned ? 'Bag of Holding' : null, provenance })),
    writes: 1,
    version: NARRATED_LOOT_VERSION,
  };
}
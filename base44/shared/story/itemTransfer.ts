export const ITEM_TRANSFER_VERSION = 'authoritative-item-transfer-v1.0.0';
export const ITEM_TRANSFER_RECEIPTS_KEY = '__item_transfer_receipts';

const normalize = (value) => String(value || '').toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
const TRANSFER_VERB = /\b(retrieve|retrieves|retrieved|take|takes|took|pull|pulls|pulled|remove|removes|removed|place|places|placed|put|puts|secure|secures|secured|inter|inters|interred|bury|buries|buried|leave|leaves|left|deposit|deposits|deposited|transfer|transfers|transferred|give|gives|gave|drop|drops|dropped|offer|offers|offered)\b/i;
const SOURCE_CONTAINER = /\b(?:out of|from)\s+(?:the\s+|my\s+)?(bag of holding|bag|backpack|pack|satchel|pouch|case|container|tomb|grave|ground)\b/i;
const DESTINATION = /\b(?:into|inside|within|in|to|at)\s+(?:the\s+|a\s+|an\s+|my\s+)?([^,.]+?)(?:\s+for\b|\s+so\b|\s+before\b|\s+after\b|[,.]|$)/i;
const INSPECTION_ONLY = /\b(?:look|inspect|examine|study|read)\b/i;
const BAG = /^(?:bag of holding|bag|backpack|pack|satchel|pouch|case|container)$/i;
const STOP = new Set(['the','a','an','my','your','his','her','their','body','remains','item','items','corpse','dead','of','from','out','bag','holding']);
const tokens = (value) => normalize(value).split(' ').filter((word) => word.length > 2 && !STOP.has(word)).map((word) => word.length > 4 && word.endsWith('s') ? word.slice(0, -1) : word);
const identity = (item) => String(item?.instance_id || item?.item_id || item?.equipment_id || '').trim() || `name:${normalize(item?.name)}`;
const hash = async (value) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(value))))).map((byte) => byte.toString(16).padStart(2, '0')).join('');

export function classifyItemTransferIntent(actionText) {
  const text = String(actionText || '').trim();
  const verb = text.match(TRANSFER_VERB);
  if (!verb) return null;
  const source = text.match(SOURCE_CONTAINER);
  const destination = text.slice(verb.index + verb[0].length).match(DESTINATION);
  const retrieval = !!source && /retrieve|take|took|pull|remove/i.test(verb[0]);
  if (retrieval) {
    const itemPhrase = text.slice(verb.index + verb[0].length, source.index).replace(/^\s*(?:the|a|an|my|his|her|their)\s+/i, '').trim();
    if (!itemPhrase || (INSPECTION_ONLY.test(text) && !/inventory|carry|keep on me/i.test(text))) return null;
    return { type: 'item_transfer', item_phrase: itemPhrase.slice(0, 120), source_hint: source[1], destination: 'Carried Inventory', destination_kind: 'carried', version: ITEM_TRANSFER_VERSION };
  }
  if (!destination) return null;
  const destinationName = destination[1].replace(/\s+/g, ' ').trim();
  if (!destinationName || BAG.test(destinationName)) return null;
  const itemPhrase = text.slice(verb.index + verb[0].length, verb.index + verb[0].length + destination.index).replace(/^\s*(?:the|a|an|my|his|her|their)\s+/i, '').trim();
  if (!itemPhrase) return null;
  return { type: 'item_transfer', item_phrase: itemPhrase.slice(0, 120), source_hint: null, destination: destinationName.slice(0, 120), destination_kind: /\b(?:give|offer)\b/i.test(verb[0]) ? 'recipient' : 'world', version: ITEM_TRANSFER_VERSION };
}

export function resolveItemTransferTarget(character, session, itemPhrase) {
  const phrase = tokens(itemPhrase);
  if (!phrase.length) return { kind: 'unresolved', candidates: [] };
  const sources = [
    ...(character?.stowed_items || []).map((item, index) => ({ item, index, source: 'stowed_items' })),
    ...(character?.inventory || []).map((item, index) => ({ item, index, source: 'inventory' })),
    ...(session?.world_state?.world_items || []).map((item, index) => ({ item, index, source: 'world_items' })),
  ];
  const matches = sources.map((entry) => {
    const itemTokens = tokens(entry.item?.name);
    const overlap = itemTokens.filter((word) => phrase.includes(word)).length;
    return { ...entry, overlap, coverage: itemTokens.length ? overlap / itemTokens.length : 0 };
  }).filter((entry) => entry.overlap > 0 && entry.coverage >= 0.5);
  if (matches.length === 1) return { kind: 'unique', ...matches[0] };
  return { kind: matches.length ? 'ambiguous' : 'unresolved', candidates: [...new Set(matches.map((entry) => entry.item?.name).filter(Boolean))] };
}

const removeOne = (items, index) => {
  const next = [...items];
  const quantity = Math.max(1, Number(next[index]?.quantity) || 1);
  if (quantity === 1) next.splice(index, 1); else next[index] = { ...next[index], quantity: quantity - 1 };
  return next;
};

export async function executeItemTransferAction({ base44, ownerId = null, payload }) {
  const intent = classifyItemTransferIntent(payload?.action_text);
  if (!intent) return { status: 200, body: { handled: false, writes: 0 } };
  const requestId = String(payload?.request_id || '').slice(0, 120);
  if (!requestId) return { status: 400, body: { handled: true, error: 'request_id is required.', writes: 0 } };
  const db = base44.asServiceRole;
  const [session, character] = await Promise.all([
    db.entities.GameSession.get(payload.session_id).catch(() => null),
    db.entities.Character.get(payload.character_id).catch(() => null),
  ]);
  if (!session || !character || session.character_id !== character.id || (ownerId && character.created_by_id !== ownerId)) return { status: 403, body: { handled: true, error: 'Character and Session linkage is invalid.', writes: 0 } };
  const receipts = Array.isArray(session.world_state?.[ITEM_TRANSFER_RECEIPTS_KEY]) ? session.world_state[ITEM_TRANSFER_RECEIPTS_KEY] : [];
  const prior = receipts.find((entry) => entry?.request_id === requestId);
  if (prior) return { status: 200, body: { handled: true, success: true, already_processed: true, receipt: prior, writes: 0, character, session } };
  if (payload?.check?.success === false) return { status: 200, body: { handled: true, success: false, reason: 'failed_check', writes: 0 } };
  const resolved = resolveItemTransferTarget(character, session, intent.item_phrase);
  if (resolved.kind !== 'unique') return { status: 200, body: { handled: true, success: false, clarification_required: true, candidates: resolved.candidates, item_phrase: intent.item_phrase, destination: intent.destination, writes: 0 } };

  const latest = await Promise.all([db.entities.GameSession.get(session.id), db.entities.Character.get(character.id)]);
  if (latest[0].updated_date !== session.updated_date || latest[1].updated_date !== character.updated_date) return { status: 409, body: { handled: true, error: 'State changed before transfer; refresh and retry.', concurrency_conflict: true, writes: 0 } };
  const inventory = [...(character.inventory || [])];
  const stowed = [...(character.stowed_items || [])];
  const worldItems = [...(session.world_state?.world_items || [])];
  if (resolved.source === 'inventory') inventory.splice(0, inventory.length, ...removeOne(inventory, resolved.index));
  if (resolved.source === 'stowed_items') stowed.splice(0, stowed.length, ...removeOne(stowed, resolved.index));
  if (resolved.source === 'world_items') worldItems.splice(0, worldItems.length, ...removeOne(worldItems, resolved.index));
  const at = new Date().toISOString();
  const moved = { ...resolved.item, quantity: 1, transfer_provenance: { ...(resolved.item?.transfer_provenance || {}), source: resolved.source, destination: intent.destination, request_id: requestId, at } };
  if (intent.destination_kind === 'carried') inventory.push({ ...moved, container: undefined });
  else worldItems.push({ ...moved, container: intent.destination, world_status: 'placed', location: session.current_location || null });
  const beforeProjection = { inventory: character.inventory || [], stowed_items: character.stowed_items || [], world_items: session.world_state?.world_items || [] };
  const afterProjection = { inventory, stowed_items: stowed, world_items: worldItems };
  const receipt = { request_id: requestId, version: ITEM_TRANSFER_VERSION, item_id: identity(resolved.item), item_name: resolved.item.name, quantity: 1, source: resolved.source, destination: intent.destination, destination_kind: intent.destination_kind, death_state_retained: resolved.item?.alive === false && moved.alive === false, provenance_retained: JSON.stringify(resolved.item?.provenance || null) === JSON.stringify(moved.provenance || null), state_hash_before: await hash(beforeProjection), state_hash_after: await hash(afterProjection), at };
  const nextWorldState = { ...(session.world_state || {}), world_items: worldItems, [ITEM_TRANSFER_RECEIPTS_KEY]: [...receipts.slice(-49), receipt] };
  await db.entities.Character.update(character.id, { inventory, stowed_items: stowed });
  try {
    await db.entities.GameSession.update(session.id, { world_state: nextWorldState });
  } catch (error) {
    await db.entities.Character.update(character.id, { inventory: character.inventory || [], stowed_items: character.stowed_items || [] });
    return { status: 500, body: { handled: true, error: `Transfer commit failed; character change compensated: ${error.message}`, compensated: true, writes: 0 } };
  }
  const [nextSession, nextCharacter] = await Promise.all([db.entities.GameSession.get(session.id), db.entities.Character.get(character.id)]);
  return { status: 200, body: { handled: true, success: true, already_processed: false, receipt, writes: 2, character: nextCharacter, session: nextSession } };
}
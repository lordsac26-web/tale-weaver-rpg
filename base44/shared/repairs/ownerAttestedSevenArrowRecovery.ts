import { characterBelongsToUser } from '../combat/authGuard.ts';

export const OWNER_ARROW_SCOPE = {
  characterId: '6a6825cd07a490fa70a46852',
  sessionId: '6a6825edd695bd65a4322256',
  itemName: 'Arrows',
  before: 11,
  delta: 7,
  after: 18,
  receiptKey: 'owner-attested-story-arrow-find-20260813-7',
};

const digest = async (value) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(value))))).map((byte) => byte.toString(16).padStart(2, '0')).join('');
const semantic = (record, omit = []) => Object.fromEntries(Object.entries(record || {}).filter(([key]) => !['updated_date', ...omit].includes(key)));
const owns = (record, user) => characterBelongsToUser(record, user);
const arrowLike = (item) => /^arrows?(?:\s*\(\s*\d+\s*\))?$/i.test(String(item?.name || '').trim());
const canonicalRows = (inventory) => (Array.isArray(inventory) ? inventory : []).map((item, index) => ({ item, index })).filter(({ item }) => arrowLike(item));
const receipts = (session) => Array.isArray(session?.world_state?.__inventory_reconciliation_receipts) ? session.world_state.__inventory_reconciliation_receipts : [];
const receiptFor = (session, key) => receipts(session).find((entry) => entry?.request_id === key);

const snapshot = (character, session) => ({
  hp_current: Number(character.hp_current), hp_max: Number(character.hp_max), xp: Number(character.xp || 0),
  spell_slots: character.spell_slots || {}, conditions: character.conditions || [],
  currency: { gold: Number(character.gold || 0), silver: Number(character.silver || 0), copper: Number(character.copper || 0) },
  session: { character_id: session.character_id, in_combat: !!session.in_combat, combat_state: session.combat_state || {}, story_log: session.story_log || [] },
});

const hashesFor = async (character, session) => ({
  character: await digest(semantic(character)), session: await digest(semantic(session)),
  inventory: await digest(character.inventory || []), non_inventory_character: await digest(semantic(character, ['inventory'])),
  other_inventory: await digest((character.inventory || []).filter((item) => !arrowLike(item))),
  protected_fields: await digest(snapshot(character, session)),
});

const mirroredInventory = (session) => {
  if (Array.isArray(session?.world_state?.authoritative_inventory)) return { surface: 'world_state.authoritative_inventory', inventory: session.world_state.authoritative_inventory };
  if (Array.isArray(session?.combat_state?.authoritative_inventory)) return { surface: 'combat_state.authoritative_inventory', inventory: session.combat_state.authoritative_inventory };
  return null;
};

const replaceQuantity = (inventory, index, quantity) => inventory.map((item, itemIndex) => itemIndex === index ? { ...item, quantity } : item);
const hashesMatch = (expected, actual) => expected && ['character','session','inventory','non_inventory_character','other_inventory','protected_fields'].every((key) => expected[key] === actual[key]);

export async function ownerAttestedSevenArrowRecoveryCore({ db, user, mode, expectedHashes, scope = OWNER_ARROW_SCOPE }) {
  if (!user) return { status: 401, body: { error: 'Unauthorized', writes: 0 } };
  if (!['dry_run', 'apply'].includes(mode)) return { status: 400, body: { error: 'mode must be dry_run or apply', writes: 0 } };
  const [character, session] = await Promise.all([db.entities.Character.get(scope.characterId), db.entities.GameSession.get(scope.sessionId)]);
  if (!character || !session) return { status: 409, body: { error: 'Exact reconciliation records are missing.', writes: 0 } };
  if (!owns(character, user) || !owns(session, user)) return { status: 403, body: { error: 'Authenticated owner does not own both exact records.', writes: 0 } };
  if (session.character_id !== character.id) return { status: 409, body: { error: 'Character and Session linkage mismatch.', writes: 0 } };

  const prior = receiptFor(session, scope.receiptKey);
  const rows = canonicalRows(character.inventory);
  const current = rows.length === 1 ? Number(rows[0].item?.quantity) : null;
  if (prior) {
    const validReplay = prior.immutable === true && prior.before === scope.before && prior.delta === scope.delta && prior.after === scope.after && rows.length === 1 && rows[0].item?.name === scope.itemName && current === scope.after;
    return validReplay
      ? { status: 200, body: { success: true, skipped: true, replayed: true, writes: 0, request_id: scope.receiptKey, quantity: scope.after } }
      : { status: 409, body: { error: 'Receipt conflicts with current authoritative state.', writes: 0 } };
  }

  const mirror = mirroredInventory(session);
  const mirrorRows = mirror ? canonicalRows(mirror.inventory) : [];
  const exactStack = rows.length === 1 && rows[0].item?.name === scope.itemName && current === scope.before;
  const exactMirror = !mirror || (mirrorRows.length === 1 && mirrorRows[0].item?.name === scope.itemName && Number(mirrorRows[0].item?.quantity) === scope.before);
  const currentHashes = await hashesFor(character, session);
  const protectedFields = snapshot(character, session);
  const conflict = { receipt_present: false, ambiguous_stack: rows.length !== 1, before_quantity_changed: current !== scope.before, mirror_conflict: !exactMirror };
  const dryBody = {
    success: exactStack && exactMirror, mode: 'dry_run', writes: 0, request_id: scope.receiptKey,
    linkage: { character_id: character.id, session_id: session.id, session_character_id: session.character_id },
    item: { canonical_name: scope.itemName, stack_count: rows.length, before: scope.before, delta: scope.delta, after: scope.after },
    hashes: currentHashes, protected_fields: protectedFields, mirror_surface: mirror?.surface || null,
    later_conflict_receipt_check: { safe: exactStack && exactMirror, ...conflict },
  };
  if (mode === 'dry_run') return { status: exactStack && exactMirror ? 200 : 409, body: dryBody };
  if (!exactStack || !exactMirror) return { status: 409, body: { ...dryBody, error: 'Compare-and-set precondition failed.' } };
  if (!hashesMatch(expectedHashes, currentHashes)) return { status: 409, body: { error: 'Expected dry-run hashes do not match current state.', writes: 0, current_hashes: currentHashes } };

  const originalInventory = character.inventory;
  const originalWorldState = session.world_state || {};
  const originalCombatState = session.combat_state || {};
  const nextInventory = replaceQuantity(originalInventory, rows[0].index, scope.after);
  let nextWorldState = { ...originalWorldState };
  let nextCombatState = originalCombatState;
  if (mirror?.surface === 'world_state.authoritative_inventory') nextWorldState.authoritative_inventory = replaceQuantity(mirror.inventory, mirrorRows[0].index, scope.after);
  if (mirror?.surface === 'combat_state.authoritative_inventory') nextCombatState = { ...originalCombatState, authoritative_inventory: replaceQuantity(mirror.inventory, mirrorRows[0].index, scope.after) };
  const receipt = { request_id: scope.receiptKey, immutable: true, type: 'owner_attested_story_arrow_recovery', character_id: character.id, session_id: session.id, item_name: scope.itemName, before: scope.before, delta: scope.delta, after: scope.after, committed_at: new Date().toISOString() };
  nextWorldState.__inventory_reconciliation_receipts = [...receipts(session), receipt];

  let writes = 0;
  try {
    await db.entities.Character.update(character.id, { inventory: nextInventory }); writes++;
    await db.entities.GameSession.update(session.id, { world_state: nextWorldState, ...(nextCombatState !== originalCombatState ? { combat_state: nextCombatState } : {}) }); writes++;
    const [afterCharacter, afterSession] = await Promise.all([db.entities.Character.get(character.id), db.entities.GameSession.get(session.id)]);
    const afterRows = canonicalRows(afterCharacter.inventory);
    const afterMirror = mirroredInventory(afterSession); const afterMirrorRows = afterMirror ? canonicalRows(afterMirror.inventory) : [];
    const post = {
      one_canonical_stack_18: afterRows.length === 1 && afterRows[0].item?.name === scope.itemName && Number(afterRows[0].item?.quantity) === scope.after,
      hp_44_of_44: Number(afterCharacter.hp_current) === 44 && Number(afterCharacter.hp_max) === 44,
      other_inventory_unchanged: await digest((afterCharacter.inventory || []).filter((item) => !arrowLike(item))) === currentHashes.other_inventory,
      character_non_inventory_unchanged: await digest(semantic(afterCharacter, ['inventory'])) === currentHashes.non_inventory_character,
      protected_fields_unchanged: await digest(snapshot(afterCharacter, { ...afterSession, world_state: originalWorldState, combat_state: originalCombatState })) === currentHashes.protected_fields,
      mirror_consistent: !afterMirror || (afterMirrorRows.length === 1 && Number(afterMirrorRows[0].item?.quantity) === scope.after),
      receipt_stored: !!receiptFor(afterSession, scope.receiptKey),
    };
    if (Object.values(post).every(Boolean)) return { status: 200, body: { success: true, skipped: false, replayed: false, writes, request_id: scope.receiptKey, before: scope.before, delta: scope.delta, after: scope.after, postconditions: post } };
    throw new Error(`Postcondition failure: ${Object.entries(post).filter(([, pass]) => !pass).map(([key]) => key).join(', ')}`);
  } catch (error) {
    let rollbackOk = true;
    try { await db.entities.Character.update(character.id, { inventory: originalInventory }); } catch { rollbackOk = false; }
    try { await db.entities.GameSession.update(session.id, { world_state: originalWorldState, combat_state: originalCombatState }); } catch { rollbackOk = false; }
    return { status: 500, body: { error: error.message || 'Reconciliation failed.', writes: 0, rolled_back: rollbackOk } };
  }
}
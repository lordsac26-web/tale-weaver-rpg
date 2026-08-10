export const repairIds = { character: '6a6825cd07a490fa70a46852', session: '6a6825edd695bd65a4322256' };
export const repairReceipt = 'repair-craig-thrown-dagger-playtest-20260809';
const equipmentId = '6a689bdb3b23c961f0ebeaa9';
const normalize = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const hash = async (value) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(value))))).map((byte) => byte.toString(16).padStart(2, '0')).join('');
const semantic = (record, omit = []) => Object.fromEntries(Object.entries(record || {}).filter(([key]) => !['updated_date', ...omit].includes(key)));
const isArrow = (item) => /^arrows?$/i.test(String(item?.name || '').trim());
const props = (item) => (item?.properties || []).map(normalize);

export async function applyCraigThrownDaggerRepair({ db, scope = repairIds }) {
  const [character, session] = await Promise.all([db.entities.Character.get(scope.character), db.entities.GameSession.get(scope.session)]);
  if (!character || !session) return { status: 409, body: { error: 'Protected repair records are missing.', writes: 0 } };
  const abilities = { ...(character.long_rest_abilities || {}) };
  const receipts = Array.isArray(abilities.__playtest_repairs) ? abilities.__playtest_repairs : [];
  const prior = receipts.find((entry) => entry?.receipt === repairReceipt);
  if (prior) return { status: 200, body: { success: true, already_processed: true, writes: 0, receipt: repairReceipt } };
  const inventory = Array.isArray(character.inventory) ? character.inventory : [];
  const daggers = inventory.map((item, index) => ({ item, index })).filter(({ item }) => item?.name === 'Dagger');
  const dbDagger = daggers.filter(({ item }) => item?.equipment_id === equipmentId);
  const legacy = daggers.filter(({ item }) => !item?.equipment_id);
  const arrows = inventory.filter(isArrow);
  const story = Array.isArray(session.story_log) ? session.story_log : [];
  const aftermath = story[story.length - 4];
  const failedRecovery = story[story.length - 3];
  const structuredMutations = Array.isArray(abilities.__thrown_weapon_actions) ? abilities.__thrown_weapon_actions : [];
  const exactDb = dbDagger.length === 1 && Number(dbDagger[0].item.quantity) === 1 && dbDagger[0].item.source === 'Equipment Database' && props(dbDagger[0].item).includes('finesse') && props(dbDagger[0].item).includes('light') && props(dbDagger[0].item).includes('thrown range 20 60');
  const exactLegacy = legacy.length === 1 && Number(legacy[0].item.quantity) === 1 && !legacy[0].item.item_id && props(legacy[0].item).includes('finesse') && props(legacy[0].item).includes('light') && props(legacy[0].item).includes('thrown');
  const guards = {
    exact_linkage: character.id === scope.character && session.id === scope.session && session.character_id === scope.character && session.in_combat === false,
    exact_daggers: daggers.length === 2 && exactDb && exactLegacy,
    arrows_zero: arrows.length === 1 && Number(arrows[0].quantity) === 0,
    committed_kill_evidence: /combat has ended in victory/i.test(String(aftermath?.player_choice || '')) && /wolves?.*(put down|defeated|0 hp|unconscious)|(?:put down|defeated).*wolves?/i.test(String(aftermath?.text || '')),
    failed_recovery_evidence: failedRecovery?.player_choice === 'retrieve my arrows and dagger from the corpses [Skill Check: Medicine DC12 — FAILURE (rolled 11)]' && /gear embedded in the mangled carcasses/i.test(String(failedRecovery?.text || '')) && /hollow-handed|damaged beyond simple field repair/i.test(String(failedRecovery?.text || '')),
    no_structured_weapon_mutation: structuredMutations.length === 0,
  };
  const failed = Object.entries(guards).filter(([, pass]) => !pass).map(([name]) => name);
  const before = { nonTargetInventory: await hash(inventory.filter((_, index) => index !== dbDagger[0]?.index)), character: await hash(semantic(character, ['inventory', 'long_rest_abilities'])), session: await hash(semantic(session)) };
  if (failed.length) return { status: 409, body: { error: 'Scoped thrown-Dagger repair guard failed.', writes: 0, guards, failed_guards: failed, hashes: before } };
  const nextInventory = inventory.filter((_, index) => index !== dbDagger[0].index);
  const receipt = { receipt: repairReceipt, item_id: equipmentId, item_name: 'Dagger', consumed: 1, reason: 'owner-confirmed thrown Dagger kill with failed recovery', at: new Date().toISOString() };
  abilities.__playtest_repairs = [...receipts, receipt];
  await db.entities.Character.update(scope.character, { inventory: nextInventory, long_rest_abilities: abilities });
  const [afterCharacter, afterSession] = await Promise.all([db.entities.Character.get(scope.character), db.entities.GameSession.get(scope.session)]);
  const postconditions = {
    target_removed: !(afterCharacter.inventory || []).some((item) => item?.equipment_id === equipmentId),
    legacy_unchanged: await hash((afterCharacter.inventory || []).filter((item) => item?.name === 'Dagger')) === await hash(legacy.map(({ item }) => item)),
    other_inventory_unchanged: await hash((afterCharacter.inventory || []).filter((item) => item?.equipment_id !== equipmentId)) === before.nonTargetInventory,
    character_fields_unchanged: await hash(semantic(afterCharacter, ['inventory', 'long_rest_abilities'])) === before.character,
    session_unchanged: await hash(semantic(afterSession)) === before.session,
    receipt_appended: (afterCharacter.long_rest_abilities?.__playtest_repairs || []).some((entry) => entry?.receipt === repairReceipt),
  };
  const postFailed = Object.entries(postconditions).filter(([, pass]) => !pass).map(([name]) => name);
  if (postFailed.length) return { status: 500, body: { error: 'Repair postcondition failed.', writes: 1, postconditions, failed_postconditions: postFailed } };
  return { status: 200, body: { success: true, already_processed: false, writes: 1, receipt: repairReceipt, guards, postconditions } };
}
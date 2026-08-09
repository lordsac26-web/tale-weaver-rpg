const ids = { character: '6a6825cd07a490fa70a46852', session: '6a6825edd695bd65a4322256', combat: '6a77463582a26b50018110ea' };
export const repairReceipt = 'repair-craig-arrow-six-v2-20260808';
const hash = async (value) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(value))))).map((byte) => byte.toString(16).padStart(2, '0')).join('');
const arrow = (item) => /^arrow(?:s)?(?:\s*\(\s*\d+\s*\))?$/i.test(String(item?.name || '').trim());
const quantity = (item) => Math.max(0, Number(item?.quantity) || 0);
const semantic = (record, omit = []) => Object.fromEntries(Object.entries(record || {}).filter(([key]) => !['updated_date', ...omit].includes(key)));
const nonInventoryCharacter = (character) => semantic(character, ['inventory']);

export async function applyScopedArrowSixRepair({ db, scope = ids }) {
  const [character, session, combat] = await Promise.all([db.entities.Character.get(scope.character), db.entities.GameSession.get(scope.session), db.entities.CombatLog.get(scope.combat)]);
  if (!character || !session || !combat) return { status: 409, body: { error: 'Protected repair records are missing.', writes: 0 } };
  const inventory = Array.isArray(character.inventory) ? character.inventory : [];
  const rows = inventory.map((item, index) => ({ item, index })).filter(({ item }) => arrow(item));
  const total = rows.reduce((sum, row) => sum + quantity(row.item), 0);
  if (rows.length === 1 && rows[0].item?.name === 'Arrows' && quantity(rows[0].item) === 6 && inventory.filter((item) => !arrow(item)).length === 13) return { status: 200, body: { success: true, already_processed: true, writes: 0, receipt: repairReceipt, current_arrow_count: total } };
  const zeroShells = rows.filter(({ item, index }) => [12, 14].includes(index) && item?.name === 'Arrows (20)' && quantity(item) === 0);
  const nonArrow = inventory.filter((item) => !arrow(item));
  const player = (combat.combatants || []).find((entry) => entry?.type === 'player');
  const attacks = (combat.log_entries || []).filter((entry) => entry?.action === 'attack' && entry?.actor === character.name && !entry?.spell_name);
  const exactHit = attacks.filter((entry) => entry?.hit === true && Number(entry?.attack_roll) === 24 && Number(entry?.damage) === 5 && String(entry?.target) === 'Corrupted Wolf');
  const exactMiss = attacks.filter((entry) => entry?.hit === false && Number(entry?.attack_roll) === 12 && String(entry?.target) === 'Corrupted Wolf');
  const recoveries = (combat.log_entries || []).filter((entry) => { const recovery = entry?.recovery || entry?.arrow_recovery || entry?.structured_recovery; return recovery?.success === true && /arrow|ammo/i.test(String(recovery?.type || recovery?.item || recovery?.name || '')); });
  const guards = {
    exact_inventory: rows.length === 2 && zeroShells.length === 2 && rows.every(({ item }) => quantity(item) === 0) && nonArrow.length === 13,
    protected_links: session.character_id === scope.character && combat.session_id === scope.session && combat.character_id === scope.character && player?.id === scope.character,
    protected_combat: combat.is_active === true && Number(combat.current_turn_index) === 0 && Number(player?.hp_current) === 44 && Number(character.hp_current) === 44,
    exact_attacks: attacks.length === 2 && exactHit.length === 1 && exactMiss.length === 1,
    no_successful_recovery: recoveries.length === 0,
  };
  const hashes = { non_arrow_inventory: await hash(nonArrow), character: await hash(nonInventoryCharacter(character)), session: await hash(semantic(session)), combat: await hash(semantic(combat)) };
  const failed = Object.entries(guards).filter(([, pass]) => !pass).map(([name]) => name);
  if (failed.length) return { status: 409, body: { error: 'Scoped repair guard failed.', writes: 0, guards, failed_guards: failed, hashes } };
  const nextInventory = inventory.flatMap((item, index) => index === 12 ? [{ name: 'Arrows', category: 'Ammunition', weight: 1, cost: 1, cost_unit: 'gp', rarity: 'common', quantity: 6, unit: 'arrow', stack_semantics: 'individual' }] : index === 14 ? [] : [item]);
  await db.entities.Character.update(scope.character, { inventory: nextInventory });
  const [afterCharacter, afterSession, afterCombat] = await Promise.all([db.entities.Character.get(scope.character), db.entities.GameSession.get(scope.session), db.entities.CombatLog.get(scope.combat)]);
  const afterArrows = (afterCharacter.inventory || []).filter(arrow);
  const postconditions = { one_arrow_stack: afterArrows.length === 1 && afterArrows[0].name === 'Arrows' && quantity(afterArrows[0]) === 6, no_zero_shell: afterArrows.every((item) => quantity(item) > 0), non_arrow_unchanged: await hash((afterCharacter.inventory || []).filter((item) => !arrow(item))) === hashes.non_arrow_inventory, character_unchanged: await hash(nonInventoryCharacter(afterCharacter)) === hashes.character, session_unchanged: await hash(semantic(afterSession)) === hashes.session, combat_unchanged: await hash(semantic(afterCombat)) === hashes.combat };
  const postFailed = Object.entries(postconditions).filter(([, pass]) => !pass).map(([name]) => name);
  if (postFailed.length) return { status: 500, body: { error: 'Repair postcondition failed.', writes: 1, guards, hashes, postconditions, failed_postconditions: postFailed } };
  return { status: 200, body: { success: true, already_processed: false, writes: 1, receipt: repairReceipt, guards, hashes, before_arrow_rows: rows, after_arrow_rows: afterArrows, postconditions } };
}
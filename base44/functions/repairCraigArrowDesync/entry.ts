import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

const ids = { character: '6a6825cd07a490fa70a46852', session: '6a6825edd695bd65a4322256', combat: '6a77463582a26b50018110ea' };
const repairId = 'repair-craig-arrow-desync-20260808-01';
const hash = async (value) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(value))))).map((byte) => byte.toString(16).padStart(2, '0')).join('');
const ammoName = (item) => /^arrow(?:s)?(?:\s*\(\s*\d+\s*\))?$/i.test(String(item?.name || '').trim());
const quantity = (item) => Math.max(0, Number(item?.quantity) || 0);
const semantic = (record, omit = []) => Object.fromEntries(Object.entries(record || {}).filter(([key]) => !['updated_date', ...omit].includes(key)));
const characterSemantic = (character) => ({ ...semantic(character, ['inventory']), long_rest_abilities: { ...(character?.long_rest_abilities || {}), __arrow_desync_repairs: undefined } });
const findEvidence = (record, path = '$', found = []) => {
  if (Array.isArray(record)) record.forEach((value, index) => findEvidence(value, `${path}[${index}]`, found));
  else if (record && typeof record === 'object') Object.entries(record).forEach(([key, value]) => findEvidence(value, `${path}.${key}`, found));
  else if (typeof record === 'string' && /(arrow|bow|ammunition)/i.test(record)) found.push({ path, text: record.slice(0, 500) });
  return found;
};

export default async function repairCraigArrowDesync(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Admin access required' }, { status: 403 });
    const body = await req.json();
    if (body?.repair_id !== repairId || body?.character_id !== ids.character || body?.session_id !== ids.session || body?.combat_id !== ids.combat) return Response.json({ error: 'Exact protected identifiers are required.' }, { status: 400 });
    const db = base44.asServiceRole;
    const [character, session, combat] = await Promise.all([db.entities.Character.get(ids.character), db.entities.GameSession.get(ids.session), db.entities.CombatLog.get(ids.combat)]);
    if (!character || !session || !combat) return Response.json({ error: 'Protected records are missing.' }, { status: 409 });
    const receipt = character.long_rest_abilities?.__arrow_desync_repairs?.[repairId];
    if (receipt) return Response.json({ success: true, already_processed: true, writes: 0, repair_id: repairId, current_arrow_count: (character.inventory || []).filter(ammoName).reduce((total, item) => total + quantity(item), 0), receipt });
    const inventory = Array.isArray(character.inventory) ? character.inventory : [];
    const arrowRows = inventory.map((item, index) => ({ item, index })).filter(({ item }) => ammoName(item));
    const zeroShells = arrowRows.filter(({ item }) => /^Arrows \(20\)$/.test(String(item.name)) && String(item.category) === 'Ammunition' && quantity(item) === 0);
    const positiveAliases = arrowRows.filter(({ item }) => quantity(item) > 0);
    const player = (combat.combatants || []).find((entry) => entry?.type === 'player');
    const wolves = (combat.combatants || []).filter((entry) => entry?.type === 'enemy');
    const leadWolf = wolves.find((entry) => entry.name === 'Corrupted Wolf' && Number(entry.hp_current) === 10);
    const otherWolves = wolves.filter((entry) => entry !== leadWolf);
    const playerAttackLogs = (combat.log_entries || []).filter((entry) => entry?.action === 'attack' && entry?.actor === character.name && !entry?.spell_name);
    const exactHit = playerAttackLogs.filter((entry) => entry?.hit === true && Number(entry?.attack_roll) === 24 && Number(entry?.damage) === 5 && String(entry?.target || '') === 'Corrupted Wolf');
    const exactMiss = playerAttackLogs.filter((entry) => entry?.hit === false && Number(entry?.attack_roll) === 12 && String(entry?.target || '') === 'Corrupted Wolf');
    const hasLongbow = Object.values(character.equipped || {}).some((item) => /longbow/i.test(String(item?.name || '')));
    const recoveryEvents = JSON.stringify({ story_log: session.story_log, combat_log_entries: combat.log_entries }).match(/(?:arrow|ammo).{0,140}(?:recover|recovery|acquire|add)|(?:recover|recovery|acquire|add).{0,140}(?:arrow|ammo)/gi) || [];
    const ownerOverride = body?.owner_approved_verified_qa_baseline_override === true && Number(body?.verified_qa_baseline) === 8 && Number(body?.expected_qualifying_attacks) === 2 && Number(body?.expected_current_arrows) === 6;
    const guards = {
      exact_zero_shell_shape: arrowRows.length === 2 && zeroShells.length === 2 && positiveAliases.length === 0,
      exact_baseline_evidence: ownerOverride,
      exact_later_arrow_shot_evidence: hasLongbow && playerAttackLogs.length === 2 && exactHit.length === 1 && exactMiss.length === 1,
      no_later_recovery_or_arrow_event: recoveryEvents.length === 0,
      protected_character_mechanics: Number(character.hp_current) === 44 && Number(character.hp_max) === 44,
      protected_combat_mechanics: Number(combat.current_turn_index) === 0 && Number(player?.initiative_total ?? player?.initiative_value ?? player?.initiative) === 18 && Number(player?.hp_current) === 44 && Number(player?.hp_max) === 44 && !!leadWolf && otherWolves.length === 2 && otherWolves.every((wolf) => Number(wolf.hp_current) === 15 && Number(wolf.hp_max) === 15),
      protected_links: session.character_id === ids.character && combat.session_id === ids.session && player?.id === ids.character,
    };
    const failedGuards = Object.entries(guards).filter(([, pass]) => !pass).map(([name]) => name);
    const diagnostics = { guards, failed_guards: failedGuards, override_used: ownerOverride, before_arrow_rows: arrowRows.map(({ item, index }) => ({ index, item })), inferred_transition: '8 -> 2 fired shots -> 6', exact_attack_evidence: { has_longbow: hasLongbow, qualifying_player_bow_attacks: playerAttackLogs, exact_hit: exactHit, exact_miss: exactMiss }, hashes: { character_semantic_excluding_inventory_receipt: await hash(characterSemantic(character)), session: await hash(semantic(session)), combat: await hash(semantic(combat)), non_arrow_inventory: await hash(inventory.filter((item) => !ammoName(item))) } };
    if (failedGuards.length || body?.dry_run === true) return Response.json({ success: false, dry_run: body?.dry_run === true, writes: 0, error: failedGuards.length ? 'Evidence or protected-state guard failed; no write was made.' : 'Dry run passed; no write was made.', ...diagnostics }, { status: failedGuards.length ? 409 : 200 });
    const shell = zeroShells[0].item;
    const firstIndex = zeroShells[0].index;
    const nextInventory = inventory.flatMap((item, index) => index === firstIndex ? [{ ...shell, name: 'Arrows', category: 'Ammunition', weight: 1, cost: 1, cost_unit: 'gp', rarity: 'common', quantity: 6, unit: 'arrow', stack_semantics: 'individual' }] : index === 14 ? [] : [item]);
    const nextAbilities = { ...(character.long_rest_abilities || {}), __arrow_desync_repairs: { ...(character.long_rest_abilities?.__arrow_desync_repairs || {}), [repairId]: { completed_at: new Date().toISOString(), before_arrow_rows: arrowRows.map(({ item }) => item), after_arrow_row: nextInventory.find((item) => item.name === 'Arrows'), inferred_transition: '8 -> 2 fired shots -> 6' } } };
    await db.entities.Character.update(ids.character, { inventory: nextInventory, long_rest_abilities: nextAbilities });
    const [afterCharacter, afterSession, afterCombat] = await Promise.all([db.entities.Character.get(ids.character), db.entities.GameSession.get(ids.session), db.entities.CombatLog.get(ids.combat)]);
    const afterArrows = (afterCharacter.inventory || []).filter(ammoName);
    const afterNonArrowHash = await hash((afterCharacter.inventory || []).filter((item) => !ammoName(item)));
    const postconditions = { one_canonical_stack: afterArrows.length === 1 && afterArrows[0].name === 'Arrows' && quantity(afterArrows[0]) === 6 && afterArrows[0].unit === 'arrow' && afterArrows[0].stack_semantics === 'individual', aggregate_aliases_six: afterArrows.reduce((total, item) => total + quantity(item), 0) === 6, no_zero_arrow_shells: afterArrows.every((item) => quantity(item) > 0), thirteen_non_arrow_rows_unchanged: (afterCharacter.inventory || []).filter((item) => !ammoName(item)).length === 13 && afterNonArrowHash === diagnostics.hashes.non_arrow_inventory, character_semantic_unchanged: diagnostics.hashes.character_semantic_excluding_inventory_receipt === await hash(characterSemantic(afterCharacter)), session_unchanged: diagnostics.hashes.session === await hash(semantic(afterSession)), combat_unchanged: diagnostics.hashes.combat === await hash(semantic(afterCombat)) };
    const failedPostconditions = Object.entries(postconditions).filter(([, pass]) => !pass).map(([name]) => name);
    if (failedPostconditions.length) return Response.json({ error: 'Persisted repair postconditions failed.', writes: 1, failed_postconditions: failedPostconditions, ...diagnostics, postconditions }, { status: 500 });
    return Response.json({ success: true, already_processed: false, writes: 1, repair_id: repairId, ...diagnostics, after_arrow_rows: afterArrows, postconditions });
  } catch (error) { return Response.json({ error: error.message || 'Arrow desync repair failed' }, { status: 500 }); }
}
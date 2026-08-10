import { canonicalAmmoName, authoritativeAmmoUnits, isAmmoPackage } from '../ammunition.ts';

export const ARROW_INVENTORY_CONTRACT = {
  characterId: '6a6825cd07a490fa70a46852',
  sessionId: '6a6825edd695bd65a4322256',
  combatId: '6a7a24fa5fc6300afbbe2507',
};

const hash = async (value) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(value))))).map((byte) => byte.toString(16).padStart(2, '0')).join('');
const semantic = (record) => Object.fromEntries(Object.entries(record || {}).filter(([key]) => key !== 'updated_date'));
const isArrow = (item) => canonicalAmmoName(item?.name) === 'Arrows';
const itemShape = (item) => ({ name: item?.name, category: item?.category, quantity: Number(item?.quantity || 0), unit: item?.unit || null, stack_semantics: item?.stack_semantics || null, pack_size: Number(item?.pack_size || 0) || isAmmoPackage(item?.name) || null, authoritative_units: authoritativeAmmoUnits(item) });

function collectEvidence(root, source) {
  const found = []; const seen = new Set();
  const visit = (value, path, depth) => {
    if (depth > 8 || found.length >= 80 || value == null || typeof value !== 'object' || seen.has(value)) return;
    seen.add(value);
    if (isArrow(value)) found.push({ source, path, shape: itemShape(value) });
    for (const [key, child] of Object.entries(value)) {
      if (['portrait', 'image_url', 'story_seed_file_url'].includes(key)) continue;
      visit(child, path ? `${path}.${key}` : key, depth + 1);
    }
  };
  visit(root, '', 0);
  return found;
}

const isPreShotPath = (path) => /(pre.?attack|before.?attack|inventory.?before|ammo.?before|pre.?shot)/i.test(path);
const OWNER_ATTESTED_POLICY = 'owner_attested_catalog_pack';
const EXPECTED_ATTESTATION = { source: 'character_sheet_add_item', catalog_name: 'Arrows (20)', packs_added: 1, shots_already_committed: 1, expected_remaining_units: 19 };
const exactAttestation = (value) => !!value && Object.keys(EXPECTED_ATTESTATION).every((key) => value[key] === EXPECTED_ATTESTATION[key]) && Object.keys(value).length === Object.keys(EXPECTED_ATTESTATION).length;
const exactLegacyZeroPack = (item) => item?.name === 'Arrows (20)' && item?.category === 'Ammunition' && Number(item?.quantity) === 0 && !item?.unit && !item?.stack_semantics && (Number(item?.pack_size) || isAmmoPackage(item?.name)) === 20;

export async function auditRepairArrowInventoryMismatchCore({ db, scope, mode, requestId, expectedHashes = null, applyPolicy = null, ownerAttestation = null, contract = ARROW_INVENTORY_CONTRACT }) {
  if (!requestId || !['dry_run', 'apply'].includes(mode)) return { status: 400, body: { error: 'mode dry_run/apply and request_id are required', writes: 0 } };
  const [character, session, combat] = await Promise.all([
    db.entities.Character.get(scope.characterId), db.entities.GameSession.get(scope.sessionId), db.entities.CombatLog.get(scope.combatId),
  ]);
  if (!character || !session || !combat) return { status: 409, body: { error: 'Protected records are missing', writes: 0 } };
  const auditReceipts = character.long_rest_abilities?.__arrow_inventory_audit_receipts || [];
  const prior = auditReceipts.find((entry) => entry.request_id === requestId);
  if (mode === 'apply' && prior) return { status: 200, body: { ...prior, already_processed: true, writes: 0 } };

  const protectedHashes = { character: await hash(semantic(character)), session: await hash(semantic(session)), combat: await hash(semantic(combat)) };
  const ownerAttested = applyPolicy === OWNER_ATTESTED_POLICY;
  const hashesMatch = ownerAttested
    ? !!expectedHashes && Object.entries(protectedHashes).every(([key, value]) => expectedHashes[key] === value)
    : mode === 'dry_run' || (!!expectedHashes && Object.entries(protectedHashes).every(([key, value]) => expectedHashes[key] === value));
  const evidence = [
    ...collectEvidence(character.inventory || [], 'Character.inventory'),
    ...collectEvidence(character.long_rest_abilities || {}, 'Character.receipts'),
    ...collectEvidence(session.world_state || {}, 'GameSession.world_state'),
    ...collectEvidence(session.story_log || [], 'GameSession.story_log'),
    ...collectEvidence(session.combat_state || {}, 'GameSession.combat_state'),
    ...collectEvidence(combat.world_state || {}, 'CombatLog.world_state'),
    ...collectEvidence(combat.log_entries || [], 'CombatLog.log_entries'),
    ...collectEvidence(combat.loot_collected || {}, 'CombatLog.loot_collected'),
  ];
  const preShot = evidence.filter((entry) => isPreShotPath(entry.path) && entry.shape.quantity === 1);
  const packProof = preShot.filter((entry) => !entry.shape.unit && !entry.shape.stack_semantics && entry.shape.pack_size === 20);
  const individualProof = preShot.filter((entry) => entry.shape.unit === 'arrow' || entry.shape.stack_semantics === 'individual');
  const provenance = packProof.length === 1 && individualProof.length === 0 ? 'legacy_pack_quantity_1'
    : individualProof.length === 1 && packProof.length === 0 ? 'individual_arrow_quantity_1' : 'ambiguous';

  const arrows = (character.inventory || []).map((item, index) => ({ item, index })).filter(({ item }) => isArrow(item));
  const currentUnits = arrows.reduce((sum, entry) => sum + authoritativeAmmoUnits(entry.item), 0);
  const target = (combat.combatants || []).find((entry) => entry.id === 'enemy_8hz789yme');
  const latest = (combat.log_entries || []).at(-1);
  const actionReceipts = combat.world_state?.__receipts || [];
  const noAmmoReceipt = (combat.world_state?.__ammo_receipts || []).filter((entry) => entry?.ammo_name === 'Arrows');
  const knownCommittedAttackState = (latest?.hit === false && latest?.attack_roll === 11 && target?.hp_current === 16)
    || (latest?.correction_type === 'missed_stealthed_advantage' && latest?.request_id === 'repair-live-missed-stealthed-advantage-20260810' && latest?.hit === true && latest?.damage === 6 && target?.hp_current === 10);
  const latestRejectedWasInert = combat.world_state?.actions_used_this_turn === 1
    && (combat.log_entries || []).length === 2 && latest?.action === 'attack' && knownCommittedAttackState
    && target?.hp_max === 16 && actionReceipts.filter((entry) => entry?.action === 'player_attack').length === 0
    && noAmmoReceipt.length === 0 && currentUnits === 0;
  const attestedCandidates = arrows.filter(({ item }) => exactLegacyZeroPack(item));
  const guards = {
    exact_ids_and_linkage: scope.characterId === contract.characterId && scope.sessionId === contract.sessionId && scope.combatId === contract.combatId && session.character_id === character.id && session.combat_state?.combat_id === combat.id && combat.session_id === session.id,
    current_authoritative_quantity_zero: arrows.length > 0 && currentUnits === 0,
    consumed_shot_not_blindly_refunded: true,
    latest_rejected_no_ammo_attempt_inert: latestRejectedWasInert,
    exact_precondition_hashes: hashesMatch,
    ...(ownerAttested ? {
      exact_owner_attestation: exactAttestation(ownerAttestation),
      exact_single_legacy_zero_pack: arrows.length === 1 && attestedCandidates.length === 1,
    } : {}),
  };
  const failedGuards = Object.entries(guards).filter(([, pass]) => !pass).map(([key]) => key);
  const repairDecision = ownerAttested ? (failedGuards.length === 0 ? 'owner_attested_normalize_0_to_19' : 'reject_owner_attested_policy')
    : provenance === 'legacy_pack_quantity_1' ? 'normalize_remaining_to_19'
    : provenance === 'individual_arrow_quantity_1' ? 'leave_quantity_0' : 'reject_apply_ambiguous';
  const applySafe = failedGuards.length === 0 && (ownerAttested || provenance !== 'ambiguous');
  const report = {
    success: failedGuards.length === 0, mode, dry_run: mode === 'dry_run', request_id: requestId, writes: 0,
    apply_policy: applyPolicy, apply_safe: applySafe, guards, failed_guards: failedGuards,
    protected_hashes: protectedHashes, provenance: ownerAttested ? 'owner_attested_catalog_pack' : provenance, repair_decision: repairDecision,
    migration_proposal: ownerAttested && applySafe ? { stack_index: attestedCandidates[0].index, before_units: 0, after_units: 19, pack_size: 20, committed_shots: 1 } : null,
    current: { arrow_stacks: arrows.map(({ item, index }) => ({ index, ...itemShape(item) })), total_authoritative_units: currentUnits },
    searched_sources: ['Character.inventory', 'Character.long_rest_abilities vendor/ammo/audit receipts', 'GameSession world_state/story_log/combat_state', 'CombatLog world_state/log_entries/loot_collected'],
    evidence, pre_shot_candidates: preShot,
    rejected_attempt: { inert: latestRejectedWasInert, actions_used_this_turn: combat.world_state?.actions_used_this_turn, latest_log_entry: latest ? { action: latest.action, hit: latest.hit, attack_roll: latest.attack_roll, text: latest.text } : null, target_hp: target?.hp_current, ammo_receipts: noAmmoReceipt.length, player_attack_receipts: actionReceipts.filter((entry) => entry?.action === 'player_attack').length },
    refund_proposal: latestRejectedWasInert ? null : 'Guarded refund review required; no mutation included in this deployment.',
  };
  if (mode === 'dry_run') return { status: 200, body: report };
  if (failedGuards.length || (!ownerAttested && provenance === 'ambiguous')) return { status: 409, body: { error: !ownerAttested && provenance === 'ambiguous' ? 'Pre-shot ammunition provenance is ambiguous or unavailable; no write was made.' : 'Protected-state guards failed; no write was made.', ...report } };
  if (!ownerAttested && provenance === 'individual_arrow_quantity_1') return { status: 200, body: { ...report, apply_safe: true, already_correct: true, writes: 0 } };

  const firstArrow = ownerAttested ? attestedCandidates[0] : arrows[0];
  const inventory = [...(character.inventory || [])];
  inventory[firstArrow.index] = { ...firstArrow.item, name: 'Arrows', category: 'Ammunition', quantity: 19, unit: 'arrow', stack_semantics: 'individual', pack_size: 20, ...(ownerAttested ? { source: 'Character Sheet Add Item' } : {}) };
  const receipt = ownerAttested
    ? { request_id: requestId, correction_type: 'owner_attested_ammunition_migration', source: 'character_sheet_add_item', catalog_name: 'Arrows (20)', before_units: 0, after_units: 19, pack_size: 20, committed_shots: 1, protected_hashes: protectedHashes }
    : { request_id: requestId, correction_type: 'legacy_arrow_pack_after_one_shot', before_units: 0, after_units: 19, provenance, protected_hashes: protectedHashes };
  await db.entities.Character.update(character.id, { inventory, long_rest_abilities: { ...(character.long_rest_abilities || {}), __arrow_inventory_audit_receipts: [...auditReceipts.slice(-24), receipt] } });
  return { status: 200, body: { ...report, success: true, writes: 1, receipt } };
}
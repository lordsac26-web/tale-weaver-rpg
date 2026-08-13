import { executeRecoveryTransaction } from '../story/recoveryTransaction.ts';

export const NARRATED_PROJECTILE_RECOVERY_CONTRACT = {
  characterId: '6a6825cd07a490fa70a46852', sessionId: '6a6825edd695bd65a4322256', combatId: '6a7bb0f5bdee868a04599bd6',
  combatCreatedAt: '2026-08-11T23:32:05.823000', sessionUpdatedAt: '2026-08-11T23:37:15.288000', recoveryStoryAt: '2026-08-11T23:37:15.186Z',
  hp: 12, hpMax: 44, xp: 13200, slots: { level_1: 2, level_2: 2 }, daggerQuantity: 2, arrowQuantity: 0,
};
const hash = async (value) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(value))))).map((b) => b.toString(16).padStart(2, '0')).join('');
const name = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const quantity = (inventory, target) => (inventory || []).filter((item) => name(item?.name).replace(/ \d+$/, '') === name(target)).reduce((sum, item) => sum + Math.max(0, Number(item.quantity) || 0), 0);
const semanticCombat = (combat) => ({ ...combat, updated_date: undefined });
const projectileEvidence = (combat) => (combat?.log_entries || []).filter((entry) => entry?.projectile || entry?.weapon?.canonical_item_id || entry?.ammunition).map((entry, index) => ({ index, action: entry.action, request_id: entry.request_id, hit: entry.hit, weapon: entry.weapon || null, projectile: entry.projectile || null, ammunition: entry.ammunition || null }));

export async function auditRepairNarratedProjectileRecovery({ db, scope, requestId, mode = 'dry_run', expectedHashes = null, contract = NARRATED_PROJECTILE_RECOVERY_CONTRACT }) {
  if (!requestId || !['dry_run','apply'].includes(mode)) return { status: 400, body: { error: 'request_id and mode dry_run/apply are required', writes: 0 } };
  const [character, session, combat, combats] = await Promise.all([
    db.entities.Character.get(scope.characterId).catch(() => null), db.entities.GameSession.get(scope.sessionId).catch(() => null), db.entities.CombatLog.get(scope.combatId).catch(() => null), db.entities.CombatLog.filter({ session_id: scope.sessionId }, '-created_date', 20),
  ]);
  if (!character || !session || !combat) return { status: 409, body: { error: 'Exact incident records are missing', failed_guards: ['records_present'], writes: 0 } };
  const prior = (session.world_state?.__narrated_projectile_recovery_repairs || []).find((entry) => entry?.request_id === requestId);
  if (mode === 'apply' && prior) return { status: 200, body: { success: true, already_processed: true, request_id: requestId, writes: 0 } };
  const story = session.story_log || [];
  const targetIndex = story.findIndex((entry) => entry?.timestamp === contract.recoveryStoryAt);
  const target = targetIndex >= 0 ? story[targetIndex] : null;
  const preceding = targetIndex > 0 ? story[targetIndex - 1] : null;
  const evidence = projectileEvidence(combat);
  const daggerEvidence = evidence.filter((entry) => name(entry.projectile?.canonical_item || entry.weapon?.name) === 'dagger' && entry.request_id && entry.weapon?.attack_mode === 'thrown');
  const arrowEvidence = evidence.filter((entry) => name(entry.ammunition?.ammo_name) === 'arrows' && entry.request_id);
  const recoverable = character.long_rest_abilities?.__recoverable_items || [];
  const scopedLedger = recoverable.filter((entry) => entry?.combat_id === combat.id && entry?.session_id === session.id && entry?.owner_character_id === character.id && entry?.recovery_status === 'recoverable');
  const proven = scopedLedger.filter((entry) => ['dagger','arrows'].includes(name(entry.canonical_item)) && Number(entry.quantity_remaining || 0) > 0);
  const relatedCombats = (combats || []).filter((entry) => !entry?.is_active).slice(0, 6).map((entry) => ({ id: entry.id, created_date: entry.created_date, result: entry.result, is_active: entry.is_active, evidence: projectileEvidence(entry), player_attack_logs: (entry.log_entries || []).filter((log) => log?.actor === character.name && ['attack','player_attack'].includes(log?.action)).map((log) => ({ action: log.action, request_id: log.request_id || null, hit: log.hit, weapon: log.weapon || null, ammunition: log.ammunition || null })) }));
  const hashes = { character: await hash(character), session: await hash(session), combat: await hash(semanticCombat(combat)), inventory: await hash(character.inventory || []), story_suffix: await hash(story.slice(Math.max(0, targetIndex - 2))), conditions: await hash(character.conditions || []), loot: await hash(combat.loot_collected || null) };
  const hashesMatch = mode === 'dry_run' || (!!expectedHashes && Object.entries(hashes).every(([key,value]) => expectedHashes[key] === value));
  const exact = scope.characterId === contract.characterId && scope.sessionId === contract.sessionId && scope.combatId === contract.combatId && combat.created_date === contract.combatCreatedAt && session.updated_date === contract.sessionUpdatedAt;
  const playerLink = (combat.combatants || []).filter((entry) => entry?.type === 'player' && entry?.id === character.id);
  const guards = {
    exact_ids_timestamps_linkage: exact && session.character_id === character.id && combat.session_id === session.id && (!combat.character_id || combat.character_id === character.id) && playerLink.length === 1,
    exact_completed_victory: combat.result === 'victory' && combat.is_active === false,
    latest_recovery_story_identified: targetIndex === story.length - 1 && target?.timestamp === contract.recoveryStoryAt && /retrieve.*dagger.*arrow|retrieve.*arrow.*dagger/i.test(String(target?.player_choice || '')),
    no_later_player_action: targetIndex === story.length - 1,
    baseline_resources_exact: Number(character.hp_current) === contract.hp && Number(character.hp_max) === contract.hpMax && Number(character.xp) === contract.xp && Number(character.spell_slots?.level_1) === contract.slots.level_1 && Number(character.spell_slots?.level_2) === contract.slots.level_2 && quantity(character.inventory, 'dagger') === contract.daggerQuantity && quantity(character.inventory, 'arrows') === contract.arrowQuantity,
    dagger_throw_uniquely_proven: daggerEvidence.length === 1,
    arrow_attempts_structurally_proven: arrowEvidence.length > 0,
    recoverable_quantities_ledger_proven: proven.length > 0 && proven.every((entry) => Number(entry.quantity_remaining) <= Number(entry.quantity)),
    exact_apply_hashes: hashesMatch,
  };
  const failed = Object.entries(guards).filter(([,ok]) => !ok).map(([key]) => key);
  const body = { success: failed.length === 0, dry_run: mode === 'dry_run', mode, request_id: requestId, writes: 0, guards, failed_guards: failed, protected_hashes: hashes, proposed_deltas: proven.map((entry) => ({ canonical_item: entry.canonical_item, quantity: entry.quantity_remaining, origin_request_id: entry.origin_request_id, anomaly: entry.inventory_decrement_proven === false })), evidence: { recovery_story_index: targetIndex, recovery_story: target, preceding_story: preceding, combat_entries: evidence, combat_log_entries: (combat.log_entries || []).map((entry,index) => ({ index, action: entry.action || null, request_id: entry.request_id || null, actor: entry.actor || null, target: entry.target || null, hit: entry.hit, weapon: entry.weapon || null, ammunition: entry.ammunition || null })), dagger_evidence: daggerEvidence, arrow_evidence: arrowEvidence, scoped_spent_ledger: scopedLedger, relevant_completed_combats: relatedCombats, current_dagger_quantity: quantity(character.inventory, 'dagger'), current_arrow_quantity: quantity(character.inventory, 'arrows'), minimum_additional_evidence: [...(daggerEvidence.length === 1 ? [] : ['one request-linked player_attack receipt naming canonical Dagger with attack_mode thrown']), ...(arrowEvidence.length ? [] : ['request-linked ammunition receipts naming Arrows and quantity consumed'])] } };
  if (mode === 'dry_run') return { status: 200, body };
  if (failed.length) return { status: 409, body: { error: 'Projectile recovery repair guards failed; zero writes performed.', ...body } };
  const recovery = { type: 'recover_owned_items', combat_id: combat.id, rule: { type: 'automatic_recovery', reason: 'Exact combat-scoped spent-item receipts prove accessible recovery.' }, items: proven.map((entry) => ({ canonical_item: entry.canonical_item, quantity: Number(entry.quantity_remaining), origin_request_id: entry.origin_request_id })) };
  const committed = await executeRecoveryTransaction({ base44: { asServiceRole: db }, sessionId: session.id, characterId: character.id, combatId: combat.id, requestId, outcome: { check: { success: true }, recovery } });
  if (!committed.body?.applied) return { status: committed.status, body: { error: committed.body?.reason || 'Recovery transaction failed', writes: 0 } };
  const annotation = `Automatic recovery: ${(committed.body.recovered_items || []).map((item) => `${item.quantity} ${item.canonical_item}`).join(' and ')} committed to inventory.`;
  const nextStory = story.map((entry, index) => index === targetIndex ? { ...entry, text: annotation, item_recovery: committed.body.receipt, recovery_reconciliation_request_id: requestId } : entry);
  const repair = { request_id: requestId, at: new Date().toISOString(), combat_id: combat.id, story_index: targetIndex, recovered_items: committed.body.recovered_items };
  await db.entities.GameSession.update(session.id, { story_log: nextStory, world_state: { ...(session.world_state || {}), __narrated_projectile_recovery_repairs: [...(session.world_state?.__narrated_projectile_recovery_repairs || []).slice(-19), repair] } });
  return { status: 200, body: { success: true, already_processed: false, request_id: requestId, writes: Number(committed.body.writes || 0) + 1, recovered_items: committed.body.recovered_items, protected_hashes: hashes } };
}

export async function discoverNarratedProjectileRecovery({ db, characterId, sessionId }) {
  const [character, session, combats] = await Promise.all([
    db.entities.Character.get(characterId).catch(() => null),
    db.entities.GameSession.get(sessionId).catch(() => null),
    db.entities.CombatLog.filter({ session_id:sessionId }, '-created_date', 20),
  ]);
  if (!character || !session || session.character_id !== character.id) return { status:403, body:{ error:'Character and session linkage is invalid', writes:0 } };
  const story = Array.isArray(session.story_log) ? session.story_log : [];
  const candidates = story.map((entry,index) => {
    const action=String(entry?.player_choice || ''); const text=String(entry?.text || ''); const found=text.match(/\b(?:found|recover(?:ed)?|retrieve[ds]?|collect(?:ed)?)\b[^.]{0,100}\b(\d+)\s+arrows\b/i);
    const skill=entry?.skill_check || entry?.authoritative_skill_check || null;
    const checkSuccess=skill?.success === true || /\b(?:perception|investigation)\b[^.]{0,80}\b(?:success|passed)\b/i.test(text);
    return found && /\b(?:look|search|find|arrow)/i.test(action) && checkSuccess ? { index, entry, quantity:Number(found[1]), excerpt:text.slice(Math.max(0,found.index-80),Math.min(text.length,found.index+180)), skill } : null;
  }).filter(Boolean);
  const completed=(combats || []).filter((combat)=>!combat?.is_active && ['victory','defeat','fled','resolved'].includes(combat?.result));
  const candidate=candidates.length===1 ? candidates[0] : null;
  const linkedCombatId=candidate?.entry?.item_recovery?.receipt?.combat_id || candidate?.entry?.recovery_resolution?.recovery?.combat_id || null;
  const combat=linkedCombatId ? completed.find((entry)=>entry.id===linkedCombatId) || null : null;
  const later= candidate ? story.slice(candidate.index+1).map((entry,index)=>({ index:candidate.index+1+index, timestamp:entry?.timestamp || null, request_id:entry?.request_id || null, player_choice:entry?.player_choice || null, recovery:entry?.item_recovery || entry?.recovery_resolution || null })).filter((entry)=>entry.recovery || /\b(?:arrow|arrows|recover|retrieve|collect)\b/i.test(String(entry.player_choice || ''))) : [];
  const protectedHashes={ character:await hash(character), session:await hash(session), inventory:await hash(character.inventory || []), completed_combats:await hash(completed.map(semanticCombat)) };
  const current=quantity(character.inventory,'Arrows'); const ambiguity=[]; if (candidates.length!==1) ambiguity.push(`expected_one_candidate_found_${candidates.length}`); if (candidate && (!Number.isInteger(candidate.quantity) || candidate.quantity<=0)) ambiguity.push('invalid_exact_quantity'); if (later.length) ambiguity.push('later_recovery_conflict');
  const discovery={ candidate_story_index:candidate?.index ?? null, candidate_timestamp:candidate?.entry?.timestamp || null, player_action:candidate?.entry?.player_choice || null, narrated_text_excerpt:candidate?.excerpt || null, skill_check_result:candidate?.skill || null, recovered_item:candidate ? { canonical_item:'Arrows', quantity:candidate.quantity } : null, combat_log_id:linkedCombatId, request_id:candidate?.entry?.request_id || candidate?.skill?.request_id || null, receipt_identity:candidate?.entry?.item_recovery?.receipt?.token || candidate?.skill?.resolution_id || candidate?.skill?.request_id || null, current_canonical_stack_quantity:current, expected_post_repair_quantity:candidate ? current+candidate.quantity : null, later_conflict_scan:later, ambiguity_diagnostics:ambiguity, completed_combat_context:completed.map((entry)=>({id:entry.id,result:entry.result,created_date:entry.created_date})), protected_hashes:protectedHashes };
  if (ambiguity.length) return { status:409, body:{ success:false, mode:'discover', writes:0, discovery } };
  return { status:200, body:{ success:true, mode:'discover', writes:0, discovery, protected_hashes } };
}
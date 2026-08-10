import { classifyPrecisionAmbushIntent, isMatchingAmbushTarget, pendingAmbushNarrative, stripGeneratedChoiceAnnotations } from '../story/generatedChoiceIntent.js';
import { resolveAuthoritativeSkillModifier } from '../skills/authoritativeSkillModifier.ts';

export const AMBUSH_INCIDENT_CONTRACT = { characterId: '6a6825cd07a490fa70a46852', sessionId: '6a6825edd695bd65a4322256' };
const hash = async (value) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(value))))).map((byte) => byte.toString(16).padStart(2, '0')).join('');
const semantic = (record) => Object.fromEntries(Object.entries(record || {}).filter(([key]) => key !== 'updated_date'));
const conditionName = (value) => String(value?.name || value || '').toLowerCase();
const combatReceipts = (combat) => Array.isArray(combat?.world_state?.__receipts) ? combat.world_state.__receipts : [];

export const deriveAuthoritativeTargetState = (attackReceipts) => {
  const receipts = (attackReceipts || []).filter((entry) => entry?.action === 'player_attack' && isMatchingAmbushTarget(entry?.outcome?.log_entry?.target));
  if (receipts.length !== 1) return { ok: receipts.length === 0, committed: false, ambiguous: receipts.length > 1, receipt: null, alive: null };
  const receipt = receipts[0];
  const hp = Number(receipt?.outcome?.target_hp);
  if (!Number.isFinite(hp)) return { ok: false, committed: true, ambiguous: false, receipt, alive: null };
  return { ok: true, committed: true, ambiguous: false, receipt, alive: hp > 0, hp };
};

const findSourceTarget = (session, combat) => {
  const candidates = [combat?.world_state?.ambush_source_target, session?.world_state?.ambush_source_target].filter(Boolean).filter((entry) => isMatchingAmbushTarget(entry?.name));
  return candidates.length === 1 ? candidates[0] : null;
};

export async function auditRepairAmbushSplitBrain({ db, scope, requestId, mode = 'dry_run', expectedHashes = null }) {
  if (!requestId || !['dry_run', 'apply'].includes(mode)) return { status: 400, body: { error: 'request_id and mode dry_run/apply are required', writes: 0 } };
  const [character, session, combats] = await Promise.all([db.entities.Character.get(scope.characterId), db.entities.GameSession.get(scope.sessionId), db.entities.CombatLog.filter({ session_id: scope.sessionId }, '-created_date', 100)]);
  if (!character || !session) return { status: 409, body: { error: 'Protected records are missing', writes: 0 } };
  const active = (combats || []).filter((entry) => entry?.is_active && entry?.result === 'ongoing');
  const combat = active.length === 1 ? active[0] : null;
  const actionCandidates = (session.story_log || []).map((entry, index) => ({ entry, index })).filter(({ entry }) => classifyPrecisionAmbushIntent(entry?.player_choice) && /Stealth\s+DC\s*16/i.test(String(entry?.player_choice || '')));
  const newActionCandidates = actionCandidates.filter(({ entry }) => Date.parse(entry?.timestamp || '') >= Date.parse('2026-08-10T19:00:00.000Z'));
  const targetAction = newActionCandidates[0] || null;
  const skillReceipts = Array.isArray(session.world_state?.__skill_check_receipts) ? session.world_state.__skill_check_receipts : [];
  const receiptCandidates = [targetAction?.entry?.skill_check, ...skillReceipts.filter((receipt) => receipt?.request_id && receipt.request_id === targetAction?.entry?.request_id)].filter(Boolean);
  const uniqueReceipts = [...new Map(receiptCandidates.map((receipt) => [receipt.id || JSON.stringify(receipt), receipt])).values()];
  const receipt = uniqueReceipts.length === 1 ? uniqueReceipts[0] : null;
  const raw = receipt?.raw_d20 != null && Number.isFinite(Number(receipt.raw_d20)) ? Number(receipt.raw_d20) : null;
  const breakdown = resolveAuthoritativeSkillModifier({ character, session, skill: 'Stealth' });
  const correctedTotal = Number.isFinite(raw) && breakdown.ok ? raw + breakdown.total : null;
  const allCombatReceipts = combatReceipts(combat);
  const combatCreationReceipts = allCombatReceipts.filter((entry) => entry?.action === 'start_combat');
  const attackState = deriveAuthoritativeTargetState(allCombatReceipts);
  const sourceTarget = findSourceTarget(session, combat);
  const skeletons = (combat?.combatants || []).filter((entry) => /skeleton/i.test(entry?.name || ''));
  const targetCombatants = (combat?.combatants || []).filter((entry) => isMatchingAmbushTarget(entry?.name));
  const stealthed = (character.conditions || []).filter((condition) => conditionName(condition) === 'stealthed');
  const protectedHashes = { character: await hash(semantic(character)), session: await hash(semantic(session)), combats: await hash((combats || []).map(semantic)), target_story_entry: targetAction ? await hash(targetAction.entry) : null };
  const prior = combat?.world_state?.__ambush_repair_receipts?.find((entry) => entry?.request_id === requestId);
  if (mode === 'apply' && prior) return { status: 200, body: { success: true, already_processed: true, request_id: requestId, writes: 0 } };
  const hashesMatch = mode === 'dry_run' || (!!expectedHashes && Object.entries(protectedHashes).every(([key, value]) => expectedHashes[key] === value));
  const guards = { exact_linkage: session.character_id === scope.characterId && (!combat || combat.session_id === scope.sessionId), unique_new_action: newActionCandidates.length === 1 && !!targetAction, unique_active_combat: active.length === 1, unique_skill_receipt: uniqueReceipts.length <= 1, observed_raw_stealth_d20_recoverable: raw === 7, authoritative_modifier_is_17: breakdown.ok && breakdown.total === 17 && breakdown.effect_bonus === 10, single_stealthed_condition: stealthed.length === 1, attack_receipt_unambiguous: attackState.ok && !attackState.ambiguous, exact_target_source_available: attackState.committed || !!sourceTarget, three_skeletons_preserved: skeletons.length === 3, exact_precondition_hashes: hashesMatch };
  const failedGuards = Object.entries(guards).filter(([, pass]) => !pass).map(([name]) => name);
  const discrepancies = [
    { order: 1, code: 'stale_choice_outcome', found: targetAction?.entry?.player_choice || null, expected: stripGeneratedChoiceAnnotations(targetAction?.entry?.player_choice) },
    { order: 2, code: 'stealth_resolution', found: { d20: raw, modifier: receipt?.modifier_total ?? null, total: receipt?.final_total ?? null, success: receipt?.success ?? false }, expected: { d20: 7, modifier: 17, total: 24, dc: 16, success: true } },
    { order: 3, code: 'narrative_before_attack_receipt', found: { lethal_narrative: /dies|dead|falls|collapses|throat|bites true/i.test(String(targetAction?.entry?.text || '')), committed_attack: attackState.committed }, expected: 'No hit, damage, or death narration before a committed player_attack receipt.' },
    { order: 4, code: 'combat_roster', found: { target_count: targetCombatants.length, skeleton_count: skeletons.length }, expected: attackState.committed && !attackState.alive ? { target_count: 0, skeleton_count: 3 } : { target_count: 1, skeleton_count: 3 } },
    { order: 5, code: 'player_turn', found: combat ? combat.combatants?.[combat.current_turn_index]?.id : null, expected: scope.characterId },
    { order: 6, code: 'attack_damage_ammo', found: { attack_receipt: attackState.receipt, attack_logs: (combat?.log_entries || []).filter((entry) => entry?.action === 'attack'), ammo_mutation_proven: false }, expected: 'Only committed player_attack evidence may change target HP, ammo, or Stealthed.' },
  ];
  const repairPlan = attackState.committed ? [
    'Correct the Stealth receipt to raw 7 + authoritative 17 = 24 SUCCESS.',
    `Reconcile the target strictly from committed attack receipt HP ${attackState.hp}.`,
    'Preserve skeleton roster and all unrelated Character/Session/Combat state.',
  ] : [
    'Correct the Stealth receipt to raw 7 + authoritative 17 = 24 SUCCESS.',
    'Replace lethal prose with a minimal successful-approach, attack-pending statement.',
    'Restore the exact sourced living necromancer to the existing combat without rolling an attack.',
    'Keep all three skeletons, one Stealthed condition, and set the existing combat to the player turn.',
  ];
  const report = { success: failedGuards.length === 0, dry_run: mode === 'dry_run', mode, request_id: requestId, writes: 0, guards, failed_guards: failedGuards, action: targetAction ? { story_index: targetAction.index, timestamp: targetAction.entry.timestamp, request_id: targetAction.entry.request_id || null, player_choice: targetAction.entry.player_choice, story_receipt: targetAction.entry.skill_check || null } : null, receipt_candidates: uniqueReceipts, corrected_stealth: { raw_d20: raw, all_rolls: receipt?.all_rolls || (raw === 7 ? [7] : []), modifier: breakdown.total, total: correctedTotal, dc: 16, success: correctedTotal != null ? correctedTotal >= 16 : null, breakdown }, combat: combat ? { id: combat.id, created_date: combat.created_date, current_turn_index: combat.current_turn_index, current_actor: combat.combatants?.[combat.current_turn_index]?.name || null, creation_receipts: combatCreationReceipts, skeletons: skeletons.map((entry) => ({ id: entry.id, name: entry.name, hp_current: entry.hp_current, hp_max: entry.hp_max })), target_combatants: targetCombatants, attack_state: attackState } : null, source_target: sourceTarget, discrepancies, safe_repair_plan: repairPlan, apply_safe: failedGuards.length === 0, protected_hashes: protectedHashes };
  if (mode === 'dry_run') return { status: 200, body: report };
  if (failedGuards.length) return { status: 409, body: { error: 'Ambush split-brain repair invariants failed; no write was made.', ...report } };

  const correctedReceipt = { ...(receipt || {}), id: receipt?.id || targetAction.entry.request_id || requestId, request_id: receipt?.request_id || targetAction.entry.request_id || requestId, skill: 'Stealth', raw_d20: 7, all_rolls: [7], dc: 16, modifier_total: 17, final_total: 24, success: true, modifier_breakdown: breakdown, legacy_reconciliation: 'Recovered observed UI d20=7; corrected with authoritative Pass without Trace modifier before pending attack.' };
  const cleanIntent = stripGeneratedChoiceAnnotations(targetAction.entry.player_choice);
  const nextEntry = { ...targetAction.entry, player_choice: `${cleanIntent} [Skill Check: Stealth DC16 — SUCCESS (d20 7 + base 7 + Pass without Trace 10 = 24)]`, text: pendingAmbushNarrative(sourceTarget?.name || targetCombatants[0]?.name || 'Necromancer', true), skill_check: correctedReceipt, pending_attack: !attackState.committed };
  const nextStory = session.story_log.map((entry, index) => index === targetAction.index ? nextEntry : entry);
  const nextSkillReceipts = [...skillReceipts.filter((entry) => entry?.id !== correctedReceipt.id).slice(-49), { ...correctedReceipt, story_index: targetAction.index }];
  const sessionUpdate = { story_log: nextStory, world_state: { ...(session.world_state || {}), __skill_check_receipts: nextSkillReceipts } };
  let nextCombatants = [...combat.combatants];
  let nextInitiative = [...(combat.initiative_order || [])];
  if (!attackState.committed && targetCombatants.length === 0) {
    nextCombatants.push({ ...sourceTarget, type: 'enemy', hp_current: sourceTarget.hp_current ?? sourceTarget.hp_max, is_conscious: true });
    nextInitiative.push({ id: sourceTarget.id, name: sourceTarget.name, initiative_value: sourceTarget.initiative_total, initiative: sourceTarget.initiative_total });
  }
  if (attackState.committed && attackState.alive && targetCombatants.length === 0) nextCombatants.push({ ...sourceTarget, type: 'enemy', hp_current: attackState.hp, is_conscious: true });
  if (attackState.committed && !attackState.alive) nextCombatants = nextCombatants.filter((entry) => !isMatchingAmbushTarget(entry?.name));
  const playerIndex = nextCombatants.findIndex((entry) => entry.id === scope.characterId && entry.type === 'player');
  const repairReceipt = { request_id: requestId, at: new Date().toISOString(), story_index: targetAction.index, combat_id: combat.id };
  await Promise.all([db.entities.GameSession.update(scope.sessionId, sessionUpdate), db.entities.CombatLog.update(combat.id, { combatants: nextCombatants, initiative_order: nextInitiative, current_turn_index: playerIndex, world_state: { ...(combat.world_state || {}), pending_ambush_attack: !attackState.committed, __ambush_repair_receipts: [...(combat.world_state?.__ambush_repair_receipts || []).slice(-19), repairReceipt] } })]);
  return { status: 200, body: { success: true, already_processed: false, request_id: requestId, writes: 2, corrected_stealth: correctedReceipt, pending_attack: !attackState.committed, protected_hashes: protectedHashes } };
}
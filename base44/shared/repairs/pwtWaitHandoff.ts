import { resolveStorySkillCheck } from '../story/storySkillCheck.ts';
import { isPassWithoutTraceIdentity } from '../spells/conditionIdentity.js';

export const PWT_WAIT_HANDOFF_CONTRACT = {
  characterId: '6a6825cd07a490fa70a46852',
  sessionId: '6a6825edd695bd65a4322256',
  combatId: '6a7b9c44a9bae229fdacf232',
  combatCreatedAt: '2026-08-11T22:03:48.530000',
  storyAt: '2026-08-11T22:03:47.416Z',
  exposedAt: '2026-08-11T22:03:47.728Z',
  previousStoryAt: '2026-08-11T21:06:49.407Z',
  previousRepairId: 'repair-void-stalker-pwt-hide-20260811-210649',
  expectedHp: 27,
  expectedXp: 12450,
};

const hash = async (value) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(value))))).map((byte) => byte.toString(16).padStart(2, '0')).join('');
const semantic = (record) => Object.fromEntries(Object.entries(record || {}).filter(([key]) => key !== 'updated_date'));
const nameOf = (entry) => String(entry?.name || entry || '').toLowerCase();
const receiptKey = (entry) => entry?.id || entry?.request_id || JSON.stringify(entry);
const emptyLoot = (combat) => !combat?.loot_collected || (!Number(combat.loot_collected.gold) && !Number(combat.loot_collected.silver) && !Number(combat.loot_collected.copper) && !(combat.loot_collected.items || []).length);
const itemQuantity = (character, identity) => (character.inventory || []).filter((item) => String(item?.name || '').toLowerCase() === identity).reduce((sum, item) => sum + Number(item.quantity || 0), 0);

export async function auditRepairPwtWaitHandoff({ db, scope, requestId, mode = 'dry_run', expectedHashes = null, contract = PWT_WAIT_HANDOFF_CONTRACT }) {
  if (!requestId || !['dry_run', 'apply'].includes(mode)) return { status: 400, body: { error: 'request_id and mode dry_run/apply are required', writes: 0 } };
  const [character, session, combat, combats] = await Promise.all([
    db.entities.Character.get(scope.characterId), db.entities.GameSession.get(scope.sessionId), db.entities.CombatLog.get(scope.combatId).catch(() => null), db.entities.CombatLog.filter({ session_id: scope.sessionId }, '-created_date', 100),
  ]);
  if (!character || !session) return { status: 409, body: { error: 'Exact incident records are missing', failed_guards: ['records_present'], writes: 0 } };
  if (session.character_id !== scope.characterId) return { status: 403, body: { error: 'Character and Session mismatch', failed_guards: ['exact_linkage'], writes: 0 } };
  const repairs = session.world_state?.__pwt_wait_handoff_repairs || [];
  const prior = repairs.find((entry) => entry?.request_id === requestId);
  if (mode === 'apply' && prior) return { status: 200, body: { success: true, already_processed: true, request_id: requestId, original_d20_reused: prior.raw_d20, writes: 0 } };
  if (!combat) return { status: 409, body: { error: 'Exact incident CombatLog is missing', failed_guards: ['records_present'], writes: 0 } };

  const story = session.story_log || [];
  const targetIndex = story.length - 1;
  const target = targetIndex >= 0 ? { entry: story[targetIndex], index: targetIndex } : null;
  const previous = targetIndex > 0 ? { entry: story[targetIndex - 1], index: targetIndex - 1 } : null;
  const stored = Array.isArray(session.world_state?.__skill_check_receipts) ? session.world_state.__skill_check_receipts : [];
  const related = [target?.entry?.skill_check, ...stored.filter((entry) => (target?.entry?.request_id && entry?.request_id === target.entry.request_id) || entry?.at === contract.storyAt)].filter(Boolean);
  const candidates = [...new Map(related.map((entry) => [receiptKey(entry), entry])).values()];
  const receipt = candidates.length === 1 ? candidates[0] : null;
  const display = String(target?.entry?.player_choice || '').match(/\[Skill Check: Stealth DC14 — FAILURE \(rolled (\d+)\)\]\s*$/);
  const displayedTotal = display ? Number(display[1]) : null;
  const preflight = resolveStorySkillCheck({ character, session, skill: 'Stealth', dc: 14, requestId: 'wait-preflight' });
  const derivedRaw = displayedTotal != null && preflight.ok ? displayedTotal - Number(preflight.breakdown?.base_skill) : null;
  const exactShape = scope.characterId === contract.characterId && scope.sessionId === contract.sessionId && scope.combatId === contract.combatId && combat.created_date === contract.combatCreatedAt && target?.entry?.timestamp === contract.storyAt;
  const fallback = exactShape && candidates.length === 0 && displayedTotal === 13 && preflight.breakdown?.base_skill === 7 && derivedRaw === 6;
  const resolution = receipt ? resolveStorySkillCheck({ character, session, skill: 'Stealth', dc: 14, requestId: receipt.request_id, raw: receipt.raw_d20, allRolls: receipt.all_rolls || [receipt.raw_d20], at: receipt.at || contract.storyAt }) : fallback ? resolveStorySkillCheck({ character, session, skill: 'Stealth', dc: 14, requestId: `legacy-pwt-wait:${scope.combatId}:${contract.storyAt}`, raw: 6, allRolls: [6], at: contract.storyAt }) : { ok: false };
  const pwtConditions = (character.conditions || []).filter(isPassWithoutTraceIdentity);
  const pwtModifiers = (character.active_modifiers || []).filter(isPassWithoutTraceIdentity);
  const concentration = session.world_state?.active_concentration;
  const castKey = pwtConditions.length === 1 && pwtModifiers.length === 1 ? `${pwtConditions[0].applied_at}|${pwtConditions[0].caster_id}|${pwtConditions[0].target_id}` : null;
  const linkedPwt = !!castKey && pwtConditions[0].id && pwtModifiers[0].id && concentration?.request_id && Number(pwtModifiers[0].bonus) === 10 && `${pwtModifiers[0].applied_at}|${pwtModifiers[0].caster_id}|${pwtModifiers[0].target_id}` === castKey && `${concentration.applied_at}|${concentration.caster_id}|${concentration.target_id}` === castKey;
  const active = (combats || []).filter((entry) => entry?.is_active === true && entry?.result === 'ongoing');
  const player = (combat.combatants || []).filter((entry) => entry?.type === 'player' && entry?.id === scope.characterId);
  const enemies = (combat.combatants || []).filter((entry) => entry?.type === 'enemy');
  const current = combat.combatants?.[combat.current_turn_index];
  const exposed = (character.conditions || []).filter((entry) => nameOf(entry) === 'exposed' && entry?.source === 'story' && entry?.duration === 'combat' && entry?.applied_at === contract.exposedAt);
  const stealthed = (character.conditions || []).filter((entry) => nameOf(entry) === 'stealthed');
  const committedLogs = (combat.log_entries || []).filter((entry, index) => index > 0 || entry?.action || entry?.actor || entry?.damage || entry?.attack_roll);
  const receipts = combat.world_state?.__receipts || [];
  const forbidden = receipts.filter((entry) => ['player_attack','offhand_attack','enemy_turn','next_turn','spell','collect_loot','use_consumable','damage'].includes(entry?.action));
  const resourceReceipts = [...(combat.world_state?.__ammo_receipts || []), ...(combat.world_state?.__consumable_receipts || []), ...(combat.world_state?.__spell_receipts || [])];
  const previousRepair = (session.world_state?.__pwt_hide_handoff_repairs || []).find((entry) => entry?.request_id === contract.previousRepairId);
  const previousReceipt = previous?.entry?.skill_check;
  const protectedHashes = {
    character: await hash(semantic(character)), session: await hash(semantic(session)), combat: await hash(semantic(combat)), previous_story: await hash(previous?.entry || null), story_other: await hash(story.map((entry, index) => index === targetIndex ? null : entry)),
  };
  const hashesMatch = mode === 'dry_run' || (!!expectedHashes && Object.entries(protectedHashes).every(([key, value]) => expectedHashes[key] === value));
  const guards = {
    exact_ids_and_timestamps: exactShape && exposed.length === 1,
    exact_linkage: session.combat_state?.combat_id === scope.combatId && combat.session_id === scope.sessionId && player.length === 1,
    exactly_one_active_combat: active.length === 1 && active[0].id === scope.combatId,
    exact_two_void_stalker_roster: enemies.length === 2 && enemies.every((entry) => /void-stalker/i.test(String(entry.name || ''))),
    immediately_preceding_story_entry: target?.index === story.length - 1 && previous?.entry?.timestamp === contract.previousStoryAt,
    unique_raw6_dc14_evidence: (receipt && Number(receipt.raw_d20) === 6 && Number(receipt.dc) === 14) || fallback,
    authoritative_base7_pwt10_total23_success: resolution.ok && resolution.breakdown?.base_skill === 7 && resolution.breakdown?.effect_bonus === 10 && resolution.modifier === 17 && resolution.final === 23 && resolution.success === true,
    unique_linked_paused_pwt: linkedPwt && resolution.breakdown?.pwt_active === true && resolution.breakdown?.components?.filter((part) => part.source === 'Pass without Trace').length === 1,
    pristine_unadvanced_combat: combat.round === 1 && combat.current_turn_index === 0 && current?.type === 'enemy' && Number(combat.world_state?.actions_used_this_turn || 0) === 0 && combat.world_state?.bonus_action_used !== true && committedLogs.length === 0 && forbidden.length === 0 && resourceReceipts.length === 0,
    no_later_story_choice: target?.index === story.length - 1,
    exact_exposed_consequence: exposed.length === 1,
    baseline_resources_exact: Number(character.hp_current) === contract.expectedHp && Number(character.hp_max) === 44 && Number(character.xp) === contract.expectedXp && Number(character.spell_slots?.level_1) === 1 && Number(character.spell_slots?.level_2) === 1 && itemQuantity(character, 'arrows') === 13 && itemQuantity(character, 'dagger') === 2 && Number(combat.xp_earned || 0) === 0 && combat.xp_awarded !== true && emptyLoot(combat),
    previous_repair_unchanged: !!previousRepair && previousReceipt?.repair_request_id === contract.previousRepairId && previousReceipt?.success === true && Number(previousReceipt?.final_total) === 25,
    stealthed_state_unambiguous: stealthed.length <= 1,
    exact_apply_hashes: hashesMatch,
  };
  const failedGuards = Object.entries(guards).filter(([, pass]) => !pass).map(([key]) => key);
  const report = { success: failedGuards.length === 0, dry_run: mode === 'dry_run', mode, request_id: requestId, writes: 0, guards, failed_guards: failedGuards, protected_hashes: protectedHashes, evidence: { story_index: targetIndex, story_timestamp: target?.entry?.timestamp || null, previous_story_index: previous?.index ?? null, receipt_candidates: candidates, displayed_total: displayedTotal, derived_raw_d20: derivedRaw, arithmetic: displayedTotal == null ? null : `${displayedTotal}-${preflight.breakdown?.base_skill}=${derivedRaw}`, authoritative_resolution: resolution, active_combat_ids: active.map((entry) => entry.id), committed_logs: committedLogs, forbidden_receipts: forbidden, resource_receipts: resourceReceipts, exposed, stealthed_count: stealthed.length, canonical_cast_key: castKey } };
  if (mode === 'dry_run') return { status: 200, body: report };
  if (failedGuards.length) return { status: 409, body: { error: 'PWT wait handoff repair guards failed; zero writes performed.', ...report } };

  const correctedReceipt = { ...resolution.receipt, repair_request_id: requestId, legacy_display_derived_raw_d20: !receipt, original_result: receipt?.success ?? false, original_modifier_total: receipt?.modifier_total ?? 7, original_final_total: receipt?.final_total ?? 13, evidence_chain: { stored_display_total: 13, authoritative_base_skill: 7, derivation: '13 - 7 = 6', story_timestamp: contract.storyAt, combat_log_id: scope.combatId, canonical_pwt_cast_key: castKey } };
  const nextEntry = { ...target.entry, player_choice: String(target.entry.player_choice || '').replace(/\s*\[Skill Check:[^\]]+\]\s*$/i, '') + ' [Skill Check: Stealth DC14 — SUCCESS (d20 6 + base 7 + Pass without Trace 10 = 23)]', text: 'You remain motionless in your concealed vantage and wait. Pass without Trace keeps every breath and shift silent while the Void-Stalkers continue toward the documents, unaware of you; no further action is taken.', choices: [], skill_check: correctedReceipt, combat_handoff: null };
  const withoutExposed = (character.conditions || []).filter((entry) => !(nameOf(entry) === 'exposed' && entry?.source === 'story' && entry?.duration === 'combat' && entry?.applied_at === contract.exposedAt));
  const nextConditions = stealthed.length === 0 ? [...withoutExposed, { name: 'Stealthed', source: 'Pass without Trace', duration: 'scene', applied_at: contract.storyAt, caster_id: pwtConditions[0].caster_id, target_id: scope.characterId, pwt_condition_id: pwtConditions[0].id, pwt_modifier_id: pwtModifiers[0].id, repair_request_id: requestId }] : withoutExposed;
  const replaced = new Set(candidates.map(receiptKey));
  const repairReceipt = { request_id: requestId, at: new Date().toISOString(), combat_id: scope.combatId, story_index: targetIndex, raw_d20: 6, hp_restored: 0 };
  const nextWorld = { ...(session.world_state || {}), __skill_check_receipts: [...stored.filter((entry) => !replaced.has(receiptKey(entry))).slice(-49), correctedReceipt], __pwt_wait_handoff_repairs: [...repairs.slice(-19), repairReceipt] };
  await db.entities.Character.update(scope.characterId, { conditions: nextConditions });
  await db.entities.GameSession.update(scope.sessionId, { in_combat: false, combat_state: {}, story_log: story.map((entry, index) => index === targetIndex ? nextEntry : entry), world_state: nextWorld });
  await db.entities.CombatLog.delete(scope.combatId);
  return { status: 200, body: { success: true, already_processed: false, request_id: requestId, writes: 3, original_d20_reused: 6, hp_restored: 0, hp_preserved: true, combat_removed: true, corrected_receipt: correctedReceipt, protected_hashes: protectedHashes } };
}
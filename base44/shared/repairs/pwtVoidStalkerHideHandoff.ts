import { resolveStorySkillCheck } from '../story/storySkillCheck.ts';
import { isPassWithoutTraceIdentity } from '../spells/conditionIdentity.js';

export const PWT_VOID_STALKER_CONTRACT = {
  characterId: '6a6825cd07a490fa70a46852',
  sessionId: '6a6825edd695bd65a4322256',
  combatId: '6a7b8eea6d9cd7ede8b2d63b',
  combatCreatedAt: '2026-08-11T21:06:50.644000',
  storyAt: '2026-08-11T21:06:49.407Z',
  storyIndex: 59,
  engagedAt: '2026-08-11T21:06:49.746Z',
  expectedXp: 12450,
  ownerReportedRaw: 8,
  legacyDisplayFallback: true,
};

const hash = async (value) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(value))))).map((byte) => byte.toString(16).padStart(2, '0')).join('');
const conditionName = (value) => String(value?.name || value || '').toLowerCase();
const semantic = (record, omitted = []) => Object.fromEntries(Object.entries(record || {}).filter(([key]) => !['updated_date', ...omitted].includes(key)));
const receiptKey = (receipt) => receipt?.id || receipt?.request_id || JSON.stringify(receipt);
const emptyLoot = (combat) => !combat?.loot_collected || (!Number(combat.loot_collected.gold) && !Number(combat.loot_collected.silver) && !Number(combat.loot_collected.copper) && !(combat.loot_collected.items || []).length);

export async function auditRepairPwtVoidStalkerHideHandoff({ db, scope, requestId, mode = 'dry_run', expectedHashes = null, contract = PWT_VOID_STALKER_CONTRACT }) {
  if (!requestId || !['dry_run', 'apply'].includes(mode)) return { status: 400, body: { error: 'request_id and mode dry_run/apply are required', writes: 0 } };
  const [character, session, combat, combats] = await Promise.all([
    db.entities.Character.get(scope.characterId), db.entities.GameSession.get(scope.sessionId), db.entities.CombatLog.get(scope.combatId).catch(() => null),
    db.entities.CombatLog.filter({ session_id: scope.sessionId }, '-created_date', 100),
  ]);
  if (!character || !session) return { status: 409, body: { error: 'Exact incident records are missing', failed_guards: ['records_present'], writes: 0 } };
  if (session.character_id !== scope.characterId) return { status: 403, body: { error: 'Character and Session mismatch', failed_guards: ['exact_linkage'], writes: 0 } };

  const repairs = session.world_state?.__pwt_hide_handoff_repairs || [];
  const prior = repairs.find((entry) => entry?.request_id === requestId);
  if (mode === 'apply' && prior) return { status: 200, body: { success: true, already_processed: true, request_id: requestId, original_d20_reused: prior.raw_d20, writes: 0 } };
  if (!combat) return { status: 409, body: { error: 'Exact incident CombatLog is missing', failed_guards: ['records_present'], writes: 0 } };

  const active = (combats || []).filter((entry) => entry?.is_active === true && entry?.result === 'ongoing');
  const storyMatches = (session.story_log || []).map((entry, index) => ({ entry, index })).filter(({ entry, index }) => entry?.timestamp === contract.storyAt && index === contract.storyIndex);
  const target = storyMatches.length === 1 ? storyMatches[0] : null;
  const stored = Array.isArray(session.world_state?.__skill_check_receipts) ? session.world_state.__skill_check_receipts : [];
  const relatedStored = stored.filter((entry) => (target?.entry?.request_id && entry?.request_id === target.entry.request_id) || entry?.at === contract.storyAt);
  const receiptCandidates = [target?.entry?.skill_check, ...relatedStored].filter(Boolean);
  const uniqueReceipts = [...new Map(receiptCandidates.map((entry) => [receiptKey(entry), entry])).values()];
  const receipt = uniqueReceipts.length === 1 ? uniqueReceipts[0] : null;
  const displayMatch = String(target?.entry?.player_choice || '').match(/\[Skill Check: Stealth DC18 — FAILURE \(rolled (\d+)\)\]\s*$/);
  const displayedTotal = displayMatch ? Number(displayMatch[1]) : null;
  const preflight = resolveStorySkillCheck({ character, session, skill: 'Stealth', dc: 18, requestId: 'legacy-preflight' });
  const derivedRaw = Number.isInteger(displayedTotal) && preflight.ok ? displayedTotal - Number(preflight.breakdown?.base_skill) : null;
  const fallbackRequestId = `legacy-pwt-hide:${scope.combatId}:${contract.storyAt}`;
  const exactIncidentShape = scope.characterId === contract.characterId && scope.sessionId === contract.sessionId && scope.combatId === contract.combatId && combat.created_date === contract.combatCreatedAt && target?.index === contract.storyIndex;
  const legacyEvidenceEligible = contract.legacyDisplayFallback === true && exactIncidentShape && uniqueReceipts.length === 0 && displayedTotal === 15 && preflight.ok && preflight.breakdown?.base_skill === 7 && derivedRaw === 8 && derivedRaw >= 1 && derivedRaw <= 20;
  const resolution = receipt ? resolveStorySkillCheck({ character, session, skill: 'Stealth', dc: 18, requestId: receipt.request_id, raw: receipt.raw_d20, allRolls: receipt.all_rolls || [receipt.raw_d20], advantageSources: receipt.advantage_sources || [], at: receipt.at || target?.entry?.timestamp }) : legacyEvidenceEligible ? resolveStorySkillCheck({ character, session, skill: 'Stealth', dc: 18, requestId: fallbackRequestId, raw: derivedRaw, allRolls: [derivedRaw], at: contract.storyAt }) : { ok: false };
  const legacyFallbackUsed = !receipt && legacyEvidenceEligible && resolution.ok;
  const pwtParts = resolution?.breakdown?.components?.filter((component) => component.source === 'Pass without Trace') || [];
  const pwtConditions = (character.conditions || []).filter(isPassWithoutTraceIdentity);
  const pwtModifiers = (character.active_modifiers || []).filter(isPassWithoutTraceIdentity);
  const concentration = session.world_state?.active_concentration;
  const canonicalCastTuple = pwtConditions.length === 1 && pwtModifiers.length === 1 ? `${pwtConditions[0].applied_at}|${pwtConditions[0].caster_id}|${pwtConditions[0].target_id}` : null;
  const canonicalPwtLink = !!canonicalCastTuple && pwtConditions[0].id && pwtModifiers[0].id && concentration?.request_id && Number(pwtModifiers[0].bonus) === 10 && `${pwtModifiers[0].applied_at}|${pwtModifiers[0].caster_id}|${pwtModifiers[0].target_id}` === canonicalCastTuple && `${concentration.applied_at}|${concentration.caster_id}|${concentration.target_id}` === canonicalCastTuple;
  const engaged = (character.conditions || []).filter((entry) => conditionName(entry) === 'engaged' && entry?.source === 'story' && entry?.applied_at === contract.engagedAt);
  const stealthed = (character.conditions || []).filter((entry) => conditionName(entry) === 'stealthed');
  const handoffs = (session.world_state?.__story_handoff_receipts || []).filter((entry) => entry?.combat_id === scope.combatId && entry?.action_request_id === target?.entry?.request_id);
  const handoff = handoffs.length === 1 ? handoffs[0] : null;
  const player = (combat.combatants || []).filter((entry) => entry?.type === 'player' && entry?.id === scope.characterId);
  const combatReceipts = combat.world_state?.__receipts || [];
  const committedLogs = (combat.log_entries || []).filter((entry, index) => index > 0 || entry?.action || entry?.actor || entry?.damage || entry?.attack_roll);
  const forbiddenReceipts = combatReceipts.filter((entry) => ['player_attack','offhand_attack','enemy_turn','next_turn','spell','collect_loot','use_consumable'].includes(entry?.action));
  const resourceReceipts = [...(combat.world_state?.__ammo_receipts || []), ...(combat.world_state?.__consumable_receipts || []), ...(combat.world_state?.__spell_receipts || [])];
  const snapshot = handoff?.pre_event_snapshot;
  const inventoryHash = await hash(character.inventory || []);
  const slotsHash = await hash(character.spell_slots || {});
  const abilitiesHash = await hash(character.long_rest_abilities || {});
  const currencyHash = await hash({ gold: character.gold || 0, silver: character.silver || 0, copper: character.copper || 0 });
  const conditionsWithoutHandoff = (character.conditions || []).filter((entry) => !(conditionName(entry) === 'engaged' && entry?.source === 'story' && entry?.applied_at === contract.engagedAt));
  const conditionHash = await hash(conditionsWithoutHandoff);
  const hpProven = !!snapshot && Number(snapshot.hp_current) === 30 && Number(character.hp_current) === 27 && Number(handoff?.failed_branch?.hp_delta) === -3 && player.length === 1 && Number(player[0].hp_current) === 27;
  const unrelatedPristine = !!snapshot && snapshot.inventory_hash === inventoryHash && snapshot.spell_slots_hash === slotsHash && snapshot.abilities_hash === abilitiesHash && snapshot.currency_hash === currencyHash && snapshot.conditions_hash === conditionHash && Number(snapshot.xp) === Number(character.xp || 0);
  const laterStory = !!target && target.index !== (session.story_log || []).length - 1;
  const protectedHashes = {
    character: await hash(semantic(character)), session: await hash(semantic(session)), combat: await hash(semantic(combat)),
    story_other: await hash((session.story_log || []).map((entry, index) => index === target?.index ? null : entry)),
  };
  const hashesMatch = mode === 'dry_run' || (!!expectedHashes && Object.entries(protectedHashes).every(([key, value]) => expectedHashes[key] === value));
  const guards = {
    exact_ids: scope.characterId === contract.characterId && scope.sessionId === contract.sessionId && scope.combatId === contract.combatId,
    exact_story_and_combat_timestamps: storyMatches.length === 1 && combat.created_date === contract.combatCreatedAt,
    exact_linkage: combat.session_id === scope.sessionId && session.combat_state?.combat_id === scope.combatId && player.length === 1,
    exactly_one_active_combat: active.length === 1 && active[0].id === scope.combatId,
    unique_raw8_dc18_receipt: (uniqueReceipts.length === 1 && Number(receipt?.raw_d20) === 8 && Number(receipt?.dc) === 18 && receipt?.request_id === target?.entry?.request_id) || legacyFallbackUsed,
    authoritative_base7_pwt10_total25_success: resolution.ok === true && resolution.breakdown?.base_skill === 7 && resolution.breakdown?.effect_bonus === 10 && resolution.modifier === 17 && resolution.final === 25 && resolution.success === true,
    unique_valid_paused_pwt_link: resolution.breakdown?.pwt_active === true && resolution.breakdown?.concentration_linked === true && pwtParts.length === 1 && canonicalPwtLink,
    pristine_unadvanced_combat: combat.round === 1 && combat.current_turn_index === 0 && Number(combat.world_state?.actions_used_this_turn || 0) === 0 && combat.world_state?.bonus_action_used !== true && committedLogs.length === 0 && forbiddenReceipts.length === 0 && resourceReceipts.length === 0,
    no_later_story_choice: !laterStory,
    baseline_hashes_captured: hashesMatch,
    no_rewards_or_unrelated_mutation: Number(character.xp || 0) === Number(contract.expectedXp) && Number(combat.xp_earned || 0) === 0 && combat.xp_awarded !== true && emptyLoot(combat),
    exact_engaged_consequence: engaged.length === 1,
    stealthed_state_unambiguous: stealthed.length <= 1,
    exact_apply_hashes: hashesMatch,
  };
  const failedGuards = Object.entries(guards).filter(([, pass]) => !pass).map(([name]) => name);
  const report = {
    success: failedGuards.length === 0, dry_run: mode === 'dry_run', mode, request_id: requestId, writes: 0, guards, failed_guards: failedGuards,
    evidence: { target_story: target || null, receipt_candidates: uniqueReceipts, authoritative_resolution: resolution, legacy_fallback: { used: legacyFallbackUsed, exact_display_total: displayedTotal, authoritative_base: preflight.breakdown?.base_skill ?? null, arithmetic: displayedTotal == null ? null : `${displayedTotal}-${preflight.breakdown?.base_skill}=${derivedRaw}`, derived_raw_d20: derivedRaw, owner_reported_raw_d20: contract.ownerReportedRaw ?? null, independently_derived: derivedRaw === 8, canonical_cast_key: canonicalCastTuple, condition_id: pwtConditions[0]?.id || null, modifier_id: pwtModifiers[0]?.id || null, concentration_request_id: concentration?.request_id || null }, pwt_parts: pwtParts, active_combat_ids: active.map((entry) => entry.id), committed_logs: committedLogs, forbidden_receipts: forbiddenReceipts, resource_receipts: resourceReceipts, handoff_receipts: handoffs, hp_restore_proven: hpProven, unrelated_state_pristine: unrelatedPristine, engaged, stealthed_count: stealthed.length },
    protected_hashes: protectedHashes,
  };
  if (mode === 'dry_run') return { status: 200, body: report };
  if (failedGuards.length) return { status: 409, body: { error: 'Void-Stalker handoff repair guards failed; zero writes performed.', ...report } };

  const evidenceChain = legacyFallbackUsed ? { legacy_display_derived_raw_d20: true, stored_display_total: 15, authoritative_base_skill: 7, derivation: '15 - 7 = 8', owner_reported_raw_d20: contract.ownerReportedRaw ?? null, story_timestamp: contract.storyAt, story_index: contract.storyIndex, combat_log_id: scope.combatId, canonical_pwt_cast_key: canonicalCastTuple } : null;
  const correctedReceipt = { ...resolution.receipt, repair_request_id: requestId, original_result: receipt?.success ?? false, original_modifier_total: receipt?.modifier_total ?? 7, original_final_total: receipt?.final_total ?? 15, legacy_display_derived_raw_d20: legacyFallbackUsed, ...(evidenceChain ? { evidence_chain: evidenceChain } : {}) };
  const nextStoryEntry = { ...target.entry, player_choice: String(target.entry.player_choice || '').replace(/\s*\[Skill Check:[^\]]+\]\s*$/i, '') + ' [Skill Check: Stealth DC18 — SUCCESS (d20 8 + base 7 + Pass without Trace 10 = 25)]', text: 'You place the documents where the Void-Stalker can find them, then withdraw into a secluded vantage without betraying your position. Pass without Trace holds your movement in silence; you remain hidden, watching the bait, and no further action is taken.', choices: [], skill_check: correctedReceipt, combat_handoff: null };
  const nextConditions = stealthed.length === 0 ? [...conditionsWithoutHandoff, { name: 'Stealthed', source: 'Pass without Trace', caster_id: pwtConditions[0].caster_id, target_id: scope.characterId, pwt_condition_id: pwtConditions[0].id, pwt_modifier_id: pwtModifiers[0].id, duration: 'scene', applied_at: target.entry.timestamp, repair_request_id: requestId }] : conditionsWithoutHandoff;
  const hpRestored = hpProven ? Number(snapshot.hp_current) - Number(character.hp_current) : 0;
  const repairReceipt = { request_id: requestId, at: new Date().toISOString(), combat_id: scope.combatId, story_index: target.index, raw_d20: 8, hp_restored: hpRestored, legacy_display_derived_raw_d20: legacyFallbackUsed };
  const replacedReceiptKeys = new Set(uniqueReceipts.map(receiptKey));
  const nextWorld = { ...(session.world_state || {}), __skill_check_receipts: [...stored.filter((entry) => !replacedReceiptKeys.has(receiptKey(entry))).slice(-49), correctedReceipt], __pwt_hide_handoff_repairs: [...repairs.slice(-19), repairReceipt] };
  await db.entities.Character.update(scope.characterId, { conditions: nextConditions, ...(hpProven ? { hp_current: snapshot.hp_current } : {}) });
  await db.entities.GameSession.update(scope.sessionId, { in_combat: false, combat_state: {}, story_log: session.story_log.map((entry, index) => index === target.index ? nextStoryEntry : entry), world_state: nextWorld });
  await db.entities.CombatLog.delete(scope.combatId);
  return { status: 200, body: { success: true, already_processed: false, request_id: requestId, writes: 3, original_d20_reused: 8, corrected_receipt: correctedReceipt, hp_restored: hpRestored, hp_preserved: !hpProven, combat_removed: true, protected_hashes: protectedHashes } };
}
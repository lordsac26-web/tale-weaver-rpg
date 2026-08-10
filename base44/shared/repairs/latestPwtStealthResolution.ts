import { buildSkillCheckReceipt, resolveAuthoritativeSkillModifier } from '../skills/authoritativeSkillModifier.ts';

export const LATEST_PWT_STEALTH_CONTRACT = { characterId: '6a6825cd07a490fa70a46852', sessionId: '6a6825edd695bd65a4322256', timestampPrefix: '2026-08-10T18:49:58', storyIndex: 59 };
const hash = async (value) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(value))))).map((byte) => byte.toString(16).padStart(2, '0')).join('');
const semantic = (record, omit = []) => Object.fromEntries(Object.entries(record || {}).filter(([key]) => !['updated_date', ...omit].includes(key)));
const resultFromText = (value) => /\bSUCCESS\b/i.test(String(value || '')) ? true : /\bFAILURE\b/i.test(String(value || '')) ? false : null;
const parsedD20 = (value) => { const found = String(value || '').match(/\brolled\s+(\d+)\b/i); return found ? Number(found[1]) : null; };

export async function auditRepairLatestPwtStealth({ db, scope, requestId, mode = 'dry_run', preconditionHashes = null }) {
  if (!requestId || !['dry_run', 'apply'].includes(mode)) return { status: 400, body: { error: 'request_id and mode dry_run/apply are required', writes: 0 } };
  const [character, session, combats] = await Promise.all([db.entities.Character.get(scope.characterId), db.entities.GameSession.get(scope.sessionId), db.entities.CombatLog.filter({ session_id: scope.sessionId }, 'id', 500)]);
  if (!character || !session) return { status: 409, body: { error: 'Protected records are missing', request_id: requestId, writes: 0 } };
  const candidates = (session.story_log || []).map((entry, index) => ({ entry, index })).filter(({ entry }) => String(entry?.timestamp || '').startsWith(LATEST_PWT_STEALTH_CONTRACT.timestampPrefix) && /Stealth\s+DC16/i.test(String(entry?.player_choice || '')));
  const target = candidates[0];
  const storedReceipts = Array.isArray(session.world_state?.__skill_check_receipts) ? session.world_state.__skill_check_receipts : [];
  const receiptCandidates = [...new Map([target?.entry?.skill_check, ...storedReceipts.filter((receipt) => receipt?.story_index === target?.index || receipt?.request_id === target?.entry?.request_id)].filter(Boolean).map((receipt) => [receipt.id || receipt.request_id || JSON.stringify(receipt), receipt])).values()];
  const receipt = receiptCandidates.length === 1 ? receiptCandidates[0] : null;
  const raw = Number.isFinite(Number(receipt?.raw_d20 ?? receipt?.raw)) ? Number(receipt?.raw_d20 ?? receipt?.raw) : parsedD20(target?.entry?.player_choice);
  const recordedModifier = Number.isFinite(Number(receipt?.modifier_total ?? receipt?.modifier)) ? Number(receipt?.modifier_total ?? receipt?.modifier) : 7;
  const dc = Number(receipt?.dc || target?.entry?.player_choice?.match(/DC\s*(\d+)/i)?.[1] || 16);
  const recordedTotal = Number.isFinite(raw) ? raw + recordedModifier : null;
  const recordedResult = receipt?.success ?? resultFromText(target?.entry?.player_choice);
  const expectedBreakdown = resolveAuthoritativeSkillModifier({ character, session, skill: 'Stealth' });
  const expectedTotal = Number.isFinite(raw) && expectedBreakdown.ok ? raw + expectedBreakdown.total : null;
  const expectedResult = Number.isFinite(raw) && expectedBreakdown.ok ? (raw !== 1 && (raw === 20 || expectedTotal >= dc)) : null;
  const stealthed = (character.conditions || []).filter((condition) => String(condition?.name || condition || '').toLowerCase() === 'stealthed');
  const targetTime = Date.parse(target?.entry?.timestamp || '');
  const attackEvidence = (combats || []).flatMap((combat) => (combat.log_entries || []).map((entry, index) => ({ combat_id: combat.id, combat_created_date: combat.created_date, index, entry }))).filter(({ combat_created_date, entry }) => {
    const entryTime = Date.parse(entry?.timestamp || entry?.at || '');
    const combatTime = Date.parse(combat_created_date || '');
    return (Number.isFinite(entryTime) && Number.isFinite(targetTime) && entryTime >= targetTime) || (Number.isFinite(combatTime) && Number.isFinite(targetTime) && combatTime >= targetTime);
  });
  const protectedHashes = { character_unrelated: await hash(semantic(character, ['conditions'])), session_unrelated: await hash(semantic(session, ['story_log', 'world_state'])), combats: await hash((combats || []).map((combat) => semantic(combat))), target_entry: target ? await hash(target.entry) : null, story_other: await hash((session.story_log || []).map((entry, index) => index === target?.index ? null : entry)) };
  const priorRepair = storedReceipts.find((item) => item?.repair_request_id === requestId);
  if (mode === 'apply' && priorRepair) return { status: 200, body: { success: true, already_processed: true, request_id: requestId, writes: 0, original_d20_reused: priorRepair.raw_d20 } };
  const hashesMatch = mode === 'dry_run' || (!!preconditionHashes && Object.entries(protectedHashes).every(([key, value]) => preconditionHashes[key] === value));
  const guards = { exact_linkage: session.character_id === scope.characterId, unique_latest_action: candidates.length === 1 && target?.index === LATEST_PWT_STEALTH_CONTRACT.storyIndex, authoritative_modifier_unambiguous: expectedBreakdown.ok === true, no_attack_or_damage_mutation: attackEvidence.length === 0, original_d20_available: Number.isFinite(raw), unique_receipt: receiptCandidates.length <= 1, exact_precondition_hashes: hashesMatch };
  const failedGuards = Object.entries(guards).filter(([, pass]) => !pass).map(([name]) => name);
  const diagnostics = { success: failedGuards.length === 0, dry_run: mode === 'dry_run', request_id: requestId, mode, writes: 0, guards, failed_guards: failedGuards, latest_action: { story_index: target?.index ?? null, timestamp: target?.entry?.timestamp || null, request_id: target?.entry?.request_id || null, player_choice: target?.entry?.player_choice || null, narrative: target?.entry?.text || null }, recorded: { d20: raw, dc, modifier: recordedModifier, total: recordedTotal, result: recordedResult, receipt: receipt || null }, expected: { modifier: expectedBreakdown.total, total: expectedTotal, result: expectedResult, breakdown: expectedBreakdown }, derived_state: { stealthed_count: stealthed.length, stealthed }, attack_or_damage_already_occurred: attackEvidence.length > 0, attack_evidence: attackEvidence, protected_hashes: protectedHashes };
  if (mode === 'dry_run') return { status: 200, body: diagnostics };
  if (failedGuards.length) return { status: 409, body: { error: 'Protected repair invariants failed; no write was made.', ...diagnostics } };
  const correctedReceipt = buildSkillCheckReceipt({ requestId: target.entry.request_id || requestId, raw, allRolls: receipt?.all_rolls || receipt?.allRolls || [raw], dc, success: expectedResult, breakdown: expectedBreakdown, advantageSources: receipt?.advantage_sources || [] });
  const attribution = `Stealth DC${dc} — ${expectedResult ? 'SUCCESS' : 'FAILURE'} (d20 ${raw} + base ${expectedBreakdown.base_skill} + Pass without Trace 10 = ${expectedTotal})`;
  const nextEntry = { ...target.entry, player_choice: String(target.entry.player_choice).replace(/\[Skill Check:[^\]]+\]/i, `[Skill Check: ${attribution}]`), skill_check: correctedReceipt };
  const currentOutcome = recordedResult;
  const nextConditions = expectedResult ? (stealthed.length ? character.conditions : [...(character.conditions || []), { name: 'Stealthed', source: 'story', duration: 'scene', applied_at: target.entry.timestamp }]) : (character.conditions || []).filter((condition) => String(condition?.name || condition || '').toLowerCase() !== 'stealthed');
  const nextWorldState = { ...(session.world_state || {}), __skill_check_receipts: [...storedReceipts.filter((item) => item?.id !== correctedReceipt.id).slice(-49), { ...correctedReceipt, story_index: target.index, repair_request_id: requestId, original_result: currentOutcome }] };
  await Promise.all([db.entities.GameSession.update(scope.sessionId, { story_log: session.story_log.map((entry, index) => index === target.index ? nextEntry : entry), world_state: nextWorldState }), JSON.stringify(nextConditions) === JSON.stringify(character.conditions || []) ? Promise.resolve() : db.entities.Character.update(scope.characterId, { conditions: nextConditions })]);
  return { status: 200, body: { success: true, already_processed: false, request_id: requestId, writes: JSON.stringify(nextConditions) === JSON.stringify(character.conditions || []) ? 1 : 2, original_d20_reused: raw, outcome_changed: currentOutcome !== expectedResult, corrected_receipt: correctedReceipt, attribution, protected_hashes: protectedHashes } };
}
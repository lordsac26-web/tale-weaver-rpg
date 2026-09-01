import { hydrateLatestStoryEntry, normalizeStoryChoices } from '../story/storyTransition.ts';
import { containsExactRecoveryClaim } from '../story/narratedStoryInventoryCommit.ts';

export const FAILED_CHOICE_SCOPE = {
  characterId: '6a6825cd07a490fa70a46852',
  sessionId: '6a6825edd695bd65a4322256',
  receiptKey: 'repair-latest-failed-choice-transition-v2',
  requestId: 'story-choice:6a6825edd695bd65a4322256:b14694d8-706c-487f-8f9d-5fc5ff855987',
  sourceIndex: 59,
  expected: { skill: 'Athletics', dc: 14, raw_d20: 9, modifier_total: 4, final_total: 13, success: false },
};

const hash = async (value) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(value))))).map((byte) => byte.toString(16).padStart(2, '0')).join('');
const failed = (check) => check?.success === false && Number.isFinite(Number(check?.raw_d20)) && Number.isFinite(Number(check?.final_total));
const dashText = (value) => /\bdash(?:ed|ing)?\b|rapidly|outpace|sprint|full speed|rapid march/i.test(String(value || ''));
const receipts = (session) => Array.isArray(session?.world_state?.__skill_check_receipts) ? session.world_state.__skill_check_receipts : [];
const repairReceipts = (session) => Array.isArray(session?.world_state?.__failed_choice_transition_repairs) ? session.world_state.__failed_choice_transition_repairs : [];
const validChoices = (choices) => Array.isArray(choices) && choices.length === 4 && choices.every((choice) => typeof choice?.text === 'string' && choice.text.trim());

async function inspect(db, scope) {
  const [character, session] = await Promise.all([db.entities.Character.get(scope.characterId).catch(() => null), db.entities.GameSession.get(scope.sessionId).catch(() => null)]);
  if (!character || !session || session.character_id !== character.id) return { status: 403, error: 'Exact Character/Session linkage is invalid.' };
  const log = Array.isArray(session.story_log) ? session.story_log : [];
  const failedDashReceipts = receipts(session).filter((entry) => failed(entry) && String(entry.skill).toLowerCase() === 'athletics');
  const latestReceipt = scope.requestId
    ? failedDashReceipts.find((entry) => entry?.request_id === scope.requestId) || null
    : [...failedDashReceipts].reverse().find((entry) => {
        const matchingEntry = log.find((item) => item?.request_id === entry.request_id);
        if (matchingEntry) return dashText(matchingEntry.player_choice);
        return normalizeStoryChoices(log.at(-1)?.choices).some((choice) => Number(choice?.dc) === Number(entry.dc) && dashText(choice?.text));
      }) || null;
  const index = latestReceipt ? log.findIndex((entry) => entry?.request_id === latestReceipt.request_id) : -1;
  const entry = index >= 0 ? log[index] : null;
  const sourceIndex = index < 0 && latestReceipt ? log.map((item, itemIndex) => ({ item, itemIndex })).reverse().find(({ item }) => normalizeStoryChoices(item?.choices).some((choice) => Number(choice?.dc) === Number(latestReceipt.dc) && dashText(choice?.text)))?.itemIndex ?? -1 : -1;
  const priorIndex = index > 0 ? index - 1 : sourceIndex;
  const prior = priorIndex >= 0 ? log[priorIndex] : null;
  const entryChoices = normalizeStoryChoices(entry?.choices);
  const priorChoices = normalizeStoryChoices(prior?.choices);
  const entryHash = await hash(entryChoices); const priorHash = await hash(priorChoices);
  const equal = index > 0 && entryHash === priorHash;
  const overlap = entryChoices.filter((choice) => priorChoices.some((oldChoice) => oldChoice?.text === choice?.text)).length;
  const laterEntries = index >= 0 ? log.slice(index + 1) : sourceIndex >= 0 ? log.slice(sourceIndex + 1) : log;
  const laterReceipts = latestReceipt ? receipts(session).filter((item) => item?.request_id !== latestReceipt.request_id && String(item?.at || item?.resolved_at || '') > String(latestReceipt?.at || latestReceipt?.resolved_at || '')) : [];
  const existingRepair = repairReceipts(session).find((item) => item?.request_id === scope.receiptKey);
  const expectedMatches = !scope.expected || Object.entries(scope.expected).every(([key, value]) => latestReceipt?.[key] === value);
  const staleSafe = !!entry && index === log.length - 1 && failed(entry.skill_check || latestReceipt) && dashText(entry.player_choice) && equal;
  const orphanSafe = !entry && !!latestReceipt && sourceIndex === log.length - 1 && (scope.sourceIndex == null || sourceIndex === scope.sourceIndex) && normalizeStoryChoices(prior?.choices).some((choice) => Number(choice?.dc) === Number(latestReceipt.dc) && dashText(choice?.text));
  const safe = expectedMatches && (staleSafe || orphanSafe) && laterEntries.length === 0 && laterReceipts.length === 0;
  return { status: 200, character, session, log, latestReceipt, index, entry, priorIndex, prior, entryChoices, priorChoices, entryHash, priorHash, equal, overlap, laterEntries, laterReceipts, existingRepair, orphanSafe, staleSafe, safe };
}

export async function failedChoiceTransitionRepairCore({ db, mode, expectedHashes, replacementNarrative, replacementChoices, proposalHash, generateChoices, scope = FAILED_CHOICE_SCOPE }) {
  if (!['discover', 'dry_run', 'apply'].includes(mode)) return { status: 400, body: { error: 'mode must be discover, dry_run, or apply', writes: 0 } };
  const state = await inspect(db, scope);
  if (state.error) return { status: state.status, body: { error: state.error, writes: 0 } };
  if (state.existingRepair) return { status: 200, body: { success: true, skipped: true, replayed: true, writes: 0, receipt: state.existingRepair } };
  const hydration = hydrateLatestStoryEntry(state.session);
  const discover = {
    success: true, mode: 'discover', function_version: 'audit-repair-latest-failed-choice-transition-v1.0.0', writes: 0,
    candidate: state.latestReceipt ? { story_entry_found: state.index >= 0, index: state.index, timestamp: state.entry?.timestamp || null, player_choice: state.entry?.player_choice || null, check: { skill: state.latestReceipt.skill, dc: state.latestReceipt.dc, raw_d20: state.latestReceipt.raw_d20, modifier_total: state.latestReceipt.modifier_total, final_total: state.latestReceipt.final_total, success: state.latestReceipt.success, request_id: state.latestReceipt.request_id } } : null,
    preceding: state.prior ? { index: state.priorIndex, timestamp: state.prior.timestamp, player_choice: state.prior.player_choice, choices: state.priorChoices } : null,
    choice_evidence: { latest_hash: state.entryHash, preceding_hash: state.priorHash, exact_equal: state.equal, overlap_count: state.overlap },
    current_hydration: { index: hydration.index, request_id: hydration.request_id, text: hydration.text, choices: hydration.choices },
    later_conflict_scan: { story_entries: state.laterEntries.length, skill_receipts: state.laterReceipts.length, safe: state.laterEntries.length === 0 && state.laterReceipts.length === 0 },
    proposed_repair: state.safe ? (state.orphanSafe ? 'Append exactly one grounded failed-Dash continuation using the immutable receipt; preserve all prior state.' : 'Replace only the latest stale copied choice array; preserve all other state.') : null,
    classification: !state.latestReceipt ? 'no_failed_dash_receipt' : state.index < 0 ? 'orphan_failed_dash_receipt_no_committed_story_entry' : state.safe ? 'provably_stale_latest_choices' : 'ambiguous_or_later_conflict',
    safe_to_repair: state.safe,
  };
  if (mode === 'discover') return { status: 200, body: discover };
  if (!state.safe) return { status: 409, body: { ...discover, mode, error: 'Fail closed: the exact failed-Dash incident or no-later-conflict guards did not match.' } };
  const sourceHashes = { story_log: await hash(state.log), source_entry: await hash(state.prior), prior_choices: state.priorHash, session: await hash(state.session), character: await hash(state.character) };
  if (mode === 'dry_run') {
    const generatedRaw = await generateChoices({ orphan: state.orphanSafe, scene: state.prior?.text || state.entry?.text, check: state.latestReceipt });
    const generated = normalizeStoryChoices(Array.isArray(generatedRaw) ? generatedRaw : generatedRaw?.choices);
    const narrative = state.orphanSafe ? String(generatedRaw?.narrative || '').trim() : String(state.entry?.text || '').trim();
    if (!narrative || containsExactRecoveryClaim(narrative) || !validChoices(generated) || await hash(generated) === state.priorHash) return { status: 409, body: { error: 'Generated grounded continuation failed validation.', writes: 0 } };
    return { status: 200, body: { ...discover, mode: 'dry_run', hashes: sourceHashes, replacement_narrative: narrative, replacement_choices: generated, proposal_hash: await hash({ narrative, choices: generated }) } };
  }
  if (!expectedHashes || Object.entries(sourceHashes).some(([key, value]) => expectedHashes[key] !== value)) return { status: 409, body: { error: 'Expected dry-run hashes do not match.', writes: 0 } };
  const narrative = String(replacementNarrative || '').trim();
  if (!narrative || containsExactRecoveryClaim(narrative) || !validChoices(replacementChoices) || await hash({ narrative, choices: replacementChoices }) !== proposalHash) return { status: 409, body: { error: 'Replacement proposal does not match dry run.', writes: 0 } };
  const fresh = await inspect(db, scope);
  if (!fresh.safe || await hash(fresh.log) !== sourceHashes.story_log) return { status: 409, body: { error: 'Later conflict detected before apply.', writes: 0 } };
  const repairedEntry = fresh.orphanSafe
    ? { timestamp: new Date().toISOString(), action: 'choice', request_id: fresh.latestReceipt.request_id, player_choice: 'Force yourself to move rapidly toward the next known cell location.', text: narrative, choices: replacementChoices, skill_check: fresh.latestReceipt, repair_origin: 'orphan_failed_dash_receipt_no_committed_story_entry' }
    : { ...fresh.entry, text: narrative, choices: replacementChoices };
  const nextLog = fresh.orphanSafe ? [...fresh.log, repairedEntry] : fresh.log.map((item, index) => index === fresh.index ? repairedEntry : item);
  const repairedIndex = fresh.orphanSafe ? nextLog.length - 1 : fresh.index;
  const receipt = { request_id: scope.receiptKey, immutable: true, repaired_index: repairedIndex, source_request_id: fresh.latestReceipt.request_id, source_story_hash: fresh.priorHash, proposal_hash: proposalHash, applied_at: new Date().toISOString() };
  const nextWorld = { ...(fresh.session.world_state || {}), __failed_choice_transition_repairs: [...repairReceipts(fresh.session), receipt] };
  const update = { story_log: nextLog, world_state: nextWorld };
  if (Array.isArray(fresh.session.current_choices)) update.current_choices = replacementChoices;
  await db.entities.GameSession.update(scope.sessionId, update);
  const after = await db.entities.GameSession.get(scope.sessionId);
  const preserved = fresh.log.every((item, index) => index === fresh.index || JSON.stringify(item) === JSON.stringify(after.story_log[index]));
  const target = after.story_log[repairedIndex];
  const characterAfter = await db.entities.Character.get(scope.characterId);
  const characterUnchanged = await hash(characterAfter) === sourceHashes.character;
  const targetValid = target?.text === narrative && JSON.stringify(target?.skill_check) === JSON.stringify(fresh.latestReceipt) && await hash({ narrative: target?.text, choices: target?.choices }) === proposalHash;
  if (!preserved || !characterUnchanged || !targetValid) return { status: 500, body: { error: 'Repair postcondition failed.', writes: 1 } };
  return { status: 200, body: { success: true, skipped: false, replayed: false, writes: 1, receipt, postconditions: { all_prior_story_entries_byte_identical: preserved, failed_result_preserved: true, character_and_inventory_unchanged: characterUnchanged, one_grounded_entry_committed: true } } };
}
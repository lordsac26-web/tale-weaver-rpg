import { finalizeGeneratedStoryResult, normalizeGeneratedChoices } from '../story/storyBootstrap.ts';
import { canonicalStoryResponsePayload, hashStoryValue, hydrateLatestStoryEntry } from '../story/storyTransition.ts';
import { createStaleChoiceApplyToken, verifyStaleChoiceApplyToken } from './staleChoiceApplyToken.ts';

export const LIVE_STALE_CHOICE_SCOPE = { characterId: '6a6825cd07a490fa70a46852', sessionId: '6a6825edd695bd65a4322256', receiptKey: 'repair-latest-stale-choice-transition-v1' };
const receipts = (session) => Array.isArray(session?.world_state?.__skill_check_receipts) ? session.world_state.__skill_check_receipts : [];
const repairs = (session) => Array.isArray(session?.world_state?.__stale_choice_transition_repairs) ? session.world_state.__stale_choice_transition_repairs : [];
const valid = (choices) => normalizeGeneratedChoices(choices).length === 4;
const protectedSession = (session) => { const { story_log, current_choices, updated_date, world_state, ...rest } = session || {}; const { __stale_choice_transition_repairs, ...protectedWorld } = world_state || {}; return { ...rest, world_state: protectedWorld }; };
const latestUnifiedReceipt = (session) => [...receipts(session)].reverse().find((receipt) => receipt?.unified_story_skill_resolution === true) || null;

async function inspect(db, scope) {
  const [character, session] = await Promise.all([db.entities.Character.get(scope.characterId).catch(() => null), db.entities.GameSession.get(scope.sessionId).catch(() => null)]);
  if (!character || !session || session.character_id !== character.id) return { status: 403, error: 'Exact Character/Session linkage is invalid.' };
  const log = Array.isArray(session.story_log) ? session.story_log : [];
  const receipt = latestUnifiedReceipt(session);
  const resultIndex = receipt ? log.findIndex((entry) => entry?.request_id === receipt.request_id) : -1;
  const result = resultIndex >= 0 ? log[resultIndex] : null;
  const sourceIndex = resultIndex > 0 ? resultIndex - 1 : log.length - 1;
  const source = sourceIndex >= 0 ? log[sourceIndex] : null;
  const resultChoices = normalizeGeneratedChoices(result?.choices);
  const sourceChoices = normalizeGeneratedChoices(source?.choices);
  const resultHash = await hashStoryValue(resultChoices);
  const sourceHash = await hashStoryValue(sourceChoices);
  const resultStale = !!result && resultIndex === log.length - 1 && (!valid(resultChoices) || resultHash === sourceHash);
  const frontendOnly = !!receipt && resultIndex < 0 && sourceIndex === log.length - 1;
  const classification = resultStale ? 'server_persisted_stale_choices' : frontendOnly ? 'frontend_hydration_stale_choices' : 'no_issue';
  const existingRepair = repairs(session).find((item) => item?.receipt_key === scope.receiptKey && item?.source_request_id === receipt?.request_id) || null;
  return { status: 200, character, session, log, receipt, resultIndex, result, sourceIndex, source, resultChoices, sourceChoices, resultHash, sourceHash, resultStale, frontendOnly, classification, existingRepair };
}

async function hashes(state) {
  return { story_log: await hashStoryValue(state.log), source_entry: await hashStoryValue(state.source), result_entry: await hashStoryValue(state.result), source_choices: state.sourceHash, result_choices: state.resultHash, session: await hashStoryValue(state.session), character: await hashStoryValue(state.character), protected_session: await hashStoryValue(protectedSession(state.session)), skill_receipts: await hashStoryValue(receipts(state.session)) };
}

function compact(state, mode, expectedHashes, proposalHash, token) {
  return { success: true, mode, function_version: 'audit-repair-latest-stale-choice-transition-v1.0.0', classification: state.classification, safe_to_repair: state.resultStale, writes: 0, character_id: state.character.id, session_id: state.session.id, request_id: state.receipt?.request_id || null, source_index: state.sourceIndex, result_index: state.resultIndex, expected_hashes: expectedHashes, previous_choice_hash: state.sourceHash, current_choice_hash: state.resultHash, response_payload_hash: state.result?.choice_evidence?.response_payload_hash || null, proposed_entry_hash: proposalHash, proposed_choice_count: proposalHash ? 4 : 0, no_later_conflicts: state.resultIndex < 0 || state.resultIndex === state.log.length - 1, apply_token: token };
}

function proposalFor(state) {
  const guarded = finalizeGeneratedStoryResult({ narrative: state.result.text, choices: state.sourceChoices, combat_trigger: false }, { location: state.session.current_location || 'the current area', requestId: state.receipt.request_id, previousChoices: state.sourceChoices });
  return { choices: guarded.choices, narrative: state.result.text };
}

export async function staleChoiceTransitionRepairCore({ db, mode, responseFormat, applyToken, scope = LIVE_STALE_CHOICE_SCOPE }) {
  if (!['discover', 'dry_run', 'apply'].includes(mode)) return { status: 400, body: { error: 'mode must be discover, dry_run, or apply', writes: 0 } };
  let state = await inspect(db, scope);
  if (state.error) return { status: state.status, body: { error: state.error, writes: 0 } };
  const expectedHashes = await hashes(state);
  const tokenCheck = applyToken ? await verifyStaleChoiceApplyToken({ token: applyToken, scope, receipt: state.receipt, character: state.character, allowExpired: !!state.existingRepair }) : null;
  if (tokenCheck && !tokenCheck.ok) return { status: tokenCheck.status, body: { error: tokenCheck.error, writes: 0 } };
  if (state.existingRepair) return { status: 200, body: { success: true, replayed: true, writes: 0, function_version: 'audit-repair-latest-stale-choice-transition-v1.0.0', receipt: state.existingRepair } };
  const detail = { ...compact(state, mode, expectedHashes, null, null), candidate: state.receipt ? { request_id: state.receipt.request_id, skill: state.receipt.skill, dc: state.receipt.dc, raw_d20: state.receipt.raw_d20, modifier_total: state.receipt.modifier_total, final_total: state.receipt.final_total, success: state.receipt.success, receipt_timestamp: state.receipt.at || null, source_timestamp: state.source?.timestamp || null, result_timestamp: state.result?.timestamp || null } : null, hydration: hydrateLatestStoryEntry(state.session) };
  if (mode === 'discover' && responseFormat !== 'guard_only') return { status: 200, body: detail };
  if (!state.resultStale) return { status: 200, body: responseFormat === 'guard_only' ? compact(state, mode, expectedHashes, null, null) : detail };
  const proposal = proposalFor(state);
  const proposalHash = await hashStoryValue({ request_id: state.receipt.request_id, result_index: state.resultIndex, narrative: proposal.narrative, choices: proposal.choices });
  if (mode !== 'apply') {
    const token = await createStaleChoiceApplyToken({ scope, receipt: state.receipt, character: state.character, expectedHashes, classification: state.classification, proposalHash });
    return { status: 200, body: responseFormat === 'guard_only' ? compact(state, mode, expectedHashes, proposalHash, token) : { ...detail, safe_to_repair: true, proposed_choices: proposal.choices, proposed_entry_hash: proposalHash, apply_token: token } };
  }
  if (!tokenCheck?.ok || tokenCheck.payload.classification !== state.classification || Object.entries(expectedHashes).some(([key, value]) => tokenCheck.payload.expected_hashes?.[key] !== value) || tokenCheck.payload.proposal_hash !== proposalHash) return { status: 409, body: { error: 'Apply token state or proposal mismatch.', writes: 0 } };
  state = await inspect(db, scope);
  const freshHashes = state.error ? null : await hashes(state);
  if (!state.resultStale || !freshHashes || Object.entries(expectedHashes).some(([key, value]) => freshHashes[key] !== value)) return { status: 409, body: { error: 'Bound state changed before apply.', writes: 0 } };
  const repairedEntry = { ...state.result, choices: proposal.choices, choice_evidence: { ...(state.result.choice_evidence || {}), previous_choice_hash: state.sourceHash, current_choice_hash: await hashStoryValue(proposal.choices), response_payload_hash: await hashStoryValue(canonicalStoryResponsePayload({ requestId: state.receipt.request_id, text: state.result.text, choices: proposal.choices, skillCheck: state.result.skill_check || state.receipt })), repair_guard: 'stale-choice-transition-v1' } };
  const nextLog = state.log.map((entry, index) => index === state.resultIndex ? repairedEntry : entry);
  const receipt = { receipt_key: scope.receiptKey, immutable: true, source_request_id: state.receipt.request_id, source_index: state.sourceIndex, repaired_index: state.resultIndex, source_story_hash: state.sourceHash, stale_choice_hash: state.resultHash, proposal_hash: proposalHash, applied_at: new Date().toISOString() };
  await db.entities.GameSession.update(scope.sessionId, { story_log: nextLog, world_state: { ...(state.session.world_state || {}), __stale_choice_transition_repairs: [...repairs(state.session), receipt] } });
  const after = await db.entities.GameSession.get(scope.sessionId);
  const replayedState = await inspect(db, scope);
  const priorPreserved = state.log.every((entry, index) => index === state.resultIndex || JSON.stringify(entry) === JSON.stringify(after.story_log[index]));
  const protectedOk = await hashStoryValue(protectedSession(after)) === expectedHashes.protected_session && await hashStoryValue(await db.entities.Character.get(scope.characterId)) === expectedHashes.character && await hashStoryValue(receipts(after)) === expectedHashes.skill_receipts;
  if (!priorPreserved || !protectedOk || replayedState.classification !== 'no_issue') return { status: 500, body: { error: 'Repair postcondition failed.', writes: 1 } };
  return { status: 200, body: { success: true, replayed: false, writes: 1, function_version: 'audit-repair-latest-stale-choice-transition-v1.0.0', receipt, postconditions: { prior_entries_byte_identical: priorPreserved, narration_preserved: after.story_log[state.resultIndex].text === state.result.text, failed_result_preserved: await hashStoryValue(after.story_log[state.resultIndex].skill_check) === await hashStoryValue(state.result.skill_check), protected_state_unchanged: protectedOk } } };
}
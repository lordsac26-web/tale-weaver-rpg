import { finalizeGeneratedStoryResult, normalizeGeneratedChoices } from '../story/storyBootstrap.ts';
import { canonicalStoryResponsePayload, hashStoryValue, hydrateLatestStoryEntry } from '../story/storyTransition.ts';
import { createStaleChoiceApplyToken, verifyStaleChoiceApplyToken } from './staleChoiceApplyToken.ts';

export const STALE_CHOICE_AUDITOR_VERSION = 'audit-repair-latest-stale-choice-transition-v1.3.0';
export const LIVE_STALE_CHOICE_SCOPE = { characterId: '6a6825cd07a490fa70a46852', sessionId: '6a6825edd695bd65a4322256' };
const repairKeyFor = async (scope, receipt) => `stale-choice-v1.3:${await hashStoryValue({ app: 'tale-weaver-rpg', session_id: scope.sessionId, character_id: scope.characterId, source_request_id: receipt?.request_id, auditor_version: STALE_CHOICE_AUDITOR_VERSION })}`;
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
  const matchingChoice = (choice) => String(choice?.skill_check || '').toLowerCase().includes(String(receipt?.skill || '').toLowerCase()) && Number(choice?.dc) === Number(receipt?.dc);
  const receiptSourceIndex = receipt ? log.map((entry, index) => ({ entry, index })).reverse().find(({ entry }) => normalizeGeneratedChoices(entry?.choices).some(matchingChoice))?.index ?? -1 : -1;
  const sourceIndex = resultIndex > 0 ? resultIndex - 1 : receiptSourceIndex;
  const source = sourceIndex >= 0 ? log[sourceIndex] : null;
  const selectedChoice = normalizeGeneratedChoices(source?.choices).find(matchingChoice)?.text || null;
  const resultChoices = normalizeGeneratedChoices(result?.choices);
  const sourceChoices = normalizeGeneratedChoices(source?.choices);
  const resultHash = await hashStoryValue(resultChoices);
  const sourceHash = await hashStoryValue(sourceChoices);
  const resultStale = !!result && resultIndex === log.length - 1 && (!valid(resultChoices) || resultHash === sourceHash);
  const laterEntries = sourceIndex >= 0 ? log.slice(sourceIndex + 1).filter((entry) => entry?.request_id !== receipt?.request_id) : log;
  const orphan = !!receipt && resultIndex < 0 && sourceIndex >= 0 && !!selectedChoice;
  const orphanSafe = orphan && laterEntries.length === 0 && receipts(session).at(-1)?.request_id === receipt.request_id;
  const frontendOnly = !!receipt && resultIndex < 0 && !orphan;
  const classification = resultStale ? 'server_persisted_stale_choices' : orphan ? 'orphan_browser_narration_with_skill_receipt' : frontendOnly ? 'frontend_hydration_stale_choices' : 'no_issue';
  const receiptKey = await repairKeyFor(scope, receipt);
  const existingRepair = repairs(session).find((item) => item?.receipt_key === receiptKey && item?.source_request_id === receipt?.request_id) || null;
  return { status: 200, character, session, log, receipt, receiptKey, resultIndex, result, sourceIndex, source, selectedChoice, laterEntries, resultChoices, sourceChoices, resultHash, sourceHash, resultStale, orphan, orphanSafe, frontendOnly, classification, existingRepair };
}

async function hashes(state) {
  return { story_log: await hashStoryValue(state.log), source_entry: await hashStoryValue(state.source), result_entry: await hashStoryValue(state.result), source_choices: state.sourceHash, result_choices: state.resultHash, session: await hashStoryValue(state.session), character: await hashStoryValue(state.character), protected_session: await hashStoryValue(protectedSession(state.session)), skill_receipts: await hashStoryValue(receipts(state.session)) };
}

function compact(state, mode, expectedHashes, proposal = null, token = null, classification = state.classification) {
  const proposedChoices=normalizeGeneratedChoices(proposal?.choices); const complete=!!proposal?.hash&&!!proposal?.narrative&&proposedChoices.length===4&&proposal.choice_hash!==state.sourceHash;
  return { success: true, mode, function_version: STALE_CHOICE_AUDITOR_VERSION, classification, safe_to_repair: complete&&(state.resultStale||state.orphanSafe)&&state.laterEntries.length===0, writes: 0, character_id: state.character.id, session_id: state.session.id, request_id: state.receipt?.request_id || null, repair_receipt_key: state.receiptKey, source_index: state.sourceIndex, result_index: state.resultIndex, expected_hashes: expectedHashes, previous_choice_hash: state.sourceHash, current_choice_hash: state.resultHash, response_payload_hash: state.result?.choice_evidence?.response_payload_hash || null, proposed_entry_hash: proposal?.hash||null, proposed_choice_hash: proposal?.choice_hash||null, proposed_choice_count: proposedChoices.length, no_later_conflicts: state.laterEntries.length === 0, apply_token: complete?token:null };
}

function proposalFor(state) {
  const outcome = state.receipt?.success === true ? 'succeeds' : 'fails';
  const consequence = state.receipt?.success === true ? 'The result reveals a reliable way forward without inventing any lost browser narration.' : 'The result reveals no reliable opening, so you pause and reassess without inventing any lost browser narration.';
  const narrative = state.orphan ? `Your ${state.receipt.skill} check ${outcome}: ${state.receipt.final_total} against DC ${state.receipt.dc}. ${consequence}` : state.result.text;
  const guarded = finalizeGeneratedStoryResult({ narrative, choices: state.sourceChoices, combat_trigger: false }, { location: state.session.current_location || 'the current area', requestId: state.receipt.request_id, previousChoices: state.sourceChoices });
  return { choices: guarded.choices, narrative };
}

export async function staleChoiceTransitionRepairCore({ db, mode, responseFormat, applyToken, scope = LIVE_STALE_CHOICE_SCOPE, proposalFactory = proposalFor }) {
  if (!['discover', 'dry_run', 'apply'].includes(mode)) return { status: 400, body: { error: 'mode must be discover, dry_run, or apply', writes: 0 } };
  let state = await inspect(db, scope);
  if (state.error) return { status: state.status, body: { error: state.error, writes: 0 } };
  const expectedHashes = await hashes(state);
  const tokenScope = { ...scope, receiptKey: state.receiptKey };
  const tokenCheck = applyToken ? await verifyStaleChoiceApplyToken({ token: applyToken, scope: tokenScope, receipt: state.receipt, character: state.character, allowExpired: !!state.existingRepair }) : null;
  if (tokenCheck && !tokenCheck.ok) return { status: tokenCheck.status, body: { error: tokenCheck.error, writes: 0 } };
  if (state.existingRepair) return { status: 200, body: { success: true, skipped: true, replayed: true, writes: 0, function_version: STALE_CHOICE_AUDITOR_VERSION, receipt: state.existingRepair } };
  const detail = { ...compact(state, mode, expectedHashes), candidate: state.receipt ? { request_id: state.receipt.request_id, skill: state.receipt.skill, dc: state.receipt.dc, raw_d20: state.receipt.raw_d20, modifier_total: state.receipt.modifier_total, final_total: state.receipt.final_total, success: state.receipt.success, receipt_timestamp: state.receipt.at || null, source_timestamp: state.source?.timestamp || null, result_timestamp: state.result?.timestamp || null } : null, hydration: hydrateLatestStoryEntry(state.session) };
  if (mode === 'discover' && responseFormat !== 'guard_only') return { status: 200, body: detail };
  const repairable = state.resultStale || state.orphanSafe;
  if (!repairable) return { status: 200, body: responseFormat === 'guard_only' ? compact(state, mode, expectedHashes) : detail };
  const proposal = await proposalFactory(state); const proposedChoices=normalizeGeneratedChoices(proposal?.choices); const choiceHash=await hashStoryValue(proposedChoices); const schemaValid=proposedChoices.length===4&&new Set(proposedChoices.map((choice)=>choice.text.toLowerCase())).size===4&&proposedChoices.every((choice)=>choice.text&&(!choice.skill_check||Number.isFinite(Number(choice.dc))));
  const proposalHash=schemaValid&&proposal?.narrative&&choiceHash!==state.sourceHash?await hashStoryValue({request_id:state.receipt.request_id,result_index:state.resultIndex,narrative:proposal.narrative,choices:proposedChoices}):null; const proposalMeta={...proposal,choices:proposedChoices,choice_hash:choiceHash,hash:proposalHash};
  if (!proposalHash) return {status:200,body:compact(state,mode,expectedHashes,proposalMeta,null,'unsafe_incomplete_proposal')};
  if (mode !== 'apply') {
    const token = await createStaleChoiceApplyToken({ scope: tokenScope, receipt: state.receipt, character: state.character, expectedHashes, classification: state.classification, proposalHash });
    return { status: 200, body: responseFormat === 'guard_only' ? compact(state, mode, expectedHashes, proposalMeta, token) : { ...detail, safe_to_repair: true, proposed_choices: proposedChoices, proposed_entry_hash: proposalHash, proposed_choice_hash:choiceHash, proposed_choice_count:4, apply_token: token } };
  }
  if (!tokenCheck?.ok || tokenCheck.payload.classification !== state.classification || Object.entries(expectedHashes).some(([key, value]) => tokenCheck.payload.expected_hashes?.[key] !== value) || tokenCheck.payload.proposal_hash !== proposalHash) return { status: 409, body: { error: 'Apply token state or proposal mismatch.', writes: 0 } };
  state = await inspect(db, scope);
  const freshHashes = state.error ? null : await hashes(state);
  if (!(state.resultStale || state.orphanSafe) || !freshHashes || Object.entries(expectedHashes).some(([key, value]) => freshHashes[key] !== value)) return { status: 409, body: { error: 'Bound state changed before apply.', writes: 0 } };
  const repairedEntry = { ...(state.result || {}), timestamp: state.result?.timestamp || new Date().toISOString(), action: 'choice', request_id: state.receipt.request_id, player_choice: state.result?.player_choice || state.selectedChoice, text: proposal.narrative, choices: proposedChoices, skill_check: state.result?.skill_check || state.receipt, repair_origin: state.orphan ? 'orphan_browser_narration_with_skill_receipt' : state.result?.repair_origin, choice_evidence: { ...(state.result?.choice_evidence || {}), previous_choice_hash: state.sourceHash, current_choice_hash: choiceHash, response_payload_hash: await hashStoryValue(canonicalStoryResponsePayload({ requestId: state.receipt.request_id, text: proposal.narrative, choices: proposedChoices, skillCheck: state.result?.skill_check || state.receipt })), repair_guard: 'stale-choice-transition-v1' } };
  const nextLog = state.orphan ? [...state.log, repairedEntry] : state.log.map((entry, index) => index === state.resultIndex ? repairedEntry : entry);
  const repairedIndex = state.orphan ? nextLog.length - 1 : state.resultIndex;
  const receipt = { receipt_key: state.receiptKey, immutable: true, source_request_id: state.receipt.request_id, auditor_version: STALE_CHOICE_AUDITOR_VERSION, source_index: state.sourceIndex, repaired_index: repairedIndex, source_story_hash: state.sourceHash, stale_choice_hash: state.resultHash, proposal_hash: proposalHash, applied_at: new Date().toISOString() };
  await db.entities.GameSession.update(scope.sessionId, { story_log: nextLog, world_state: { ...(state.session.world_state || {}), __stale_choice_transition_repairs: [...repairs(state.session), receipt] } });
  const after = await db.entities.GameSession.get(scope.sessionId);
  const replayedState = await inspect(db, scope);
  const priorPreserved = state.log.every((entry, index) => state.orphan || index !== state.resultIndex ? JSON.stringify(entry) === JSON.stringify(after.story_log[index]) : true);
  const protectedOk = await hashStoryValue(protectedSession(after)) === expectedHashes.protected_session && await hashStoryValue(await db.entities.Character.get(scope.characterId)) === expectedHashes.character && await hashStoryValue(receipts(after)) === expectedHashes.skill_receipts;
  const target = after.story_log[repairedIndex];
  if (!priorPreserved || !protectedOk || replayedState.classification !== 'no_issue') return { status: 500, body: { error: 'Repair postcondition failed.', writes: 1 } };
  return { status: 200, body: { success: true, replayed: false, writes: 1, function_version: STALE_CHOICE_AUDITOR_VERSION, receipt, postconditions: { prior_entries_byte_identical: priorPreserved, narration_preserved: state.orphan ? target.text === proposal.narrative : target.text === state.result.text, skill_result_preserved: await hashStoryValue(target.skill_check) === await hashStoryValue(state.result?.skill_check || state.receipt), protected_state_unchanged: protectedOk } } };
}
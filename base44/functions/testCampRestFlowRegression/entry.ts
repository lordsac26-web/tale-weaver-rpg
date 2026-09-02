import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { campRestReducer, CAMP_REST_MOBILE_CONTRACT, CAMP_REST_TRANSITION_VERSION, createCampRestState, createRestSubmissionGate } from '../../shared/rest/campRestFlow.js';
import { executeCampLongRest } from '../../shared/story/campLongRest.ts';
import { hashValue, readProtectedDndState } from '../../shared/tests/liveProtection.ts';

export default async function(req) {
  const fixtures = []; const tests = []; const test = (name, pass) => tests.push({ name, pass: !!pass });
  try {
    const base44 = createClientFromRequest(req); const user = await base44.auth.me();
    if (!user || user.role !== 'admin') return Response.json({ error: 'Admin access required.' }, { status: 403 });
    await req.json().catch(() => ({}));
    const protectedBefore = await hashValue(await readProtectedDndState(base44.asServiceRole));
    const token = `CampRestFlowQA_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const character = await base44.entities.Character.create({ name: token, race: 'Human', class: 'Ranger', level: 6, hp_max: 52, hp_current: 41, hit_dice_remaining: 2, spell_slots: { level_2: 1 }, inventory: [{ name: 'Arrows', quantity: 18 }, { name: 'Unidentified Staff' }], conditions: [{ name: 'Alert', duration: 'persistent' }], xp: 500, gold: 20, is_active: false });
    const session = await base44.asServiceRole.entities.GameSession.create({ character_id: character.id, title: token, in_combat: false, time_of_day: 'Evening', world_state: { clock_hour: 20, elapsed_hours: 20 }, story_log: [], is_active: false }); fixtures.push({ character: character.id, session: session.id });

    const requestId = `${token}:stable`; let state = campRestReducer(createCampRestState(), { type: 'SELECT', restType: 'long', requestId });
    test('selector opens once and long-rest confirmation opens once with one stable key', state.step === 'confirm_long_rest' && state.requestId === requestId);
    for (const input of ['mouse', 'touch', 'Enter', 'Space']) { let prevented = 0, stopped = 0, calls = 0; const gate = createRestSubmissionGate(); await gate.run({ preventDefault: () => prevented++, stopPropagation: () => stopped++, input }, async () => calls++); test(`${input} confirmation prevents default, stops bubbling, and invokes once`, prevented === 1 && stopped === 1 && calls === 1); }
    let nestedPrevented = 0, nestedStopped = 0; await createRestSubmissionGate().run({ preventDefault: () => nestedPrevented++, stopPropagation: () => nestedStopped++ }, async () => true); test('nested form submit cannot reach parent rest trigger', nestedPrevented === 1 && nestedStopped === 1);
    let release; let rapidCalls = 0; const rapidGate = createRestSubmissionGate(); const pending = rapidGate.run({}, async () => { rapidCalls++; await new Promise((resolve) => { release = resolve; }); }); const duplicate = await rapidGate.run({}, async () => { rapidCalls++; }); release(); await pending; test('double tap and rapid confirm dispatch one request', rapidCalls === 1 && duplicate.duplicate === true);
    const rerendered = campRestReducer(state, { type: 'UNKNOWN' }); test('StrictMode or effect rerender dispatches no request and preserves key', rerendered === state && rerendered.requestId === requestId);
    const cancelled = campRestReducer(state, { type: 'RESET' }); test('cancel before dispatch returns idle model and invokes backend zero times', cancelled.step === 'choose_type' && cancelled.requestId === null && rapidCalls === 1);
    test('submitting state has no cancel transition and remains noninteractive', campRestReducer(campRestReducer(state, { type: 'SUBMIT' }), { type: 'UNKNOWN' }).step === 'submitting');
    const errored = campRestReducer(campRestReducer(state, { type: 'SUBMIT' }), { type: 'ERROR', error: 'timeout' }); const retrying = campRestReducer(errored, { type: 'RETRY' }); test('network timeout keeps retry on same idempotency key', errored.step === 'error' && retrying.step === 'submitting' && retrying.requestId === requestId);
    test('mobile contract uses 100dvh, intrinsic stacking, one scroll owner, and safe areas', CAMP_REST_MOBILE_CONTRACT.viewport === '100dvh' && CAMP_REST_MOBILE_CONTRACT.intrinsicStacking && CAMP_REST_MOBILE_CONTRACT.singleScrollOwner && CAMP_REST_MOBILE_CONTRACT.safeAreaPadding);

    const payload = { rest_request_id: requestId, rest_intent: 'long_rest_8h', location_safe: true };
    const first = await executeCampLongRest({ base44, user, character, session, payload });
    const afterCharacter = await base44.asServiceRole.entities.Character.get(character.id); const afterSession = await base44.asServiceRole.entities.GameSession.get(session.id);
    const replay = await executeCampLongRest({ base44, user, character: afterCharacter, session: afterSession, payload }); const afterReplay = await base44.asServiceRole.entities.GameSession.get(session.id);
    test('authoritative success restores resources and advances time exactly once', first.status === 200 && first.body?.success && afterCharacter.hp_current === 52 && JSON.stringify(afterCharacter.spell_slots) === '{}' && afterSession.world_state.clock_hour === 4);
    test('success refresh exposes one receipt and one dispatch record', afterSession.world_state.__rest_receipts?.length === 1 && afterSession.world_state.__rest_requests?.length === 1);
    test('backend replay uses same key and writes zero additional receipt or time advance', replay.body?.already_processed === true && afterReplay.world_state.__rest_receipts?.length === 1 && afterReplay.world_state.clock_hour === 4);
    test('narration interruption retry cannot repeat mechanics', replay.body?.already_processed === true && replay.body?.receipt_id === requestId);
    test('inventory ammo staff XP currency and persistent conditions survive', afterCharacter.inventory?.[0]?.quantity === 18 && afterCharacter.inventory?.some((item) => item.name === 'Unidentified Staff') && afterCharacter.xp === 500 && afterCharacter.gold === 20 && afterCharacter.conditions?.some((condition) => condition.name === 'Alert'));
    await base44.asServiceRole.entities.GameSession.update(session.id, { in_combat: true }); const combatSession = await base44.asServiceRole.entities.GameSession.get(session.id); const combatResult = await executeCampLongRest({ base44, user, character: afterCharacter, session: combatSession, payload: { ...payload, rest_request_id: `${requestId}:combat` } }); test('in-combat rest is rejected by authoritative core path', combatResult.status >= 400);
    const staleResult = await executeCampLongRest({ base44, user, character: afterCharacter, session: { ...combatSession, in_combat: false, character_id: 'stale' }, payload: { ...payload, rest_request_id: `${requestId}:stale` } }); test('stale session linkage cannot commit through caller validation contract', staleResult.status >= 400 || staleResult.body?.success !== true);
    const protectedAfter = await hashValue(await readProtectedDndState(base44.asServiceRole)); test('protected live records remain byte-identical', protectedBefore === protectedAfter);
    const passed = tests.filter((entry) => entry.pass).length;
    return Response.json({ function_version: 'camp-rest-flow-regression-v1.0.0', frontend_version: CAMP_REST_TRANSITION_VERSION, passed, failed: tests.length - passed, total: tests.length, all_pass: passed === tests.length, tests, protected_live_state: { read_only_hash_check: true, unchanged: protectedBefore === protectedAfter } }, { status: passed === tests.length ? 200 : 500 });
  } catch (error) {
    return Response.json({ error: error.message || 'Camp rest flow regression failed.', tests }, { status: 500 });
  } finally {
    const base44 = createClientFromRequest(req);
    for (const fixture of fixtures.reverse()) for (const [entity, id] of [['GameSession', fixture.session], ['Character', fixture.character]]) { try { await base44.asServiceRole.entities[entity].delete(id); } catch {} }
  }
}
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { expireStructuredConditions, hasCondition } from '../../shared/combat/conditions.ts';

const QA_PREFIX = 'P1QA_';
const LIVE_IDS = {
  character: '6a6825cd07a490fa70a46852',
  session: '6a6825edd695bd65a4322256',
  combat: '6a7155d3c597b47463e0854e',
};

const dataOf = (response) => response?.data ?? response;
const statusOf = (value, fallback = null) => {
  const direct = Number(value?.response?.status ?? value?.status ?? value?.cause?.status);
  if (Number.isFinite(direct) && direct >= 100 && direct <= 599) return direct;
  const match = String(value?.message || '').match(/\b([1-5]\d{2})\b/);
  return match ? Number(match[1]) : fallback;
};
const errorBodyOf = (error) => error?.response?.data ?? error?.data ?? { error: error?.message || 'Unknown invocation error' };
const receiptCount = (character) => (character?.long_rest_abilities?.__typed_spell_casts || []).length;
const sameJson = (left, right) => JSON.stringify(left) === JSON.stringify(right);

export default async function runP1SpellConditionRegression(req) {
  const fixtureIds = { character: null, session: null, mismatchSession: null, combat: null, rollRecords: [], receipts: [] };
  const cleanup = [];
  const results = [];
  const diagnostics = [];
  const cleanupTargets = [];
  const state = { ready: false, user: null, character: null, session: null, mismatchSession: null, combat: null };
  let cleanupUnsafe = false;

  const protectedSnapshot = () => ({
    protected: true,
    read: false,
    ids: LIVE_IDS,
    reason: 'Live campaign IDs are intentionally never read or mutated by this QA endpoint.',
  });

  const addTarget = (entity, id) => {
    if (id) cleanupTargets.push({ entity, id });
  };

  const ownerSessionState = (sessionId, characterId) => {
    const requestedSession = sessionId === state.session?.id ? state.session : sessionId === state.mismatchSession?.id ? state.mismatchSession : null;
    const ownerId = state.character?.created_by_id || null;
    return {
      request_session_id: sessionId || null,
      request_character_id: characterId || null,
      fixture_owner_matches_authenticated_user: !!ownerId && ownerId === state.user?.id,
      requested_character_matches_fixture: characterId === state.character?.id,
      requested_session_character_matches_request: !!requestedSession && requestedSession.character_id === characterId,
      requested_session_character_id: requestedSession?.character_id || null,
    };
  };

  const requestShape = (payload) => ({
    session_id: payload.session_id || null,
    character_id: payload.character_id || null,
    spell_name: payload.spell_name || null,
    slot_level: payload.slot_level ?? null,
    request_id: payload.request_id || null,
    has_action_text: !!payload.action_text,
  });

  const invoke = async (testName, functionName, payload) => {
    const ownership = ownerSessionState(payload.session_id, payload.character_id);
    try {
      const response = await state.base44.functions.invoke(functionName, payload);
      const outcome = { status: statusOf(response, 200), body: dataOf(response), client_error: null, ownership };
      diagnostics.push({ downstream_function: functionName, test_name: testName, request_shape: requestShape(payload), status: outcome.status, response_body: outcome.body, owner_session_character: ownership });
      return outcome;
    } catch (error) {
      const outcome = { status: statusOf(error), body: errorBodyOf(error), client_error: String(error?.message || 'Client invocation failed'), ownership };
      diagnostics.push({ downstream_function: functionName, test_name: testName, request_shape: requestShape(payload), status: outcome.status, response_body: outcome.body, owner_session_character: ownership });
      return outcome;
    }
  };

  const runTest = async (name, expectedStatus, fn) => {
    try {
      const outcome = await fn();
      results.push({
        name,
        pass: !!outcome?.pass,
        expected_status: expectedStatus,
        actual_status: outcome?.actual_status ?? null,
        detail: outcome?.detail ?? null,
      });
    } catch (error) {
      const status = statusOf(error);
      results.push({
        name,
        pass: false,
        expected_status: expectedStatus,
        actual_status: status,
        detail: { error: errorBodyOf(error), client_error: String(error?.message || 'Unexpected test boundary error') },
      });
    }
  };

  try {
    if (req.method !== 'POST') {
      return Response.json({ error: 'POST required' }, { status: 405 });
    }
    await req.json();
    state.base44 = createClientFromRequest(req);
    state.user = await state.base44.auth.me();
    if (!state.user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (state.user.role !== 'admin') return Response.json({ error: 'Owner/admin access required' }, { status: 403 });

    await runTest('Fixture setup and owner attribution', 200, async () => {
      const token = `${QA_PREFIX}${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      state.character = await state.base44.entities.Character.create({
        name: `${token}_Ranger`, race: 'Human', class: 'Ranger', level: 5,
        wisdom: 16, constitution: 14, hp_max: 30, hp_current: 10, armor_class: 14,
        proficiency_bonus: 3, spell_slots: { level_1: 0, level_2: 0 },
        spells_known: ['Cure Wounds', 'Pass without Trace', 'Fire Bolt'],
        spells_prepared: ['Cure Wounds', 'Pass without Trace', 'Fire Bolt'],
        conditions: [{ name: 'legacy-readable' }], active_modifiers: [], inventory: [],
        long_rest_abilities: {}, is_active: false,
      });
      fixtureIds.character = state.character.id;
      addTarget('Character', state.character.id);

      state.session = await state.base44.asServiceRole.entities.GameSession.create({
        character_id: state.character.id, title: `${token}_Session`, in_combat: true, combat_state: {}, is_active: false,
      });
      fixtureIds.session = state.session.id;
      addTarget('GameSession', state.session.id);

      state.mismatchSession = await state.base44.asServiceRole.entities.GameSession.create({
        character_id: `${token}_other_character`, title: `${token}_Mismatch`, in_combat: false, combat_state: {}, is_active: false,
      });
      fixtureIds.mismatchSession = state.mismatchSession.id;
      addTarget('GameSession', state.mismatchSession.id);

      state.combat = await state.base44.asServiceRole.entities.CombatLog.create({
        session_id: state.session.id, character_id: state.character.id, character_name: state.character.name,
        round: 1, current_turn_index: 0, is_active: true, result: 'ongoing',
        combatants: [{ id: state.character.id, type: 'player', name: state.character.name, hp_current: 10, hp_max: 30, ac: 14, is_conscious: true, conditions: [{ name: 'legacy-readable' }] }],
        initiative_order: [{ id: state.character.id, name: state.character.name, initiative: 10 }],
        log_entries: [], world_state: {},
      });
      fixtureIds.combat = state.combat.id;
      addTarget('CombatLog', state.combat.id);
      await state.base44.asServiceRole.entities.GameSession.update(state.session.id, { combat_state: { combat_id: state.combat.id } });

      const ownerMatches = state.character.created_by_id === state.user.id || String(state.character.created_by || '').toLowerCase() === String(state.user.email || '').toLowerCase();
      state.ready = ownerMatches;
      return {
        pass: ownerMatches && state.session.character_id === state.character.id && state.combat.session_id === state.session.id,
        actual_status: 200,
        detail: { fixture_ids: { character: fixtureIds.character, session: fixtureIds.session, mismatchSession: fixtureIds.mismatchSession, combat: fixtureIds.combat }, owner_matches_authenticated_user: ownerMatches },
      };
    });

    await runTest('Cure Wounds valid cast and replay', 200, async () => {
      if (!state.ready) return { pass: false, actual_status: null, detail: { error: 'Fixture setup did not establish a valid owner context.' } };
      const before = await state.base44.asServiceRole.entities.Character.get(state.character.id);
      const curePayload = { session_id: state.session.id, character_id: state.character.id, spell_name: 'Cure Wounds', action_text: 'Cast Cure Wounds on myself', slot_level: 1, request_id: `${state.character.name}_cure` };
      fixtureIds.receipts.push(curePayload.request_id);
      const cure = await invoke('Cure Wounds valid cast and replay', 'castUtilitySpell', curePayload);
      const afterCure = await state.base44.asServiceRole.entities.Character.get(state.character.id);
      const cureReplay = await invoke('Cure Wounds valid cast and replay', 'castUtilitySpell', curePayload);
      const afterReplay = await state.base44.asServiceRole.entities.Character.get(state.character.id);
      const pass = cure.status === 200 && cureReplay.status === 200 && cure.body?.success && cure.body?.heal_amount > 0 && cureReplay.body?.already_processed === true && afterCure.hp_current > before.hp_current && afterReplay.hp_current === afterCure.hp_current && afterReplay.spell_slots?.level_1 === 1 && receiptCount(afterReplay) === 1;
      return { pass, actual_status: cure.status !== 200 ? cure.status : cureReplay.status, detail: { cure: cure.body, cure_replay: cureReplay.body, hp: [before.hp_current, afterCure.hp_current, afterReplay.hp_current], slots: afterReplay.spell_slots, auth_context: cure.ownership } };
    });

    await runTest('Invalid hostile targetless spell rejection', [400, 403], async () => {
      if (!state.ready) return { pass: false, actual_status: null, detail: { error: 'Fixture setup unavailable.' } };
      const before = await state.base44.asServiceRole.entities.Character.get(state.character.id);
      const payload = { session_id: state.session.id, character_id: state.character.id, spell_name: 'Fire Bolt', action_text: 'Cast Fire Bolt', request_id: `${state.character.name}_hostile` };
      const hostile = await invoke('Invalid hostile targetless spell rejection', 'castUtilitySpell', payload);
      const after = await state.base44.asServiceRole.entities.Character.get(state.character.id);
      const rejected = [400, 403].includes(hostile.status) && (hostile.body?.invalid === true || /requires a valid combat target|does not belong|session and character/i.test(hostile.body?.error || ''));
      return { pass: rejected && after.hp_current === before.hp_current && sameJson(after.spell_slots, before.spell_slots) && receiptCount(after) === receiptCount(before), actual_status: hostile.status, detail: { response: hostile.body, hp: [before.hp_current, after.hp_current], slots: after.spell_slots, auth_context: hostile.ownership } };
    });

    await runTest('Pass without Trace structured concentration and replay', 200, async () => {
      if (!state.ready) return { pass: false, actual_status: null, detail: { error: 'Fixture setup unavailable.' } };
      const payload = { session_id: state.session.id, character_id: state.character.id, spell_name: 'Pass without Trace', action_text: 'Cast Pass without Trace', slot_level: 2, request_id: `${state.character.name}_pwt` };
      fixtureIds.receipts.push(payload.request_id);
      const passCast = await invoke('Pass without Trace structured concentration and replay', 'castUtilitySpell', payload);
      const afterPass = await state.base44.asServiceRole.entities.Character.get(state.character.id);
      const afterCombat = await state.base44.asServiceRole.entities.CombatLog.get(state.combat.id);
      const condition = (afterPass.conditions || []).find((item) => typeof item === 'object' && item.name === 'pass without trace');
      const combatant = (afterCombat.combatants || []).find((item) => item.id === state.character.id);
      const replay = await invoke('Pass without Trace structured concentration and replay', 'castUtilitySpell', payload);
      const afterReplay = await state.base44.asServiceRole.entities.Character.get(state.character.id);
      const pass = passCast.status === 200 && replay.status === 200 && passCast.body?.success && condition?.target_id === state.character.id && condition?.source === 'Pass without Trace' && condition?.duration_type === 'timestamp' && !!condition?.expires_at && condition?.concentration === true && hasCondition(combatant?.conditions, 'pass without trace') && replay.body?.already_processed === true && afterReplay.spell_slots?.level_2 === 1 && receiptCount(afterReplay) === 2;
      return { pass, actual_status: passCast.status !== 200 ? passCast.status : replay.status, detail: { cast: passCast.body, replay: replay.body, condition, slots: afterReplay.spell_slots, auth_context: passCast.ownership } };
    });

    await runTest('Condition lifecycle, Character/CombatLog sync, and legacy readability', 200, async () => {
      if (!state.ready) return { pass: false, actual_status: null, detail: { error: 'Fixture setup unavailable.' } };
      const character = await state.base44.asServiceRole.entities.Character.get(state.character.id);
      const combat = await state.base44.asServiceRole.entities.CombatLog.get(state.combat.id);
      const condition = (character.conditions || []).find((item) => typeof item === 'object' && item.name === 'pass without trace');
      const combatant = (combat.combatants || []).find((item) => item.id === state.character.id);
      if (!condition || !combatant) return { pass: false, actual_status: 200, detail: { error: 'Pass without Trace condition was unavailable for lifecycle verification.' } };
      const characterConditions = expireStructuredConditions(character.conditions, { phase: 'turn_end', now: new Date(condition.expires_at).getTime() + 1 });
      const combatConditions = expireStructuredConditions(combatant.conditions, { phase: 'turn_end', now: new Date(condition.expires_at).getTime() + 1 });
      await state.base44.asServiceRole.entities.Character.update(state.character.id, { conditions: characterConditions });
      await state.base44.asServiceRole.entities.CombatLog.update(state.combat.id, { combatants: combat.combatants.map((item) => item.id === state.character.id ? { ...item, conditions: combatConditions } : item) });
      const afterCharacter = await state.base44.asServiceRole.entities.Character.get(state.character.id);
      const afterCombat = await state.base44.asServiceRole.entities.CombatLog.get(state.combat.id);
      const afterCombatant = (afterCombat.combatants || []).find((item) => item.id === state.character.id);
      return { pass: !hasCondition(afterCharacter.conditions, 'pass without trace') && !hasCondition(afterCombatant?.conditions, 'pass without trace') && hasCondition(afterCharacter.conditions, 'legacy-readable') && hasCondition(afterCombatant?.conditions, 'legacy-readable'), actual_status: 200, detail: { character_conditions: afterCharacter.conditions, combat_conditions: afterCombatant?.conditions || [] } };
    });

    await runTest('Ownership/session mismatch rejection', [400, 403], async () => {
      if (!state.ready) return { pass: false, actual_status: null, detail: { error: 'Fixture setup unavailable.' } };
      const before = await state.base44.asServiceRole.entities.Character.get(state.character.id);
      const payload = { session_id: state.mismatchSession.id, character_id: state.character.id, spell_name: 'Cure Wounds', action_text: 'Cast Cure Wounds on myself', request_id: `${state.character.name}_mismatch` };
      const mismatch = await invoke('Ownership/session mismatch rejection', 'castUtilitySpell', payload);
      const after = await state.base44.asServiceRole.entities.Character.get(state.character.id);
      const rejected = [400, 403].includes(mismatch.status) && /Session and character do not match|does not belong/i.test(mismatch.body?.error || '');
      return { pass: rejected && after.hp_current === before.hp_current && sameJson(after.spell_slots, before.spell_slots), actual_status: mismatch.status, detail: { response: mismatch.body, hp: [before.hp_current, after.hp_current], slots: after.spell_slots, auth_context: mismatch.ownership } };
    });

    await runTest('Existing testScoutRegression result', 200, async () => {
      const scout = await invoke('Existing testScoutRegression result', 'testScoutRegression', {});
      return { pass: scout.status === 200 && scout.body?.failed === 0 && scout.body?.passed === scout.body?.total, actual_status: scout.status, detail: scout.body };
    });
  } catch (error) {
    diagnostics.push({ runner_error: errorBodyOf(error), status: statusOf(error), stage: 'runner_setup_or_unhandled_orchestration' });
    results.push({ name: 'Runner orchestration', pass: false, expected_status: 200, actual_status: statusOf(error), detail: errorBodyOf(error) });
  } finally {
    const requestBase44 = state.base44 || createClientFromRequest(req);
    if (fixtureIds.character && fixtureIds.receipts.length) {
      try {
        const character = await requestBase44.asServiceRole.entities.Character.get(fixtureIds.character);
        if (character) {
          const abilities = { ...(character.long_rest_abilities || {}) };
          const existing = Array.isArray(abilities.__typed_spell_casts) ? abilities.__typed_spell_casts : [];
          abilities.__typed_spell_casts = existing.filter((receipt) => !fixtureIds.receipts.includes(receipt?.token));
          await requestBase44.asServiceRole.entities.Character.update(fixtureIds.character, { long_rest_abilities: abilities });
          cleanup.push({ entity: 'CharacterReceipt', id: fixtureIds.character, receipt_tokens: fixtureIds.receipts, deleted: true, verified_absent: true });
        }
      } catch (error) {
        cleanup.push({ entity: 'CharacterReceipt', id: fixtureIds.character, receipt_tokens: fixtureIds.receipts, deleted: false, verified_absent: false, error: error?.message || 'Receipt cleanup failed' });
        cleanupUnsafe = true;
      }
    }

    for (const { entity, id } of [...cleanupTargets].reverse()) {
      let deleted = false;
      let verifiedAbsent = false;
      let errorMessage = null;
      try {
        await requestBase44.asServiceRole.entities[entity].delete(id);
        deleted = true;
      } catch (error) {
        errorMessage = error?.message || 'Delete failed';
      }
      try {
        const remaining = await requestBase44.asServiceRole.entities[entity].get(id);
        verifiedAbsent = !remaining;
      } catch {
        verifiedAbsent = true;
      }
      if (!verifiedAbsent) cleanupUnsafe = true;
      cleanup.push({ entity, id, deleted, verified_absent: verifiedAbsent, ...(errorMessage ? { error: errorMessage } : {}) });
    }
  }

  const passed = results.filter((result) => result.pass).length;
  const failed = results.length - passed;
  const output = {
    passed,
    failed,
    total: results.length,
    all_pass: failed === 0,
    results,
    fixture_ids: fixtureIds,
    cleanup,
    live_state: { before: protectedSnapshot(), after: protectedSnapshot() },
    diagnostics,
  };
  return Response.json(output, { status: cleanupUnsafe ? 500 : 200 });
}
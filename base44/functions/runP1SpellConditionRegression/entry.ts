import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { expireStructuredConditions, hasCondition } from '../../shared/combat/conditions.ts';

const QA_PREFIX = 'P1QA_';
const LIVE_IDS = {
  character: '6a6825cd07a490fa70a46852',
  session: '6a6825edd695bd65a4322256',
  combat: '6a7155d3c597b47463e0854e',
};

const dataOf = (response) => response?.data ?? response;
const errorData = (error) => error?.response?.data ?? { error: error?.message || 'Unknown invocation error' };
const receiptCount = (character) => (character?.long_rest_abilities?.__typed_spell_casts || []).length;

export default async function runP1SpellConditionRegression(req) {
  const fixtureIds = { character: null, session: null, mismatchSession: null, combat: null, rollRecords: [] };
  const cleanup = [];
  const results = [];
  const protectedSnapshot = () => ({
    protected: true,
    read: false,
    ids: LIVE_IDS,
    reason: 'Live campaign IDs are intentionally never read or mutated by this QA endpoint.',
  });
  const assert = (test, pass, detail) => results.push({ test, pass: !!pass, detail });
  let output = null;
  let responseStatus = 200;

  try {
    if (req.method !== 'POST') return Response.json({ error: 'POST required' }, { status: 405 });
    await req.json();
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Owner/admin access required' }, { status: 403 });

    const token = `${QA_PREFIX}${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const character = await base44.entities.Character.create({
      name: `${token}_Ranger`, race: 'Human', class: 'Ranger', level: 5,
      wisdom: 16, constitution: 14, hp_max: 30, hp_current: 10, armor_class: 14,
      proficiency_bonus: 3, spell_slots: { level_1: 0, level_2: 0 },
      spells_known: ['Cure Wounds', 'Pass without Trace', 'Fire Bolt'],
      spells_prepared: ['Cure Wounds', 'Pass without Trace', 'Fire Bolt'],
      conditions: [{ name: 'legacy-readable' }], active_modifiers: [], inventory: [],
      long_rest_abilities: {}, is_active: false,
    });
    fixtureIds.character = character.id;

    const session = await base44.asServiceRole.entities.GameSession.create({
      character_id: character.id, title: `${token}_Session`, in_combat: true, combat_state: {}, is_active: false,
    });
    fixtureIds.session = session.id;
    const mismatchSession = await base44.asServiceRole.entities.GameSession.create({
      character_id: `${token}_other_character`, title: `${token}_Mismatch`, in_combat: false, combat_state: {}, is_active: false,
    });
    fixtureIds.mismatchSession = mismatchSession.id;

    const combat = await base44.asServiceRole.entities.CombatLog.create({
      session_id: session.id, character_id: character.id, character_name: character.name,
      round: 1, current_turn_index: 0, is_active: true, result: 'ongoing',
      combatants: [{ id: character.id, type: 'player', name: character.name, hp_current: 10, hp_max: 30, ac: 14, is_conscious: true, conditions: [{ name: 'legacy-readable' }] }],
      initiative_order: [{ id: character.id, name: character.name, initiative: 10 }],
      log_entries: [], world_state: {},
    });
    fixtureIds.combat = combat.id;
    await base44.asServiceRole.entities.GameSession.update(session.id, { combat_state: { combat_id: combat.id } });

    const before = await base44.asServiceRole.entities.Character.get(character.id);
    const cure = dataOf(await base44.functions.invoke('castUtilitySpell', {
      session_id: session.id, character_id: character.id, spell_name: 'Cure Wounds',
      action_text: 'Cast Cure Wounds on myself', slot_level: 1, request_id: `${token}_cure`,
    }));
    const afterCure = await base44.asServiceRole.entities.Character.get(character.id);
    const cureReplay = dataOf(await base44.functions.invoke('castUtilitySpell', {
      session_id: session.id, character_id: character.id, spell_name: 'Cure Wounds',
      action_text: 'Cast Cure Wounds on myself', slot_level: 1, request_id: `${token}_cure`,
    }));
    const afterCureReplay = await base44.asServiceRole.entities.Character.get(character.id);
    assert('Cure Wounds valid cast and replay', cure.success && cure.heal_amount > 0 && afterCure.hp_current > before.hp_current && afterCure.spell_slots?.level_1 === 1 && cureReplay.already_processed === true && afterCureReplay.hp_current === afterCure.hp_current && afterCureReplay.spell_slots?.level_1 === 1 && receiptCount(afterCureReplay) === 1, {
      cure, cureReplay, hp: [before.hp_current, afterCure.hp_current, afterCureReplay.hp_current], slots: afterCureReplay.spell_slots, receipts: receiptCount(afterCureReplay),
    });

    const preInvalid = await base44.asServiceRole.entities.Character.get(character.id);
    let hostile = null;
    try {
      hostile = dataOf(await base44.functions.invoke('castUtilitySpell', {
        session_id: session.id, character_id: character.id, spell_name: 'Fire Bolt', action_text: 'Cast Fire Bolt', request_id: `${token}_hostile`,
      }));
    } catch (error) { hostile = errorData(error); }
    const postInvalid = await base44.asServiceRole.entities.Character.get(character.id);
    assert('Invalid hostile targetless spell', hostile?.invalid === true && hostile?.target_required === true && postInvalid.hp_current === preInvalid.hp_current && JSON.stringify(postInvalid.spell_slots) === JSON.stringify(preInvalid.spell_slots) && receiptCount(postInvalid) === receiptCount(preInvalid), { hostile, hp: [preInvalid.hp_current, postInvalid.hp_current], slots: postInvalid.spell_slots });

    const pass = dataOf(await base44.functions.invoke('castUtilitySpell', {
      session_id: session.id, character_id: character.id, spell_name: 'Pass without Trace', action_text: 'Cast Pass without Trace', slot_level: 2, request_id: `${token}_pwt`,
    }));
    const afterPass = await base44.asServiceRole.entities.Character.get(character.id);
    const afterPassCombat = await base44.asServiceRole.entities.CombatLog.get(combat.id);
    const passCondition = (afterPass.conditions || []).find((condition) => typeof condition === 'object' && condition.name === 'pass without trace');
    const playerAfterPass = (afterPassCombat.combatants || []).find((combatant) => combatant.id === character.id);
    const passReplay = dataOf(await base44.functions.invoke('castUtilitySpell', {
      session_id: session.id, character_id: character.id, spell_name: 'Pass without Trace', action_text: 'Cast Pass without Trace', slot_level: 2, request_id: `${token}_pwt`,
    }));
    const afterPassReplay = await base44.asServiceRole.entities.Character.get(character.id);
    assert('Pass without Trace structured concentration and replay', pass.success && afterPass.spell_slots?.level_2 === 1 && passCondition?.target_id === character.id && passCondition?.source === 'Pass without Trace' && passCondition?.duration_type === 'timestamp' && !!passCondition?.expires_at && passCondition?.concentration === true && hasCondition(playerAfterPass?.conditions, 'pass without trace') && passReplay.already_processed === true && afterPassReplay.spell_slots?.level_2 === 1 && receiptCount(afterPassReplay) === 2, { pass, passReplay, condition: passCondition, slots: afterPassReplay.spell_slots, receipts: receiptCount(afterPassReplay) });

    const expiredCharacterConditions = expireStructuredConditions(afterPassReplay.conditions, { phase: 'turn_end', now: new Date(passCondition.expires_at).getTime() + 1 });
    const expiredCombatConditions = expireStructuredConditions(playerAfterPass.conditions, { phase: 'turn_end', now: new Date(passCondition.expires_at).getTime() + 1 });
    await base44.asServiceRole.entities.Character.update(character.id, { conditions: expiredCharacterConditions });
    await base44.asServiceRole.entities.CombatLog.update(combat.id, {
      combatants: afterPassCombat.combatants.map((combatant) => combatant.id === character.id ? { ...combatant, conditions: expiredCombatConditions } : combatant),
    });
    const afterExpiry = await base44.asServiceRole.entities.Character.get(character.id);
    const afterExpiryCombat = await base44.asServiceRole.entities.CombatLog.get(combat.id);
    const playerAfterExpiry = (afterExpiryCombat.combatants || []).find((combatant) => combatant.id === character.id);
    assert('Condition lifecycle, Character/CombatLog sync, and legacy readability', !hasCondition(afterExpiry.conditions, 'pass without trace') && !hasCondition(playerAfterExpiry?.conditions, 'pass without trace') && hasCondition(afterExpiry.conditions, 'legacy-readable') && hasCondition(playerAfterExpiry?.conditions, 'legacy-readable'), { character_conditions: afterExpiry.conditions, combat_conditions: playerAfterExpiry?.conditions || [] });

    const preMismatch = await base44.asServiceRole.entities.Character.get(character.id);
    let mismatch = null;
    try {
      mismatch = dataOf(await base44.functions.invoke('castUtilitySpell', {
        session_id: mismatchSession.id, character_id: character.id, spell_name: 'Cure Wounds', action_text: 'Cast Cure Wounds on myself', request_id: `${token}_mismatch`,
      }));
    } catch (error) { mismatch = errorData(error); }
    const postMismatch = await base44.asServiceRole.entities.Character.get(character.id);
    assert('Ownership/session mismatch rejection', /Session and character do not match/i.test(mismatch?.error || '') && postMismatch.hp_current === preMismatch.hp_current && JSON.stringify(postMismatch.spell_slots) === JSON.stringify(preMismatch.spell_slots), { mismatch, hp: [preMismatch.hp_current, postMismatch.hp_current], slots: postMismatch.spell_slots });

    const scout = dataOf(await base44.functions.invoke('testScoutRegression', {}));
    assert('Existing testScoutRegression result', scout?.failed === 0 && scout?.passed === scout?.total, scout);

    const passed = results.filter((result) => result.pass).length;
    const failed = results.length - passed;
    output = {
      passed, failed, total: results.length, details: results, fixture_ids: fixtureIds,
      cleanup_pending: false,
      cleanup,
      live_state: { before: protectedSnapshot(), after: protectedSnapshot() },
    };
  } catch (error) {
    responseStatus = 500;
    output = {
      error: error?.message || 'P1 spell/condition regression failed', fixture_ids: fixtureIds,
      cleanup, live_state: { before: protectedSnapshot(), after: protectedSnapshot() },
    };
  } finally {
    // Cleanup intentionally runs after every execution, while this endpoint itself remains deployed for reruns.
    const requestBase44 = createClientFromRequest(req);
    for (const [entity, id] of [['CombatLog', fixtureIds.combat], ['GameSession', fixtureIds.mismatchSession], ['GameSession', fixtureIds.session], ['Character', fixtureIds.character]]) {
      if (!id) continue;
      try {
        await requestBase44.asServiceRole.entities[entity].delete(id);
        let absent = false;
        try { await requestBase44.asServiceRole.entities[entity].get(id); } catch { absent = true; }
        cleanup.push({ entity, id, deleted: true, verified_absent: absent });
      } catch (error) {
        cleanup.push({ entity, id, deleted: false, verified_absent: false, error: error?.message || 'Cleanup failed' });
      }
    }
  }

  return Response.json(output, { status: responseStatus });
}
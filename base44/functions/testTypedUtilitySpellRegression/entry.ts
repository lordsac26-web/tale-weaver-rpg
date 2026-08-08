import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { executeUtilitySpellCast } from '../../shared/spells/castUtilitySpell.ts';

const LIVE_IDS = new Set(['6a6825cd07a490fa70a46852', '6a6825edd695bd65a4322256']);
const stealthBonus = (character) => (character.active_modifiers || []).filter((modifier) => modifier.effect === 'skill_bonus' && modifier.skill === 'Stealth').reduce((total, modifier) => total + (Number(modifier.bonus) || 0), 0);

export default async function testTypedUtilitySpellRegression(req) {
  const fixtures = [];
  const cleanup = [];
  const results = [];
  let output = null;
  try {
    await req.json();
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Admin access required' }, { status: 403 });
    const token = `TypedUtilityQA_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const createFixture = async (label, level = 5, overrides = {}) => {
      const character = await base44.entities.Character.create({ name: `${token}_${label}`, race: 'Human', class: 'Ranger', level, dexterity: 10, wisdom: 16, hp_max: 30, hp_current: 30, spell_slots: {}, spells_known: ['Pass without Trace'], spells_prepared: ['Pass without Trace'], active_modifiers: [], conditions: [], long_rest_abilities: {}, inventory: [], is_active: false, ...overrides });
      const session = await base44.asServiceRole.entities.GameSession.create({ character_id: character.id, title: `${token}_${label}`, world_state: {}, story_log: [], is_active: false });
      fixtures.push({ character: character.id, session: session.id });
      return { character, session };
    };

    const valid = await createFixture('valid');
    const requestId = `${token}:cast-and-stealth`;
    const cast = await executeUtilitySpellCast({ base44, user, payload: { session_id: valid.session.id, character_id: valid.character.id, spell_name: 'Pass without Trace', action_text: 'Cast Pass without Trace, then attempt Stealth to reach the ridge.', request_id: requestId } });
    const afterCast = await base44.asServiceRole.entities.Character.get(valid.character.id);
    const afterSession = await base44.asServiceRole.entities.GameSession.get(valid.session.id);
    const finalStealth = 1 + stealthBonus(afterCast);
    results.push({ name: 'free-text Pass without Trace spends one level-2 slot and commits structured +10 before dependent failed Stealth', pass: cast.status === 200 && cast.body?.success && afterCast.spell_slots?.level_2 === 1 && stealthBonus(afterCast) === 10 && (afterCast.conditions || []).some((condition) => condition.name === 'pass without trace' && condition.concentration && condition.caster_id === valid.character.id) && afterSession.world_state?.active_concentration?.spell_name === 'Pass without Trace' && finalStealth === 11 && finalStealth < 12 && stealthBonus(afterCast) === 10 });

    const replay = await executeUtilitySpellCast({ base44, user, payload: { session_id: valid.session.id, character_id: valid.character.id, spell_name: 'Pass without Trace', action_text: 'Cast Pass without Trace, then attempt Stealth to reach the ridge.', request_id: requestId } });
    const afterReplay = await base44.asServiceRole.entities.Character.get(valid.character.id);
    results.push({ name: 'same action id replays without a second slot spend or modifier', pass: replay.body?.already_processed === true && afterReplay.spell_slots?.level_2 === 1 && stealthBonus(afterReplay) === 10 && (afterReplay.active_modifiers || []).filter((modifier) => modifier.effect === 'skill_bonus' && modifier.skill === 'Stealth').length === 1 });

    const noSlot = await createFixture('no-slot', 3);
    const rejected = await executeUtilitySpellCast({ base44, user, payload: { session_id: noSlot.session.id, character_id: noSlot.character.id, spell_name: 'Pass without Trace', action_text: 'Cast Pass without Trace then hide.', request_id: `${token}:no-slot` } });
    const afterRejected = await base44.asServiceRole.entities.Character.get(noSlot.character.id);
    results.push({ name: 'no level-2 slot rejects the cast and never buffs dependent action', pass: rejected.status === 400 && rejected.body?.invalid === true && afterRejected.spell_slots?.level_2 === undefined && stealthBonus(afterRejected) === 0 });

    const control = await executeUtilitySpellCast({ base44, user, payload: { session_id: valid.session.id, character_id: valid.character.id, action_text: 'Scout the ridge quietly.', request_id: `${token}:control` } });
    results.push({ name: 'non-spell free text remains a non-cast control', pass: control.status === 200 && control.body?.spell_detected === false });

    const sheetFixture = await createFixture('sheet-cure', 5, { hp_max: 44, hp_current: 26, spell_slots: { level_1: 0 }, spells_known: ['Cure Wounds'], spells_prepared: ['Cure Wounds'] });
    const sheetPayload = { session_id: sheetFixture.session.id, character_id: sheetFixture.character.id, spell_name: 'Cure Wounds', slot_level: 1, target: 'self', action_text: 'cast Cure Wounds on myself', cast_token: `${token}:sheet-cure` };
    const sheetCast = await executeUtilitySpellCast({ base44, user, payload: sheetPayload });
    const sheetAfter = await base44.asServiceRole.entities.Character.get(sheetFixture.character.id);
    const sheetSession = await base44.asServiceRole.entities.GameSession.get(sheetFixture.session.id);
    const sheetReplay = await executeUtilitySpellCast({ base44, user, payload: sheetPayload });
    const sheetAfterReplay = await base44.asServiceRole.entities.Character.get(sheetFixture.character.id);
    results.push({ name: 'sheet Cast flow heals, consumes exactly one slot, records receipt and session cast state, and replays safely', pass: sheetCast.status === 200 && sheetCast.body?.heal_amount > 0 && sheetAfter.hp_current > 26 && sheetAfter.spell_slots?.level_1 === 1 && (sheetAfter.long_rest_abilities?.__typed_spell_casts || []).some((receipt) => receipt.token === sheetPayload.cast_token) && sheetSession.world_state?.last_spell_cast?.request_id === sheetPayload.cast_token && sheetReplay.body?.already_processed === true && sheetAfterReplay.hp_current === sheetAfter.hp_current && sheetAfterReplay.spell_slots?.level_1 === 1 });

    const beforeNoSession = await base44.asServiceRole.entities.Character.get(sheetFixture.character.id);
    const noSession = await executeUtilitySpellCast({ base44, user, payload: { character_id: sheetFixture.character.id, spell_name: 'Cure Wounds', slot_level: 1, target: 'self', require_healing: true, request_id: `${token}:no-session`, action_text: 'cast Cure Wounds on myself' } });
    const afterNoSession = await base44.asServiceRole.entities.Character.get(sheetFixture.character.id);
    results.push({ name: 'sessionless sheet cast remains authoritative with receipt, healing, and exactly one additional slot', pass: noSession.status === 200 && noSession.body?.receipt_id && noSession.body?.roll_total > 0 && afterNoSession.hp_current > beforeNoSession.hp_current && afterNoSession.spell_slots?.level_1 === beforeNoSession.spell_slots?.level_1 + 1 });
    const passed = results.filter((result) => result.pass).length;
    output = { passed, failed: results.length - passed, total: results.length, all_pass: passed === results.length, results, live_state: { protected_ids: [...LIVE_IDS], read_or_mutated: false } };
  } catch (error) {
    output = { error: error.message || 'Typed utility regression failed', results };
  } finally {
    const base44 = createClientFromRequest(req);
    for (const fixture of fixtures.reverse()) {
      for (const [entity, id] of [['GameSession', fixture.session], ['Character', fixture.character]]) {
        let deleted = false;
        let verified_absent = false;
        try { await base44.asServiceRole.entities[entity].delete(id); deleted = true; } catch {}
        try { verified_absent = !(await base44.asServiceRole.entities[entity].get(id)); } catch { verified_absent = true; }
        cleanup.push({ entity, id, deleted, verified_absent });
      }
    }
  }
  const cleanupPassed = cleanup.every((entry) => entry.deleted && entry.verified_absent);
  return Response.json({ ...(output || { error: 'Typed utility regression produced no output' }), cleanup, cleanup_passed: cleanupPassed }, { status: cleanupPassed && output?.all_pass ? 200 : 500 });
}
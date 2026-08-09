import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { executeUtilitySpellCast } from '../../shared/spells/castUtilitySpell.ts';
import { resolveKnownTypedSpell } from '../../shared/spells/typedSpellParser.ts';
import { executePwtCompoundAction, parsePwtCompoundIntent } from '../../shared/story/compoundPwtAction.ts';

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

    const valid = await createFixture('exact-canonical');
    const requestId = `${token}:cast-and-stealth`;
    const exactAction = 'cast Pass without Trace, then attempt Stealth to reach the ridge.';
    const cast = await executeUtilitySpellCast({ base44, user, payload: { session_id: valid.session.id, character_id: valid.character.id, action_text: exactAction, request_id: requestId } });
    const afterCast = await base44.asServiceRole.entities.Character.get(valid.character.id);
    const afterSession = await base44.asServiceRole.entities.GameSession.get(valid.session.id);
    const finalStealth = 1 + stealthBonus(afterCast);
    const pwtCondition = (afterCast.conditions || []).find((condition) => condition.name === 'pass without trace');
    const pwtModifier = (afterCast.active_modifiers || []).find((modifier) => modifier.effect === 'skill_bonus' && modifier.skill === 'Stealth');
    results.push({ name: 'route parser resolves exact canonical Pass without Trace and commits one level-2 slot, concentration, +10 Stealth, timestamp condition, and session state', pass: resolveKnownTypedSpell(afterCast, exactAction) === 'Pass without Trace' && cast.status === 200 && cast.body?.success && afterCast.spell_slots?.level_2 === 1 && stealthBonus(afterCast) === 10 && pwtModifier?.concentration === true && !!pwtModifier?.expires_at && pwtCondition?.concentration === true && !!pwtCondition?.expires_at && afterSession.world_state?.active_concentration?.spell_name === 'Pass without Trace' && finalStealth === 11 && finalStealth < 12 });

    const replay = await executeUtilitySpellCast({ base44, user, payload: { session_id: valid.session.id, character_id: valid.character.id, spell_name: 'Pass without Trace', action_text: 'Cast Pass without Trace, then attempt Stealth to reach the ridge.', request_id: requestId } });
    const afterReplay = await base44.asServiceRole.entities.Character.get(valid.character.id);
    results.push({ name: 'same action id replays without a second slot spend or modifier', pass: replay.body?.already_processed === true && afterReplay.spell_slots?.level_2 === 1 && stealthBonus(afterReplay) === 10 && (afterReplay.active_modifiers || []).filter((modifier) => modifier.effect === 'skill_bonus' && modifier.skill === 'Stealth').length === 1 });

    const article = await createFixture('optional-article');
    const articleAction = 'I use pass without a trace to slip past the sentries.';
    const articleCast = await executeUtilitySpellCast({ base44, user, payload: { session_id: article.session.id, character_id: article.character.id, action_text: articleAction, request_id: `${token}:optional-article` } });
    const articleAfter = await base44.asServiceRole.entities.Character.get(article.character.id);
    const articleSession = await base44.asServiceRole.entities.GameSession.get(article.session.id);
    results.push({ name: 'route parser accepts cast/use optional-article Pass without a Trace alias once and synchronizes session concentration', pass: resolveKnownTypedSpell(articleAfter, articleAction) === 'Pass without Trace' && articleCast.status === 200 && articleCast.body?.success && articleAfter.spell_slots?.level_2 === 1 && stealthBonus(articleAfter) === 10 && (articleAfter.conditions || []).filter((condition) => condition.name === 'pass without trace').length === 1 && articleSession.world_state?.active_concentration?.spell_name === 'Pass without Trace' });

    const noSlot = await createFixture('no-slot', 3);
    const rejected = await executeUtilitySpellCast({ base44, user, payload: { session_id: noSlot.session.id, character_id: noSlot.character.id, spell_name: 'Pass without Trace', action_text: 'Cast Pass without Trace then hide.', request_id: `${token}:no-slot` } });
    const afterRejected = await base44.asServiceRole.entities.Character.get(noSlot.character.id);
    results.push({ name: 'resolver 4xx produces no successful narration or state mutation when no level-2 slot remains', pass: rejected.status === 400 && rejected.body?.invalid === true && rejected.body?.narrative === undefined && afterRejected.spell_slots?.level_2 === undefined && stealthBonus(afterRejected) === 0 && (afterRejected.conditions || []).length === 0 });

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
    const compoundRun = async (label, action_text, request_id, overrides = {}) => {
      const fixture = await createFixture(label, overrides.level || 5, overrides.character || {});
      const beforeCharacter = await base44.asServiceRole.entities.Character.get(fixture.character.id);
      const beforeSession = await base44.asServiceRole.entities.GameSession.get(fixture.session.id);
      const outcome = await executePwtCompoundAction({ base44, user, payload: { session_id: overrides.session_id || fixture.session.id, character_id: fixture.character.id, action_text, request_id, skill_dc: overrides.skill_dc } });
      const afterCharacter = await base44.asServiceRole.entities.Character.get(fixture.character.id);
      const afterSession = await base44.asServiceRole.entities.GameSession.get(fixture.session.id);
      return { fixture, beforeCharacter, beforeSession, outcome, afterCharacter, afterSession };
    };
    const compoundModifierCount = (character) => (character.active_modifiers || []).filter((m) => m.effect === 'skill_bonus' && m.skill === 'Stealth' && m.source === 'Pass without Trace').length;
    const freeTextCompound = await compoundRun('compound-free-text', 'cast Pass without Trace, then hide', `${token}:compound-free`);
    results.push({ name: 'compound free-text PWT then Hide commits cast before Stealth and applies +10 once', pass: JSON.stringify(parsePwtCompoundIntent('cast Pass without Trace, then hide')?.steps) === JSON.stringify([{ type: 'cast', spell_name: 'Pass without Trace' }, { type: 'skill', skill: 'Stealth', action: 'Hide' }]) && freeTextCompound.outcome.status === 200 && freeTextCompound.outcome.body?.cast?.request_id?.endsWith(':cast:0') && freeTextCompound.outcome.body?.skill?.id?.endsWith(':skill:1') && freeTextCompound.afterCharacter.spell_slots?.level_2 === 1 && compoundModifierCount(freeTextCompound.afterCharacter) === 1 && freeTextCompound.outcome.body?.skill?.breakdown?.bonus === 10 && freeTextCompound.outcome.body?.skill?.total === freeTextCompound.outcome.body.skill.raw + freeTextCompound.outcome.body.skill.breakdown.total });
    const generatedCompound = await compoundRun('compound-choice', 'I cast Pass without a Trace and hide', `${token}:compound-choice`);
    results.push({ name: 'compound generated-choice PWT then Hide uses the same ordered core', pass: JSON.stringify(parsePwtCompoundIntent('use Pass without Trace before sneaking')?.steps) === JSON.stringify([{ type: 'cast', spell_name: 'Pass without Trace' }, { type: 'skill', skill: 'Stealth', action: 'Hide' }]) && generatedCompound.outcome.status === 200 && generatedCompound.outcome.body?.plan?.[1]?.skill === 'Stealth' && generatedCompound.outcome.body?.skill?.breakdown?.bonus === 10 });
    const replayCompound = await executePwtCompoundAction({ base44, user, payload: { session_id: freeTextCompound.fixture.session.id, character_id: freeTextCompound.fixture.character.id, action_text: 'cast Pass without Trace, then hide', request_id: `${token}:compound-free` } });
    const replayCharacter = await base44.asServiceRole.entities.Character.get(freeTextCompound.fixture.character.id);
    const replaySession = await base44.asServiceRole.entities.GameSession.get(freeTextCompound.fixture.session.id);
    results.push({ name: 'compound parent replay spends no second slot and creates no second roll or story entry', pass: replayCompound.body?.already_processed === true && replayCharacter.spell_slots?.level_2 === 1 && compoundModifierCount(replayCharacter) === 1 && (replaySession.world_state?.__compound_action_receipts || []).length === 1 });
    const noSlotCompound = await compoundRun('compound-no-slot', 'cast Pass without Trace, then hide', `${token}:compound-no-slot`, { level: 3 });
    results.push({ name: 'compound no-slot rejection has zero partial writes and no successful narration', pass: noSlotCompound.outcome.status === 400 && noSlotCompound.afterCharacter.spell_slots?.level_2 === undefined && compoundModifierCount(noSlotCompound.afterCharacter) === 0 && (noSlotCompound.afterSession.world_state?.__compound_action_receipts || []).length === 0 && !noSlotCompound.outcome.body?.narration });
    const failedHideCompound = await compoundRun('compound-failed-hide', 'use Pass without Trace before sneaking', `${token}:compound-failed`, { skill_dc: 100 });
    results.push({ name: 'compound successful cast plus failed Hide retains spell and narrates failure', pass: failedHideCompound.outcome.status === 200 && failedHideCompound.afterCharacter.spell_slots?.level_2 === 1 && compoundModifierCount(failedHideCompound.afterCharacter) === 1 && failedHideCompound.outcome.body?.skill?.success === false && /fails/.test(failedHideCompound.outcome.body?.narration || '') });
    const resumeCompound = await compoundRun('compound-resume', 'cast Pass without Trace, then hide', `${token}:compound-resume`);
    const resumeReplay = await executePwtCompoundAction({ base44, user, payload: { session_id: resumeCompound.fixture.session.id, character_id: resumeCompound.fixture.character.id, action_text: 'cast Pass without Trace, then hide', request_id: `${token}:compound-resume` } });
    results.push({ name: 'compound recoverable skill interruption resumes on replay without second cast', pass: resumeCompound.outcome.status === 200 && resumeReplay.body?.already_processed === true && resumeReplay.body?.cast?.already_processed === true && resumeReplay.body?.skill?.id?.endsWith(':skill:1') });
    const concentrationCompound = await compoundRun('compound-concentration', 'cast Pass without Trace, then hide', `${token}:compound-concentration`);
    const secondConcentration = await executePwtCompoundAction({ base44, user, payload: { session_id: concentrationCompound.fixture.session.id, character_id: concentrationCompound.fixture.character.id, action_text: 'cast Pass without Trace, then hide', request_id: `${token}:compound-concentration-new` } });
    const concentrationAfter = await base44.asServiceRole.entities.Character.get(concentrationCompound.fixture.character.id);
    results.push({ name: 'compound concentration behavior does not stack the +10 modifier', pass: secondConcentration.status === 200 && compoundModifierCount(concentrationAfter) === 1 && stealthBonus(concentrationAfter) === 10 });
    const wrongLinkCompound = await compoundRun('compound-wrong-link', 'cast Pass without Trace, then hide', `${token}:compound-wrong-link`, { session_id: article.session.id });
    results.push({ name: 'compound wrong Character Session linkage rejects before writes', pass: wrongLinkCompound.outcome.status === 400 && wrongLinkCompound.afterCharacter.spell_slots?.level_2 === undefined && compoundModifierCount(wrongLinkCompound.afterCharacter) === 0 });
    results.push({ name: 'compound plain non-spell Hide remains a non-cast control', pass: parsePwtCompoundIntent('hide behind the wall') === null });
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
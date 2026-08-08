import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { hashValue, isPwt } from '../../shared/story/postRestResiduals.ts';

const characterId = '6a6825cd07a490fa70a46852';
const sessionId = '6a6825edd695bd65a4322256';
const combatId = '6a77463582a26b50018110ea';
const repairId = 'repair-post-rest-narration-polish-20260808';
const malformedRemainder = 'mind, however, is a storm of fully rested and frustration; the cryptic scrawls and shifting hierarchies of the Obsidian Circle refuse to coalesce into a coherent map of their true influence.';
const DEFAULT_MY_SENTENCE = `My ${malformedRemainder}`;
const malformedSentences = [DEFAULT_MY_SENTENCE, `Your ${malformedRemainder}`];
const correctedSentence = 'Though fully rested and alert, frustration mounts as the cryptic scrawls and shifting hierarchies of the Obsidian Circle refuse to coalesce into a coherent map of their true influence.';

const hasOnlyAlert = (conditions) => Array.isArray(conditions) && conditions.length === 1 && String(conditions[0]?.name || conditions[0]).toLowerCase() === 'alert';
const hasCraigResidualProse = (text) => /\b(?:fatigue|fatigued|tired|weary|ragged|sleepless|spent|exhaustion)\b|lingering (?:remnants?|magic)|storm of fully rested|mocking your full-rest clarity/i.test(String(text || ''));
const normalizeSentence = (value) => String(value || '').replace(/\r\n/g, '\n').replace(/[’‘]/g, "'").trim();
const findMalformedSentence = (text) => malformedSentences.find((sentence) => String(text || '').split(sentence).length === 2);
const withoutReceiptAndNarration = (session, index) => ({ ...session, world_state: { ...(session.world_state || {}), narration_polish_repairs: undefined }, story_log: (session.story_log || []).map((entry, entryIndex) => entryIndex === index ? { ...entry, text: undefined } : entry) });
const failedMechanics = (character, session, combat) => {
  const players = (combat.combatants || []).filter((entry) => entry?.type === 'player');
  const player = players.find((entry) => entry.id === characterId);
  const enemies = (combat.combatants || []).filter((entry) => entry?.type === 'enemy');
  const playerInitiativeSource = player?.initiative_total != null ? 'initiative_total' : player?.initiative_value != null ? 'initiative_value' : 'initiative';
  const playerInitiative = Number(player?.initiative_total ?? player?.initiative_value ?? player?.initiative);
  const failures = [];
  const expect = (name, pass, expected, actual) => { if (!pass) failures.push({ name, expected, actual }); };
  expect('character_rest_state', Number(character?.exhaustion_level) === 0 && Number(character?.hp_current) === 44 && Number(character?.hp_max) === 44 && Number(character?.hit_dice_remaining) === 5 && Number(character?.hit_dice_max) === 5 && Object.keys(character?.spell_slots || {}).length === 0 && Array.isArray(character?.active_modifiers) && character.active_modifiers.length === 0, 'exhaustion 0, HP 44/44, hit dice 5/5, empty slots and modifiers', character ? { exhaustion: character.exhaustion_level, hp: [character.hp_current, character.hp_max], hit_dice: [character.hit_dice_remaining, character.hit_dice_max], slot_keys: Object.keys(character.spell_slots || {}), modifier_count: character.active_modifiers?.length || 0 } : null);
  expect('character_alert_only', hasOnlyAlert(character?.conditions) && !character.conditions.some(isPwt), 'one persistent Alert and no Pass without Trace', (character?.conditions || []).map((entry) => entry?.name || entry));
  expect('session_combat_linkage', session?.character_id === characterId && session?.in_combat === true && session?.combat_state?.combat_id === combatId && combat?.id === combatId && combat?.session_id === sessionId && combat?.is_active === true, 'protected active Session and CombatLog linkage', { session_character_id: session?.character_id, in_combat: session?.in_combat, session_combat_id: session?.combat_state?.combat_id, combat_id: combat?.id, combat_session_id: combat?.session_id, combat_active: combat?.is_active });
  expect('single_authoritative_player_combatant', players.length === 1 && player?.id === characterId, 'exactly one player combatant with protected character id', players.map((entry) => ({ id: entry?.id, name: entry?.name })));
  expect('session_concentration_inactive', session?.world_state?.active_concentration == null, 'active_concentration absent or null', session?.world_state?.active_concentration ? { spell_name: session.world_state.active_concentration.spell_name || session.world_state.active_concentration.name || 'present' } : null);
  expect('combat_player_state', hasOnlyAlert(player?.conditions) && !player?.conditions?.some(isPwt) && Number(player?.hp_current) === 44 && Number(player?.hp_max) === 44 && playerInitiative === 18 && Number(combat?.current_turn_index) === 0, 'Alert only, HP 44/44, initiative 18, turn index 0', player ? { conditions: (player.conditions || []).map((entry) => entry?.name || entry), hp: [player.hp_current, player.hp_max], initiative: playerInitiative, initiative_source: playerInitiativeSource, turn_index: combat.current_turn_index } : null);
  expect('protected_wolf_roster', enemies.length === 3 && enemies.filter((entry) => /^Corrupted Wolf(?: Reinforcement)?$/i.test(entry.name || '') && Number(entry.hp_current) === 15 && Number(entry.hp_max) === 15).length === 3, 'two Corrupted Wolves and one Reinforcement at 15/15', enemies.map((entry) => ({ name: entry?.name, hp: [entry?.hp_current, entry?.hp_max] })));
  return failures;
};

export default async function repairCraigPostRestNarrationPolish(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Admin owner access required' }, { status: 403 });
    const body = await req.json();
    if (body?.repair_id !== repairId || body?.character_id !== characterId || body?.session_id !== sessionId || body?.combat_id !== combatId) return Response.json({ error: 'This polish repair is restricted to the protected Craig records.' }, { status: 400 });
    const db = base44.asServiceRole;
    const [character, session, combat] = await Promise.all([db.entities.Character.get(characterId), db.entities.GameSession.get(sessionId), db.entities.CombatLog.get(combatId)]);
    if (!character || !session || !combat || character.created_by_id !== user.id) return Response.json({ error: 'Only the protected record owner may run this repair.' }, { status: 403 });
    const repairReceipt = session.world_state?.narration_polish_repairs?.[repairId];
    if (repairReceipt) return Response.json({ success: true, already_processed: true, repair_id: repairId, writes: 0, receipt: repairReceipt });
    const index = (session.story_log || []).length - 1;
    const latest = session.story_log?.[index];
    const requestedExpected = normalizeSentence(body.expected_malformed_sentence || DEFAULT_MY_SENTENCE);
    const actualSentence = findMalformedSentence(latest?.text);
    const expectedSentenceMatch = normalizeSentence(actualSentence) === requestedExpected;
    const failedInvariants = failedMechanics(character, session, combat);
    if (!actualSentence) failedInvariants.push({ name: 'exact_latest_malformed_sentence', expected: requestedExpected, actual: normalizeSentence(latest?.text).slice(0, 300) });
    if (!expectedSentenceMatch) failedInvariants.push({ name: 'expected_malformed_sentence_match', expected: requestedExpected, actual: normalizeSentence(actualSentence) });
    if (failedInvariants.length) return Response.json({ error: 'Protected narration polish preconditions failed.', failed_invariants: failedInvariants }, { status: 409 });
    const correctedText = latest.text.replace(actualSentence, correctedSentence);
    if (hasCraigResidualProse(correctedText) || correctedText.split(correctedSentence).length !== 2) return Response.json({ error: 'Exact narration polish did not meet post-rest continuity requirements.' }, { status: 409 });
    const before = { narration_text: hashValue(latest.text), story_metadata: hashValue({ ...latest, text: undefined }), choices: hashValue(latest.choices || []), character: hashValue(character), session_without_narration_and_receipt: hashValue(withoutReceiptAndNarration(session, index)), combat: hashValue(combat) };
    const nextLog = session.story_log.map((entry, entryIndex) => entryIndex === index ? { ...entry, text: correctedText } : entry);
    const receipt = { completed_at: new Date().toISOString(), latest_story_index: index, before_text_hash: before.narration_text, after_text_hash: hashValue(correctedText) };
    const nextSession = { ...session, story_log: nextLog, world_state: { ...(session.world_state || {}), narration_polish_repairs: { ...(session.world_state?.narration_polish_repairs || {}), [repairId]: receipt } } };
    await db.entities.GameSession.update(sessionId, { story_log: nextLog, world_state: nextSession.world_state });
    const [afterCharacter, afterSession, afterCombat] = await Promise.all([db.entities.Character.get(characterId), db.entities.GameSession.get(sessionId), db.entities.CombatLog.get(combatId)]);
    const afterLatest = afterSession.story_log?.[index];
    const after = { narration_text: hashValue(afterLatest?.text), story_metadata: hashValue({ ...afterLatest, text: undefined }), choices: hashValue(afterLatest?.choices || []), character: hashValue(afterCharacter), session_without_narration_and_receipt: hashValue(withoutReceiptAndNarration(afterSession, index)), combat: hashValue(afterCombat) };
    const assertions = { character_hash_unchanged: before.character === after.character, choices_hash_unchanged: before.choices === after.choices, story_metadata_hash_unchanged: before.story_metadata === after.story_metadata, combat_hash_unchanged: before.combat === after.combat, session_nonnarration_hash_unchanged_except_receipt: before.session_without_narration_and_receipt === after.session_without_narration_and_receipt, corrected_once: afterLatest?.text?.split(correctedSentence).length === 2, malformed_absent: !malformedSentences.some((sentence) => afterLatest?.text?.includes(sentence)),       no_craig_residual_prose: !hasCraigResidualProse(afterLatest?.text), protected_mechanics_intact: failedMechanics(afterCharacter, afterSession, afterCombat).length === 0 };
    if (!Object.values(assertions).every(Boolean)) return Response.json({ error: 'Post-write protection assertion failed.', hashes: { before, after }, assertions }, { status: 500 });
    return Response.json({ success: true, repair_id: repairId, writes: 1, sentences: { before: actualSentence, after: correctedSentence }, hashes: { before, after }, assertions, expected_state: { character: 'exhaustion 0; HP 44/44; hit dice 5/5; empty spell slots; persistent Alert only; no modifiers', session: 'no active Pass without Trace concentration; current choices and story metadata preserved', combat: 'active protected combat unchanged: player turn index 0, initiative 18, three specified wolves alive at 15/15' } });
  } catch (error) { return Response.json({ error: error.message || 'Narration polish repair failed' }, { status: 500 }); }
}
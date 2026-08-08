import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { hashValue, isPwt } from '../../shared/story/postRestResiduals.ts';

const characterId = '6a6825cd07a490fa70a46852';
const sessionId = '6a6825edd695bd65a4322256';
const combatId = '6a77463582a26b50018110ea';
const repairId = 'repair-post-rest-lingering-magic-20260808';
const protectedTargetIndex = 58;
const restedSentence = 'Though fully rested and alert, frustration mounts as the cryptic scrawls and shifting hierarchies of the Obsidian Circle refuse to coalesce into a coherent map of their true influence.';
const fromSentence = 'Your boots fall with the soft, practiced rhythm of a predator, each movement masked by the lingering remnants of your magic.';
const toSentence = 'Your boots fall with the soft, practiced rhythm of a predator, each movement guided by hard-earned skill and sharpened awareness.';

const names = (items) => (items || []).map((item) => String(item?.name || item || ''));
const alertOnly = (items) => Array.isArray(items) && items.length === 1 && names(items)[0].toLowerCase() === 'alert';
const count = (text, phrase) => String(text || '').split(phrase).length - 1;
const semantic = (record, removeCreated = false) => { const { updated_date, ...withoutUpdated } = record || {}; if (!removeCreated) return withoutUpdated; const { created_date, ...withoutDates } = withoutUpdated; return withoutDates; };
const sessionWithoutChangedTextAndReceipt = (session, index) => { const clean = semantic(session, true); return { ...clean, world_state: { ...(clean.world_state || {}), lingering_magic_repairs: undefined }, story_log: (clean.story_log || []).map((entry, i) => i === index ? { ...entry, text: undefined } : entry) }; };
const currentMagicMasking = (text) => /(?:boots|movements?).{0,90}\b(?:masked|concealed|hidden)\b.{0,90}\b(?:magic(?:ally)?|pass without trace)\b|\b(?:magic(?:ally)?|pass without trace)\b.{0,90}\b(?:masks?|masked|conceals?|concealed|hides?|hidden)\b.{0,90}\b(?:boots|movements?)\b/i.test(String(text || ''));
const currentFatigue = (text) => /\b(?:is|are|remains?|feels?|leaves?)\b.{0,45}\b(?:fatigue|fatigued|tired|weary|ragged|sleepless|exhaustion|exhausted)\b|\b(?:fatigue|fatigued|tired|weary|ragged|sleepless|exhaustion|exhausted)\b.{0,45}\b(?:is|are|remains?|feels?)\b/i.test(String(text || ''));
const findMatches = (storyLog) => (storyLog || []).flatMap((entry, index) => { const text = String(entry?.text ?? ''); const occurrenceCountWithinText = count(text, fromSentence); return occurrenceCountWithinText ? [{ index, occurrenceCountWithinText }] : []; });
const narrativeText = (storyLog) => (storyLog || []).map((entry) => String(entry?.text ?? '')).join('\n');
const diagnostics = (storyLog, matches, targetIndex) => { const currentText = String(storyLog?.[targetIndex]?.text ?? ''); return { searched_scope: 'story_log[*].text', searched_path: `story_log[${targetIndex}].text`, resolved_index: targetIndex, matching_indices: matches, story_log_length: Array.isArray(storyLog) ? storyLog.length : 0, current_text_hash: hashValue(currentText), occurrence_count: count(currentText, fromSentence), global_occurrence_count: matches.reduce((total, match) => total + match.occurrenceCountWithinText, 0), matching_sentences: (storyLog || []).flatMap((entry) => String(entry?.text ?? '').split(/(?<=[.!?])\s+/)).filter((sentence) => /boots|predator|masked|lingering|remnants|magic/i.test(sentence)).slice(0, 12) }; };
const mechanics = (character, session, combat) => {
  const failures = []; const expect = (name, pass, expected, actual) => { if (!pass) failures.push({ name, expected, actual }); };
  const players = (combat?.combatants || []).filter((entry) => entry?.type === 'player');
  const player = players[0]; const enemies = (combat?.combatants || []).filter((entry) => entry?.type === 'enemy');
  const initiative = Number(player?.initiative_total ?? player?.initiative_value ?? player?.initiative);
  expect('character_rest_state', Number(character?.exhaustion_level) === 0 && Number(character?.hp_current) === 44 && Number(character?.hp_max) === 44 && Number(character?.hit_dice_remaining) === 5 && Number(character?.hit_dice_max) === 5 && Object.keys(character?.spell_slots || {}).length === 0 && (character?.active_modifiers || []).length === 0 && alertOnly(character?.conditions) && !character?.conditions?.some(isPwt), 'exhaustion 0; HP 44/44; hit dice 5/5; empty slots/modifiers; Alert only; no PWT', { exhaustion: character?.exhaustion_level, hp: [character?.hp_current, character?.hp_max], hit_dice: [character?.hit_dice_remaining, character?.hit_dice_max], slots: Object.keys(character?.spell_slots || {}), modifiers: (character?.active_modifiers || []).length, conditions: names(character?.conditions) });
  expect('session_state', session?.character_id === characterId && session?.in_combat === true && session?.combat_state?.combat_id === combatId && session?.world_state?.active_concentration == null, 'protected active combat linkage with no active concentration', { character_id: session?.character_id, in_combat: session?.in_combat, combat_id: session?.combat_state?.combat_id, active_concentration: session?.world_state?.active_concentration ? 'present' : null });
  expect('combat_linkage', combat?.id === combatId && combat?.session_id === sessionId && combat?.is_active === true && players.length === 1 && player?.id === characterId && Number(combat?.current_turn_index) === 0, 'active protected combat with one protected player at turn index 0', { combat_id: combat?.id, session_id: combat?.session_id, active: combat?.is_active, player_ids: players.map((entry) => entry?.id), turn_index: combat?.current_turn_index });
  expect('combat_player_state', initiative === 18 && Number(player?.hp_current) === 44 && Number(player?.hp_max) === 44 && alertOnly(player?.conditions) && !player?.conditions?.some(isPwt), 'initiative_total 18; HP 44/44; Alert only; no PWT', { initiative, hp: [player?.hp_current, player?.hp_max], conditions: names(player?.conditions) });
  const wolfNames = enemies.map((entry) => entry?.name || '');
  expect('wolf_roster', enemies.length === 3 && wolfNames.filter((name) => name === 'Corrupted Wolf').length === 2 && wolfNames.filter((name) => name === 'Corrupted Wolf Reinforcement').length === 1 && enemies.every((entry) => Number(entry?.hp_current) === 15 && Number(entry?.hp_max) === 15 && !entry?.conditions?.some(isPwt)), 'two Corrupted Wolves and one Reinforcement at 15/15 with no PWT', enemies.map((entry) => ({ name: entry?.name, hp: [entry?.hp_current, entry?.hp_max], conditions: names(entry?.conditions) })));
  return failures;
};
const textChecks = (original, proposed) => {
  const occurrence = count(original, fromSentence); const index = String(original || '').indexOf(fromSentence);
  const prefix = String(original || '').slice(0, index); const suffix = String(original || '').slice(index + fromSentence.length);
  const checks = { replacement_count_exactly_one: occurrence === 1 && proposed === String(original).replace(fromSentence, toSentence), from_absent: !String(proposed || '').includes(fromSentence), lingering_magic_phrase_absent: !/lingering remnants of your magic/i.test(String(proposed || '')), current_magic_masking_absent: !currentMagicMasking(proposed), to_once: count(proposed, toSentence) === 1, text_outside_target_unchanged: occurrence === 1 && proposed === `${prefix}${toSentence}${suffix}` };
  return { replacement_count: occurrence === 1 ? 1 : 0, checks, failed: Object.entries(checks).filter(([, pass]) => !pass).map(([name]) => ({ name, expected: true, actual: false })) };
};

export default async function repairCraigPostRestLingeringMagic(req) {
  try {
    const base44 = createClientFromRequest(req); const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized', failed_invariants: [{ name: 'authenticated_owner', expected: true, actual: false }] }, { status: 401 });
    const body = await req.json();
    if (body?.repair_id !== repairId || body?.character_id !== characterId || body?.session_id !== sessionId || body?.combat_id !== combatId) return Response.json({ error: 'Protected repair identifiers did not match.', failed_invariants: [{ name: 'exact_protected_identifiers', expected: repairId, actual: 'mismatch' }] }, { status: 400 });
    const db = base44.asServiceRole;
    const [character, session, combat] = await Promise.all([db.entities.Character.get(characterId), db.entities.GameSession.get(sessionId), db.entities.CombatLog.get(combatId)]);
    if (!character || !session || !combat || character.created_by_id !== user.id || user.role !== 'admin') return Response.json({ error: 'Owner-only access denied.', failed_invariants: [{ name: 'owner_admin_access', expected: true, actual: false }] }, { status: 403 });
    const matches = findMatches(session.story_log);
    const globalOccurrenceCount = matches.reduce((total, match) => total + match.occurrenceCountWithinText, 0);
    const targetIndex = matches.length === 1 && globalOccurrenceCount === 1 ? matches[0].index : -1;
    const entry = session.story_log?.[targetIndex];
    const currentText = String(entry?.text ?? '');
    const readDiagnostics = diagnostics(session.story_log, matches, targetIndex);
    const receipt = session.world_state?.lingering_magic_repairs?.[repairId];
    if (receipt) return Response.json({ success: true, already_processed: true, repair_id: repairId, writes: 0, receipt, ...readDiagnostics });
    const failedInvariants = mechanics(character, session, combat);
    const narrativeChecks = { unique_global_target: matches.length === 1 && globalOccurrenceCount === 1, resolved_index_is_protected_58: targetIndex === protectedTargetIndex, target_index_in_range: targetIndex >= 0 && targetIndex < (session.story_log || []).length, target_entry_exists: !!entry, rested_sentence_once_at_index59: count(session.story_log?.[59]?.text, restedSentence) === 1, from_once: count(currentText, fromSentence) === 1, to_absent: count(currentText, toSentence) === 0 };
    Object.entries(narrativeChecks).filter(([, pass]) => !pass).forEach(([name]) => failedInvariants.push({ name, expected: true, actual: false }));
    if (failedInvariants.length) return Response.json({ error: 'Protected repair invariants failed.', failed_invariants: failedInvariants, ...readDiagnostics }, { status: 409 });
    const proposed = currentText.replace(fromSentence, toSentence); const proposedChecks = textChecks(currentText, proposed);
    if (proposedChecks.failed.length) return Response.json({ error: 'Proposed repair postconditions failed.', failed_postconditions: proposedChecks.failed, replacement_count: proposedChecks.replacement_count, ...readDiagnostics }, { status: 409 });
    const before = { character: hashValue(semantic(character)), combat: hashValue(semantic(combat)), choices: hashValue(entry.choices || []), latest_metadata: hashValue({ ...entry, text: undefined }), index59: hashValue(session.story_log?.[59]), other_story_entries: hashValue(session.story_log.map((storyEntry, index) => index === targetIndex ? null : storyEntry)), session_nonnarration: hashValue(sessionWithoutChangedTextAndReceipt(session, targetIndex)), narration: hashValue(currentText) };
    const clonedStoryLog = session.story_log.map((storyEntry, i) => i === targetIndex ? { ...storyEntry, text: proposed } : storyEntry);
    const nextWorldState = { ...(session.world_state || {}), lingering_magic_repairs: { ...(session.world_state?.lingering_magic_repairs || {}), [repairId]: { completed_at: new Date().toISOString(), before_text_hash: before.narration, after_text_hash: hashValue(proposed), latest_story_index: targetIndex } } };
    await db.entities.GameSession.update(sessionId, { story_log: clonedStoryLog, world_state: nextWorldState });
    const [afterCharacter, afterSession, afterCombat] = await Promise.all([db.entities.Character.get(characterId), db.entities.GameSession.get(sessionId), db.entities.CombatLog.get(combatId)]);
    const afterEntry = afterSession?.story_log?.[targetIndex]; const afterText = String(afterEntry?.text ?? ''); const persisted = textChecks(currentText, afterText);
    const after = { character: hashValue(semantic(afterCharacter)), combat: hashValue(semantic(afterCombat)), choices: hashValue(afterEntry?.choices || []), latest_metadata: hashValue({ ...afterEntry, text: undefined }), index59: hashValue(afterSession?.story_log?.[59]), other_story_entries: hashValue((afterSession?.story_log || []).map((storyEntry, index) => index === targetIndex ? null : storyEntry)), session_nonnarration: hashValue(sessionWithoutChangedTextAndReceipt(afterSession, targetIndex)), narration: hashValue(afterText) };
    const afterNarration = narrativeText(afterSession?.story_log);
    const afterMatches = findMatches(afterSession?.story_log);
    const invariants = { character_hash_unchanged: before.character === after.character, combat_hash_unchanged: before.combat === after.combat, choices_hash_unchanged: before.choices === after.choices, target_entry_metadata_hash_unchanged: before.latest_metadata === after.latest_metadata, index59_hash_unchanged: before.index59 === after.index59, other_story_entries_hash_unchanged: before.other_story_entries === after.other_story_entries, session_nonnarration_hash_unchanged: before.session_nonnarration === after.session_nonnarration, global_from_count_zero: afterMatches.reduce((total, match) => total + match.occurrenceCountWithinText, 0) === 0, global_to_count_one: count(afterNarration, toSentence) === 1 && count(afterText, toSentence) === 1, lingering_magic_absent_globally: !/lingering remnants of your magic/i.test(afterNarration), corrected_rested_sentence_once_at_index59: count(afterSession?.story_log?.[59]?.text, restedSentence) === 1, malformed_storm_absent: !/storm of fully rested/i.test(afterNarration), current_fatigue_absent: !currentFatigue(afterText), mechanics_unchanged: mechanics(afterCharacter, afterSession, afterCombat).length === 0, ...persisted.checks };
    const failedPostconditions = [...persisted.failed, ...Object.entries(invariants).filter(([, pass]) => !pass).map(([name]) => ({ name, expected: true, actual: false }))];
    const afterDiagnostics = diagnostics(afterSession?.story_log, afterMatches, targetIndex);
    if (failedPostconditions.length) return Response.json({ error: 'Persisted repair postconditions failed.', failed_postconditions: failedPostconditions, replacement_count: persisted.replacement_count, hashes: { before, after }, invariants, ...afterDiagnostics }, { status: 500 });
    return Response.json({ success: true, repair_id: repairId, writes: 1, already_processed: false, searched_scope: 'story_log[*].text', searched_path: `story_log[${targetIndex}].text`, resolved_index: targetIndex, story_log_length: afterSession?.story_log?.length, occurrence_counts: { before_global: globalOccurrenceCount, after_from_global: afterMatches.reduce((total, match) => total + match.occurrenceCountWithinText, 0), after_to_global: count(afterNarration, toSentence) }, sentences: { before: fromSentence, after: toSentence }, replacement_count: persisted.replacement_count, hashes: { before, after, index59_before: before.index59, index59_after: after.index59 }, invariants, expected_state: { character: 'exhaustion 0; HP 44/44; hit dice 5/5; empty spell_slots and active_modifiers; persistent Alert only; no PWT', session: 'in_combat true; protected combat id; no active PWT concentration; historical last_spell_cast permitted', combat: 'active protected CombatLog; one player id; initiative_total 18; HP 44/44; Alert only; two Corrupted Wolves and one Corrupted Wolf Reinforcement at 15/15; no PWT' } });
  } catch (error) { return Response.json({ error: error.message || 'Lingering magic repair failed', failed_postconditions: [{ name: 'unexpected_repair_execution_error', expected: 'no error', actual: 'error' }] }, { status: 500 }); }
}
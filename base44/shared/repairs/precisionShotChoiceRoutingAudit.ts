import { normalizeChoiceActionContract } from '../story/choiceActionContract.js';
import { AMMO_RECEIPTS } from '../ammunitionTransaction.ts';
import { hashValue } from '../tests/liveProtection.ts';
import { getClockHour } from '../story/worldClock.ts';

export const PRECISION_SHOT_AUDIT_VERSION = 'precision-shot-choice-routing-audit-v1.0.0';
const EXACT = 'Take a precision shot to incapacitate the guard before he reaches cover.';

export async function auditPrecisionShotRoutingFailure({ db, character, session }) {
  const sourceIndex = [...(session.story_log || [])].map((entry, index) => ({ entry, index })).reverse().find(({ entry }) => (entry.choices || []).some((choice) => String(choice?.text || '').trim() === EXACT));
  const choiceIndex = sourceIndex ? sourceIndex.entry.choices.findIndex((choice) => String(choice?.text || '').trim() === EXACT) : -1;
  const choice = choiceIndex >= 0 ? sourceIndex.entry.choices[choiceIndex] : null;
  const detected = normalizeChoiceActionContract(choice || { text: EXACT });
  const sourceTime = Date.parse(sourceIndex?.entry?.timestamp || '') || 0;
  const afterSource = (value) => !sourceTime || (Date.parse(value || '') || 0) >= sourceTime;
  const skillReceipts = (session.world_state?.__skill_check_receipts || []).filter((receipt) => receipt?.request_id && afterSource(receipt.at));
  const storyAttackReceipts = (session.world_state?.__story_weapon_attack_receipts || []).filter((receipt) => afterSource(receipt.completed_at));
  const ammoReceipts = (character.long_rest_abilities?.[AMMO_RECEIPTS] || []).filter((receipt) => receipt.session_id === session.id && afterSource(receipt.at));
  const rolls = (await db.entities.RollRecord.filter({ session_id: session.id }, '-created_date', 20)).filter((roll) => afterSource(roll.created_date) && /precision shot|incapacitate the guard/i.test(String(roll.context || '')));
  const combats = (await db.entities.CombatLog.filter({ session_id: session.id }, '-created_date', 10)).filter((combat) => afterSource(combat.created_date));
  const laterStory = sourceIndex ? (session.story_log || []).slice(sourceIndex.index + 1) : [];
  const mechanics = { skill_receipts: skillReceipts.length, story_attack_receipts: storyAttackReceipts.length, ammo_receipts: ammoReceipts.length, roll_records: rolls.length, active_combat: !!session.in_combat, combat_records: combats.length, later_story_entries: laterStory.length };
  const writesDetected = mechanics.story_attack_receipts > 0 || mechanics.roll_records > 0 || mechanics.active_combat || mechanics.combat_records > 0 || laterStory.some((entry) => entry.player_choice === EXACT);
  const pwt = (character.active_modifiers || []).find((modifier) => modifier?.concentration && /pass without trace/i.test(String(modifier.source || modifier.name || ''))) || session.world_state?.active_concentration;
  return { audit_version: PRECISION_SHOT_AUDIT_VERSION, exact_choice: choice ? { source_story_index: sourceIndex.index, choice_index: choiceIndex, payload: choice } : null, detected_type: detected.action_type, called_endpoint: writesDetected ? 'authoritative attack path detected' : 'resolveStorySkillCheck (inferred from returned canonical-skill validation error)', error: writesDetected ? null : 'Character and canonical skill are required', mechanics, writes_detected: writesDetected, safe_to_retry: !writesDetected, current: { arrows: (character.inventory || []).filter((item) => String(item.name).toLowerCase() === 'arrows').reduce((sum, item) => sum + Number(item.quantity || 0), 0), clock: { time_of_day: session.time_of_day, hour: getClockHour({ timeOfDay: session.time_of_day, worldState: session.world_state }), elapsed_hours: Number(session.world_state?.elapsed_hours) || 0 }, used_slots: character.spell_slots || {}, pwt_active: !!pwt }, hashes: { character: await hashValue(character), session: await hashValue(session), incident: await hashValue({ choice, mechanics }) }, writes: 0, apply_token: null, recommendation: writesDetected ? 'Do not retry until authoritative receipts are reconciled.' : 'Publish the typed-choice frontend, then retry the preserved choice. No retroactive attack or repair is authorized.' };
}
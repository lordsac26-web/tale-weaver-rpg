import { advanceWorldClock, elapsedHoursForRest, getClockHour } from './worldClock.ts';
import { deriveCanonicalSpellSlots } from '../spells/slotProgression.ts';

export const LONG_REST_CORE_VERSION='authoritative-long-rest-core-v1.2.0';

export async function executeLongRestCore({ db, ownerId, characterId, sessionId, requestId, intent = 'long_rest_8h', targetPeriod = null, explicitHours = null }) {
  const [character, session] = await Promise.all([db.entities.Character.get(characterId), db.entities.GameSession.get(sessionId)]);
  if (!character || !session || character.created_by_id !== ownerId || session.character_id !== characterId || session.in_combat) return { status: 403, body: { error: 'Rest ownership chain is invalid.' } };
  const receipts = Array.isArray(session.world_state?.__rest_receipts) ? session.world_state.__rest_receipts : [];
  const existing = receipts.find((entry) => entry.token === requestId);
  if (existing?.response) return { status: 200, body: { ...existing.response, already_processed: true } };
  const elapsedHours = elapsedHoursForRest({ intent, startHour: getClockHour({ timeOfDay: session.time_of_day, worldState: session.world_state }), targetPeriod, explicitHours });
  const completedAt = new Date().toISOString();
  const clock = advanceWorldClock({ timeOfDay: session.time_of_day, worldState: session.world_state, elapsedHours, completedAt });
  const restTime = Date.parse(clock.clock.world_clock_timestamp || completedAt);
  const level = Number(character.level) || 1;
  const conditions = (character.conditions || []).filter((condition) => {
    const name = String(typeof condition === 'string' ? condition : condition?.name || '').toLowerCase();
    const duration = String(condition?.duration || '').toLowerCase();
    const expired = Number.isFinite(Date.parse(condition?.expires_at || '')) && Date.parse(condition.expires_at) <= restTime;
    return !(expired || condition?.clears_on_long_rest || ['scene', 'combat', 'rest', 'short_rest', 'long_rest'].includes(duration) || name === 'pass without trace');
  });
  const activeModifiers = (character.active_modifiers || []).filter((modifier) => !modifier?.concentration && !(Number.isFinite(Date.parse(modifier?.expires_at || '')) && Date.parse(modifier.expires_at) <= restTime));
  const slotProgression=deriveCanonicalSpellSlots(character),preservedReceipts=Object.fromEntries(Object.entries(character.long_rest_abilities||{}).filter(([key])=>key.startsWith('__')));
  const updates = { hp_current: character.hp_max, spell_slots: slotProgression.max_slots.length?{}:(character.spell_slots||{}), death_saves_success: 0, death_saves_failure: 0, active_modifiers: activeModifiers, conditions, hit_dice_max: level, hit_dice_remaining: Math.min(level, (character.hit_dice_remaining ?? level) + Math.max(1, Math.floor(level / 2))), short_rest_abilities: {}, long_rest_abilities: preservedReceipts };
  if (character.class === 'Wizard') updates.arcane_recovery_used = false;
  if (Number(character.luck_points_max) > 0) updates.luck_points_remaining = character.luck_points_max;
  if (character.class === 'Sorcerer' && level >= 2) { updates.sorcery_points_max = level; updates.sorcery_points_current = level; }
  if (character.class === 'Monk' && level >= 2) { updates.ki_points_max = level; updates.ki_points_remaining = level; }
  if (character.class === 'Bard') { const max = Math.max(1, Math.floor(((Number(character.charisma) || 10) - 10) / 2)); updates.bardic_inspiration_max = max; updates.bardic_inspiration_remaining = max; }
  await db.entities.Character.update(characterId, updates);
  const updatedCharacter = await db.entities.Character.get(characterId);
  const healing = Number(updatedCharacter.hp_current || 0) - Number(character.hp_current || 0);
  const restoredHitDice = Number(updatedCharacter.hit_dice_remaining || 0) - Number(character.hit_dice_remaining ?? level);
  const restorations = ['Full HP restored', ...(slotProgression.max_slots.length ? ['All spell slots recovered'] : []), ...(restoredHitDice > 0 ? [`${restoredHitDice} Hit Dice restored`] : []), 'All abilities recharged'];
  const response = { success: true, function_version:LONG_REST_CORE_VERSION, character: updatedCharacter, healing, restorations, narrative: 'You sleep deeply and wake restored.', rest_type: 'long', time_of_day: clock.time_of_day, clock: clock.clock, receipt_id: requestId, slot_derivation:slotProgression };
  clock.world_state.__rest_receipts = [...receipts.filter((entry) => entry.token !== requestId), { token: requestId, response, completed_at: completedAt }].slice(-25);
  if (Array.isArray(clock.world_state.__rest_requests)) clock.world_state.__rest_requests = clock.world_state.__rest_requests.map((entry) => entry.request_id === requestId ? { ...entry, status: 'committed', completed_at: completedAt } : entry);
  clock.world_state.active_concentration = null;
  clock.world_state.post_rest_continuity = { rested: true, completed_at: completedAt, clock_hour: clock.clock.after_hour, period: clock.clock.after_period };
  const updatedSession = await db.entities.GameSession.update(sessionId, { time_of_day: clock.time_of_day, world_state: clock.world_state });
  return { status: 200, body: { ...response, session: updatedSession } };
}
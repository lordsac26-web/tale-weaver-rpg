import { advanceWorldClock, elapsedHoursForRest, getClockHour } from './worldClock.ts';

export async function executeLongRestCore({ db, ownerId, characterId, sessionId, requestId }) {
  const [character, session] = await Promise.all([db.entities.Character.get(characterId), db.entities.GameSession.get(sessionId)]);
  if (!character || !session || character.created_by_id !== ownerId || session.character_id !== characterId || session.in_combat) return { status: 403, body: { error: 'Rest ownership chain is invalid.' } };
  const receipts = Array.isArray(session.world_state?.__rest_receipts) ? session.world_state.__rest_receipts : [];
  const existing = receipts.find((entry) => entry.token === requestId);
  if (existing?.response) return { status: 200, body: { ...existing.response, already_processed: true } };
  const elapsedHours = elapsedHoursForRest({ intent: 'long_rest_8h', startHour: getClockHour({ timeOfDay: session.time_of_day, worldState: session.world_state }) });
  const clock = advanceWorldClock({ timeOfDay: session.time_of_day, worldState: session.world_state, elapsedHours, completedAt: new Date().toISOString() });
  await db.entities.Character.update(characterId, { hp_current: character.hp_max, spell_slots: {}, death_saves_success: 0, death_saves_failure: 0, active_modifiers: [] });
  const updatedCharacter = await db.entities.Character.get(characterId);
  const response = { success: true, character: updatedCharacter, time_of_day: clock.time_of_day, clock: clock.clock };
  clock.world_state.__rest_receipts = [...receipts, { token: requestId, response, completed_at: new Date().toISOString() }].slice(-25);
  clock.world_state.active_concentration = null;
  const updatedSession = await db.entities.GameSession.update(sessionId, { time_of_day: clock.time_of_day, world_state: clock.world_state });
  return { status: 200, body: { ...response, session: updatedSession } };
}
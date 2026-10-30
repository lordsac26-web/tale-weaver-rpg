/**
 * Frontend mirror of base44/shared/story/worldClock.ts
 *
 * The backend module is TypeScript inside base44/shared/, which the browser
 * cannot load (module request returns 403). Only the display helpers the UI
 * needs live here; the server remains authoritative for clock advancement.
 */
export const getPeriodForHour = (hour) => {
  const value = ((Number(hour) % 24) + 24) % 24;
  if (value < 5) return 'Midnight';
  if (value < 8) return 'Dawn';
  if (value < 12) return 'Morning';
  if (value < 17) return 'Afternoon';
  if (value < 20) return 'Dusk';
  if (value < 23) return 'Evening';
  return 'Night';
};

export const formatWorldTime = (hour) => {
  const value = ((Number(hour) % 24) + 24) % 24;
  const wholeHour = Math.floor(value);
  const minutes = Math.round((value - wholeHour) * 60) % 60;
  const suffix = wholeHour >= 12 ? 'PM' : 'AM';
  const displayHour = wholeHour % 12 || 12;
  return `${displayHour}:${String(minutes).padStart(2, '0')} ${suffix}`;
};

const legacyHour = (timeOfDay) => ({ Midnight: 0, Dawn: 6, Morning: 9, Midday: 12, Afternoon: 14, Dusk: 18, Evening: 21, Night: 21 })[String(timeOfDay || '')] ?? 9;

export const getClockHour = ({ timeOfDay, worldState }) => {
  const stored = Number(worldState?.clock_hour);
  return Number.isFinite(stored) && stored >= 0 && stored < 24 ? stored : legacyHour(timeOfDay);
};
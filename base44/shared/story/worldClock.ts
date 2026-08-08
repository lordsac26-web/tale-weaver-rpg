const DAY_MS = 24 * 60 * 60 * 1000;

export const getPeriodForHour = (hour) => {
  const value = ((Number(hour) % 24) + 24) % 24;
  if (value < 5) return 'Midnight';
  if (value < 8) return 'Dawn';
  if (value < 12) return 'Morning';
  if (value < 17) return 'Afternoon';
  if (value < 20) return 'Dusk';
  return 'Night';
};

export const formatWorldTime = (hour) => {
  const value = ((Number(hour) % 24) + 24) % 24;
  const suffix = value >= 12 ? 'PM' : 'AM';
  const displayHour = value % 12 || 12;
  return `${displayHour}:00 ${suffix}`;
};

const legacyHour = (timeOfDay) => ({ Midnight: 0, Dawn: 6, Morning: 9, Midday: 12, Afternoon: 14, Dusk: 18, Evening: 21, Night: 21 })[String(timeOfDay || '')] ?? 9;

export const getClockHour = ({ timeOfDay, worldState }) => {
  const stored = Number(worldState?.clock_hour);
  return Number.isInteger(stored) && stored >= 0 && stored < 24 ? stored : legacyHour(timeOfDay);
};

export const elapsedHoursForRest = ({ intent = 'long_rest_8h', startHour }) => {
  if (intent !== 'sleep_until_dawn') return 8;
  const toNextDawn = (5 - startHour + 24) % 24;
  return toNextDawn >= 8 ? toNextDawn : toNextDawn + 24;
};

export const advanceWorldClock = ({ timeOfDay, worldState, elapsedHours = 8, completedAt = new Date().toISOString() }) => {
  const beforeHour = getClockHour({ timeOfDay, worldState });
  const hours = Math.max(0, Number(elapsedHours) || 0);
  const afterHour = (beforeHour + hours) % 24;
  const dayRollover = Math.floor((beforeHour + hours) / 24);
  const priorDay = Number(worldState?.day ?? worldState?.date_day ?? 0) || 0;
  const afterDay = priorDay + dayRollover;
  const baseTimestamp = Date.parse(worldState?.world_clock_timestamp || completedAt);
  const timestamp = new Date((Number.isFinite(baseTimestamp) ? baseTimestamp : Date.now()) + hours * 60 * 60 * 1000).toISOString();
  const period = getPeriodForHour(afterHour);
  return {
    time_of_day: period,
    clock: { before_hour: beforeHour, after_hour: afterHour, elapsed_hours: hours, before_day: priorDay, after_day: afterDay, day_rollover: dayRollover, before_period: getPeriodForHour(beforeHour), after_period: period, period, before_label: `${formatWorldTime(beforeHour)} — ${getPeriodForHour(beforeHour)}`, after_label: `${formatWorldTime(afterHour)} — ${period}`, world_clock_timestamp: timestamp },
    world_state: { ...(worldState || {}), clock_hour: afterHour, day: priorDay + dayRollover, elapsed_hours: (Number(worldState?.elapsed_hours) || 0) + hours, world_clock_timestamp: timestamp, last_rest_completed_at: completedAt, last_rest_duration_hours: hours, last_rest_before_hour: beforeHour, last_rest_after_hour: afterHour, last_rest_day_rollover: dayRollover, last_rest_period: period },
  };
};
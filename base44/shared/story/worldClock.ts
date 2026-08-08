const PERIODS = [
  { name: 'Night', hour: 0 },
  { name: 'Dawn', hour: 5 },
  { name: 'Morning', hour: 8 },
  { name: 'Midday', hour: 11 },
  { name: 'Afternoon', hour: 14 },
  { name: 'Dusk', hour: 17 },
  { name: 'Evening', hour: 20 },
];

const normalizePeriod = (value) => PERIODS.find((period) => period.name.toLowerCase() === String(value || '').toLowerCase()) || PERIODS[2];

export const advanceWorldClock = ({ timeOfDay, worldState, elapsedHours = 8, completedAt = new Date().toISOString() }) => {
  const current = normalizePeriod(timeOfDay);
  const priorElapsed = Number(worldState?.elapsed_hours || 0);
  const nextHour = (current.hour + Number(elapsedHours || 0)) % 24;
  const next = [...PERIODS].reverse().find((period) => period.hour <= nextHour) || PERIODS[0];
  const baseTimestamp = Date.parse(worldState?.world_clock_timestamp || completedAt);
  const timestamp = new Date((Number.isFinite(baseTimestamp) ? baseTimestamp : Date.now()) + Number(elapsedHours || 0) * 60 * 60 * 1000).toISOString();
  return {
    time_of_day: next.name,
    world_state: {
      ...(worldState || {}),
      clock_hour: nextHour,
      elapsed_hours: priorElapsed + Number(elapsedHours || 0),
      world_clock_timestamp: timestamp,
      last_rest_completed_at: completedAt,
      last_rest_duration_hours: Number(elapsedHours || 0),
    },
  };
};
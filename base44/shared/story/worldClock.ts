const DAY_MS = 24 * 60 * 60 * 1000;

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

export const elapsedHoursForRest = ({ intent = 'long_rest_8h', startHour, targetPeriod = null, explicitHours = null }) => {
  const targetHour={Midnight:0,Dawn:5,Morning:8,Midday:12,Afternoon:13,Dusk:17,Evening:20,Night:23}[targetPeriod];
  const requestedTarget=intent==='sleep_until_dawn'?5:targetHour;
  let targetElapsed=0;
  if(Number.isFinite(requestedTarget)){targetElapsed=(requestedTarget-startHour+24)%24;if(targetElapsed<8)targetElapsed+=24;}
  return Math.max(8,Number(explicitHours)||0,targetElapsed);
};

export const advanceWorldClockForWait = ({ timeOfDay, worldState, elapsedHours = 0, completedAt = new Date().toISOString() }) => {
  const beforeHour = getClockHour({ timeOfDay, worldState });
  const hours = Math.max(0, Number(elapsedHours) || 0);
  const afterAbsolute = beforeHour + hours;
  const afterHour = afterAbsolute % 24;
  const dayRollover = Math.floor(afterAbsolute / 24);
  const priorDay = Number(worldState?.day ?? worldState?.date_day ?? 0) || 0;
  const baseTimestamp = Date.parse(worldState?.world_clock_timestamp || completedAt);
  const timestamp = new Date((Number.isFinite(baseTimestamp) ? baseTimestamp : Date.now()) + hours * 60 * 60 * 1000).toISOString();
  const period = getPeriodForHour(afterHour);
  return { time_of_day:period, clock:{before_hour:beforeHour,after_hour:afterHour,elapsed_hours:hours,before_day:priorDay,after_day:priorDay+dayRollover,day_rollover:dayRollover,before_period:getPeriodForHour(beforeHour),after_period:period,period,before_label:`${formatWorldTime(beforeHour)} — ${getPeriodForHour(beforeHour)}`,after_label:`${formatWorldTime(afterHour)} — ${period}`,world_clock_timestamp:timestamp}, world_state:{...(worldState||{}),clock_hour:afterHour,day:priorDay+dayRollover,elapsed_hours:(Number(worldState?.elapsed_hours)||0)+hours,world_clock_timestamp:timestamp,last_time_advance_completed_at:completedAt,last_time_advance_duration_hours:hours,last_time_advance_before_hour:beforeHour,last_time_advance_after_hour:afterHour,last_time_advance_day_rollover:dayRollover,last_time_advance_period:period} };
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
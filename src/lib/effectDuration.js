const numberOrNull = (value) => Number.isFinite(Number(value)) ? Number(value) : null;
const normalize = (value) => String(value || '').toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

export const getGameElapsedSeconds = (session = null) => {
  const seconds = numberOrNull(session?.world_state?.elapsed_game_seconds);
  if (seconds != null) return Math.max(0, seconds);
  const hours = numberOrNull(session?.world_state?.elapsed_hours);
  return hours == null ? 0 : Math.max(0, hours * 3600);
};

const durationSecondsFor = (entry = {}, name = '') => {
  const stored = numberOrNull(entry?.duration_seconds);
  if (stored != null && stored >= 0) return stored;
  const match = String(entry?.duration || '').match(/(\d+(?:\.\d+)?)\s*(round|minute|hour|day)/i);
  if (match) return Number(match[1]) * ({ round: 6, minute: 60, hour: 3600, day: 86400 }[match[2].toLowerCase()] || 0);
  const applied = Date.parse(entry?.applied_at || ''), expires = Date.parse(entry?.expires_at || '');
  if (Number.isFinite(applied) && Number.isFinite(expires) && expires >= applied) return (expires - applied) / 1000;
  return normalize(name || entry?.spell_name || entry?.source || entry?.name) === 'pass without trace' ? 3600 : null;
};

const explicitElapsedAfter = (entry, session) => {
  const applied = Date.parse(entry?.applied_at || '');
  if (!Number.isFinite(applied)) return 0;
  return [...(session?.world_state?.__time_advance_receipts || []), ...(session?.world_state?.__rest_receipts || []), ...(session?.world_state?.__combat_time_receipts || [])].filter((receipt) => Date.parse(receipt?.at || receipt?.completed_at || '') > applied).reduce((total, receipt) => {
    const seconds = numberOrNull(receipt?.elapsed_seconds ?? receipt?.clock?.elapsed_seconds ?? receipt?.response?.clock?.elapsed_seconds);
    if (seconds != null) return total + Math.max(0, seconds);
    const hours = numberOrNull(receipt?.elapsed_hours ?? receipt?.clock?.elapsed_hours ?? receipt?.response?.clock?.elapsed_hours);
    return total + Math.max(0, (hours || 0) * 3600);
  }, 0);
};

export const evaluateEffectDuration = ({ entry = {}, session = null, name = '' }) => {
  if (entry?.broken === true) return { expired: true, remaining_seconds: 0, basis: 'concentration_broken' };
  if (entry?.game_time_expired === true || Number(entry?.remaining_duration_minutes) === 0) return { expired: true, remaining_seconds: 0, basis: 'explicit_expired' };
  const now = getGameElapsedSeconds(session), duration = durationSecondsFor(entry, name);
  const start = numberOrNull(entry?.start_game_time_seconds ?? (numberOrNull(entry?.applied_game_elapsed_hours) == null ? null : Number(entry.applied_game_elapsed_hours) * 3600));
  const storedExpiry = numberOrNull(entry?.expires_game_time_seconds ?? (numberOrNull(entry?.expires_game_elapsed_hours) == null ? null : Number(entry.expires_game_elapsed_hours) * 3600));
  const expires = storedExpiry ?? (start != null && duration != null ? start + duration : null);
  if (expires != null) return { expired: now >= expires, remaining_seconds: Math.max(0, expires - now), basis: 'game_time' };
  if (duration != null) { const elapsed = explicitElapsedAfter(entry, session); return { expired: elapsed >= duration, remaining_seconds: Math.max(0, duration - elapsed), basis: 'legacy_explicit_game_time_evidence', migration_provenance: 'legacy_timestamp_conservatively_evaluated' }; }
  return { expired: false, remaining_seconds: null, basis: 'concentration_or_persistent', migration_provenance: entry?.expires_at ? 'legacy_timestamp_without_game_time_kept_active' : null };
};
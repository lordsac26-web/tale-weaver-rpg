export const EFFECT_DURATION_VERSION = 'monotonic-game-time-v1.0.0';

const numberOrNull = (value) => value === null || value === undefined || value === '' || typeof value === 'boolean' ? null : Number.isFinite(Number(value)) ? Number(value) : null;
const normalize = (value) => String(value || '').toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

export function getGameElapsedSeconds(session = null) {
  const seconds = numberOrNull(session?.world_state?.elapsed_game_seconds);
  if (seconds != null) return Math.max(0, seconds);
  const hours = numberOrNull(session?.world_state?.elapsed_hours);
  return hours == null ? 0 : Math.max(0, hours * 3600);
}

export function durationSecondsFor(entry = {}, name = '') {
  const stored = numberOrNull(entry?.duration_seconds);
  if (stored != null && stored >= 0) return stored;
  const match = String(entry?.duration || '').match(/(\d+(?:\.\d+)?)\s*(round|minute|hour|day)/i);
  if (match) {
    const amount = Number(match[1]);
    const unit = match[2].toLowerCase();
    return amount * ({ round: 6, minute: 60, hour: 3600, day: 86400 }[unit] || 0);
  }
  const applied = Date.parse(entry?.applied_at || '');
  const expires = Date.parse(entry?.expires_at || '');
  if (Number.isFinite(applied) && Number.isFinite(expires) && expires >= applied) return (expires - applied) / 1000;
  const identity = normalize(name || entry?.spell_name || entry?.source || entry?.name);
  if (identity === 'pass without trace' || identity === 'longstrider') return 3600;
  return null;
}

function explicitElapsedAfter(entry, session) {
  const applied = Date.parse(entry?.applied_at || '');
  if (!Number.isFinite(applied)) return 0;
  const receipts = [
    ...(session?.world_state?.__time_advance_receipts || []),
    ...(session?.world_state?.__rest_receipts || []),
    ...(session?.world_state?.__combat_time_receipts || []),
  ];
  return receipts.filter((receipt) => Date.parse(receipt?.at || receipt?.completed_at || '') > applied).reduce((total, receipt) => {
    const seconds = numberOrNull(receipt?.elapsed_seconds ?? receipt?.clock?.elapsed_seconds ?? receipt?.response?.clock?.elapsed_seconds);
    if (seconds != null) return total + Math.max(0, seconds);
    const hours = numberOrNull(receipt?.elapsed_hours ?? receipt?.clock?.elapsed_hours ?? receipt?.response?.clock?.elapsed_hours);
    return total + Math.max(0, (hours || 0) * 3600);
  }, 0);
}

export function evaluateEffectDuration({ entry = {}, session = null, name = '' }) {
  if (entry?.broken === true) return { active: false, expired: true, remaining_seconds: 0, basis: 'concentration_broken', migration_provenance: null };
  if (entry?.game_time_expired === true || Number(entry?.remaining_duration_minutes) === 0) return { active: false, expired: true, remaining_seconds: 0, basis: 'explicit_expired', migration_provenance: null };
  const now = getGameElapsedSeconds(session);
  const duration = durationSecondsFor(entry, name);
  const startSeconds = numberOrNull(entry?.start_game_time_seconds ?? (numberOrNull(entry?.applied_game_elapsed_hours) == null ? null : Number(entry.applied_game_elapsed_hours) * 3600));
  const expirySeconds = numberOrNull(entry?.expires_game_time_seconds ?? (numberOrNull(entry?.expires_game_elapsed_hours) == null ? null : Number(entry.expires_game_elapsed_hours) * 3600));
  const expires = expirySeconds ?? (startSeconds != null && duration != null ? startSeconds + duration : null);
  if (expires != null) {
    const remaining = Math.max(0, expires - now);
    return { active: remaining > 0, expired: remaining <= 0, remaining_seconds: remaining, basis: 'game_time', migration_provenance: null, start_game_time_seconds: startSeconds, expires_game_time_seconds: expires };
  }
  if (duration != null) {
    const elapsed = explicitElapsedAfter(entry, session);
    const remaining = Math.max(0, duration - elapsed);
    return { active: remaining > 0, expired: remaining <= 0, remaining_seconds: remaining, basis: 'legacy_game_time_evidence', migration_provenance: 'legacy_timestamp_conservatively_evaluated', duration_seconds: duration, explicit_elapsed_seconds: elapsed };
  }
  return { active: true, expired: false, remaining_seconds: null, basis: 'concentration_or_persistent', migration_provenance: entry?.expires_at ? 'legacy_timestamp_without_game_time_kept_active' : null };
}

export function withGameTimeDuration(entry = {}, session = null, name = '') {
  const duration = durationSecondsFor(entry, name);
  if (duration == null) return entry;
  const start = getGameElapsedSeconds(session);
  return { ...entry, duration_type: 'game_elapsed', expiration_rule: 'game_time', start_game_time_seconds: start, duration_seconds: duration, expires_game_time_seconds: start + duration, applied_game_elapsed_hours: start / 3600, expires_game_elapsed_hours: (start + duration) / 3600 };
}
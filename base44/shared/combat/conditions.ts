// Structured condition / effect lifecycle helper (Tale Weaver P1 — Part B).
//
// NEW condition/effect writes go through this helper so every fresh condition is
// a structured object with a stable id, canonical name, source, target, timing,
// and save metadata. Legacy strings and minimal objects are still READ tolerantly
// (no destructive bulk migration) — readers should use readConditionNames/hasCondition.
//
// Duration types:
//   persistent      — no expiry
//   rounds          — expires after N rounds (remaining_rounds)
//   until_turn_start / until_turn_end — expired by the authoritative turn transition
//   until_rest      — cleared by a rest transition
//   timestamp       — expires at an absolute ISO time (expires_at)
//   concentration   — linked to a concentration slot; cleared on concentration break
//   save_ends       — the affected creature re-saves each turn (save_ends + save metadata)

export const normalizeConditionName = (value) =>
  String(value || '').toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

// Build a structured condition object. Returns null if a required field is missing
// (callers must treat null as a rejected write — never store an unstructured mystery).
export const buildStructuredCondition = ({
  name,
  source = null,
  target_id = null,
  caster_id = null,
  duration_type = 'persistent',
  expires_round = null,
  expires_at = null,
  remaining_rounds = null,
  expiration_timing = null,
  save_dc = null,
  save_ability = null,
  save_ends = false,
  break_on_attack = null,
  concentration = false,
  metadata = {},
} = {}) => {
  const canonical = normalizeConditionName(name);
  if (!canonical) return null;
  const display_name = String(name || '')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/\s+/g, ' ')
    .trim();
  const now = Date.now();
  return {
    id: `cond_${canonical.replace(/ /g, '_')}_${now}_${Math.random().toString(36).slice(2, 8)}`,
    name: canonical,
    display_name,
    source: source || null,
    target_id: target_id || null,
    caster_id: caster_id || null,
    applied_at: new Date(now).toISOString(),
    duration_type,
    expires_round: expires_round,
    expires_at: expires_at,
    remaining_rounds: remaining_rounds,
    expiration_timing: expiration_timing,
    save_dc: save_dc,
    save_ability: save_ability,
    save_ends: !!save_ends,
    break_on_attack: break_on_attack,
    concentration: !!concentration,
    metadata: metadata || {},
  };
};

// Read a mixed condition array (strings | minimal objects | structured objects)
// and return a list of canonical lowercase names for tolerant membership checks.
export const readConditionNames = (arr) =>
  (arr || []).map((c) => normalizeConditionName(typeof c === 'string' ? c : c?.name));

export const hasCondition = (arr, name) => readConditionNames(arr).includes(normalizeConditionName(name));

// Read the structured object for a condition (or null), tolerating legacy forms.
export const getConditionObj = (arr, name) => {
  const target = normalizeConditionName(name);
  return (arr || []).find((c) => {
    const cn = normalizeConditionName(typeof c === 'string' ? c : c?.name);
    return cn === target;
  }) || null;
};

// Add a structured condition, deduping by (name, source, target_id) unless the
// condition explicitly opts into stacking (metadata.stackable === true). When a
// matching condition already exists and is not stackable, it is REPLACED with the
// new structured object (preserving any prior applied_at when the new one lacks it).
export const addStructuredCondition = (arr, cond) => {
  if (!cond || !cond.name) return Array.isArray(arr) ? [...arr] : [];
  const list = Array.isArray(arr) ? [...arr] : [];
  const idx = list.findIndex((c) => {
    const cn = normalizeConditionName(typeof c === 'string' ? c : c?.name);
    const cs = normalizeConditionName(typeof c === 'string' ? '' : c?.source);
    const ct = typeof c === 'object' ? c?.target_id ?? null : null;
    return cn === cond.name && cs === normalizeConditionName(cond.source || '') && ct === (cond.target_id || null);
  });
  if (idx >= 0 && !cond.metadata?.stackable) {
    const prior = list[idx];
    const merged = { ...(typeof prior === 'object' ? prior : { name: prior }), ...cond };
    if (!cond.applied_at && typeof prior === 'object' && prior?.applied_at) merged.applied_at = prior.applied_at;
    list[idx] = merged;
    return list;
  }
  list.push(cond);
  return list;
};

// Remove conditions matching a canonical name, optionally restricted by source.
export const removeConditions = (arr, name, { source = null } = {}) => {
  const target = normalizeConditionName(name);
  const src = source ? normalizeConditionName(source) : null;
  return (arr || []).filter((c) => {
    const cn = normalizeConditionName(typeof c === 'string' ? c : c?.name);
    if (cn !== target) return true;
    if (src) {
      const cs = normalizeConditionName(typeof c === 'string' ? '' : c?.source);
      return cs !== src;
    }
    return false;
  });
};

// Remove all concentration-linked conditions (used when concentration breaks).
export const removeConcentrationConditions = (arr) =>
  (arr || []).filter((c) => {
    if (typeof c === 'string') return true;
    return !c?.concentration;
  });

// Deterministic expiry pass for authoritative turn/rest transitions. Legacy
// values remain readable and untouched because they have no lifecycle metadata.
export const expireStructuredConditions = (arr, { phase, round = null, now = Date.now(), resting = false } = {}) =>
  (arr || []).filter((condition) => {
    if (!condition || typeof condition === 'string') return true;
    if (resting && condition.duration_type === 'until_rest') return false;
    if (condition.duration_type === 'timestamp' && condition.expires_at && new Date(condition.expires_at).getTime() <= now) return false;
    if (condition.duration_type === 'rounds' && Number.isFinite(Number(condition.expires_round)) && Number(round) >= Number(condition.expires_round)) return false;
    if (condition.duration_type === 'until_turn_start' && phase === 'turn_start') return false;
    if (condition.duration_type === 'until_turn_end' && phase === 'turn_end') return false;
    return true;
  });

// Structured stealth, hidden, concealment, and invisibility states contribute
// the same named advantage source through the single attack-roll resolver.
export const getAttackConcealment = (arr) => {
  const names = new Set(['stealthed', 'hidden', 'concealed', 'invisible']);
  return (arr || []).filter((condition) => typeof condition === 'object' && condition && names.has(normalizeConditionName(condition.name)));
};

// Only effects explicitly marked as ending on attack are consumed. This preserves
// effects such as Greater Invisibility without special-case client logic.
export const consumeBreakOnAttackConditions = (arr) =>
  (arr || []).filter((condition) => !(typeof condition === 'object' && condition?.break_on_attack));
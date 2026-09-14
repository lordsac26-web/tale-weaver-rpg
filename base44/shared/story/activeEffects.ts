import { deriveCanonicalSpellSlots } from '../spells/slotProgression.ts';

export const ACTIVE_EFFECTS_VERSION = 'active-effects-truth-v1.1.0';

const PLACEHOLDERS = new Set(['', 'none', 'normal', 'no condition', 'no conditions', 'n/a', 'null', 'undefined']);
const HINDRANCE_KEYS = new Set(['blinded','charmed','deafened','frightened','grappled','incapacitated','paralyzed','petrified','poisoned','prone','restrained','stunned','unconscious','silenced','silence','exhausted','exhaustion','cursed','wanted','hunted','wounded','bleeding']);
const MECHANICAL_EFFECTS = {
  'pass without trace': '+10 to Dexterity (Stealth) checks',
  'hunters mark': "+1d6 damage on weapon hits against the marked target",
  longstrider: '+10 feet movement speed',
  alert: '+5 initiative; cannot be surprised',
  'blessed by the circle of the reeds': 'Blessing of the Circle of the Reeds (druid circle boon)',
  'protected by the circle of the reeds': 'Ward of the Circle of the Reeds (druid circle protection)',
  restored: 'Fully restored by the druid circle (narrative recovery)',
  wanted: 'Actively hunted by authorities (social risk)',
  stealthed: 'Hidden from view; attackers do not gain advantage from sight',
};

const conditionName = (value) => String(typeof value === 'string' ? value : value?.name || '').trim();
const conditionKey = (value) => String(typeof value === 'string' ? value : value?.display_name || value?.name || '').toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
const isValidCondition = (value) => !PLACEHOLDERS.has(conditionKey(value));
const normalizeKey = (value) => conditionKey(value).replace(/\s+/g, ' ');

// Near-duplicate persistent story conditions collapse to one stable canonical name.
const CANONICAL_STORY_CONDITIONS = [
  { match: /^protected by (?:the )?circle(?: of the reeds)?$/, canonical: 'Protected by the Circle of the Reeds' },
  { match: /^blessed by (?:the )?(?:reeds|circle)(?: of the reeds)?$/, canonical: 'Blessed by the Circle of the Reeds' },
];

export function canonicalStoryConditionName(name) {
  const key = normalizeKey(name);
  const rule = CANONICAL_STORY_CONDITIONS.find((entry) => entry.match.test(key));
  return rule ? rule.canonical : conditionName(name);
}

/** Collapse near-duplicate persistent story conditions without losing narrative meaning. */
export function normalizeStoryConditions(conditions = []) {
  const byKey = new Map();
  const result = [];
  for (const condition of conditions) {
    if (!isValidCondition(condition)) continue;
    const canonical = canonicalStoryConditionName(conditionName(condition));
    const key = canonical.toLowerCase();
    if (!byKey.has(key)) {
      byKey.set(key, result.length);
      result.push(typeof condition === 'string' ? { name: canonical, source: 'story', duration: 'persistent' } : { ...condition, name: canonical });
    } else {
      const kept = result[byKey.get(key)];
      const keptAt = Date.parse(kept.applied_at || '') || Infinity;
      const nextAt = Date.parse(condition.applied_at || '') || Infinity;
      if (nextAt < keptAt) result[byKey.get(key)] = { ...condition, name: canonical };
    }
  }
  return result;
}

const remainingFromExpiry = (expiresAt, now) => {
  const ms = Date.parse(expiresAt || '') - now;
  if (!Number.isFinite(ms) || ms <= 0) return null;
  const minutes = Math.round(ms / 60000);
  if (minutes < 60) return `${Math.max(1, minutes)} minute${minutes === 1 ? '' : 's'} remaining`;
  const hours = Math.round(minutes / 60);
  return `${hours} hour${hours === 1 ? '' : 's'} remaining`;
};

const gameElapsedHours = (session) => { const value = Number(session?.world_state?.elapsed_hours); return Number.isFinite(value) ? value : null; };
const finiteHoursFor = (name, entry) => {
  const match = String(entry?.duration || '').match(/(\d+(?:\.\d+)?)\s*(minute|hour)/i);
  if (match) return Number(match[1]) * (match[2].toLowerCase() === 'hour' ? 1 : 1 / 60);
  return normalizeKey(name) === 'longstrider' ? 1 : null;
};
const authoritativeElapsedAfter = (entry, session) => {
  const applied = Date.parse(entry?.applied_at || '');
  if (!Number.isFinite(applied)) return 0;
  const rests = (session?.world_state?.__rest_receipts || []).filter((receipt) => Date.parse(receipt?.completed_at || '') > applied).reduce((sum, receipt) => sum + (Number(receipt?.response?.clock?.elapsed_hours) || Number(receipt?.response?.clock?.elapsedHours) || 0), 0);
  const waits = (session?.world_state?.__time_advance_receipts || []).filter((receipt) => Date.parse(receipt?.at || '') > applied).reduce((sum, receipt) => sum + (Number(receipt?.clock?.elapsed_hours) || 0), 0);
  return rests + waits;
};
const expiryFor = (name, entry, session, now) => {
  const wallExpiry = Date.parse(entry?.expires_at || '');
  if (Number.isFinite(wallExpiry) && now >= wallExpiry) return { expired: true, remaining: 0, basis: 'timestamp' };
  const gameNow = gameElapsedHours(session);
  const gameExpiry = Number(entry?.expires_game_elapsed_hours);
  if (gameNow != null && Number.isFinite(gameExpiry)) return { expired: gameNow >= gameExpiry, remaining: Math.max(0, gameExpiry - gameNow), basis: 'game_time' };
  const finiteHours = finiteHoursFor(name, entry);
  if (gameNow != null && entry?.duration === 'persistent' && finiteHours != null && authoritativeElapsedAfter(entry, session) >= finiteHours) return { expired: true, remaining: 0, basis: 'legacy_game_time_evidence' };
  const remaining = entry?.expires_at && gameNow == null ? remainingFromExpiry(entry.expires_at, now) : null;
  return { expired: !!entry?.expires_at && gameNow == null && !remaining, remaining, basis: entry?.expires_at ? 'wall_time_without_game_clock' : null };
};
const remainingLabel = (expiry, entry) => expiry.basis === 'game_time' ? `${Math.max(1, Math.ceil(expiry.remaining * 60))} minute${Math.ceil(expiry.remaining * 60) === 1 ? '' : 's'} remaining` : expiry.remaining || entry?.duration || 'persistent';

const effectFor = (name, entry) => {
  const key = normalizeKey(name);
  const fromEntry = typeof entry === 'object' && typeof entry.effect === 'string' ? entry.effect : null;
  return MECHANICAL_EFFECTS[key] || fromEntry || 'Ongoing story effect';
};

const kindFor = (name) => HINDRANCE_KEYS.has(normalizeKey(name)) ? 'hindrance' : 'buff';

/**
 * Authoritative active-effect truth, evaluated at call time (expiry, concentration,
 * rest state). The ONLY source of mechanical bonuses for narration, Ask the DM
 * state queries, and the status panel.
 */
export function effectiveMovementSpeed(character = {}, session = null) {
  const truth = evaluateActiveEffects({ character, session });
  const bonus = truth.active.filter((entry) => normalizeKey(entry.name) === 'longstrider').reduce((sum) => sum + 10, 0);
  return Math.max(0, Number(character.speed) || 30) + bonus;
}

export function evaluateActiveEffects({ character = {}, session = null, now = Date.now() }) {
  const active = [];
  const expired = [];
  const seen = new Set();
  const push = (entry) => {
    const key = `${entry.name.toLowerCase()}:${entry.kind}`;
    if (seen.has(key)) return;
    seen.add(key);
    active.push(entry);
  };

  for (const condition of Array.isArray(character.conditions) ? character.conditions : []) {
    if (!isValidCondition(condition)) continue;
    const name = canonicalStoryConditionName(conditionName(condition));
    const expiry = expiryFor(name, condition, session, now);
    const base = { name, source: (typeof condition === 'object' && condition.source) || 'story', kind: kindFor(name) };
    if (expiry.expired) { expired.push({ ...base, expired_at: condition?.expires_at || null, expiration_basis: expiry.basis }); continue; }
    push({ ...base, mechanical_effect: effectFor(name, condition), remaining_duration: remainingLabel(expiry, condition) });
  }

  const concentration = session?.world_state?.active_concentration || null;
  if (concentration && concentration.concentration !== false) {
    const name = conditionName(concentration.spell_name);
    const expiry = expiryFor(name, concentration, session, now);
    const base = { name, source: name, kind: kindFor(name) };
    if (expiry.expired) expired.push({ ...base, expired_at: concentration.expires_at || null, expiration_basis: expiry.basis });
    else push({ ...base, mechanical_effect: effectFor(name, concentration), remaining_duration: expiry.basis === 'game_time' ? remainingLabel(expiry, concentration) : `${concentration.duration || 'concentration'} (until concentration ends)` });
  }

  for (const modifier of Array.isArray(character.active_modifiers) ? character.active_modifiers : []) {
    const name = conditionName(modifier?.source || modifier?.effect || 'Active effect');
    const expiry = expiryFor(name, modifier, session, now);
    const base = { name, source: name, kind: kindFor(modifier?.effect || name) };
    if (expiry.expired) { expired.push({ ...base, expired_at: modifier?.expires_at || null, expiration_basis: expiry.basis }); continue; }
    if (modifier?.concentration && concentration && normalizeKey(concentration.spell_name) === normalizeKey(modifier.source)) continue;
    const effect = modifier?.effect === 'skill_bonus' ? `+${Number(modifier.bonus) || 0} ${modifier.skill || ''} checks`.trim() : effectFor(name, modifier);
    push({ ...base, mechanical_effect: effect, remaining_duration: remainingLabel(expiry, modifier) });
  }

  const slotProgression = deriveCanonicalSpellSlots(character);
  const used = character.spell_slots || {};
  const spell_slots = slotProgression.max_slots.map((max, index) => {
    const level = index + 1;
    const usedCount = Number(used[`level_${level}`]) || 0;
    return { level, max, used: usedCount, remaining: Math.max(0, max - usedCount) };
  }).filter((entry) => entry.max > 0);

  return {
    version: ACTIVE_EFFECTS_VERSION,
    active,
    expired,
    hindrances: active.filter((entry) => entry.kind === 'hindrance'),
    buffs: active.filter((entry) => entry.kind !== 'hindrance'),
    spell_slots,
    slot_derivation: slotProgression.derivation,
    attunements: Array.isArray(character.attuned_items) ? character.attuned_items.filter(Boolean) : [],
    exhaustion_level: Number(character.exhaustion_level || 0),
  };
}
import { deriveCanonicalSpellSlots } from '../spells/slotProgression.ts';

export const ACTIVE_EFFECTS_VERSION = 'active-effects-truth-v1.0.0';

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
    const expiresAt = typeof condition === 'object' ? condition.expires_at : null;
    const remaining = expiresAt ? remainingFromExpiry(expiresAt, now) : null;
    const name = canonicalStoryConditionName(conditionName(condition));
    const base = { name, source: (typeof condition === 'object' && condition.source) || 'story', kind: kindFor(name) };
    if (expiresAt && !remaining) { expired.push({ ...base, expired_at: expiresAt }); continue; }
    push({ ...base, mechanical_effect: effectFor(name, condition), remaining_duration: remaining || (typeof condition === 'object' && condition.duration) || 'persistent' });
  }

  const concentration = session?.world_state?.active_concentration || null;
  if (concentration && concentration.concentration !== false) {
    const name = conditionName(concentration.spell_name);
    const remaining = concentration.expires_at ? remainingFromExpiry(concentration.expires_at, now) : null;
    const base = { name, source: name, kind: kindFor(name) };
    if (concentration.expires_at && !remaining) expired.push({ ...base, expired_at: concentration.expires_at });
    else push({ ...base, mechanical_effect: effectFor(name, concentration), remaining_duration: remaining || `${concentration.duration || 'concentration'} (until concentration ends)` });
  }

  for (const modifier of Array.isArray(character.active_modifiers) ? character.active_modifiers : []) {
    const remaining = modifier?.expires_at ? remainingFromExpiry(modifier.expires_at, now) : null;
    const name = conditionName(modifier?.source || modifier?.effect || 'Active effect');
    const base = { name, source: name, kind: kindFor(modifier?.effect || name) };
    if (modifier?.expires_at && !remaining) { expired.push({ ...base, expired_at: modifier.expires_at }); continue; }
    if (modifier?.concentration && concentration && normalizeKey(concentration.spell_name) === normalizeKey(modifier.source)) continue;
    const effect = modifier?.effect === 'skill_bonus' ? `+${Number(modifier.bonus) || 0} ${modifier.skill || ''} checks`.trim() : effectFor(name, modifier);
    push({ ...base, mechanical_effect: effect, remaining_duration: remaining || 'persistent' });
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
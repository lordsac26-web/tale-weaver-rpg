/**
 * Frontend mirror of base44/shared/story/activeEffects.ts (the boundary check
 * blocks new cross-boundary imports). Same truth the Ask the DM queries read:
 * conditions with expiry/concentration evaluated at call time, explicit spell
 * slots (max + used per level), and attunements. Keep in sync with the shared
 * module when rules change.
 */
const FULL=[[2],[3],[4,2],[4,3],[4,3,2],[4,3,3],[4,3,3,1],[4,3,3,2],[4,3,3,3,1],[4,3,3,3,2],[4,3,3,3,2,1],[4,3,3,3,2,1],[4,3,3,3,2,1,1],[4,3,3,3,2,1,1],[4,3,3,3,2,1,1,1],[4,3,3,3,2,1,1,1],[4,3,3,3,2,1,1,1,1],[4,3,3,3,3,1,1,1,1],[4,3,3,3,3,2,1,1,1],[4,3,3,3,3,2,2,1,1]];
const HALF=[[0],[2],[3],[3],[4,2],[4,2],[4,3],[4,3],[4,3,2],[4,3,2],[4,3,3],[4,3,3],[4,3,3,1],[4,3,3,1],[4,3,3,2],[4,3,3,2],[4,3,3,3,1],[4,3,3,3,1],[4,3,3,3,2],[4,3,3,3,2]];
const WARLOCK=[[1],[2],[0,2],[0,2],[0,0,2],[0,0,2],[0,0,0,2],[0,0,0,2],[0,0,0,0,2],[0,0,0,0,2],[0,0,0,0,3],[0,0,0,0,3],[0,0,0,0,3],[0,0,0,0,3],[0,0,0,0,3],[0,0,0,0,3],[0,0,0,0,4],[0,0,0,0,4],[0,0,0,0,4],[0,0,0,0,4]];
const TABLES={Wizard:FULL,Sorcerer:FULL,Bard:FULL,Cleric:FULL,Druid:FULL,Paladin:HALF,Ranger:HALF,Artificer:HALF,Warlock:WARLOCK};

const PLACEHOLDERS = new Set(['', 'none', 'normal', 'no condition', 'no conditions', 'n/a', 'null', 'undefined']);
const HINDRANCE_KEYS = new Set(['blinded','charmed','deafened','frightened','grappled','incapacitated','paralyzed','petrified','poisoned','prone','restrained','stunned','unconscious','silenced','silence','exhausted','exhaustion','cursed','wanted','hunted','wounded','bleeding']);
const MECHANICAL_EFFECTS = {
  'pass without trace': '+10 to Dexterity (Stealth) checks',
  "hunter's mark": '+1d6 damage on weapon hits against the marked target',
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
const normalizeKey = (value) => conditionKey(value).replace(/\s+/g, ' ');
const isValidCondition = (value) => !PLACEHOLDERS.has(conditionKey(value));

const CANONICAL_STORY_CONDITIONS = [
  { match: /^protected by (?:the )?circle(?: of the reeds)?$/, canonical: 'Protected by the Circle of the Reeds' },
  { match: /^blessed by (?:the )?(?:reeds|circle)(?: of the reeds)?$/, canonical: 'Blessed by the Circle of the Reeds' },
];

export function canonicalStoryConditionName(name) {
  const key = normalizeKey(name);
  const rule = CANONICAL_STORY_CONDITIONS.find((entry) => entry.match.test(key));
  return rule ? rule.canonical : conditionName(name);
}

const getCharacterClassBreakdown = (character = {}) => {
  const secondary = Array.isArray(character.multiclass) ? character.multiclass.filter((entry) => entry?.class && Number(entry.levels) > 0) : [];
  const total = Math.max(1, Number(character.level) || 1);
  const secondaryLevels = secondary.reduce((sum, entry) => sum + Number(entry.levels || 0), 0);
  return [{ className: character.class, subclass: character.subclass || '', levels: Math.max(1, total - secondaryLevels), primary: true }, ...secondary.map((entry) => ({ className: entry.class, subclass: entry.subclass || '', levels: Number(entry.levels), primary: false }))].filter((entry) => entry.className);
};

const isThird = (entry) => ['Fighter', 'Rogue'].includes(entry.className) && /eldritch knight|arcane trickster/i.test(entry.subclass || '');
const isCaster = (entry) => !!TABLES[entry.className] || isThird(entry);
const contribution = (entry) => ['Wizard','Sorcerer','Bard','Cleric','Druid'].includes(entry.className) ? entry.levels : entry.className === 'Artificer' ? Math.ceil(entry.levels / 2) : ['Paladin','Ranger'].includes(entry.className) ? Math.floor(entry.levels / 2) : isThird(entry) ? Math.floor(entry.levels / 3) : 0;

const deriveCanonicalSpellSlots = (character = {}) => {
  const classes = getCharacterClassBreakdown(character);
  const casters = classes.filter(isCaster);
  const standard = casters.filter((entry) => entry.className !== 'Warlock');
  const warlocks = casters.filter((entry) => entry.className === 'Warlock');
  let slots = [];
  let derivation = 'no_spellcasting';
  if (standard.length === 1) {
    const entry = standard[0];
    const effective = isThird(entry) ? Math.floor(entry.levels / 3) : entry.levels;
    slots = (isThird(entry) ? FULL : TABLES[entry.className])?.[Math.max(0, effective - 1)] || [];
    derivation = `single ${entry.className} ${entry.levels}`;
  } else if (standard.length > 1) {
    const casterLevel = Math.min(20, standard.reduce((sum, entry) => sum + contribution(entry), 0));
    slots = casterLevel > 0 ? (FULL[casterLevel - 1] || []) : [];
    derivation = `multiclass caster level ${casterLevel}`;
  }
  if (warlocks.length) {
    const level = warlocks.reduce((sum, entry) => sum + entry.levels, 0);
    const pact = WARLOCK[Math.min(20, level) - 1] || [];
    slots = Array.from({ length: Math.max(slots.length, pact.length) }, (_, index) => (slots[index] || 0) + (pact[index] || 0));
    derivation += `${standard.length ? ' + ' : ''}Warlock ${level}`;
  }
  return { class_breakdown: classes, max_slots: slots, derivation };
};

const remainingFromExpiry = (expiresAt, now) => {
  const ms = Date.parse(expiresAt || '') - now;
  if (!Number.isFinite(ms) || ms <= 0) return null;
  const minutes = Math.round(ms / 60000);
  if (minutes < 60) return `${Math.max(1, minutes)} minute${minutes === 1 ? '' : 's'} remaining`;
  const hours = Math.round(minutes / 60);
  return `${hours} hour${hours === 1 ? '' : 's'} remaining`;
};

const effectFor = (name, entry) => {
  const fromEntry = typeof entry === 'object' && typeof entry.effect === 'string' ? entry.effect : null;
  return MECHANICAL_EFFECTS[normalizeKey(name)] || fromEntry || 'Ongoing story effect';
};

const kindFor = (name) => HINDRANCE_KEYS.has(normalizeKey(name)) ? 'hindrance' : 'buff';

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
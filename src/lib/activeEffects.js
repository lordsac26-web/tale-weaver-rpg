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

const gameElapsedHours = (session) => { const value = Number(session?.world_state?.elapsed_hours); return Number.isFinite(value) ? value : null; };
const finiteHoursFor = (name, entry) => { const match=String(entry?.duration||'').match(/(\d+(?:\.\d+)?)\s*(minute|hour)/i); if(match)return Number(match[1])*(match[2].toLowerCase()==='hour'?1:1/60); return normalizeKey(name)==='longstrider'?1:null; };
const authoritativeElapsedAfter = (entry, session) => { const applied=Date.parse(entry?.applied_at||''); if(!Number.isFinite(applied))return 0; const rests=(session?.world_state?.__rest_receipts||[]).filter(r=>Date.parse(r?.completed_at||'')>applied).reduce((sum,r)=>sum+(Number(r?.response?.clock?.elapsed_hours)||0),0); const waits=(session?.world_state?.__time_advance_receipts||[]).filter(r=>Date.parse(r?.at||'')>applied).reduce((sum,r)=>sum+(Number(r?.clock?.elapsed_hours)||0),0); return rests+waits; };
const expiryFor = (name, entry, session, now) => { const gameNow=gameElapsedHours(session),gameExpiry=Number(entry?.expires_game_elapsed_hours); if(gameNow!=null&&Number.isFinite(gameExpiry))return{expired:gameNow>=gameExpiry,remaining:Math.max(0,gameExpiry-gameNow),basis:'game_time'}; const hours=finiteHoursFor(name,entry); if(gameNow!=null&&entry?.duration==='persistent'&&hours!=null&&authoritativeElapsedAfter(entry,session)>=hours)return{expired:true,remaining:0,basis:'legacy_game_time_evidence'}; const remaining=entry?.expires_at&&gameNow==null?remainingFromExpiry(entry.expires_at,now):null; return{expired:!!entry?.expires_at&&gameNow==null&&!remaining,remaining,basis:entry?.expires_at?'wall_time_without_game_clock':null}; };
const remainingLabel=(expiry,entry)=>expiry.basis==='game_time'?`${Math.max(1,Math.ceil(expiry.remaining*60))} minute${Math.ceil(expiry.remaining*60)===1?'':'s'} remaining`:expiry.remaining||entry?.duration||'persistent';

const effectFor = (name, entry) => {
  const fromEntry = typeof entry === 'object' && typeof entry.effect === 'string' ? entry.effect : null;
  return MECHANICAL_EFFECTS[normalizeKey(name)] || fromEntry || 'Ongoing story effect';
};

const kindFor = (name) => HINDRANCE_KEYS.has(normalizeKey(name)) ? 'hindrance' : 'buff';

export function effectiveMovementSpeed(character = {}, session = null) { const truth=evaluateActiveEffects({character,session}); return Math.max(0,Number(character.speed)||30)+(truth.active.some(entry=>normalizeKey(entry.name)==='longstrider')?10:0); }

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
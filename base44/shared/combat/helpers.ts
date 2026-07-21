// Shared combat helpers — dice, damage modifiers, condition logic, attack rolls,
// action economy, and turn advancement. Extracted verbatim from combatEngine/entry.ts.

export const statMod = (stat) => Math.floor(((stat || 10) - 10) / 2);
export const rollD20 = () => Math.floor(Math.random() * 20) + 1;
export const rollDice = (sides) => Math.floor(Math.random() * sides) + 1;

// Cantrip damage scaling: doubles at char levels 5, 11, 17 (PHB p.205)
export const scaleCantripDice = (damageDice, characterLevel) => {
  if (!damageDice || damageDice === '0') return damageDice;
  const m = damageDice.match(/^(\d+)d(\d+)$/);
  if (!m) return damageDice;
  const baseDice = parseInt(m[1]);
  const sides = parseInt(m[2]);
  const mult = characterLevel >= 17 ? 4 : characterLevel >= 11 ? 3 : characterLevel >= 5 ? 2 : 1;
  return `${baseDice * mult}d${sides}`;
};

// Spellcasting ability by class (server-side authoritative copy)
export const SPELL_ABILITY_MAP = {
  wizard: 'intelligence', artificer: 'intelligence',
  eldritch_knight: 'intelligence', arcane_trickster: 'intelligence',
  cleric: 'wisdom', druid: 'wisdom', ranger: 'wisdom',
  bard: 'charisma', paladin: 'charisma', sorcerer: 'charisma', warlock: 'charisma'
};

// Roll dice string (e.g. "3d6") and return total
export const rollDiceStr = (diceStr) => {
  const m = (diceStr || '').match(/^(\d+)d(\d+)$/);
  if (!m) return 0;
  let total = 0;
  for (let i = 0; i < parseInt(m[1]); i++) total += rollDice(parseInt(m[2]));
  return total;
};

// Damage Resistance/Vulnerability/Immunity (PHB p.197): immunity → 0,
// resistance → halved (rounded down), vulnerability → doubled.
export const normList = (l) => Array.isArray(l) ? l.map(d => String(d || '').toLowerCase().trim()).filter(Boolean) : [];
export const applyDamageModifiers = (damage, damageType, target = {}) => {
  const type = String(damageType || '').toLowerCase().trim();
  if (!type || damage <= 0) return { amount: Math.max(0, damage), applied: null };
  const immunities = normList(target.immunities);
  const resistances = normList(target.resistances);
  const vulnerabilities = normList(target.vulnerabilities);
  if (immunities.includes(type)) return { amount: 0, applied: 'immunity' };
  if (resistances.includes(type)) return { amount: Math.floor(damage / 2), applied: 'resistance' };
  if (vulnerabilities.includes(type)) return { amount: damage * 2, applied: 'vulnerability' };
  return { amount: Math.max(0, damage), applied: null };
};

// Centralized condition mechanics (PHB p.290-292). Mirrors components/game/conditionEffects.js.
export const CONDITION_FLAGS = {
  blinded:     { no_actions: false, incoming_attack_advantage: true },
  paralyzed:   { no_actions: true, incoming_attack_advantage: true, melee_auto_crit: true },
  stunned:     { no_actions: true, incoming_attack_advantage: true },
  unconscious: { no_actions: true, incoming_attack_advantage: true, melee_auto_crit: true },
  petrified:   { no_actions: true, incoming_attack_advantage: true, resist_all: true },
  incapacitated:{ no_actions: true },
  grappled:    { speed_zero: true },
  restrained:  { speed_zero: true, incoming_attack_advantage: true },
  banished:    { no_actions: true, removed_from_combat: true },
  polymorphed: { no_actions: false },
  turned:      { no_actions: true, removed_from_combat: true },
  prone:       {},
  invisible:   { incoming_attack_disadvantage: true },
};
export const condNames = (arr) => (arr || []).map(c => String(typeof c === 'string' ? c : c?.name || '').toLowerCase().trim());
export const hasNoActions = (arr) => condNames(arr).some(n => CONDITION_FLAGS[n]?.no_actions);
// Conditions that get a save at the end of each turn to shake off (engine handles at turn start).
export const SAVEABLE_CONDITIONS = {
  paralyzed: 'wisdom', // Hold Person / Hold Monster — WIS save
  banished: 'charisma',
  charmed: 'wisdom',
  frightened: 'wisdom',
  polymorphed: 'wisdom',
  stunned: 'constitution',
  turned: 'wisdom',
};

// Advance initiative tracker past current combatant, skipping unconscious
export const advanceTurn = (currentIndex, currentRound, combatantsArr) => {
  let nextIndex = (currentIndex + 1) % combatantsArr.length;
  let nextRound = currentRound;
  if (nextIndex === 0) nextRound++;
  let safety = 0;
  while (!combatantsArr[nextIndex]?.is_conscious && safety < combatantsArr.length) {
    nextIndex = (nextIndex + 1) % combatantsArr.length;
    if (nextIndex === 0) nextRound++;
    safety++;
  }
  return { nextIndex, nextRound };
};

// ─── CENTRALIZED ATTACK ROLL (PHB p.173) ────────────────────────────────────
export const resolveAttackRoll = ({ advSources = [], disSources = [], forceCrit = false, rerollOnes = false } = {}) => {
  const hasAdv = advSources.some(Boolean);
  const hasDis = disSources.some(Boolean);
  // PHB p.173: if both advantage and disadvantage are present, they cancel —
  // regardless of how many of each — and you roll a single straight d20.
  const netAdvantage = hasAdv && !hasDis;
  const netDisadvantage = hasDis && !hasAdv;
  const r1 = rollD20();
  const r2 = (netAdvantage || netDisadvantage) ? rollD20() : r1;
  let roll = netAdvantage ? Math.max(r1, r2) : netDisadvantage ? Math.min(r1, r2) : r1;
  // Halfling Lucky (PHB p.28): reroll natural 1s
  if (rerollOnes && roll === 1) roll = rollD20();
  return {
    roll,
    rolls: [r1, r2],
    advantage: netAdvantage,
    disadvantage: netDisadvantage,
    isCritical: forceCrit || roll === 20,
    isMiss: roll === 1,
  };
};

// ─── CONCENTRATION SAVE (PHB p.203) ──────────────────────────────────────────
export const rollConcentrationSave = (charFull, damage) => {
  const dc = Math.max(10, Math.floor(damage / 2));
  const hasWarCaster = (charFull?.feats || []).includes('War Caster') ||
    (charFull?._feat_flags || []).includes('war_caster');
  const conProf = charFull?.saving_throws?.constitution ? (charFull?.proficiency_bonus || 2) : 0;
  const auraBonus = (charFull?.class === 'Paladin' && (charFull?.level || 1) >= 6)
    ? Math.max(1, statMod(charFull?.charisma || 10)) : 0;
  const cr1 = rollD20();
  const cr2 = hasWarCaster ? rollD20() : cr1;
  const save = Math.max(cr1, cr2) + statMod(charFull?.constitution || 10) + conProf + auraBonus;
  return { broken: save < dc, save, dc };
};

// ─── ACTION ECONOMY: actions per turn (Extra Attack and class overrides) ─────
export const getActionsPerTurn = (character) => {
  const features = (character.features || []).map(f => (typeof f === 'string' ? f : f.name || '').toLowerCase());
  const charClass = (character.class || '').toLowerCase();
  const subclass  = (character.subclass || '').toLowerCase();
  const level = character.level || 1;
  let actions = 1;
  // Extra Attack: Fighter 5+, Ranger 5+, Paladin 5+, Barbarian 5+, Monk 5+
  if (['fighter','ranger','paladin','barbarian','monk'].includes(charClass) && level >= 5) actions = 2;
  if (charClass === 'fighter' && level >= 11) actions = 3;
  if (charClass === 'fighter' && level >= 20) actions = 4;
  // Artificer Battle Smith / Armorer get Extra Attack at level 5 (Tasha's p.17)
  if (charClass === 'artificer' && level >= 5 && (subclass.includes('battle smith') || subclass.includes('armorer'))) actions = Math.max(actions, 2);
  // Bard College of Valor: Extra Attack at level 6 (PHB p.55)
  if (charClass === 'bard' && level >= 6 && subclass.includes('valor')) actions = Math.max(actions, 2);
  // Warlock Thirsting Blade invocation: Extra Attack at level 5 (PHB p.111)
  if (charClass === 'warlock' && level >= 5 && features.some(f => f.includes('thirsting blade'))) actions = Math.max(actions, 2);
  // Feature-based overrides (catches any class with explicit 'extra attack' in features list)
  if (features.some(f => f.includes('extra attack'))) actions = Math.max(actions, 2);
  return actions;
};

export const resolveActionAndAdvance = (combatLog, combatants, character, opts = {}) => {
  const { isQuickened = false, isBonusAction = false } = opts;
  const apt = getActionsPerTurn(character);
  const acu = (isQuickened || isBonusAction)
    ? (combatLog.world_state?.actions_used_this_turn || 0)
    : (combatLog.world_state?.actions_used_this_turn || 0) + 1;
  const ar = apt - acu;
  let ni = combatLog.current_turn_index;
  let nr = combatLog.round;
  let ws = { ...(combatLog.world_state || {}), actions_used_this_turn: acu };
  if (isBonusAction) ws.bonus_action_used = true;
  if (ar <= 0) {
    const adv = advanceTurn(combatLog.current_turn_index, combatLog.round, combatants);
    ni = adv.nextIndex; nr = adv.nextRound;
    ws = { ...ws, actions_used_this_turn: 0, bonus_action_used: false,
           sneak_attack_used: false, loading_weapon_fired: false, colossus_slayer_used: false,
           aasimar_rider_used: false, draconic_cry_active: false, divine_strike_used: false,
           divine_fury_used: false };
  }
  return { nextIndex: ni, nextRound: nr, actionsRemaining: Math.max(0, ar), worldState: ws };
};

export const resetTurnWorldState = (combatLog, extra = {}) => ({
  ...(combatLog.world_state || {}),
  actions_used_this_turn: 0,
  bonus_action_used: false,
  reaction_used: false,
  sneak_attack_used: false,
  loading_weapon_fired: false,
  colossus_slayer_used: false,
  aasimar_rider_used: false,
  draconic_cry_active: false,
  divine_strike_used: false,
  divine_fury_used: false,
  ...extra,
});
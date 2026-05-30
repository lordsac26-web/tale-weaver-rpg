/**
 * Centralized D&D 5e Condition Effects (PHB Appendix A, p.290-292).
 *
 * Single source of truth for what each condition does mechanically. Used by:
 *  - combatEngine (server inlines an equivalent map) for enforcement
 *  - the combat UI to display active conditions and their effects
 *
 * Each entry describes the mechanical flags a condition imposes so callers
 * can branch on them without re-encoding the rules everywhere.
 */

export const CONDITION_EFFECTS = {
  blinded: {
    label: 'Blinded', icon: '👁️', color: '#9ca3af',
    self_attack_disadvantage: true,
    incoming_attack_advantage: true,
    desc: "Can't see. Attack rolls have disadvantage; attacks against have advantage.",
  },
  charmed: {
    label: 'Charmed', icon: '💕', color: '#f9a8d4',
    cant_attack_charmer: true,
    desc: "Can't attack the charmer. Charmer has advantage on social checks.",
  },
  deafened: {
    label: 'Deafened', icon: '🔇', color: '#94a3b8',
    desc: "Can't hear. Auto-fails hearing-based checks.",
  },
  frightened: {
    label: 'Frightened', icon: '😱', color: '#fde047',
    self_attack_disadvantage: true,
    self_check_disadvantage: true,
    cant_approach_source: true,
    desc: 'Disadvantage on attacks & checks while source is in sight. Cannot move toward it.',
  },
  grappled: {
    label: 'Grappled', icon: '🤼', color: '#fbbf24',
    speed_zero: true,
    desc: 'Speed becomes 0. Ends if grappler is incapacitated or you are moved away.',
  },
  incapacitated: {
    label: 'Incapacitated', icon: '🚫', color: '#a3a3a3',
    no_actions: true,
    no_reactions: true,
    desc: "Can't take actions or reactions.",
  },
  invisible: {
    label: 'Invisible', icon: '👻', color: '#93c5fd',
    self_attack_advantage: true,
    incoming_attack_disadvantage: true,
    desc: 'Attacks against have disadvantage; your attacks have advantage.',
  },
  paralyzed: {
    label: 'Paralyzed', icon: '⚡', color: '#facc15',
    no_actions: true,
    no_reactions: true,
    speed_zero: true,
    auto_fail_str_dex_saves: true,
    incoming_attack_advantage: true,
    melee_crit_within_5ft: true,
    desc: 'Incapacitated, speed 0, auto-fails STR/DEX saves. Melee hits within 5 ft auto-crit.',
  },
  petrified: {
    label: 'Petrified', icon: '🪨', color: '#a8a29e',
    no_actions: true,
    no_reactions: true,
    speed_zero: true,
    auto_fail_str_dex_saves: true,
    incoming_attack_advantage: true,
    resist_all_damage: true,
    desc: 'Incapacitated, speed 0, resistant to all damage, immune to poison & disease.',
  },
  poisoned: {
    label: 'Poisoned', icon: '☠️', color: '#4ade80',
    self_attack_disadvantage: true,
    self_check_disadvantage: true,
    desc: 'Disadvantage on attack rolls and ability checks.',
  },
  prone: {
    label: 'Prone', icon: '🛌', color: '#fdba74',
    self_attack_disadvantage: true,
    incoming_melee_advantage: true,
    incoming_ranged_disadvantage: true,
    desc: 'Disadvantage on your attacks. Melee against you has advantage; ranged has disadvantage.',
  },
  restrained: {
    label: 'Restrained', icon: '⛓️', color: '#fb923c',
    speed_zero: true,
    self_attack_disadvantage: true,
    self_dex_save_disadvantage: true,
    incoming_attack_advantage: true,
    desc: 'Speed 0. Disadvantage on attacks & DEX saves; attacks against have advantage.',
  },
  stunned: {
    label: 'Stunned', icon: '💥', color: '#fde047',
    no_actions: true,
    no_reactions: true,
    speed_zero: true,
    auto_fail_str_dex_saves: true,
    incoming_attack_advantage: true,
    desc: 'Incapacitated, speed 0, auto-fails STR/DEX saves; attacks against have advantage.',
  },
  unconscious: {
    label: 'Unconscious', icon: '💤', color: '#9ca3af',
    no_actions: true,
    no_reactions: true,
    speed_zero: true,
    prone: true,
    auto_fail_str_dex_saves: true,
    incoming_attack_advantage: true,
    melee_crit_within_5ft: true,
    desc: 'Incapacitated, prone, speed 0, auto-fails STR/DEX saves. Melee hits within 5 ft auto-crit.',
  },
  banished: {
    label: 'Banished', icon: '🌀', color: '#c4b5fd',
    no_actions: true,
    removed_from_combat: true,
    desc: 'Removed from this plane — takes no part in combat until the spell ends.',
  },
  polymorphed: {
    label: 'Polymorphed', icon: '🐑', color: '#86efac',
    transformed: true,
    desc: 'Transformed into a beast. Uses the new form\'s stats until it drops to 0 HP.',
  },
};

/** Normalize a condition entry (string or {name}) to its lowercase key. */
export function conditionKey(cond) {
  return String(typeof cond === 'string' ? cond : cond?.name || '').toLowerCase().trim();
}

/** Return the effect definition for a condition, or null. */
export function getConditionEffect(cond) {
  return CONDITION_EFFECTS[conditionKey(cond)] || null;
}

/**
 * Aggregate mechanical flags from a list of conditions into one summary object.
 * Useful for "does this creature have any 'no actions' condition?" checks.
 */
export function aggregateConditionFlags(conditions = []) {
  const flags = {};
  for (const c of conditions) {
    const eff = getConditionEffect(c);
    if (!eff) continue;
    for (const [k, v] of Object.entries(eff)) {
      if (typeof v === 'boolean' && v) flags[k] = true;
    }
  }
  return flags;
}

/** True if any condition prevents the creature from taking actions. */
export function isIncapacitated(conditions = []) {
  return aggregateConditionFlags(conditions).no_actions === true;
}

/** True if any condition reduces the creature's speed to 0. */
export function hasSpeedZero(conditions = []) {
  return aggregateConditionFlags(conditions).speed_zero === true;
}
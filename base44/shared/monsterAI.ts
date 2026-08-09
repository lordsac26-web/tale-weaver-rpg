// ─── DATA-DRIVEN MONSTER AI ─────────────────────────────────────────────────
// Extracted from combatEngine/entry.ts to keep that file under the size limit.
// Archetype → prioritized tactic list. Edit AI_ARCHETYPES to tune monster behavior.
export const parseCR = (cr) => {
  if (typeof cr === 'number') return Number.isFinite(cr) && cr >= 0 ? cr : 0;
  if (typeof cr === 'string') {
    const value = cr.trim().toLowerCase().replace(/^cr\s*/, '');
    if (/^\d+\s*\/\s*\d+$/.test(value)) {
      const [num, den] = value.split('/').map(part => Number(part.trim()));
      if (Number.isFinite(num) && Number.isFinite(den) && den > 0) return num / den;
    }
    if (/^\d+(?:\.\d+)?$/.test(value)) {
      const parsed = Number(value);
      if (Number.isFinite(parsed) && parsed >= 0) return parsed;
    }
  }
  return 0;
};

export const clampTacticByCR = (effects = {}, cr, nativeAttacks = 1) => {
  const numericCR = parseCR(cr);
  let maxAttacks = numericCR < 1 ? 1 : Math.max(1, Number(nativeAttacks) || 1);
  let maxAttackBonus = 1;
  let maxBonusDamage = 1;
  if (numericCR >= 10) {
    maxAttacks = Math.max(3, maxAttacks); maxAttackBonus = 3; maxBonusDamage = 3;
  } else if (numericCR >= 5) {
    maxAttacks = Math.max(2, maxAttacks); maxAttackBonus = 3; maxBonusDamage = 3;
  } else if (numericCR >= 2) {
    maxAttacks = Math.max(2, maxAttacks); maxAttackBonus = 2; maxBonusDamage = 2;
  } else if (numericCR >= 1) {
    maxAttackBonus = 2; maxBonusDamage = 2;
  }
  const rawAttackBonus = Number(effects.attackBonus) || 0;
  const rawBonusDamage = Number(effects.bonusDamage) || 0;
  return {
    numAttacks: Math.min(Math.max(1, Number(effects.numAttacks) || 1), maxAttacks),
    attackBonus: rawAttackBonus > 0 ? Math.min(rawAttackBonus, maxAttackBonus) : rawAttackBonus,
    bonusDamage: rawBonusDamage > 0 ? Math.min(rawBonusDamage, maxBonusDamage) : rawBonusDamage,
  };
};

const CASTER_PATTERN = /mage|wizard|sorcerer|warlock|caster|cultist|priest|priestess|shaman|witch|lich|spell|necromanc|mancer|cleric|druid|bard|archmage|conjurer|evoker|illusionist|transmuter|diviner|enchanter|abjurer|invoker|summoner|elementalist|pyromancer|cryomancer|arcanist|hierophant|acolyte|seer|oracle|mystic|occult|incantation|cantrip|magic/;

export const AI_ARCHETYPES = {
  // Big dumb melee: hits hard, gets reckless when wounded.
  brute: {
    label: 'brute',
    tactics: [
      { id: 'desperate_fury', when: { selfHpBelow: 0.25 }, effects: { numAttacks: 2, attackBonus: 2, bonusDamage: 2, desc: 'swings in a desperate frenzy!' } },
      { id: 'reckless',       when: { chance: 0.5 },        effects: { attackBonus: 3, bonusDamage: 2, desc: 'attacks recklessly!' } },
    ],
    default: { desc: 'attacks!' },
  },
  // Mobile striker: opportunistic, presses weakened foes, retreats when nearly dead.
  scout: {
    label: 'scout',
    tactics: [
      { id: 'retreat',        when: { selfHpBelow: 0.25, chance: 0.5 }, effects: { attackBonus: -1, desc: 'looks for an opening to flee!' } },
      { id: 'press',          when: { playerHpBelow: 0.3 },             effects: { attackBonus: 2, bonusDamage: 1, desc: 'darts in to finish the wounded hero!' } },
      { id: 'tactical_strike',when: { chance: 0.35 },                   effects: { attackBonus: 1, desc: 'strikes at a weak point!' } },
    ],
    default: { desc: 'attacks!' },
  },
  // Ranged caster: opens with a calculated assessment, then precise blasts.
  spellcaster: {
    label: 'spellcaster',
    tactics: [
      { id: 'opening_assess', when: { roundLte: 1 },        effects: { attackBonus: 1, desc: 'weaves a spell, sizing up the hero...' } },
      { id: 'focused_blast',  when: { playerHpBelow: 0.4 }, effects: { attackBonus: 2, bonusDamage: 2, desc: 'channels a focused blast!' } },
      { id: 'arcane_volley',  when: { chance: 0.4 },        effects: { numAttacks: 2, desc: 'unleashes an arcane volley!' } },
    ],
    default: { desc: 'casts a spell!' },
  },
  // Disciplined fighter: balanced, tactical, holds the line.
  soldier: {
    label: 'soldier',
    tactics: [
      { id: 'multiattack',    when: { selfHpAbove: 0.5 },   effects: { numAttacks: 2, desc: 'executes a disciplined multiattack!' } },
      { id: 'press',          when: { playerHpBelow: 0.3 }, effects: { attackBonus: 2, bonusDamage: 1, desc: 'presses the advantage!' } },
      { id: 'defensive',      when: { chance: 0.2 },        effects: { attackBonus: -2, desc: 'takes a defensive stance!' } },
    ],
    default: { desc: 'attacks!' },
  },
  // Boss/legendary: relentless, escalates with multiattacks and fury.
  boss: {
    label: 'boss',
    tactics: [
      { id: 'desperate_fury', when: { selfHpBelow: 0.25 }, effects: { numAttacks: 3, bonusDamage: 2, desc: 'fights with desperate fury!' } },
      { id: 'press',          when: { playerHpBelow: 0.3 }, effects: { numAttacks: 2, attackBonus: 2, bonusDamage: 2, desc: 'moves in for the kill!' } },
      { id: 'opening',        when: { roundLte: 1 },        effects: { numAttacks: 2, desc: 'sizes up the hero with cold calculation...' } },
      { id: 'multiattack',    when: { chance: 1 },          effects: { numAttacks: 2, desc: 'unleashes a flurry of blows!' } },
    ],
    default: { numAttacks: 2, desc: 'attacks!' },
  },
};

// Infer an archetype from monster metadata when one isn't explicitly provided.
export const inferArchetype = (enemy = {}) => {
  const cr = parseCR(enemy.cr);
  const text = [
    enemy.name, enemy.monster_name, enemy.meta, enemy.type, enemy.creature_type,
    enemy.role, enemy.description,
    Array.isArray(enemy.actions) ? enemy.actions.join(' ') : enemy.actions,
    Array.isArray(enemy.spells) ? enemy.spells.join(' ') : enemy.spells,
    Array.isArray(enemy.traits) ? enemy.traits.join(' ') : enemy.traits,
    Array.isArray(enemy.special_abilities) ? enemy.special_abilities.join(' ') : enemy.special_abilities,
  ].filter(Boolean).join(' ').toLowerCase();
  const explicitMagicAttack = ['spell', 'magic'].includes(String(enemy.attack_type || '').toLowerCase());
  const matchesCaster = explicitMagicAttack || CASTER_PATTERN.test(text);
  const matchesSoldier = /knight|guard|soldier|veteran|captain|legionnaire|hobgoblin|warrior|paladin|myrmidon|skeleton/.test(text);
  // Repair legacy records where the generic fallback persisted "brute" on an
  // obvious caster or disciplined/skeletal soldier.
  if (enemy.archetype && AI_ARCHETYPES[enemy.archetype]) {
    if (enemy.archetype === 'brute' && matchesCaster) return 'spellcaster';
    if (enemy.archetype === 'brute' && matchesSoldier) return 'soldier';
    return enemy.archetype;
  }
  if (enemy.is_legendary || cr >= 10) return 'boss';
  if (matchesCaster) return 'spellcaster';
  if (/scout|rogue|assassin|thief|archer|skirmisher|goblin|kobold|wolf|raptor|stalker|ranger/.test(text)) return 'scout';
  if (matchesSoldier) return 'soldier';
  if (cr >= 5) return 'boss';
  return 'brute';
};

export const chooseTactic = (archetypeKey, ctx = {}) => {
  const arch = AI_ARCHETYPES[archetypeKey] || AI_ARCHETYPES.brute;
  const passes = (when = {}) => {
    if (when.selfHpBelow != null && !(ctx.selfHpPct < when.selfHpBelow)) return false;
    if (when.selfHpAbove != null && !(ctx.selfHpPct >= when.selfHpAbove)) return false;
    if (when.playerHpBelow != null && !(ctx.playerHpPct < when.playerHpBelow)) return false;
    if (when.roundLte != null && !(ctx.round <= when.roundLte)) return false;
    if (when.chance != null && !(Math.random() < when.chance)) return false;
    return true;
  };
  // The combatant's explicit stat-block attack count is authoritative. Legacy
  // metadata such as `multiattack: "..."` is descriptive and must never select a
  // multiattack tactic when num_attacks is one (the CR 1/4 skeleton live path).
  // Filtering here keeps the tactic id, description, and number of attacks aligned.
  const nativeAttacks = Math.max(1, Number(ctx.nativeAttacks) || 1);
  const canMultiattack = parseCR(ctx.cr) >= 1 && nativeAttacks > 1;
  const canUseTactic = (tactic) => {
    const effects = tactic.effects || {};
    if ((effects.numAttacks || 1) > 1 && !canMultiattack) return false;
    return true;
  };
  const chosen = (arch.tactics || []).find(t => passes(t.when) && canUseTactic(t)) || null;
  const effects = chosen ? chosen.effects : (arch.default || {});
  const bounded = clampTacticByCR(effects, ctx.cr, nativeAttacks);
  return {
    id: chosen ? chosen.id : 'default',
    ...bounded,
    desc: effects.desc || null,
    damageDice: effects.damage_dice || null,
    archetype: arch.label || archetypeKey,
  };
};
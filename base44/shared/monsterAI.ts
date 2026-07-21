// ─── DATA-DRIVEN MONSTER AI ─────────────────────────────────────────────────
// Extracted from combatEngine/entry.ts to keep that file under the size limit.
// Archetype → prioritized tactic list. Edit AI_ARCHETYPES to tune monster behavior.
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
export const inferArchetype = (enemy) => {
  if (enemy.archetype && AI_ARCHETYPES[enemy.archetype]) return enemy.archetype;
  const cr = enemy.cr || 1;
  if (enemy.is_legendary || cr >= 10) return 'boss';
  const text = `${enemy.name || ''} ${enemy.monster_name || ''} ${enemy.meta || ''} ${enemy.type || ''} ${(enemy.actions || '')}`.toLowerCase();
  if ((enemy.attack_type === 'ranged') || /mage|wizard|sorcerer|warlock|caster|cultist|priest|shaman|witch|lich|spell/.test(text)) return 'spellcaster';
  if (/scout|rogue|assassin|thief|archer|skirmisher|goblin|kobold|wolf|raptor|stalker/.test(text)) return 'scout';
  if (/knight|guard|soldier|veteran|captain|legionnaire|hobgoblin|warrior/.test(text)) return 'soldier';
  if (cr >= 5) return 'boss';
  return 'brute';
};

// Evaluate an archetype's tactic list against the current battlefield state and
// return the chosen tactic effects ({ numAttacks, attackBonus, bonusDamage, desc }).
export const chooseTactic = (archetypeKey, ctx) => {
  const arch = AI_ARCHETYPES[archetypeKey] || AI_ARCHETYPES.brute;
  const passes = (when = {}) => {
    if (when.selfHpBelow != null && !(ctx.selfHpPct < when.selfHpBelow)) return false;
    if (when.selfHpAbove != null && !(ctx.selfHpPct >= when.selfHpAbove)) return false;
    if (when.playerHpBelow != null && !(ctx.playerHpPct < when.playerHpBelow)) return false;
    if (when.roundLte != null && !(ctx.round <= when.roundLte)) return false;
    if (when.chance != null && !(Math.random() < when.chance)) return false;
    return true;
  };
  const chosen = (arch.tactics || []).find(t => passes(t.when)) || null;
  const eff = chosen ? chosen.effects : (arch.default || {});
  return {
    id: chosen ? chosen.id : 'default',
    numAttacks: eff.numAttacks || 1,
    attackBonus: eff.attackBonus || 0,
    bonusDamage: eff.bonusDamage || 0,
    desc: eff.desc || null,
    archetype: arch.label || archetypeKey,
  };
};
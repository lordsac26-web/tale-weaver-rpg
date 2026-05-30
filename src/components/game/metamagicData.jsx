/**
 * D&D 5e Sorcerer Metamagic (PHB p.101-102).
 *
 * Sorcery Points: a Sorcerer gains sorcery points equal to their sorcerer level
 * starting at level 2. Spent to fuel Metamagic options.
 *
 * Only the three options wired into the combat engine are modeled here:
 *  - Quickened Spell: 2 SP — cast a 1-action spell as a bonus action.
 *  - Twinned Spell: SP = spell level (min 1) — target a second creature.
 *  - Heightened Spell: 3 SP — one target has disadvantage on its save.
 */

export const METAMAGIC_OPTIONS = {
  'Quickened Spell': {
    id: 'quickened',
    cost: 2,
    icon: '⚡',
    desc: 'Cast a spell with a casting time of 1 action as a bonus action instead.',
    requires_action_spell: true,
  },
  'Twinned Spell': {
    id: 'twinned',
    cost: 'spell_level', // SP = spell level (cantrips cost 1)
    icon: '👥',
    desc: 'When you cast a spell that targets only one creature, target a second creature in range with the same spell.',
    requires_single_target: true,
  },
  'Heightened Spell': {
    id: 'heightened',
    cost: 3,
    icon: '🎯',
    desc: 'When you cast a spell that forces a saving throw, one target has disadvantage on its first save against the spell.',
    requires_save_spell: true,
  },
};

/** Max sorcery points for a Sorcerer (= level, from level 2). 0 otherwise. */
export function maxSorceryPoints(character) {
  if ((character?.class || '').toLowerCase() !== 'sorcerer') return 0;
  const level = character?.level || 1;
  return level >= 2 ? level : 0;
}

/** Compute the sorcery-point cost of a metamagic option for a given spell level. */
export function metamagicCost(optionName, spellLevel = 1) {
  const opt = METAMAGIC_OPTIONS[optionName];
  if (!opt) return 0;
  if (opt.cost === 'spell_level') return Math.max(1, spellLevel || 1);
  return opt.cost;
}

/**
 * Whether a given metamagic option is applicable to a spell, given the spell's
 * shape. spell = { attack_type, slot_level, single_target, casting_time }.
 */
export function isMetamagicApplicable(optionName, spell = {}) {
  const opt = METAMAGIC_OPTIONS[optionName];
  if (!opt) return false;
  if (opt.requires_save_spell && spell.attack_type !== 'saving_throw') return false;
  if (opt.requires_action_spell && spell.is_bonus_action) return false;
  // Twinned: spell must target a single creature (no AoE / self / utility-aoe).
  if (opt.requires_single_target && spell.single_target === false) return false;
  return true;
}
import React from 'react';
import { Zap, Eye } from 'lucide-react';

// Build Rogue abilities: Sneak Attack, Cunning Action.
export function buildRogueAbilities(ctx) {
  const { character, level, bonusActionUsed, onMessage, onAbilityUsed } = ctx;
  const abilities = [];

  const sneakDice = Math.ceil(level / 2);
  abilities.push({
    id: 'sneak_attack',
    name: 'Sneak Attack',
    icon: <Eye className="w-4 h-4" />,
    color: '#a78bfa',
    borderColor: 'rgba(160,120,255,0.4)',
    bgColor: 'rgba(25,10,50,0.65)',
    type: 'passive',
    description: `Once/turn: +${sneakDice}d6 damage with finesse/ranged weapon when you have advantage OR an ally is adjacent to target. Toggle in Modifiers.`,
    shortDesc: `+${sneakDice}d6 damage once/turn`,
    used: false,
    available: true,
  });

  // Cunning Action
  if (level >= 2) {
    abilities.push({
      id: 'cunning_action',
      name: 'Cunning Action',
      icon: <Zap className="w-4 h-4" />,
      color: '#818cf8',
      borderColor: 'rgba(130,130,255,0.35)',
      bgColor: 'rgba(15,15,45,0.6)',
      type: 'bonus_action',
      description: 'Bonus Action: Dash, Disengage, or Hide.',
      shortDesc: 'Dash/Disengage/Hide (bonus action)',
      used: bonusActionUsed,
      usedLabel: 'Bonus action used',
      available: !bonusActionUsed,
      onUse: async () => {
        onMessage?.(`🎯 Cunning Action! ${character.name} takes a bonus Dash/Disengage/Hide!`);
        onAbilityUsed?.('cunning_action', {});
      }
    });
  }

  return abilities;
}
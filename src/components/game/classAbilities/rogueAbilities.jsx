import React from 'react';
import { Zap, Eye, Shield, Sparkles, Wind } from 'lucide-react';

// Build Rogue abilities: Sneak Attack, Cunning Action, Evasion, Uncanny Dodge, Reliable Talent.
export function buildRogueAbilities(ctx) {
  const { character, level, bonusActionUsed, onMessage, onAbilityUsed } = ctx;
  const abilities = [];

  const sneakDice = Math.ceil(level / 2);
  abilities.push({
    id: 'sneak_attack',
    name: 'Sneak Attack',
    icon: <Eye className="w-4 h-4" />,
    color: '#a78bfa', borderColor: 'rgba(160,120,255,0.4)', bgColor: 'rgba(25,10,50,0.65)',
    type: 'passive',
    description: `Once/turn: +${sneakDice}d6 damage with finesse/ranged weapon when you have advantage OR an ally is adjacent to target. Toggle in Modifiers.`,
    shortDesc: `+${sneakDice}d6 damage once/turn`,
    used: false, available: true,
  });

  // Cunning Action (L2+)
  if (level >= 2) {
    abilities.push({
      id: 'cunning_action',
      name: 'Cunning Action',
      icon: <Zap className="w-4 h-4" />,
      color: '#818cf8', borderColor: 'rgba(130,130,255,0.35)', bgColor: 'rgba(15,15,45,0.6)',
      type: 'bonus_action',
      description: 'Bonus Action: Dash, Disengage, or Hide.',
      shortDesc: 'Dash/Disengage/Hide (bonus action)',
      used: bonusActionUsed, usedLabel: 'Bonus action used',
      available: !bonusActionUsed,
      onUse: async () => {
        onMessage?.(`🎯 Cunning Action! ${character.name} takes a bonus Dash/Disengage/Hide!`);
        onAbilityUsed?.('cunning_action', {});
      }
    });
  }

  // Uncanny Dodge (L5+, PHB p.96)
  if (level >= 5) {
    abilities.push({
      id: 'uncanny_dodge',
      name: 'Uncanny Dodge',
      icon: <Shield className="w-4 h-4" />,
      color: '#60a5fa', borderColor: 'rgba(96,165,250,0.35)', bgColor: 'rgba(10,20,50,0.6)',
      type: 'passive',
      description: 'Reaction: When an attacker you can see hits you, halve the attack\'s damage. (Engine: auto-triggers as a reaction when taking damage from an enemy attack.)',
      shortDesc: 'Reaction: halve incoming damage',
      used: false, available: true,
    });
  }

  // Evasion (L7+, PHB p.96)
  if (level >= 7) {
    abilities.push({
      id: 'evasion',
      name: 'Evasion',
      icon: <Wind className="w-4 h-4" />,
      color: '#34d399', borderColor: 'rgba(52,211,153,0.35)', bgColor: 'rgba(8,30,20,0.6)',
      type: 'passive',
      description: 'When subjected to an effect that allows a DEX save for half damage, you take no damage on a success and half on a failure. (Engine: auto-applied to DEX saving throw spells.)',
      shortDesc: 'No dmg on DEX save success',
      used: false, available: true,
    });
  }

  // Reliable Talent (L11+, PHB p.96)
  if (level >= 11) {
    abilities.push({
      id: 'reliable_talent',
      name: 'Reliable Talent',
      icon: <Sparkles className="w-4 h-4" />,
      color: '#fbbf24', borderColor: 'rgba(251,191,36,0.35)', bgColor: 'rgba(40,30,5,0.6)',
      type: 'passive',
      description: 'Whenever you make an ability check that lets you add your proficiency bonus, you can treat a d20 roll of 9 or lower as a 10. (Engine: auto-applied to proficient skill checks.)',
      shortDesc: 'Min roll 10 on proficient checks',
      used: false, available: true,
    });
  }

  return abilities;
}
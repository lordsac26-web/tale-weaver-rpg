import React from 'react';
import { Zap, Shield, Heart } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { getFightingStyleDesc } from './abilityHelpers';

// Build Paladin abilities: Lay on Hands, Fighting Style, Divine Smite.
export function buildPaladinAbilities(ctx) {
  const { character, level, longRestAbilities, onMessage, onAbilityUsed } = ctx;
  const abilities = [];

  // Lay on Hands
  const lohMax = level * 5;
  const lohUsed = longRestAbilities.lay_on_hands_used || 0;
  const lohLeft = Math.max(0, lohMax - lohUsed);
  abilities.push({
    id: 'lay_on_hands',
    name: 'Lay on Hands',
    icon: <Heart className="w-4 h-4" />,
    color: '#86efac',
    borderColor: 'rgba(40,200,100,0.4)',
    bgColor: 'rgba(8,40,18,0.7)',
    activeBg: 'rgba(15,65,30,0.85)',
    type: 'action',
    description: `Action. Heal up to ${lohLeft} HP remaining (pool of ${lohMax}). 1 HP cures disease/poison instead.`,
    shortDesc: `Heal up to ${lohLeft}/${lohMax} HP`,
    restType: 'long',
    used: lohLeft <= 0,
    usedLabel: `Pool depleted (${lohMax} on long rest)`,
    available: lohLeft > 0,
    onUse: async () => {
      const heal = Math.min(lohLeft, character.hp_max - (character.hp_current || 0));
      const newHp = (character.hp_current || 0) + heal;
      await base44.entities.Character.update(character.id, {
        hp_current: newHp,
        long_rest_abilities: { ...longRestAbilities, lay_on_hands_used: lohUsed + heal }
      });
      onMessage?.(`🙏 Lay on Hands! ${character.name} heals ${heal} HP (${newHp}/${character.hp_max}).`);
      onAbilityUsed?.('lay_on_hands', { heal, newHp });
    }
  });

  // Paladin Fighting Style (level 2+)
  if (level >= 2 && character.fighting_style) {
    abilities.push({
      id: 'fighting_style',
      name: 'Fighting Style',
      icon: <Shield className="w-4 h-4" />,
      color: '#93c5fd',
      borderColor: 'rgba(100,160,255,0.3)',
      bgColor: 'rgba(8,20,50,0.5)',
      type: 'passive',
      shortDesc: character.fighting_style,
      description: getFightingStyleDesc(character.fighting_style),
      used: false,
      available: true,
    });
  }

  // Divine Smite reminder
  if (level >= 2) {
    abilities.push({
      id: 'divine_smite',
      name: 'Divine Smite',
      icon: <Zap className="w-4 h-4" />,
      color: '#fde047',
      borderColor: 'rgba(250,220,40,0.4)',
      bgColor: 'rgba(35,30,3,0.6)',
      type: 'passive',
      description: 'On melee hit: expend a spell slot (no action). Deal +2d8 radiant per slot level (max 5d8). Enable via Combat Modifiers panel.',
      shortDesc: 'Toggle in Modifiers ↓',
      used: false,
      available: true,
    });
  }

  return abilities;
}
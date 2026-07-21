import React from 'react';
import { Zap, Shield, Heart } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { getFightingStyleDesc } from './abilityHelpers';

// Build Paladin abilities: Lay on Hands, Fighting Style, Divine Smite.
export function buildPaladinAbilities(ctx) {
  const { character, level, longRestAbilities, onMessage, onAbilityUsed, openLayOnHands } = ctx;
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
    description: `Action. Choose how many points to spend — heal that many HP (pool of ${lohMax}), or spend 1 point to cure a disease/poison.`,
    shortDesc: `${lohLeft}/${lohMax} points — pick amount`,
    restType: 'long',
    used: lohLeft <= 0,
    usedLabel: `Pool depleted (${lohMax} on long rest)`,
    available: lohLeft > 0,
    onUse: () => openLayOnHands?.(),
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
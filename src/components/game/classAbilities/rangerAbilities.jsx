import React from 'react';
import { Shield, Eye } from 'lucide-react';
import { getFightingStyleDesc } from './abilityHelpers';

// Build Ranger abilities: Hunter's Mark, Fighting Style.
export function buildRangerAbilities(ctx) {
  const { character, level } = ctx;
  const abilities = [];

  // Hunter's Mark reminder
  if (level >= 1) {
    abilities.push({
      id: 'hunters_mark',
      name: "Hunter's Mark",
      icon: <Eye className="w-4 h-4" />,
      color: '#6ee7b7',
      borderColor: 'rgba(80,220,160,0.35)',
      bgColor: 'rgba(5,35,20,0.65)',
      type: 'passive',
      description: "Bonus Action: Cast Hunter's Mark (requires spell slot). Designate a creature — deal +1d6 damage to it and have advantage on Perception/Survival checks to find it. Move the mark as a bonus action when target dies.",
      shortDesc: '+1d6 dmg to marked target (spell)',
      used: false,
      available: true,
    });
  }

  // Fighting Style (Ranger also gets one at level 2)
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

  return abilities;
}
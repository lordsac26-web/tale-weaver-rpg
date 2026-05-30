import React from 'react';
import { Zap, Sparkles } from 'lucide-react';

// Build Sorcerer abilities: Sorcery Points, Metamagic.
export function buildSorcererAbilities(ctx) {
  const { level, shortRestAbilities } = ctx;
  const abilities = [];

  const maxSorceryPts = level;
  const usedSorceryPts = shortRestAbilities.sorcery_points_used || 0;
  const sorceryLeft = Math.max(0, maxSorceryPts - usedSorceryPts);
  abilities.push({
    id: 'sorcery_points',
    name: 'Sorcery Points',
    icon: <Sparkles className="w-4 h-4" />,
    color: '#f0abfc',
    borderColor: 'rgba(230,100,255,0.4)',
    bgColor: 'rgba(40,5,50,0.7)',
    type: 'passive',
    description: `${sorceryLeft}/${maxSorceryPts} Sorcery Points. Convert to/from spell slots via Font of Magic. Power Metamagic options (Quickened, Twinned, Empowered, etc.). Recharge on long rest.`,
    shortDesc: `${sorceryLeft}/${maxSorceryPts} Sorcery Points`,
    used: false,
    available: true,
  });

  if (level >= 3) {
    abilities.push({
      id: 'metamagic',
      name: 'Metamagic',
      icon: <Zap className="w-4 h-4" />,
      color: '#e879f9',
      borderColor: 'rgba(200,80,240,0.35)',
      bgColor: 'rgba(35,5,45,0.6)',
      type: 'passive',
      description: 'Apply Metamagic options to your spells by spending Sorcery Points. Options chosen at level 3: Quickened Spell (1pt), Twinned Spell (varies), Empowered Spell (1pt), etc.',
      shortDesc: `Modify spells with Sorcery Points`,
      used: false,
      available: true,
    });
  }

  return abilities;
}
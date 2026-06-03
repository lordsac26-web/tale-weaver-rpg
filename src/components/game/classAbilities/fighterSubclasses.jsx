import React from 'react';
import { Swords } from 'lucide-react';
import { base44 } from '@/api/base44Client';

// Build Battle Master specific abilities
export function buildBattleMasterAbilities(ctx) {
  const { character, level, shortRestAbilities, onMessage, onAbilityUsed } = ctx;
  const abilities = [];

  const isBattleMaster = (character.subclass || '').toLowerCase().includes('battle master');
  if (!isBattleMaster || level < 3) return abilities;

  // Superiority Dice: 4 dice (5 at L7, 6 at L15), die size d8 (d10 at L10, d12 at L18)
  const sdMax = level >= 15 ? 6 : level >= 7 ? 5 : 4;
  const sdDie = level >= 18 ? 'd12' : level >= 10 ? 'd10' : 'd8';
  const sdUsed = shortRestAbilities.superiority_dice_used || 0;
  const sdLeft = Math.max(0, sdMax - sdUsed);
  
  abilities.push({
    id: 'superiority_dice',
    name: 'Superiority Dice',
    icon: <Swords className="w-4 h-4" />,
    color: '#fbbf24',
    borderColor: 'rgba(250,180,30,0.45)',
    bgColor: 'rgba(40,28,3,0.7)',
    activeBg: 'rgba(70,48,6,0.85)',
    type: 'special',
    description: `Spend a ${sdDie} to fuel a combat maneuver (Riposte, Trip Attack, Disarm, etc.). Add the die to the relevant roll. ${sdLeft}/${sdMax} dice remaining. Recovers on a short rest.`,
    shortDesc: `${sdLeft}/${sdMax} ${sdDie} dice`,
    restType: 'short',
    used: sdLeft <= 0,
    usedLabel: 'No dice left (short rest)',
    available: sdLeft > 0,
    onUse: async () => {
      await base44.entities.Character.update(character.id, {
        short_rest_abilities: { ...shortRestAbilities, superiority_dice_used: sdUsed + 1 }
      });
      onMessage?.(`⚔️ ${character.name} spends a ${sdDie} Superiority Die on a maneuver! (${sdLeft - 1}/${sdMax} left)`);
      onAbilityUsed?.('superiority_dice', { die: sdDie, remaining: sdLeft - 1 });
    }
  });

  return abilities;
}
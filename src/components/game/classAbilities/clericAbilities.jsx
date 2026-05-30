import React from 'react';
import { Shield } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { calcStatMod } from '../gameData';

// Build Cleric abilities: Channel Divinity (Turn Undead).
export function buildClericAbilities(ctx) {
  const { character, level, profBonus, shortRestAbilities, onMessage, onAbilityUsed } = ctx;
  const abilities = [];

  const turnUsed = shortRestAbilities.turn_undead_used || 0;
  const maxTurn = 1 + Math.floor(level / 3);
  const turnLeft = Math.max(0, maxTurn - turnUsed);
  abilities.push({
    id: 'channel_divinity',
    name: 'Channel Divinity',
    icon: <Shield className="w-4 h-4" />,
    color: '#fde047',
    borderColor: 'rgba(250,220,40,0.4)',
    bgColor: 'rgba(35,28,3,0.65)',
    type: 'action',
    description: `Action: Turn Undead — undead must make WIS save DC ${8 + profBonus + calcStatMod(character.wisdom || 10)} or be turned. ${turnLeft} use(s) left.`,
    shortDesc: `Turn Undead (${turnLeft} uses)`,
    restType: 'short',
    used: turnLeft <= 0,
    usedLabel: 'Used (short rest)',
    available: turnLeft > 0,
    onUse: async () => {
      await base44.entities.Character.update(character.id, {
        short_rest_abilities: { ...shortRestAbilities, turn_undead_used: turnUsed + 1 }
      });
      onMessage?.(`✨ Channel Divinity! ${character.name} attempts to Turn Undead!`);
      onAbilityUsed?.('channel_divinity', {});
    }
  });

  return abilities;
}
import React from 'react';
import { Zap } from 'lucide-react';
import { base44 } from '@/api/base44Client';

// Build Wizard abilities: Arcane Recovery.
export function buildWizardAbilities(ctx) {
  const { character, level, shortRestAbilities, onMessage, onAbilityUsed } = ctx;
  const abilities = [];

  if (level >= 2) {
    const arcaneUsed = !!shortRestAbilities.arcane_recovery;
    abilities.push({
      id: 'arcane_recovery',
      name: 'Arcane Recovery',
      icon: <Zap className="w-4 h-4" />,
      color: '#c4b5fd',
      borderColor: 'rgba(160,120,255,0.4)',
      bgColor: 'rgba(28,12,55,0.7)',
      activeBg: 'rgba(50,20,90,0.85)',
      type: 'special',
      description: `Once per long rest during a short rest, recover spell slots totaling up to ${Math.ceil(level / 2)} levels combined.`,
      shortDesc: `Recover ${Math.ceil(level / 2)} spell slot levels`,
      restType: 'short',
      used: arcaneUsed,
      usedLabel: 'Used (long rest)',
      available: !arcaneUsed,
      onUse: async () => {
        await base44.entities.Character.update(character.id, {
          short_rest_abilities: { ...shortRestAbilities, arcane_recovery: true }
        });
        onMessage?.(`✨ Arcane Recovery! ${character.name} recovers spell slots (up to ${Math.ceil(level / 2)} levels).`);
        onAbilityUsed?.('arcane_recovery', {});
      }
    });
  }

  return abilities;
}
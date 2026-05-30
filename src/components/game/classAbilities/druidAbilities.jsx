import React from 'react';
import { Flame } from 'lucide-react';
import { base44 } from '@/api/base44Client';

// Build Druid abilities: Wild Shape.
export function buildDruidAbilities(ctx) {
  const { character, level, shortRestAbilities, onMessage, onAbilityUsed } = ctx;
  const abilities = [];

  const wildShapeUsed = shortRestAbilities.wild_shape_uses || 0;
  const wildShapeMax = 2;
  const wildShapeLeft = Math.max(0, wildShapeMax - wildShapeUsed);
  abilities.push({
    id: 'wild_shape',
    name: 'Wild Shape',
    icon: <Flame className="w-4 h-4" />,
    color: '#86efac',
    borderColor: 'rgba(40,180,80,0.4)',
    bgColor: 'rgba(8,40,15,0.7)',
    type: 'action',
    description: `Action or Bonus Action (Moon druid): Transform into a beast you've seen. CR limit: ${level < 4 ? '¼' : level < 8 ? '½' : Math.floor(level / 3)}. ${wildShapeLeft}/2 remaining.`,
    shortDesc: `Transform into beast (${wildShapeLeft}/2)`,
    restType: 'short',
    used: wildShapeLeft <= 0,
    usedLabel: 'No uses left (short rest)',
    available: wildShapeLeft > 0,
    onUse: async () => {
      await base44.entities.Character.update(character.id, {
        short_rest_abilities: { ...shortRestAbilities, wild_shape_uses: wildShapeUsed + 1 }
      });
      onMessage?.(`🐺 Wild Shape! ${character.name} transforms!`);
      onAbilityUsed?.('wild_shape', {});
    }
  });

  return abilities;
}
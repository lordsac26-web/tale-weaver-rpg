import React from 'react';
import { Flame, Wind, Heart } from 'lucide-react';
import { base44 } from '@/api/base44Client';

// Build Druid abilities: Wild Shape, Moon Circle features.
export function buildDruidAbilities(ctx) {
  const { character, level, shortRestAbilities, onMessage, onCharacterUpdate } = ctx;
  const abilities = [];

  const isCircleOfMoon = (character?.subclass || '').toLowerCase().includes('moon');
  const wildShapeUsed = shortRestAbilities.wild_shape_used || 0;
  const wildShapeMax = 2;
  const wildShapeLeft = Math.max(0, wildShapeMax - wildShapeUsed);
  const crCap = isCircleOfMoon ? Math.max(1, Math.floor(level / 3)) : level < 4 ? 0.25 : level < 8 ? 0.5 : 1;

  // Wild Shape
  abilities.push({
    id: 'wild_shape',
    name: 'Wild Shape',
    icon: <Flame className="w-4 h-4" />,
    color: '#86efac', borderColor: 'rgba(40,180,80,0.4)', bgColor: 'rgba(8,40,15,0.7)',
    type: isCircleOfMoon ? 'bonus_action' : 'action',
    description: `${isCircleOfMoon ? 'Bonus Action (Moon)' : 'Action'}: Transform into a beast you've seen. CR limit: ${crCap}. ${wildShapeLeft}/2 remaining.`,
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
    }
  });

  // Combat Wild Shape note (Moon Druid — bonus action wild shape)
  if (isCircleOfMoon) {
    abilities.push({
      id: 'combat_wild_shape',
      name: 'Combat Wild Shape',
      icon: <Wind className="w-4 h-4" />,
      color: '#4ade80', borderColor: 'rgba(40,180,80,0.3)', bgColor: 'rgba(8,30,15,0.6)',
      type: 'passive',
      description: 'Circle of the Moon: Wild Shape uses a bonus action instead of an action. You can also expend spell slots to heal your beast form (use the Slot Heal button).',
      shortDesc: 'Bonus action Wild Shape',
      used: false, available: true,
    });

    // Slot Heal (Moon Druid, PHB p.69)
    const inWildShape = !!shortRestAbilities.wild_shape_active;
    abilities.push({
      id: 'slot_heal',
      name: 'Beast Form Slot Heal',
      icon: <Heart className="w-4 h-4" />,
      color: '#f87171', borderColor: 'rgba(248,113,113,0.35)', bgColor: 'rgba(40,10,10,0.6)',
      type: 'bonus_action',
      description: 'While in beast form, expend a spell slot to heal 1d8 HP per slot level as a bonus action.',
      shortDesc: 'Heal beast form with a slot',
      used: !inWildShape,
      usedLabel: 'Not in Wild Shape',
      available: inWildShape,
      onUse: async () => {
        try {
          const res = await base44.functions.invoke('handleWildShape', {
            action: 'slot_heal', character_id: character.id, slot_level: 1,
          });
          if (res.data?.message) onMessage?.(res.data.message);
          const updated = await base44.entities.Character.get(character.id);
          onCharacterUpdate?.(() => updated);
        } catch (err) { console.error('slot_heal failed:', err); }
      },
    });

    // Elemental Wild Shape (L10+, Moon Druid)
    if (level >= 10) {
      const canElemental = wildShapeLeft >= 2;
      abilities.push({
        id: 'elemental_wild_shape',
        name: 'Elemental Wild Shape',
        icon: <Wind className="w-4 h-4" />,
        color: '#60a5fa', borderColor: 'rgba(96,165,250,0.4)', bgColor: 'rgba(8,20,50,0.7)',
        type: 'action',
        description: 'Use 2 Wild Shape uses to transform into an elemental (Air, Earth, Fire, Water). Choose the elemental type in the combat panel.',
        shortDesc: 'Become an elemental (2 uses)',
        used: !canElemental,
        usedLabel: 'Need 2 Wild Shape uses',
        available: canElemental,
        onUse: async () => {
          try {
            const res = await base44.functions.invoke('handleWildShape', {
              action: 'elemental_wild_shape', character_id: character.id,
              elemental_type: 'fire', combat_id: ctx.combat?.id, session_id: ctx.combat?.session_id,
            });
            if (res.data?.message) onMessage?.(res.data.message);
            const updated = await base44.entities.Character.get(character.id);
            onCharacterUpdate?.(() => updated);
          } catch (err) { console.error('elemental_wild_shape failed:', err); }
        },
      });
    }
  }

  return abilities;
}
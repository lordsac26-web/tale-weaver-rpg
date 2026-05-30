import React from 'react';
import { Zap, Star } from 'lucide-react';

// Build Artificer abilities: Infuse Item, The Right Tool for the Job.
export function buildArtificerAbilities(ctx) {
  const { level, shortRestAbilities } = ctx;
  const abilities = [];

  if (level >= 2) {
    const infusionsMax = Math.floor(level / 2) + 1;
    const infusionsUsed = shortRestAbilities.infusions_used || 0;
    const infusionsLeft = Math.max(0, infusionsMax - infusionsUsed);
    abilities.push({
      id: 'infuse_item',
      name: 'Infuse Item',
      icon: <Star className="w-4 h-4" />,
      color: '#fbbf24',
      borderColor: 'rgba(250,190,40,0.4)',
      bgColor: 'rgba(40,28,3,0.65)',
      type: 'passive',
      description: `Imbue up to ${infusionsMax} items with magical infusions (requires 1 hour attunement). Active infusions: ${infusionsLeft}/${infusionsMax} slots. Infusions end when you die or exceed your limit.`,
      shortDesc: `${infusionsLeft}/${infusionsMax} infusion slots active`,
      used: false,
      available: true,
    });
  }

  // The Right Tool for the Job (level 3+)
  if (level >= 3) {
    abilities.push({
      id: 'right_tool',
      name: "The Right Tool",
      icon: <Zap className="w-4 h-4" />,
      color: '#fde68a',
      borderColor: 'rgba(220,200,40,0.3)',
      bgColor: 'rgba(38,32,4,0.55)',
      type: 'special',
      description: 'During a short rest, produce any artisan\'s tools using tinker\'s tools. The tools disappear when you use this feature again.',
      shortDesc: 'Produce artisan tools (short rest)',
      used: false,
      available: true,
    });
  }

  return abilities;
}
import React from 'react';
import { Zap } from 'lucide-react';

// Build Warlock abilities: Pact Magic.
export function buildWarlockAbilities() {
  return [{
    id: 'pact_magic',
    name: 'Pact Magic',
    icon: <Zap className="w-4 h-4" />,
    color: '#c4b5fd',
    borderColor: 'rgba(160,120,255,0.35)',
    bgColor: 'rgba(28,10,55,0.65)',
    type: 'passive',
    description: 'Your spell slots recover on a Short Rest. All slots are cast at your highest available slot level.',
    shortDesc: 'Short rest spell recovery',
    used: false,
    available: true,
  }];
}
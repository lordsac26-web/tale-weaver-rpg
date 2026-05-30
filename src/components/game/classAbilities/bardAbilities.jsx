import React from 'react';
import { Sparkles } from 'lucide-react';
import { calcStatMod } from '../gameData';

// Build Bard abilities: Bardic Inspiration. (Spending handled via spendBardic.)
export function buildBardAbilities(ctx) {
  const { character, level, spendBardic } = ctx;
  const abilities = [];

  const dieMod = level < 5 ? 'd6' : level < 10 ? 'd8' : level < 15 ? 'd10' : 'd12';
  const chaBonus = calcStatMod(character.charisma || 10);
  const maxInspire = character.bardic_inspiration_max ?? (chaBonus > 0 ? chaBonus : 1);
  const inspireLeft = character.bardic_inspiration_remaining ?? maxInspire;
  abilities.push({
    id: 'bardic_inspiration',
    name: 'Bardic Inspiration',
    icon: <Sparkles className="w-4 h-4" />,
    color: '#fb923c',
    borderColor: 'rgba(250,140,50,0.4)',
    bgColor: 'rgba(40,20,5,0.65)',
    type: 'bonus_action',
    description: `Bonus Action: Grant an ally a ${dieMod} to add to one ability check, attack, or save. ${inspireLeft}/${maxInspire} remaining.`,
    shortDesc: `Grant ally ${dieMod} die (${inspireLeft} left)`,
    restType: level >= 5 ? 'short' : 'long',
    used: inspireLeft <= 0,
    usedLabel: `All uses spent (refills on ${level >= 5 ? 'short' : 'long'} rest)`,
    available: inspireLeft > 0,
    onUse: () => spendBardic(),
  });

  return abilities;
}
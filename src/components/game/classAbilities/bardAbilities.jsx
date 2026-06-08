import React from 'react';
import { Sparkles, Shield } from 'lucide-react';
import { calcStatMod } from '../gameData';
import { getFightingStyleDesc } from './abilityHelpers';
import { buildBardSubclassAbilities } from './bardSubclasses';

// Build Bard abilities: Bardic Inspiration + College subclass features.
// (Inspiration spending handled via spendBardic.)
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

  // College subclass features (Valor, Swords, Whispers, Glamour, Eloquence, Spirits, …)
  abilities.push(...buildBardSubclassAbilities(ctx));

  // Fighting Style reminder for College of Swords (passive info pill)
  if (character.fighting_style) {
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
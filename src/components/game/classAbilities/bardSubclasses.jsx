import React from 'react';
import { Sword, Swords, Eye, Brain, Shield, Sparkles, Music } from 'lucide-react';
import { calcStatMod } from '../gameData';

// Build College-specific Bard abilities, keyed off character.subclass.
// These are mostly informational/reminder pills surfaced in the combat panel so
// the player knows what their subclass lets them do. Bardic Inspiration spending
// (the resource these features consume) is handled by the main bardAbilities builder.
export function buildBardSubclassAbilities(ctx) {
  const { character, level } = ctx;
  const subclass = (character.subclass || '').toLowerCase();
  const abilities = [];

  const dieMod = level < 5 ? 'd6' : level < 10 ? 'd8' : level < 15 ? 'd10' : 'd12';
  const chaBonus = calcStatMod(character.charisma || 10);

  // ─── College of Valor (PHB) ───
  if (subclass.includes('valor') && level >= 3) {
    abilities.push({
      id: 'combat_inspiration',
      name: 'Combat Inspiration',
      icon: <Shield className="w-4 h-4" />,
      color: '#fca5a5',
      borderColor: 'rgba(220,80,60,0.4)',
      bgColor: 'rgba(45,10,8,0.65)',
      type: 'passive',
      description: `An ally with a Bardic Inspiration die from you can add it (${dieMod}) to a weapon damage roll, or use their reaction to add it to their AC against an attack.`,
      shortDesc: `Ally adds ${dieMod} to damage or AC`,
      used: false,
      available: true,
    });
    if (level >= 6) {
      abilities.push({
        id: 'valor_extra_attack',
        name: 'Extra Attack',
        icon: <Swords className="w-4 h-4" />,
        color: '#fcd34d',
        borderColor: 'rgba(220,180,40,0.4)',
        bgColor: 'rgba(40,30,5,0.6)',
        type: 'passive',
        description: 'You can attack twice, instead of once, whenever you take the Attack action on your turn.',
        shortDesc: 'Attack twice per Attack action',
        used: false,
        available: true,
      });
    }
  }

  // ─── College of Swords (XGtE) ───
  if (subclass.includes('sword') && level >= 3) {
    abilities.push({
      id: 'blade_flourish',
      name: 'Blade Flourish',
      icon: <Sword className="w-4 h-4" />,
      color: '#a5b4fc',
      borderColor: 'rgba(120,130,250,0.4)',
      bgColor: 'rgba(15,12,45,0.65)',
      type: 'passive',
      description: `When you take the Attack action, you can expend one Bardic Inspiration die (${dieMod}) for a Defensive, Slashing, or Mobile Flourish, adding the die to damage or AC.`,
      shortDesc: `Spend ${dieMod} on a flourish`,
      used: false,
      available: true,
    });
    if (level >= 6) {
      abilities.push({
        id: 'swords_extra_attack',
        name: 'Extra Attack',
        icon: <Swords className="w-4 h-4" />,
        color: '#fcd34d',
        borderColor: 'rgba(220,180,40,0.4)',
        bgColor: 'rgba(40,30,5,0.6)',
        type: 'passive',
        description: 'You can attack twice, instead of once, whenever you take the Attack action on your turn.',
        shortDesc: 'Attack twice per Attack action',
        used: false,
        available: true,
      });
    }
  }

  // ─── College of Whispers (XGtE) ───
  if (subclass.includes('whisper') && level >= 3) {
    abilities.push({
      id: 'psychic_blades',
      name: 'Psychic Blades',
      icon: <Brain className="w-4 h-4" />,
      color: '#c4b5fd',
      borderColor: 'rgba(160,120,255,0.4)',
      bgColor: 'rgba(30,10,55,0.65)',
      type: 'passive',
      description: `When you hit with a weapon attack, you can expend one Bardic Inspiration die to deal extra psychic damage (2d6 at level 3, scaling up with level).`,
      shortDesc: 'Spend Inspiration for +psychic damage',
      used: false,
      available: true,
    });
  }

  // ─── College of Glamour (XGtE) ───
  if (subclass.includes('glamour') && level >= 3) {
    abilities.push({
      id: 'mantle_of_inspiration',
      name: 'Mantle of Inspiration',
      icon: <Sparkles className="w-4 h-4" />,
      color: '#f9a8d4',
      borderColor: 'rgba(240,120,180,0.4)',
      bgColor: 'rgba(45,8,30,0.65)',
      type: 'bonus_action',
      description: `Bonus Action: Expend a Bardic Inspiration die to grant temporary HP to ${Math.max(1, chaBonus)} ally creature(s) and let each immediately move without provoking opportunity attacks.`,
      shortDesc: `Grant temp HP + move (${Math.max(1, chaBonus)} allies)`,
      used: false,
      available: true,
    });
  }

  // ─── College of Eloquence (TCoE) ───
  if (subclass.includes('eloquence') && level >= 3) {
    abilities.push({
      id: 'unsettling_words',
      name: 'Unsettling Words',
      icon: <Eye className="w-4 h-4" />,
      color: '#67e8f9',
      borderColor: 'rgba(60,200,230,0.4)',
      bgColor: 'rgba(5,35,42,0.65)',
      type: 'bonus_action',
      description: `Bonus Action: Expend one Bardic Inspiration die and choose a creature within 60 ft. Subtract the die roll (${dieMod}) from the target's next saving throw before your next turn.`,
      shortDesc: `Subtract ${dieMod} from a foe's next save`,
      used: false,
      available: true,
    });
  }

  // ─── College of Spirits (VRGtR) ───
  if (subclass.includes('spirit') && level >= 3) {
    abilities.push({
      id: 'tales_from_beyond',
      name: 'Tales from Beyond',
      icon: <Music className="w-4 h-4" />,
      color: '#d8b4fe',
      borderColor: 'rgba(190,140,250,0.4)',
      bgColor: 'rgba(30,12,45,0.65)',
      type: 'free',
      description: `Expend one Bardic Inspiration die and roll on the Spirit Tales table to channel a random spirit's effect this turn.`,
      shortDesc: 'Channel a random spirit tale',
      used: false,
      available: true,
    });
  }

  return abilities;
}
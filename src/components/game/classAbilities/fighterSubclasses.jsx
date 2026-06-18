import React from 'react';
import { Swords, Mountain, Hammer } from 'lucide-react';
import { base44 } from '@/api/base44Client';

// Build Rune Knight specific abilities (Tasha's): Giant's Might + Rune invocations.
// Blade-style level 3 Rune Knight gets Giant's Might (prof-bonus uses/long rest)
// and 2 carved runes (each invokable 1/short rest).
export function buildRuneKnightAbilities(ctx) {
  const { character, level, profBonus, shortRestAbilities, longRestAbilities, onMessage, onAbilityUsed } = ctx;
  const abilities = [];

  const isRuneKnight = (character.subclass || '').toLowerCase().includes('rune knight');
  if (!isRuneKnight || level < 3) return abilities;

  // ── Giant's Might (bonus action) — grow Large, advantage on STR, +bonus damage.
  // Uses = proficiency bonus per long rest. Bonus damage die scales: 1d6 → 1d8 (L10) → 1d10 (L18).
  const gmMax = profBonus;
  const gmUsed = longRestAbilities.giants_might_used || 0;
  const gmLeft = Math.max(0, gmMax - gmUsed);
  const gmDie = level >= 18 ? '1d10' : level >= 10 ? '1d8' : '1d6';
  abilities.push({
    id: 'giants_might',
    name: "Giant's Might",
    icon: <Mountain className="w-4 h-4" />,
    color: '#fcd34d',
    borderColor: 'rgba(230,170,40,0.45)',
    bgColor: 'rgba(42,30,5,0.7)',
    activeBg: 'rgba(72,50,8,0.85)',
    type: 'bonus_action',
    description: `Bonus Action: For 1 minute you become Large, gain advantage on Strength checks and saves, and once per turn deal +${gmDie} extra damage. ${gmLeft}/${gmMax} uses remaining. Recovers on a long rest.`,
    shortDesc: `Grow Large, +${gmDie} dmg · ${gmLeft}/${gmMax}`,
    restType: 'long',
    used: gmLeft <= 0,
    usedLabel: 'No uses left (long rest)',
    available: gmLeft > 0,
    onUse: async () => {
      await base44.entities.Character.update(character.id, {
        long_rest_abilities: { ...longRestAbilities, giants_might_used: gmUsed + 1 },
      });
      onMessage?.(`⛰️ Giant's Might! ${character.name} grows to Large size — advantage on STR and +${gmDie} damage for 1 minute! (${gmLeft - 1}/${gmMax} left)`);
      onAbilityUsed?.('giants_might', { die: gmDie, remaining: gmLeft - 1 });
    },
  });

  // ── Rune invocations — each carved rune can be invoked 1/short rest
  // (twice at L15 with Master of Runes). We track total invocations against
  // the number of known runes (2 at L3, 3 at L7, 4 at L10, 5 at L15).
  const knownRunes = level >= 15 ? 5 : level >= 10 ? 4 : level >= 7 ? 3 : 2;
  const invokesPerRune = level >= 15 ? 2 : 1;
  const runeMax = knownRunes * invokesPerRune;
  const runeUsed = shortRestAbilities.rune_invocations_used || 0;
  const runeLeft = Math.max(0, runeMax - runeUsed);
  abilities.push({
    id: 'rune_invocation',
    name: 'Invoke Rune',
    icon: <Hammer className="w-4 h-4" />,
    color: '#a7f3d0',
    borderColor: 'rgba(60,200,150,0.4)',
    bgColor: 'rgba(5,40,30,0.7)',
    activeBg: 'rgba(8,65,48,0.85)',
    type: 'special',
    description: `Invoke one of your ${knownRunes} carved runes (Cloud, Fire, Frost, Stone, Storm, or Hill) for its magical effect. ${runeLeft}/${runeMax} invocations remaining. Each rune recovers on a short rest.`,
    shortDesc: `${runeLeft}/${runeMax} rune invocations`,
    restType: 'short',
    used: runeLeft <= 0,
    usedLabel: 'No invocations left (short rest)',
    available: runeLeft > 0,
    onUse: async () => {
      await base44.entities.Character.update(character.id, {
        short_rest_abilities: { ...shortRestAbilities, rune_invocations_used: runeUsed + 1 },
      });
      onMessage?.(`🔨 ${character.name} invokes a rune! Its giant magic surges to life. (${runeLeft - 1}/${runeMax} left)`);
      onAbilityUsed?.('rune_invocation', { remaining: runeLeft - 1 });
    },
  });

  return abilities;
}

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
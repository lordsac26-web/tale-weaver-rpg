import React from 'react';
import { Flame, Swords } from 'lucide-react';

// Build Barbarian abilities: Rage, Reckless Attack.
export function buildBarbarianAbilities(ctx) {
  const { level, longRestAbilities } = ctx;
  const abilities = [];

  const RAGE_USES = [2,2,3,3,3,4,4,4,4,4,4,5,5,5,5,6,6,6,6,Infinity];
  const maxRages = RAGE_USES[level - 1] ?? 2;
  const usedRages = longRestAbilities.rage_uses_spent || 0; // rages reset on long rest
  const rageDamage = level < 9 ? 2 : level < 16 ? 3 : 4;
  const ragesLeft = maxRages === Infinity ? '∞' : Math.max(0, maxRages - usedRages);
  abilities.push({
    id: 'rage',
    name: 'Rage',
    icon: <Flame className="w-4 h-4" />,
    color: '#fca5a5',
    borderColor: 'rgba(220,60,40,0.45)',
    bgColor: 'rgba(45,5,5,0.7)',
    activeBg: 'rgba(80,10,8,0.85)',
    type: 'bonus_action',
    description: `Bonus Action. +${rageDamage} melee damage, resist B/P/S. Advantage on STR checks/saves. ${ragesLeft}/${maxRages === Infinity ? '∞' : maxRages} remaining.`,
    shortDesc: `+${rageDamage} dmg, resist B/P/S (${ragesLeft} left)`,
    restType: 'long',
    used: ragesLeft <= 0,
    usedLabel: 'No rages left',
    available: ragesLeft > 0,
  });

  // Reckless Attack
  abilities.push({
    id: 'reckless_attack',
    name: 'Reckless Attack',
    icon: <Swords className="w-4 h-4" />,
    color: '#fbbf24',
    borderColor: 'rgba(250,180,30,0.35)',
    bgColor: 'rgba(40,25,3,0.6)',
    type: 'passive_toggle',
    description: 'On your first attack: gain advantage on all STR attacks this turn. BUT enemies have advantage against you until your next turn.',
    shortDesc: 'Advantage + enemies adv vs you',
    used: false,
    available: true,
  });

  return abilities;
}
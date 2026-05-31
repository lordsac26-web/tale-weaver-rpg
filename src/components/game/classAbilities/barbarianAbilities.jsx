import React from 'react';
import { Flame, Swords } from 'lucide-react';

// Build Barbarian abilities: Rage, Reckless Attack.
// Both are toggles whose active state lives in combatModifiers (activeModifiers)
// and is read by the attack-resolution logic. ctx.activeModifiers / ctx.onToggleModifier
// are supplied by ClassAbilitiesPanel.
export function buildBarbarianAbilities(ctx) {
  const { level, longRestAbilities, activeModifiers = {}, onToggleModifier, onMessage } = ctx;
  const abilities = [];

  const RAGE_USES = [2,2,3,3,3,4,4,4,4,4,4,5,5,5,5,6,6,6,6,Infinity];
  const maxRages = RAGE_USES[level - 1] ?? 2;
  const usedRages = longRestAbilities.rage_uses_spent || 0; // rages reset on long rest
  const rageDamage = level < 9 ? 2 : level < 16 ? 3 : 4;
  const ragesLeft = maxRages === Infinity ? '∞' : Math.max(0, maxRages - usedRages);
  const rageActive = !!activeModifiers.rage;
  const outOfRages = maxRages !== Infinity && usedRages >= maxRages;

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
    shortDesc: rageActive ? `RAGING — +${rageDamage} dmg, resist B/P/S` : `+${rageDamage} dmg, resist B/P/S (${ragesLeft} left)`,
    restType: 'long',
    // A toggle: not "used" (greyed) unless out of rages and not currently raging
    used: outOfRages && !rageActive,
    usedLabel: 'No rages left',
    available: rageActive || !outOfRages,
    active: rageActive,
    onUse: () => {
      const turningOn = !rageActive;
      onToggleModifier?.('rage');
      onMessage?.(turningOn
        ? `🔥 ${ctx.character?.name || 'You'} enters a RAGE! +${rageDamage} melee damage, resistance to B/P/S.`
        : `Rage ends.`);
    },
  });

  // Reckless Attack — toggle for the turn
  const recklessActive = !!activeModifiers.reckless_attack;
  abilities.push({
    id: 'reckless_attack',
    name: 'Reckless Attack',
    icon: <Swords className="w-4 h-4" />,
    color: '#fbbf24',
    borderColor: 'rgba(250,180,30,0.35)',
    bgColor: 'rgba(40,25,3,0.6)',
    activeBg: 'rgba(70,45,6,0.85)',
    type: 'passive_toggle',
    description: 'On your first attack: gain advantage on all STR attacks this turn. BUT enemies have advantage against you until your next turn.',
    shortDesc: recklessActive ? 'ACTIVE — advantage on STR attacks' : 'Advantage + enemies adv vs you',
    used: false,
    available: true,
    active: recklessActive,
    onUse: () => {
      const turningOn = !recklessActive;
      onToggleModifier?.('reckless_attack');
      onMessage?.(turningOn
        ? `⚔️ ${ctx.character?.name || 'You'} attacks recklessly — advantage on STR attacks, but enemies gain advantage against you!`
        : `Reckless Attack disabled.`);
    },
  });

  return abilities;
}
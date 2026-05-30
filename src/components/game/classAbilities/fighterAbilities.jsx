import React from 'react';
import { Zap, Wind, Shield, Swords } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { getFightingStyleDesc } from './abilityHelpers';

// Build Fighter abilities: Second Wind, Action Surge, Battle Master Superiority Dice,
// Fighting Style, Indomitable.
export function buildFighterAbilities(ctx) {
  const { character, level, shortRestAbilities, longRestAbilities, onMessage, onAbilityUsed } = ctx;
  const abilities = [];

  // Second Wind — bonus action, heals 1d10+level HP, 1/short rest
  const secondWindUsed = !!shortRestAbilities.second_wind;
  abilities.push({
    id: 'second_wind',
    name: 'Second Wind',
    icon: <Wind className="w-4 h-4" />,
    color: '#86efac',
    borderColor: 'rgba(40,180,80,0.4)',
    bgColor: 'rgba(8,45,18,0.7)',
    activeBg: 'rgba(15,70,30,0.85)',
    type: 'bonus_action',
    description: `Bonus Action: Regain 1d10+${level} HP (avg ${Math.floor(level / 2) + 5 + level}). 1/short rest.`,
    shortDesc: `Heal 1d10+${level} HP`,
    restType: 'short',
    used: secondWindUsed,
    usedLabel: 'Used (short rest)',
    available: level >= 1,
    onUse: async () => {
      const healAmount = Math.floor(Math.random() * 10) + 1 + level;
      const newHp = Math.min(character.hp_max, (character.hp_current || 0) + healAmount);
      await base44.entities.Character.update(character.id, {
        hp_current: newHp,
        short_rest_abilities: { ...shortRestAbilities, second_wind: true }
      });
      onMessage?.(`💨 Second Wind! ${character.name} heals ${healAmount} HP (now ${newHp}/${character.hp_max}).`);
      onAbilityUsed?.('second_wind', { heal: healAmount, newHp });
    }
  });

  // Action Surge — use additional action, 1/short rest (2/short rest at level 17)
  const actionSurgeUsed = !!shortRestAbilities.action_surge;
  if (level >= 2) {
    abilities.push({
      id: 'action_surge',
      name: 'Action Surge',
      icon: <Zap className="w-4 h-4" />,
      color: '#fde68a',
      borderColor: 'rgba(220,200,40,0.45)',
      bgColor: 'rgba(40,35,5,0.7)',
      activeBg: 'rgba(70,55,8,0.85)',
      type: 'free',
      description: 'Gain one additional Action this turn. Once per short rest.',
      shortDesc: '+1 Action this turn',
      restType: 'short',
      used: actionSurgeUsed,
      usedLabel: 'Used (short rest)',
      available: true,
      onUse: async () => {
        await base44.entities.Character.update(character.id, {
          short_rest_abilities: { ...shortRestAbilities, action_surge: true }
        });
        onMessage?.(`⚡ Action Surge! ${character.name} gains an extra action this turn!`);
        onAbilityUsed?.('action_surge', {});
      }
    });
  }

  // Battle Master — Superiority Dice (subclass, level 3+). 4 dice (5 at L7, 6 at L15),
  // die size d8 (d10 at L10, d12 at L18). Recovered on a short or long rest (PHB p.73).
  const isBattleMaster = (character.subclass || '').toLowerCase().includes('battle master');
  if (isBattleMaster && level >= 3) {
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
  }

  // Fighting Style reminder (passive — shown as info pill)
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

  // Indomitable — reroll failed saving throw, 1/long rest (level 9+)
  if (level >= 9) {
    const indomitableUsed = !!longRestAbilities.indomitable;
    abilities.push({
      id: 'indomitable',
      name: 'Indomitable',
      icon: <Shield className="w-4 h-4" />,
      color: '#c4b5fd',
      borderColor: 'rgba(160,120,255,0.35)',
      bgColor: 'rgba(30,10,60,0.6)',
      activeBg: 'rgba(55,20,100,0.8)',
      type: 'reaction',
      description: 'Reroll one failed saving throw. Must use the new roll. 1/long rest.',
      shortDesc: 'Reroll failed save',
      restType: 'long',
      used: indomitableUsed,
      usedLabel: 'Used (long rest)',
      available: true,
      onUse: async () => {
        await base44.entities.Character.update(character.id, {
          long_rest_abilities: { ...longRestAbilities, indomitable: true }
        });
        onMessage?.(`🛡️ Indomitable! ${character.name} rerolls a failed saving throw!`);
        onAbilityUsed?.('indomitable', {});
      }
    });
  }

  return abilities;
}
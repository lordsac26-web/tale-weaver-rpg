import React from 'react';
import { Zap, Wind, Shield } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { getFightingStyleDesc } from './abilityHelpers';
import { buildBattleMasterAbilities, buildRuneKnightAbilities } from './fighterSubclasses';

// Build Fighter abilities: Second Wind, Action Surge, Fighting Style, Indomitable.
export function buildFighterAbilities(ctx) {
  const { character, level, combat, bonusActionUsed, shortRestAbilities, longRestAbilities, onMessage, onAbilityUsed, onCharacterUpdate } = ctx;
  const abilities = [];

  // Helper: invoke a combatActions backend action (server-authoritative)
  const invokeCombatAction = async (action, payload = {}) => {
    try {
      const res = await base44.functions.invoke('combatActions', {
        action, combat_id: combat?.id, session_id: combat?.session_id,
        character_id: character?.id, payload,
      });
      const data = res.data;
      if (data?.invalid) { onMessage?.(data.error || 'Action not available.'); return null; }
      if (data?.log_entry) onMessage?.(data.log_entry.text);
      if (data?.new_hp !== undefined || data?.heal_amount !== undefined) {
        const updated = await base44.entities.Character.get(character?.id);
        onCharacterUpdate?.(() => updated);
      }
      window.dispatchEvent(new CustomEvent('reload-combat'));
      return data;
    } catch (err) { console.error(`${action} failed:`, err); return null; }
  };

  // Second Wind — bonus action, heals 1d10+level HP, 1/short rest (PHB p.72)
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
    description: `Bonus Action: Regain 1d10+${level} HP. 1/short rest.`,
    shortDesc: `Heal 1d10+${level} HP`,
    restType: 'short',
    used: secondWindUsed,
    usedLabel: 'Used (short rest)',
    available: level >= 1 && !bonusActionUsed,
    onUse: async () => {
      if (combat?.id) {
        await invokeCombatAction('second_wind');
      } else {
        // Out of combat: simple client-side heal
        const healAmount = Math.floor(Math.random() * 10) + 1 + level;
        const newHp = Math.min(character.hp_max, (character.hp_current || 0) + healAmount);
        await base44.entities.Character.update(character.id, {
          hp_current: newHp,
          short_rest_abilities: { ...shortRestAbilities, second_wind: true }
        });
        onMessage?.(`💨 Second Wind! ${character.name} heals ${healAmount} HP (now ${newHp}/${character.hp_max}).`);
        onAbilityUsed?.('second_wind', { heal: healAmount, newHp });
      }
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

  // Compose subclass abilities
  abilities.push(...buildBattleMasterAbilities(ctx));
  abilities.push(...buildRuneKnightAbilities(ctx));

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
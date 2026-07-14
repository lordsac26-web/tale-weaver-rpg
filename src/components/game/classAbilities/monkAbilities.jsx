import React from 'react';
import { Shield, Swords, Zap } from 'lucide-react';
import { base44 } from '@/api/base44Client';

// Build Monk abilities: Martial Arts, Flurry of Blows, Patient Defense, Stunning Strike.
// Ki spending is server-authoritative — each action validates Monk level + Ki pool
// in the combat engine before deducting.
export function buildMonkAbilities(ctx) {
  const { character, level, combat, selectedTargetId, bonusActionUsed, onMessage, onCharacterUpdate } = ctx;
  const abilities = [];

  const kiLeft = character.ki_points_remaining ?? level;
  const profBonus = character.proficiency_bonus || 2;
  const wisMod = Math.floor(((character.wisdom || 10) - 10) / 2);
  const kiDC = 8 + profBonus + wisMod;

  // Helper: invoke a Monk combat engine action
  const invokeCombat = async (action, payload = {}) => {
    try {
      const res = await base44.functions.invoke('combatEngine', {
        action,
        session_id: combat?.session_id,
        combat_id: combat?.id,
        character_id: character?.id,
        payload,
      });
      const data = res.data;
      if (data?.invalid) {
        onMessage?.(data.error || 'Action not available.');
        return;
      }
      if (data?.log_entry) {
        onMessage?.(data.log_entry.text);
      }
      // Sync Ki from DB
      if (data?.ki_remaining !== undefined) {
        onCharacterUpdate?.((prev) => prev ? { ...prev, ki_points_remaining: data.ki_remaining } : prev);
      }
      // Reload combat so the UI reflects damage/conditions
      window.dispatchEvent(new CustomEvent('reload-combat'));
    } catch (err) {
      console.error(`${action} failed:`, err);
    }
  };

  // Martial Arts die info (passive) — scales at L5/11/17 (PHB p.76)
  const maDie = level >= 17 ? '1d10' : level >= 11 ? '1d8' : level >= 5 ? '1d6' : '1d4';
  abilities.push({
    id: 'martial_arts',
    name: 'Martial Arts',
    icon: <Swords className="w-4 h-4" />,
    color: '#a78bfa',
    borderColor: 'rgba(160,120,255,0.4)',
    bgColor: 'rgba(25,10,50,0.65)',
    type: 'passive',
    description: `Unarmed strikes deal ${maDie} damage and use DEX for attack/damage rolls. After attacking with a monk weapon, you can make one unarmed strike as a bonus action.`,
    shortDesc: `Unarmed ${maDie}, DEX-based`,
    used: false,
    available: true,
  });

  // Ki-powered abilities (L2+)
  if (level >= 2) {
    // Flurry of Blows — 2 unarmed strikes as bonus action (1 Ki, PHB p.78)
    abilities.push({
      id: 'flurry_of_blows',
      name: 'Flurry of Blows',
      icon: <Swords className="w-4 h-4" />,
      color: '#818cf8',
      borderColor: 'rgba(130,110,255,0.4)',
      bgColor: 'rgba(15,12,45,0.7)',
      type: 'bonus_action',
      description: `Bonus Action after Attack: make 2 unarmed strikes (${maDie} each, DEX-based). Costs 1 Ki. (${kiLeft} Ki remaining)`,
      shortDesc: `2 unarmed strikes (1 Ki — ${kiLeft} left)`,
      used: kiLeft <= 0 || bonusActionUsed,
      usedLabel: kiLeft <= 0 ? 'No Ki remaining' : 'Bonus action used',
      available: kiLeft > 0 && !bonusActionUsed && !!selectedTargetId,
      onUse: () => invokeCombat('flurry_of_blows', { target_id: selectedTargetId }),
    });

    // Patient Defense — Dodge as bonus action (1 Ki, PHB p.78)
    abilities.push({
      id: 'patient_defense',
      name: 'Patient Defense',
      icon: <Shield className="w-4 h-4" />,
      color: '#67e8f9',
      borderColor: 'rgba(100,230,250,0.35)',
      bgColor: 'rgba(5,25,35,0.65)',
      type: 'bonus_action',
      description: `Bonus Action: gain the effects of the Dodge action (attacks against you have disadvantage). Costs 1 Ki. (${kiLeft} Ki remaining)`,
      shortDesc: `Dodge (1 Ki — ${kiLeft} left)`,
      used: kiLeft <= 0 || bonusActionUsed,
      usedLabel: kiLeft <= 0 ? 'No Ki' : 'Bonus action used',
      available: kiLeft > 0 && !bonusActionUsed,
      onUse: () => invokeCombat('patient_defense'),
    });
  }

  // Stunning Strike — after melee hit, force CON save or stunned (1 Ki, L5+, PHB p.79)
  if (level >= 5) {
    abilities.push({
      id: 'stunning_strike',
      name: 'Stunning Strike',
      icon: <Zap className="w-4 h-4" />,
      color: '#fcd34d',
      borderColor: 'rgba(250,210,60,0.4)',
      bgColor: 'rgba(40,32,3,0.65)',
      type: 'free',
      description: `After hitting with a melee attack, spend 1 Ki to force a CON save (DC ${kiDC}). On failure, the target is stunned until the end of your next turn. (${kiLeft} Ki remaining)`,
      shortDesc: `Stun on hit (1 Ki — ${kiLeft} left)`,
      used: kiLeft <= 0,
      usedLabel: 'No Ki remaining',
      available: kiLeft > 0 && !!selectedTargetId,
      onUse: () => invokeCombat('stunning_strike', { target_id: selectedTargetId }),
    });
  }

  return abilities;
}
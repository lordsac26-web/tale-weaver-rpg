import React from 'react';
import { Shield, Sun, Crosshair, HeartPulse } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { calcStatMod } from '../gameData';

// Build Cleric abilities: Channel Divinity options (Turn Undead, Guided Strike, Preserve Life).
// All uses are server-authoritative via the combatActions backend function.
export function buildClericAbilities(ctx) {
  const { character, level, profBonus, combat, shortRestAbilities, onMessage, onCharacterUpdate } = ctx;
  const abilities = [];

  // Channel Divinity uses: 1/rest at L2, 2/rest at L6, 3/rest at L18 (PHB p.59)
  const maxCD = level >= 18 ? 3 : level >= 6 ? 2 : 1;
  const cdUsed = shortRestAbilities.channel_divinity_used || 0;
  const cdLeft = Math.max(0, maxCD - cdUsed);
  const wisMod = calcStatMod(character.wisdom || 10);
  const turnDC = 8 + profBonus + wisMod;

  // Helper: invoke a combatActions backend action
  const invokeCombatAction = async (action, payload = {}) => {
    try {
      const res = await base44.functions.invoke('combatActions', {
        action, combat_id: combat?.id, session_id: combat?.session_id,
        character_id: character?.id, payload,
      });
      const data = res.data;
      if (data?.invalid) { onMessage?.(data.error || 'Action not available.'); return null; }
      if (data?.log_entry) onMessage?.(data.log_entry.text);
      if (data?.new_hp !== undefined || data?.uses_remaining !== undefined) {
        const updated = await base44.entities.Character.get(character?.id);
        onCharacterUpdate?.(() => updated);
      }
      window.dispatchEvent(new CustomEvent('reload-combat'));
      return data;
    } catch (err) { console.error(`${action} failed:`, err); return null; }
  };

  const cdExhausted = cdLeft <= 0;
  const cdAvailable = level >= 2 && cdLeft > 0 && !!combat?.id;

  // Channel Divinity: Turn Undead (PHB p.59) — action, undead WIS save or turned/destroyed
  abilities.push({
    id: 'cd_turn_undead',
    name: 'Channel Divinity: Turn Undead',
    icon: <Sun className="w-4 h-4" />,
    color: '#fde047',
    borderColor: 'rgba(250,220,40,0.4)',
    bgColor: 'rgba(35,28,3,0.65)',
    type: 'action',
    description: `Action: Each undead within 30ft must make WIS save DC ${turnDC} or be turned (flee). Undead with CR ≤ ${Math.floor(level / 2)} are destroyed. ${cdLeft}/${maxCD} uses.`,
    shortDesc: `Turn Undead (${cdLeft}/${maxCD})`,
    restType: 'short',
    used: cdExhausted,
    usedLabel: 'Channel Divinity exhausted',
    available: cdAvailable,
    onUse: async () => { await invokeCombatAction('channel_divinity_turn_undead'); },
  });

  // Channel Divinity: Guided Strike (PHB p.59) — +10 to next attack roll, no action
  abilities.push({
    id: 'cd_guided_strike',
    name: 'Channel Divinity: Guided Strike',
    icon: <Crosshair className="w-4 h-4" />,
    color: '#fcd34d',
    borderColor: 'rgba(250,200,40,0.35)',
    bgColor: 'rgba(35,28,3,0.6)',
    type: 'free',
    description: `Gain +10 to your next attack roll this turn. Does not use an action. ${cdLeft}/${maxCD} uses.`,
    shortDesc: `+10 to next attack (${cdLeft}/${maxCD})`,
    restType: 'short',
    used: cdExhausted,
    usedLabel: 'Channel Divinity exhausted',
    available: cdAvailable,
    onUse: async () => { await invokeCombatAction('channel_divinity_guided_strike'); },
  });

  // Channel Divinity: Preserve Life (PHB p.60) — action, heal pool = 5 × cleric level
  abilities.push({
    id: 'cd_preserve_life',
    name: 'Channel Divinity: Preserve Life',
    icon: <HeartPulse className="w-4 h-4" />,
    color: '#86efac',
    borderColor: 'rgba(80,200,100,0.35)',
    bgColor: 'rgba(8,35,15,0.6)',
    type: 'action',
    description: `Action: Restore up to ${5 * level} HP total among creatures within 30ft (none above half their max). ${cdLeft}/${maxCD} uses.`,
    shortDesc: `Heal pool ${5 * level} HP (${cdLeft}/${maxCD})`,
    restType: 'short',
    used: cdExhausted,
    usedLabel: 'Channel Divinity exhausted',
    available: cdAvailable,
    onUse: async () => { await invokeCombatAction('channel_divinity_preserve_life'); },
  });

  return abilities;
}
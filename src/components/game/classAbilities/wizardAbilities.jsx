import React from 'react';
import { Zap, Shield, Eye } from 'lucide-react';
import { base44 } from '@/api/base44Client';

// Build Wizard abilities: Arcane Recovery, Arcane Ward (Abjuration), Portent (Divination).
export function buildWizardAbilities(ctx) {
  const { character, level, combat, worldState = {}, longRestAbilities = {}, shortRestAbilities, onMessage, onAbilityUsed } = ctx;
  const abilities = [];
  const subLower = (character.subclass || '').toLowerCase();

  // ── Arcane Ward (School of Abjuration 2+, PHB p.115) — engine-automated (M-S fix) ──
  if (subLower.includes('abjuration') && level >= 2) {
    const wardHp = longRestAbilities.arcane_ward_hp || 0;
    const wardMax = 2 * level + Math.floor(((character.intelligence || 10) - 10) / 2);
    abilities.push({
      id: 'arcane_ward',
      name: 'Arcane Ward',
      icon: <Shield className="w-4 h-4" />,
      color: '#7dd3fc', borderColor: 'rgba(100,200,255,0.4)', bgColor: 'rgba(5,25,45,0.65)',
      type: 'passive',
      description: `Casting an abjuration spell of 1st level or higher creates a magical ward (${wardMax} HP max) that absorbs damage before your hit points. Recharges 2×slot level per abjuration cast. (Engine: automated)`,
      shortDesc: wardHp > 0 ? `Ward active: ${wardHp}/${wardMax} HP` : 'Cast an abjuration spell to raise the ward',
      used: false, available: true,
    });
  }

  // ── Portent (School of Divination 2+, PHB p.116) (M-S fix) ──
  if (subLower.includes('divination') && level >= 2) {
    const portents = longRestAbilities.portent_rolls || [];
    const armedValue = worldState.portent_value;
    abilities.push({
      id: 'portent',
      name: 'Portent',
      icon: <Eye className="w-4 h-4" />,
      color: '#c4b5fd', borderColor: 'rgba(170,130,255,0.4)', bgColor: 'rgba(25,10,50,0.65)',
      activeBg: 'rgba(45,20,85,0.85)',
      type: 'free',
      description: `Foreseen rolls: ${portents.length ? portents.join(', ') : 'none (long rest to foresee new ones)'}. Use one to REPLACE your next attack roll's d20.${armedValue != null ? ` Currently armed: ${armedValue}.` : ''}`,
      shortDesc: armedValue != null ? `Armed: next attack rolls ${armedValue}` : (portents.length ? `Foreseen: ${portents.join(', ')} — use one` : 'No portent dice left'),
      restType: 'long',
      used: portents.length === 0 && armedValue == null,
      usedLabel: 'No portent dice (long rest)',
      available: !!combat?.id && portents.length > 0 && armedValue == null,
      active: armedValue != null,
      onUse: async () => {
        try {
          // Use the best-suited die: highest roll (assume the player wants to hit)
          const bestIdx = portents.indexOf(Math.max(...portents));
          const res = await base44.functions.invoke('subclassActions', {
            action: 'use_portent', combat_id: combat?.id, session_id: combat?.session_id,
            character_id: character?.id, payload: { roll_index: bestIdx },
          });
          if (res.data?.invalid) { onMessage?.(res.data.error); return; }
          if (res.data?.log_entry) onMessage?.(res.data.log_entry.text);
          window.dispatchEvent(new CustomEvent('reload-combat'));
        } catch (err) { console.error('use_portent failed:', err); }
      },
    });
  }

  if (level >= 2) {
    const arcaneUsed = !!shortRestAbilities.arcane_recovery;
    abilities.push({
      id: 'arcane_recovery',
      name: 'Arcane Recovery',
      icon: <Zap className="w-4 h-4" />,
      color: '#c4b5fd',
      borderColor: 'rgba(160,120,255,0.4)',
      bgColor: 'rgba(28,12,55,0.7)',
      activeBg: 'rgba(50,20,90,0.85)',
      type: 'special',
      description: `Once per long rest during a short rest, recover spell slots totaling up to ${Math.ceil(level / 2)} levels combined.`,
      shortDesc: `Recover ${Math.ceil(level / 2)} spell slot levels`,
      restType: 'short',
      used: arcaneUsed,
      usedLabel: 'Used (long rest)',
      available: !arcaneUsed,
      onUse: async () => {
        await base44.entities.Character.update(character.id, {
          short_rest_abilities: { ...shortRestAbilities, arcane_recovery: true }
        });
        onMessage?.(`✨ Arcane Recovery! ${character.name} recovers spell slots (up to ${Math.ceil(level / 2)} levels).`);
        onAbilityUsed?.('arcane_recovery', {});
      }
    });
  }

  return abilities;
}
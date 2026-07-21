import React from 'react';
import { Shield, Eye, Sparkles } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { getFightingStyleDesc } from './abilityHelpers';

// Build Ranger abilities: Hunter's Mark, Fighting Style, Planar Warrior (Horizon Walker).
export function buildRangerAbilities(ctx) {
  const { character, level, combat, worldState = {}, selectedTargetId, bonusActionUsed, onMessage } = ctx;
  const abilities = [];

  // ── Planar Warrior (Horizon Walker 3+, XGtE p.42) (M-S fix) ──
  if ((character.subclass || '').toLowerCase().includes('horizon') && level >= 3) {
    const armed = !!worldState.planar_warrior_target;
    const dice = level >= 11 ? '2d8' : '1d8';
    abilities.push({
      id: 'planar_warrior',
      name: 'Planar Warrior',
      icon: <Sparkles className="w-4 h-4" />,
      color: '#a5b4fc', borderColor: 'rgba(140,150,255,0.4)', bgColor: 'rgba(15,15,50,0.65)',
      activeBg: 'rgba(30,30,90,0.85)',
      type: 'bonus_action',
      description: `Bonus Action: channel planar energy at a target — your next hit against it deals +${dice} force damage.`,
      shortDesc: armed ? `ARMED — next hit +${dice} force` : `Next hit +${dice} force`,
      used: bonusActionUsed && !armed,
      usedLabel: 'Bonus action used',
      available: !!combat?.id && !armed && !bonusActionUsed,
      active: armed,
      onUse: async () => {
        try {
          const res = await base44.functions.invoke('subclassActions', {
            action: 'planar_warrior', combat_id: combat?.id, session_id: combat?.session_id,
            character_id: character?.id, payload: { target_id: selectedTargetId },
          });
          if (res.data?.invalid) { onMessage?.(res.data.error); return; }
          if (res.data?.log_entry) onMessage?.(res.data.log_entry.text);
          window.dispatchEvent(new CustomEvent('reload-combat'));
        } catch (err) { console.error('planar_warrior failed:', err); }
      },
    });
  }

  // Hunter's Mark reminder
  if (level >= 1) {
    abilities.push({
      id: 'hunters_mark',
      name: "Hunter's Mark",
      icon: <Eye className="w-4 h-4" />,
      color: '#6ee7b7',
      borderColor: 'rgba(80,220,160,0.35)',
      bgColor: 'rgba(5,35,20,0.65)',
      type: 'passive',
      description: "Bonus Action: Cast Hunter's Mark (requires spell slot). Designate a creature — deal +1d6 damage to it and have advantage on Perception/Survival checks to find it. Move the mark as a bonus action when target dies.",
      shortDesc: '+1d6 dmg to marked target (spell)',
      used: false,
      available: true,
    });
  }

  // Fighting Style (Ranger also gets one at level 2)
  if (level >= 2 && character.fighting_style) {
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
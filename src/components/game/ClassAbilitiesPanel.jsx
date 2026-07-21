import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, ChevronDown } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { PROFICIENCY_BY_LEVEL } from './gameData';
import AbilityRow from './AbilityRow';
import LayOnHandsModal from './LayOnHandsModal';
import { CLASS_ABILITY_BUILDERS, buildFeatAbilities, buildGenericSubclassAbilities, buildRacialAbilities } from './classAbilities';

/**
 * ClassAbilitiesPanel — shows prominently all class-specific combat abilities
 * available to the current character (Second Wind, Action Surge, Stances, etc.)
 * Abilities that consume resources track usage and show remaining counts.
 *
 * Per-class ability definitions live in ./classAbilities/<class>Abilities.jsx.
 * This component is a thin orchestrator: it builds a shared context, dispatches
 * to the matching class builder via CLASS_ABILITY_BUILDERS, appends feat passives,
 * and renders the result.
 */
export default function ClassAbilitiesPanel({ character, combat, worldState, onAbilityUsed, onMessage, onCharacterUpdate, activeModifiers, onToggleModifier, selectedTargetId }) {
  const [collapsed, setCollapsed] = useState(false);
  const [showLayOnHands, setShowLayOnHands] = useState(false);

  // Server-authoritative resource spend — backend validates class/level/pool and deducts.
  const spendResource = async (resource, extra = {}) => {
    try {
      const res = await base44.functions.invoke('spendResource', {
        resource, character_id: character.id, ...extra,
      });
      if (res.data?.success) {
        onMessage?.(res.data.log_text);
        // Refresh local character with the new remaining pool so the UI updates immediately.
        const fields = resource === 'ki'
          ? { ki_points_remaining: res.data.remaining, ki_points_max: res.data.max }
          : { bardic_inspiration_remaining: res.data.remaining, bardic_inspiration_max: res.data.max };
        onCharacterUpdate?.((prev) => prev ? { ...prev, ...fields } : prev);
        onAbilityUsed?.(resource, res.data);
      } else if (res.data?.error) {
        onMessage?.(res.data.error);
      }
    } catch (err) {
      console.error(`spendResource(${resource}) failed:`, err);
    }
  };
  const spendKi = (ability) => spendResource('ki', { ability });
  const spendBardic = () => spendResource('bardic');

  if (!character) return null;

  const charClass = character.class || '';
  const level = character.level || 1;
  const profBonus = PROFICIENCY_BY_LEVEL[(level - 1)] || 2;

  // Shared context passed to every ability builder.
  const ctx = {
    character,
    level,
    profBonus,
    combat,
    selectedTargetId,
    shortRestAbilities: character.short_rest_abilities || {},
    longRestAbilities: character.long_rest_abilities || {},
    bonusActionUsed: worldState?.bonus_action_used || false,
    worldState: worldState || {},
    onMessage,
    onAbilityUsed,
    onCharacterUpdate,
    spendKi,
    spendBardic,
    openLayOnHands: () => setShowLayOnHands(true),
    // Toggle state (Rage, Reckless Attack, etc.) shared with the attack-resolution modifiers
    activeModifiers: activeModifiers || {},
    onToggleModifier,
  };

  const classBuilder = CLASS_ABILITY_BUILDERS[charClass];
  const abilities = [
    ...(classBuilder ? classBuilder(ctx) : []),
    ...buildGenericSubclassAbilities(ctx),
    ...buildRacialAbilities(ctx),
    ...buildFeatAbilities(ctx),
  ];

  if (abilities.length === 0) return null;

  return (
    <div className="rounded-lg overflow-hidden" style={{ background: 'rgba(8,5,2,0.8)', border: '1px solid rgba(180,140,90,0.2)' }}>
      {/* Header */}
      <button
        onClick={() => setCollapsed(v => !v)}
        className="w-full flex items-center justify-between px-3 py-2 text-xs font-fantasy"
        style={{ color: 'rgba(220,180,100,0.8)', background: 'rgba(30,20,5,0.6)' }}>
        <span className="flex items-center gap-2">
          <Zap className="w-3.5 h-3.5" style={{ color: '#f0c040' }} />
          Class Abilities
          <span className="px-1.5 py-0.5 rounded-full text-xs" style={{ background: 'rgba(60,40,8,0.8)', border: '1px solid rgba(212,149,90,0.3)', color: '#f0c040', fontSize: '0.6rem' }}>
            {charClass} Lv.{level}
          </span>
        </span>
        <motion.div animate={{ rotate: collapsed ? -90 : 0 }}>
          <ChevronDown className="w-3 h-3" />
        </motion.div>
      </button>

      <AnimatePresence>
        {!collapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden">
            <div className="p-2 grid grid-cols-1 gap-1.5" style={{ borderTop: '1px solid rgba(180,140,90,0.1)' }}>
              {abilities.map(ability => (
                <AbilityRow key={ability.id} ability={ability} />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {showLayOnHands && (
        <LayOnHandsModal
          character={character}
          onClose={() => setShowLayOnHands(false)}
          onMessage={onMessage}
          onCharacterUpdate={onCharacterUpdate}
          onAbilityUsed={onAbilityUsed}
        />
      )}
    </div>
  );
}
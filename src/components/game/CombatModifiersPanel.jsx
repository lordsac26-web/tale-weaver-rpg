import React, { useState } from 'react';
import { Zap, Shield, Flame, Sparkles, Swords, ChevronDown, ChevronUp } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { calcStatMod } from './gameData';

export default function CombatModifiersPanel({ character, onToggleModifier, activeModifiers = {} }) {
  const [expanded, setExpanded] = useState(false);

  // Available toggleable modifiers based on class/features
  const availableModifiers = [];

  // Barbarian: Rage
  if (character?.class === 'Barbarian') {
    const level = character.level || 1;
    const rageDamage = level < 9 ? 2 : level < 16 ? 3 : 4;
    availableModifiers.push({
      id: 'rage',
      name: 'Rage',
      icon: <Flame className="w-3.5 h-3.5" />,
      color: '#fca5a5',
      effect: `+${rageDamage} damage, resistance to B/P/S`,
      description: `While raging: +${rageDamage} melee damage, resistance to physical damage, advantage on STR checks/saves, cannot cast spells.`,
    });
  }

  // Fighter: Action Surge
  if (character?.class === 'Fighter' && (character?.level || 1) >= 2) {
    availableModifiers.push({
      id: 'action_surge',
      name: 'Action Surge',
      icon: <Zap className="w-3.5 h-3.5" />,
      color: '#fde68a',
      effect: '+1 Action this turn',
      description: 'Gain one additional action on your turn. Recharges on short rest.',
      type: 'once_per_short_rest'
    });
  }

  // Paladin: Divine Smite available
  if (character?.class === 'Paladin' && (character?.level || 1) >= 2) {
    availableModifiers.push({
      id: 'divine_smite_ready',
      name: 'Smite Ready',
      icon: <Sparkles className="w-3.5 h-3.5" />,
      color: '#fde047',
      effect: 'Add radiant damage on hit',
      description: 'Expend spell slot on melee hit for +2d8 radiant damage per slot level.',
      type: 'toggle'
    });
  }

  // Rogue: Sneak Attack
  if (character?.class === 'Rogue') {
    const level = character.level || 1;
    const sneakDice = Math.ceil(level / 2);
    availableModifiers.push({
      id: 'sneak_attack_ready',
      name: 'Sneak Attack',
      icon: <Swords className="w-3.5 h-3.5" />,
      color: '#a78bfa',
      effect: `+${sneakDice}d6 damage (1/turn)`,
      description: `Once per turn, add ${sneakDice}d6 damage if you have advantage or an ally is within 5 ft of target.`,
      type: 'once_per_turn'
    });
  }

  // Advantage/Disadvantage toggles
  availableModifiers.push({
    id: 'advantage',
    name: 'Advantage',
    icon: <ChevronUp className="w-3.5 h-3.5" />,
    color: '#86efac',
    effect: 'Roll twice, take higher',
    description: 'You have advantage on this attack roll.',
    type: 'toggle'
  });

  availableModifiers.push({
    id: 'disadvantage',
    name: 'Disadvantage',
    icon: <ChevronDown className="w-3.5 h-3.5" />,
    color: '#fca5a5',
    effect: 'Roll twice, take lower',
    description: 'You have disadvantage on this attack roll.',
    type: 'toggle'
  });

  // Cover bonuses
  availableModifiers.push({
    id: 'half_cover',
    name: 'Target: Half Cover',
    icon: <Shield className="w-3.5 h-3.5" />,
    color: '#93c5fd',
    effect: 'Target +2 AC',
    description: 'Target has half cover (+2 AC, +2 DEX saves).',
    type: 'toggle'
  });

  if (availableModifiers.length === 0) return null;

  return (
    <div className="rounded-lg overflow-hidden"
      style={{ background: 'rgba(10,8,3,0.6)', border: '1px solid rgba(180,140,90,0.15)' }}>
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full px-3 py-2 flex items-center justify-between text-xs font-fantasy transition-all"
        style={{ color: 'rgba(201,169,110,0.6)' }}>
        <span className="flex items-center gap-2">
          <Sparkles className="w-3 h-3" />
          Combat Modifiers {Object.keys(activeModifiers).filter(k => activeModifiers[k]).length > 0 && `(${Object.keys(activeModifiers).filter(k => activeModifiers[k]).length})`}
        </span>
        <motion.div animate={{ rotate: expanded ? 180 : 0 }}>
          <ChevronDown className="w-3 h-3" />
        </motion.div>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden">
            <div className="px-3 pb-3 space-y-1.5 pt-1"
              style={{ borderTop: '1px solid rgba(180,140,90,0.08)' }}>
              {availableModifiers.map(mod => {
                const isActive = activeModifiers[mod.id];
                return (
                  <button
                    key={mod.id}
                    onClick={() => onToggleModifier(mod.id)}
                    className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition-all text-xs"
                    style={isActive ? {
                      background: 'rgba(60,40,10,0.6)',
                      border: `1px solid ${mod.color}55`,
                      color: mod.color
                    } : {
                      background: 'rgba(15,10,5,0.4)',
                      border: '1px solid rgba(100,70,30,0.2)',
                      color: 'rgba(180,140,90,0.4)'
                    }}>
                    <div className="flex-shrink-0" style={{ color: isActive ? mod.color : 'rgba(180,140,90,0.3)' }}>
                      {mod.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-fantasy font-semibold" style={{ fontSize: '0.7rem' }}>{mod.name}</div>
                      <div className="font-body italic" style={{ color: isActive ? `${mod.color}99` : 'rgba(150,120,80,0.35)', fontSize: '0.65rem' }}>
                        {mod.effect}
                      </div>
                    </div>
                    <div className="w-3 h-3 rounded-full flex-shrink-0"
                      style={isActive ? {
                        background: mod.color,
                        boxShadow: `0 0 6px ${mod.color}88`
                      } : {
                        background: 'rgba(40,30,10,0.6)',
                        border: '1px solid rgba(100,70,30,0.3)'
                      }} />
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
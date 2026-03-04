import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles, Heart, Zap, Shield } from 'lucide-react';
import { CATEGORY_ICONS, ITEM_RARITY } from './itemData';

// Maps item name keywords to effects
function parseConsumableEffect(item) {
  const name = item.name?.toLowerCase() || '';
  const desc = item.description?.toLowerCase() || '';

  if (name.includes('healing') || desc.includes('heal') || desc.includes('hit point')) {
    if (name.includes('supreme') || name.includes('supreme')) return { type: 'heal', dice: '4d4+4', label: 'Heals 4d4+4 HP', icon: '❤️' };
    if (name.includes('greater')) return { type: 'heal', dice: '4d4+4', label: 'Heals 4d4+4 HP', icon: '❤️' };
    if (name.includes('superior')) return { type: 'heal', dice: '8d4+8', label: 'Heals 8d4+8 HP', icon: '❤️' };
    if (name.includes('supreme')) return { type: 'heal', dice: '10d4+20', label: 'Heals 10d4+20 HP', icon: '❤️' };
    return { type: 'heal', dice: '2d4+2', label: 'Heals 2d4+2 HP', icon: '❤️' };
  }
  if (name.includes('mana') || name.includes('arcane') || desc.includes('spell slot')) {
    return { type: 'restore_spell_slot', label: 'Restores a spell slot', icon: '🔮' };
  }
  if (name.includes('speed') || desc.includes('speed')) {
    return { type: 'buff', stat: 'speed', value: 15, duration: 1, label: '+15 ft speed for 1 hour', icon: '💨' };
  }
  if (name.includes('strength') || desc.includes('strength score')) {
    return { type: 'buff', stat: 'strength', value: 4, duration: 1, label: '+4 Strength for 1 hour', icon: '💪' };
  }
  if (name.includes('invisib')) {
    return { type: 'condition', condition: 'invisible', label: 'Become invisible for 1 hour', icon: '👻' };
  }
  if (name.includes('fire breath') || name.includes('fire resistance')) {
    return { type: 'resistance', element: 'fire', label: 'Fire resistance for 1 hour', icon: '🔥' };
  }
  if (name.includes('giant') || name.includes('enlarge')) {
    return { type: 'buff', stat: 'strength', value: 2, duration: 1, label: '+2 Strength for 1 hour', icon: '⬆️' };
  }
  if (name.includes('antitoxin') || name.includes('anti-poison')) {
    return { type: 'condition_cure', condition: 'poisoned', label: 'Cures poisoned condition', icon: '🧪' };
  }
  // Default: generic use
  return { type: 'generic', label: 'Item used', icon: CATEGORY_ICONS[item.category] || '🧪' };
}

function rollDice(notation) {
  // e.g. "2d4+2"
  const match = notation.match(/(\d+)d(\d+)(?:\+(\d+))?/);
  if (!match) return parseInt(notation) || 0;
  const [, count, sides, bonus] = match;
  let total = 0;
  for (let i = 0; i < parseInt(count); i++) {
    total += Math.floor(Math.random() * parseInt(sides)) + 1;
  }
  return total + (parseInt(bonus) || 0);
}

export default function ConsumableUseModal({ item, character, onUse, onClose }) {
  const [result, setResult] = useState(null);
  const [used, setUsed] = useState(false);
  const rarity = ITEM_RARITY[item.rarity] || ITEM_RARITY.common;
  const effect = parseConsumableEffect(item);

  const handleUse = () => {
    let outcome = { effect, updates: {} };

    if (effect.type === 'heal') {
      const rolled = rollDice(effect.dice);
      const newHP = Math.min((character.hp_current || 0) + rolled, character.hp_max || 999);
      outcome.healed = rolled;
      outcome.newHP = newHP;
      outcome.updates = { hp_current: newHP };
      outcome.message = `You drink the ${item.name} and recover ${rolled} hit points!`;
    } else if (effect.type === 'condition_cure') {
      const conditions = (character.conditions || []).filter(c => {
        const name = typeof c === 'string' ? c : c.name;
        return name?.toLowerCase() !== effect.condition;
      });
      outcome.updates = { conditions };
      outcome.message = `The ${item.name} cures your ${effect.condition} condition.`;
    } else if (effect.type === 'condition') {
      const conditions = [...(character.conditions || []), { name: effect.condition, source: item.name }];
      outcome.updates = { conditions };
      outcome.message = `You are now ${effect.condition}!`;
    } else if (effect.type === 'buff') {
      const modifiers = [...(character.active_modifiers || []), {
        source: item.name, stat: effect.stat, value: effect.value, duration: effect.duration
      }];
      outcome.updates = { active_modifiers: modifiers };
      outcome.message = `${effect.label} from ${item.name}!`;
    } else {
      outcome.message = `You use the ${item.name}. ${item.description?.slice(0, 100) || ''}`;
    }

    setResult(outcome);
    setUsed(true);
    onUse(item, outcome.updates);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)' }}
      onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-sm rounded-2xl overflow-hidden"
        style={{ background: 'rgba(12,8,4,0.97)', border: `1px solid ${rarity.border}`, boxShadow: `0 0 40px ${rarity.glow}` }}
        onClick={e => e.stopPropagation()}>

        <div className="h-px w-full" style={{ background: `linear-gradient(90deg, transparent, ${rarity.color}60, transparent)` }} />

        <div className="p-5">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
                style={{ background: `${rarity.glow}`, border: `1px solid ${rarity.border}` }}>
                {CATEGORY_ICONS[item.category] || '🧪'}
              </div>
              <div>
                <h3 className="font-fantasy font-bold text-lg" style={{ color: rarity.color }}>{item.name}</h3>
                <p className="text-xs" style={{ color: 'rgba(180,140,90,0.5)', fontFamily: 'EB Garamond, serif' }}>{item.category}</p>
              </div>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg" style={{ color: 'rgba(180,140,90,0.4)' }}>
              <X className="w-4 h-4" />
            </button>
          </div>

          {item.description && (
            <p className="text-sm mb-4 leading-relaxed italic"
              style={{ color: 'rgba(232,213,183,0.6)', fontFamily: 'IM Fell English, serif', borderLeft: `2px solid ${rarity.border}`, paddingLeft: '0.75rem' }}>
              {item.description}
            </p>
          )}

          <div className="rounded-xl p-3 mb-4" style={{ background: 'rgba(10,25,15,0.5)', border: '1px solid rgba(40,160,80,0.2)' }}>
            <div className="text-xs font-fantasy tracking-widest mb-1" style={{ color: 'rgba(86,239,172,0.4)', fontSize: '0.6rem' }}>EFFECT</div>
            <div className="flex items-center gap-2">
              <span className="text-xl">{effect.icon}</span>
              <span className="text-sm" style={{ color: '#86efac', fontFamily: 'EB Garamond, serif' }}>{effect.label}</span>
            </div>
          </div>

          <AnimatePresence>
            {result && (
              <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                className="rounded-xl p-3 mb-4" style={{ background: 'rgba(10,40,15,0.6)', border: '1px solid rgba(86,239,172,0.3)' }}>
                <p className="text-sm" style={{ color: '#e8d5b7', fontFamily: 'IM Fell English, serif', lineHeight: 1.6 }}>
                  {result.message}
                </p>
                {result.healed && (
                  <div className="flex items-center gap-2 mt-2">
                    <Heart className="w-4 h-4" style={{ color: '#dc2626' }} />
                    <span className="font-fantasy font-bold" style={{ color: '#86efac' }}>+{result.healed} HP</span>
                    <span className="text-xs" style={{ color: 'rgba(180,140,90,0.4)' }}>→ {result.newHP}/{character.hp_max}</span>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex gap-2">
            {!used ? (
              <button onClick={handleUse}
                className="flex-1 py-2.5 rounded-xl text-sm font-fantasy transition-all"
                style={{ background: 'rgba(10,50,15,0.8)', border: '1px solid rgba(40,160,80,0.4)', color: '#86efac' }}
                onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(86,239,172,0.6)'}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(40,160,80,0.4)'}>
                ✨ Use Item
              </button>
            ) : (
              <button onClick={onClose}
                className="flex-1 py-2.5 rounded-xl text-sm font-fantasy"
                style={{ background: 'rgba(40,25,8,0.8)', border: '1px solid rgba(201,169,110,0.3)', color: '#c9a96e' }}>
                Close
              </button>
            )}
            {!used && (
              <button onClick={onClose}
                className="px-4 py-2.5 rounded-xl text-sm"
                style={{ border: '1px solid rgba(180,140,90,0.15)', color: 'rgba(180,140,90,0.4)' }}>
                Cancel
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
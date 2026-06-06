import React from 'react';
import { motion } from 'framer-motion';
import { Star, X, ChevronRight } from 'lucide-react';
import { getTotalLevel } from './levelUpUtils';

/**
 * LevelUpToast — an in-game notification banner that appears when the character
 * has earned enough XP to level up. Tapping "Level Up" opens the LevelUpModal
 * wizard; the player can also dismiss it to keep playing.
 *
 * Props:
 *  - character: the active character
 *  - onLevelUp: () => void  — open the level-up wizard
 *  - onDismiss: () => void  — hide the toast for now
 */
export default function LevelUpToast({ character, onLevelUp, onDismiss }) {
  if (!character) return null;
  const nextLevel = getTotalLevel(character) + 1;

  return (
    <motion.div
      initial={{ opacity: 0, y: -24, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -24, scale: 0.95 }}
      transition={{ type: 'spring', stiffness: 300, damping: 24 }}
      className="fixed top-24 left-1/2 -translate-x-1/2 z-40 w-[92%] max-w-md"
    >
      <div className="rounded-2xl overflow-hidden rune-border"
        style={{
          background: 'linear-gradient(135deg, rgba(80,50,10,0.97), rgba(50,28,6,0.98))',
          border: '2px solid rgba(240,192,64,0.5)',
          boxShadow: '0 0 40px rgba(240,192,64,0.3), 0 12px 36px rgba(0,0,0,0.7)',
        }}>
        <div className="flex items-center gap-3 px-4 py-3">
          <motion.div
            animate={{ rotate: [0, 12, -12, 0], scale: [1, 1.18, 1] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
            className="flex-shrink-0">
            <Star className="w-8 h-8" style={{ color: '#f0c040', filter: 'drop-shadow(0 0 10px rgba(240,192,64,0.7))' }} />
          </motion.div>

          <div className="flex-1 min-w-0">
            <div className="font-fantasy-deco font-bold text-base text-gold-shimmer leading-tight">
              Level Up Available!
            </div>
            <div className="text-xs truncate" style={{ color: 'var(--parchment-mid)', fontFamily: 'EB Garamond, serif' }}>
              {character.name} can advance to <span className="font-bold" style={{ color: '#f0c040' }}>Level {nextLevel}</span>
            </div>
          </div>

          <button onClick={onLevelUp}
            className="flex-shrink-0 px-3.5 py-2 rounded-xl font-fantasy font-bold text-xs btn-fantasy flex items-center gap-1">
            <Star className="w-3.5 h-3.5" />
            Level Up
            <ChevronRight className="w-3.5 h-3.5" />
          </button>

          <button onClick={onDismiss}
            className="flex-shrink-0 p-1.5 rounded-lg transition-colors"
            style={{ color: 'rgba(201,169,110,0.45)', background: 'rgba(20,13,5,0.5)' }}
            onMouseEnter={e => e.currentTarget.style.color = '#c9a96e'}
            onMouseLeave={e => e.currentTarget.style.color = 'rgba(201,169,110,0.45)'}>
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}
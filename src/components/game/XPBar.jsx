import React from 'react';
import { Star } from 'lucide-react';
import { motion } from 'framer-motion';

const XP_THRESHOLDS = [0, 300, 900, 2700, 6500, 14000, 23000, 34000, 48000, 64000, 85000, 100000, 120000, 140000, 165000, 195000, 225000, 265000, 305000, 355000];

// Reusable XP progress bar. Shows current level, current XP, next-level threshold,
// and a bar that gradually fills as XP is awarded. `compact` renders the slim HUD variant.
export default function XPBar({ character, compact = false }) {
  if (!character) return null;

  const level = character.level || 1;
  const currentXP = character.xp || 0;
  const isMax = level >= 20;
  const xpForCurrent = XP_THRESHOLDS[level - 1] || 0;
  const xpForNext = isMax ? currentXP : (XP_THRESHOLDS[level] || XP_THRESHOLDS[XP_THRESHOLDS.length - 1]);
  const pct = isMax ? 100 : (xpForNext > xpForCurrent ? Math.min(100, ((currentXP - xpForCurrent) / (xpForNext - xpForCurrent)) * 100) : 100);
  const xpToGo = isMax ? 0 : Math.max(0, xpForNext - currentXP);

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <Star className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#d97706' }} />
        <div className="w-28 md:w-36">
          <div className="flex justify-between items-baseline mb-1">
            <span style={{ color: 'rgba(240,192,64,0.9)', fontFamily: 'Cinzel, serif', fontSize: '0.6rem', letterSpacing: '0.05em' }}>
              Lv.{level}
            </span>
            <span style={{ color: 'rgba(201,169,110,0.7)', fontFamily: 'EB Garamond, serif', fontSize: '0.6rem' }}>
              {isMax ? `${currentXP} XP` : `${currentXP} / ${xpForNext}`}
            </span>
          </div>
          <div className="h-1.5 rounded-full overflow-hidden neuro-inset">
            <motion.div
              className="h-full rounded-full xp-bar"
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
              style={{ boxShadow: '0 0 6px rgba(184,115,51,0.4)' }} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="w-7 h-7 rounded-lg flex items-center justify-center font-fantasy font-bold text-xs flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #6b3d1a, #3d2010)', border: '1px solid rgba(212,149,90,0.4)', color: '#f0d090' }}>
            {level}
          </span>
          <span className="text-xs font-fantasy tracking-widest" style={{ color: 'rgba(215,178,125,0.85)', fontSize: '0.62rem' }}>
            EXPERIENCE
          </span>
        </div>
        <span className="text-xs font-fantasy" style={{ color: 'rgba(201,169,110,0.8)' }}>
          {isMax ? `${currentXP} XP` : `${currentXP.toLocaleString()} / ${xpForNext.toLocaleString()} XP`}
        </span>
      </div>
      <div className="h-3 rounded-full overflow-hidden neuro-inset">
        <motion.div
          className="h-full rounded-full xp-bar"
          animate={{ width: `${pct}%` }}
          transition={{ duration: 1, ease: 'easeOut' }}
          style={{ boxShadow: '0 0 8px rgba(184,115,51,0.4)' }} />
      </div>
      <div className="text-xs mt-1.5" style={{ color: 'rgba(205,170,120,0.8)', fontFamily: 'EB Garamond, serif' }}>
        {isMax
          ? '✦ Maximum level reached'
          : `${xpToGo.toLocaleString()} XP needed for level ${level + 1}`}
      </div>
    </div>
  );
}
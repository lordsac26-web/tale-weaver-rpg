import React from 'react';
import { motion } from 'framer-motion';
import { SKILL_STAT_MAP, calcStatMod, calcModDisplay, PROFICIENCY_BY_LEVEL } from './gameData';

const SKILL_ICONS = {
  Persuasion: '🗣️', Deception: '🎭', Intimidation: '⚔️', Insight: '🔍',
  Perception: '👁️', Investigation: '🔎', Stealth: '🌑', Athletics: '💪',
  Acrobatics: '🤸', 'Sleight of Hand': '🤲', Arcana: '✨', History: '📜',
  Nature: '🌿', Religion: '⛪', Medicine: '💊', Survival: '🧭',
  'Animal Handling': '🐾', Performance: '🎵',
};

export default function SkillCheckResult({ entry }) {
  const { skill, dc, raw, modifier, final, success, character_name, feedback, allRolls, hadAdvantage, hadDisadvantage, advantageSources } = entry;
  const icon = SKILL_ICONS[skill] || '🎲';
  const margin = final - dc;

  return (
    <motion.div
      initial={{ scale: 0.8, y: 12, opacity: 0 }}
      animate={{ scale: 1, y: 0, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 400, damping: 22 }}
      className="flex justify-center">
      <div className="rounded-2xl overflow-hidden max-w-sm w-full"
        style={{
          background: success ? 'rgba(8,30,12,0.85)' : 'rgba(30,5,5,0.85)',
          border: `1px solid ${success ? 'rgba(40,160,80,0.45)' : 'rgba(180,30,30,0.45)'}`,
          boxShadow: success
            ? '0 0 20px rgba(40,160,80,0.12), inset 0 1px 0 rgba(80,220,120,0.08)'
            : '0 0 20px rgba(180,30,30,0.12), inset 0 1px 0 rgba(220,60,60,0.08)',
        }}>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2.5"
          style={{
            background: success ? 'rgba(20,60,25,0.6)' : 'rgba(60,10,10,0.6)',
            borderBottom: `1px solid ${success ? 'rgba(40,160,80,0.2)' : 'rgba(180,30,30,0.2)'}`,
          }}>
          <div className="flex items-center gap-2">
            <span className="text-base">{icon}</span>
            <span className="font-fantasy text-sm font-bold"
              style={{ color: success ? '#86efac' : '#fca5a5' }}>
              {skill} Check
            </span>
          </div>
          <span className="font-fantasy text-xs px-2 py-0.5 rounded-full"
            style={{
              background: success ? 'rgba(40,160,80,0.2)' : 'rgba(180,30,30,0.2)',
              color: success ? '#86efac' : '#fca5a5',
              border: `1px solid ${success ? 'rgba(40,160,80,0.3)' : 'rgba(180,30,30,0.3)'}`,
            }}>
            {success ? '✓ SUCCESS' : '✗ FAILURE'}
          </span>
        </div>

        {/* Roll breakdown */}
        <div className="px-4 py-3 flex items-center gap-3">
          {/* Die */}
          <div className="flex flex-col items-center gap-1 flex-shrink-0">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center font-fantasy font-bold text-xl"
              style={{
                background: 'rgba(0,0,0,0.5)',
                border: `2px solid ${success ? 'rgba(40,160,80,0.5)' : 'rgba(180,30,30,0.5)'}`,
                color: raw === 20 ? '#f0c040' : raw === 1 ? '#ef4444' : success ? '#86efac' : '#fca5a5',
                textShadow: raw === 20 ? '0 0 12px rgba(240,192,64,0.8)' : 'none',
              }}>
              {raw}
            </div>
            {allRolls && allRolls.length > 1 && (
              <div className="flex items-center gap-1">
                {allRolls.map((r, i) => (
                  <span key={i} className="text-xs font-fantasy px-1 rounded"
                    style={{
                      color: r === raw ? (success ? '#86efac' : '#fca5a5') : 'rgba(180,140,90,0.35)',
                      background: r === raw ? 'rgba(255,255,255,0.05)' : 'transparent',
                      textDecoration: r !== raw ? 'line-through' : 'none',
                    }}>
                    {r}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Breakdown */}
          <div className="flex-1">
            <div className="flex items-baseline gap-1 flex-wrap">
              <span className="font-fantasy text-lg font-bold"
                style={{ color: success ? '#86efac' : '#fca5a5' }}>
                {final}
              </span>
              <span className="text-xs" style={{ color: 'rgba(180,140,90,0.5)' }}>
                = d20({raw}{hadAdvantage ? ', adv' : ''}{hadDisadvantage ? ', dis' : ''}) {modifier >= 0 ? `+${modifier}` : modifier}
              </span>
              <span className="text-xs" style={{ color: 'rgba(180,140,90,0.35)' }}>
                vs DC {dc}
              </span>
            </div>
            <div className="text-xs mt-0.5 font-fantasy"
              style={{ color: 'rgba(180,140,90,0.4)' }}>
              {raw === 20 ? '⭐ Natural 20!' : raw === 1 ? '💀 Natural 1!' :
                success
                  ? `Beat DC by ${margin}`
                  : `Missed DC by ${Math.abs(margin)}`}
            </div>
          </div>

          {/* DC badge */}
          <div className="text-center flex-shrink-0">
            <div className="text-xs font-fantasy" style={{ color: 'rgba(180,140,90,0.4)' }}>DC</div>
            <div className="font-fantasy font-bold text-lg" style={{ color: 'rgba(201,169,110,0.7)' }}>{dc}</div>
          </div>
        </div>

        {/* Advantage/Disadvantage Source */}
        {(hadAdvantage || hadDisadvantage) && advantageSources?.length > 0 && (
          <div className="px-4 pb-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs font-fantasy px-2 py-0.5 rounded-full"
                style={{
                  background: hadAdvantage ? 'rgba(40,100,60,0.3)' : 'rgba(100,40,40,0.3)',
                  border: `1px solid ${hadAdvantage ? 'rgba(40,160,80,0.3)' : 'rgba(180,30,30,0.3)'}`,
                  color: hadAdvantage ? '#86efac' : '#fca5a5',
                }}>
                {hadAdvantage ? '⬆ Advantage' : '⬇ Disadvantage'}
              </span>
              <span className="text-xs" style={{ color: 'rgba(180,140,90,0.4)', fontFamily: 'EB Garamond, serif' }}>
                from {advantageSources.join(', ')}
              </span>
            </div>
          </div>
        )}

        {/* Feedback */}
        {feedback && (
          <div className="px-4 pb-3">
            <p className="text-sm italic leading-relaxed"
              style={{
                color: success ? 'rgba(134,239,172,0.8)' : 'rgba(252,165,165,0.75)',
                fontFamily: 'IM Fell English, serif',
              }}>
              {feedback}
            </p>
          </div>
        )}
      </div>
    </motion.div>
  );
}
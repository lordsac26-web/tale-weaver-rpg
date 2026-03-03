import React, { useRef, useEffect } from 'react';
import { Loader2, Scroll, Feather } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const RISK_STYLES = {
  low:     { border: 'rgba(40,160,80,0.35)',  bg: 'rgba(10,40,15,0.5)',  hover: 'rgba(40,160,80,0.5)',  badge: { bg: 'rgba(10,50,20,0.7)', color: '#86efac', border: 'rgba(40,160,80,0.4)' } },
  medium:  { border: 'rgba(200,150,20,0.35)', bg: 'rgba(40,30,5,0.5)',   hover: 'rgba(200,150,20,0.5)', badge: { bg: 'rgba(60,40,5,0.7)',  color: '#fde68a', border: 'rgba(200,150,20,0.4)' } },
  high:    { border: 'rgba(200,80,20,0.35)',  bg: 'rgba(40,15,5,0.5)',   hover: 'rgba(200,80,20,0.5)',  badge: { bg: 'rgba(60,20,5,0.7)',  color: '#fdba74', border: 'rgba(200,80,20,0.4)' } },
  extreme: { border: 'rgba(180,20,20,0.4)',   bg: 'rgba(40,5,5,0.5)',    hover: 'rgba(180,20,20,0.6)',  badge: { bg: 'rgba(60,5,5,0.7)',   color: '#fca5a5', border: 'rgba(180,20,20,0.45)' } },
};

export default function StoryPanel({ narrative, choices, loading, onChoice, customInput, setCustomInput, onCustomSubmit }) {
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [narrative, loading]);

  return (
    <div className="flex flex-col h-full">
      {/* Narrative Area */}
      <div className="flex-1 overflow-y-auto p-5 md:p-7 space-y-5 min-h-0" style={{ background: 'transparent' }}>
        <AnimatePresence initial={false}>
          {narrative.map((entry, i) => (
            <motion.div key={i}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, ease: 'easeOut' }}>

              {entry.type === 'narration' && (
                <div className="relative">
                  <p className="leading-8 text-base md:text-lg whitespace-pre-wrap"
                    style={{
                      color: 'rgba(232,213,183,0.92)',
                      fontFamily: 'IM Fell English, Georgia, serif',
                      textShadow: '0 1px 3px rgba(0,0,0,0.7)',
                      lineHeight: '1.9'
                    }}>
                    {entry.text}
                  </p>
                </div>
              )}

              {entry.type === 'player_action' && (
                <div className="flex justify-end">
                  <div className="rounded-xl px-4 py-3 max-w-md text-sm italic"
                    style={{
                      background: 'rgba(20,40,80,0.45)',
                      border: '1px solid rgba(80,120,220,0.3)',
                      color: '#93c5fd',
                      fontFamily: 'EB Garamond, serif',
                      boxShadow: '0 0 16px rgba(60,100,220,0.08), inset 0 1px 0 rgba(100,150,255,0.1)',
                    }}>
                    <span style={{ color: 'rgba(147,197,253,0.5)', marginRight: '0.5em' }}>You:</span>
                    {entry.text}
                  </div>
                </div>
              )}

              {entry.type === 'roll_result' && (
                <div className="flex justify-center">
                  <motion.div
                    initial={{ scale: 0.75, y: 8 }}
                    animate={{ scale: 1, y: 0 }}
                    transition={{ type: 'spring', stiffness: 450, damping: 20 }}
                    className="px-5 py-2.5 rounded-xl text-sm font-bold font-fantasy"
                    style={entry.success ? {
                      background: 'rgba(10,50,20,0.65)',
                      border: '1px solid rgba(40,160,80,0.45)',
                      color: '#86efac',
                      boxShadow: '0 0 12px rgba(40,160,80,0.12)',
                    } : {
                      background: 'rgba(50,5,5,0.65)',
                      border: '1px solid rgba(180,30,30,0.45)',
                      color: '#fca5a5',
                      boxShadow: '0 0 12px rgba(180,30,30,0.12)',
                    }}>
                    🎲 {entry.text}
                  </motion.div>
                </div>
              )}

              {entry.type === 'combat_start' && (
                <div className="text-center py-3">
                  <motion.div
                    initial={{ scale: 0.7, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 18 }}
                    className="inline-block px-8 py-3 rounded-xl font-fantasy font-bold text-sm tracking-widest uppercase combat-active"
                    style={{
                      background: 'rgba(80,5,5,0.8)',
                      border: '1px solid rgba(180,30,30,0.6)',
                      color: '#fca5a5',
                      textShadow: '0 0 12px rgba(220,50,50,0.5)',
                    }}>
                    ⚔️ &nbsp; Combat Begins! &nbsp; ⚔️
                  </motion.div>
                </div>
              )}

              {entry.type === 'xp_gain' && (
                <motion.div className="text-center"
                  initial={{ scale: 0.7, opacity: 0, y: -10 }}
                  animate={{ scale: 1, opacity: 1, y: 0 }}
                  transition={{ type: 'spring', stiffness: 400 }}>
                  <span className="font-fantasy text-sm font-semibold"
                    style={{ color: '#f0c040', textShadow: '0 0 16px rgba(201,169,110,0.6)' }}>
                    ✨ {entry.text}
                  </span>
                </motion.div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>

        {loading && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="flex items-center gap-3 py-2">
            <Loader2 className="w-4 h-4 animate-spin" style={{ color: 'rgba(201,169,110,0.6)' }} />
            <span className="text-sm italic" style={{ color: 'rgba(201,169,110,0.5)', fontFamily: 'IM Fell English, serif' }}>
              The story unfolds...
            </span>
          </motion.div>
        )}
        <div ref={endRef} />
      </div>

      {/* Choices + Input */}
      {!loading && (
        <div className="flex-shrink-0 p-4 space-y-2.5"
          style={{
            background: 'rgba(8,5,2,0.85)',
            backdropFilter: 'blur(12px)',
            borderTop: '1px solid rgba(180,140,90,0.2)',
            boxShadow: 'inset 0 1px 0 rgba(201,169,110,0.08)'
          }}>
          {choices.length > 0 && (
            <>
              <div className="flex items-center gap-2 mb-2" style={{ color: 'rgba(201,169,110,0.5)' }}>
                <Scroll className="w-3 h-3" />
                <span className="font-fantasy text-xs tracking-widest uppercase">What do you do?</span>
              </div>
              <AnimatePresence>
                {choices.map((choice, i) => {
                  const riskStyle = RISK_STYLES[choice.risk_level] || RISK_STYLES['low'];
                  return (
                    <motion.button key={i}
                      initial={{ opacity: 0, x: -16 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.07, duration: 0.3 }}
                      onClick={() => onChoice(i)}
                      className="w-full text-left p-4 rounded-xl transition-all duration-200 group"
                      style={{
                        background: riskStyle.bg,
                        border: `1px solid ${riskStyle.border}`,
                      }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = riskStyle.hover; e.currentTarget.style.boxShadow = `0 0 12px ${riskStyle.border}`; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = riskStyle.border; e.currentTarget.style.boxShadow = 'none'; }}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 flex-1">
                          <span className="font-fantasy font-bold text-sm flex-shrink-0 mt-0.5"
                            style={{ color: 'rgba(201,169,110,0.6)' }}>{i + 1}.</span>
                          <span className="text-sm leading-relaxed"
                            style={{ color: 'rgba(232,213,183,0.9)', fontFamily: 'EB Garamond, serif', fontSize: '1rem' }}>
                            {choice.text}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {choice.skill_check && choice.dc && (
                            <span className="px-2 py-1 rounded-full text-xs font-fantasy"
                              style={{ background: riskStyle.badge.bg, color: riskStyle.badge.color, border: `1px solid ${riskStyle.badge.border}` }}>
                              {choice.skill_check} DC{choice.dc}
                            </span>
                          )}
                          {choice.risk_level && (
                            <span className="px-2 py-1 rounded-full text-xs font-fantasy"
                              style={{ background: riskStyle.badge.bg, color: riskStyle.badge.color, border: `1px solid ${riskStyle.badge.border}` }}>
                              {choice.risk_level}
                            </span>
                          )}
                        </div>
                      </div>
                    </motion.button>
                  );
                })}
              </AnimatePresence>
            </>
          )}

          {/* Custom input */}
          <div className="flex gap-2 mt-3">
            <div className="flex-1 relative">
              <Feather className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none" style={{ color: 'rgba(201,169,110,0.3)' }} />
              <input
                value={customInput}
                onChange={e => setCustomInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && customInput.trim() && onCustomSubmit()}
                placeholder={choices.length > 0 ? 'Or write your own action...' : 'Describe your action...'}
                className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm input-fantasy"
                style={{ fontFamily: 'EB Garamond, serif', fontSize: '1rem' }}
              />
            </div>
            <button onClick={onCustomSubmit} disabled={!customInput.trim()}
              className="px-5 py-2.5 rounded-xl text-sm btn-fantasy disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ fontSize: '0.85rem', letterSpacing: '0.05em' }}>
              Act
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
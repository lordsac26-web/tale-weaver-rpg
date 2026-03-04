import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Scroll, Swords, Sparkles, Heart, Shield, SkipForward, Skull } from 'lucide-react';

function getEntryStyle(entry) {
  if (entry.critical) return {
    border: '1px solid rgba(255,200,0,0.5)', borderLeft: '3px solid #f0c040',
    background: 'rgba(60,45,5,0.6)', color: '#fde68a',
  };
  if (entry.heal_amount) return {
    border: '1px solid rgba(40,160,80,0.3)', borderLeft: '3px solid #22c55e',
    background: 'rgba(10,40,20,0.5)', color: '#86efac',
  };
  if (entry.is_utility) return {
    border: '1px solid rgba(140,80,220,0.3)', borderLeft: '3px solid #a78bfa',
    background: 'rgba(30,10,60,0.5)', color: '#d4b3ff',
  };
  if (entry.hit === true) return {
    border: '1px solid rgba(220,50,50,0.3)', borderLeft: '3px solid #dc2626',
    background: 'rgba(40,5,5,0.5)', color: '#fca5a5',
  };
  if (entry.hit === false) return {
    border: '1px solid rgba(80,60,30,0.2)', borderLeft: '3px solid rgba(100,70,30,0.4)',
    background: 'rgba(15,10,5,0.3)', color: 'rgba(180,150,100,0.5)',
  };
  // System / round messages
  return {
    border: '1px solid rgba(60,80,180,0.2)', borderLeft: '3px solid rgba(80,100,220,0.4)',
    background: 'rgba(10,10,30,0.4)', color: 'rgba(147,197,253,0.6)',
  };
}

function getEntryIcon(entry) {
  if (entry.critical) return <Sparkles className="w-3 h-3 flex-shrink-0" style={{ color: '#f0c040' }} />;
  if (entry.heal_amount) return <Heart className="w-3 h-3 flex-shrink-0" style={{ color: '#22c55e' }} />;
  if (entry.is_utility) return <Shield className="w-3 h-3 flex-shrink-0" style={{ color: '#a78bfa' }} />;
  if (entry.spell_name && !entry.heal_amount) return <Sparkles className="w-3 h-3 flex-shrink-0" style={{ color: '#a78bfa' }} />;
  if (entry.hit === true) return <Swords className="w-3 h-3 flex-shrink-0" style={{ color: '#dc2626' }} />;
  if (entry.hit === false) return <SkipForward className="w-3 h-3 flex-shrink-0" style={{ color: 'rgba(100,70,30,0.6)' }} />;
  return <Scroll className="w-3 h-3 flex-shrink-0" style={{ color: 'rgba(100,120,220,0.5)' }} />;
}

function formatEntryText(entry) {
  // Enhance display with roll breakdown badges
  const text = entry.text || '';
  return text;
}

function RoundSeparator({ round }) {
  return (
    <div className="flex items-center gap-2 my-2">
      <div className="flex-1 h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(180,50,50,0.3))' }} />
      <span className="font-fantasy text-xs tracking-widest px-2" style={{ color: 'rgba(180,50,50,0.5)', fontSize: '0.6rem' }}>
        ROUND {round}
      </span>
      <div className="flex-1 h-px" style={{ background: 'linear-gradient(90deg, rgba(180,50,50,0.3), transparent)' }} />
    </div>
  );
}

export default function CombatLog({ logEntries = [], player }) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logEntries.length]);

  // Group entries by round
  const rendered = [];
  let lastRound = null;
  const entries = [...logEntries];

  entries.forEach((entry, i) => {
    if (entry.round && entry.round !== lastRound) {
      lastRound = entry.round;
      rendered.push({ type: 'separator', round: entry.round, key: `sep-${entry.round}` });
    }
    rendered.push({ type: 'entry', data: entry, key: `entry-${i}` });
  });

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-3 py-2 flex-shrink-0 flex items-center gap-2"
        style={{ borderBottom: '1px solid rgba(180,50,50,0.15)', background: 'rgba(15,5,5,0.5)' }}>
        <Scroll className="w-3 h-3" style={{ color: 'rgba(180,100,100,0.5)' }} />
        <span className="font-fantasy text-xs tracking-widest" style={{ color: 'rgba(180,100,100,0.5)', fontSize: '0.65rem' }}>
          COMBAT LOG
        </span>
        <span className="ml-auto text-xs font-fantasy" style={{ color: 'rgba(180,100,100,0.3)', fontSize: '0.6rem' }}>
          {logEntries.length} events
        </span>
      </div>

      {/* Log entries */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1 min-h-0">
        <AnimatePresence initial={false}>
          {rendered.map((item) => {
            if (item.type === 'separator') {
              return <RoundSeparator key={item.key} round={item.round} />;
            }
            const entry = item.data;
            const style = getEntryStyle(entry);
            const icon = getEntryIcon(entry);
            return (
              <motion.div
                key={item.key}
                initial={{ opacity: 0, x: 10, scale: 0.98 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                transition={{ duration: 0.2 }}
                className="flex items-start gap-2 px-2.5 py-2 rounded-lg text-xs"
                style={{ ...style, fontFamily: 'EB Garamond, serif', fontSize: '0.8rem', lineHeight: 1.4 }}
                onAnimationComplete={() => {
                  if (entry.critical && navigator.vibrate) navigator.vibrate([30, 10, 30]);
                }}>
                <div className="mt-0.5">{icon}</div>
                <div className="flex-1 min-w-0">
                  <p>{formatEntryText(entry)}</p>
                  {entry.critical && (
                    <span className="inline-block mt-0.5 px-1.5 py-0.5 rounded text-xs font-fantasy"
                      style={{ background: 'rgba(100,70,5,0.6)', border: '1px solid rgba(240,192,64,0.4)', color: '#f0c040', fontSize: '0.6rem', letterSpacing: '0.05em' }}>
                      ✦ CRITICAL HIT
                    </span>
                  )}
                  {entry.hit === false && !entry.spell_name && (
                    <span className="inline-block mt-0.5 px-1.5 py-0.5 rounded text-xs font-fantasy"
                      style={{ background: 'rgba(30,20,10,0.4)', border: '1px solid rgba(80,60,30,0.2)', color: 'rgba(150,120,70,0.5)', fontSize: '0.6rem' }}>
                      MISS
                    </span>
                  )}
                  {entry.ai_strategy && (
                    <span className="inline-block mt-0.5 px-1.5 py-0.5 rounded text-xs italic"
                      style={{ color: 'rgba(180,100,100,0.4)', fontSize: '0.65rem', fontFamily: 'IM Fell English, serif' }}>
                      {entry.ai_strategy}
                    </span>
                  )}
                </div>
                {entry.damage > 0 && (
                  <span className="flex-shrink-0 font-fantasy font-bold text-sm px-1.5 py-0.5 rounded"
                    style={{ background: 'rgba(120,10,10,0.5)', color: '#fca5a5', fontSize: '0.75rem', minWidth: '2rem', textAlign: 'center' }}>
                    -{entry.damage}
                  </span>
                )}
                {entry.heal_amount > 0 && (
                  <span className="flex-shrink-0 font-fantasy font-bold text-sm px-1.5 py-0.5 rounded"
                    style={{ background: 'rgba(10,80,30,0.5)', color: '#86efac', fontSize: '0.75rem', minWidth: '2rem', textAlign: 'center' }}>
                    +{entry.heal_amount}
                  </span>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
        <div ref={bottomRef} />
      </div>

      {/* Player HP bar */}
      {player && (
        <div className="flex-shrink-0 px-3 py-2.5 space-y-1"
          style={{ borderTop: '1px solid rgba(180,50,50,0.15)', background: 'rgba(10,3,3,0.6)' }}>
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="font-fantasy" style={{ color: 'rgba(180,140,90,0.5)', fontSize: '0.65rem' }}>
              {player.name}
            </span>
            <span className="font-fantasy font-bold" style={{
              color: (player.hp_current / player.hp_max) > 0.5 ? '#86efac' :
                (player.hp_current / player.hp_max) > 0.25 ? '#fde68a' : '#fca5a5'
            }}>
              {player.hp_current} / {player.hp_max} HP
            </span>
          </div>
          <div className="h-2.5 rounded-full overflow-hidden neuro-inset">
            <motion.div
              className="h-full rounded-full"
              animate={{ width: `${Math.max(0, (player.hp_current / player.hp_max) * 100)}%` }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
              style={{
                background: (player.hp_current / player.hp_max) > 0.5 ? 'linear-gradient(90deg, #16a34a, #22c55e)' :
                  (player.hp_current / player.hp_max) > 0.25 ? 'linear-gradient(90deg, #b45309, #d97706)' :
                  'linear-gradient(90deg, #7f1d1d, #dc2626)',
                boxShadow: (player.hp_current / player.hp_max) > 0.5 ? '0 0 6px rgba(34,197,94,0.4)' :
                  (player.hp_current / player.hp_max) > 0.25 ? '0 0 6px rgba(217,119,6,0.4)' :
                  '0 0 6px rgba(220,38,38,0.5)'
              }}
            />
          </div>
          {!player.is_conscious && (
            <div className="flex items-center gap-1.5 text-xs" style={{ color: '#ef4444' }}>
              <Skull className="w-3 h-3" /> Unconscious — Making Death Saving Throws
            </div>
          )}
        </div>
      )}
    </div>
  );
}
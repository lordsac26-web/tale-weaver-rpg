import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Swords, Shield, Heart, Zap, Clock, ChevronRight, Flame, Snowflake, Wind, Sparkles, X } from 'lucide-react';
import { CONDITIONS } from './gameData';
import { ConditionTooltip } from './GameTooltip';

const EFFECT_ICONS = {
  blessed: { icon: '✨', color: '#fbbf24', label: 'Blessed' },
  baned: { icon: '💀', color: '#dc2626', label: 'Baned' },
  hasted: { icon: '⚡', color: '#60a5fa', label: 'Hasted' },
  slowed: { icon: '🐌', color: '#9ca3af', label: 'Slowed' },
  invisible: { icon: '👻', color: '#c4b5fd', label: 'Invisible' },
  concentrating: { icon: '🔮', color: '#a78bfa', label: 'Concentrating' },
  raging: { icon: '💢', color: '#dc2626', label: 'Raging' },
  dodging: { icon: '🌀', color: '#93c5fd', label: 'Dodging' },
};

export default function InitiativeTracker({ combatants = [], currentTurnIndex, round, onAdvanceTurn, combatStartTime }) {
  if (!combatants.length) return null;

  const [expandedCombatant, setExpandedCombatant] = useState(null);
  const [combatDuration, setCombatDuration] = useState(0);

  useEffect(() => {
    if (!combatStartTime) return;
    const interval = setInterval(() => {
      setCombatDuration(Math.floor((Date.now() - new Date(combatStartTime).getTime()) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [combatStartTime]);

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const currentCombatant = combatants[currentTurnIndex];

  return (
    <div className="flex-shrink-0"
      style={{ borderBottom: '1px solid rgba(180,50,50,0.15)', background: 'rgba(15,5,5,0.6)' }}>
      
      {/* Header with round and duration */}
      <div className="px-3 py-2 flex items-center justify-between"
        style={{ borderBottom: '1px solid rgba(180,50,50,0.1)' }}>
        <div className="flex items-center gap-3">
          <span className="font-fantasy text-xs tracking-widest" style={{ color: 'rgba(180,100,100,0.5)', fontSize: '0.6rem' }}>
            INITIATIVE ORDER
          </span>
          {combatStartTime && (
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full"
              style={{ background: 'rgba(60,30,8,0.5)', border: '1px solid rgba(180,100,100,0.2)' }}>
              <Clock className="w-2.5 h-2.5" style={{ color: 'rgba(201,169,110,0.5)' }} />
              <span className="font-mono text-xs" style={{ color: 'rgba(201,169,110,0.6)', fontSize: '0.6rem' }}>
                {formatDuration(combatDuration)}
              </span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="font-fantasy text-xs" style={{ color: 'rgba(180,50,50,0.5)', fontSize: '0.6rem' }}>
            ROUND {round}
          </span>
          {onAdvanceTurn && currentCombatant?.type === 'player' && (
            <button onClick={onAdvanceTurn}
              className="px-2 py-0.5 rounded text-xs font-fantasy transition-all flex items-center gap-1"
              style={{ background: 'rgba(80,30,120,0.4)', border: '1px solid rgba(140,80,220,0.3)', color: 'rgba(192,132,252,0.7)' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(160,100,240,0.5)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(140,80,220,0.3)'; }}>
              <ChevronRight className="w-3 h-3" />
              Next
            </button>
          )}
        </div>
      </div>

      {/* Initiative cards */}
      <div className="px-3 py-2.5">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {combatants.map((c, i) => {
            const isActive = i === currentTurnIndex;
            const isDead = !c.is_conscious;
            const isPlayer = c.type === 'player';
            const isExpanded = expandedCombatant === c.id;
            const hpPct = c.hp_max ? Math.max(0, Math.min(100, ((c.hp_current ?? c.hp ?? 0) / c.hp_max) * 100)) : 100;
            const activeEffects = c.active_effects || [];
            const conditions = c.conditions || [];

            return (
              <motion.div
                key={c.id}
                layout
                animate={isActive ? {
                  scale: [1, 1.04, 1],
                  boxShadow: [
                    '0 0 8px rgba(201,169,110,0.2)',
                    '0 0 20px rgba(201,169,110,0.5)',
                    '0 0 8px rgba(201,169,110,0.2)'
                  ]
                } : { scale: 1 }}
                transition={{ repeat: isActive ? Infinity : 0, duration: 2.5, ease: 'easeInOut' }}
                className="flex-shrink-0 cursor-pointer"
                onClick={() => setExpandedCombatant(isExpanded ? null : c.id)}
                style={{
                  minWidth: isExpanded ? '180px' : '70px',
                  maxWidth: isExpanded ? '220px' : '70px',
                  opacity: isDead ? 0.3 : 1,
                  background: isActive
                    ? 'rgba(80,55,8,0.8)'
                    : isPlayer
                    ? 'rgba(10,25,60,0.6)'
                    : 'rgba(40,5,5,0.5)',
                  border: isActive
                    ? '1px solid rgba(201,169,110,0.6)'
                    : isPlayer
                    ? '1px solid rgba(60,100,220,0.35)'
                    : '1px solid rgba(180,30,30,0.25)',
                  borderRadius: '0.75rem',
                  padding: isExpanded ? '0.75rem' : '0.5rem',
                  transition: 'all 0.25s ease',
                }}>
                
                {/* Turn indicator */}
                {isActive && (
                  <motion.div
                    animate={{ y: [0, -3, 0] }}
                    transition={{ repeat: Infinity, duration: 1, ease: 'easeInOut' }}
                    className="absolute -top-2 left-1/2 -translate-x-1/2 text-xs"
                    style={{ color: '#f0c040', fontSize: '0.6rem' }}>▼</motion.div>
                )}

                <div className={`flex ${isExpanded ? 'flex-col' : 'flex-col items-center'} gap-1.5`}>
                  {/* Icon & Name */}
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
                      style={{
                        background: isDead ? 'rgba(20,20,20,0.5)' :
                          isPlayer ? 'rgba(30,60,140,0.7)' : 'rgba(80,10,10,0.7)',
                        border: isActive ? '1px solid rgba(240,192,64,0.6)' : '1px solid rgba(80,50,50,0.35)'
                      }}>
                      {isDead ? '💀' : isPlayer
                        ? <Shield className="w-3 h-3" style={{ color: '#93c5fd' }} />
                        : <Swords className="w-3 h-3" style={{ color: '#fca5a5' }} />
                      }
                    </div>
                    <div className={isExpanded ? 'flex-1 min-w-0' : 'hidden'}>
                      <div className="font-fantasy font-bold leading-tight truncate"
                        style={{
                          fontSize: '0.7rem',
                          color: isDead ? '#6b7280' : isActive ? '#f0c040' : isPlayer ? '#93c5fd' : '#fca5a5',
                          textDecoration: isDead ? 'line-through' : 'none'
                        }}>
                        {c.name}
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="font-fantasy font-bold" style={{ fontSize: '0.6rem', color: 'rgba(180,140,90,0.5)' }}>
                          Init {c.initiative_total ?? '?'}
                        </span>
                        <span className="font-fantasy" style={{ fontSize: '0.55rem', color: 'rgba(180,140,90,0.35)' }}>
                          AC {c.ac || '?'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Compact: Name & Init */}
                  {!isExpanded && (
                    <>
                      <span className="font-fantasy text-center leading-tight"
                        style={{
                          fontSize: '0.6rem',
                          color: isDead ? '#6b7280' : isActive ? '#f0c040' : isPlayer ? '#93c5fd' : '#fca5a5',
                          maxWidth: '60px',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          textDecoration: isDead ? 'line-through' : 'none'
                        }}>
                        {c.name}
                      </span>
                      <span className="font-fantasy font-bold" style={{ fontSize: '0.65rem', color: isActive ? '#f0c040' : 'rgba(180,140,90,0.4)' }}>
                        {c.initiative_total ?? '?'}
                      </span>
                    </>
                  )}

                  {/* HP Bar */}
                  {!isDead && (
                    <div className="w-full">
                      {isExpanded && (
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-1">
                            <Heart className="w-2.5 h-2.5" style={{ color: hpPct > 50 ? '#22c55e' : hpPct > 25 ? '#d97706' : '#dc2626' }} />
                            <span className="text-xs font-fantasy font-bold" style={{ color: hpPct > 50 ? '#86efac' : hpPct > 25 ? '#fde68a' : '#fca5a5' }}>
                              {c.hp || c.hp_current}/{c.hp_max}
                            </span>
                          </div>
                        </div>
                      )}
                      <div className={`w-full rounded-full overflow-hidden ${isExpanded ? 'h-2' : 'h-1'}`}
                        style={{ background: 'rgba(0,0,0,0.5)', boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.6)' }}>
                        <motion.div
                          className="h-full rounded-full"
                          animate={{ width: `${hpPct}%` }}
                          transition={{ duration: 0.4 }}
                          style={{
                            background: hpPct > 60 ? 'linear-gradient(90deg, #16a34a, #22c55e)' :
                              hpPct > 30 ? 'linear-gradient(90deg, #b45309, #e8732a)' :
                              'linear-gradient(90deg, #7f1d1d, #dc2626)',
                            boxShadow: hpPct > 0 ? '0 0 6px rgba(255,255,255,0.3)' : 'none'
                          }} />
                      </div>
                    </div>
                  )}

                  {/* Expanded: Effects & Conditions */}
                  {isExpanded && (
                    <div className="w-full space-y-1.5 mt-1">
                      {/* Active Effects */}
                      {activeEffects.length > 0 && (
                        <div className="space-y-0.5">
                          <div className="text-xs font-fantasy tracking-widest" style={{ color: 'rgba(201,169,110,0.4)', fontSize: '0.55rem' }}>EFFECTS</div>
                          {activeEffects.slice(0, 3).map((effect, idx) => {
                            const effectData = EFFECT_ICONS[effect.type] || { icon: '✨', color: '#a78bfa', label: effect.type };
                            return (
                              <div key={idx} className="flex items-center justify-between px-1.5 py-0.5 rounded"
                                style={{ background: 'rgba(0,0,0,0.3)' }}>
                                <span className="text-xs flex items-center gap-1" style={{ color: effectData.color }}>
                                  <span>{effectData.icon}</span>
                                  <span className="truncate" style={{ fontSize: '0.65rem' }}>{effectData.label}</span>
                                </span>
                                {effect.duration && (
                                  <span className="text-xs font-mono" style={{ color: 'rgba(180,140,90,0.4)', fontSize: '0.6rem' }}>
                                    {effect.duration}r
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Conditions */}
                      {conditions.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {conditions.slice(0, 3).map((cond, idx) => {
                            const condName = typeof cond === 'string' ? cond : cond.name;
                            const condData = CONDITIONS[condName?.toLowerCase()] || {};
                            return (
                              <ConditionTooltip key={idx} name={condName} position="bottom">
                                <span className="px-1.5 py-0.5 rounded-full text-xs flex items-center gap-0.5"
                                  style={{ background: 'rgba(60,5,5,0.6)', border: '1px solid rgba(180,30,30,0.3)', color: '#fca5a5', fontSize: '0.6rem' }}>
                                  {condData.icon || '⚫'} {condName}
                                </span>
                              </ConditionTooltip>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Current turn info bar */}
      {currentCombatant && (
        <div className="px-3 py-1.5 flex items-center justify-between"
          style={{ background: 'rgba(80,55,8,0.4)', borderTop: '1px solid rgba(201,169,110,0.15)' }}>
          <div className="flex items-center gap-2">
            <Zap className="w-3 h-3" style={{ color: '#f0c040' }} />
            <span className="font-fantasy text-xs" style={{ color: '#f0c040' }}>
              {currentCombatant.name}'s Turn
            </span>
          </div>
          {currentCombatant.type === 'enemy' && (
            <span className="text-xs italic" style={{ color: 'rgba(201,169,110,0.5)', fontFamily: 'EB Garamond, serif' }}>
              AI acting...
            </span>
          )}
        </div>
      )}
    </div>
  );
}
import React from 'react';
import { motion } from 'framer-motion';
import { Swords, Shield, Heart, Zap } from 'lucide-react';

export default function InitiativeTracker({ combatants = [], currentTurnIndex, round }) {
  if (!combatants.length) return null;

  return (
    <div className="px-3 py-2.5 flex-shrink-0"
      style={{ borderBottom: '1px solid rgba(180,50,50,0.15)', background: 'rgba(15,5,5,0.6)' }}>
      <div className="flex items-center justify-between mb-2">
        <span className="font-fantasy text-xs tracking-widest" style={{ color: 'rgba(180,100,100,0.5)', fontSize: '0.6rem' }}>
          INITIATIVE ORDER
        </span>
        <span className="font-fantasy text-xs" style={{ color: 'rgba(180,50,50,0.5)', fontSize: '0.6rem' }}>
          ROUND {round}
        </span>
      </div>
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {combatants.map((c, i) => {
          const isActive = i === currentTurnIndex;
          const isDead = !c.is_conscious;
          const isPlayer = c.type === 'player';
          const hpPct = c.hp_max ? Math.max(0, (c.hp_current / c.hp_max) * 100) : 100;

          return (
            <motion.div
              key={c.id}
              animate={isActive ? {
                scale: [1, 1.06, 1],
                boxShadow: [
                  '0 0 8px rgba(201,169,110,0.2)',
                  '0 0 20px rgba(201,169,110,0.5)',
                  '0 0 8px rgba(201,169,110,0.2)'
                ]
              } : { scale: 1 }}
              transition={{ repeat: isActive ? Infinity : 0, duration: 2.5, ease: 'easeInOut' }}
              className="flex-shrink-0 flex flex-col items-center gap-1 px-2.5 py-2 rounded-xl relative"
              style={{
                minWidth: '60px',
                opacity: isDead ? 0.25 : 1,
                background: isActive
                  ? 'rgba(80,55,8,0.75)'
                  : isPlayer
                  ? 'rgba(10,25,60,0.55)'
                  : 'rgba(40,5,5,0.45)',
                border: isActive
                  ? '1px solid rgba(201,169,110,0.6)'
                  : isPlayer
                  ? '1px solid rgba(60,100,220,0.3)'
                  : '1px solid rgba(180,30,30,0.2)',
              }}>
              {/* Turn indicator arrow */}
              {isActive && (
                <motion.div
                  animate={{ y: [0, -3, 0] }}
                  transition={{ repeat: Infinity, duration: 1, ease: 'easeInOut' }}
                  className="absolute -top-2 left-1/2 -translate-x-1/2 text-xs"
                  style={{ color: '#f0c040', fontSize: '0.55rem' }}>▼</motion.div>
              )}

              {/* Icon */}
              <div className="w-5 h-5 rounded-full flex items-center justify-center"
                style={{
                  background: isDead ? 'rgba(20,20,20,0.5)' :
                    isPlayer ? 'rgba(30,60,140,0.6)' : 'rgba(80,10,10,0.6)',
                  border: isActive ? '1px solid rgba(240,192,64,0.5)' : '1px solid rgba(80,50,50,0.3)'
                }}>
                {isDead ? '💀' : isPlayer
                  ? <Shield className="w-2.5 h-2.5" style={{ color: '#93c5fd' }} />
                  : <Swords className="w-2.5 h-2.5" style={{ color: '#fca5a5' }} />
                }
              </div>

              {/* Name */}
              <span className="font-fantasy text-center leading-tight"
                style={{
                  fontSize: '0.6rem',
                  color: isDead ? '#4b5563' : isActive ? '#f0c040' : isPlayer ? '#93c5fd' : '#fca5a5',
                  maxWidth: '56px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  textDecoration: isDead ? 'line-through' : 'none'
                }}>
                {c.name}
              </span>

              {/* Initiative value */}
              <span className="font-fantasy font-bold" style={{ fontSize: '0.65rem', color: isActive ? '#f0c040' : 'rgba(180,140,90,0.4)' }}>
                {c.initiative_total ?? '?'}
              </span>

              {/* HP mini bar */}
              {!isDead && (
                <div className="w-full h-1 rounded-full overflow-hidden" style={{ background: 'rgba(0,0,0,0.4)' }}>
                  <div className="h-full rounded-full transition-all"
                    style={{
                      width: `${hpPct}%`,
                      background: hpPct > 50 ? '#22c55e' : hpPct > 25 ? '#d97706' : '#dc2626'
                    }} />
                </div>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
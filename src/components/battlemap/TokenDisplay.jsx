import React from 'react';
import { motion } from 'framer-motion';
import { TOKEN_COLORS, CELL_PX } from './mapUtils';
import { CONDITIONS } from '../game/gameData';

export default function TokenDisplay({ token, isActive, isSelected, cellSize, onClick }) {
  const size = cellSize || CELL_PX;
  const tokenSize = size * 0.82 * (token.size || 1);
  const colors = TOKEN_COLORS[token.type] || TOKEN_COLORS.neutral;
  const hpPct = token.hp_max > 0 ? Math.max(0, (token.hp_current / token.hp_max) * 100) : 100;
  const isDead = token.hp_current <= 0;
  const conditions = token.conditions || [];

  return (
    <motion.div
      layout
      initial={false}
      animate={{
        left: token.col * size + (size - tokenSize) / 2,
        top: token.row * size + (size - tokenSize) / 2,
      }}
      transition={{ type: 'spring', stiffness: 300, damping: 28 }}
      onClick={(e) => { e.stopPropagation(); onClick?.(token); }}
      className="absolute z-10 flex flex-col items-center justify-center cursor-pointer"
      style={{
        width: tokenSize,
        height: tokenSize,
        borderRadius: '50%',
        background: isDead ? 'rgba(40,20,20,0.7)' : colors.bg,
        border: `2px solid ${isSelected ? '#fde68a' : isActive ? '#fff' : isDead ? '#555' : colors.border}`,
        boxShadow: isActive
          ? `0 0 14px ${colors.border}88, 0 0 4px ${colors.border}`
          : isSelected
          ? '0 0 12px rgba(253,230,138,0.5)'
          : '0 2px 6px rgba(0,0,0,0.6)',
        opacity: isDead ? 0.45 : 1,
        filter: isDead ? 'grayscale(0.7)' : 'none',
      }}
    >
      {/* Token label */}
      <span className="font-fantasy font-bold leading-none text-center select-none pointer-events-none"
        style={{
          fontSize: Math.max(8, tokenSize * 0.3),
          color: colors.text,
          textShadow: '0 1px 3px rgba(0,0,0,0.9)',
          maxWidth: tokenSize - 4,
          overflow: 'hidden',
          whiteSpace: 'nowrap',
          textOverflow: 'ellipsis',
        }}>
        {token.emoji || token.name?.slice(0, 3)}
      </span>

      {/* HP bar */}
      {!isDead && (
        <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 rounded-full overflow-hidden"
          style={{ width: tokenSize * 0.75, height: 3, background: 'rgba(0,0,0,0.7)' }}>
          <div className="h-full rounded-full" style={{
            width: `${hpPct}%`,
            background: hpPct > 50 ? '#22c55e' : hpPct > 25 ? '#f59e0b' : '#ef4444',
          }} />
        </div>
      )}

      {/* Conditions */}
      {conditions.length > 0 && !isDead && (
        <div className="absolute -top-2 -right-1 flex gap-0.5">
          {conditions.slice(0, 3).map((c, i) => {
            const cond = CONDITIONS[c] || { icon: '❓' };
            return (
              <span key={i} className="select-none" style={{ fontSize: Math.max(8, size * 0.25) }} title={c}>
                {cond.icon}
              </span>
            );
          })}
        </div>
      )}

      {/* Active turn indicator */}
      {isActive && !isDead && (
        <motion.div
          animate={{ scale: [1, 1.3, 1], opacity: [0.6, 1, 0.6] }}
          transition={{ duration: 1.5, repeat: Infinity }}
          className="absolute -top-1 -left-1 w-2.5 h-2.5 rounded-full"
          style={{ background: '#fde68a', boxShadow: '0 0 8px #fde68a' }}
        />
      )}
    </motion.div>
  );
}
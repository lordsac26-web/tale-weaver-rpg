import React from 'react';
import { motion } from 'framer-motion';

const TYPE_LABEL = { action: 'Action', bonus_action: 'Bonus', reaction: 'Reaction', passive: 'Passive', free: 'Free', special: 'Special', passive_toggle: 'Toggle' };
const TYPE_COLOR = { action: '#fde68a', bonus_action: '#86efac', reaction: '#93c5fd', passive: 'rgba(180,160,120,0.6)', free: '#fbbf24', special: '#c4b5fd', passive_toggle: '#fbbf24' };

/**
 * AbilityRow — presentational row for a single class ability in ClassAbilitiesPanel.
 * Pure UI; all logic (availability, onUse) is decided by the parent and passed via `ability`.
 */
export default function AbilityRow({ ability }) {
  const isClickable = ability.onUse && ability.available && !ability.used;
  const isPassive = ability.type === 'passive';

  return (
    <motion.button
      whileTap={isClickable ? { scale: 0.98 } : {}}
      onClick={isClickable ? ability.onUse : undefined}
      disabled={ability.used || isPassive}
      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-all"
      style={ability.used || !ability.available ? {
        background: 'rgba(10,8,4,0.4)',
        border: '1px solid rgba(60,45,20,0.15)',
        opacity: 0.45,
        cursor: 'not-allowed',
      } : isPassive ? {
        background: 'rgba(15,12,5,0.5)',
        border: `1px solid ${ability.borderColor}`,
        cursor: 'default',
      } : {
        background: ability.bgColor,
        border: `1px solid ${ability.borderColor}`,
        boxShadow: `0 0 8px ${ability.borderColor}`,
        cursor: 'pointer',
      }}
      onMouseEnter={e => { if (isClickable) e.currentTarget.style.background = ability.activeBg || ability.bgColor; }}
      onMouseLeave={e => { if (isClickable) e.currentTarget.style.background = ability.bgColor; }}
    >
      {/* Icon */}
      <div className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center"
        style={{
          background: ability.used ? 'rgba(20,15,5,0.4)' : `${ability.bgColor}`,
          border: `1px solid ${ability.used ? 'rgba(60,45,20,0.2)' : ability.borderColor}`,
          color: ability.used ? 'rgba(100,80,40,0.3)' : ability.color,
        }}>
        {ability.icon}
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="font-fantasy text-xs font-semibold"
            style={{ color: ability.used ? 'rgba(120,100,60,0.4)' : ability.color }}>
            {ability.name}
          </span>
          <span className="px-1 py-0.5 rounded text-xs"
            style={{
              background: 'rgba(20,15,5,0.5)',
              color: ability.used ? 'rgba(80,60,30,0.3)' : TYPE_COLOR[ability.type] || '#c9a96e',
              fontSize: '0.55rem',
              fontFamily: 'Cinzel, serif',
              letterSpacing: '0.05em',
            }}>
            {TYPE_LABEL[ability.type] || ability.type}
          </span>
        </div>
        <div className="text-xs mt-0.5 truncate"
          style={{ color: ability.used ? 'rgba(100,80,40,0.3)' : 'rgba(200,175,130,0.6)', fontFamily: 'EB Garamond, serif', fontSize: '0.65rem' }}>
          {ability.used ? ability.usedLabel : ability.shortDesc}
        </div>
      </div>

      {/* Status dot */}
      <div className="w-2.5 h-2.5 rounded-full flex-shrink-0"
        style={ability.used ? {
          background: 'rgba(60,45,20,0.3)',
          border: '1px solid rgba(80,60,25,0.2)',
        } : isPassive ? {
          background: ability.color,
          boxShadow: `0 0 4px ${ability.color}88`,
          opacity: 0.5,
        } : {
          background: ability.color,
          boxShadow: `0 0 6px ${ability.color}99`,
        }} />
    </motion.button>
  );
}
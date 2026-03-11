import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

/**
 * Shows a stat value with an indicator when it has item bonuses.
 * Hovering reveals a tooltip with the bonus breakdown.
 * Props: baseStat, effectiveStat, label (for tooltip)
 */
export default function ComputedStatBadge({ baseStat, effectiveStat, label }) {
  const [hover, setHover] = useState(false);
  const diff = effectiveStat - baseStat;
  if (diff === 0) return null;

  return (
    <span className="relative inline-flex items-center ml-1"
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      <span className="text-xs font-fantasy px-1 py-0 rounded"
        style={{
          color: diff > 0 ? '#86efac' : '#fca5a5',
          background: diff > 0 ? 'rgba(34,197,94,0.12)' : 'rgba(220,38,38,0.12)',
          border: `1px solid ${diff > 0 ? 'rgba(34,197,94,0.2)' : 'rgba(220,38,38,0.2)'}`,
          fontSize: '0.6rem',
        }}>
        {diff > 0 ? `+${diff}` : diff}
      </span>
      <AnimatePresence>
        {hover && (
          <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2.5 py-1.5 rounded-lg whitespace-nowrap z-50"
            style={{ background: 'rgba(10,6,3,0.97)', border: '1px solid rgba(201,169,110,0.3)', boxShadow: '0 4px 12px rgba(0,0,0,0.6)' }}>
            <div className="text-xs font-fantasy" style={{ color: '#e8d5b7' }}>
              Base {label}: {baseStat}
            </div>
            <div className="text-xs" style={{ color: diff > 0 ? '#86efac' : '#fca5a5', fontFamily: 'EB Garamond, serif' }}>
              Equipment: {diff > 0 ? `+${diff}` : diff}
            </div>
            <div className="text-xs font-bold font-fantasy mt-0.5" style={{ color: '#f0c040' }}>
              Final: {effectiveStat}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </span>
  );
}
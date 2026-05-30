import React from 'react';
import { Minus, Plus, Skull } from 'lucide-react';
import { EXHAUSTION_EFFECTS } from './gameData';

/**
 * Exhaustion tracker (PHB p.291) — displays the 6-level cumulative track and,
 * when onChange is provided, lets the user adjust the level.
 *
 * Props:
 *  - level: number (0-6)
 *  - onChange?: (newLevel) => void   // omit for read-only display
 *  - compact?: boolean               // small badge form
 */
export default function ExhaustionTracker({ level = 0, onChange, compact = false }) {
  const lvl = Math.max(0, Math.min(6, level || 0));
  const info = EXHAUSTION_EFFECTS[lvl];

  const color = lvl === 0 ? 'rgba(180,140,90,0.5)'
    : lvl >= 6 ? '#fca5a5'
    : lvl >= 4 ? '#f87171'
    : lvl >= 2 ? '#fbbf24'
    : '#fcd34d';

  if (compact) {
    if (lvl === 0) return null;
    return (
      <span className="px-2 py-0.5 rounded-full font-fantasy inline-flex items-center gap-1"
        style={{ fontSize: '0.6rem', background: 'rgba(60,20,8,0.7)', border: `1px solid ${color}55`, color }}>
        {lvl >= 6 ? <Skull className="w-3 h-3" /> : '😓'} Exhaustion {lvl}
      </span>
    );
  }

  return (
    <div className="rounded-xl p-3" style={{ background: 'rgba(15,10,5,0.6)', border: '1px solid rgba(180,140,90,0.2)' }}>
      <div className="flex items-center justify-between mb-2">
        <span className="font-fantasy text-xs tracking-widest" style={{ color: 'rgba(180,140,90,0.6)', fontSize: '0.65rem' }}>
          EXHAUSTION
        </span>
        {onChange && (
          <div className="flex items-center gap-1.5">
            <button onClick={() => onChange(Math.max(0, lvl - 1))}
              className="w-6 h-6 rounded-lg flex items-center justify-center"
              style={{ background: 'rgba(15,10,5,0.7)', border: '1px solid rgba(180,140,90,0.25)', color: 'rgba(201,169,110,0.7)' }}>
              <Minus className="w-3 h-3" />
            </button>
            <button onClick={() => onChange(Math.min(6, lvl + 1))}
              className="w-6 h-6 rounded-lg flex items-center justify-center"
              style={{ background: 'rgba(15,10,5,0.7)', border: '1px solid rgba(180,140,90,0.25)', color: 'rgba(201,169,110,0.7)' }}>
              <Plus className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>

      {/* Level pips */}
      <div className="flex gap-1 mb-2">
        {[1, 2, 3, 4, 5, 6].map(i => (
          <div key={i} className="flex-1 h-2 rounded-full"
            style={{
              background: i <= lvl ? color : 'rgba(40,28,12,0.6)',
              border: '1px solid rgba(0,0,0,0.4)',
            }} />
        ))}
      </div>

      <div className="font-fantasy font-bold text-sm mb-1" style={{ color }}>
        {info.label}
      </div>
      {info.effects.length > 0 ? (
        <ul className="space-y-0.5">
          {info.effects.map((e, i) => (
            <li key={i} className="text-xs flex items-start gap-1"
              style={{ color: 'rgba(232,213,183,0.7)', fontFamily: 'EB Garamond, serif' }}>
              <span style={{ color }}>•</span> {e}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs" style={{ color: 'rgba(180,140,90,0.4)', fontFamily: 'EB Garamond, serif' }}>No exhaustion.</p>
      )}
    </div>
  );
}
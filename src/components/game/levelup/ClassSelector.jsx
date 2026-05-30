import React from 'react';
import { Layers } from 'lucide-react';

/**
 * ClassSelector — shown during level-up for multiclass characters.
 * Lets the player choose WHICH class receives the new level.
 *
 * Props:
 *  - options: [{ class: string, level: number, isPrimary: boolean }]
 *  - selected: currently selected class name
 *  - onSelect: (className) => void
 */
export default function ClassSelector({ options = [], selected, onSelect }) {
  if (options.length <= 1) return null;

  return (
    <div className="rounded-xl p-4 rune-border"
      style={{ background: 'rgba(40,25,60,0.35)', border: '1px solid rgba(150,90,230,0.3)' }}>
      <div className="flex items-center gap-2 mb-3">
        <Layers className="w-4 h-4" style={{ color: '#c4b5fd' }} />
        <span className="font-fantasy text-sm tracking-widest" style={{ color: 'rgba(196,181,253,0.7)' }}>
          ADVANCE WHICH CLASS?
        </span>
      </div>
      <p className="text-sm mb-3" style={{ color: 'var(--parchment-dim)', fontFamily: 'EB Garamond, serif' }}>
        Choose which of your classes gains this level:
      </p>
      <div className="grid grid-cols-1 gap-2">
        {options.map(opt => (
          <button key={opt.class} onClick={() => onSelect(opt.class)}
            className="w-full text-left p-3 rounded-lg transition-all flex items-center justify-between"
            style={selected === opt.class ? {
              background: 'rgba(80,30,120,0.6)',
              border: '1px solid rgba(160,100,240,0.6)',
              color: '#dfc8ff',
            } : {
              background: 'rgba(20,10,35,0.5)',
              border: '1px solid rgba(120,70,200,0.2)',
              color: 'rgba(192,132,252,0.6)',
            }}>
            <span className="font-fantasy font-bold text-sm">
              {opt.class}
              {opt.isPrimary && (
                <span className="ml-2 text-xs font-normal" style={{ color: 'rgba(196,181,253,0.5)' }}>
                  (primary)
                </span>
              )}
            </span>
            <span className="text-xs font-fantasy" style={{ color: 'rgba(196,181,253,0.5)' }}>
              Lv {opt.level} → {opt.level + 1}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
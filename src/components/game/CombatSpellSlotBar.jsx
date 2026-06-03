import React from 'react';
import { Zap } from 'lucide-react';
import { getMulticlassSpellSlots } from './multiclassUtils';

const LEVEL_LABELS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

/**
 * Compact, read-only spell-slot tracker for the combat action panel.
 * Shows remaining/max slots per level at a glance. Casting is blocked by
 * CombatSpellSelector when remaining === 0; this bar surfaces that state visibly.
 */
export default function CombatSpellSlotBar({ character }) {
  const slotMaxArr = getMulticlassSpellSlots(character || {});
  const currentSlots = character?.spell_slots || {};

  if (!slotMaxArr || slotMaxArr.length === 0) return null;
  if (!slotMaxArr.some(m => m > 0)) return null;

  return (
    <div className="rounded-lg p-2"
      style={{ background: 'rgba(20,8,40,0.45)', border: '1px solid rgba(130,70,210,0.25)' }}>
      <div className="flex items-center gap-1.5 mb-1.5">
        <Zap className="w-3 h-3" style={{ color: '#c4b5fd' }} />
        <span className="font-fantasy" style={{ color: 'rgba(196,181,253,0.7)', fontSize: '0.58rem', letterSpacing: '0.1em' }}>
          SPELL SLOTS
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        {slotMaxArr.map((maxSlots, idx) => {
          if (!maxSlots) return null;
          const level = idx + 1;
          const used = currentSlots[`level_${level}`] || 0;
          const remaining = Math.max(0, maxSlots - used);
          return (
            <div key={level} className="flex items-center gap-1">
              <span className="font-mono" style={{ color: 'rgba(196,181,253,0.5)', fontSize: '0.6rem' }}>
                L{LEVEL_LABELS[idx]}
              </span>
              <div className="flex gap-0.5">
                {Array.from({ length: maxSlots }).map((_, j) => (
                  <div key={j} className="w-2 h-2 rounded-full"
                    style={j < remaining ? {
                      background: 'linear-gradient(135deg, rgba(180,120,255,0.9), rgba(120,60,200,0.9))',
                      boxShadow: '0 0 4px rgba(160,100,240,0.4)',
                    } : {
                      background: 'rgba(30,15,45,0.8)',
                      border: '1px solid rgba(100,60,160,0.3)',
                    }} />
                ))}
              </div>
              {remaining === 0 && (
                <span style={{ color: '#f87171', fontSize: '0.55rem' }}>empty</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
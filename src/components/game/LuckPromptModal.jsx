import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clover, X } from 'lucide-react';

/**
 * Lucky feat reroll prompt (PHB p.167).
 * Shows the original d20 result and offers to spend a luck point to roll a
 * second d20. After the reroll, both dice are shown and the player picks the
 * one they want to keep.
 *
 * Props:
 *  - open: boolean
 *  - originalDie: number (the natural d20 face before modifiers)
 *  - luckDie: number | null (the rerolled d20 face; null until rerolled)
 *  - luckPointsRemaining: number
 *  - onUseLuck: () => void           // spend a point and roll the extra die
 *  - onChoose: (chosenDie) => void   // keep the selected die face
 *  - onDecline: () => void           // keep the original, close
 */
export default function LuckPromptModal({
  open, originalDie, luckDie, luckPointsRemaining = 0, onUseLuck, onChoose, onDecline,
}) {
  if (!open) return null;
  const rerolled = luckDie != null;

  const Die = ({ value, onClick, highlight }) => (
    <button onClick={onClick} disabled={!onClick}
      className="flex flex-col items-center justify-center rounded-xl transition-all"
      style={{
        width: 96, height: 96,
        background: highlight ? 'rgba(60,40,8,0.85)' : 'rgba(15,10,5,0.8)',
        border: `1px solid ${highlight ? 'rgba(232,184,109,0.7)' : 'rgba(180,140,90,0.25)'}`,
        boxShadow: highlight ? '0 0 18px rgba(184,115,51,0.3)' : 'none',
        cursor: onClick ? 'pointer' : 'default',
      }}>
      <span className="font-fantasy font-bold"
        style={{ fontSize: '2.4rem', color: value === 20 ? '#f0c040' : value === 1 ? '#fca5a5' : '#e8d5b7' }}>
        {value}
      </span>
      {value === 20 && <span className="text-xs font-fantasy" style={{ color: '#f0c040', fontSize: '0.55rem' }}>NAT 20</span>}
      {value === 1 && <span className="text-xs font-fantasy" style={{ color: '#fca5a5', fontSize: '0.55rem' }}>NAT 1</span>}
    </button>
  );

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-[60] flex items-center justify-center p-4"
        style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}>
        <motion.div
          initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0 }}
          className="relative w-full max-w-sm rounded-2xl p-5 glass-panel rune-border"
          style={{ background: 'linear-gradient(160deg, rgba(45,30,10,0.97), rgba(25,15,5,0.98))' }}>
          <button onClick={onDecline} className="absolute top-3 right-3 p-1 rounded-lg"
            style={{ color: 'rgba(201,169,110,0.5)' }}>
            <X className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-2 mb-1">
            <Clover className="w-5 h-5" style={{ color: '#86efac' }} />
            <h3 className="font-fantasy font-bold text-base" style={{ color: '#f0c040' }}>Lucky</h3>
          </div>
          <p className="text-xs mb-4" style={{ color: 'rgba(201,169,110,0.65)', fontFamily: 'EB Garamond, serif' }}>
            {rerolled
              ? 'Choose which die to keep.'
              : `Spend a luck point to roll a second d20? (${luckPointsRemaining} remaining)`}
          </p>

          <div className="flex items-center justify-center gap-4 mb-5">
            <div className="text-center">
              <Die value={originalDie} onClick={rerolled ? () => onChoose(originalDie) : null} highlight={false} />
              <div className="mt-1 text-xs" style={{ color: 'rgba(180,140,90,0.6)', fontFamily: 'EB Garamond, serif' }}>Original</div>
            </div>
            {rerolled && (
              <>
                <span className="font-fantasy" style={{ color: 'rgba(201,169,110,0.5)' }}>vs</span>
                <div className="text-center">
                  <Die value={luckDie} onClick={() => onChoose(luckDie)} highlight={false} />
                  <div className="mt-1 text-xs" style={{ color: 'rgba(134,239,172,0.7)', fontFamily: 'EB Garamond, serif' }}>Luck Die</div>
                </div>
              </>
            )}
          </div>

          {!rerolled ? (
            <div className="flex gap-2">
              <button onClick={onDecline}
                className="flex-1 py-2.5 rounded-xl font-fantasy text-sm btn-fantasy">
                Keep {originalDie}
              </button>
              <button onClick={onUseLuck} disabled={luckPointsRemaining <= 0}
                className="flex-1 py-2.5 rounded-xl font-fantasy text-sm flex items-center justify-center gap-1.5 disabled:opacity-40"
                style={{ background: 'rgba(10,50,20,0.8)', border: '1px solid rgba(40,160,80,0.5)', color: '#86efac' }}>
                <Clover className="w-4 h-4" /> Use Luck
              </button>
            </div>
          ) : (
            <p className="text-center text-xs" style={{ color: 'rgba(201,169,110,0.5)', fontFamily: 'EB Garamond, serif' }}>
              Tap a die above to keep it.
            </p>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
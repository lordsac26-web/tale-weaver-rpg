import React from 'react';
import { motion } from 'framer-motion';
import { Dices, X, Swords } from 'lucide-react';

const RISK_COLORS = {
  low:     { bg: 'rgba(10,50,20,0.6)',  border: 'rgba(40,160,80,0.4)',   color: '#86efac' },
  medium:  { bg: 'rgba(60,40,5,0.6)',   border: 'rgba(200,150,20,0.4)',  color: '#fde68a' },
  high:    { bg: 'rgba(60,20,5,0.6)',   border: 'rgba(200,80,20,0.4)',   color: '#fdba74' },
  extreme: { bg: 'rgba(60,5,5,0.6)',    border: 'rgba(180,20,20,0.5)',   color: '#fca5a5' },
};

export default function ActionProposalModal({ proposal, onConfirm, onCancel }) {
  const { action, requires_check, skill, dc, reasoning, risk_level } = proposal;
  const riskColors = RISK_COLORS[risk_level] || RISK_COLORS.low;

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end justify-center p-4 md:items-center"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)' }}>
      <motion.div
        initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 50, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        className="w-full max-w-md rounded-2xl overflow-hidden"
        style={{ background: '#0d0a07', border: '1px solid rgba(201,169,110,0.25)', boxShadow: '0 0 40px rgba(0,0,0,0.8)' }}>

        {/* Header */}
        <div className="px-5 py-4" style={{ borderBottom: '1px solid rgba(180,140,90,0.1)', background: 'rgba(15,10,4,0.95)' }}>
          <div className="text-xs font-fantasy tracking-widest mb-2" style={{ color: 'rgba(201,169,110,0.45)' }}>
            ⚖ DUNGEON MASTER ADJUDICATES
          </div>
          <div className="flex items-start gap-2">
            <div className="text-base flex-shrink-0 mt-0.5">💬</div>
            <p className="text-sm italic" style={{ color: 'rgba(147,197,253,0.8)', fontFamily: 'EB Garamond, serif', fontSize: '1rem' }}>
              "{action}"
            </p>
          </div>
        </div>

        <div className="p-5 space-y-4">
          {/* GM Reasoning */}
          <p className="leading-relaxed" style={{ color: 'rgba(232,213,183,0.75)', fontFamily: 'IM Fell English, serif', fontSize: '1rem' }}>
            {reasoning}
          </p>

          {/* Skill Check Panel */}
          {requires_check && skill && (
            <div className="p-4 rounded-xl flex items-center gap-3"
              style={{ background: 'rgba(60,40,5,0.6)', border: '1px solid rgba(201,169,110,0.35)' }}>
              <div className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: 'rgba(80,50,10,0.8)', border: '1px solid rgba(201,169,110,0.3)' }}>
                <Dices className="w-5 h-5" style={{ color: '#f0c040' }} />
              </div>
              <div>
                <div className="font-fantasy text-sm font-bold" style={{ color: '#f0c040' }}>
                  {skill} Check · DC {dc}
                </div>
                <div className="text-xs mt-0.5" style={{ color: 'rgba(201,169,110,0.5)', fontFamily: 'EB Garamond, serif' }}>
                  Roll required — success determines the outcome.
                </div>
              </div>
              {risk_level && (
                <div className="ml-auto px-2.5 py-1 rounded-full text-xs font-fantasy"
                  style={{ background: riskColors.bg, border: `1px solid ${riskColors.border}`, color: riskColors.color }}>
                  {risk_level}
                </div>
              )}
            </div>
          )}

          {/* No check — just proceed */}
          {!requires_check && (
            <div className="px-3 py-2 rounded-xl"
              style={{ background: 'rgba(10,50,20,0.4)', border: '1px solid rgba(40,160,80,0.3)' }}>
              <p className="text-xs font-fantasy" style={{ color: '#86efac' }}>✓ No roll needed — this action proceeds automatically.</p>
            </div>
          )}

          {/* Buttons */}
          <div className="flex gap-2 pt-1">
            <button onClick={onConfirm}
              className="flex-1 py-3 rounded-xl text-sm font-fantasy flex items-center justify-center gap-2 btn-fantasy">
              {requires_check ? <Dices className="w-4 h-4" /> : <Swords className="w-4 h-4" />}
              {requires_check ? `Roll ${skill}!` : 'Proceed'}
            </button>
            <button onClick={onCancel}
              className="px-4 py-3 rounded-xl text-sm flex items-center gap-1"
              style={{ border: '1px solid rgba(180,140,90,0.15)', color: 'rgba(201,169,110,0.4)' }}>
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
import React from 'react';
import { motion } from 'framer-motion';
import { Dices, X, Swords, MessageCircle, Handshake, Eye } from 'lucide-react';

const RISK_COLORS = {
  low:     { bg: 'rgba(10,50,20,0.6)',  border: 'rgba(40,160,80,0.4)',   color: '#86efac' },
  medium:  { bg: 'rgba(60,40,5,0.6)',   border: 'rgba(200,150,20,0.4)',  color: '#fde68a' },
  high:    { bg: 'rgba(60,20,5,0.6)',   border: 'rgba(200,80,20,0.4)',   color: '#fdba74' },
  extreme: { bg: 'rgba(60,5,5,0.6)',    border: 'rgba(180,20,20,0.5)',   color: '#fca5a5' },
};

// Visual identity per outcome the DM may rule
const OUTCOME = {
  skill_check:    { icon: Dices,         label: 'Skill Check Required', color: '#f0c040', tint: 'rgba(80,50,10,0.6)',  border: 'rgba(201,169,110,0.4)' },
  continue_combat:{ icon: Swords,        label: 'Press the Attack',     color: '#fca5a5', tint: 'rgba(70,10,10,0.6)',  border: 'rgba(220,60,60,0.4)' },
  de_escalate:    { icon: Handshake,     label: 'Attempt to De-escalate', color: '#93c5fd', tint: 'rgba(10,30,60,0.6)', border: 'rgba(80,140,220,0.4)' },
  narrative:      { icon: Eye,           label: 'It Simply Happens',    color: '#c4b5fd', tint: 'rgba(40,20,60,0.6)',  border: 'rgba(160,100,255,0.4)' },
};

/**
 * CombatActProposalModal — shows the DM's adjudication of a free-text combat action.
 * Displays the outcome type (check / continue / de-escalate / narrative), the DM's
 * reasoning, and any required roll. Confirm resolves the action; Cancel dismisses.
 */
export default function CombatActProposalModal({ proposal, onConfirm, onCancel }) {
  const { action, outcome_type, requires_check, skill, dc, reasoning, risk_level, ends_combat_on_success } = proposal;
  const outcome = OUTCOME[outcome_type] || OUTCOME.narrative;
  const OutcomeIcon = outcome.icon;
  const riskColors = RISK_COLORS[risk_level] || RISK_COLORS.low;

  const confirmLabel = requires_check && skill
    ? `Roll ${skill}!`
    : outcome_type === 'continue_combat'
    ? 'Got it'
    : 'Proceed';

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end justify-center p-4 md:items-center"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)' }}>
      <motion.div
        initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 50, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        className="w-full max-w-xl rounded-2xl overflow-hidden"
        style={{ background: '#0d0a07', border: '1px solid rgba(201,169,110,0.25)', boxShadow: '0 0 40px rgba(0,0,0,0.8)' }}>

        {/* Header */}
        <div className="px-5 py-4" style={{ borderBottom: '1px solid rgba(180,140,90,0.1)', background: 'rgba(15,10,4,0.95)' }}>
          <div className="text-xs font-fantasy tracking-widest mb-2 flex items-center gap-1.5" style={{ color: 'rgba(252,165,165,0.55)' }}>
            ⚔ DUNGEON MASTER ADJUDICATES (COMBAT)
          </div>
          <div className="flex items-start gap-2">
            <MessageCircle className="w-4 h-4 flex-shrink-0 mt-1" style={{ color: 'rgba(147,197,253,0.6)' }} />
            <p className="text-sm italic" style={{ color: 'rgba(147,197,253,0.85)', fontFamily: 'EB Garamond, serif', fontSize: '1rem' }}>
              "{action}"
            </p>
          </div>
        </div>

        <div className="p-5 space-y-4">
          {/* Outcome badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full"
            style={{ background: outcome.tint, border: `1px solid ${outcome.border}` }}>
            <OutcomeIcon className="w-4 h-4" style={{ color: outcome.color }} />
            <span className="font-fantasy text-xs font-bold tracking-wide" style={{ color: outcome.color }}>
              {outcome.label}
            </span>
          </div>

          {/* DM Reasoning (the "stop and think" output) */}
          <p className="leading-relaxed" style={{ color: 'rgba(232,213,183,0.78)', fontFamily: 'IM Fell English, serif', fontSize: '1rem' }}>
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
                  {ends_combat_on_success ? 'Success may end the fight.' : 'Success determines the outcome.'}
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

          {/* Continue combat hint */}
          {outcome_type === 'continue_combat' && !requires_check && (
            <div className="px-3 py-2 rounded-xl"
              style={{ background: 'rgba(70,10,10,0.4)', border: '1px solid rgba(220,60,60,0.3)' }}>
              <p className="text-xs font-fantasy" style={{ color: '#fca5a5' }}>⚔️ Use your normal Attack or Spell action to carry this out.</p>
            </div>
          )}

          {/* Narrative / no check */}
          {!requires_check && outcome_type !== 'continue_combat' && (
            <div className="px-3 py-2 rounded-xl"
              style={{ background: 'rgba(10,50,20,0.4)', border: '1px solid rgba(40,160,80,0.3)' }}>
              <p className="text-xs font-fantasy" style={{ color: '#86efac' }}>✓ No roll needed — this resolves automatically.</p>
            </div>
          )}

          {/* Buttons */}
          <div className="flex gap-2 pt-1">
            <button onClick={onConfirm}
              className="flex-1 py-3 rounded-xl text-sm font-fantasy flex items-center justify-center gap-2 btn-fantasy">
              <OutcomeIcon className="w-4 h-4" />
              {confirmLabel}
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
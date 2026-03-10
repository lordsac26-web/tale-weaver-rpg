import React from 'react';
import { motion } from 'framer-motion';
import { X, Loader2, Swords, Shield, Target, Zap, Heart, Skull, TrendingUp } from 'lucide-react';

const RESULT_THEMES = {
  victory: { color: '#f0c040', glow: 'rgba(240,192,64,0.15)', label: '⚔️ Victory', border: 'rgba(240,192,64,0.4)' },
  defeat:  { color: '#ff5555', glow: 'rgba(255,60,60,0.12)', label: '💀 Defeat', border: 'rgba(255,60,60,0.4)' },
  fled:    { color: '#fbbf24', glow: 'rgba(251,191,36,0.1)', label: '💨 Fled', border: 'rgba(251,191,36,0.35)' },
  resolved:{ color: '#c9a96e', glow: 'rgba(201,169,110,0.1)', label: '⚖️ Resolved', border: 'rgba(201,169,110,0.35)' },
};

function StatCard({ icon: Icon, label, value, color }) {
  return (
    <div className="flex flex-col items-center gap-1 p-3 rounded-xl"
      style={{ background: 'rgba(15,8,3,0.7)', border: '1px solid rgba(184,115,51,0.15)' }}>
      <Icon className="w-4 h-4" style={{ color: color || 'rgba(212,149,90,0.7)' }} />
      <span className="font-fantasy-deco font-bold text-xl" style={{ color: color || '#e8d5b7' }}>{value}</span>
      <span className="text-xs font-fantasy" style={{ color: 'rgba(212,180,110,0.55)', letterSpacing: '0.06em' }}>{label}</span>
    </div>
  );
}

function MvpBadge({ mvp, index }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.3 + index * 0.08 }}
      className="flex items-center gap-3 px-3 py-2 rounded-lg"
      style={{ background: 'rgba(45,28,5,0.6)', border: '1px solid rgba(184,115,51,0.15)' }}>
      <span className="text-lg">{mvp.icon}</span>
      <div className="flex-1 min-w-0">
        <div className="text-xs font-fantasy" style={{ color: 'rgba(240,192,64,0.9)', letterSpacing: '0.06em' }}>{mvp.title}</div>
        <div className="text-xs font-body" style={{ color: 'rgba(212,180,110,0.7)' }}>
          <span style={{ color: '#e8d5b7' }}>{mvp.name}</span> — {mvp.value}
        </div>
      </div>
    </motion.div>
  );
}

function EnemyBreakdown({ enemies }) {
  if (!enemies?.length) return null;
  return (
    <div className="space-y-1.5">
      <div className="tavern-section-label">Enemy Breakdown</div>
      {enemies.map((e, i) => (
        <div key={i} className="flex items-center justify-between px-3 py-1.5 rounded-lg"
          style={{ background: 'rgba(60,10,10,0.3)', border: '1px solid rgba(200,50,40,0.12)' }}>
          <span className="text-xs font-fantasy" style={{ color: '#fca5a5' }}>{e.name}</span>
          <div className="flex gap-3 text-xs font-body" style={{ color: 'rgba(212,180,110,0.6)' }}>
            <span title="Damage dealt to player">🗡 {e.damage_dealt}</span>
            <span title="Damage taken">🛡 {e.damage_taken}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function AfterActionReport({ aar, loading, onClose, onNarrativeContinue }) {
  const theme = RESULT_THEMES[aar?.result] || RESULT_THEMES.resolved;

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.92)' }}>

      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 20 }}
        transition={{ type: 'spring', stiffness: 300, damping: 26 }}
        className="w-full max-w-lg rounded-2xl overflow-hidden flex flex-col"
        style={{
          background: 'linear-gradient(160deg, rgba(28,14,5,0.99), rgba(14,7,2,0.99))',
          border: `1px solid ${theme.border}`,
          boxShadow: `0 0 80px ${theme.glow}, 0 20px 60px rgba(0,0,0,0.8)`,
          maxHeight: '88vh',
        }}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-2 flex-shrink-0">
          <div>
            <h2 className="font-fantasy-deco font-bold text-xl text-glow-gold" style={{ color: theme.color }}>
              {theme.label}
            </h2>
            <p className="text-xs font-fantasy mt-0.5" style={{ color: 'rgba(212,180,110,0.55)', letterSpacing: '0.1em' }}>
              AFTER-ACTION REPORT
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg transition-colors"
            style={{ color: 'rgba(180,140,90,0.35)' }}
            onMouseEnter={e => e.currentTarget.style.color = '#c9a96e'}
            onMouseLeave={e => e.currentTarget.style.color = 'rgba(180,140,90,0.35)'}>
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="px-5 pb-4 overflow-y-auto flex-1 space-y-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Loader2 className="w-8 h-8 animate-spin" style={{ color: theme.color }} />
              <span className="text-xs font-fantasy" style={{ color: 'rgba(212,180,110,0.75)' }}>Analyzing battle data...</span>
            </div>
          ) : aar ? (
            <>
              {/* Combat Stats Grid */}
              <div className="grid grid-cols-4 gap-2">
                <StatCard icon={Swords} label="Dealt" value={aar.total_damage_dealt || 0} color="#f0c040" />
                <StatCard icon={Shield} label="Taken" value={aar.total_damage_taken || 0} color="#fca5a5" />
                <StatCard icon={Target} label="Accuracy" value={`${aar.player_accuracy || 0}%`} color="#86efac" />
                <StatCard icon={TrendingUp} label="Rounds" value={aar.total_rounds || 0} />
              </div>

              {/* Secondary stats */}
              <div className="grid grid-cols-4 gap-2">
                {aar.crits > 0 && <StatCard icon={Zap} label="Crits" value={aar.crits} color="#f59e0b" />}
                {aar.kills > 0 && <StatCard icon={Skull} label="Kills" value={aar.kills} color="#ef4444" />}
                {aar.heals > 0 && <StatCard icon={Heart} label="Healed" value={aar.heals} color="#34d399" />}
                {aar.spells_cast > 0 && <StatCard icon={Zap} label="Spells" value={aar.spells_cast} color="#c084fc" />}
              </div>

              {/* Divider */}
              <hr className="divider-rune" />

              {/* MVPs */}
              {aar.mvps?.length > 0 && (
                <div className="space-y-1.5">
                  <div className="tavern-section-label">Commendations</div>
                  {aar.mvps.map((mvp, i) => (
                    <MvpBadge key={i} mvp={mvp} index={i} />
                  ))}
                </div>
              )}

              {/* Enemy Breakdown */}
              <EnemyBreakdown enemies={aar.enemy_stats} />

              {/* Narrative Bridge */}
              {aar.narrative_bridge && (
                <>
                  <hr className="divider-rune" />
                  <div className="space-y-2">
                    <div className="tavern-section-label">The Aftermath</div>
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.5 }}
                      className="text-sm leading-relaxed italic"
                      style={{ color: 'rgba(232,213,183,0.85)', fontFamily: 'IM Fell English, serif' }}>
                      {aar.narrative_bridge}
                    </motion.p>
                  </div>
                </>
              )}
            </>
          ) : null}
        </div>

        {/* Footer */}
        <div className="px-5 pb-5 pt-3 flex gap-2 flex-shrink-0" style={{ borderTop: '1px solid rgba(184,115,51,0.12)' }}>
          {aar?.narrative_bridge && onNarrativeContinue && (
            <button onClick={() => { onNarrativeContinue(aar.narrative_bridge); onClose(); }}
              className="flex-1 py-2.5 rounded-xl font-fantasy font-bold text-sm btn-fantasy flex items-center justify-center gap-2">
              📜 Add to Story
            </button>
          )}
          <button onClick={onClose}
            className="flex-1 py-2.5 rounded-xl text-sm font-fantasy transition-all"
            style={{ border: '1px solid rgba(180,140,90,0.35)', color: 'rgba(212,180,110,0.75)' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(201,169,110,0.55)'; e.currentTarget.style.color = '#c9a96e'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(180,140,90,0.35)'; e.currentTarget.style.color = 'rgba(212,180,110,0.75)'; }}>
            Dismiss
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
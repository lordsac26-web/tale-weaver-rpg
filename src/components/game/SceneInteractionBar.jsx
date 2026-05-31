import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles } from 'lucide-react';

// Risk-based styling, mirrors the choice risk palette in StoryPanel
const RISK_STYLES = {
  low:     { border: 'rgba(40,160,80,0.4)',  glow: 'rgba(40,160,80,0.35)',  color: '#86efac' },
  medium:  { border: 'rgba(200,150,20,0.4)', glow: 'rgba(200,150,20,0.35)', color: '#fde68a' },
  high:    { border: 'rgba(200,80,20,0.4)',  glow: 'rgba(200,80,20,0.35)',  color: '#fdba74' },
  extreme: { border: 'rgba(180,20,20,0.45)', glow: 'rgba(180,20,20,0.4)',   color: '#fca5a5' },
};

/**
 * SceneInteractionBar
 * Renders highlighted, clickable environment objects the player can manipulate.
 * Each object triggers a skill check via onInteract.
 *
 * Props:
 *  - objects: [{ label, icon, action, description, skill_check, dc, risk_level }]
 *  - onInteract: (object) => void
 *  - disabled: boolean
 */
export default function SceneInteractionBar({ objects = [], onInteract, disabled }) {
  if (!objects || objects.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2" style={{ color: 'rgba(201,169,110,0.55)' }}>
        <Sparkles className="w-3 h-3" />
        <span className="font-fantasy text-xs tracking-widest uppercase">Examine the Surroundings</span>
      </div>
      <div className="flex flex-wrap gap-2">
        <AnimatePresence>
          {objects.map((obj, i) => {
            const style = RISK_STYLES[obj.risk_level] || RISK_STYLES.low;
            return (
              <motion.button
                key={`${obj.label}-${i}`}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ delay: i * 0.06, duration: 0.25 }}
                onClick={() => !disabled && onInteract(obj)}
                disabled={disabled}
                title={obj.description || obj.action}
                className="group flex items-center gap-2 px-3 py-2 rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                style={{
                  background: 'rgba(15,10,4,0.7)',
                  border: `1px solid ${style.border}`,
                }}
                onMouseEnter={e => { if (!disabled) e.currentTarget.style.boxShadow = `0 0 14px ${style.glow}`; }}
                onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; }}>
                <span className="text-lg leading-none">{obj.icon || '✦'}</span>
                <div className="flex flex-col items-start">
                  <span className="text-sm font-fantasy leading-tight" style={{ color: 'rgba(232,213,183,0.92)' }}>
                    {obj.label}
                  </span>
                  {obj.skill_check && obj.dc && (
                    <span className="text-xs font-fantasy" style={{ color: style.color }}>
                      {obj.skill_check} DC{obj.dc}
                    </span>
                  )}
                </div>
              </motion.button>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
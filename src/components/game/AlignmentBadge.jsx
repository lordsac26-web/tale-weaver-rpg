import React from 'react';
import { motion } from 'framer-motion';

/**
 * Computes the 9-alignment label from two axis scores.
 * Law/Chaos: +8..+10 = Lawful, -8..-10 = Chaotic, else Neutral
 * Good/Evil: +8..+10 = Good,   -8..-10 = Evil,     else Neutral
 */
export function getAlignmentLabel(lc = 0, ge = 0) {
  const lawChaos = lc >= 4 ? 'Lawful' : lc <= -4 ? 'Chaotic' : 'Neutral';
  const goodEvil = ge >= 4 ? 'Good' : ge <= -4 ? 'Evil' : 'Neutral';
  if (lawChaos === 'Neutral' && goodEvil === 'Neutral') return 'True Neutral';
  return `${lawChaos} ${goodEvil}`;
}

const ALIGNMENT_COLORS = {
  'Lawful Good':     { color: '#86efac', glow: 'rgba(40,180,80,0.4)',  icon: '⚖️' },
  'Neutral Good':    { color: '#86efac', glow: 'rgba(40,180,80,0.3)',  icon: '💚' },
  'Chaotic Good':    { color: '#93c5fd', glow: 'rgba(60,130,240,0.3)', icon: '🌊' },
  'Lawful Neutral':  { color: '#fde68a', glow: 'rgba(200,170,40,0.3)', icon: '⚖️' },
  'True Neutral':    { color: '#d4b896', glow: 'rgba(180,150,100,0.2)',icon: '☯️' },
  'Chaotic Neutral': { color: '#c4b5fd', glow: 'rgba(140,100,240,0.3)',icon: '🌀' },
  'Lawful Evil':     { color: '#fca5a5', glow: 'rgba(200,50,40,0.3)', icon: '👁️' },
  'Neutral Evil':    { color: '#fca5a5', glow: 'rgba(200,50,40,0.25)',icon: '💀' },
  'Chaotic Evil':    { color: '#f87171', glow: 'rgba(220,40,30,0.4)', icon: '🔥' },
};

export default function AlignmentBadge({ character }) {
  if (!character) return null;

  const lc = character.alignment_law_chaos || 0;
  const ge = character.alignment_good_evil || 0;
  const label = getAlignmentLabel(lc, ge);
  const style = ALIGNMENT_COLORS[label] || ALIGNMENT_COLORS['True Neutral'];

  return (
    <motion.div
      className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg stat-box cursor-default"
      title={`${label}\nLaw/Chaos: ${lc > 0 ? '+' : ''}${lc} · Good/Evil: ${ge > 0 ? '+' : ''}${ge}`}
      whileHover={{ scale: 1.03 }}
    >
      <span className="text-xs">{style.icon}</span>
      <span className="font-fantasy text-xs font-semibold" style={{ color: style.color, textShadow: `0 0 8px ${style.glow}` }}>
        {label}
      </span>
    </motion.div>
  );
}
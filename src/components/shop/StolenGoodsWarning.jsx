import React from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, Eye, Shield } from 'lucide-react';

/**
 * Shows "heat" level and risk info for stolen items in the black market.
 * heat: 1-5, higher = more likely sheriff notices the item on you.
 */

const HEAT_LEVELS = [
  { label: 'Cold',       color: '#86efac', desc: 'Nobody is looking for this.',        chance: '5%'  },
  { label: 'Warm',       color: '#fde68a', desc: 'Minor reports filed.',                chance: '15%' },
  { label: 'Hot',        color: '#fb923c', desc: 'Actively searched for.',              chance: '30%' },
  { label: 'Scorching',  color: '#f87171', desc: 'Bounty posted. Guards on alert.',     chance: '50%' },
  { label: 'Blazing',    color: '#ef4444', desc: 'The owner wants blood. High reward.', chance: '75%' },
];

export function HeatBadge({ heat }) {
  const level = HEAT_LEVELS[Math.min(Math.max((heat || 1) - 1, 0), 4)];
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-fantasy"
      style={{
        background: `${level.color}18`,
        border: `1px solid ${level.color}44`,
        color: level.color,
        fontSize: '0.6rem',
      }}>
      <Eye className="w-2.5 h-2.5" />
      {level.label}
    </span>
  );
}

export default function StolenGoodsWarning({ item }) {
  if (!item.stolen) return null;

  const heat = Math.min(Math.max(item.heat || 1, 1), 5);
  const level = HEAT_LEVELS[heat - 1];

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      className="mt-2 rounded-lg p-2.5 overflow-hidden"
      style={{
        background: 'rgba(80,20,20,0.25)',
        border: '1px solid rgba(220,60,60,0.25)',
      }}>
      <div className="flex items-center gap-2 mb-1.5">
        <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#fca5a5' }} />
        <span className="font-fantasy text-xs font-bold" style={{ color: '#fca5a5', letterSpacing: '0.08em' }}>
          STOLEN GOODS
        </span>
        <HeatBadge heat={heat} />
      </div>

      <div className="space-y-1">
        <p className="text-xs" style={{ color: 'rgba(252,165,165,0.7)', fontFamily: 'EB Garamond, serif' }}>
          <span style={{ color: 'rgba(252,165,165,0.45)' }}>Original owner:</span>{' '}
          <span style={{ fontStyle: 'italic' }}>{item.original_owner || 'Unknown'}</span>
        </p>
        <p className="text-xs" style={{ color: 'rgba(252,165,165,0.55)', fontFamily: 'EB Garamond, serif' }}>
          <Shield className="w-3 h-3 inline mr-1" style={{ color: level.color }} />
          Detection risk: <span style={{ color: level.color, fontWeight: 600 }}>{level.chance}</span> —{' '}
          <span style={{ fontStyle: 'italic' }}>{level.desc}</span>
        </p>
        <p className="text-xs mt-1" style={{ color: 'rgba(201,169,110,0.35)', fontFamily: 'IM Fell English, serif', fontStyle: 'italic' }}>
          "Carrying stolen goods may attract unwanted attention from guards, sheriffs, or bounty hunters during your adventures."
        </p>
      </div>
    </motion.div>
  );
}
import React from 'react';
import { getConditionEffect, conditionKey } from './conditionEffects';

/**
 * Displays a creature's active conditions as badges with hover tooltips
 * describing the mechanical effect. Reusable for player or enemy.
 *
 * Props:
 *  - conditions: array of condition strings or {name} objects
 *  - max: max badges to show before "+N" (default: all)
 *  - size: 'sm' | 'md'
 */
export default function ConditionBadges({ conditions = [], max = null, size = 'sm' }) {
  const list = (conditions || []).filter(Boolean);
  if (list.length === 0) return null;

  const shown = max ? list.slice(0, max) : list;
  const overflow = max ? list.length - shown.length : 0;
  const fontSize = size === 'md' ? '0.7rem' : '0.6rem';

  return (
    <div className="flex flex-wrap gap-1">
      {shown.map((cond, i) => {
        const key = conditionKey(cond);
        const eff = getConditionEffect(cond);
        return (
          <span
            key={`${key}-${i}`}
            title={eff ? `${eff.label}: ${eff.desc}` : key}
            className="px-1.5 py-0.5 rounded-full inline-flex items-center gap-1 cursor-help"
            style={{
              background: 'rgba(60,15,45,0.55)',
              border: `1px solid ${eff?.color || '#c084fc'}55`,
              color: eff?.color || '#f9a8d4',
              fontSize,
              fontFamily: 'Cinzel, serif',
            }}
          >
            {eff?.icon && <span style={{ fontSize }}>{eff.icon}</span>}
            <span className="capitalize">{eff?.label || key}</span>
          </span>
        );
      })}
      {overflow > 0 && (
        <span
          className="px-1.5 py-0.5 rounded-full"
          style={{ background: 'rgba(40,40,40,0.5)', color: '#9ca3af', fontSize }}
        >
          +{overflow}
        </span>
      )}
    </div>
  );
}
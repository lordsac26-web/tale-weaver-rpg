import React from 'react';
import { getConditionEffect, conditionKey } from './conditionEffects';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/**
 * Displays a creature's active conditions as badges with detailed tooltips
 * describing the mechanical effect. Enhanced version with proper tooltip UI.
 */
export default function ConditionBadges({ conditions = [], max = null, size = 'sm' }) {
  const list = (conditions || []).filter(Boolean);
  if (list.length === 0) return null;

  const shown = max ? list.slice(0, max) : list;
  const overflow = max ? list.length - shown.length : 0;
  const fontSize = size === 'md' ? '0.7rem' : '0.6rem';

  return (
    <TooltipProvider>
      <div className="flex flex-wrap gap-1">
        {shown.map((cond, i) => {
          const key = conditionKey(cond);
          const eff = getConditionEffect(cond);
          return (
            <Tooltip key={`${key}-${i}`}>
              <TooltipTrigger asChild>
                <span
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
              </TooltipTrigger>
              <TooltipContent 
                side="top" 
                className="max-w-xs"
                style={{ 
                  background: 'rgba(10,5,2,0.95)', 
                  border: '1px solid rgba(201,169,110,0.3)',
                  color: '#e8d5b7',
                  fontFamily: 'EB Garamond, serif',
                }}
              >
                <p className="font-fantasy font-bold" style={{ color: eff?.color || '#f9a8d4' }}>
                  {eff?.label || key}
                </p>
                <p className="text-xs mt-1" style={{ color: 'rgba(232,213,183,0.8)' }}>
                  {eff?.desc || 'No description available'}
                </p>
              </TooltipContent>
            </Tooltip>
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
    </TooltipProvider>
  );
}
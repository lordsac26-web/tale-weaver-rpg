import React from 'react';
import { Weight, AlertTriangle } from 'lucide-react';
import GameTooltip from '@/components/game/GameTooltip';

export default function EncumbranceBar({ character }) {
  const inventory = character.inventory || [];
  const totalWeight = inventory.reduce((t, it) => t + ((it.weight || 0) * (it.quantity || 1)), 0);
  const capacity = (character.strength || 10) * 15;
  const percentage = Math.min(100, (totalWeight / capacity) * 100);

  const encumbranceLevel = 
    totalWeight > capacity ? 'heavily' :
    totalWeight > capacity * 0.666 ? 'encumbered' : 'normal';

  const statusText = 
    encumbranceLevel === 'heavily' ? 'Heavily Encumbered' :
    encumbranceLevel === 'encumbered' ? 'Encumbered' : 'Unencumbered';

  const penaltyText =
    encumbranceLevel === 'heavily' ? '-20 ft speed, disadvantage on STR/DEX/CON checks' :
    encumbranceLevel === 'encumbered' ? '-10 ft speed' : 'No penalties';

  const barColor =
    encumbranceLevel === 'heavily' ? '#dc2626' :
    encumbranceLevel === 'encumbered' ? '#f59e0b' : '#22c55e';

  return (
    <GameTooltip
      title="Encumbrance"
      subtitle={statusText}
      icon={<Weight className="w-4 h-4" />}
      content={
        <div className="space-y-1 text-xs">
          <div>Carrying: {totalWeight.toFixed(1)} / {capacity} lb</div>
          <div style={{ color: encumbranceLevel === 'normal' ? '#86efac' : '#fca5a5' }}>
            {penaltyText}
          </div>
        </div>
      }>
      <div className="rounded-xl p-3" style={{ background: 'rgba(15,10,5,0.7)', border: '1px solid rgba(180,140,90,0.2)' }}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Weight className="w-4 h-4" style={{ color: barColor }} />
            <span className="font-fantasy text-xs tracking-widest" style={{ color: 'rgba(201,169,110,0.6)' }}>
              CARRY LOAD
            </span>
          </div>
          <span className="text-xs font-fantasy" style={{ color: '#e8d5b7' }}>
            {totalWeight.toFixed(1)} / {capacity} lb
          </span>
        </div>
        
        <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(10,5,2,0.7)' }}>
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${percentage}%` }}
            className="h-full transition-all"
            style={{ background: barColor }}
          />
        </div>

        {encumbranceLevel !== 'normal' && (
          <div className="flex items-center gap-1.5 mt-2 text-xs" style={{ color: '#fca5a5' }}>
            <AlertTriangle className="w-3 h-3" />
            <span>{statusText}</span>
          </div>
        )}
      </div>
    </GameTooltip>
  );
}
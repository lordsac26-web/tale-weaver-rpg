import React from 'react';
import { Layers } from 'lucide-react';

export default function StepClassChoice({ workflowState, setWorkflowState }) {
  const { classOptions, receivingClass } = workflowState;

  const handleSelect = (className) => {
    setWorkflowState(prev => ({ ...prev, receivingClass: className }));
  };

  return (
    <div>
      <h3 className="font-fantasy text-xl mb-4 text-glow-gold">Advance a Class</h3>
      <p className="text-sm mb-4 font-serif" style={{ color: 'var(--parchment-dim)' }}>
        Your character has multiple classes. Choose which one will gain the new level.
      </p>
      <div className="space-y-3">
        {classOptions.map(opt => (
          <button key={opt.class} onClick={() => handleSelect(opt.class)}
            className="w-full text-left p-4 rounded-xl transition-all fantasy-card"
            style={receivingClass === opt.class ? {
              background: 'rgba(92,51,24,0.7)', 
              borderColor: 'var(--brass-gold)'
            } : {
              background: 'rgba(20,13,5,0.7)', 
              borderColor: 'rgba(184,115,51,0.2)'
            }}>
            <div className="flex justify-between items-center">
              <span className="font-fantasy font-bold text-lg">{opt.class}</span>
              <span className="text-sm font-serif" style={{ color: 'var(--parchment-mid)' }}>
                Lv {opt.level} → {opt.level + 1}
              </span>
            </div>
            {opt.isPrimary && <div className="text-xs mt-1" style={{ color: 'var(--parchment-dim)' }}>(Primary)</div>}
          </button>
        ))}
      </div>
    </div>
  );
}
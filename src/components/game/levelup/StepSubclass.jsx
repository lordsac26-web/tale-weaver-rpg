import React from 'react';
import { Sparkles, Check } from 'lucide-react';
import { CLASSES } from '../../gameData';

export default function StepSubclass({ workflowState, setWorkflowState }) {
  const { receivingClass, selectedSubclass } = workflowState;
  const classData = CLASSES[receivingClass] || {};

  const handleSelect = (subclassName) => {
    setWorkflowState(prev => ({ ...prev, selectedSubclass: subclassName }));
  };

  return (
    <div>
      <h3 className="font-fantasy text-xl mb-4 text-glow-gold">Choose Your Path</h3>
      <p className="text-sm mb-4 font-serif" style={{ color: 'var(--parchment-dim)' }}>
        At 3rd level, all {receivingClass}s must choose their specialization. This choice is permanent.
      </p>
      <div className="space-y-3">
        {classData.subclasses?.map(sub => (
          <button key={sub.name} onClick={() => handleSelect(sub.name)}
            className="w-full text-left p-4 rounded-xl transition-all fantasy-card flex justify-between items-start"
            style={selectedSubclass === sub.name ? {
              background: 'rgba(92,51,24,0.7)', 
              borderColor: 'var(--brass-gold)'
            } : {
              background: 'rgba(20,13,5,0.7)', 
              borderColor: 'rgba(184,115,51,0.2)'
            }}>
            <div className="flex-1">
              <div className="font-fantasy font-bold text-lg">{sub.name}</div>
              <p className="text-xs mt-1 font-serif" style={{ color: 'var(--parchment-dim)' }}>{sub.desc}</p>
            </div>
            {selectedSubclass === sub.name && <Check className="w-6 h-6 text-green-400 flex-shrink-0 ml-4" />}
          </button>
        ))}
      </div>
    </div>
  );
}
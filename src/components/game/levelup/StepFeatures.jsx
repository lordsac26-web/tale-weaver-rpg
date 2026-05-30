import React from 'react';
import { Award } from 'lucide-react';
import { CLASSES } from '../gameData';

export default function StepFeatures({ workflowState }) {
  const { receivingClass, newClassLevel } = workflowState;
  const classData = CLASSES[receivingClass] || {};
  const newFeatures = classData.features?.[newClassLevel] || [];

  if (newFeatures.length === 0) {
    return (
      <div className="text-center py-10">
        <p className="font-serif" style={{color: 'var(--parchment-dim)'}}>No new class features are gained at this level.</p>
      </div>
    )
  }
  
  return (
    <div>
      <h3 className="font-fantasy text-xl mb-4 text-glow-gold">New Features Gained</h3>
      <div className="space-y-3">
        {newFeatures.map((feature, i) => (
          <div key={i} className="p-4 rounded-xl fantasy-card flex items-start gap-3">
            <Award className="w-5 h-5 text-yellow-400 mt-1" />
            <div>
              <h4 className="font-fantasy font-bold">{feature}</h4>
              {/* Future: Add feature descriptions here */}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
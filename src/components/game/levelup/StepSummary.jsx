import React from 'react';
import { CheckSquare } from 'lucide-react';

export default function StepSummary({ workflowState, character }) {
  const { hpRoll, selectedSubclass, asiChoice, statIncreases, selectedFeat, spellSelection } = workflowState;

  return (
    <div>
      <h3 className="font-fantasy text-xl mb-4 text-glow-gold">Review Your Choices</h3>
      <div className="space-y-3 font-serif text-sm" style={{ color: 'var(--parchment)' }}>
        <div className="flex items-center gap-2 p-3 rounded-lg glass-panel-light">
          <CheckSquare className="w-4 h-4 text-green-400" />
          <span>HP Increase: <strong>+{hpRoll}</strong> + CON modifier</span>
        </div>
        {selectedSubclass && (
          <div className="flex items-center gap-2 p-3 rounded-lg glass-panel-light">
            <CheckSquare className="w-4 h-4 text-green-400" />
            <span>New Subclass: <strong>{selectedSubclass}</strong></span>
          </div>
        )}
        {asiChoice === 'stats' && statIncreases.first && (
          <div className="flex items-center gap-2 p-3 rounded-lg glass-panel-light">
            <CheckSquare className="w-4 h-4 text-green-400" />
            <span>Ability Scores: <strong>+{1} {statIncreases.first.toUpperCase()}</strong>, <strong>+{1} {statIncreases.second.toUpperCase()}</strong></span>
          </div>
        )}
        {asiChoice === 'feat' && selectedFeat && (
          <div className="flex items-center gap-2 p-3 rounded-lg glass-panel-light">
            <CheckSquare className="w-4 h-4 text-green-400" />
            <span>New Feat: <strong>{selectedFeat}</strong></span>
          </div>
        )}
        {spellSelection.cantrips.length > 0 && (
          <div className="flex items-center gap-2 p-3 rounded-lg glass-panel-light">
            <CheckSquare className="w-4 h-4 text-green-400" />
            <span>New Cantrips: <strong>{spellSelection.cantrips.join(', ')}</strong></span>
          </div>
        )}
        {spellSelection.spells.length > 0 && (
          <div className="flex items-center gap-2 p-3 rounded-lg glass-panel-light">
            <CheckSquare className="w-4 h-4 text-green-400" />
            <span>New Spells: <strong>{spellSelection.spells.join(', ')}</strong></span>
          </div>
        )}
      </div>
    </div>
  );
}
import React from 'react';
import { BookOpen } from 'lucide-react';
import React from 'react';
import { BookOpen } from 'lucide-react';
import SpellSelectionStep from '../SpellSelectionStep';
import { CLASSES } from '../../gameData'; // Reusing the spell selection logic // Reusing the spell selection logic

export default function StepSpells({ character, workflowState, setWorkflowState }) {
  const { receivingClass } = workflowState;
  const classData = CLASSES[receivingClass] || {};
  const SPELLCASTING_CLASSES = ['Wizard','Sorcerer','Warlock','Bard','Cleric','Druid','Paladin','Ranger','Artificer'];
  const isCaster = SPELLCASTING_CLASSES.includes(receivingClass);

  if (!isCaster) {
    return (
      <div className="text-center py-10">
        <p className="font-serif" style={{color: 'var(--parchment-dim)'}}>This class does not learn new spells at this level.</p>
      </div>
    )
  }

  return (
    <div>
      <h3 className="font-fantasy text-xl mb-4 text-glow-gold">Learn New Spells</h3>
      <SpellSelectionStep 
        character={character} 
        newLevel={workflowState.newTotalLevel} 
        selection={workflowState.spellSelection} 
        onChange={(selection) => setWorkflowState(p => ({ ...p, spellSelection: selection }))} 
      />
    </div>
  );
}
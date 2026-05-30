import React from 'react';
import { Heart, Dices } from 'lucide-react';
import { motion } from 'framer-motion';
import { CLASSES, calcStatMod } from '../../gameData';

export default function StepHP({ character, workflowState, setWorkflowState }) {
  const { receivingClass, hpRoll } = workflowState;
  const classData = CLASSES[receivingClass] || {};
  const hitDie = classData.hit_die || 8;
  const conMod = calcStatMod(character.constitution || 10);

  const rollHP = () => {
    const roll = Math.floor(Math.random() * hitDie) + 1;
    setWorkflowState(prev => ({ ...prev, hpRoll: roll }));
  };

  const takeAverage = () => {
    const avg = Math.floor(hitDie / 2) + 1;
    setWorkflowState(prev => ({ ...prev, hpRoll: avg }));
  };

  return (
    <div>
      <h3 className="font-fantasy text-xl mb-4 text-glow-gold">Increase Hit Points</h3>
      <p className="text-sm mb-4 font-serif" style={{ color: 'var(--parchment-dim)' }}>
        Roll a <strong>1d{hitDie}</strong> (your {receivingClass} hit die) and add your Constitution modifier ({conMod}) to increase your maximum HP.
      </p>

      {hpRoll === null ? (
        <div className="flex gap-4">
          <button onClick={rollHP} className="flex-1 py-4 rounded-xl btn-fantasy flex items-center justify-center gap-3">
            <Dices className="w-5 h-5" />
            Roll 1d{hitDie}
          </button>
          <button onClick={takeAverage} className="flex-1 py-4 rounded-xl btn-fantasy">
            Take Average ({Math.floor(hitDie / 2) + 1})
          </button>
        </div>
      ) : (
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-center py-6 glass-panel-light rounded-xl">
          <div className="text-5xl font-fantasy font-bold text-glow-gold mb-2">
            +{hpRoll + conMod} HP
          </div>
          <p className="text-sm font-serif" style={{ color: 'var(--parchment-dim)' }}>
            (Rolled {hpRoll} + {conMod} CON)
          </p>
        </motion.div>
      )}
    </div>
  );
}
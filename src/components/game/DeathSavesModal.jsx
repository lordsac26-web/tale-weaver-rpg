import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Skull, Heart, Dices, AlertTriangle } from 'lucide-react';
import { base44 } from '@/api/base44Client';

export default function DeathSavesModal({ character, onStabilize, onDeath, onClose }) {
  const [rolling, setRolling] = useState(false);
  const [lastRoll, setLastRoll] = useState(null);

  const successes = character.death_saves_success || 0;
  const failures = character.death_saves_failure || 0;

  const rollDeathSave = async () => {
    setRolling(true);
    setLastRoll(null);

    // Animate roll
    await new Promise(resolve => setTimeout(resolve, 600));

    const roll = Math.floor(Math.random() * 20) + 1;
    setLastRoll(roll);
    setRolling(false);

    let newSuccesses = successes;
    let newFailures = failures;

    if (roll === 1) {
      // Natural 1 = 2 failures
      newFailures = Math.min(3, failures + 2);
    } else if (roll === 20) {
      // Natural 20 = stabilize and regain 1 HP
      await base44.entities.Character.update(character.id, {
        hp_current: 1,
        death_saves_success: 0,
        death_saves_failure: 0,
      });
      onStabilize(roll);
      return;
    } else if (roll >= 10) {
      // Success
      newSuccesses = Math.min(3, successes + 1);
    } else {
      // Failure
      newFailures = Math.min(3, failures + 1);
    }

    // Update character
    await base44.entities.Character.update(character.id, {
      death_saves_success: newSuccesses,
      death_saves_failure: newFailures,
    });

    // Check for death or stabilization
    if (newFailures >= 3) {
      onDeath();
    } else if (newSuccesses >= 3) {
      // Stabilized but still at 0 HP
      await base44.entities.Character.update(character.id, {
        death_saves_success: 0,
        death_saves_failure: 0,
      });
      onStabilize(roll);
    } else {
      // Neither death nor stabilization - need to wait for next roll
      // Force a small delay to ensure DB write completes, then close modal
      // so the Game page can reload state and continue enemy turns
      await new Promise(resolve => setTimeout(resolve, 800));
      onClose();
    }
  };

  const isSuccess = lastRoll && lastRoll >= 10;
  const isCrit = lastRoll === 20;
  const isFumble = lastRoll === 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.95)', backdropFilter: 'blur(8px)' }}>
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 30 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="w-full max-w-md rounded-2xl p-6 rune-border"
        style={{
          background: 'linear-gradient(160deg, rgba(40,8,8,0.98), rgba(20,4,4,0.99))',
          border: '2px solid rgba(200,60,40,0.5)',
          boxShadow: '0 0 60px rgba(0,0,0,0.9), 0 0 30px rgba(200,60,40,0.2)',
        }}>
        
        {/* Skull Header */}
        <div className="text-center mb-6">
          <motion.div
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ repeat: Infinity, duration: 2 }}>
            <Skull className="w-16 h-16 mx-auto mb-3" style={{ color: '#dc2626' }} />
          </motion.div>
          <h2 className="font-fantasy-deco font-bold text-2xl text-glow-blood mb-2" style={{ color: '#fca5a5' }}>
            Death's Door
          </h2>
          <p className="text-sm" style={{ color: 'rgba(252,165,165,0.6)', fontFamily: 'EB Garamond, serif' }}>
            {character.name} hovers between life and death...
          </p>
        </div>

        {/* Death Saves Tracker */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          {/* Successes */}
          <div className="rounded-xl p-3" style={{ background: 'rgba(8,40,20,0.4)', border: '1px solid rgba(40,170,80,0.3)' }}>
            <div className="flex items-center gap-2 mb-2">
              <Heart className="w-4 h-4" style={{ color: '#86efac' }} />
              <span className="text-xs font-fantasy" style={{ color: '#86efac' }}>Successes</span>
            </div>
            <div className="flex gap-1">
              {[0, 1, 2].map(i => (
                <div key={i} className="flex-1 h-3 rounded-full"
                  style={{ background: i < successes ? '#22c55e' : 'rgba(20,10,5,0.6)', border: '1px solid rgba(40,170,80,0.3)' }} />
              ))}
            </div>
          </div>

          {/* Failures */}
          <div className="rounded-xl p-3" style={{ background: 'rgba(40,8,8,0.4)', border: '1px solid rgba(200,60,40,0.4)' }}>
            <div className="flex items-center gap-2 mb-2">
              <Skull className="w-4 h-4" style={{ color: '#fca5a5' }} />
              <span className="text-xs font-fantasy" style={{ color: '#fca5a5' }}>Failures</span>
            </div>
            <div className="flex gap-1">
              {[0, 1, 2].map(i => (
                <div key={i} className="flex-1 h-3 rounded-full"
                  style={{ background: i < failures ? '#dc2626' : 'rgba(20,10,5,0.6)', border: '1px solid rgba(200,60,40,0.4)' }} />
              ))}
            </div>
          </div>
        </div>

        {/* Last Roll Result */}
        <AnimatePresence>
          {lastRoll && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="rounded-xl p-4 mb-4 text-center"
              style={{
                background: isCrit ? 'rgba(40,170,80,0.3)' : isFumble ? 'rgba(120,20,10,0.4)' : isSuccess ? 'rgba(30,100,50,0.3)' : 'rgba(80,20,10,0.3)',
                border: `1px solid ${isCrit ? '#86efac' : isFumble ? '#dc2626' : isSuccess ? '#22c55e' : '#fca5a5'}`,
              }}>
              <div className="text-4xl font-fantasy font-bold mb-1" style={{ color: isSuccess ? '#86efac' : '#fca5a5' }}>
                {lastRoll}
              </div>
              <div className="text-sm font-fantasy" style={{ color: isSuccess ? '#86efac' : '#fca5a5' }}>
                {isCrit && '💚 Natural 20! You regain 1 HP and stabilize!'}
                {isFumble && '💀 Natural 1! Two failures!'}
                {!isCrit && !isFumble && isSuccess && '✓ Success'}
                {!isCrit && !isFumble && !isSuccess && '✗ Failure'}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Roll Button */}
        <button
          onClick={rollDeathSave}
          disabled={rolling || successes >= 3 || failures >= 3}
          className="w-full py-3 rounded-xl btn-combat font-fantasy font-bold text-base flex items-center justify-center gap-2 disabled:opacity-50">
          {rolling ? (
            <>
              <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.6, ease: 'linear' }}>
                <Dices className="w-5 h-5" />
              </motion.div>
              Rolling...
            </>
          ) : (
            <>
              <Dices className="w-5 h-5" />
              Roll Death Save
            </>
          )}
        </button>

        {/* Rules Reminder */}
        <div className="mt-4 rounded-xl p-3" style={{ background: 'rgba(8,5,2,0.7)', border: '1px solid rgba(180,140,90,0.15)' }}>
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: 'rgba(251,191,36,0.6)' }} />
            <div className="text-xs space-y-1" style={{ color: 'rgba(201,169,110,0.6)', fontFamily: 'EB Garamond, serif', lineHeight: '1.4' }}>
              <p><strong>10+:</strong> Success</p>
              <p><strong>1-9:</strong> Failure</p>
              <p><strong>Natural 20:</strong> Stabilize + regain 1 HP</p>
              <p><strong>Natural 1:</strong> Counts as 2 failures</p>
              <p>3 successes = Stabilized (0 HP, unconscious)</p>
              <p>3 failures = Death</p>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
/**
 * DeathSavesModal — D&D 5e Death Saving Throws
 *
 * Rules (PHB p.197):
 *  - At the start of each of your turns while at 0 HP, roll a d20.
 *  - 10 or higher = success. Below 10 = failure.
 *  - Natural 20 = regain 1 HP and stand up immediately.
 *  - Natural 1 = counts as TWO failures.
 *  - 3 successes = stabilised (unconscious but no longer dying).
 *  - 3 failures = character dies.
 *  - Taking damage while at 0 HP = 1 failure (critical hit = 2 failures).
 *
 * Backend note:
 *  The combatEngine function needs to send { player_at_zero_hp: true } instead
 *  of { player_dead: true } when the player reaches 0 HP. The actual death /
 *  stabilisation should be controlled by this client-side tracker, which then
 *  calls back to Game.jsx via onStabilise / onDeath.
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, Skull, Sparkles } from 'lucide-react';

const DC = 10;

export default function DeathSavesModal({ character, onStabilise, onDeath, onMiracle }) {
  const [successes, setSuccesses]   = useState(character?.death_saves_success  || 0);
  const [failures,  setFailures]    = useState(character?.death_saves_failure   || 0);
  const [lastRoll,  setLastRoll]    = useState(null);   // { roll, isNat20, isNat1, success }
  const [rolling,   setRolling]     = useState(false);
  const [resolved,  setResolved]    = useState(false);  // true once 3 successes or 3 failures

  const roll = () => {
    if (rolling || resolved) return;
    setRolling(true);

    setTimeout(() => {
      const d20     = Math.floor(Math.random() * 20) + 1;
      const isNat20 = d20 === 20;
      const isNat1  = d20 === 1;
      const success = d20 >= DC;

      setLastRoll({ roll: d20, isNat20, isNat1, success });
      setRolling(false);

      if (isNat20) {
        // Natural 20: immediately regain 1 HP
        setResolved(true);
        setTimeout(() => onMiracle?.(), 1800);
        return;
      }

      let newSuccesses = successes;
      let newFailures  = failures;

      if (isNat1) {
        // Natural 1 counts as 2 failures
        newFailures = Math.min(3, failures + 2);
      } else if (success) {
        newSuccesses = Math.min(3, successes + 1);
      } else {
        newFailures = Math.min(3, failures + 1);
      }

      setSuccesses(newSuccesses);
      setFailures(newFailures);

      if (newSuccesses >= 3) {
        setResolved(true);
        setTimeout(() => onStabilise?.({ death_saves_success: 0, death_saves_failure: 0 }), 1500);
      } else if (newFailures >= 3) {
        setResolved(true);
        setTimeout(() => onDeath?.(), 1500);
      }
    }, 600);
  };

  const dotColor = (filled, type) =>
    filled
      ? type === 'success' ? '#86efac' : '#fca5a5'
      : 'rgba(40,30,20,0.7)';

  const dotBorder = (filled, type) =>
    filled
      ? type === 'success' ? 'rgba(40,160,80,0.6)' : 'rgba(180,30,30,0.6)'
      : 'rgba(100,80,50,0.2)';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(4px)' }}>

      <motion.div
        initial={{ scale: 0.85, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        className="w-full max-w-sm rounded-2xl overflow-hidden"
        style={{
          background: 'linear-gradient(160deg, rgba(20,8,8,0.99), rgba(10,4,4,0.99))',
          border: '1px solid rgba(180,30,30,0.5)',
          boxShadow: '0 0 60px rgba(180,30,30,0.25)',
        }}>

        {/* Header */}
        <div className="px-6 pt-6 pb-4 text-center"
          style={{ borderBottom: '1px solid rgba(180,30,30,0.2)' }}>
          <motion.div
            animate={{ scale: [1, 1.06, 1] }}
            transition={{ repeat: Infinity, duration: 2.5, ease: 'easeInOut' }}
            className="w-16 h-16 mx-auto mb-3 rounded-full flex items-center justify-center"
            style={{ background: 'radial-gradient(circle, rgba(80,5,5,0.5), transparent)', boxShadow: '0 0 30px rgba(180,30,30,0.2)' }}>
            <Heart className="w-9 h-9" style={{ color: '#dc2626' }} />
          </motion.div>
          <h2 className="font-fantasy font-bold text-xl" style={{ color: '#fca5a5' }}>
            Dying — Death Saving Throws
          </h2>
          <p className="text-xs mt-1" style={{ color: 'rgba(232,213,183,0.55)', fontFamily: 'EB Garamond, serif' }}>
            {character?.name} is at 0 HP. Roll at the start of each turn.
            3 successes = stabilised. 3 failures = death. Nat 20 = regain 1 HP.
          </p>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Successes / Failures tracker */}
          <div className="grid grid-cols-2 gap-4">
            {/* Successes */}
            <div className="text-center">
              <div className="text-xs font-fantasy tracking-widest mb-2" style={{ color: '#86efac', opacity: 0.7 }}>
                SUCCESSES
              </div>
              <div className="flex justify-center gap-2">
                {[0,1,2].map(i => (
                  <motion.div
                    key={i}
                    animate={i < successes ? { scale: [1, 1.3, 1], boxShadow: ['0 0 4px #86efac55', '0 0 14px #86efacaa', '0 0 6px #86efac55'] } : {}}
                    transition={{ duration: 0.4 }}
                    className="w-5 h-5 rounded-full"
                    style={{
                      background: dotColor(i < successes, 'success'),
                      border: `1px solid ${dotBorder(i < successes, 'success')}`,
                    }} />
                ))}
              </div>
            </div>

            {/* Failures */}
            <div className="text-center">
              <div className="text-xs font-fantasy tracking-widest mb-2" style={{ color: '#fca5a5', opacity: 0.7 }}>
                FAILURES
              </div>
              <div className="flex justify-center gap-2">
                {[0,1,2].map(i => (
                  <motion.div
                    key={i}
                    animate={i < failures ? { scale: [1, 1.3, 1], boxShadow: ['0 0 4px #fca5a555', '0 0 14px #fca5a5aa', '0 0 6px #fca5a555'] } : {}}
                    transition={{ duration: 0.4 }}
                    className="w-5 h-5 rounded-full"
                    style={{
                      background: dotColor(i < failures, 'failure'),
                      border: `1px solid ${dotBorder(i < failures, 'failure')}`,
                    }} />
                ))}
              </div>
            </div>
          </div>

          {/* Last roll result */}
          <AnimatePresence mode="wait">
            {lastRoll && (
              <motion.div
                key={lastRoll.roll}
                initial={{ scale: 0.7, opacity: 0, y: 8 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                className="text-center py-3 rounded-xl"
                style={{
                  background: lastRoll.isNat20
                    ? 'rgba(60,40,5,0.7)'
                    : lastRoll.success
                    ? 'rgba(10,40,15,0.7)'
                    : 'rgba(40,5,5,0.7)',
                  border: `1px solid ${lastRoll.isNat20 ? 'rgba(240,192,64,0.5)' : lastRoll.success ? 'rgba(40,160,80,0.45)' : 'rgba(180,30,30,0.45)'}`,
                }}>
                <div className="text-3xl font-fantasy font-bold"
                  style={{ color: lastRoll.isNat20 ? '#f0c040' : lastRoll.success ? '#86efac' : '#fca5a5' }}>
                  {lastRoll.roll}
                </div>
                <div className="text-xs mt-1 font-fantasy"
                  style={{ color: lastRoll.isNat20 ? '#fde68a' : lastRoll.success ? '#86efac' : '#fca5a5', opacity: 0.8 }}>
                  {lastRoll.isNat20
                    ? '✨ Natural 20 — You regain 1 HP!'
                    : lastRoll.isNat1
                    ? '💀 Natural 1 — Two failures!'
                    : lastRoll.success
                    ? `Success (≥${DC})`
                    : `Failure (<${DC})`}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Roll button or resolution */}
          {!resolved ? (
            <motion.button
              onClick={roll}
              disabled={rolling}
              whileTap={{ scale: 0.97 }}
              className="w-full py-3.5 rounded-xl font-fantasy font-bold text-sm flex items-center justify-center gap-2 transition-all"
              style={rolling ? {
                background: 'rgba(20,10,10,0.6)',
                border: '1px solid rgba(100,50,50,0.3)',
                color: 'rgba(150,80,80,0.4)',
                cursor: 'not-allowed',
              } : {
                background: 'linear-gradient(135deg, rgba(100,10,10,0.9), rgba(70,5,5,0.95))',
                border: '1px solid rgba(220,50,50,0.6)',
                color: '#fca5a5',
                boxShadow: '0 0 12px rgba(180,30,30,0.2)',
              }}>
              {rolling
                ? <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.6, ease: 'linear' }}
                    className="w-4 h-4 rounded-full border-2 border-t-transparent" style={{ borderColor: 'rgba(180,80,80,0.4)', borderTopColor: 'transparent' }} />
                : '🎲'}
              {rolling ? 'Rolling...' : 'Roll Death Save (d20)'}
            </motion.button>
          ) : (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center py-3 rounded-xl font-fantasy"
              style={successes >= 3
                ? { background: 'rgba(10,40,15,0.7)', border: '1px solid rgba(40,160,80,0.4)', color: '#86efac' }
                : { background: 'rgba(40,5,5,0.7)', border: '1px solid rgba(180,30,30,0.4)', color: '#fca5a5' }}>
              {successes >= 3 ? (
                <><Heart className="w-5 h-5 inline mr-2" />Stabilised — unconscious but no longer dying</>
              ) : (
                <><Skull className="w-5 h-5 inline mr-2" />Three failures — the end draws near...</>
              )}
            </motion.div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

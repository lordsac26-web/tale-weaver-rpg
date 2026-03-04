import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Dices } from 'lucide-react';

const DICE = [4, 6, 8, 10, 12, 20];

function rollDice(sides, count = 1) {
  return Array.from({ length: count }, () => Math.floor(Math.random() * sides) + 1);
}

export default function CombatDiceRoller({ modifier = 0, label = 'Roll Dice' }) {
  const [result, setResult] = useState(null);
  const [rolling, setRolling] = useState(false);
  const [selectedSides, setSelectedSides] = useState(20);

  const doRoll = useCallback(() => {
    setRolling(true);
    setTimeout(() => {
      const rolls = rollDice(selectedSides, 1);
      const total = rolls[0] + modifier;
      const isCrit = selectedSides === 20 && rolls[0] === 20;
      const isFail = selectedSides === 20 && rolls[0] === 1;
      setResult({ rolls, total, isCrit, isFail });
      setRolling(false);
    }, 380);
  }, [selectedSides, modifier]);

  return (
    <div className="rounded-xl p-3 space-y-2"
      style={{ background: 'rgba(10,5,3,0.8)', border: '1px solid rgba(201,169,110,0.15)' }}>
      <div className="font-fantasy text-xs tracking-widest" style={{ color: 'rgba(201,169,110,0.45)', fontSize: '0.62rem' }}>
        {label.toUpperCase()}
      </div>
      {/* Dice picker */}
      <div className="flex gap-1.5 flex-wrap">
        {DICE.map(d => (
          <button key={d} onClick={() => setSelectedSides(d)}
            className="px-2.5 py-1 rounded-lg text-xs font-fantasy transition-all"
            style={selectedSides === d ? {
              background: 'rgba(100,65,15,0.7)', border: '1px solid rgba(201,169,110,0.55)', color: '#f0c040',
              boxShadow: '0 0 8px rgba(201,169,110,0.15)'
            } : {
              background: 'rgba(15,10,5,0.6)', border: '1px solid rgba(180,140,90,0.15)', color: 'rgba(180,140,90,0.4)'
            }}>
            d{d}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <button onClick={doRoll} disabled={rolling}
          className="flex-1 py-2 rounded-lg font-fantasy text-xs flex items-center justify-center gap-1.5 transition-all disabled:opacity-50"
          style={{ background: 'rgba(60,40,8,0.8)', border: '1px solid rgba(201,169,110,0.35)', color: '#c9a96e' }}>
          {rolling
            ? <span className="dice-rolling inline-block">🎲</span>
            : <Dices className="w-3.5 h-3.5" />}
          {rolling ? 'Rolling...' : `Roll d${selectedSides}${modifier !== 0 ? (modifier > 0 ? `+${modifier}` : modifier) : ''}`}
        </button>
        <AnimatePresence mode="wait">
          {result && (
            <motion.div key={result.total + result.rolls[0]}
              initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ opacity: 0 }}
              className="text-center px-3 py-1.5 rounded-lg font-fantasy font-bold text-lg min-w-[3rem]"
              style={{
                background: result.isCrit ? 'rgba(100,80,5,0.7)' : result.isFail ? 'rgba(80,5,5,0.7)' : 'rgba(20,13,5,0.7)',
                border: `1px solid ${result.isCrit ? 'rgba(240,192,64,0.6)' : result.isFail ? 'rgba(220,50,50,0.5)' : 'rgba(180,140,90,0.2)'}`,
                color: result.isCrit ? '#f0c040' : result.isFail ? '#fca5a5' : '#e8d5b7',
                textShadow: result.isCrit ? '0 0 16px rgba(240,192,64,0.6)' : result.isFail ? '0 0 12px rgba(220,50,50,0.5)' : 'none',
              }}>
              {result.total}
              {result.isCrit && <div className="text-xs font-fantasy" style={{ color: '#f0c040', fontSize: '0.55rem', letterSpacing: '0.1em' }}>CRIT!</div>}
              {result.isFail && <div className="text-xs font-fantasy" style={{ color: '#fca5a5', fontSize: '0.55rem' }}>FAIL</div>}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
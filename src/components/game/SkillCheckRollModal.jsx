import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Dices, X } from 'lucide-react';
import { rollD20WithAdvantage, resolveCheckSuccess } from './equipmentAdvantage';

/**
 * SkillCheckRollModal — manual dice-roll prompt for a skill check.
 *
 * Pre-configured with the correct skill, modifier, DC, and any
 * advantage/disadvantage from equipment. The player presses Roll, the d20
 * animates, then the resolved result (with success/failure vs the DC) is
 * passed back to the parent via onResolve so the story flow can continue.
 *
 * Props:
 *  - skill: string (e.g. "Persuasion")
 *  - modifier: number (skill modifier to add)
 *  - dc: number (difficulty class)
 *  - advantage / disadvantage: booleans
 *  - advantageSources: string[] (labels explaining adv/disadv)
 *  - onResolve(rollData): called with { raw, allRolls, hadAdvantage, hadDisadvantage, modifier, final, success }
 *  - onCancel(): close without rolling
 */
export default function SkillCheckRollModal({
  skill,
  modifier = 0,
  dc,
  advantage = false,
  disadvantage = false,
  advantageSources = [],
  onResolve,
  onCancel,
}) {
  const [rolling, setRolling] = useState(false);
  const [result, setResult] = useState(null);

  const doRoll = () => {
    setRolling(true);
    setTimeout(() => {
      const { roll: raw, allRolls, hadAdvantage, hadDisadvantage } = rollD20WithAdvantage(advantage, disadvantage);
      const final = raw + modifier;
      // Nat 20 always succeeds, nat 1 always fails
      const success = resolveCheckSuccess(raw, final, dc);
      const data = { raw, allRolls, hadAdvantage, hadDisadvantage, advantageSources, modifier, final, success };
      setResult(data);
      setRolling(false);
    }, 600);
  };

  const modLabel = modifier >= 0 ? `+${modifier}` : `${modifier}`;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(6px)' }}>
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="w-full max-w-sm rounded-2xl overflow-hidden"
        style={{ background: 'rgba(14,9,4,0.98)', border: '1px solid rgba(201,169,110,0.35)', boxShadow: '0 0 50px rgba(0,0,0,0.8)' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3"
          style={{ background: 'linear-gradient(90deg, rgba(60,40,8,0.5), rgba(20,13,4,0.4))', borderBottom: '1px solid rgba(180,140,90,0.15)' }}>
          <div className="flex items-center gap-2">
            <Dices className="w-4 h-4" style={{ color: '#f0c040' }} />
            <span className="font-fantasy font-bold text-sm" style={{ color: '#f0c040' }}>{skill} Check</span>
          </div>
          {!result && (
            <button onClick={onCancel} className="p-1 rounded-lg" style={{ color: 'rgba(201,169,110,0.5)' }}>
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="p-5 space-y-4">
          {/* Check summary */}
          <div className="flex items-center justify-center gap-3 text-sm font-fantasy" style={{ color: 'rgba(232,213,183,0.85)' }}>
            <span>d20 {modLabel}</span>
            <span style={{ color: 'rgba(201,169,110,0.4)' }}>vs</span>
            <span style={{ color: '#fca5a5' }}>DC {dc}</span>
          </div>

          {(advantage || disadvantage) && (
            <div className="text-center text-xs font-fantasy"
              style={{ color: advantage ? '#86efac' : '#fca5a5' }}>
              {advantage ? '⬆ Advantage' : '⬇ Disadvantage'}
              {advantageSources.length > 0 && (
                <span style={{ color: 'rgba(201,169,110,0.4)' }}> · {advantageSources.join(', ')}</span>
              )}
            </div>
          )}

          {/* Roll button / result */}
          {!result ? (
            <button onClick={doRoll} disabled={rolling}
              className="w-full py-3 rounded-xl font-fantasy font-bold text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-60"
              style={{ background: 'linear-gradient(135deg, rgba(100,65,15,0.9), rgba(70,45,10,0.95))', border: '1px solid rgba(201,169,110,0.5)', color: '#f0c040' }}>
              {rolling
                ? <span className="dice-rolling inline-block text-lg">🎲</span>
                : <Dices className="w-4 h-4" />}
              {rolling ? 'Rolling...' : 'Roll the Dice'}
            </button>
          ) : (
            <div className="space-y-3">
              {/* Result display */}
              <div className="text-center">
                <div className="font-fantasy font-bold text-4xl"
                  style={{
                    color: result.success ? '#86efac' : '#fca5a5',
                    textShadow: result.success ? '0 0 20px rgba(40,160,80,0.5)' : '0 0 20px rgba(180,30,30,0.5)',
                  }}>
                  {result.final}
                </div>
                <div className="text-xs font-fantasy mt-1" style={{ color: 'rgba(201,169,110,0.6)' }}>
                  rolled {result.raw}
                  {result.hadAdvantage || result.hadDisadvantage
                    ? ` (${result.allRolls.join(', ')})` : ''} {modLabel}
                </div>
                <div className="font-fantasy font-bold text-sm mt-2 tracking-widest uppercase"
                  style={{ color: result.success ? '#86efac' : '#fca5a5' }}>
                  {result.raw === 20 ? '✦ Natural 20!' : result.raw === 1 ? '✦ Natural 1!' : result.success ? 'Success' : 'Failure'} vs DC {dc}
                </div>
              </div>
              <button onClick={() => onResolve(result)}
                className="w-full py-2.5 rounded-xl font-fantasy text-sm btn-fantasy">
                Continue
              </button>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
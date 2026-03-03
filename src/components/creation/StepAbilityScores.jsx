import React, { useState } from 'react';
import { Dice6, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { calcStatMod, calcModDisplay, roll4d6DropLowest, CLASSES, RACES } from '@/components/game/gameData';

const STATS = ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'];
const STAT_LABELS = { strength: 'STR', dexterity: 'DEX', constitution: 'CON', intelligence: 'INT', wisdom: 'WIS', charisma: 'CHA' };
const STAT_DESC = { strength: 'Melee attacks & athletics', dexterity: 'Stealth, ranged & AC', constitution: 'HP & concentration', intelligence: 'Arcane magic & lore', wisdom: 'Divine magic & perception', charisma: 'Social & pact magic' };

// Standard point buy cost table
const COST = { 8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9 };
const POINT_BUY_BUDGET = 27;

// Standard array
const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8];

export default function StepAbilityScores({ character, set }) {
  const [method, setMethod] = useState('roll');
  const [rollHistory, setRollHistory] = useState({});
  const [standardAssigned, setStandardAssigned] = useState({});
  const [rerollCounts, setRerollCounts] = useState({});

  const pointsSpent = STATS.reduce((total, s) => total + (COST[character[s]] || 0), 0);
  const pointsLeft = POINT_BUY_BUDGET - pointsSpent;

  const handleRollAll = () => {
    const newHistory = {};
    STATS.forEach(stat => {
      const val = roll4d6DropLowest();
      set(stat, val);
      newHistory[stat] = val;
    });
    setRollHistory(newHistory);
  };

  const handleRollSingle = (stat) => {
    const val = roll4d6DropLowest();
    set(stat, val);
    setRollHistory(prev => ({ ...prev, [stat]: val }));
  };

  const handlePointBuyAdjust = (stat, delta) => {
    const newVal = character[stat] + delta;
    if (newVal < 8 || newVal > 15) return;
    const newCost = COST[newVal] || 0;
    const oldCost = COST[character[stat]] || 0;
    const diff = newCost - oldCost;
    if (diff > 0 && pointsLeft < diff) return;
    set(stat, newVal);
  };

  const unassignedStdValues = STANDARD_ARRAY.filter((_, i) =>
    !Object.values(standardAssigned).includes(i)
  );

  const assignStandard = (stat, idx) => {
    const newAssigned = { ...standardAssigned, [stat]: idx };
    setStandardAssigned(newAssigned);
    set(stat, STANDARD_ARRAY[idx]);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-amber-300 mb-1">Ability Scores</h2>
        <p className="text-amber-400/50 text-sm">Your six core abilities define your strengths and weaknesses.</p>
      </div>

      {/* Method tabs */}
      <div className="flex gap-2 flex-wrap">
        {[['roll', '🎲 Roll 4d6'], ['pointbuy', '📊 Point Buy'], ['standard', '📋 Standard Array'], ['manual', '✏️ Manual']].map(([m, label]) => (
          <button key={m}
            onClick={() => {
              setMethod(m);
              if (m === 'pointbuy') {
                STATS.forEach(s => set(s, 8));
              } else if (m === 'standard') {
                setStandardAssigned({});
                STATS.forEach(s => set(s, 8));
              }
            }}
            className={`px-4 py-2 rounded-lg text-sm border transition-all ${method === m ? 'border-amber-500 bg-amber-900/30 text-amber-200' : 'border-slate-700/50 text-slate-400 hover:border-amber-700/40'}`}>
            {label}
          </button>
        ))}
      </div>

      {method === 'roll' && (
        <Button onClick={handleRollAll} className="bg-amber-800/60 hover:bg-amber-700 border border-amber-600/50">
          <Dice6 className="w-4 h-4 mr-2" /> Roll All Stats
        </Button>
      )}

      {method === 'pointbuy' && (
        <div className="flex items-center gap-3 bg-slate-800/40 border border-slate-700/30 rounded-xl px-4 py-3">
          <span className="text-slate-400 text-sm">Points remaining:</span>
          <span className={`font-bold text-lg ${pointsLeft < 0 ? 'text-red-400' : pointsLeft === 0 ? 'text-green-400' : 'text-amber-300'}`}>{pointsLeft} / {POINT_BUY_BUDGET}</span>
        </div>
      )}

      {method === 'standard' && (
        <div className="flex items-center gap-3 bg-slate-800/40 border border-slate-700/30 rounded-xl px-4 py-3 flex-wrap">
          <span className="text-slate-400 text-sm">Remaining values:</span>
          {STANDARD_ARRAY.map((val, i) => (
            !Object.values(standardAssigned).includes(i) &&
            <span key={i} className="bg-amber-900/40 text-amber-300 font-bold px-3 py-1 rounded-lg">{val}</span>
          ))}
        </div>
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {STATS.map(stat => {
          const val = character[stat] || 10;
          const mod = calcStatMod(val);
          const raceBonuses = {};
          const raceBonus = raceBonuses[stat] || 0;
          const isClassPrimary = CLASSES[character.class]?.primary_stat === stat;

          return (
            <div key={stat} className={`bg-slate-800/60 border rounded-xl p-4 text-center relative ${isClassPrimary ? 'border-amber-600/60' : 'border-slate-700/50'}`}>
              {isClassPrimary && <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 text-xs bg-amber-700/80 text-amber-100 px-2 py-0.5 rounded-full">Primary</div>}
              <div className="text-slate-400 text-xs uppercase tracking-widest mb-0.5">{STAT_LABELS[stat]}</div>
              <div className="text-xs text-slate-600 mb-1 truncate">{STAT_DESC[stat]}</div>
              <div className="text-3xl font-bold text-amber-300 mb-1">{val}</div>
              <div className={`text-sm font-medium mb-2 ${mod >= 0 ? 'text-green-400' : 'text-red-400'}`}>{calcModDisplay(mod)}</div>

              {method === 'roll' && (
                <button onClick={() => handleRollSingle(stat)} className="w-full py-1 rounded-lg bg-slate-700/40 hover:bg-amber-900/20 border border-slate-600/40 text-xs text-slate-400 hover:text-amber-300 transition-all">
                  🎲 Reroll
                </button>
              )}

              {method === 'pointbuy' && (
                <div className="flex items-center justify-center gap-2">
                  <button onClick={() => handlePointBuyAdjust(stat, -1)} disabled={val <= 8}
                    className="w-6 h-6 rounded bg-slate-700 hover:bg-slate-600 text-amber-300 disabled:opacity-30 text-lg leading-none">−</button>
                  <button onClick={() => handlePointBuyAdjust(stat, 1)} disabled={val >= 15 || pointsLeft <= 0}
                    className="w-6 h-6 rounded bg-slate-700 hover:bg-slate-600 text-amber-300 disabled:opacity-30 text-lg leading-none">+</button>
                </div>
              )}

              {method === 'standard' && (
                <select value={standardAssigned[stat] !== undefined ? standardAssigned[stat] : ''}
                  onChange={e => assignStandard(stat, parseInt(e.target.value))}
                  className="w-full bg-slate-700/50 border border-slate-600 rounded text-xs text-amber-300 px-1 py-1 outline-none mt-1">
                  <option value="">-- assign --</option>
                  {STANDARD_ARRAY.map((v, i) => {
                    const alreadyUsed = Object.entries(standardAssigned).some(([s, idx]) => idx === i && s !== stat);
                    return !alreadyUsed ? <option key={i} value={i}>{v}</option> : null;
                  })}
                </select>
              )}

              {method === 'manual' && (
                <div className="flex items-center justify-center gap-2">
                  <button onClick={() => set(stat, Math.max(3, val - 1))} className="w-6 h-6 rounded bg-slate-700 hover:bg-slate-600 text-amber-300 text-lg leading-none">−</button>
                  <button onClick={() => set(stat, Math.min(20, val + 1))} className="w-6 h-6 rounded bg-slate-700 hover:bg-slate-600 text-amber-300 text-lg leading-none">+</button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Racial Bonus Preview */}
      {character.race && (
        <div className="text-xs text-slate-500 bg-slate-800/30 rounded-lg px-3 py-2">
          Racial bonuses applied on save: {Object.entries(CLASSES[character.class]?.primary_stat ? {} : {}).length === 0
            ? Object.entries(Object.fromEntries(STATS.map(s => [s, character.race === 'Human' ? 1 : s === 'dexterity' && character.race === 'Elf' ? 2 : 0]).filter(([,v]) => v > 0)))
                .map(([s, v]) => `${STAT_LABELS[s]} +${v}`).join(', ') || 'See race bonuses above'
            : 'See race bonuses above'}
        </div>
      )}
    </div>
  );
}
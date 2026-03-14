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
    setRerollCounts(prev => ({ ...prev, [stat]: (prev[stat] || 0) + 1 }));
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

  // Get racial bonuses including subrace
  const getRacialBonuses = () => {
    const race = RACES[character.race];
    if (!race) return {};
    
    let bonuses = { ...race.stat_bonuses };
    
    // Apply subrace bonuses
    if (character.subrace && race.subraces?.length > 0) {
      const subrace = race.subraces.find(s => s.name === character.subrace);
      if (subrace?.stat_bonuses) {
        Object.entries(subrace.stat_bonuses).forEach(([stat, val]) => {
          bonuses[stat] = (bonuses[stat] || 0) + val;
        });
      }
    }
    
    return bonuses;
  };
  
  const raceBonuses = getRacialBonuses();
  const totalPoints = STATS.reduce((t, s) => t + (COST[character[s]] || 0), 0);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold text-amber-300 mb-1">Ability Scores</h2>
        <p className="text-amber-400/50 text-sm">Choose a method to determine your six core abilities. Racial bonuses are shown separately and applied automatically.</p>
      </div>

      {/* Method selector */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[
          { id: 'roll', icon: '🎲', label: 'Roll 4d6', desc: 'Drop lowest' },
          { id: 'pointbuy', icon: '📊', label: 'Point Buy', desc: '27 pts to spend' },
          { id: 'standard', icon: '📋', label: 'Standard Array', desc: '15,14,13,12,10,8' },
          { id: 'manual', icon: '✏️', label: 'Manual', desc: 'Set freely' },
        ].map(({ id, icon, label, desc }) => (
          <button key={id}
            onClick={() => {
              setMethod(id);
              if (id === 'pointbuy') STATS.forEach(s => set(s, 8));
              else if (id === 'standard') { setStandardAssigned({}); STATS.forEach(s => set(s, 8)); }
            }}
            className={`p-3 rounded-xl border text-left transition-all ${method === id ? 'border-amber-500 bg-amber-900/20 text-amber-200' : 'border-slate-700/50 text-slate-400 hover:border-amber-700/50'}`}>
            <div className="text-lg mb-1">{icon}</div>
            <div className="text-sm font-medium">{label}</div>
            <div className="text-xs opacity-60">{desc}</div>
          </button>
        ))}
      </div>

      {/* Method-specific controls */}
      {method === 'roll' && (
        <Button onClick={handleRollAll} className="bg-amber-800/60 hover:bg-amber-700 border border-amber-600/50">
          <Dice6 className="w-4 h-4 mr-2" /> Roll All 6 Stats
        </Button>
      )}

      {method === 'pointbuy' && (
        <div className="flex items-center gap-4 bg-slate-800/40 border border-slate-700/30 rounded-xl px-4 py-3">
          <span className="text-slate-400 text-sm">Points remaining:</span>
          <span className={`font-bold text-xl ${pointsLeft < 0 ? 'text-red-400' : pointsLeft === 0 ? 'text-green-400' : 'text-amber-300'}`}>
            {pointsLeft} / {POINT_BUY_BUDGET}
          </span>
          <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all ${pointsLeft <= 0 ? 'bg-green-500' : 'bg-amber-500'}`}
              style={{ width: `${Math.min(100, ((POINT_BUY_BUDGET - pointsLeft) / POINT_BUY_BUDGET) * 100)}%` }} />
          </div>
          <button onClick={() => STATS.forEach(s => set(s, 8))} className="text-xs text-slate-500 hover:text-red-400 transition-colors flex items-center gap-1">
            <RefreshCw className="w-3 h-3" /> Reset
          </button>
        </div>
      )}

      {method === 'standard' && (
        <div className="flex items-center gap-3 bg-slate-800/40 border border-slate-700/30 rounded-xl px-4 py-3 flex-wrap">
          <span className="text-slate-400 text-sm">Unassigned:</span>
          {STANDARD_ARRAY.map((val, i) =>
            !Object.values(standardAssigned).includes(i) &&
            <span key={i} className="bg-amber-900/40 border border-amber-700/40 text-amber-300 font-bold px-3 py-1 rounded-lg text-sm">{val}</span>
          )}
          {Object.keys(standardAssigned).length === 6 && (
            <span className="text-green-400 text-xs ml-auto">✓ All assigned</span>
          )}
        </div>
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {STATS.map(stat => {
          const base = character[stat] || 10;
          const raceBonus = raceBonuses[stat] || 0;
          const finalVal = base + raceBonus;
          const mod = calcStatMod(finalVal);
          const isClassPrimary = CLASSES[character.class]?.primary_stat === stat;

          return (
            <div key={stat} className={`bg-slate-800/60 border rounded-xl p-3 text-center relative ${isClassPrimary ? 'border-amber-600/60' : raceBonus > 0 ? 'border-emerald-700/50' : 'border-slate-700/50'}`}>
              {isClassPrimary && (
                <div className="absolute -top-2 left-1/2 -translate-x-1/2 text-xs bg-amber-700 text-amber-100 px-2 py-0.5 rounded-full whitespace-nowrap">
                  Primary
                </div>
              )}
              <div className="text-slate-400 text-xs uppercase tracking-widest mb-0.5 mt-1">{STAT_LABELS[stat]}</div>
              <div className="text-xs text-slate-600 mb-1 leading-tight">{STAT_DESC[stat]}</div>

              {/* Score display */}
              <div className="flex items-center justify-center gap-1 mb-1">
                <span className="text-3xl font-bold text-amber-300">{base}</span>
                {raceBonus > 0 && (
                  <span className="text-sm text-emerald-400 font-bold">+{raceBonus}</span>
                )}
              </div>
              {raceBonus > 0 && (
                <div className="text-xs text-emerald-300/70 mb-1">= {finalVal} final</div>
              )}
              <div className={`text-sm font-bold mb-2 ${mod >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {calcModDisplay(mod)}
              </div>

              {/* Method controls */}
              {method === 'roll' && (
                <button onClick={() => handleRollSingle(stat)}
                  className="w-full py-1.5 rounded-lg bg-slate-700/40 hover:bg-amber-900/20 border border-slate-600/40 text-xs text-slate-400 hover:text-amber-300 transition-all flex items-center justify-center gap-1">
                  <Dice6 className="w-3 h-3" />
                  {rerollCounts[stat] ? `Reroll (${rerollCounts[stat]})` : 'Roll'}
                </button>
              )}

              {method === 'pointbuy' && (
                <div className="flex items-center justify-center gap-2">
                  <button onClick={() => handlePointBuyAdjust(stat, -1)} disabled={base <= 8}
                    className="w-7 h-7 rounded-lg bg-slate-700 hover:bg-slate-600 text-amber-300 disabled:opacity-30 font-bold">−</button>
                  <span className="text-xs text-slate-500">{COST[base] || 0}pt</span>
                  <button onClick={() => handlePointBuyAdjust(stat, 1)} disabled={base >= 15 || pointsLeft <= 0}
                    className="w-7 h-7 rounded-lg bg-slate-700 hover:bg-slate-600 text-amber-300 disabled:opacity-30 font-bold">+</button>
                </div>
              )}

              {method === 'standard' && (
                <select value={standardAssigned[stat] !== undefined ? standardAssigned[stat] : ''}
                  onChange={e => assignStandard(stat, parseInt(e.target.value))}
                  className="w-full bg-slate-700/50 border border-slate-600 rounded-lg text-xs text-amber-300 px-1 py-1.5 outline-none mt-1">
                  <option value="">-- assign --</option>
                  {STANDARD_ARRAY.map((v, i) => {
                    const alreadyUsed = Object.entries(standardAssigned).some(([s, idx]) => idx === i && s !== stat);
                    return !alreadyUsed ? <option key={i} value={i}>{v}</option> : null;
                  })}
                </select>
              )}

              {method === 'manual' && (
                <div className="flex items-center justify-center gap-2">
                  <button onClick={() => set(stat, Math.max(3, base - 1))}
                    className="w-7 h-7 rounded-lg bg-slate-700 hover:bg-slate-600 text-amber-300 font-bold">−</button>
                  <button onClick={() => set(stat, Math.min(20, base + 1))}
                    className="w-7 h-7 rounded-lg bg-slate-700 hover:bg-slate-600 text-amber-300 font-bold">+</button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Racial bonus legend */}
      {character.race && Object.keys(raceBonuses).length > 0 && (
        <div className="flex items-center gap-2 flex-wrap bg-emerald-900/10 border border-emerald-700/30 rounded-xl px-4 py-2.5">
          <span className="text-emerald-400/80 text-xs font-medium">{character.race} racial bonuses:</span>
          {Object.entries(raceBonuses).map(([s, v]) => v > 0 && (
            <span key={s} className="text-xs bg-emerald-900/30 border border-emerald-700/40 text-emerald-300 px-2 py-0.5 rounded-full">
              {STAT_LABELS[s]} +{v}
            </span>
          ))}
          <span className="text-slate-500 text-xs ml-auto italic">Applied automatically to final score</span>
        </div>
      )}
    </div>
  );
}
import React, { useState, useRef } from 'react';
import { Dices, ChevronDown, RotateCcw, TrendingUp, TrendingDown } from 'lucide-react';
import { calcStatMod, calcModDisplay, SKILL_STAT_MAP } from './gameData';

const DICE_OPTIONS = [4, 6, 8, 10, 12, 20, 100];

const ABILITY_CHECKS = [
  { label: 'Strength', key: 'strength_check', stat: 'strength' },
  { label: 'Dexterity', key: 'dexterity_check', stat: 'dexterity' },
  { label: 'Constitution', key: 'constitution_check', stat: 'constitution' },
  { label: 'Intelligence', key: 'intelligence_check', stat: 'intelligence' },
  { label: 'Wisdom', key: 'wisdom_check', stat: 'wisdom' },
  { label: 'Charisma', key: 'charisma_check', stat: 'charisma' },
];

const SAVING_THROWS = [
  { label: 'STR Save', key: 'strength_save', stat: 'strength' },
  { label: 'DEX Save', key: 'dexterity_save', stat: 'dexterity' },
  { label: 'CON Save', key: 'constitution_save', stat: 'constitution' },
  { label: 'INT Save', key: 'intelligence_save', stat: 'intelligence' },
  { label: 'WIS Save', key: 'wisdom_save', stat: 'wisdom' },
  { label: 'CHA Save', key: 'charisma_save', stat: 'charisma' },
];

const SKILLS = Object.entries(SKILL_STAT_MAP).map(([skill, stat]) => ({
  label: skill,
  key: skill.toLowerCase().replace(/ /g, '_'),
  stat
}));

function getDiceEmoji(sides) {
  const map = { 4: '🔺', 6: '⬡', 8: '🔷', 10: '🔹', 12: '🔻', 20: '🎲', 100: '💯' };
  return map[sides] || '🎲';
}

function rollDice(num, sides) {
  return Array.from({ length: num }, () => Math.floor(Math.random() * sides) + 1);
}

function computeModifier(character, rollKey) {
  if (!character) return 0;
  const statMod = (s) => calcStatMod(character[s] || 10);
  const profBonus = character.proficiency_bonus || 2;
  const skillProf = (key) => {
    const val = character.skills?.[key];
    return val === 'expert' ? profBonus * 2 : val === 'proficient' ? profBonus : 0;
  };

  // Ability checks
  const abilityCheck = ABILITY_CHECKS.find(a => a.key === rollKey);
  if (abilityCheck) return statMod(abilityCheck.stat);

  // Saving throws
  const save = SAVING_THROWS.find(s => s.key === rollKey);
  if (save) return statMod(save.stat) + (character.saving_throws?.[save.stat] ? profBonus : 0);

  // Skills
  const skill = SKILLS.find(s => s.key === rollKey);
  if (skill) return statMod(skill.stat) + skillProf(skill.key);

  // Attacks
  if (rollKey === 'attack_melee') return statMod('strength') + (character.equipped?.weapon?.attack_bonus || 0);
  if (rollKey === 'attack_ranged') return statMod('dexterity') + (character.equipped?.weapon?.attack_bonus || 0);
  if (rollKey === 'initiative') return statMod('dexterity');

  return 0;
}

export default function DiceRoller({ character }) {
  const [numDice, setNumDice] = useState(1);
  const [dieSides, setDieSides] = useState(20);
  const [modifier, setModifier] = useState(0);
  const [rollType, setRollType] = useState('none');
  const [advantage, setAdvantage] = useState('normal'); // 'normal' | 'advantage' | 'disadvantage'
  const [customNotation, setCustomNotation] = useState('');
  const [log, setLog] = useState([]);
  const [lastResult, setLastResult] = useState(null);
  const [rolling, setRolling] = useState(false);
  const logRef = useRef(null);

  const charModifier = rollType !== 'none' ? computeModifier(character, rollType) : 0;
  const totalModifier = charModifier + modifier;

  const getModLabel = () => {
    if (rollType === 'none') return null;
    const allOptions = [...ABILITY_CHECKS, ...SAVING_THROWS, ...SKILLS,
      { label: 'Melee Attack', key: 'attack_melee' },
      { label: 'Ranged Attack', key: 'attack_ranged' },
      { label: 'Initiative', key: 'initiative' },
    ];
    return allOptions.find(o => o.key === rollType)?.label || null;
  };

  const performRoll = () => {
    setRolling(true);
    setTimeout(() => {
      let rolls, effectiveRolls;

      // Parse custom notation if provided
      if (customNotation.trim()) {
        const match = customNotation.trim().match(/^(\d+)d(\d+)([+-]\d+)?$/i);
        if (!match) { setRolling(false); return; }
        const n = parseInt(match[1]);
        const s = parseInt(match[2]);
        const bonus = match[3] ? parseInt(match[3]) : 0;
        rolls = rollDice(n, s);
        effectiveRolls = [...rolls];
        const raw = effectiveRolls.reduce((a, b) => a + b, 0);
        const final = raw + bonus;
        pushResult({ rolls, effectiveRolls, raw, bonus, final, label: customNotation.trim(), adv: 'normal' });
        setRolling(false);
        return;
      }

      rolls = rollDice(numDice, dieSides);
      effectiveRolls = [...rolls];

      // Advantage/Disadvantage only applies to single d20
      if (dieSides === 20 && numDice === 1 && advantage !== 'normal') {
        const roll2 = rollDice(1, 20)[0];
        rolls = [rolls[0], roll2];
        effectiveRolls = [advantage === 'advantage' ? Math.max(rolls[0], roll2) : Math.min(rolls[0], roll2)];
      }

      const raw = effectiveRolls.reduce((a, b) => a + b, 0);
      const final = raw + totalModifier;
      const label = `${numDice}d${dieSides}${getModLabel() ? ` (${getModLabel()})` : ''}`;
      pushResult({ rolls, effectiveRolls, raw, bonus: totalModifier, final, label, adv: advantage });
      setRolling(false);
    }, 300);
  };

  const pushResult = (result) => {
    setLastResult(result);
    setLog(prev => [{ ...result, ts: Date.now() }, ...prev].slice(0, 20));
    setTimeout(() => { logRef.current?.scrollTo({ top: 0, behavior: 'smooth' }); }, 50);
  };

  const isCrit = lastResult && dieSides === 20 && lastResult.effectiveRolls[0] === 20;
  const isFumble = lastResult && dieSides === 20 && lastResult.effectiveRolls[0] === 1;

  return (
    <div className="flex flex-col h-full bg-slate-900/95 text-amber-100 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-700/40 flex items-center gap-2 flex-shrink-0">
        <Dices className="w-4 h-4 text-amber-400" />
        <span className="text-amber-300 font-bold text-sm tracking-wide">DICE ROLLER</span>
      </div>

      <div className="flex flex-col flex-1 overflow-hidden p-3 gap-3 min-h-0">

        {/* Dice picker */}
        <div>
          <div className="text-xs text-slate-400 uppercase tracking-widest mb-1.5">Dice Type</div>
          <div className="flex gap-1.5 flex-wrap">
            {DICE_OPTIONS.map(s => (
              <button key={s} onClick={() => setDieSides(s)}
                className={`px-2.5 py-1.5 rounded-lg border text-xs font-bold transition-all ${
                  dieSides === s ? 'border-amber-500 bg-amber-900/30 text-amber-200' : 'border-slate-700/50 text-slate-400 hover:border-slate-500'
                }`}>
                {getDiceEmoji(s)} d{s}
              </button>
            ))}
          </div>
        </div>

        {/* Num dice + flat modifier */}
        <div className="flex gap-3">
          <div className="flex-1">
            <div className="text-xs text-slate-400 uppercase tracking-widest mb-1.5">Count</div>
            <div className="flex items-center gap-2">
              <button onClick={() => setNumDice(n => Math.max(1, n - 1))}
                className="w-7 h-7 rounded-lg border border-slate-700/50 text-slate-300 hover:bg-slate-800 flex items-center justify-center text-lg">−</button>
              <span className="text-amber-200 font-bold w-6 text-center">{numDice}</span>
              <button onClick={() => setNumDice(n => Math.min(20, n + 1))}
                className="w-7 h-7 rounded-lg border border-slate-700/50 text-slate-300 hover:bg-slate-800 flex items-center justify-center text-lg">+</button>
            </div>
          </div>
          <div className="flex-1">
            <div className="text-xs text-slate-400 uppercase tracking-widest mb-1.5">Flat Bonus</div>
            <div className="flex items-center gap-2">
              <button onClick={() => setModifier(m => m - 1)}
                className="w-7 h-7 rounded-lg border border-slate-700/50 text-slate-300 hover:bg-slate-800 flex items-center justify-center text-lg">−</button>
              <span className={`font-bold w-8 text-center ${modifier >= 0 ? 'text-green-400' : 'text-red-400'}`}>{calcModDisplay(modifier)}</span>
              <button onClick={() => setModifier(m => m + 1)}
                className="w-7 h-7 rounded-lg border border-slate-700/50 text-slate-300 hover:bg-slate-800 flex items-center justify-center text-lg">+</button>
            </div>
          </div>
        </div>

        {/* Adv/Disadv (only for d20) */}
        {dieSides === 20 && numDice === 1 && (
          <div className="flex gap-1.5">
            {['normal', 'advantage', 'disadvantage'].map(a => (
              <button key={a} onClick={() => setAdvantage(a)}
                className={`flex-1 py-1.5 rounded-lg border text-xs capitalize transition-all flex items-center justify-center gap-1 ${
                  advantage === a
                    ? a === 'advantage' ? 'border-green-500 bg-green-900/30 text-green-300'
                    : a === 'disadvantage' ? 'border-red-500 bg-red-900/30 text-red-300'
                    : 'border-amber-500 bg-amber-900/20 text-amber-300'
                    : 'border-slate-700/50 text-slate-400 hover:border-slate-600'
                }`}>
                {a === 'advantage' && <TrendingUp className="w-3 h-3" />}
                {a === 'disadvantage' && <TrendingDown className="w-3 h-3" />}
                {a === 'normal' ? 'Normal' : a === 'advantage' ? 'Adv' : 'Disadv'}
              </button>
            ))}
          </div>
        )}

        {/* Modifier selector */}
        {character && (
          <div>
            <div className="text-xs text-slate-400 uppercase tracking-widest mb-1.5">Character Modifier</div>
            <select value={rollType} onChange={e => setRollType(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700/50 rounded-lg px-3 py-2 text-sm text-amber-200 focus:outline-none focus:border-amber-600">
              <option value="none">None</option>
              <optgroup label="Ability Checks">
                {ABILITY_CHECKS.map(a => (
                  <option key={a.key} value={a.key}>
                    {a.label} ({calcModDisplay(calcStatMod(character[a.stat] || 10))})
                  </option>
                ))}
              </optgroup>
              <optgroup label="Saving Throws">
                {SAVING_THROWS.map(s => (
                  <option key={s.key} value={s.key}>
                    {s.label} ({calcModDisplay(computeModifier(character, s.key))})
                  </option>
                ))}
              </optgroup>
              <optgroup label="Skills">
                {SKILLS.map(s => (
                  <option key={s.key} value={s.key}>
                    {s.label} ({calcModDisplay(computeModifier(character, s.key))})
                  </option>
                ))}
              </optgroup>
              <optgroup label="Combat">
                <option value="attack_melee">Melee Attack ({calcModDisplay(computeModifier(character, 'attack_melee'))})</option>
                <option value="attack_ranged">Ranged Attack ({calcModDisplay(computeModifier(character, 'attack_ranged'))})</option>
                <option value="initiative">Initiative ({calcModDisplay(computeModifier(character, 'initiative'))})</option>
              </optgroup>
            </select>
            {rollType !== 'none' && (
              <div className="mt-1 text-xs text-slate-400">
                Character modifier: <span className={charModifier >= 0 ? 'text-green-400' : 'text-red-400'}>{calcModDisplay(charModifier)}</span>
                {modifier !== 0 && <> + flat <span className={modifier >= 0 ? 'text-green-400' : 'text-red-400'}>{calcModDisplay(modifier)}</span></>}
                {' '}= total <span className={totalModifier >= 0 ? 'text-amber-300' : 'text-red-400'}>{calcModDisplay(totalModifier)}</span>
              </div>
            )}
          </div>
        )}

        {/* Custom notation */}
        <div>
          <div className="text-xs text-slate-400 uppercase tracking-widest mb-1.5">Or Custom (e.g. 2d6+3)</div>
          <input value={customNotation} onChange={e => setCustomNotation(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && performRoll()}
            placeholder="2d6+3, 1d20-1..."
            className="w-full bg-slate-800 border border-slate-700/50 rounded-lg px-3 py-2 text-sm text-amber-200 placeholder-slate-600 focus:outline-none focus:border-amber-600" />
        </div>

        {/* Roll button */}
        <button onClick={performRoll} disabled={rolling}
          className={`w-full py-3 rounded-xl font-bold text-base border transition-all flex items-center justify-center gap-2 flex-shrink-0 ${
            rolling ? 'border-slate-700 bg-slate-800/40 text-slate-500' : 'border-amber-600/60 bg-amber-900/30 hover:bg-amber-800/40 text-amber-200 hover:border-amber-500'
          }`}>
          <Dices className={`w-5 h-5 ${rolling ? 'animate-spin' : ''}`} />
          {rolling ? 'Rolling...' : `Roll ${customNotation.trim() || `${numDice}d${dieSides}`}`}
        </button>

        {/* Last result */}
        {lastResult && (
          <div className={`rounded-xl border p-3 text-center flex-shrink-0 ${
            isCrit ? 'border-yellow-400 bg-yellow-900/20' :
            isFumble ? 'border-red-600 bg-red-900/20' :
            'border-slate-700/50 bg-slate-800/30'
          }`}>
            {isCrit && <div className="text-yellow-400 font-bold text-xs mb-1">⭐ CRITICAL HIT!</div>}
            {isFumble && <div className="text-red-400 font-bold text-xs mb-1">💀 CRITICAL FAIL!</div>}
            <div className={`font-bold text-4xl ${isCrit ? 'text-yellow-300' : isFumble ? 'text-red-400' : 'text-amber-200'}`}>
              {lastResult.final}
            </div>
            <div className="text-xs text-slate-400 mt-1">
              Rolled: [{lastResult.rolls.join(', ')}]
              {lastResult.adv !== 'normal' && lastResult.rolls.length > 1 &&
                <span className={lastResult.adv === 'advantage' ? ' text-green-400' : ' text-red-400'}>
                  {' '}({lastResult.adv})
                </span>}
              {lastResult.bonus !== 0 && <span className={lastResult.bonus > 0 ? ' text-green-400' : ' text-red-400'}> {calcModDisplay(lastResult.bonus)}</span>}
            </div>
            <div className="text-xs text-slate-500 mt-0.5">{lastResult.label}</div>
          </div>
        )}

        {/* Roll log */}
        {log.length > 0 && (
          <div className="flex-1 overflow-hidden flex flex-col min-h-0">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs text-slate-400 uppercase tracking-widest">Recent Rolls</span>
              <button onClick={() => { setLog([]); setLastResult(null); }} className="text-xs text-slate-500 hover:text-slate-300 flex items-center gap-1">
                <RotateCcw className="w-3 h-3" /> Clear
              </button>
            </div>
            <div ref={logRef} className="flex-1 overflow-y-auto space-y-1 min-h-0">
              {log.map((entry, i) => (
                <div key={entry.ts} className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg border text-xs ${
                  i === 0 ? 'border-amber-700/40 bg-amber-900/10' : 'border-slate-700/30 bg-slate-800/20'
                }`}>
                  <span className="text-slate-400 truncate max-w-[60%]">{entry.label}</span>
                  <span className={`font-bold ml-2 ${
                    entry.effectiveRolls?.[0] === 20 && entry.label.includes('d20') ? 'text-yellow-300' :
                    entry.effectiveRolls?.[0] === 1 && entry.label.includes('d20') ? 'text-red-400' :
                    'text-amber-200'
                  }`}>{entry.final}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
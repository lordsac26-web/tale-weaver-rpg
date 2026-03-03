import React, { useState, useRef } from 'react';
import { Dices, RotateCcw, TrendingUp, TrendingDown, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
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

const DICE_SHAPES = { 4: '▲', 6: '⬡', 8: '◆', 10: '◉', 12: '⬟', 20: '⬡', 100: '⊙' };

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
  const abilityCheck = ABILITY_CHECKS.find(a => a.key === rollKey);
  if (abilityCheck) return statMod(abilityCheck.stat);
  const save = SAVING_THROWS.find(s => s.key === rollKey);
  if (save) return statMod(save.stat) + (character.saving_throws?.[save.stat] ? profBonus : 0);
  const skill = SKILLS.find(s => s.key === rollKey);
  if (skill) return statMod(skill.stat) + skillProf(skill.key);
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
  const [advantage, setAdvantage] = useState('normal');
  const [customNotation, setCustomNotation] = useState('');
  const [log, setLog] = useState([]);
  const [lastResult, setLastResult] = useState(null);
  const [rolling, setRolling] = useState(false);
  const [rollAnim, setRollAnim] = useState(false);
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
    if (rolling) return;
    setRolling(true);
    setRollAnim(true);
    if (navigator.vibrate) navigator.vibrate([30, 10, 30]);
    setTimeout(() => setRollAnim(false), 500);
    setTimeout(() => {
      let rolls, effectiveRolls;
      if (customNotation.trim()) {
        const match = customNotation.trim().match(/^(\d+)d(\d+)([+-]\d+)?$/i);
        if (!match) { setRolling(false); return; }
        const n = parseInt(match[1]), s = parseInt(match[2]);
        const bonus = match[3] ? parseInt(match[3]) : 0;
        rolls = rollDice(n, s);
        effectiveRolls = [...rolls];
        const raw = effectiveRolls.reduce((a, b) => a + b, 0);
        pushResult({ rolls, effectiveRolls, raw, bonus, final: raw + bonus, label: customNotation.trim(), adv: 'normal' });
        setRolling(false); return;
      }
      rolls = rollDice(numDice, dieSides);
      effectiveRolls = [...rolls];
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
    }, 500);
  };

  const pushResult = (result) => {
    setLastResult(result);
    setLog(prev => [{ ...result, ts: Date.now() }, ...prev].slice(0, 20));
    if (result.effectiveRolls?.[0] === 20 && navigator.vibrate) navigator.vibrate([50, 30, 80, 30, 120]);
    setTimeout(() => { logRef.current?.scrollTo({ top: 0, behavior: 'smooth' }); }, 50);
  };

  const isCrit = lastResult && dieSides === 20 && lastResult.effectiveRolls[0] === 20;
  const isFumble = lastResult && dieSides === 20 && lastResult.effectiveRolls[0] === 1;

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ background: 'rgba(8,5,2,0.95)' }}>
      {/* Header */}
      <div className="px-4 py-3 flex items-center gap-2 flex-shrink-0"
        style={{ borderBottom: '1px solid rgba(180,140,90,0.2)', background: 'rgba(15,10,5,0.6)' }}>
        <Dices className="w-4 h-4" style={{ color: '#c9a96e' }} />
        <span className="font-fantasy font-semibold text-sm tracking-widest" style={{ color: '#c9a96e' }}>DICE ROLLER</span>
      </div>

      <div className="flex flex-col flex-1 overflow-y-auto p-3 gap-3 min-h-0">
        {/* Dice picker */}
        <div>
          <div className="font-fantasy text-xs tracking-widest mb-2" style={{ color: 'rgba(180,140,90,0.5)', fontSize: '0.65rem' }}>DICE TYPE</div>
          <div className="flex gap-1.5 flex-wrap">
            {DICE_OPTIONS.map(s => (
              <button key={s} onClick={() => setDieSides(s)}
                className="px-2.5 py-2 rounded-lg text-xs font-fantasy transition-all"
                style={dieSides === s ? {
                  background: 'rgba(80,50,10,0.8)',
                  border: '1px solid rgba(201,169,110,0.6)',
                  color: '#f0c040',
                  boxShadow: '0 0 10px rgba(201,169,110,0.15)',
                } : {
                  background: 'rgba(15,10,5,0.6)',
                  border: '1px solid rgba(180,140,90,0.2)',
                  color: 'rgba(201,169,110,0.5)',
                }}>
                {DICE_SHAPES[s]} d{s}
              </button>
            ))}
          </div>
        </div>

        {/* Count + Flat Bonus */}
        <div className="flex gap-3">
          {[
            { label: 'COUNT', val: numDice, set: setNumDice, min: 1, max: 20, fmt: v => v },
            { label: 'FLAT BONUS', val: modifier, set: setModifier, min: -20, max: 20, fmt: calcModDisplay },
          ].map(({ label, val, set, min, max, fmt }) => (
            <div key={label} className="flex-1">
              <div className="font-fantasy text-xs tracking-widest mb-1.5" style={{ color: 'rgba(180,140,90,0.5)', fontSize: '0.65rem' }}>{label}</div>
              <div className="flex items-center gap-2">
                <button onClick={() => set(v => Math.max(min, v - 1))}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-lg font-bold transition-all"
                  style={{ background: 'rgba(15,10,5,0.7)', border: '1px solid rgba(180,140,90,0.2)', color: 'rgba(201,169,110,0.6)' }}>−</button>
                <span className="font-fantasy font-bold w-8 text-center"
                  style={{ color: val >= 0 ? '#86efac' : '#fca5a5' }}>{fmt(val)}</span>
                <button onClick={() => set(v => Math.min(max, v + 1))}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-lg font-bold transition-all"
                  style={{ background: 'rgba(15,10,5,0.7)', border: '1px solid rgba(180,140,90,0.2)', color: 'rgba(201,169,110,0.6)' }}>+</button>
              </div>
            </div>
          ))}
        </div>

        {/* Advantage/Disadvantage */}
        {dieSides === 20 && numDice === 1 && (
          <div className="flex gap-1.5">
            {['normal', 'advantage', 'disadvantage'].map(a => (
              <button key={a} onClick={() => setAdvantage(a)}
                className="flex-1 py-1.5 rounded-lg text-xs font-fantasy capitalize transition-all flex items-center justify-center gap-1"
                style={advantage === a ? (
                  a === 'advantage' ? { background: 'rgba(10,50,20,0.7)', border: '1px solid rgba(40,160,80,0.5)', color: '#86efac' } :
                  a === 'disadvantage' ? { background: 'rgba(50,5,5,0.7)', border: '1px solid rgba(180,30,30,0.5)', color: '#fca5a5' } :
                  { background: 'rgba(60,40,5,0.7)', border: '1px solid rgba(201,169,110,0.5)', color: '#f0c040' }
                ) : { background: 'rgba(15,10,5,0.5)', border: '1px solid rgba(180,140,90,0.15)', color: 'rgba(201,169,110,0.4)' }}>
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
            <div className="font-fantasy text-xs tracking-widest mb-1.5" style={{ color: 'rgba(180,140,90,0.5)', fontSize: '0.65rem' }}>CHARACTER MODIFIER</div>
            <select value={rollType} onChange={e => setRollType(e.target.value)} className="w-full rounded-lg px-3 py-2 text-sm select-fantasy">
              <option value="none">None</option>
              <optgroup label="Ability Checks">
                {ABILITY_CHECKS.map(a => <option key={a.key} value={a.key}>{a.label} ({calcModDisplay(calcStatMod(character[a.stat] || 10))})</option>)}
              </optgroup>
              <optgroup label="Saving Throws">
                {SAVING_THROWS.map(s => <option key={s.key} value={s.key}>{s.label} ({calcModDisplay(computeModifier(character, s.key))})</option>)}
              </optgroup>
              <optgroup label="Skills">
                {SKILLS.map(s => <option key={s.key} value={s.key}>{s.label} ({calcModDisplay(computeModifier(character, s.key))})</option>)}
              </optgroup>
              <optgroup label="Combat">
                <option value="attack_melee">Melee Attack ({calcModDisplay(computeModifier(character, 'attack_melee'))})</option>
                <option value="attack_ranged">Ranged Attack ({calcModDisplay(computeModifier(character, 'attack_ranged'))})</option>
                <option value="initiative">Initiative ({calcModDisplay(computeModifier(character, 'initiative'))})</option>
              </optgroup>
            </select>
            {rollType !== 'none' && (
              <div className="mt-1 text-xs" style={{ color: 'rgba(180,140,90,0.5)', fontFamily: 'EB Garamond, serif' }}>
                Modifier: <span style={{ color: charModifier >= 0 ? '#86efac' : '#fca5a5' }}>{calcModDisplay(charModifier)}</span>
                {modifier !== 0 && <> + <span style={{ color: modifier >= 0 ? '#86efac' : '#fca5a5' }}>{calcModDisplay(modifier)}</span></>}
                {' '}= <span style={{ color: '#f0c040' }}>{calcModDisplay(totalModifier)}</span>
              </div>
            )}
          </div>
        )}

        {/* Custom notation */}
        <div>
          <div className="font-fantasy text-xs tracking-widest mb-1.5" style={{ color: 'rgba(180,140,90,0.5)', fontSize: '0.65rem' }}>CUSTOM NOTATION</div>
          <input value={customNotation} onChange={e => setCustomNotation(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && performRoll()}
            placeholder="2d6+3, 1d20-1..."
            className="w-full rounded-lg px-3 py-2 text-sm input-fantasy" />
        </div>

        {/* Roll button */}
        <motion.button onClick={performRoll} disabled={rolling}
          whileTap={{ scale: 0.97 }}
          className="w-full py-3.5 rounded-xl font-fantasy font-bold text-base flex items-center justify-center gap-2 flex-shrink-0 btn-fantasy disabled:opacity-50"
          style={{ letterSpacing: '0.1em', fontSize: '0.9rem' }}>
          <motion.div animate={rollAnim ? { rotate: 360 } : {}} transition={{ duration: 0.45, ease: 'easeInOut' }}>
            <Dices className="w-5 h-5" />
          </motion.div>
          {rolling ? 'Rolling...' : `Roll ${customNotation.trim() || `${numDice}d${dieSides}`}`}
        </motion.button>

        {/* Last result */}
        <AnimatePresence mode="wait">
          {lastResult && (
            <motion.div
              key={lastResult.ts}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 400, damping: 22 }}
              className="rounded-xl p-4 text-center flex-shrink-0"
              style={isCrit ? {
                background: 'rgba(80,60,5,0.6)',
                border: '1px solid rgba(240,192,64,0.6)',
                boxShadow: '0 0 24px rgba(240,192,64,0.2)',
              } : isFumble ? {
                background: 'rgba(60,5,5,0.6)',
                border: '1px solid rgba(180,30,30,0.6)',
                boxShadow: '0 0 20px rgba(180,30,30,0.2)',
              } : {
                background: 'rgba(15,10,5,0.7)',
                border: '1px solid rgba(180,140,90,0.25)',
              }}>
              {isCrit && (
                <motion.div
                  initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                  className="font-fantasy font-bold text-xs mb-1 flex items-center justify-center gap-1"
                  style={{ color: '#f0c040', textShadow: '0 0 16px rgba(240,192,64,0.7)' }}>
                  <Sparkles className="w-3.5 h-3.5" /> CRITICAL HIT! <Sparkles className="w-3.5 h-3.5" />
                </motion.div>
              )}
              {isFumble && (
                <div className="font-fantasy font-bold text-xs mb-1" style={{ color: '#fca5a5', textShadow: '0 0 12px rgba(180,30,30,0.6)' }}>
                  💀 CRITICAL FAIL!
                </div>
              )}
              <div className="font-fantasy font-bold text-5xl mb-1"
                style={{
                  color: isCrit ? '#f0c040' : isFumble ? '#fca5a5' : '#e8d5b7',
                  textShadow: isCrit ? '0 0 30px rgba(240,192,64,0.5)' : isFumble ? '0 0 20px rgba(180,30,30,0.5)' : 'none'
                }}>
                {lastResult.final}
              </div>
              <div className="text-xs" style={{ color: 'rgba(180,150,100,0.6)', fontFamily: 'EB Garamond, serif' }}>
                [{lastResult.rolls.join(', ')}]
                {lastResult.adv !== 'normal' && lastResult.rolls.length > 1 &&
                  <span style={{ color: lastResult.adv === 'advantage' ? '#86efac' : '#fca5a5' }}>
                    {' '}({lastResult.adv})
                  </span>}
                {lastResult.bonus !== 0 && <span style={{ color: lastResult.bonus > 0 ? '#86efac' : '#fca5a5' }}> {calcModDisplay(lastResult.bonus)}</span>}
              </div>
              <div className="text-xs mt-0.5" style={{ color: 'rgba(180,140,90,0.4)', fontFamily: 'EB Garamond, serif' }}>{lastResult.label}</div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Roll log */}
        {log.length > 0 && (
          <div className="flex flex-col min-h-0">
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-fantasy text-xs tracking-widest" style={{ color: 'rgba(180,140,90,0.4)', fontSize: '0.65rem' }}>RECENT ROLLS</span>
              <button onClick={() => { setLog([]); setLastResult(null); }}
                className="text-xs flex items-center gap-1 transition-colors"
                style={{ color: 'rgba(180,140,90,0.35)' }}
                onMouseEnter={e => e.currentTarget.style.color = 'rgba(201,169,110,0.7)'}
                onMouseLeave={e => e.currentTarget.style.color = 'rgba(180,140,90,0.35)'}>
                <RotateCcw className="w-3 h-3" /> Clear
              </button>
            </div>
            <div ref={logRef} className="space-y-1 overflow-y-auto max-h-48">
              {log.map((entry, i) => (
                <div key={entry.ts}
                  className="flex items-center justify-between px-3 py-2 rounded-lg text-xs"
                  style={i === 0 ? {
                    background: 'rgba(50,35,5,0.6)',
                    border: '1px solid rgba(180,140,90,0.2)',
                  } : {
                    background: 'rgba(15,10,5,0.4)',
                    border: '1px solid rgba(180,140,90,0.1)',
                  }}>
                  <span className="truncate max-w-[60%]" style={{ color: 'rgba(180,150,100,0.6)', fontFamily: 'EB Garamond, serif' }}>{entry.label}</span>
                  <span className="font-fantasy font-bold ml-2"
                    style={{
                      color: entry.effectiveRolls?.[0] === 20 && entry.label?.includes('d20') ? '#f0c040' :
                        entry.effectiveRolls?.[0] === 1 && entry.label?.includes('d20') ? '#fca5a5' :
                        '#e8d5b7'
                    }}>{entry.final}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Dices, ChevronDown, ChevronUp, RotateCcw, Sun, Moon, Sunset } from 'lucide-react';
import { TOWER_CONFIGS } from './DiceTowerScene';
import CriticalEffect from './CriticalEffect';
import VanillaThreeScene from './VanillaThreeScene';
import { getSpawnPosition, getSpawnVelocity, getSpawnAngularVelocity } from './TowerPhysics';

// ─── Constants ────────────────────────────────────────────────────────────────

const DICE_TYPES = [
  { label: 'D4',   sides: 4 },
  { label: 'D6',   sides: 6 },
  { label: 'D8',   sides: 8 },
  { label: 'D10',  sides: 10 },
  { label: 'D12',  sides: 12 },
  { label: 'D20',  sides: 20 },
  { label: 'D100', sides: 100 },
];

const AMBIENCE_OPTIONS = [
  { key: 'night', label: 'Night', icon: Moon, color: '#6688cc' },
  { key: 'dusk',  label: 'Dusk',  icon: Sunset, color: '#e8a040' },
  { key: 'day',   label: 'Day',   icon: Sun, color: '#ffd080' },
];

// ─── Main Modal ───────────────────────────────────────────────────────────────

export default function Dice3DModal({ onClose, character }) {
  const [selectedTower, setSelectedTower] = useState('wooden');
  const [selectedDice, setSelectedDice]   = useState('D20');
  const [diceCount, setDiceCount]         = useState(1);
  const [modifier, setModifier]           = useState(0);
  const [dice, setDice]                   = useState([]);
  const [rolling, setRolling]             = useState(false);
  const [critEffect, setCritEffect]       = useState(null);
  const [rollHistory, setRollHistory]     = useState([]);
  const [showTowerPicker, setShowTowerPicker] = useState(false);
  const [ambience, setAmbience] = useState('dusk');
  const idRef = useRef(0);

  const diceType = DICE_TYPES.find(d => d.label === selectedDice) || DICE_TYPES[5];
  const cfg      = TOWER_CONFIGS[selectedTower];

  // Close on Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  // Store pending roll data so we can finalize when dice settle
  const pendingRollRef = useRef(null);

  const handleRoll = useCallback(() => {
    if (rolling) return;
    const count   = Math.min(diceCount, 6);
    const results = Array.from({ length: count }, () => Math.floor(Math.random() * diceType.sides) + 1);

    // Dice spawn inside tower top opening, fall through baffles to catch tray
    const newDice = results.map((result, i) => ({
      id: idRef.current++,
      result,
      position: getSpawnPosition(i),
      velocity: getSpawnVelocity(),
      angularVelocity: getSpawnAngularVelocity(),
    }));

    // Store roll info for when dice settle
    const total = results.reduce((s, r) => s + r, 0) + modifier;
    pendingRollRef.current = { count, results, total, sides: diceType.sides, label: diceType.label };

    setDice(newDice);
    setRolling(true);
  }, [rolling, diceCount, diceType, modifier]);

  // Called by VanillaThreeScene when all dice physics bodies have settled
  const handleDiceSettled = useCallback(() => {
    const pending = pendingRollRef.current;
    if (!pending) return;
    pendingRollRef.current = null;

    // Record to history
    setRollHistory(prev => [{
      dice: `${pending.count}${pending.label}${modifier !== 0 ? (modifier > 0 ? `+${modifier}` : modifier) : ''}`,
      results: pending.results,
      total: pending.total,
      sides: pending.sides,
      ts: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    }, ...prev.slice(0, 11)]);

    // Crit effects for d20
    if (pending.sides === 20 && pending.count === 1) {
      if (pending.results[0] === 20) setCritEffect('crit');
      if (pending.results[0] === 1)  setCritEffect('fail');
    }

    setRolling(false);
  }, [modifier]);

  const handleClear = () => { setDice([]); };

  const latestRoll = rollHistory[0];
  const isCrit     = latestRoll?.results.length === 1 && latestRoll.results[0] === 20 && latestRoll.sides === 20;
  const isFail     = latestRoll?.results.length === 1 && latestRoll.results[0] === 1  && latestRoll.sides === 20;

  const resultColor = isCrit ? '#f0c040' : isFail ? '#ff4444' : '#e8d5b7';
  const resultGlow  = isCrit ? '0 0 24px #f0c040aa' : isFail ? '0 0 24px #ff0000aa' : 'none';
  const resultLabel = isCrit ? '⚡ CRITICAL HIT!' : isFail ? '💀 CRITICAL FAIL' : null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(10px)' }}
    >
      <motion.div
        initial={{ scale: 0.88, y: 40 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.88, y: 40 }}
        transition={{ type: 'spring', stiffness: 280, damping: 26 }}
        className="relative w-full max-w-5xl mx-3 rounded-2xl overflow-hidden flex flex-col"
        style={{
          background: 'rgba(8,4,1,0.98)',
          border: `1px solid ${cfg.ambientColor}55`,
          boxShadow: `0 0 80px ${cfg.ambientColor}22, 0 0 140px rgba(0,0,0,0.9)`,
          maxHeight: '93vh',
          minWidth: 0,
        }}
      >
        {/* ── Header ── */}
        <div className="flex items-center justify-between px-5 py-3 flex-shrink-0"
          style={{ borderBottom: '1px solid rgba(201,169,110,0.12)', background: 'rgba(6,3,1,0.85)' }}>
          <div className="flex items-center gap-3">
            <Dices className="w-5 h-5" style={{ color: cfg.ambientColor }} />
            <span className="font-fantasy font-bold text-lg" style={{ color: '#e8d5b7' }}>Dice Tower</span>
            <span className="px-2 py-0.5 rounded-full text-xs"
              style={{ background: 'rgba(30,18,4,0.8)', border: `1px solid ${cfg.ambientColor}44`, color: cfg.ambientColor, fontFamily: 'Cinzel, serif' }}>
              {cfg.emoji} {cfg.name}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleClear} title="Clear dice"
              className="p-1.5 rounded-lg transition-colors"
              style={{ color: 'rgba(201,169,110,0.35)' }}
              onMouseEnter={e => e.currentTarget.style.color = '#c9a96e'}
              onMouseLeave={e => e.currentTarget.style.color = 'rgba(201,169,110,0.35)'}>
              <RotateCcw className="w-4 h-4" />
            </button>
            <button onClick={onClose}
              className="p-1.5 rounded-lg transition-colors"
              style={{ color: 'rgba(201,169,110,0.35)' }}
              onMouseEnter={e => e.currentTarget.style.color = '#c9a96e'}
              onMouseLeave={e => e.currentTarget.style.color = 'rgba(201,169,110,0.35)'}>
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ── Body ── */}
        <div className="flex flex-1 overflow-hidden" style={{ minHeight: 0, minWidth: 0 }}>

          {/* 3D Canvas — pure vanilla Three.js, no R3F */}
          <div className="flex-1 relative overflow-hidden" style={{ minHeight: '360px', minWidth: 0 }}>
            <VanillaThreeScene
              towerType={selectedTower}
              towerConfig={cfg}
              dice={dice}
              diceSides={diceType.sides}
              ambience={ambience}
            />

            {/* Roll Result Overlay */}
            <AnimatePresence>
              {latestRoll && !rolling && (
                <motion.div
                  key={latestRoll.ts}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="absolute bottom-4 left-1/2 -translate-x-1/2 px-6 py-3 rounded-xl text-center pointer-events-none"
                  style={{ background: 'rgba(6,3,1,0.93)', border: `1px solid ${resultColor}55`, minWidth: '160px', boxShadow: resultGlow }}>
                  {resultLabel && (
                    <div className="font-fantasy text-xs mb-1" style={{ color: resultColor, letterSpacing: '0.1em' }}>
                      {resultLabel}
                    </div>
                  )}
                  <div className="font-fantasy text-xs mb-0.5" style={{ color: 'rgba(201,169,110,0.5)' }}>{latestRoll.dice}</div>
                  <div className="font-fantasy-deco font-bold" style={{ fontSize: '2.8rem', lineHeight: 1, color: resultColor, textShadow: resultGlow }}>
                    {latestRoll.total}
                  </div>
                  {latestRoll.results.length > 1 && (
                    <div className="text-xs mt-0.5" style={{ color: 'rgba(201,169,110,0.4)', fontFamily: 'EB Garamond, serif' }}>
                      [{latestRoll.results.join(' + ')}]
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Rolling indicator */}
            <AnimatePresence>
              {rolling && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="absolute top-4 left-1/2 -translate-x-1/2 px-5 py-2 rounded-full"
                  style={{ background: 'rgba(6,3,1,0.9)', border: `1px solid ${cfg.ambientColor}55`, boxShadow: `0 0 16px ${cfg.ambientColor}22` }}>
                  <span className="font-fantasy text-sm" style={{ color: cfg.ambientColor }}>✨ Rolling...</span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Drag hint */}
            <div className="absolute bottom-4 right-4 text-xs pointer-events-none" style={{ color: 'rgba(201,169,110,0.2)', fontFamily: 'EB Garamond, serif' }}>
              drag to orbit
            </div>
          </div>

          {/* ── Controls ── */}
          <div className="flex flex-col flex-shrink-0 overflow-y-auto"
            style={{ width: '240px', minWidth: '200px', maxWidth: '260px', borderLeft: `1px solid ${cfg.ambientColor}22`, background: 'rgba(6,3,1,0.7)', padding: '1rem', gap: '1rem', display: 'flex', flexDirection: 'column' }}>

            {/* Tower Picker */}
            <div>
              <button
                onClick={() => setShowTowerPicker(v => !v)}
                className="w-full flex items-center justify-between px-3 py-2 rounded-lg mb-2"
                style={{ background: 'rgba(18,10,3,0.8)', border: `1px solid ${cfg.ambientColor}44`, color: cfg.ambientColor, fontFamily: 'Cinzel, serif', fontSize: '0.72rem', letterSpacing: '0.06em' }}>
                <span>🏰 Tower Style</span>
                {showTowerPicker ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>

              <AnimatePresence>
                {showTowerPicker && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden space-y-1 mb-2">
                    {Object.entries(TOWER_CONFIGS).map(([key, t]) => (
                      <button key={key}
                        onClick={() => { setSelectedTower(key); setShowTowerPicker(false); }}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg transition-all text-left"
                        style={{
                          background: selectedTower === key ? `${t.ambientColor}22` : 'rgba(12,7,2,0.7)',
                          border: `1px solid ${selectedTower === key ? t.ambientColor + '55' : 'rgba(80,50,10,0.2)'}`,
                        }}>
                        <span style={{ fontSize: '1rem' }}>{t.emoji}</span>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-fantasy truncate" style={{ color: selectedTower === key ? t.ambientColor : '#e8d5b7' }}>{t.name}</div>
                          <div className="text-xs truncate" style={{ color: 'rgba(201,169,110,0.35)', fontFamily: 'EB Garamond, serif' }}>{t.description}</div>
                        </div>
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="h-px flex-shrink-0" style={{ background: 'rgba(201,169,110,0.1)' }} />

            {/* Ambience / Time of Day */}
            <div>
              <div className="text-xs mb-2 font-fantasy" style={{ color: 'rgba(201,169,110,0.45)', letterSpacing: '0.12em' }}>AMBIENCE</div>
              <div className="grid grid-cols-3 gap-1.5">
                {AMBIENCE_OPTIONS.map(a => {
                  const Icon = a.icon;
                  const active = ambience === a.key;
                  return (
                    <button key={a.key}
                      onClick={() => setAmbience(a.key)}
                      className="flex flex-col items-center gap-1 py-2 rounded-lg text-xs font-fantasy transition-all"
                      style={{
                        background: active ? `${a.color}22` : 'rgba(12,7,2,0.6)',
                        border: `1px solid ${active ? a.color + '77' : 'rgba(80,50,10,0.2)'}`,
                        color: active ? a.color : 'rgba(201,169,110,0.4)',
                        boxShadow: active ? `0 0 12px ${a.color}22` : 'none',
                      }}>
                      <Icon className="w-3.5 h-3.5" />
                      <span>{a.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="h-px flex-shrink-0" style={{ background: 'rgba(201,169,110,0.1)' }} />

            {/* Dice Type */}
            <div>
              <div className="text-xs mb-2 font-fantasy" style={{ color: 'rgba(201,169,110,0.45)', letterSpacing: '0.12em' }}>DICE TYPE</div>
              <div className="grid grid-cols-3 gap-1.5">
                {DICE_TYPES.map(d => (
                  <button key={d.label}
                    onClick={() => setSelectedDice(d.label)}
                    className="py-1.5 rounded-lg text-xs font-fantasy transition-all"
                    style={{
                      background: selectedDice === d.label ? `${cfg.ambientColor}22` : 'rgba(12,7,2,0.6)',
                      border: `1px solid ${selectedDice === d.label ? cfg.ambientColor + '77' : 'rgba(80,50,10,0.2)'}`,
                      color: selectedDice === d.label ? cfg.ambientColor : 'rgba(201,169,110,0.45)',
                      boxShadow: selectedDice === d.label ? `0 0 10px ${cfg.ambientColor}22` : 'none',
                    }}>
                    {d.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Dice Count */}
            <div>
              <div className="text-xs mb-2 font-fantasy" style={{ color: 'rgba(201,169,110,0.45)', letterSpacing: '0.12em' }}>COUNT</div>
              <div className="flex items-center gap-2">
                <button onClick={() => setDiceCount(v => Math.max(1, v - 1))}
                  className="w-8 h-8 rounded-lg font-bold text-lg leading-none"
                  style={{ background: 'rgba(18,10,3,0.8)', border: '1px solid rgba(180,140,90,0.2)', color: '#c9a96e' }}>−</button>
                <div className="flex-1 text-center font-fantasy text-xl font-bold" style={{ color: '#e8d5b7' }}>{diceCount}</div>
                <button onClick={() => setDiceCount(v => Math.min(6, v + 1))}
                  className="w-8 h-8 rounded-lg font-bold text-lg leading-none"
                  style={{ background: 'rgba(18,10,3,0.8)', border: '1px solid rgba(180,140,90,0.2)', color: '#c9a96e' }}>+</button>
              </div>
            </div>

            {/* Modifier */}
            <div>
              <div className="text-xs mb-2 font-fantasy" style={{ color: 'rgba(201,169,110,0.45)', letterSpacing: '0.12em' }}>MODIFIER</div>
              <div className="flex items-center gap-2">
                <button onClick={() => setModifier(v => v - 1)}
                  className="w-8 h-8 rounded-lg font-bold text-lg leading-none"
                  style={{ background: 'rgba(18,10,3,0.8)', border: '1px solid rgba(180,140,90,0.2)', color: '#c9a96e' }}>−</button>
                <div className="flex-1 text-center font-fantasy text-xl font-bold"
                  style={{ color: modifier > 0 ? '#86efac' : modifier < 0 ? '#fca5a5' : '#e8d5b7' }}>
                  {modifier >= 0 ? `+${modifier}` : modifier}
                </div>
                <button onClick={() => setModifier(v => v + 1)}
                  className="w-8 h-8 rounded-lg font-bold text-lg leading-none"
                  style={{ background: 'rgba(18,10,3,0.8)', border: '1px solid rgba(180,140,90,0.2)', color: '#c9a96e' }}>+</button>
              </div>
            </div>

            {/* Roll Button */}
            <motion.button
              onClick={handleRoll}
              disabled={rolling}
              whileHover={{ scale: rolling ? 1 : 1.03 }}
              whileTap={{ scale: rolling ? 1 : 0.96 }}
              className="w-full py-3 rounded-xl font-fantasy font-bold text-base disabled:opacity-40"
              style={{
                background: `linear-gradient(135deg, rgba(60,36,6,0.98), rgba(36,20,4,0.99))`,
                border: `2px solid ${cfg.ambientColor}${rolling ? '33' : '99'}`,
                color: rolling ? 'rgba(201,169,110,0.35)' : cfg.ambientColor,
                boxShadow: rolling ? 'none' : `0 0 24px ${cfg.ambientColor}22`,
                letterSpacing: '0.08em',
                transition: 'all 0.2s',
              }}>
              {rolling ? '⏳ Rolling...' : `🎲 Roll ${diceCount}${diceType.label}`}
            </motion.button>

            {/* Roll History */}
            {rollHistory.length > 0 && (
              <div className="flex-1 min-h-0">
                <div className="text-xs mb-2 font-fantasy" style={{ color: 'rgba(201,169,110,0.45)', letterSpacing: '0.12em' }}>HISTORY</div>
                <div className="space-y-1 overflow-y-auto" style={{ maxHeight: '180px' }}>
                  {rollHistory.map((r, i) => {
                    const rc = r.results.length === 1 && r.sides === 20
                      ? r.results[0] === 20 ? '#f0c040' : r.results[0] === 1 ? '#ff5555' : '#e8d5b7'
                      : '#e8d5b7';
                    return (
                      <div key={i} className="flex items-center justify-between px-2.5 py-1.5 rounded-lg"
                        style={{ background: i === 0 ? `${cfg.ambientColor}0d` : 'rgba(12,7,2,0.7)', border: `1px solid ${i === 0 ? cfg.ambientColor + '33' : 'rgba(80,50,10,0.15)'}` }}>
                        <span className="text-xs" style={{ color: 'rgba(201,169,110,0.4)', fontFamily: 'EB Garamond, serif' }}>{r.dice}</span>
                        <span className="font-fantasy font-bold text-sm" style={{ color: rc }}>{r.total}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </motion.div>

      {/* Critical Effects overlay */}
      <AnimatePresence>
        {critEffect && (
          <CriticalEffect type={critEffect} onDismiss={() => setCritEffect(null)} />
        )}
      </AnimatePresence>
    </motion.div>
  );
}
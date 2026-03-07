import React, { useState, useRef, useCallback, useEffect, Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { Physics } from '@react-three/cannon';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Dices, ChevronDown, ChevronUp, RotateCcw } from 'lucide-react';
import { Die, Floor, TowerWall } from './DicePhysics';
import { TOWER_CONFIGS } from './DiceTowerScene';
import CriticalEffect from './CriticalEffect';

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

// ─── 3D Tower Scene (inside Canvas) ──────────────────────────────────────────

function TowerScene({ towerType, dice, onDieSettle }) {
  const cfg = TOWER_CONFIGS[towerType];
  const walls = [
    { pos: [0, 2, -2.6],  size: [5.2, 9, 0.3] },
    { pos: [-2.6, 2, 0],  size: [0.3, 9, 5.2] },
    { pos: [2.6, 2, 0],   size: [0.3, 9, 5.2] },
    { pos: [0, 2, 2.6],   size: [5.2, 9, 0.3] },
  ];

  return (
    <>
      <ambientLight intensity={1.2} color="#ffffff" />
      <ambientLight intensity={0.6} color={cfg.ambientColor} />
      <pointLight position={[0, 8, 0]} intensity={3.5} color={cfg.ambientColor} castShadow />
      <pointLight position={[0, -1, 2]} intensity={1.8} color="#ffffff" />
      <pointLight position={[3, 4, 3]} intensity={1.2} color="#ffffff" />
      <pointLight position={[-3, 4, -3]} intensity={1.0} color="#ffffff" />
      <Stars radius={35} depth={12} count={250} factor={2.5} fade />
      {cfg.sparkles && (
        <Sparkles
          count={cfg.sparkles.count}
          scale={7}
          size={cfg.sparkles.size}
          speed={cfg.sparkles.speed}
          color={new THREE.Color(cfg.sparkles.color)}
        />
      )}

      <Physics gravity={[0, -28, 0]}>
        <Floor towerType={towerType} />
        {walls.map((w, i) => (
          <TowerWall key={i} position={w.pos} rotation={[0,0,0]} size={w.size} towerType={towerType} />
        ))}
        {dice.map((d) => (
          <Die
            key={d.id}
            position={d.position}
            velocity={d.velocity}
            angularVelocity={d.angularVelocity}
            color={cfg.dieColor}
            resultValue={d.result}
            critType={d.result === 20 ? 'crit' : d.result === 1 ? 'fail' : null}
            onSettle={(val) => onDieSettle(d.id, val)}
          />
        ))}
      </Physics>

      <OrbitControls
        enablePan={false}
        minDistance={6}
        maxDistance={18}
        maxPolarAngle={Math.PI / 2.05}
        target={[0, -0.5, 0]}
      />
    </>
  );
}

// ─── Main Modal ───────────────────────────────────────────────────────────────

export default function Dice3DModal({ onClose, character }) {
  const [selectedTower, setSelectedTower] = useState('wooden');
  const [selectedDice, setSelectedDice]   = useState('D20');
  const [diceCount, setDiceCount]         = useState(1);
  const [modifier, setModifier]           = useState(0);
  const [dice, setDice]                   = useState([]);
  const [settled, setSettled]             = useState({});
  const [rolling, setRolling]             = useState(false);
  const [critEffect, setCritEffect]       = useState(null);
  const [rollHistory, setRollHistory]     = useState([]);
  const [showTowerPicker, setShowTowerPicker] = useState(false);
  const idRef = useRef(0);

  const diceType = DICE_TYPES.find(d => d.label === selectedDice) || DICE_TYPES[5];
  const cfg      = TOWER_CONFIGS[selectedTower];

  // Close on Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleRoll = useCallback(() => {
    if (rolling) return;
    const count   = Math.min(diceCount, 6);
    const results = Array.from({ length: count }, () => Math.floor(Math.random() * diceType.sides) + 1);

    const newDice = results.map((result, i) => ({
      id: idRef.current++,
      result,
      position: [(Math.random() - 0.5) * 2, 6 + i * 1.3, (Math.random() - 0.5) * 2],
      velocity: [(Math.random() - 0.5) * 6, -5, (Math.random() - 0.5) * 6],
      angularVelocity: [
        (Math.random() - 0.5) * 28,
        (Math.random() - 0.5) * 28,
        (Math.random() - 0.5) * 28,
      ],
    }));

    setDice(newDice);
    setSettled({});
    setRolling(true);

    // Crit effects for d20
    if (diceType.sides === 20 && count === 1) {
      if (results[0] === 20) setTimeout(() => setCritEffect('crit'), 2400);
      if (results[0] === 1)  setTimeout(() => setCritEffect('fail'), 2400);
    }

    const total = results.reduce((s, r) => s + r, 0) + modifier;
    setRollHistory(prev => [{
      dice: `${count}${diceType.label}${modifier !== 0 ? (modifier > 0 ? `+${modifier}` : modifier) : ''}`,
      results,
      total,
      sides: diceType.sides,
      ts: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    }, ...prev.slice(0, 11)]);

    setTimeout(() => setRolling(false), 3800);
  }, [rolling, diceCount, diceType, modifier]);

  const handleDieSettle = useCallback((id, val) => {
    setSettled(prev => ({ ...prev, [id]: val }));
  }, []);

  const handleClear = () => { setDice([]); setSettled({}); };

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

          {/* 3D Canvas */}
          <div className="flex-1 relative overflow-hidden" style={{ minHeight: '360px', minWidth: 0 }}>
            <Suspense fallback={
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="font-fantasy text-sm" style={{ color: 'rgba(201,169,110,0.5)' }}>Loading 3D scene...</span>
              </div>
            }>
              <Canvas shadows camera={{ position: [0, 7, 11], fov: 48 }}>
                <TowerScene towerType={selectedTower} dice={dice} onDieSettle={handleDieSettle} />
              </Canvas>
            </Suspense>

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
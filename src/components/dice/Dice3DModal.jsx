import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { Physics } from '@react-three/cannon';
import { OrbitControls, Stars, Sparkles, Text } from '@react-three/drei';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Dices, Lock, ChevronDown, ChevronUp } from 'lucide-react';
import { Die, Floor, TowerWall } from './DicePhysics';
import { TOWER_CONFIGS } from './DiceTowerScene';
import CriticalEffect from './CriticalEffect';

const DICE_TYPES = [
  { label: 'D4', sides: 4 },
  { label: 'D6', sides: 6 },
  { label: 'D8', sides: 8 },
  { label: 'D10', sides: 10 },
  { label: 'D12', sides: 12 },
  { label: 'D20', sides: 20 },
  { label: 'D100', sides: 100 },
];

function TowerScene({ towerType, dice, onDieSettle }) {
  const cfg = TOWER_CONFIGS[towerType];
  const walls = [
    { pos: [0, 2, -2.6], rot: [0, 0, 0], size: [5.2, 9, 0.3] },
    { pos: [-2.6, 2, 0], rot: [0, 0, 0], size: [0.3, 9, 5.2] },
    { pos: [2.6, 2, 0], rot: [0, 0, 0], size: [0.3, 9, 5.2] },
    { pos: [0, 2, 2.6], rot: [0, 0, 0], size: [5.2, 9, 0.3] },
  ];

  return (
    <>
      <ambientLight intensity={0.5} color={cfg.ambientColor} />
      <pointLight position={[0, 8, 0]} intensity={2} color={cfg.ambientColor} castShadow />
      <pointLight position={[0, -1, 2]} intensity={0.6} color="#ffffff" />
      <Stars radius={30} depth={10} count={200} factor={2} fade />
      {towerType === 'arcane' && <Sparkles count={50} scale={7} size={2} speed={0.4} color="#aa66ff" />}
      {towerType === 'infernal' && <Sparkles count={40} scale={7} size={3} speed={0.9} color="#ff4400" />}
      {towerType === 'crystal' && <Sparkles count={60} scale={7} size={1.5} speed={0.2} color="#00ccff" />}

      <Physics gravity={[0, -25, 0]}>
        <Floor towerType={towerType} />
        {walls.map((w, i) => (
          <TowerWall key={i} position={w.pos} rotation={w.rot} size={w.size} towerType={towerType} />
        ))}
        {dice.map((d) => (
          <Die
            key={d.id}
            position={d.position}
            velocity={d.velocity}
            angularVelocity={d.angularVelocity}
            color={cfg.dieColor}
            resultValue={d.result}
            onSettle={(val) => onDieSettle(d.id, val)}
          />
        ))}
      </Physics>

      <OrbitControls
        enablePan={false}
        minDistance={6}
        maxDistance={16}
        maxPolarAngle={Math.PI / 2.05}
        target={[0, -0.5, 0]}
      />
    </>
  );
}

export default function Dice3DModal({ onClose, character }) {
  const [selectedTower, setSelectedTower] = useState('wooden');
  const [selectedDice, setSelectedDice] = useState('D20');
  const [diceCount, setDiceCount] = useState(1);
  const [modifier, setModifier] = useState(0);
  const [dice, setDice] = useState([]);
  const [settled, setSettled] = useState({});
  const [rolling, setRolling] = useState(false);
  const [critEffect, setCritEffect] = useState(null); // 'crit' | 'fail' | null
  const [rollHistory, setRollHistory] = useState([]);
  const [showTowerPicker, setShowTowerPicker] = useState(false);
  const idRef = useRef(0);
  const settleCount = useRef(0);

  const diceType = DICE_TYPES.find(d => d.label === selectedDice) || DICE_TYPES[5];
  const cfg = TOWER_CONFIGS[selectedTower];

  const handleRoll = useCallback(() => {
    if (rolling) return;
    const count = Math.min(diceCount, 6);
    const results = Array.from({ length: count }, () => Math.floor(Math.random() * diceType.sides) + 1);
    const newDice = results.map((result, i) => ({
      id: idRef.current++,
      result,
      position: [(Math.random() - 0.5) * 2, 5 + i * 1.2, (Math.random() - 0.5) * 2],
      velocity: [(Math.random() - 0.5) * 5, -4, (Math.random() - 0.5) * 5],
      angularVelocity: [
        (Math.random() - 0.5) * 25,
        (Math.random() - 0.5) * 25,
        (Math.random() - 0.5) * 25,
      ],
    }));

    settleCount.current = 0;
    setDice(newDice);
    setSettled({});
    setRolling(true);

    // Check for crits on d20
    if (diceType.sides === 20 && count === 1) {
      if (results[0] === 20) setTimeout(() => setCritEffect('crit'), 2200);
      if (results[0] === 1) setTimeout(() => setCritEffect('fail'), 2200);
    }

    const total = results.reduce((s, r) => s + r, 0) + modifier;
    setRollHistory(prev => [{
      dice: `${count}${diceType.label}${modifier !== 0 ? (modifier > 0 ? `+${modifier}` : modifier) : ''}`,
      results,
      total,
      timestamp: new Date().toLocaleTimeString(),
    }, ...prev.slice(0, 9)]);

    setTimeout(() => setRolling(false), 3500);
  }, [rolling, diceCount, diceType, modifier]);

  const handleDieSettle = useCallback((id, val) => {
    setSettled(prev => ({ ...prev, [id]: val }));
  }, []);

  const latestRoll = rollHistory[0];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)' }}
    >
      <motion.div
        initial={{ scale: 0.9, y: 30 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 30 }}
        className="relative w-full max-w-5xl mx-4 rounded-2xl overflow-hidden flex flex-col"
        style={{
          background: 'rgba(10,6,2,0.97)',
          border: '1px solid rgba(201,169,110,0.3)',
          boxShadow: `0 0 60px ${cfg.ambientColor}33, 0 0 120px rgba(0,0,0,0.8)`,
          maxHeight: '95vh',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 flex-shrink-0"
          style={{ borderBottom: '1px solid rgba(201,169,110,0.15)', background: 'rgba(8,5,2,0.8)' }}>
          <div className="flex items-center gap-3">
            <Dices className="w-5 h-5" style={{ color: cfg.ambientColor }} />
            <span className="font-fantasy font-bold text-lg" style={{ color: '#e8d5b7' }}>Dice Tower</span>
            <span className="text-xs px-2 py-0.5 rounded-full"
              style={{ background: 'rgba(40,25,5,0.7)', border: '1px solid rgba(201,169,110,0.25)', color: '#c9a96e', fontFamily: 'Cinzel, serif' }}>
              {cfg.emoji} {cfg.name}
            </span>
          </div>
          <button onClick={onClose}
            className="p-1.5 rounded-lg transition-colors"
            style={{ color: 'rgba(201,169,110,0.4)' }}
            onMouseEnter={e => e.currentTarget.style.color = '#c9a96e'}
            onMouseLeave={e => e.currentTarget.style.color = 'rgba(201,169,110,0.4)'}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden" style={{ minHeight: 0 }}>
          {/* 3D Canvas */}
          <div className="flex-1 relative" style={{ minHeight: '380px' }}>
            <Canvas shadows camera={{ position: [0, 6, 10], fov: 50 }}>
              <TowerScene towerType={selectedTower} dice={dice} onDieSettle={handleDieSettle} />
            </Canvas>

            {/* Roll result overlay */}
            <AnimatePresence>
              {latestRoll && !rolling && (
                <motion.div
                  key={latestRoll.timestamp}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="absolute bottom-4 left-1/2 -translate-x-1/2 px-6 py-3 rounded-xl text-center"
                  style={{ background: 'rgba(8,5,2,0.92)', border: '1px solid rgba(201,169,110,0.4)', minWidth: '160px' }}>
                  <div className="font-fantasy text-sm mb-0.5" style={{ color: 'rgba(201,169,110,0.6)' }}>{latestRoll.dice}</div>
                  <div className="font-fantasy-deco font-bold" style={{
                    fontSize: '2.5rem',
                    lineHeight: 1,
                    color: latestRoll.results[0] === 20 && diceType.sides === 20 ? '#f0c040' :
                      latestRoll.results[0] === 1 && diceType.sides === 20 ? '#ff4444' : '#e8d5b7',
                    textShadow: latestRoll.results[0] === 20 && diceType.sides === 20 ? '0 0 20px #f0c040' :
                      latestRoll.results[0] === 1 && diceType.sides === 20 ? '0 0 20px #ff0000' : 'none',
                  }}>
                    {latestRoll.total}
                  </div>
                  {latestRoll.results.length > 1 && (
                    <div className="text-xs mt-0.5" style={{ color: 'rgba(201,169,110,0.4)', fontFamily: 'EB Garamond, serif' }}>
                      [{latestRoll.results.join(', ')}]
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Rolling indicator */}
            <AnimatePresence>
              {rolling && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute top-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full"
                  style={{ background: 'rgba(8,5,2,0.85)', border: `1px solid ${cfg.ambientColor}66` }}>
                  <span className="font-fantasy text-sm" style={{ color: cfg.ambientColor }}>Rolling...</span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Controls Panel */}
          <div className="w-64 flex flex-col flex-shrink-0 overflow-y-auto"
            style={{ borderLeft: '1px solid rgba(201,169,110,0.12)', background: 'rgba(8,5,2,0.6)', padding: '1rem', gap: '1rem' }}>

            {/* Tower Picker */}
            <div>
              <button
                onClick={() => setShowTowerPicker(v => !v)}
                className="w-full flex items-center justify-between px-3 py-2 rounded-lg mb-2"
                style={{ background: 'rgba(20,13,5,0.7)', border: '1px solid rgba(180,140,90,0.2)', color: '#c9a96e', fontFamily: 'Cinzel, serif', fontSize: '0.75rem' }}>
                <span>🏰 Tower Style</span>
                {showTowerPicker ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>

              <AnimatePresence>
                {showTowerPicker && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden space-y-1.5 mb-2">
                    {Object.entries(TOWER_CONFIGS).map(([key, t]) => (
                      <button key={key}
                        onClick={() => { if (t.unlocked) { setSelectedTower(key); setShowTowerPicker(false); } }}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg transition-all text-left"
                        style={{
                          background: selectedTower === key ? 'rgba(40,25,5,0.9)' : 'rgba(15,10,3,0.7)',
                          border: `1px solid ${selectedTower === key ? 'rgba(201,169,110,0.5)' : 'rgba(100,70,20,0.2)'}`,
                          opacity: t.unlocked ? 1 : 0.5,
                          cursor: t.unlocked ? 'pointer' : 'not-allowed',
                        }}>
                        <span style={{ fontSize: '1.1rem' }}>{t.emoji}</span>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-fantasy truncate" style={{ color: '#e8d5b7' }}>{t.name}</div>
                          <div className="text-xs truncate" style={{ color: 'rgba(201,169,110,0.4)', fontFamily: 'EB Garamond, serif' }}>{t.description}</div>
                        </div>
                        {!t.unlocked && <Lock className="w-3 h-3 flex-shrink-0" style={{ color: 'rgba(201,169,110,0.4)' }} />}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="h-px" style={{ background: 'rgba(201,169,110,0.1)' }} />

            {/* Dice Type */}
            <div>
              <div className="text-xs mb-2 font-fantasy" style={{ color: 'rgba(201,169,110,0.5)', letterSpacing: '0.1em' }}>DICE TYPE</div>
              <div className="grid grid-cols-3 gap-1.5">
                {DICE_TYPES.map(d => (
                  <button key={d.label}
                    onClick={() => setSelectedDice(d.label)}
                    className="py-1.5 rounded-lg text-xs font-fantasy transition-all"
                    style={{
                      background: selectedDice === d.label ? 'rgba(60,40,10,0.9)' : 'rgba(15,10,3,0.6)',
                      border: `1px solid ${selectedDice === d.label ? cfg.ambientColor + '88' : 'rgba(100,70,20,0.2)'}`,
                      color: selectedDice === d.label ? cfg.ambientColor : 'rgba(201,169,110,0.5)',
                      boxShadow: selectedDice === d.label ? `0 0 8px ${cfg.ambientColor}33` : 'none',
                    }}>
                    {d.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Dice Count */}
            <div>
              <div className="text-xs mb-2 font-fantasy" style={{ color: 'rgba(201,169,110,0.5)', letterSpacing: '0.1em' }}>DICE COUNT</div>
              <div className="flex items-center gap-2">
                <button onClick={() => setDiceCount(v => Math.max(1, v - 1))}
                  className="w-8 h-8 rounded-lg font-bold transition-all"
                  style={{ background: 'rgba(20,13,5,0.7)', border: '1px solid rgba(180,140,90,0.2)', color: '#c9a96e' }}>−</button>
                <div className="flex-1 text-center font-fantasy text-lg font-bold" style={{ color: '#e8d5b7' }}>{diceCount}</div>
                <button onClick={() => setDiceCount(v => Math.min(6, v + 1))}
                  className="w-8 h-8 rounded-lg font-bold transition-all"
                  style={{ background: 'rgba(20,13,5,0.7)', border: '1px solid rgba(180,140,90,0.2)', color: '#c9a96e' }}>+</button>
              </div>
            </div>

            {/* Modifier */}
            <div>
              <div className="text-xs mb-2 font-fantasy" style={{ color: 'rgba(201,169,110,0.5)', letterSpacing: '0.1em' }}>MODIFIER</div>
              <div className="flex items-center gap-2">
                <button onClick={() => setModifier(v => v - 1)}
                  className="w-8 h-8 rounded-lg font-bold"
                  style={{ background: 'rgba(20,13,5,0.7)', border: '1px solid rgba(180,140,90,0.2)', color: '#c9a96e' }}>−</button>
                <div className="flex-1 text-center font-fantasy text-lg font-bold" style={{ color: modifier >= 0 ? '#86efac' : '#fca5a5' }}>
                  {modifier >= 0 ? `+${modifier}` : modifier}
                </div>
                <button onClick={() => setModifier(v => v + 1)}
                  className="w-8 h-8 rounded-lg font-bold"
                  style={{ background: 'rgba(20,13,5,0.7)', border: '1px solid rgba(180,140,90,0.2)', color: '#c9a96e' }}>+</button>
              </div>
            </div>

            {/* Roll Button */}
            <motion.button
              onClick={handleRoll}
              disabled={rolling}
              whileHover={{ scale: rolling ? 1 : 1.03 }}
              whileTap={{ scale: rolling ? 1 : 0.97 }}
              className="w-full py-3 rounded-xl font-fantasy font-bold text-base transition-all disabled:opacity-50"
              style={{
                background: rolling ? 'rgba(30,20,5,0.7)' : `linear-gradient(135deg, rgba(80,50,10,0.95), rgba(50,30,5,0.98))`,
                border: `2px solid ${rolling ? 'rgba(100,70,20,0.3)' : cfg.ambientColor + '88'}`,
                color: rolling ? 'rgba(201,169,110,0.4)' : '#f0c040',
                boxShadow: rolling ? 'none' : `0 0 20px ${cfg.ambientColor}33`,
                letterSpacing: '0.1em',
              }}>
              {rolling ? '⏳ Rolling...' : `🎲 Roll ${diceCount}${diceType.label}`}
            </motion.button>

            {/* History */}
            {rollHistory.length > 0 && (
              <div>
                <div className="text-xs mb-2 font-fantasy" style={{ color: 'rgba(201,169,110,0.5)', letterSpacing: '0.1em' }}>HISTORY</div>
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {rollHistory.map((r, i) => (
                    <div key={i} className="flex items-center justify-between px-2.5 py-1.5 rounded-lg"
                      style={{ background: 'rgba(15,10,3,0.7)', border: '1px solid rgba(100,70,20,0.15)' }}>
                      <span className="text-xs" style={{ color: 'rgba(201,169,110,0.4)', fontFamily: 'EB Garamond, serif' }}>{r.dice}</span>
                      <span className="font-fantasy font-bold text-sm" style={{
                        color: (r.results[0] === 20 && r.results.length === 1) ? '#f0c040' :
                          (r.results[0] === 1 && r.results.length === 1) ? '#ff6666' : '#e8d5b7'
                      }}>{r.total}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </motion.div>

      {/* Critical Effects */}
      <AnimatePresence>
        {critEffect && (
          <CriticalEffect type={critEffect} onDismiss={() => setCritEffect(null)} />
        )}
      </AnimatePresence>
    </motion.div>
  );
}
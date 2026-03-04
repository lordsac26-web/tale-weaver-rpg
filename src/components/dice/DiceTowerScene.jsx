import React, { useState, useRef, useCallback } from 'react';
import { Canvas } from '@react-three/fiber';
import { Physics } from '@react-three/cannon';
import { OrbitControls, Environment, Sparkles, Stars } from '@react-three/drei';
import { motion, AnimatePresence } from 'framer-motion';
import { Die, Floor, TowerWall } from './DicePhysics';

const TOWER_CONFIGS = {
  wooden: {
    name: 'Tavern Box',
    emoji: '🪵',
    color: '#8B4513',
    wallColor: '#5C3317',
    dieColor: '#c9a96e',
    ambientColor: '#ff8844',
    description: 'A classic tavern dice box',
    unlocked: true,
  },
  arcane: {
    name: 'Arcane Tower',
    emoji: '🔮',
    color: '#4B0082',
    wallColor: '#2d1654',
    dieColor: '#9b59b6',
    ambientColor: '#8844ff',
    description: 'Pulsing with magical energy',
    unlocked: true,
  },
  infernal: {
    name: 'Infernal Forge',
    emoji: '🔥',
    color: '#8B0000',
    wallColor: '#3d0a0a',
    dieColor: '#e74c3c',
    ambientColor: '#ff2200',
    description: 'Forged in hellfire',
    unlocked: false,
  },
  crystal: {
    name: 'Crystal Vault',
    emoji: '💎',
    color: '#005580',
    wallColor: '#0d2a4a',
    dieColor: '#3498db',
    ambientColor: '#00aaff',
    description: 'Carved from ancient crystal',
    unlocked: false,
  },
};

function TowerScene({ towerType, dice, onDieSettle }) {
  const cfg = TOWER_CONFIGS[towerType];
  // Box walls: back, front-left, front-right, base
  const walls = [
    { pos: [0, 2, -2.5], rot: [0, 0, 0], size: [5, 8, 0.3] },
    { pos: [-2.5, 2, 0], rot: [0, 0, 0], size: [0.3, 8, 5] },
    { pos: [2.5, 2, 0], rot: [0, 0, 0], size: [0.3, 8, 5] },
    { pos: [0, 2, 2.5], rot: [0, 0, 0], size: [5, 8, 0.3] },
  ];

  return (
    <>
      <ambientLight intensity={0.4} color={cfg.ambientColor} />
      <pointLight position={[0, 6, 0]} intensity={1.5} color={cfg.ambientColor} castShadow />
      <pointLight position={[0, -1, 0]} intensity={0.8} color="#ffffff" />

      {towerType === 'arcane' && <Sparkles count={40} scale={6} size={2} speed={0.4} color="#aa66ff" />}
      {towerType === 'infernal' && <Sparkles count={30} scale={6} size={3} speed={0.8} color="#ff4400" />}
      {towerType === 'crystal' && <Sparkles count={50} scale={6} size={1.5} speed={0.2} color="#00ccff" />}

      <Stars radius={30} depth={10} count={300} factor={2} fade />

      <Physics gravity={[0, -20, 0]}>
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
        minDistance={5}
        maxDistance={14}
        maxPolarAngle={Math.PI / 2.1}
        target={[0, -1, 0]}
      />
    </>
  );
}

export default function DiceTowerScene({ towerType, onRollComplete }) {
  const [dice, setDice] = useState([]);
  const [settled, setSettled] = useState({});
  const [rolling, setRolling] = useState(false);
  const idRef = useRef(0);

  const rollDice = useCallback((count, sides) => {
    const results = Array.from({ length: count }, () => Math.floor(Math.random() * sides) + 1);
    const newDice = results.map((result, i) => ({
      id: idRef.current++,
      result,
      position: [(Math.random() - 0.5) * 1.5, 5 + i * 0.8, (Math.random() - 0.5) * 1.5],
      velocity: [(Math.random() - 0.5) * 4, -3, (Math.random() - 0.5) * 4],
      angularVelocity: [
        (Math.random() - 0.5) * 20,
        (Math.random() - 0.5) * 20,
        (Math.random() - 0.5) * 20,
      ],
    }));
    setDice(newDice);
    setSettled({});
    setRolling(true);
    return results;
  }, []);

  const handleSettle = useCallback((id, val) => {
    setSettled(prev => {
      const next = { ...prev, [id]: val };
      return next;
    });
  }, []);

  return { dice, settled, rolling, setRolling, rollDice, handleSettle };
}

export { TowerScene, TOWER_CONFIGS };
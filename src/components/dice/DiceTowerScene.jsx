import React, { useState, useRef, useCallback, useMemo } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { Physics } from '@react-three/cannon';
import * as THREE from 'three';
import { OrbitControls as ThreeOrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { Die, Floor, TowerWall } from './DicePhysics';
import { SimpleStars, SimpleSparkles } from './SceneParticles';

export const TOWER_CONFIGS = {
  wooden: {
    name: 'Tavern Box',
    emoji: '🪵',
    dieColor: '#c9a96e',
    ambientColor: '#ff9944',
    fogColor: '#1a0a02',
    description: 'A battered tavern dice box',
    sparkles: null,
    unlocked: true,
  },
  arcane: {
    name: 'Arcane Tower',
    emoji: '🔮',
    dieColor: '#b084fc',
    ambientColor: '#8844ff',
    fogColor: '#0e0020',
    description: 'Pulsing with arcane energy',
    sparkles: { color: '#aa66ff', count: 60, size: 2, speed: 0.4 },
    unlocked: true,
  },
  infernal: {
    name: 'Infernal Forge',
    emoji: '🔥',
    dieColor: '#ff6644',
    ambientColor: '#ff2200',
    fogColor: '#1a0000',
    description: 'Forged in hellfire',
    sparkles: { color: '#ff4400', count: 50, size: 3, speed: 0.9 },
    unlocked: true,
  },
  crystal: {
    name: 'Crystal Vault',
    emoji: '💎',
    dieColor: '#60c8ff',
    ambientColor: '#00aaff',
    fogColor: '#000e1a',
    description: 'Carved from glacial crystal',
    sparkles: { color: '#00ccff', count: 70, size: 1.5, speed: 0.2 },
    unlocked: true,
  },
  elven: {
    name: 'Elven Glade',
    emoji: '🌿',
    dieColor: '#86efac',
    ambientColor: '#22c55e',
    fogColor: '#010e01',
    description: 'Woven from living wood',
    sparkles: { color: '#88ff44', count: 40, size: 1.5, speed: 0.3 },
    unlocked: true,
  },
  shadow: {
    name: 'Shadow Realm',
    emoji: '🌑',
    dieColor: '#888',
    ambientColor: '#6633cc',
    fogColor: '#020005',
    description: 'From the void between worlds',
    sparkles: { color: '#9933ff', count: 80, size: 1, speed: 0.6 },
    unlocked: true,
  },
};

// Imperative light helper
function ImperativeLight({ type = 'point', intensity = 1, position, castShadow = false, color = '#ffffff' }) {
  const light = useMemo(() => {
    let l;
    if (type === 'ambient') {
      l = new THREE.AmbientLight(color, intensity);
    } else {
      l = new THREE.PointLight(color, intensity);
      l.castShadow = castShadow;
    }
    if (position) l.position.set(...position);
    return l;
  }, [type, intensity, color, castShadow]);
  return <primitive object={light} />;
}

// Imperative OrbitControls
function ImperativeOrbitControls({ enablePan = false, minDistance = 5, maxDistance = 14, maxPolarAngle, target }) {
  const { camera, gl } = useThree();
  const controlsRef = useRef();
  React.useEffect(() => {
    const controls = new ThreeOrbitControls(camera, gl.domElement);
    controls.enablePan = enablePan;
    controls.minDistance = minDistance;
    controls.maxDistance = maxDistance;
    if (maxPolarAngle !== undefined) controls.maxPolarAngle = maxPolarAngle;
    if (target) controls.target.set(...target);
    controls.update();
    controlsRef.current = controls;
    return () => controls.dispose();
  }, [camera, gl]);
  useFrame(() => { if (controlsRef.current) controlsRef.current.update(); });
  return null;
}

function TowerScene({ towerType, dice, onDieSettle }) {
  const cfg = TOWER_CONFIGS[towerType];
  const walls = [
    { pos: [0, 2, -2.5], rot: [0, 0, 0], size: [5, 8, 0.3] },
    { pos: [-2.5, 2, 0], rot: [0, 0, 0], size: [0.3, 8, 5] },
    { pos: [2.5, 2, 0], rot: [0, 0, 0], size: [0.3, 8, 5] },
    { pos: [0, 2, 2.5], rot: [0, 0, 0], size: [5, 8, 0.3] },
  ];

  return (
    <>
      <ImperativeLight type="ambient" intensity={0.4} color={cfg.ambientColor} />
      <ImperativeLight position={[0, 6, 0]} intensity={1.5} color={cfg.ambientColor} castShadow />
      <ImperativeLight position={[0, -1, 0]} intensity={0.8} />

      {cfg.sparkles && (
        <SimpleSparkles
          count={cfg.sparkles.count}
          scale={6}
          size={cfg.sparkles.size}
          speed={cfg.sparkles.speed}
          color={cfg.sparkles.color}
        />
      )}

      <SimpleStars count={300} radius={30} />

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

      <ImperativeOrbitControls
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

export { TowerScene };
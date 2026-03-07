import React, { useRef, useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { useBox, usePlane } from '@react-three/cannon';
import * as THREE from 'three';

// Canvas-based text sprite to replace drei's <Text> (which crashes applyProps)
function DieNumber({ value, color = 'white' }) {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, 128, 128);
    ctx.fillStyle = color;
    ctx.font = 'bold 72px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(value), 64, 68);
    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    return tex;
  }, [value, color]);

  return (
    <sprite scale={[0.4, 0.4, 0.4]}>
      <spriteMaterial map={texture} transparent depthOffset={-1} />
    </sprite>
  );
}

// ─── Settle Detection ────────────────────────────────────────────────────────

function useSettle(api, onSettle, resultValue) {
  const posRef = useRef([0, 0, 0]);
  const velRef = useRef([0, 0, 0]);
  const angVelRef = useRef([0, 0, 0]);
  const settledRef = useRef(false);
  const tickRef = useRef(0);

  useEffect(() => {
    const unsubs = [
      api.position.subscribe(v => { posRef.current = v; }),
      api.velocity.subscribe(v => { velRef.current = v; }),
      api.angularVelocity.subscribe(v => { angVelRef.current = v; }),
    ];
    return () => unsubs.forEach(u => u());
  }, [api]);

  useFrame(() => {
    if (settledRef.current) return;
    const linSpeed = Math.sqrt(velRef.current.reduce((s, v) => s + v * v, 0));
    const angSpeed = Math.sqrt(angVelRef.current.reduce((s, v) => s + v * v, 0));
    if (linSpeed < 0.08 && angSpeed < 0.08) {
      tickRef.current++;
      if (tickRef.current > 35) {
        settledRef.current = true;
        onSettle && onSettle(resultValue);
      }
    } else {
      tickRef.current = 0;
    }
  });
}

// ─── Crit Glow Effect ─────────────────────────────────────────────────────────

function CritGlow({ type }) {
  const meshRef = useRef();
  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    const t = clock.getElapsedTime();
    meshRef.current.material.opacity = 0.15 + 0.1 * Math.sin(t * 4);
    meshRef.current.scale.setScalar(1.5 + 0.1 * Math.sin(t * 6));
  });
  const color = type === 'crit' ? '#f0c040' : '#ff2200';

  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[0.9, 16, 16]} />
      <meshBasicMaterial color={color} transparent opacity={0.15} side={THREE.BackSide} />
    </mesh>
  );
}

// ─── D6 Die ───────────────────────────────────────────────────────────────────

export function Die({ position, velocity, angularVelocity, color, onSettle, resultValue }) {
  const [ref, api] = useBox(() => ({
    mass: 1.2,
    position,
    velocity,
    angularVelocity,
    args: [1, 1, 1],
    material: { restitution: 0.35, friction: 0.85 },
    linearDamping: 0.25,
    angularDamping: 0.25,
  }));

  useSettle(api, onSettle, resultValue);

  const facePositions = [
    [0, 0.5, 0], [0, -0.5, 0],
    [0.5, 0, 0], [-0.5, 0, 0],
    [0, 0, 0.5], [0, 0, -0.5],
  ];
  const faceRotations = [
    [-Math.PI / 2, 0, 0], [Math.PI / 2, 0, 0],
    [0, Math.PI / 2, 0], [0, -Math.PI / 2, 0],
    [0, 0, 0], [0, Math.PI, 0],
  ];

  const isCrit = resultValue === 20;
  const isFail = resultValue === 1;
  const dieColor = isCrit ? '#c9a96e' : isFail ? '#8b0000' : color;
  const emissiveColor = isCrit ? '#c9a96e' : isFail ? '#440000' : '#000000';
  const emissiveIntensity = isCrit ? 0.4 : isFail ? 0.5 : 0;

  return (
    <group ref={ref}>
      {(isCrit || isFail) && <CritGlow type={isCrit ? 'crit' : 'fail'} />}
      <mesh castShadow>
        <boxGeometry args={[0.95, 0.95, 0.95]} />
        <meshStandardMaterial
          color={dieColor}
          roughness={0.25}
          metalness={0.5}
          emissive={emissiveColor}
          emissiveIntensity={emissiveIntensity}
        />
      </mesh>
      {[1, 2, 3, 4, 5, 6].map((face, i) => (
        <group key={face} position={facePositions[i]} rotation={faceRotations[i]}>
          <Text
            fontSize={0.26}
            color={isCrit ? '#1a0a00' : 'white'}
            anchorX="center"
            anchorY="middle"
            depthOffset={-1}
            fontWeight="bold"
          >
            {face}
          </Text>
        </group>
      ))}
    </group>
  );
}

// ─── Floor ────────────────────────────────────────────────────────────────────

const FLOOR_COLORS = {
  wooden: '#5c3010',
  arcane: '#1e0a40',
  infernal: '#3a0808',
  crystal: '#0e2040',
  elven: '#0a2810',
  shadow: '#181818',
};

export function Floor({ towerType }) {
  const [ref] = usePlane(() => ({
    rotation: [-Math.PI / 2, 0, 0],
    position: [0, -2, 0],
    material: { restitution: 0.2, friction: 0.95 },
  }));

  return (
    <mesh ref={ref} receiveShadow>
      <planeGeometry args={[20, 20]} />
      <meshStandardMaterial
        color={FLOOR_COLORS[towerType] || '#111'}
        roughness={0.95}
        metalness={0.05}
      />
    </mesh>
  );
}

// ─── Tower Wall ───────────────────────────────────────────────────────────────

const WALL_COLORS = {
  wooden: '#7a4520',
  arcane: '#2e1560',
  infernal: '#5a1010',
  crystal: '#122848',
  elven: '#103818',
  shadow: '#282828',
};

const WALL_EMISSIVES = {
  arcane: '#3d0088',
  infernal: '#440000',
  crystal: '#002255',
  elven: '#003300',
  shadow: '#110011',
  wooden: '#1a0800',
};

export function TowerWall({ position, rotation, size, towerType }) {
  const [ref] = useBox(() => ({
    type: 'Static',
    position,
    rotation,
    args: size,
    material: { restitution: 0.2, friction: 0.7 },
  }));

  return (
    <mesh ref={ref} castShadow receiveShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial
        color={WALL_COLORS[towerType] || '#222'}
        roughness={0.75}
        metalness={towerType === 'crystal' ? 0.5 : 0.15}
        emissive={WALL_EMISSIVES[towerType] || '#000'}
        emissiveIntensity={0.55}
      />
    </mesh>
  );
}
import React, { useRef, useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { useBox, usePlane } from '@react-three/cannon';
import { Text, RoundedBox } from '@react-three/drei';
import * as THREE from 'three';

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

export function Die({ position, velocity, angularVelocity, color, onSettle, resultValue, critType }) {
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
  const emissive = isCrit ? '#c9a96e' : isFail ? '#440000' : '#000000';

  return (
    <group ref={ref}>
      {(isCrit || isFail) && <CritGlow type={isCrit ? 'crit' : 'fail'} />}
      <RoundedBox args={[0.95, 0.95, 0.95]} radius={0.07} smoothness={3}>
        <meshStandardMaterial color={dieColor} roughness={0.25} metalness={0.5} emissive={emissive} emissiveIntensity={isCrit ? 0.4 : isFail ? 0.5 : 0} />
      </RoundedBox>
      {[1, 2, 3, 4, 5, 6].map((face, i) => (
        <group key={face} position={facePositions[i]} rotation={faceRotations[i]}>
          <Text fontSize={0.26} color={isCrit ? '#1a0a00' : 'white'} anchorX="center" anchorY="middle" depthOffset={-1} fontWeight="bold">
            {face}
          </Text>
        </group>
      ))}
    </group>
  );
}

// ─── Floor ────────────────────────────────────────────────────────────────────

export function Floor({ towerType }) {
  const [ref] = usePlane(() => ({
    rotation: [-Math.PI / 2, 0, 0],
    position: [0, -2, 0],
    material: { restitution: 0.2, friction: 0.95 },
  }));

  const colors = {
    wooden: '#2a1505',
    arcane: '#0e0520',
    infernal: '#1a0303',
    crystal: '#060e1a',
    elven: '#050e05',
    shadow: '#050505',
  };

  return (
    <mesh ref={ref} receiveShadow>
      <planeGeometry args={[20, 20]} />
      <meshStandardMaterial color={colors[towerType] || '#111'} roughness={0.95} metalness={0.05} />
    </mesh>
  );
}

// ─── Tower Wall ───────────────────────────────────────────────────────────────

export function TowerWall({ position, rotation, size, towerType }) {
  const [ref] = useBox(() => ({
    type: 'Static',
    position,
    rotation,
    args: size,
    material: { restitution: 0.2, friction: 0.7 },
  }));

  const colors = {
    wooden: '#3d1f08',
    arcane: '#1e0d40',
    infernal: '#3d0808',
    crystal: '#0a1e38',
    elven: '#0a2010',
    shadow: '#0a0a0a',
  };

  const emissives = {
    arcane: '#220055',
    infernal: '#220000',
    crystal: '#001133',
    elven: '#001100',
    shadow: '#000000',
    wooden: '#000000',
  };

  return (
    <mesh ref={ref} castShadow receiveShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial
        color={colors[towerType] || '#222'}
        roughness={0.75}
        metalness={towerType === 'crystal' ? 0.5 : 0.15}
        emissive={emissives[towerType] || '#000'}
        emissiveIntensity={0.3}
      />
    </mesh>
  );
}
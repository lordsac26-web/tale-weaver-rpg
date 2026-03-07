import React, { useRef, useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { useBox, usePlane } from '@react-three/cannon';
import { Text } from '@react-three/drei';
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
  const geo = useMemo(() => new THREE.SphereGeometry(0.9, 16, 16), []);
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.15, side: THREE.BackSide }), [color]);

  return <mesh ref={meshRef} geometry={geo} material={mat} />;
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
  const dieMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: dieColor, roughness: 0.25, metalness: 0.5,
    emissive: new THREE.Color(emissive),
    emissiveIntensity: isCrit ? 0.4 : isFail ? 0.5 : 0,
  }), [dieColor, emissive, isCrit, isFail]);

  return (
    <group ref={ref}>
      {(isCrit || isFail) && <CritGlow type={isCrit ? 'crit' : 'fail'} />}
      <RoundedBox args={[0.95, 0.95, 0.95]} radius={0.07} smoothness={3} material={dieMat} />
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
    wooden: '#5c3010',
    arcane: '#1e0a40',
    infernal: '#3a0808',
    crystal: '#0e2040',
    elven: '#0a2810',
    shadow: '#181818',
  };

  const geo = useMemo(() => new THREE.PlaneGeometry(20, 20), []);
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ color: colors[towerType] || '#111', roughness: 0.95, metalness: 0.05 }), [towerType]);

  return <mesh ref={ref} geometry={geo} material={mat} receiveShadow />;
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
    wooden: '#7a4520',
    arcane: '#2e1560',
    infernal: '#5a1010',
    crystal: '#122848',
    elven: '#103818',
    shadow: '#282828',
  };

  const emissives = {
    arcane: '#3d0088',
    infernal: '#440000',
    crystal: '#002255',
    elven: '#003300',
    shadow: '#110011',
    wooden: '#1a0800',
  };

  const geo = useMemo(() => new THREE.BoxGeometry(...size), [size[0], size[1], size[2]]);
  const mat = useMemo(() => new THREE.MeshStandardMaterial({
    color: colors[towerType] || '#222',
    roughness: 0.75,
    metalness: towerType === 'crystal' ? 0.5 : 0.15,
    emissive: new THREE.Color(emissives[towerType] || '#000'),
    emissiveIntensity: 0.55,
  }), [towerType]);

  return <mesh ref={ref} geometry={geo} material={mat} castShadow receiveShadow />;
}
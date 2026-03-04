import React, { useRef, useEffect, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { useBox, usePlane, useCompoundBody } from '@react-three/cannon';
import { Text, RoundedBox, MeshDistortMaterial, Stars } from '@react-three/drei';
import * as THREE from 'three';

// D6 face value map: which face is "up" based on rotation
function getFaceUp(rotation) {
  const [x, y, z] = rotation;
  const rx = ((x % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  const rz = ((z % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  // Approximate face detection from rotation
  if (rx < 0.5 || rx > 5.8) return 1;
  if (Math.abs(rx - Math.PI) < 0.5) return 6;
  if (rz < 0.5 || rz > 5.8) return 3;
  if (Math.abs(rz - Math.PI) < 0.5) return 4;
  if (rx > 1.0 && rx < 2.2) return 2;
  return 5;
}

export function Die({ position, velocity, angularVelocity, color, onSettle, diceType = 'd6', resultValue }) {
  const [ref, api] = useBox(() => ({
    mass: 1,
    position,
    velocity,
    angularVelocity,
    args: [1, 1, 1],
    material: { restitution: 0.3, friction: 0.8 },
  }));

  const posRef = useRef([0, 0, 0]);
  const velRef = useRef([0, 0, 0]);
  const rotRef = useRef([0, 0, 0]);
  const settledRef = useRef(false);
  const settleTick = useRef(0);

  useEffect(() => {
    api.position.subscribe(v => { posRef.current = v; });
    api.velocity.subscribe(v => { velRef.current = v; });
    api.rotation.subscribe(v => { rotRef.current = v; });
  }, [api]);

  useFrame(() => {
    if (settledRef.current) return;
    const speed = Math.sqrt(velRef.current.reduce((s, v) => s + v * v, 0));
    if (speed < 0.05) {
      settleTick.current++;
      if (settleTick.current > 30) {
        settledRef.current = true;
        onSettle && onSettle(resultValue || getFaceUp(rotRef.current));
      }
    } else {
      settleTick.current = 0;
    }
  });

  const faceColors = ['#ff4444', '#ff8800', '#ffdd00', '#44ff44', '#4488ff', '#aa44ff'];

  return (
    <group ref={ref}>
      <RoundedBox args={[0.95, 0.95, 0.95]} radius={0.08} smoothness={4}>
        <meshStandardMaterial color={color} roughness={0.3} metalness={0.4} />
      </RoundedBox>
      {/* Face dots/numbers - simplified as colored faces */}
      {[1, 2, 3, 4, 5, 6].map((face, i) => {
        const positions = [
          [0, 0.49, 0], [0, -0.49, 0],
          [0.49, 0, 0], [-0.49, 0, 0],
          [0, 0, 0.49], [0, 0, -0.49]
        ];
        const rotations = [
          [-Math.PI / 2, 0, 0], [Math.PI / 2, 0, 0],
          [0, Math.PI / 2, 0], [0, -Math.PI / 2, 0],
          [0, 0, 0], [0, Math.PI, 0]
        ];
        return (
          <group key={face} position={positions[i]} rotation={rotations[i]}>
            <Text fontSize={0.28} color="white" anchorX="center" anchorY="middle" depthOffset={-1}>
              {face}
            </Text>
          </group>
        );
      })}
    </group>
  );
}

export function Floor({ towerType }) {
  const [ref] = usePlane(() => ({
    rotation: [-Math.PI / 2, 0, 0],
    position: [0, -2, 0],
    material: { restitution: 0.3, friction: 0.9 },
  }));

  const floorColor = towerType === 'arcane' ? '#1a0a2e' :
    towerType === 'infernal' ? '#1a0505' :
    towerType === 'crystal' ? '#0a1a2e' : '#1a0f05';

  return (
    <mesh ref={ref} receiveShadow>
      <planeGeometry args={[20, 20]} />
      <meshStandardMaterial color={floorColor} roughness={0.9} />
    </mesh>
  );
}

export function TowerWall({ position, rotation, size, towerType }) {
  const [ref] = useBox(() => ({
    type: 'Static',
    position,
    rotation,
    args: size,
  }));

  const wallColor = towerType === 'arcane' ? '#2d1654' :
    towerType === 'infernal' ? '#3d0a0a' :
    towerType === 'crystal' ? '#0d2a4a' : '#2d1f0a';

  return (
    <mesh ref={ref} castShadow receiveShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial color={wallColor} roughness={0.7} metalness={0.2} />
    </mesh>
  );
}
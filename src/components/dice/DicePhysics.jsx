import React, { useRef, useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { useBox, usePlane } from '@react-three/cannon';
import * as THREE from 'three';

// ─── Imperative Mesh Helper ──────────────────────────────────────────────────
// Creates a THREE.Mesh imperatively to bypass R3F applyProps reconciler crashes

function ImperativeMesh({ geometry, materialProps, castShadow, receiveShadow, meshRef }) {
  const mesh = useMemo(() => {
    const mat = new THREE.MeshStandardMaterial(materialProps);
    const m = new THREE.Mesh(geometry, mat);
    m.castShadow = !!castShadow;
    m.receiveShadow = !!receiveShadow;
    return m;
  }, [geometry, materialProps, castShadow, receiveShadow]);

  return <primitive ref={meshRef} object={mesh} />;
}

// ─── Imperative Sprite for Die Numbers ───────────────────────────────────────

function DieNumber({ value, color = 'white' }) {
  const sprite = useMemo(() => {
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
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false });
    const s = new THREE.Sprite(mat);
    s.scale.set(0.4, 0.4, 0.4);
    return s;
  }, [value, color]);

  return <primitive object={sprite} />;
}

// ─── Settle Detection ────────────────────────────────────────────────────────

function useSettle(api, onSettle, resultValue) {
  const velRef = useRef([0, 0, 0]);
  const angVelRef = useRef([0, 0, 0]);
  const settledRef = useRef(false);
  const tickRef = useRef(0);

  useEffect(() => {
    const unsubs = [
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
  const glowColor = type === 'crit' ? '#f0c040' : '#ff2200';

  const mesh = useMemo(() => {
    const geo = new THREE.SphereGeometry(0.9, 16, 16);
    const mat = new THREE.MeshBasicMaterial({
      color: glowColor,
      transparent: true,
      opacity: 0.15,
      side: THREE.BackSide,
    });
    return new THREE.Mesh(geo, mat);
  }, [glowColor]);

  useFrame(({ clock }) => {
    if (!mesh) return;
    const t = clock.getElapsedTime();
    mesh.material.opacity = 0.15 + 0.1 * Math.sin(t * 4);
    mesh.scale.setScalar(1.5 + 0.1 * Math.sin(t * 6));
  });

  return <primitive object={mesh} />;
}

// ─── D6 Die ───────────────────────────────────────────────────────────────────

const boxGeo = new THREE.BoxGeometry(0.95, 0.95, 0.95);

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

  const dieMesh = useMemo(() => {
    const mat = new THREE.MeshStandardMaterial({
      color: dieColor,
      roughness: 0.25,
      metalness: 0.5,
      emissive: emissiveColor,
      emissiveIntensity,
    });
    const m = new THREE.Mesh(boxGeo, mat);
    m.castShadow = true;
    return m;
  }, [dieColor, emissiveColor, emissiveIntensity]);

  return (
    <group ref={ref}>
      {(isCrit || isFail) && <CritGlow type={isCrit ? 'crit' : 'fail'} />}
      <primitive object={dieMesh} />
      {[1, 2, 3, 4, 5, 6].map((face, i) => (
        <group key={face} position={facePositions[i]} rotation={faceRotations[i]}>
          <DieNumber value={face} color={isCrit ? '#1a0a00' : 'white'} />
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

const floorGeo = new THREE.PlaneGeometry(20, 20);

export function Floor({ towerType }) {
  const [ref] = usePlane(() => ({
    rotation: [-Math.PI / 2, 0, 0],
    position: [0, -2, 0],
    material: { restitution: 0.2, friction: 0.95 },
  }));

  const mesh = useMemo(() => {
    const mat = new THREE.MeshStandardMaterial({
      color: FLOOR_COLORS[towerType] || '#111',
      roughness: 0.95,
      metalness: 0.05,
    });
    const m = new THREE.Mesh(floorGeo, mat);
    m.receiveShadow = true;
    return m;
  }, [towerType]);

  return (
    <group ref={ref}>
      <primitive object={mesh} />
    </group>
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

  const mesh = useMemo(() => {
    const geo = new THREE.BoxGeometry(...size);
    const mat = new THREE.MeshStandardMaterial({
      color: WALL_COLORS[towerType] || '#222',
      roughness: 0.75,
      metalness: towerType === 'crystal' ? 0.5 : 0.15,
      emissive: WALL_EMISSIVES[towerType] || '#000',
      emissiveIntensity: 0.55,
    });
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
  }, [size, towerType]);

  return (
    <group ref={ref}>
      <primitive object={mesh} />
    </group>
  );
}
import React, { useRef, useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';

// Fully imperative star field — uses <primitive> to bypass applyProps
export function SimpleStars({ count = 250, radius = 35 }) {
  const points = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const r = radius * (0.4 + Math.random() * 0.6);
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);
    }
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      color: '#ffffff',
      size: 0.3,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.7,
    });
    return new THREE.Points(geo, mat);
  }, [count, radius]);

  return <primitive object={points} />;
}

// Fully imperative sparkles — uses <primitive> to bypass applyProps
export function SimpleSparkles({ count = 50, scale = 6, color = '#ffffff', size = 2, speed = 0.4 }) {
  const ref = useRef();

  const { pointsObj, offsets } = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const off = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * scale;
      positions[i * 3 + 1] = (Math.random() - 0.5) * scale;
      positions[i * 3 + 2] = (Math.random() - 0.5) * scale;
      off[i] = Math.random() * Math.PI * 2;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      color: new THREE.Color(color),
      size: size * 0.05,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const obj = new THREE.Points(geo, mat);
    return { pointsObj: obj, offsets: off };
  }, [count, scale, color, size]);

  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.getElapsedTime() * speed;
    const posArr = ref.current.geometry.attributes.position.array;
    for (let i = 0; i < count; i++) {
      posArr[i * 3 + 1] += Math.sin(t + offsets[i]) * 0.002;
    }
    ref.current.geometry.attributes.position.needsUpdate = true;
  });

  return <primitive ref={ref} object={pointsObj} />;
}
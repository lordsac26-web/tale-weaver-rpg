import React, { useRef, useEffect, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';

// ─── Pure vanilla Three.js dice scene — no R3F at all ────────────────────────
// This bypasses the applyProps crash entirely by using raw Three.js APIs.

const FLOOR_COLORS = {
  wooden: '#5c3010', arcane: '#1e0a40', infernal: '#3a0808',
  crystal: '#0e2040', elven: '#0a2810', shadow: '#181818',
};
const WALL_COLORS = {
  wooden: '#7a4520', arcane: '#2e1560', infernal: '#5a1010',
  crystal: '#122848', elven: '#103818', shadow: '#282828',
};
const WALL_EMISSIVES = {
  wooden: '#1a0800', arcane: '#3d0088', infernal: '#440000',
  crystal: '#002255', elven: '#003300', shadow: '#110011',
};

function createDieMesh(color, resultValue) {
  const isCrit = resultValue === 20;
  const isFail = resultValue === 1;
  const dieColor = isCrit ? '#c9a96e' : isFail ? '#8b0000' : color;
  const emissive = isCrit ? '#c9a96e' : isFail ? '#440000' : '#000000';
  const emissiveIntensity = isCrit ? 0.4 : isFail ? 0.5 : 0;

  const geo = new THREE.BoxGeometry(0.95, 0.95, 0.95);
  const mat = new THREE.MeshStandardMaterial({
    color: dieColor, roughness: 0.25, metalness: 0.5,
    emissive, emissiveIntensity,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;

  // Add face number sprites
  const facePositions = [
    [0, 0.5, 0], [0, -0.5, 0], [0.5, 0, 0],
    [-0.5, 0, 0], [0, 0, 0.5], [0, 0, -0.5],
  ];
  const faceRotations = [
    [-Math.PI/2,0,0], [Math.PI/2,0,0], [0,Math.PI/2,0],
    [0,-Math.PI/2,0], [0,0,0], [0,Math.PI,0],
  ];
  for (let i = 0; i < 6; i++) {
    const canvas = document.createElement('canvas');
    canvas.width = 128; canvas.height = 128;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, 128, 128);
    ctx.fillStyle = isCrit ? '#1a0a00' : 'white';
    ctx.font = 'bold 72px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(i + 1), 64, 68);
    const tex = new THREE.CanvasTexture(canvas);
    const spriteMat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false });
    const sprite = new THREE.Sprite(spriteMat);
    sprite.scale.set(0.4, 0.4, 0.4);
    const group = new THREE.Group();
    group.position.set(...facePositions[i]);
    group.rotation.set(...faceRotations[i]);
    group.add(sprite);
    mesh.add(group);
  }

  // Glow for crits
  if (isCrit || isFail) {
    const glowGeo = new THREE.SphereGeometry(0.9, 16, 16);
    const glowMat = new THREE.MeshBasicMaterial({
      color: isCrit ? '#f0c040' : '#ff2200',
      transparent: true, opacity: 0.15, side: THREE.BackSide,
    });
    const glow = new THREE.Mesh(glowGeo, glowMat);
    glow.scale.setScalar(1.5);
    glow.userData.isGlow = true;
    mesh.add(glow);
  }

  return mesh;
}

function createStars(count, radius) {
  const geo = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const r = radius * (0.4 + Math.random() * 0.6);
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    positions[i*3] = r * Math.sin(phi) * Math.cos(theta);
    positions[i*3+1] = r * Math.sin(phi) * Math.sin(theta);
    positions[i*3+2] = r * Math.cos(phi);
  }
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.PointsMaterial({ color: '#ffffff', size: 0.3, sizeAttenuation: true, transparent: true, opacity: 0.7 });
  return new THREE.Points(geo, mat);
}

function createSparkles(count, scale, color, size) {
  const geo = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    positions[i*3] = (Math.random() - 0.5) * scale;
    positions[i*3+1] = (Math.random() - 0.5) * scale;
    positions[i*3+2] = (Math.random() - 0.5) * scale;
  }
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.PointsMaterial({
    color: new THREE.Color(color), size: size * 0.05, sizeAttenuation: true,
    transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false,
  });
  return new THREE.Points(geo, mat);
}

// ─── Simple physics simulation (no cannon-es needed) ─────────────────────────
// Each die is a rigid body with position, velocity, angular velocity.
// We do basic gravity + floor/wall collision + damping.

function createPhysicsDie(pos, vel, angVel) {
  return {
    position: new THREE.Vector3(...pos),
    velocity: new THREE.Vector3(...vel),
    angularVelocity: new THREE.Euler(...angVel),
    settled: false,
    settleCount: 0,
  };
}

function stepPhysics(body, dt) {
  const gravity = -28;
  body.velocity.y += gravity * dt;

  // Damping
  body.velocity.multiplyScalar(0.995);
  body.angularVelocity.x *= 0.99;
  body.angularVelocity.y *= 0.99;
  body.angularVelocity.z *= 0.99;

  body.position.add(body.velocity.clone().multiplyScalar(dt));

  // Floor collision at y = -1.5 (die half-size is ~0.475)
  const floorY = -1.5;
  if (body.position.y < floorY) {
    body.position.y = floorY;
    body.velocity.y = -body.velocity.y * 0.35;
    body.velocity.x *= 0.85;
    body.velocity.z *= 0.85;
    body.angularVelocity.x *= 0.8;
    body.angularVelocity.z *= 0.8;
  }

  // Wall collisions
  const wallLimit = 2.1;
  if (body.position.x < -wallLimit) { body.position.x = -wallLimit; body.velocity.x = Math.abs(body.velocity.x) * 0.3; }
  if (body.position.x > wallLimit)  { body.position.x = wallLimit;  body.velocity.x = -Math.abs(body.velocity.x) * 0.3; }
  if (body.position.z < -wallLimit) { body.position.z = -wallLimit; body.velocity.z = Math.abs(body.velocity.z) * 0.3; }
  if (body.position.z > wallLimit)  { body.position.z = wallLimit;  body.velocity.z = -Math.abs(body.velocity.z) * 0.3; }

  // Settle detection
  const speed = body.velocity.length();
  const angSpeed = Math.abs(body.angularVelocity.x) + Math.abs(body.angularVelocity.y) + Math.abs(body.angularVelocity.z);
  if (speed < 0.08 && angSpeed < 0.08) {
    body.settleCount++;
    if (body.settleCount > 40) body.settled = true;
  } else {
    body.settleCount = 0;
  }
}

// ─── React component that manages the vanilla Three.js scene ─────────────────

export default function VanillaThreeScene({ towerType, towerConfig, dice, onAllSettled }) {
  const containerRef = useRef(null);
  const sceneRef = useRef(null);
  const rendererRef = useRef(null);
  const cameraRef = useRef(null);
  const controlsRef = useRef(null);
  const animIdRef = useRef(null);
  const diceGroupRef = useRef(null);
  const dieBodiesRef = useRef([]);
  const clockRef = useRef(new THREE.Clock());
  const settledRef = useRef(false);
  const sparklesRef = useRef(null);

  // Initialize scene once
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(48, container.clientWidth / container.clientHeight, 0.1, 100);
    camera.position.set(0, 7, 11);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enablePan = false;
    controls.minDistance = 6;
    controls.maxDistance = 18;
    controls.maxPolarAngle = Math.PI / 2.05;
    controls.target.set(0, -0.5, 0);
    controls.update();
    controlsRef.current = controls;

    // Dice container
    const diceGroup = new THREE.Group();
    scene.add(diceGroup);
    diceGroupRef.current = diceGroup;

    // Stars
    scene.add(createStars(250, 35));

    // Resize handler
    const onResize = () => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', onResize);

    // Animation loop
    const animate = () => {
      animIdRef.current = requestAnimationFrame(animate);
      const dt = Math.min(clockRef.current.getDelta(), 0.05);
      const elapsed = clockRef.current.getElapsedTime();

      // Step physics for each die
      const bodies = dieBodiesRef.current;
      const meshes = diceGroupRef.current?.children || [];
      for (let i = 0; i < bodies.length; i++) {
        const body = bodies[i];
        if (!body || body.settled) continue;
        stepPhysics(body, dt);
        const mesh = meshes[i];
        if (mesh) {
          mesh.position.copy(body.position);
          mesh.rotation.x += body.angularVelocity.x * dt;
          mesh.rotation.y += body.angularVelocity.y * dt;
          mesh.rotation.z += body.angularVelocity.z * dt;
        }
      }

      // Animate glow
      meshes.forEach(mesh => {
        mesh.children.forEach(child => {
          if (child.userData?.isGlow) {
            child.material.opacity = 0.15 + 0.1 * Math.sin(elapsed * 4);
            child.scale.setScalar(1.5 + 0.1 * Math.sin(elapsed * 6));
          }
        });
      });

      // Animate sparkles
      if (sparklesRef.current) {
        const posArr = sparklesRef.current.geometry.attributes.position.array;
        for (let i = 0; i < posArr.length / 3; i++) {
          posArr[i*3+1] += Math.sin(elapsed * 0.4 + i) * 0.002;
        }
        sparklesRef.current.geometry.attributes.position.needsUpdate = true;
      }

      // Check if all settled
      if (bodies.length > 0 && !settledRef.current) {
        const allDone = bodies.every(b => b.settled);
        if (allDone) {
          settledRef.current = true;
          onAllSettled?.();
        }
      }

      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      window.removeEventListener('resize', onResize);
      cancelAnimationFrame(animIdRef.current);
      controls.dispose();
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  // Update tower theme (lights, floor, walls, sparkles)
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    // Remove old tower elements
    const toRemove = [];
    scene.children.forEach(child => {
      if (child.userData?.isTowerElement) toRemove.push(child);
    });
    toRemove.forEach(c => { scene.remove(c); c.traverse?.(o => o.geometry?.dispose()); });

    const cfg = towerConfig;
    const tt = towerType;

    // Lights
    const ambient = new THREE.AmbientLight('#ffffff', 1.5);
    ambient.userData.isTowerElement = true;
    scene.add(ambient);

    const addPLight = (pos, intensity, castShadow = false) => {
      const p = new THREE.PointLight('#ffffff', intensity);
      p.position.set(...pos);
      p.castShadow = castShadow;
      p.userData.isTowerElement = true;
      scene.add(p);
    };
    addPLight([0, 8, 0], 3.5, true);
    addPLight([0, -1, 2], 1.8);
    addPLight([3, 4, 3], 1.2);
    addPLight([-3, 4, -3], 1.0);

    // Floor
    const floorGeo = new THREE.PlaneGeometry(20, 20);
    const floorMat = new THREE.MeshStandardMaterial({ color: FLOOR_COLORS[tt] || '#111', roughness: 0.95, metalness: 0.05 });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -2;
    floor.receiveShadow = true;
    floor.userData.isTowerElement = true;
    scene.add(floor);

    // Walls (invisible but visual)
    const wallPositions = [
      { pos: [0, 2, -2.6], size: [5.2, 9, 0.3] },
      { pos: [-2.6, 2, 0], size: [0.3, 9, 5.2] },
      { pos: [2.6, 2, 0], size: [0.3, 9, 5.2] },
      { pos: [0, 2, 2.6], size: [5.2, 9, 0.3] },
    ];
    wallPositions.forEach(w => {
      const geo = new THREE.BoxGeometry(...w.size);
      const mat = new THREE.MeshStandardMaterial({
        color: WALL_COLORS[tt] || '#222', roughness: 0.75,
        metalness: tt === 'crystal' ? 0.5 : 0.15,
        emissive: WALL_EMISSIVES[tt] || '#000', emissiveIntensity: 0.55,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(...w.pos);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.userData.isTowerElement = true;
      scene.add(mesh);
    });

    // Sparkles
    if (cfg?.sparkles) {
      const sp = createSparkles(cfg.sparkles.count, 7, cfg.sparkles.color, cfg.sparkles.size);
      sp.userData.isTowerElement = true;
      sparklesRef.current = sp;
      scene.add(sp);
    } else {
      sparklesRef.current = null;
    }
  }, [towerType, towerConfig]);

  // Update dice when they change
  useEffect(() => {
    const group = diceGroupRef.current;
    if (!group) return;

    // Clear old dice
    while (group.children.length) {
      const child = group.children[0];
      group.remove(child);
      child.traverse(o => { o.geometry?.dispose(); o.material?.dispose?.(); });
    }

    settledRef.current = false;
    const cfg = towerConfig;

    const bodies = dice.map(d => createPhysicsDie(d.position, d.velocity, d.angularVelocity));
    dieBodiesRef.current = bodies;

    dice.forEach(d => {
      const mesh = createDieMesh(cfg?.dieColor || '#c9a96e', d.result);
      mesh.position.set(...d.position);
      group.add(mesh);
    });
  }, [dice, towerConfig]);

  return (
    <div ref={containerRef} className="absolute inset-0" style={{ background: 'transparent' }} />
  );
}
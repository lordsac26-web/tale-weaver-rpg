import React, { useRef, useEffect } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { createDieMesh, getDieRadius } from './DiceGeometry';
import { buildTavernTower, buildSceneLights } from './TowerBuilder';
import { createPhysicsBody, stepPhysics, collideDice } from './TowerPhysics';

// ─── Pure vanilla Three.js dice scene — no R3F ───────────────────────────────

function createStars(count, radius) {
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
    color: '#ffffff', size: 0.25, sizeAttenuation: true,
    transparent: true, opacity: 0.6,
  });
  return new THREE.Points(geo, mat);
}

function createSparkles(count, scale, color, size) {
  const geo = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    positions[i * 3] = (Math.random() - 0.5) * scale;
    positions[i * 3 + 1] = (Math.random() - 0.5) * scale;
    positions[i * 3 + 2] = (Math.random() - 0.5) * scale;
  }
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.PointsMaterial({
    color: new THREE.Color(color), size: size * 0.05, sizeAttenuation: true,
    transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false,
  });
  return new THREE.Points(geo, mat);
}

// ─── Simple physics ───────────────────────────────────────────────────────────

function createPhysicsDie(pos, vel, angVel) {
  return {
    position: new THREE.Vector3(...pos),
    velocity: new THREE.Vector3(...vel),
    angularVelocity: new THREE.Euler(...angVel),
    settled: false,
    settleCount: 0,
  };
}

function stepPhysics(body, dt, dieRadius) {
  const gravity = -28;
  body.velocity.y += gravity * dt;
  body.velocity.multiplyScalar(0.995);
  body.angularVelocity.x *= 0.99;
  body.angularVelocity.y *= 0.99;
  body.angularVelocity.z *= 0.99;
  body.position.add(body.velocity.clone().multiplyScalar(dt));

  // Floor collision (tray floor at y = -2, die rests at -2 + radius)
  const floorY = -2 + (dieRadius || 0.5);
  if (body.position.y < floorY) {
    body.position.y = floorY;
    body.velocity.y = -body.velocity.y * 0.3;
    body.velocity.x *= 0.82;
    body.velocity.z *= 0.82;
    body.angularVelocity.x *= 0.75;
    body.angularVelocity.z *= 0.75;
  }

  // Wall collisions — tray boundaries
  const wallX = 1.4;
  const wallZBack = -1.1;
  const wallZFront = 2.0;
  if (body.position.x < -wallX) { body.position.x = -wallX; body.velocity.x = Math.abs(body.velocity.x) * 0.3; }
  if (body.position.x > wallX)  { body.position.x = wallX;  body.velocity.x = -Math.abs(body.velocity.x) * 0.3; }
  if (body.position.z < wallZBack)  { body.position.z = wallZBack;  body.velocity.z = Math.abs(body.velocity.z) * 0.3; }
  if (body.position.z > wallZFront) { body.position.z = wallZFront; body.velocity.z = -Math.abs(body.velocity.z) * 0.3; }

  const speed = body.velocity.length();
  const angSpeed = Math.abs(body.angularVelocity.x) + Math.abs(body.angularVelocity.y) + Math.abs(body.angularVelocity.z);
  if (speed < 0.08 && angSpeed < 0.08) {
    body.settleCount++;
    if (body.settleCount > 40) body.settled = true;
  } else {
    body.settleCount = 0;
  }
}

// ─── Main Scene Component ─────────────────────────────────────────────────────

// ─── Ambience presets ─────────────────────────────────────────────────────────
const AMBIENCE_PRESETS = {
  night: {
    bgColor: '#0a0502',
    fogColor: '#0a0502',
    fogDensity: 0.035,
    ambientColor: '#ffeed8',
    ambientIntensity: 0.5,
    mainLightColor: '#ffaa55',
    mainLightIntensity: 2.5,
    fillColor: '#ff8833',
    fillIntensity: 1.0,
    rimColor: '#4444aa',
    rimIntensity: 0.3,
    exposure: 0.9,
    starOpacity: 0.7,
  },
  dusk: {
    bgColor: '#120806',
    fogColor: '#120806',
    fogDensity: 0.028,
    ambientColor: '#fff0d8',
    ambientIntensity: 0.8,
    mainLightColor: '#ffcc88',
    mainLightIntensity: 3.0,
    fillColor: '#ffa855',
    fillIntensity: 1.5,
    rimColor: '#8866cc',
    rimIntensity: 0.5,
    exposure: 1.1,
    starOpacity: 0.35,
  },
  day: {
    bgColor: '#1c150e',
    fogColor: '#1c150e',
    fogDensity: 0.02,
    ambientColor: '#fffaf0',
    ambientIntensity: 1.4,
    mainLightColor: '#ffe8c0',
    mainLightIntensity: 4.0,
    fillColor: '#ffd0a0',
    fillIntensity: 2.2,
    rimColor: '#aabbdd',
    rimIntensity: 0.8,
    exposure: 1.5,
    starOpacity: 0.0,
  },
};

export default function VanillaThreeScene({ towerType, towerConfig, dice, diceSides, ambience = 'dusk' }) {
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
  const sidesRef = useRef(20);
  const lightsRef = useRef({ ambient: null, main: null, fill: null, rim: null, lanterns: [] });
  const starsRef = useRef(null);
  const ambienceRef = useRef(ambience);

  // Track sides for physics
  useEffect(() => { sidesRef.current = diceSides || 20; }, [diceSides]);

  // Initialize scene once
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#0a0502');
    scene.fog = new THREE.FogExp2('#0a0502', 0.035);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 120);
    camera.position.set(0, 5.5, 8.5);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enablePan = false;
    controls.minDistance = 5;
    controls.maxDistance = 16;
    controls.maxPolarAngle = Math.PI / 2.1;
    controls.target.set(0, 0.5, 0.8);
    controls.update();
    controlsRef.current = controls;

    // Dice container
    const diceGroup = new THREE.Group();
    scene.add(diceGroup);
    diceGroupRef.current = diceGroup;

    // Stars
    const stars = createStars(200, 40);
    scene.add(stars);
    starsRef.current = stars;

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

      const bodies = dieBodiesRef.current;
      const meshes = diceGroupRef.current?.children || [];
      const radius = getDieRadius(sidesRef.current);

      for (let i = 0; i < bodies.length; i++) {
        const body = bodies[i];
        if (!body || body.settled) continue;
        stepPhysics(body, dt, radius);
        const mesh = meshes[i];
        if (mesh) {
          mesh.position.copy(body.position);
          mesh.rotation.x += body.angularVelocity.x * dt;
          mesh.rotation.y += body.angularVelocity.y * dt;
          mesh.rotation.z += body.angularVelocity.z * dt;
        }
      }

      // Animate glows, lanterns with realistic flickering
      scene.traverse(obj => {
        if (obj.userData?.isGlow) {
          obj.material.opacity = 0.18 + 0.1 * Math.sin(elapsed * 4);
          obj.scale.setScalar(1.6 + 0.1 * Math.sin(elapsed * 6));
        }
        if (obj.userData?.isLantern) {
          // Multi-frequency flicker for realism
          const seed = obj.position.x * 13.7 + obj.position.z * 7.3;
          const flicker = 
            0.6 +
            0.15 * Math.sin(elapsed * 8.3 + seed) +
            0.1 * Math.sin(elapsed * 13.7 + seed * 2.1) +
            0.08 * Math.sin(elapsed * 23.1 + seed * 0.7) +
            0.05 * (Math.random() - 0.5); // random jitter
          obj.material.opacity = Math.max(0.4, Math.min(1.0, flicker));
          obj.scale.setScalar(0.8 + flicker * 0.35);
          // Shift color slightly for warmth variation
          const warmth = 0.95 + 0.05 * Math.sin(elapsed * 5.5 + seed);
          obj.material.color.setRGB(1.0, warmth * 0.6, warmth * 0.2);
        }
        // Flicker lantern point lights too
        if (obj.isLight && obj.userData?.isLanternLight) {
          const seed = obj.position.x * 11.3 + obj.position.z * 5.7;
          const flicker = 
            1.0 +
            0.2 * Math.sin(elapsed * 8.3 + seed) +
            0.15 * Math.sin(elapsed * 13.7 + seed * 2.1) +
            0.1 * Math.sin(elapsed * 23.1 + seed * 0.7) +
            0.08 * (Math.random() - 0.5);
          obj.intensity = obj.userData.baseIntensity * Math.max(0.5, flicker);
        }
      });

      // Animate sparkles
      if (sparklesRef.current) {
        const posArr = sparklesRef.current.geometry.attributes.position.array;
        for (let i = 0; i < posArr.length / 3; i++) {
          posArr[i * 3 + 1] += Math.sin(elapsed * 0.4 + i) * 0.002;
        }
        sparklesRef.current.geometry.attributes.position.needsUpdate = true;
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

  // Update tower theme
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    // Remove old tower elements
    const toRemove = [];
    scene.children.forEach(child => {
      if (child.userData?.isTowerElement) toRemove.push(child);
    });
    toRemove.forEach(c => {
      scene.remove(c);
      c.traverse?.(o => { o.geometry?.dispose(); o.material?.dispose?.(); });
    });

    // Build new tower + lights
    buildTavernTower(scene, towerType, towerConfig);
    const lights = buildSceneLights(scene, towerConfig);

    // Store light refs for ambience updates
    lights.forEach(l => {
      if (l.isAmbientLight) lightsRef.current.ambient = l;
      else if (l.userData?.lightRole === 'main') lightsRef.current.main = l;
      else if (l.userData?.lightRole === 'fill') lightsRef.current.fill = l;
      else if (l.userData?.lightRole === 'rim') lightsRef.current.rim = l;
    });

    // Sparkles for non-wooden towers
    if (towerConfig?.sparkles) {
      const sp = createSparkles(towerConfig.sparkles.count, 7, towerConfig.sparkles.color, towerConfig.sparkles.size);
      sp.userData.isTowerElement = true;
      sparklesRef.current = sp;
      scene.add(sp);
    } else {
      sparklesRef.current = null;
    }
  }, [towerType, towerConfig]);

  // Apply ambience changes
  useEffect(() => {
    ambienceRef.current = ambience;
    const scene = sceneRef.current;
    const renderer = rendererRef.current;
    if (!scene || !renderer) return;

    const preset = AMBIENCE_PRESETS[ambience] || AMBIENCE_PRESETS.dusk;

    scene.background = new THREE.Color(preset.bgColor);
    scene.fog = new THREE.FogExp2(preset.fogColor, preset.fogDensity);
    renderer.toneMappingExposure = preset.exposure;

    const { ambient, main, fill, rim } = lightsRef.current;
    if (ambient) { ambient.color.set(preset.ambientColor); ambient.intensity = preset.ambientIntensity; }
    if (main)    { main.color.set(preset.mainLightColor); main.intensity = preset.mainLightIntensity; }
    if (fill)    { fill.color.set(preset.fillColor); fill.intensity = preset.fillIntensity; }
    if (rim)     { rim.color.set(preset.rimColor); rim.intensity = preset.rimIntensity; }

    // Update star visibility
    if (starsRef.current) {
      starsRef.current.material.opacity = preset.starOpacity;
    }
  }, [ambience]);

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
    const sides = diceSides || 20;

    const bodies = dice.map(d => createPhysicsDie(d.position, d.velocity, d.angularVelocity));
    dieBodiesRef.current = bodies;

    dice.forEach(d => {
      const mesh = createDieMesh(sides, d.result, towerConfig?.dieColor || '#e8dcc8');
      mesh.position.set(...d.position);
      group.add(mesh);
    });
  }, [dice, towerConfig, diceSides]);

  return (
    <div ref={containerRef} className="absolute inset-0" style={{ background: '#0a0502' }} />
  );
}
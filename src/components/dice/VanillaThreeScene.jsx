import React, { useRef, useEffect } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { createDieMesh, getDieRadius } from './DiceGeometry';
import { buildTavernTower, buildSceneLights } from './TowerBuilder';

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

export default function VanillaThreeScene({ towerType, towerConfig, dice, diceSides }) {
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
    scene.add(createStars(200, 40));

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

      // Animate glows and lanterns
      scene.traverse(obj => {
        if (obj.userData?.isGlow) {
          obj.material.opacity = 0.18 + 0.1 * Math.sin(elapsed * 4);
          obj.scale.setScalar(1.6 + 0.1 * Math.sin(elapsed * 6));
        }
        if (obj.userData?.isLantern) {
          obj.material.opacity = 0.75 + 0.2 * Math.sin(elapsed * 3 + obj.position.x);
          obj.scale.setScalar(1 + 0.15 * Math.sin(elapsed * 2.5 + obj.position.x * 2));
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

    // Build new tower
    buildTavernTower(scene, towerType, towerConfig);
    buildSceneLights(scene, towerConfig);

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
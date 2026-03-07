import * as THREE from 'three';

// ─── Polyhedral Dice Geometry Factory ─────────────────────────────────────────
// Creates proper D4, D6, D8, D10, D12, D20 shapes with ivory/parchment
// material and dark serif face numbers matching tavern-style dice.

const IVORY = '#e8dcc8';
const IVORY_EDGE = '#c9b896';
const NUMBER_COLOR = '#2a1a0a';
const CRIT_COLOR = '#f0c040';
const FAIL_COLOR = '#8b0000';

// ─── Canvas number texture for a single face ─────────────────────────────────
function createNumberTexture(text, size = 256, color = NUMBER_COLOR, bgColor = null) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  if (bgColor) {
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, size, size);
  } else {
    ctx.clearRect(0, 0, size, size);
  }

  ctx.fillStyle = color;
  ctx.font = `bold ${Math.floor(size * 0.45)}px "Cinzel", "Georgia", serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(text), size / 2, size / 2 + size * 0.02);

  // Underline 6 and 9 to distinguish them
  if (text === 6 || text === 9) {
    const textW = ctx.measureText(String(text)).width;
    ctx.fillRect(size / 2 - textW / 2, size / 2 + size * 0.22, textW, size * 0.02);
  }

  return new THREE.CanvasTexture(canvas);
}

// ─── Ivory material for dice ──────────────────────────────────────────────────
function createIvoryMaterial(isCrit, isFail) {
  const color = isCrit ? CRIT_COLOR : isFail ? '#440000' : IVORY;
  const emissive = isCrit ? '#c9a96e' : isFail ? '#330000' : '#000000';
  const emissiveIntensity = isCrit ? 0.35 : isFail ? 0.4 : 0;

  return new THREE.MeshStandardMaterial({
    color,
    roughness: 0.45,
    metalness: 0.05,
    emissive,
    emissiveIntensity,
  });
}

// ─── Crit/fail glow sphere ────────────────────────────────────────────────────
function addCritGlow(mesh, isCrit) {
  const glowGeo = new THREE.SphereGeometry(0.4, 16, 16);
  const glowMat = new THREE.MeshBasicMaterial({
    color: isCrit ? '#f0c040' : '#ff2200',
    transparent: true,
    opacity: 0.18,
    side: THREE.BackSide,
  });
  const glow = new THREE.Mesh(glowGeo, glowMat);
  glow.scale.setScalar(1.6);
  glow.userData.isGlow = true;
  mesh.add(glow);
}

// ─── Global scale for all dice (smaller to fit in tower tray) ─────────────────
const DICE_SCALE = 0.45;

// ─── D4 (Tetrahedron) ────────────────────────────────────────────────────────
function createD4(result, isCrit, isFail) {
  const geo = new THREE.TetrahedronGeometry(0.65 * DICE_SCALE, 0);
  const mat = createIvoryMaterial(isCrit, isFail);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;

  const sprite = createFaceSprite(result, isCrit, isFail, 0.3);
  sprite.position.set(0, -0.08, 0);
  mesh.add(sprite);

  if (isCrit || isFail) addCritGlow(mesh, isCrit);
  mesh.userData.dieRadius = 0.65 * DICE_SCALE;
  return mesh;
}

// ─── D6 (Cube) ───────────────────────────────────────────────────────────────
function createD6(result, isCrit, isFail) {
  const size = 0.55 * DICE_SCALE;
  // Create 6 face materials with numbers baked in
  const materials = [];
  const faceValues = [1, 6, 2, 5, 3, 4]; // Three.js cube face order
  for (let i = 0; i < 6; i++) {
    const tex = createNumberTexture(faceValues[i], 256, isCrit ? '#1a0800' : NUMBER_COLOR, isCrit ? CRIT_COLOR : IVORY);
    materials.push(new THREE.MeshStandardMaterial({
      map: tex,
      roughness: 0.45,
      metalness: 0.05,
      emissive: isCrit ? '#c9a96e' : isFail ? '#330000' : '#000000',
      emissiveIntensity: isCrit ? 0.3 : isFail ? 0.35 : 0,
    }));
  }

  const geo = new THREE.BoxGeometry(size * 2, size * 2, size * 2);
  // Bevel edges slightly
  const mesh = new THREE.Mesh(geo, materials);
  mesh.castShadow = true;

  if (isCrit || isFail) addCritGlow(mesh, isCrit);
  mesh.userData.dieRadius = size;
  return mesh;
}

// ─── D8 (Octahedron) ─────────────────────────────────────────────────────────
function createD8(result, isCrit, isFail) {
  const geo = new THREE.OctahedronGeometry(0.6 * DICE_SCALE, 0);
  const mat = createIvoryMaterial(isCrit, isFail);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;

  const sprite = createFaceSprite(result, isCrit, isFail, 0.28);
  sprite.position.set(0, 0.08, 0.12);
  mesh.add(sprite);

  if (isCrit || isFail) addCritGlow(mesh, isCrit);
  mesh.userData.dieRadius = 0.6 * DICE_SCALE;
  return mesh;
}

// ─── D10 (Pentagonal trapezohedron approx — using lathe) ──────────────────────
function createD10(result, isCrit, isFail) {
  const geo = new THREE.DodecahedronGeometry(0.55 * DICE_SCALE, 0);
  geo.scale(0.85, 1.1, 0.85);
  const mat = createIvoryMaterial(isCrit, isFail);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;

  const sprite = createFaceSprite(result, isCrit, isFail, 0.25);
  sprite.position.set(0, 0.08, 0.15);
  mesh.add(sprite);

  if (isCrit || isFail) addCritGlow(mesh, isCrit);
  mesh.userData.dieRadius = 0.55 * DICE_SCALE;
  return mesh;
}

// ─── D12 (Dodecahedron) ──────────────────────────────────────────────────────
function createD12(result, isCrit, isFail) {
  const geo = new THREE.DodecahedronGeometry(0.6 * DICE_SCALE, 0);
  const mat = createIvoryMaterial(isCrit, isFail);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;

  const sprite = createFaceSprite(result, isCrit, isFail, 0.25);
  sprite.position.set(0, 0.09, 0.14);
  mesh.add(sprite);

  if (isCrit || isFail) addCritGlow(mesh, isCrit);
  mesh.userData.dieRadius = 0.6 * DICE_SCALE;
  return mesh;
}

// ─── D20 (Icosahedron) ───────────────────────────────────────────────────────
function createD20(result, isCrit, isFail) {
  const geo = new THREE.IcosahedronGeometry(0.6 * DICE_SCALE, 0);
  const mat = createIvoryMaterial(isCrit, isFail);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;

  const sprite = createFaceSprite(result, isCrit, isFail, 0.3);
  sprite.position.set(0, 0.09, 0.15);
  mesh.add(sprite);

  if (isCrit || isFail) addCritGlow(mesh, isCrit);
  mesh.userData.dieRadius = 0.6 * DICE_SCALE;
  return mesh;
}

// ─── Face number sprite helper ────────────────────────────────────────────────
function createFaceSprite(value, isCrit, isFail, scale = 0.4) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, 128, 128);

  // Draw shadow for readability
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.font = 'bold 64px "Cinzel", "Georgia", serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(value), 66, 68);

  // Draw number
  ctx.fillStyle = isCrit ? '#1a0800' : isFail ? '#ffccaa' : NUMBER_COLOR;
  ctx.fillText(String(value), 64, 66);

  // Underline 6 and 9
  if (value === 6 || value === 9) {
    const w = ctx.measureText(String(value)).width;
    ctx.fillRect(64 - w / 2, 96, w, 3);
  }

  const tex = new THREE.CanvasTexture(canvas);
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(scale, scale, scale);
  sprite.userData.isNumber = true;
  return sprite;
}

// ─── Factory: create die mesh by side count ───────────────────────────────────
export function createDieMesh(sides, result, dieColor) {
  const isCrit = sides === 20 && result === 20;
  const isFail = sides === 20 && result === 1;

  switch (sides) {
    case 4:   return createD4(result, isCrit, isFail);
    case 6:   return createD6(result, isCrit, isFail);
    case 8:   return createD8(result, isCrit, isFail);
    case 10:  return createD10(result, isCrit, isFail);
    case 12:  return createD12(result, isCrit, isFail);
    case 20:  return createD20(result, isCrit, isFail);
    case 100: {
      const tens = Math.floor((result - 1) / 10) * 10;
      const units = ((result - 1) % 10) + 1;
      const group = new THREE.Group();
      const d1 = createD10(tens === 0 ? '00' : tens, false, false);
      d1.position.set(-0.22, 0, 0);
      const d2 = createD10(units, false, false);
      d2.position.set(0.22, 0, 0);
      group.add(d1);
      group.add(d2);
      group.userData.dieRadius = 0.7 * DICE_SCALE;
      return group;
    }
    default:  return createD20(result, isCrit, isFail);
  }
}

// ─── Get physics radius for a die type ────────────────────────────────────────
export function getDieRadius(sides) {
  switch (sides) {
    case 4: return 0.65 * DICE_SCALE;
    case 6: return 0.55 * DICE_SCALE;
    case 8: return 0.6 * DICE_SCALE;
    case 10: return 0.55 * DICE_SCALE;
    case 12: return 0.6 * DICE_SCALE;
    case 20: return 0.6 * DICE_SCALE;
    case 100: return 0.7 * DICE_SCALE;
    default: return 0.6 * DICE_SCALE;
  }
}
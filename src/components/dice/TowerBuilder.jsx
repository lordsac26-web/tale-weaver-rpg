import * as THREE from 'three';

// ─── Tavern Dice Tower Builder ────────────────────────────────────────────────
// Builds an L-shaped dice tower with:
// - Wood-textured walls using uploaded texture images
// - Brass corner brackets and trim
// - Warm amber lantern glow lights
// - Open front catch tray

// Texture URLs from uploaded images
const WALL_TEXTURE_URL = 'https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/69a4e1720142630debaad046/979b57267_ChatGPTImageMar7202604_36_21AM.png';
const TOP_TEXTURE_URL = 'https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/69a4e1720142630debaad046/ed47f85cd_ChatGPTImageMar7202605_20_55AM.png';
const FRONT_TEXTURE_URL = 'https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/69a4e1720142630debaad046/fcb33eac7_ChatGPTImageMar7202605_19_51AM.png';

const textureLoader = new THREE.TextureLoader();
let wallTexLoaded = null;
let wallTexPromise = null;

// Load texture once, reuse everywhere — no cloning to avoid "no image data" warnings
function loadWallTexture() {
  if (wallTexLoaded) return wallTexLoaded;
  if (!wallTexPromise) {
    wallTexPromise = new Promise((resolve) => {
      textureLoader.load(WALL_TEXTURE_URL, (tex) => {
        tex.wrapS = THREE.RepeatWrapping;
        tex.wrapT = THREE.RepeatWrapping;
        tex.colorSpace = THREE.SRGBColorSpace;
        wallTexLoaded = tex;
        resolve(tex);
      });
    });
  }
  return null;
}

// ─── Materials ────────────────────────────────────────────────────────────────
// Use solid wood colors; texture applied once loaded via callback

function createWoodMaterial() {
  const mat = new THREE.MeshStandardMaterial({
    color: '#6a4225',
    roughness: 0.82,
    metalness: 0.05,
  });
  // Apply texture when loaded
  const tex = loadWallTexture();
  if (tex) {
    mat.map = tex;
    mat.needsUpdate = true;
  } else if (wallTexPromise) {
    wallTexPromise.then(t => { mat.map = t; mat.needsUpdate = true; });
  }
  return mat;
}

function createBrassMaterial() {
  return new THREE.MeshStandardMaterial({
    color: '#a07830',
    roughness: 0.35,
    metalness: 0.75,
    emissive: '#3a2808',
    emissiveIntensity: 0.15,
  });
}

function createFloorMaterial() {
  const mat = new THREE.MeshStandardMaterial({
    color: '#5a3820',
    roughness: 0.9,
    metalness: 0.02,
  });
  const tex = loadWallTexture();
  if (tex) {
    mat.map = tex;
    mat.needsUpdate = true;
  } else if (wallTexPromise) {
    wallTexPromise.then(t => { mat.map = t; mat.needsUpdate = true; });
  }
  return mat;
}

// ─── Build tower geometry ─────────────────────────────────────────────────────

// Tower layout (top view):
//   ┌─────┐
//   │TOWER│ ← tall section where dice enter from top
//   │     │
//   ├─────┤
//   │EXIT │ ← arch opening
//   └─┬───┘
//     │TRAY│ ← catch tray extends forward
//     └────┘

export function buildTavernTower(scene, towerType, towerConfig) {
  const group = new THREE.Group();
  group.userData.isTowerElement = true;

  const cfg = towerConfig;
  const isWooden = towerType === 'wooden';

  // Dimensions
  const towerW = 2.8;   // width
  const towerD = 2.8;   // depth
  const towerH = 5.5;   // total height
  const wallThick = 0.18;
  const trayW = 3.2;
  const trayD = 2.5;
  const trayH = 0.6;
  const trayFloorY = -2;

  // ── Floor / Catch Tray ──────────────────────────────────────────────────────
  // Tray floor
  const trayFloorGeo = new THREE.BoxGeometry(trayW, 0.12, trayD);
  const trayFloor = new THREE.Mesh(trayFloorGeo, isWooden ? createFloorMaterial() : createThemedFloor(towerType));
  trayFloor.position.set(0, trayFloorY, trayD / 2 - 0.3);
  trayFloor.receiveShadow = true;
  group.add(trayFloor);

  // Tray walls (low lip)
  const lipMat = isWooden ? createWoodMaterial() : createThemedWall(towerType);
  // Left lip
  addBox(group, [wallThick, trayH, trayD], [-trayW / 2 + wallThick / 2, trayFloorY + trayH / 2, trayD / 2 - 0.3], lipMat);
  // Right lip
  addBox(group, [wallThick, trayH, trayD], [trayW / 2 - wallThick / 2, trayFloorY + trayH / 2, trayD / 2 - 0.3], lipMat);
  // Front lip
  addBox(group, [trayW, trayH, wallThick], [0, trayFloorY + trayH / 2, trayD - 0.3 - wallThick / 2 + 0.05], lipMat);

  // ── Tower body (back section rising up) ─────────────────────────────────────
  const towerMat = isWooden ? createWoodMaterial() : createThemedWall(towerType);
  const towerBaseY = trayFloorY;

  // Back wall
  addBox(group, [towerW, towerH, wallThick], [0, towerBaseY + towerH / 2, -towerD / 2 + wallThick / 2], towerMat);
  // Left wall
  addBox(group, [wallThick, towerH, towerD], [-towerW / 2 + wallThick / 2, towerBaseY + towerH / 2, 0], towerMat);
  // Right wall
  addBox(group, [wallThick, towerH, towerD], [towerW / 2 - wallThick / 2, towerBaseY + towerH / 2, 0], towerMat);

  // Top cap — replaced with textured plane showing the bowl/hole image
  if (isWooden) {
    const topPlaneGeo = new THREE.PlaneGeometry(towerW + 0.1, towerD + 0.1);
    const topMat = new THREE.MeshStandardMaterial({
      color: '#ffffff',
      roughness: 0.7,
      metalness: 0.05,
    });
    textureLoader.load(TOP_TEXTURE_URL, (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      topMat.map = tex;
      topMat.needsUpdate = true;
    });
    const topPlane = new THREE.Mesh(topPlaneGeo, topMat);
    topPlane.rotation.x = -Math.PI / 2;
    topPlane.position.set(0, towerBaseY + towerH + 0.08, 0);
    topPlane.receiveShadow = true;
    group.add(topPlane);
  } else {
    // Non-wooden towers keep original cap
    const capGeo = new THREE.BoxGeometry(towerW, 0.12, towerD);
    const cap = new THREE.Mesh(capGeo, createThemedWall(towerType));
    cap.position.set(0, towerBaseY + towerH, 0);
    cap.receiveShadow = true;
    group.add(cap);

    const holeGeo = new THREE.CircleGeometry(0.8, 24);
    const holeMat = new THREE.MeshBasicMaterial({ color: '#0a0502' });
    const hole = new THREE.Mesh(holeGeo, holeMat);
    hole.rotation.x = -Math.PI / 2;
    hole.position.set(0, towerBaseY + towerH + 0.07, 0);
    group.add(hole);

    const rimGeo = new THREE.TorusGeometry(0.85, 0.08, 8, 24);
    const rim = new THREE.Mesh(rimGeo, createBrassMaterial());
    rim.rotation.x = -Math.PI / 2;
    rim.position.set(0, towerBaseY + towerH + 0.1, 0);
    group.add(rim);
  }

  // ── Brass corner brackets ───────────────────────────────────────────────────
  const brassMat = createBrassMaterial();
  const bracketPositions = [
    [-towerW / 2, towerBaseY, -towerD / 2],
    [towerW / 2, towerBaseY, -towerD / 2],
    [-towerW / 2, towerBaseY, towerD / 2 - 0.5],
    [towerW / 2, towerBaseY, towerD / 2 - 0.5],
    [-towerW / 2, towerBaseY + towerH, -towerD / 2],
    [towerW / 2, towerBaseY + towerH, -towerD / 2],
  ];
  bracketPositions.forEach(pos => {
    const bGeo = new THREE.BoxGeometry(0.15, 0.4, 0.15);
    const bracket = new THREE.Mesh(bGeo, brassMat);
    bracket.position.set(...pos);
    group.add(bracket);
  });

  // Horizontal brass bands
  const bandYs = [towerBaseY + 0.1, towerBaseY + towerH * 0.45, towerBaseY + towerH - 0.1];
  bandYs.forEach(y => {
    // Back band
    const bandGeo = new THREE.BoxGeometry(towerW + 0.04, 0.08, 0.04);
    const band = new THREE.Mesh(bandGeo, brassMat);
    band.position.set(0, y, -towerD / 2 + 0.02);
    group.add(band);
  });

  // ── Brass rivets / studs on walls ───────────────────────────────────────────
  const rivetGeo = new THREE.SphereGeometry(0.04, 6, 6);
  for (let row = 0; row < 3; row++) {
    const ry = towerBaseY + 0.5 + row * (towerH * 0.35);
    for (let col = -1; col <= 1; col += 2) {
      const rx = col * (towerW / 2 - 0.15);
      // On back wall
      const rivet = new THREE.Mesh(rivetGeo, brassMat);
      rivet.position.set(rx, ry, -towerD / 2 + wallThick + 0.02);
      group.add(rivet);
    }
  }

  // ── Warm lantern lights ─────────────────────────────────────────────────────
  if (isWooden) {
    // Two small lanterns on front corners
    const lanternPositions = [
      [-towerW / 2 - 0.2, towerBaseY + towerH * 0.55, towerD / 2 - 0.8],
      [towerW / 2 + 0.2, towerBaseY + towerH * 0.55, towerD / 2 - 0.8],
    ];
    lanternPositions.forEach(pos => {
      // Lantern body
      const lBody = new THREE.Mesh(
        new THREE.BoxGeometry(0.18, 0.28, 0.18),
        new THREE.MeshStandardMaterial({ color: '#5a3818', roughness: 0.7, metalness: 0.3 })
      );
      lBody.position.set(...pos);
      group.add(lBody);

      // Lantern glow
      const lGlow = new THREE.Mesh(
        new THREE.SphereGeometry(0.08, 8, 8),
        new THREE.MeshBasicMaterial({ color: '#ff9933', transparent: true, opacity: 0.9 })
      );
      lGlow.position.set(pos[0], pos[1], pos[2]);
      lGlow.userData.isLantern = true;
      group.add(lGlow);

      // Lantern point light — tagged for flickering
      const lLight = new THREE.PointLight('#ff8822', 1.5, 4);
      lLight.position.set(pos[0], pos[1], pos[2]);
      lLight.userData.isTowerElement = true;
      lLight.userData.isLanternLight = true;
      lLight.userData.baseIntensity = 1.5;
      scene.add(lLight);
    });
  }

  // ── Front portcullis texture (where dice exit the tower into the tray) ──────
  if (isWooden) {
    const frontH = towerH * 0.55;  // covers lower portion of tower front
    const frontPlaneGeo = new THREE.PlaneGeometry(towerW, frontH);
    const frontMat = new THREE.MeshStandardMaterial({
      color: '#ffffff',
      roughness: 0.7,
      metalness: 0.05,
      transparent: false,
    });
    textureLoader.load(FRONT_TEXTURE_URL, (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      frontMat.map = tex;
      frontMat.needsUpdate = true;
    });
    const frontPlane = new THREE.Mesh(frontPlaneGeo, frontMat);
    frontPlane.position.set(0, towerBaseY + frontH / 2, towerD / 2 - wallThick + 0.01);
    frontPlane.receiveShadow = true;
    group.add(frontPlane);
  }

  // ── Internal baffles (angled shelves inside tower for dice to bounce) ───────
  const baffleMat = isWooden ? createWoodMaterial() : createThemedWall(towerType);
  // Baffle 1 — angled left
  const b1 = new THREE.Mesh(new THREE.BoxGeometry(towerW * 0.7, 0.1, towerD * 0.5), baffleMat);
  b1.position.set(0.3, towerBaseY + towerH * 0.65, 0);
  b1.rotation.z = 0.35;
  b1.rotation.x = -0.15;
  group.add(b1);

  // Baffle 2 — angled right
  const b2 = new THREE.Mesh(new THREE.BoxGeometry(towerW * 0.7, 0.1, towerD * 0.5), baffleMat);
  b2.position.set(-0.3, towerBaseY + towerH * 0.35, 0);
  b2.rotation.z = -0.35;
  b2.rotation.x = 0.1;
  group.add(b2);

  scene.add(group);
  return group;
}

// ─── Helper: add a box mesh ───────────────────────────────────────────────────
function addBox(parent, size, pos, mat) {
  const geo = new THREE.BoxGeometry(...size);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(...pos);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

// ─── Themed materials for non-wooden towers ───────────────────────────────────
function createThemedWall(towerType) {
  const colors = {
    arcane: { color: '#2e1560', emissive: '#3d0088' },
    infernal: { color: '#5a1010', emissive: '#440000' },
    crystal: { color: '#122848', emissive: '#002255' },
    elven: { color: '#103818', emissive: '#003300' },
    shadow: { color: '#282828', emissive: '#110011' },
  };
  const c = colors[towerType] || colors.shadow;
  return new THREE.MeshStandardMaterial({
    color: c.color, roughness: 0.75,
    metalness: towerType === 'crystal' ? 0.5 : 0.15,
    emissive: c.emissive, emissiveIntensity: 0.4,
  });
}

function createThemedFloor(towerType) {
  const colors = {
    arcane: '#1e0a40', infernal: '#3a0808', crystal: '#0e2040',
    elven: '#0a2810', shadow: '#181818',
  };
  return new THREE.MeshStandardMaterial({
    color: colors[towerType] || '#111',
    roughness: 0.9,
    metalness: 0.05,
  });
}

// ─── Build lights for the scene ───────────────────────────────────────────────
export function buildSceneLights(scene, towerConfig) {
  const lights = [];

  // Ambient
  const ambient = new THREE.AmbientLight('#fff5e0', 0.8);
  ambient.userData.isTowerElement = true;
  scene.add(ambient);
  lights.push(ambient);

  // Main overhead — warm
  const main = new THREE.PointLight('#ffcc88', 3.0);
  main.position.set(0, 6, 2);
  main.castShadow = true;
  main.shadow.mapSize.width = 1024;
  main.shadow.mapSize.height = 1024;
  main.userData.isTowerElement = true;
  main.userData.lightRole = 'main';
  scene.add(main);
  lights.push(main);

  // Fill from front
  const fill = new THREE.PointLight('#ffa855', 1.5);
  fill.position.set(0, 0, 5);
  fill.userData.isTowerElement = true;
  fill.userData.lightRole = 'fill';
  scene.add(fill);
  lights.push(fill);

  // Subtle rim
  const rim = new THREE.PointLight('#8888ff', 0.4);
  rim.position.set(-4, 4, -4);
  rim.userData.isTowerElement = true;
  rim.userData.lightRole = 'rim';
  scene.add(rim);
  lights.push(rim);

  return lights;
}
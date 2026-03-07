import * as THREE from 'three';

// ─── Dice Tower Physics Engine ────────────────────────────────────────────────
// Simulates dice falling through an L-shaped tower with angled baffles,
// bouncing off walls, tumbling through the stairwell, and rolling out
// into a catch tray / courtyard at the bottom.

// ─── Tower geometry constants (must match TowerBuilder) ───────────────────────
const TOWER_W = 2.8;
const TOWER_D = 2.8;
const TOWER_H = 5.5;
const WALL_THICK = 0.18;
const TRAY_W = 3.2;
const TRAY_D = 2.5;
const TRAY_H = 0.6;
const TRAY_FLOOR_Y = -2;

// Tower interior bounds
const TOWER_LEFT   = -TOWER_W / 2 + WALL_THICK;
const TOWER_RIGHT  =  TOWER_W / 2 - WALL_THICK;
const TOWER_BACK   = -TOWER_D / 2 + WALL_THICK;
const TOWER_FRONT  =  TOWER_D / 2;
const TOWER_BASE_Y = TRAY_FLOOR_Y;
const TOWER_TOP_Y  = TOWER_BASE_Y + TOWER_H;

// Tray bounds
const TRAY_LEFT  = -TRAY_W / 2 + WALL_THICK;
const TRAY_RIGHT =  TRAY_W / 2 - WALL_THICK;
const TRAY_BACK  = -0.3;
const TRAY_FRONT_Z = TRAY_D - 0.3 - WALL_THICK;

// Archway opening — the gap between tower and tray
const ARCH_Y_TOP   = TOWER_BASE_Y + TOWER_H * 0.38; // arch height
const ARCH_Z_START = TOWER_FRONT - 0.1;

// ─── Baffle definitions ───────────────────────────────────────────────────────
// Each baffle is an angled plane inside the tower that dice bounce off.
// Defined as: { center, normal (pointing up/outward), halfExtents }

function createBaffleColliders() {
  // Baffle 1 — upper right, angled down-left
  // positioned at ~65% tower height, tilted right
  const b1Y = TOWER_BASE_Y + TOWER_H * 0.65;
  const b1 = {
    center: new THREE.Vector3(0.3, b1Y, 0),
    normal: new THREE.Vector3(-Math.sin(0.35), Math.cos(0.35), 0).normalize(),
    // half-width along the baffle surface
    halfW: TOWER_W * 0.35,
    halfD: TOWER_D * 0.25,
    angle: 0.35,
  };

  // Baffle 2 — lower left, angled down-right
  const b2Y = TOWER_BASE_Y + TOWER_H * 0.35;
  const b2 = {
    center: new THREE.Vector3(-0.3, b2Y, 0),
    normal: new THREE.Vector3(Math.sin(0.35), Math.cos(0.35), 0).normalize(),
    halfW: TOWER_W * 0.35,
    halfD: TOWER_D * 0.25,
    angle: -0.35,
  };

  // Baffle 3 — low ramp that directs dice out through the archway
  const b3Y = TOWER_BASE_Y + TOWER_H * 0.12;
  const b3 = {
    center: new THREE.Vector3(0, b3Y, 0.4),
    normal: new THREE.Vector3(0, Math.cos(0.25), Math.sin(0.25)).normalize(),
    halfW: TOWER_W * 0.4,
    halfD: TOWER_D * 0.35,
    angle: 0.25, // tilted forward to push dice toward exit
    isExitRamp: true,
  };

  return [b1, b2, b3];
}

const BAFFLES = createBaffleColliders();
const GRAVITY = -38;
const DAMPING = 0.994;
const ANG_DAMPING = 0.990;
const BOUNCE_RESTITUTION = 0.32;
const FRICTION = 0.75;

// ─── Physics body factory ─────────────────────────────────────────────────────
export function createPhysicsBody(pos, vel, angVel) {
  return {
    position: new THREE.Vector3(...pos),
    velocity: new THREE.Vector3(...vel),
    angularVelocity: new THREE.Vector3(...angVel),
    settled: false,
    settleCount: 0,
    inTower: true,     // starts inside tower
    exitedTower: false, // has passed through arch
    phase: 'tower',    // 'tower' | 'exit' | 'tray'
  };
}

// ─── Plane collision helper ───────────────────────────────────────────────────
function collideBaffle(body, baffle, radius) {
  const toBody = new THREE.Vector3().subVectors(body.position, baffle.center);
  const dist = toBody.dot(baffle.normal);

  // Check if within baffle extent (rough AABB on baffle surface)
  const onPlane = new THREE.Vector3().copy(toBody).addScaledVector(baffle.normal, -dist);
  if (Math.abs(onPlane.x) > baffle.halfW + radius * 0.5) return;
  if (Math.abs(onPlane.z) > baffle.halfD + radius * 0.5) return;

  if (dist < radius && dist > -radius * 0.5) {
    // Push out
    body.position.addScaledVector(baffle.normal, (radius - dist) * 1.05);

    // Reflect velocity
    const velDotN = body.velocity.dot(baffle.normal);
    if (velDotN < 0) {
      body.velocity.addScaledVector(baffle.normal, -velDotN * (1 + BOUNCE_RESTITUTION));
      // Tangential friction
      const tangent = new THREE.Vector3().copy(body.velocity)
        .addScaledVector(baffle.normal, -body.velocity.dot(baffle.normal));
      body.velocity.addScaledVector(tangent, -(1 - FRICTION) * 0.3);

      // Add spin from impact
      body.angularVelocity.x += (Math.random() - 0.5) * 6;
      body.angularVelocity.z += (Math.random() - 0.5) * 6;
    }
  }
}

// ─── Wall collision helper ────────────────────────────────────────────────────
function collideWall(body, axis, min, max, radius) {
  const p = axis === 'x' ? body.position.x : axis === 'y' ? body.position.y : body.position.z;
  const v = axis === 'x' ? body.velocity.x : axis === 'y' ? body.velocity.y : body.velocity.z;

  if (p < min + radius) {
    if (axis === 'x') { body.position.x = min + radius; body.velocity.x = Math.abs(body.velocity.x) * BOUNCE_RESTITUTION; }
    if (axis === 'y') { body.position.y = min + radius; body.velocity.y = Math.abs(body.velocity.y) * BOUNCE_RESTITUTION; }
    if (axis === 'z') { body.position.z = min + radius; body.velocity.z = Math.abs(body.velocity.z) * BOUNCE_RESTITUTION; }
    body.angularVelocity.x += (Math.random() - 0.5) * 3;
    body.angularVelocity.z += (Math.random() - 0.5) * 3;
  }
  if (p > max - radius) {
    if (axis === 'x') { body.position.x = max - radius; body.velocity.x = -Math.abs(body.velocity.x) * BOUNCE_RESTITUTION; }
    if (axis === 'y') { body.position.y = max - radius; body.velocity.y = -Math.abs(body.velocity.y) * BOUNCE_RESTITUTION; }
    if (axis === 'z') { body.position.z = max - radius; body.velocity.z = -Math.abs(body.velocity.z) * BOUNCE_RESTITUTION; }
    body.angularVelocity.x += (Math.random() - 0.5) * 3;
    body.angularVelocity.z += (Math.random() - 0.5) * 3;
  }
}

// ─── Main physics step ────────────────────────────────────────────────────────
export function stepPhysics(body, dt, dieRadius) {
  if (body.settled) return;

  const r = dieRadius || 0.25;

  // Gravity
  body.velocity.y += GRAVITY * dt;

  // Damping
  body.velocity.multiplyScalar(DAMPING);
  body.angularVelocity.multiplyScalar(ANG_DAMPING);

  // Integrate position
  body.position.addScaledVector(body.velocity, dt);

  // ── Phase detection ────────────────────────────────────────────────────────
  // Determine if die is inside tower, transitioning through arch, or in tray
  const inTowerBounds = (
    body.position.z < ARCH_Z_START + 0.3 &&
    body.position.y > TOWER_BASE_Y + r
  );

  const inTrayBounds = (
    body.position.z > TRAY_BACK - 0.2 &&
    body.position.y < ARCH_Y_TOP + r
  );

  if (body.phase === 'tower' && body.position.z > ARCH_Z_START - 0.2 && body.position.y < ARCH_Y_TOP) {
    body.phase = 'exit';
  }
  if (body.phase === 'exit' && body.position.z > TRAY_BACK + 0.3) {
    body.phase = 'tray';
  }

  // ── Collisions based on phase ──────────────────────────────────────────────

  if (body.phase === 'tower') {
    // Tower interior walls
    collideWall(body, 'x', TOWER_LEFT, TOWER_RIGHT, r);
    collideWall(body, 'z', TOWER_BACK, TOWER_FRONT, r);

    // Baffles
    for (const baffle of BAFFLES) {
      collideBaffle(body, baffle, r);
    }

    // Tower floor (only if die hasn't reached the exit ramp area)
    if (body.position.y < TOWER_BASE_Y + r && body.position.z < ARCH_Z_START - 0.5) {
      body.position.y = TOWER_BASE_Y + r;
      body.velocity.y = Math.abs(body.velocity.y) * BOUNCE_RESTITUTION;
      body.velocity.x *= FRICTION;
      body.velocity.z *= FRICTION;
      // Give a nudge toward exit
      body.velocity.z += 1.5;
    }
  }

  if (body.phase === 'exit') {
    // Transitional — limited walls, ramp pushes forward
    collideWall(body, 'x', TOWER_LEFT, TOWER_RIGHT, r);

    // Gentle exit ramp floor slope
    const rampY = TOWER_BASE_Y + Math.max(0, (ARCH_Z_START - body.position.z) * 0.3);
    if (body.position.y < rampY + r) {
      body.position.y = rampY + r;
      body.velocity.y = Math.abs(body.velocity.y) * BOUNCE_RESTITUTION * 0.5;
      body.velocity.z += 2.0; // push toward tray
      body.velocity.x *= FRICTION;
    }
  }

  if (body.phase === 'tray') {
    // Tray floor
    if (body.position.y < TRAY_FLOOR_Y + r) {
      body.position.y = TRAY_FLOOR_Y + r;
      body.velocity.y = -body.velocity.y * BOUNCE_RESTITUTION;
      body.velocity.x *= FRICTION;
      body.velocity.z *= FRICTION;
    }

    // Tray walls
    collideWall(body, 'x', TRAY_LEFT, TRAY_RIGHT, r);
    collideWall(body, 'z', TRAY_BACK, TRAY_FRONT_Z, r);
  }

  // ── Ceiling ────────────────────────────────────────────────────────────────
  if (body.position.y > TOWER_TOP_Y - r) {
    body.position.y = TOWER_TOP_Y - r;
    body.velocity.y = -Math.abs(body.velocity.y) * 0.2;
  }

  // ── Global floor safety net ────────────────────────────────────────────────
  if (body.position.y < TRAY_FLOOR_Y + r) {
    body.position.y = TRAY_FLOOR_Y + r;
    body.velocity.y = Math.abs(body.velocity.y) * BOUNCE_RESTITUTION * 0.3;
  }

  // ── Settle detection (only in tray) ────────────────────────────────────────
  if (body.phase === 'tray') {
    const speed = body.velocity.length();
    const angSpeed = body.angularVelocity.length();
    if (speed < 0.06 && angSpeed < 0.06) {
      body.settleCount++;
      if (body.settleCount > 50) {
        body.settled = true;
        body.velocity.set(0, 0, 0);
        body.angularVelocity.set(0, 0, 0);
      }
    } else {
      body.settleCount = Math.max(0, body.settleCount - 1);
    }
  }
}

// ─── Dice-to-dice collision ───────────────────────────────────────────────────
export function collideDice(bodies, radius) {
  const r2 = (radius * 2) * (radius * 2);
  for (let i = 0; i < bodies.length; i++) {
    for (let j = i + 1; j < bodies.length; j++) {
      const a = bodies[i];
      const b = bodies[j];
      if (a.settled && b.settled) continue;

      const dx = b.position.x - a.position.x;
      const dy = b.position.y - a.position.y;
      const dz = b.position.z - a.position.z;
      const distSq = dx * dx + dy * dy + dz * dz;
      const minDist = radius * 2;

      if (distSq < minDist * minDist && distSq > 0.001) {
        const dist = Math.sqrt(distSq);
        const nx = dx / dist;
        const ny = dy / dist;
        const nz = dz / dist;

        // Separate
        const overlap = (minDist - dist) * 0.5;
        if (!a.settled) { a.position.x -= nx * overlap; a.position.y -= ny * overlap; a.position.z -= nz * overlap; }
        if (!b.settled) { b.position.x += nx * overlap; b.position.y += ny * overlap; b.position.z += nz * overlap; }

        // Bounce
        const relVelX = b.velocity.x - a.velocity.x;
        const relVelY = b.velocity.y - a.velocity.y;
        const relVelZ = b.velocity.z - a.velocity.z;
        const relVelDotN = relVelX * nx + relVelY * ny + relVelZ * nz;

        if (relVelDotN < 0) {
          const impulse = relVelDotN * 0.6;
          if (!a.settled) { a.velocity.x += impulse * nx; a.velocity.y += impulse * ny; a.velocity.z += impulse * nz; }
          if (!b.settled) { b.velocity.x -= impulse * nx; b.velocity.y -= impulse * ny; b.velocity.z -= impulse * nz; }
        }
      }
    }
  }
}

// ─── Spawn position helpers ───────────────────────────────────────────────────
// Dice spawn inside the tower top opening, above the first baffle
export function getSpawnPosition(index) {
  return [
    (Math.random() - 0.5) * 0.8,                    // x: within tower width
    TOWER_TOP_Y - 0.5 - index * 0.6,                 // y: staggered drop from top
    (Math.random() - 0.5) * 0.6,                      // z: within tower depth
  ];
}

export function getSpawnVelocity() {
  return [
    (Math.random() - 0.5) * 3,    // x scatter
    -8 - Math.random() * 4,        // strong downward drop
    (Math.random() - 0.5) * 2,     // z scatter
  ];
}

export function getSpawnAngularVelocity() {
  return [
    (Math.random() - 0.5) * 25,
    (Math.random() - 0.5) * 25,
    (Math.random() - 0.5) * 25,
  ];
}
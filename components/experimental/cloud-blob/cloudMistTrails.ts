/**
 * Procedural Cloud Blob - Multi-Directional Mist Trails & Cloud Particle System
 *
 * Lightweight, zero-allocation particle pool for dynamic trailing mist,
 * spontaneous idle billow shedding in multiple directions, and micro cloud particles.
 */

import type { CloudWisp } from "./cloudTypes";

export const MAX_WISPS = 32;

export function createWispPool(capacity = MAX_WISPS): CloudWisp[] {
  const pool: CloudWisp[] = [];
  for (let i = 0; i < capacity; i++) {
    pool.push({
      active: false,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      radius: 18,
      targetRadius: 36,
      opacity: 0,
      initialOpacity: 0.32,
      age: 0,
      maxLife: 0.9,
      softness: 1.25,
      color: "#d8e6ff",
    });
  }
  return pool;
}

/**
 * Emits a single mist wisp from the pool if an inactive slot is available.
 */
export function spawnWisp(
  pool: CloudWisp[],
  x: number,
  y: number,
  vx: number,
  vy: number,
  radius: number,
  color: string,
  lifetime = 0.95,
  initialOpacity = 0.32,
  wobbleSpeed?: number,
  wobbleAmp?: number,
  isMicroParticle = false
): boolean {
  let targetIndex = -1;
  for (let i = 0; i < pool.length; i++) {
    if (!pool[i].active) {
      targetIndex = i;
      break;
    }
  }

  // If pool is full, recycle the oldest near-death particle
  if (targetIndex === -1) {
    let maxAgeRatio = -1;
    for (let i = 0; i < pool.length; i++) {
      const ratio = pool[i].age / pool[i].maxLife;
      if (ratio > maxAgeRatio) {
        maxAgeRatio = ratio;
        targetIndex = i;
      }
    }
  }

  if (targetIndex === -1) return false;

  const wisp = pool[targetIndex];
  wisp.active = true;
  wisp.x = x;
  wisp.y = y;
  wisp.vx = vx;
  wisp.vy = vy;
  wisp.radius = radius;
  wisp.targetRadius = radius * (isMicroParticle ? 1.25 : (1.45 + Math.random() * 0.45));
  wisp.age = 0;
  wisp.maxLife = Math.max(0.5, Math.min(2.2, lifetime));
  wisp.initialOpacity = initialOpacity;
  wisp.opacity = initialOpacity;
  wisp.softness = isMicroParticle ? 1.10 : 1.35;
  wisp.color = color;
  wisp.wobbleSpeed = wobbleSpeed ?? (2.5 + Math.random() * 3.5);
  wisp.wobbleAmp = wobbleAmp ?? ((Math.random() - 0.5) * 8);
  wisp.wobblePhase = Math.random() * Math.PI * 2;
  wisp.isMicroParticle = isMicroParticle;
  return true;
}

/**
 * Spawns organic, randomized mist wisps and micro cloud particles while idling.
 * Emits in DIFFERENT directions based on character billow lobes:
 * 0. Crown crest: drifts upward and curls in the breeze
 * 1. Left cheek: billows gently outwards to the left
 * 2. Right cheek: billows gently outwards to the right
 * 3. Underbelly: rolls downwards and curls outward
 * 4. Trailing tuft: buoyant wind puff drifting trailing-right
 * 5. Micro cloud particle: tiny floating round cloudlet
 */
/**
 * Spawns a rare, gentle breathing wisp while idling.
 * Emits subtle wisps from the character perimeter without continuous smoke soup.
 */
export function spawnRandomIdleWisp(
  pool: CloudWisp[],
  centerX: number,
  centerY: number,
  color: string,
  strength = 1.0
): boolean {
  const angle = Math.random() * Math.PI * 2;
  const rx = 96;
  const ry = 72;
  const cosA = Math.cos(angle);
  const sinA = Math.sin(angle);
  const dist = (rx * ry) / Math.hypot(ry * cosA, rx * sinA);

  const spawnX = centerX + cosA * (dist * 0.94);
  const spawnY = centerY + 6 + sinA * (dist * 0.94);
  const vx = cosA * 8 + (Math.random() - 0.5) * 6;
  const vy = sinA * 6 - 8;
  const radius = 10 + Math.random() * 6;
  const life = 0.55 + Math.random() * 0.25;
  const opac = 0.16 * strength;

  return spawnWisp(
    pool,
    spawnX,
    spawnY,
    vx,
    vy,
    radius,
    color,
    life,
    opac,
    2.5 + Math.random() * 2,
    (Math.random() - 0.5) * 6,
    false
  );
}

/**
 * Calculates the exact silhouette perimeter radius of the Cloud at angle theta.
 * Accounts for squash/stretch soft-body deformation.
 */
export function getCloudSilhouetteRadius(
  theta: number,
  squash = 0,
  stretch = 0
): number {
  const rx = 108 * (1 + squash * 0.45 - stretch * 0.22);
  const ry = 80 * (1 - squash * 0.35 + stretch * 0.45);
  const cosT = Math.cos(theta);
  const sinT = Math.sin(theta);
  return (rx * ry) / Math.hypot(ry * cosT, rx * sinT);
}

/**
 * Spawns a multi-directional velocity trail wisp from the CLOUD SILHOUETTE EDGE.
 * Decoupled from pointer coordinates — driven purely by physical velocity and body deformation.
 */
export function spawnDirectionalTrailWisp(
  pool: CloudWisp[],
  charX: number,
  charY: number,
  vx: number,
  vy: number,
  color: string,
  strength = 1.0,
  lifetime = 0.6,
  squash = 0,
  stretch = 0
): boolean {
  const speed = Math.hypot(vx, vy);
  // Strict threshold: no trail during slow drag or resting motion
  if (speed < 55) return false;

  const vAngle = Math.atan2(vy, vx);
  // Spawn from the trailing perimeter with slight natural curl
  const angleSpread = (Math.random() - 0.5) * 0.5;
  const trailAngle = vAngle + Math.PI + angleSpread;

  const silhouetteDist = getCloudSilhouetteRadius(trailAngle, squash, stretch);
  const spawnX = charX + Math.cos(trailAngle) * (silhouetteDist * 0.96);
  const spawnY = charY + 6 + Math.sin(trailAngle) * (silhouetteDist * 0.96);

  // Velocity carries trailing inertia with slight lateral curl
  const trailVx = -vx * 0.16 + (Math.random() - 0.5) * 10;
  const trailVy = -vy * 0.16 - 4 + (Math.random() - 0.5) * 8;

  // Body coupling: stretch produces longer wisps, squash produces shorter denser puffs
  const isMicro = Math.random() < 0.25;
  const baseR = isMicro ? 5 + Math.random() * 4 : 12 + Math.random() * 8;
  const radius = baseR * (squash > 0 ? (1 - squash * 0.2) : 1);
  const opac = Math.min(0.38, (isMicro ? 0.26 : 0.22) * strength * (1 + squash * 0.25));

  const actualLife = Math.min(0.75, Math.max(0.4, lifetime * (0.55 + Math.random() * 0.2)));

  return spawnWisp(
    pool,
    spawnX,
    spawnY,
    trailVx,
    trailVy,
    radius,
    color,
    actualLife,
    opac,
    3.0 + Math.random() * 2,
    (Math.random() - 0.5) * 8,
    isMicro
  );
}

/**
 * Spawns a brief overshoot wisp when the character decelerates or stops suddenly.
 */
export function spawnOvershootMistWisp(
  pool: CloudWisp[],
  charX: number,
  charY: number,
  prevVx: number,
  prevVy: number,
  color: string,
  strength = 1.0
): boolean {
  const speed = Math.hypot(prevVx, prevVy);
  if (speed < 60) return false;

  const leadAngle = Math.atan2(prevVy, prevVx);
  const silhouetteDist = getCloudSilhouetteRadius(leadAngle);
  const spawnX = charX + Math.cos(leadAngle) * (silhouetteDist * 0.98);
  const spawnY = charY + 6 + Math.sin(leadAngle) * (silhouetteDist * 0.98);

  const vx = prevVx * 0.14 + (Math.random() - 0.5) * 8;
  const vy = prevVy * 0.14 - 6 + (Math.random() - 0.5) * 6;

  return spawnWisp(
    pool,
    spawnX,
    spawnY,
    vx,
    vy,
    13 + Math.random() * 6,
    color,
    0.55,
    0.24 * strength,
    2.8,
    (Math.random() - 0.5) * 8,
    false
  );
}

/**
 * Spawns a tiny displaced vapor puff on wall impact from the opposite / rear side.
 */
export function spawnImpactMistWisp(
  pool: CloudWisp[],
  charX: number,
  charY: number,
  contactNormalX: number,
  contactNormalY: number,
  color: string,
  intensity = 1.0
): boolean {
  // Displaced vapor emerges from opposite side of impact
  const releaseAngle = Math.atan2(-contactNormalY, -contactNormalX) + (Math.random() - 0.5) * 0.6;
  const silhouetteDist = getCloudSilhouetteRadius(releaseAngle, 0.4, 0);

  const spawnX = charX + Math.cos(releaseAngle) * (silhouetteDist * 0.96);
  const spawnY = charY + 6 + Math.sin(releaseAngle) * (silhouetteDist * 0.96);

  const speed = 14 + Math.random() * 20 * intensity;
  const vx = Math.cos(releaseAngle) * speed;
  const vy = Math.sin(releaseAngle) * speed - 6;

  return spawnWisp(
    pool,
    spawnX,
    spawnY,
    vx,
    vy,
    11 + Math.random() * 7,
    color,
    0.55 + Math.random() * 0.2,
    0.28 * Math.min(1.2, intensity),
    3.2,
    (Math.random() - 0.5) * 10,
    false
  );
}

/**
 * Advances physics, gentle turbulence, and dissipation for active wisps.
 */
export function updateWisps(
  pool: CloudWisp[],
  dt: number,
  driftAmount = 1
): number {
  let activeCount = 0;
  const clampedDt = Math.min(dt, 0.05);

  for (let i = 0; i < pool.length; i++) {
    const w = pool[i];
    if (!w.active) continue;

    w.age += clampedDt;
    if (w.age >= w.maxLife) {
      w.active = false;
      w.opacity = 0;
      continue;
    }

    activeCount++;

    // Drag / deceleration
    const drag = Math.pow(0.92, clampedDt * 60);
    w.vx *= drag;
    w.vy *= drag;

    // Upward buoyancy
    w.vy -= (w.isMicroParticle ? 9 : 14) * clampedDt * driftAmount;

    // Wobble / curl
    if (w.wobbleSpeed && w.wobbleAmp) {
      const wobble = Math.sin(w.age * w.wobbleSpeed + (w.wobblePhase ?? 0)) * w.wobbleAmp;
      w.x += wobble * clampedDt * 3;
    }

    // Translation
    w.x += w.vx * clampedDt;
    w.y += w.vy * clampedDt;

    // Soft expansion
    const expandRate = w.isMicroParticle ? 0.7 : 1.4;
    w.radius += (w.targetRadius - w.radius) * expandRate * clampedDt;

    // Cubic dissipation
    const progress = w.age / w.maxLife;
    const fade = 1 - progress;
    w.opacity = w.initialOpacity * (fade * fade);
  }

  return activeCount;
}

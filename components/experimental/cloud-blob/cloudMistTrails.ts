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
export function spawnRandomIdleWisp(
  pool: CloudWisp[],
  centerX: number,
  centerY: number,
  color: string,
  strength = 1.0
): boolean {
  const type = Math.floor(Math.random() * 6);
  let spawnX = centerX;
  let spawnY = centerY;
  let vx = 0;
  let vy = 0;
  let radius = 16;
  let life = 1.1;
  let opac = 0.28 * strength;
  let isMicro = false;

  switch (type) {
    case 0: // Crown crest - upward drifting cumulus wisp
      spawnX += (Math.random() - 0.5) * 60;
      spawnY += -55 + (Math.random() - 0.5) * 16;
      vx = (Math.random() - 0.5) * 12;
      vy = -18 - Math.random() * 14;
      radius = 14 + Math.random() * 10;
      life = 1.2 + Math.random() * 0.5;
      opac = 0.28 * strength;
      break;

    case 1: // Left cheek roll - drifting outward to the left
      spawnX += -82 - Math.random() * 18;
      spawnY += (Math.random() - 0.5) * 36;
      vx = -20 - Math.random() * 16;
      vy = (Math.random() - 0.5) * 12;
      radius = 16 + Math.random() * 12;
      life = 1.1 + Math.random() * 0.4;
      opac = 0.26 * strength;
      break;

    case 2: // Right cheek roll - drifting outward to the right
      spawnX += 78 + Math.random() * 18;
      spawnY += (Math.random() - 0.5) * 32;
      vx = 18 + Math.random() * 16;
      vy = (Math.random() - 0.5) * 12;
      radius = 15 + Math.random() * 11;
      life = 1.1 + Math.random() * 0.4;
      opac = 0.26 * strength;
      break;

    case 3: // Underbelly - rolls downward and spreads
      spawnX += (Math.random() - 0.5) * 64;
      spawnY += 46 + Math.random() * 14;
      vx = (Math.random() - 0.5) * 16;
      vy = 8 + Math.random() * 12;
      radius = 15 + Math.random() * 10;
      life = 0.95 + Math.random() * 0.4;
      opac = 0.24 * strength;
      break;

    case 4: // Trailing wind tuft - curling buoyant cloud puff
      spawnX += 96 + Math.random() * 20;
      spawnY += 18 + (Math.random() - 0.5) * 16;
      vx = 22 + Math.random() * 16;
      vy = -4 + (Math.random() - 0.5) * 10;
      radius = 13 + Math.random() * 9;
      life = 1.25 + Math.random() * 0.5;
      opac = 0.30 * strength;
      break;

    case 5: // Micro cloud particle - tiny round floating cloudlet
    default:
      const angle = Math.random() * Math.PI * 2;
      const dist = 65 + Math.random() * 40;
      spawnX += Math.cos(angle) * dist;
      spawnY += Math.sin(angle) * (dist * 0.7);
      vx = Math.cos(angle) * (12 + Math.random() * 16);
      vy = Math.sin(angle) * (10 + Math.random() * 12) - 6;
      radius = 5 + Math.random() * 6;
      life = 0.9 + Math.random() * 0.4;
      opac = 0.36 * strength;
      isMicro = true;
      break;
  }

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
    3 + Math.random() * 3,
    (Math.random() - 0.5) * 10,
    isMicro
  );
}

/**
 * Spawns a multi-directional velocity trail wisp when the character is moving or dragged.
 */
export function spawnDirectionalTrailWisp(
  pool: CloudWisp[],
  charX: number,
  charY: number,
  vx: number,
  vy: number,
  color: string,
  strength = 1.0,
  lifetime = 0.9
): boolean {
  const speed = Math.hypot(vx, vy);
  if (speed < 20) return false;

  const vAngle = Math.atan2(vy, vx);
  // Spawn from the trailing perimeter with randomized spread
  const angleSpread = (Math.random() - 0.5) * 0.8;
  const trailAngle = vAngle + Math.PI + angleSpread;
  const spawnDistance = 64 + Math.random() * 24;

  const spawnX = charX + Math.cos(trailAngle) * spawnDistance;
  const spawnY = charY + Math.sin(trailAngle) * (spawnDistance * 0.75);

  // Velocity carries opposite motion with slight lateral curl
  const trailVx = -vx * 0.22 + (Math.random() - 0.5) * 16;
  const trailVy = -vy * 0.22 - 6 + (Math.random() - 0.5) * 12;

  const isMicro = Math.random() < 0.35;
  const radius = isMicro ? 6 + Math.random() * 6 : 16 + Math.random() * 12;
  const opac = (isMicro ? 0.34 : 0.28) * strength;

  return spawnWisp(
    pool,
    spawnX,
    spawnY,
    trailVx,
    trailVy,
    radius,
    color,
    lifetime * (0.9 + Math.random() * 0.4),
    opac,
    3.5 + Math.random() * 3,
    (Math.random() - 0.5) * 12,
    isMicro
  );
}

/**
 * Spawns a burst of wisps on sudden impacts or manual trigger.
 */
export function spawnWispBurst(
  pool: CloudWisp[],
  count: number,
  originX: number,
  originY: number,
  color: string,
  spread = 24
): void {
  const actualCount = Math.min(count, 8);
  for (let i = 0; i < actualCount; i++) {
    const angle = (Math.PI * 2 * i) / actualCount + (Math.random() - 0.5) * 0.4;
    const speed = 22 + Math.random() * 40;
    const offsetX = (Math.random() - 0.5) * spread;
    const offsetY = (Math.random() - 0.5) * spread * 0.6;
    const isMicro = Math.random() < 0.4;
    const r = isMicro ? 6 + Math.random() * 6 : 16 + Math.random() * 14;
    const life = 0.75 + Math.random() * 0.45;
    spawnWisp(
      pool,
      originX + offsetX,
      originY + offsetY,
      Math.cos(angle) * speed,
      Math.sin(angle) * speed * 0.7 - 8,
      r,
      color,
      life,
      0.34 + Math.random() * 0.1,
      4.0,
      (Math.random() - 0.5) * 14,
      isMicro
    );
  }
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

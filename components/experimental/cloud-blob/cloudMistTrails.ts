/**
 * Procedural Cloud Blob - Restrained Mist Trails & Wisp Particle System
 *
 * Lightweight, zero-allocation particle pool for elegant trailing mist.
 * Capacity capped to 8 wisps (typically 0-3 active during motion, 0 during idle).
 * Wisps are directionally aligned, soft-edged, and dissipate quickly into AMOLED black.
 */

import type { CloudWisp } from "./cloudTypes";

export const MAX_WISPS = 8;

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
  lifetime = 0.85,
  initialOpacity = 0.32
): boolean {
  // Count active to enforce restrained clutter limit
  let activeCount = 0;
  for (let i = 0; i < pool.length; i++) {
    if (pool[i].active) activeCount++;
  }
  if (activeCount >= 5) return false;

  // Find inactive slot or recycle oldest
  let targetIndex = -1;
  for (let i = 0; i < pool.length; i++) {
    if (!pool[i].active) {
      targetIndex = i;
      break;
    }
  }

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
  wisp.targetRadius = radius * (1.5 + Math.random() * 0.4);
  wisp.age = 0;
  wisp.maxLife = Math.max(0.45, Math.min(1.2, lifetime));
  wisp.initialOpacity = initialOpacity;
  wisp.opacity = initialOpacity;
  wisp.softness = 1.3;
  wisp.color = color;
  return true;
}

/**
 * Spawns a restrained burst of wisps on sudden impacts or manual trigger.
 */
export function spawnWispBurst(
  pool: CloudWisp[],
  count: number,
  originX: number,
  originY: number,
  color: string,
  spread = 24
): void {
  const actualCount = Math.min(count, 4);
  for (let i = 0; i < actualCount; i++) {
    const angle = (Math.PI * 2 * i) / actualCount + (Math.random() - 0.5) * 0.4;
    const speed = 20 + Math.random() * 35;
    const offsetX = (Math.random() - 0.5) * spread;
    const offsetY = (Math.random() - 0.5) * spread * 0.6;
    const r = 16 + Math.random() * 14;
    const life = 0.65 + Math.random() * 0.4;
    spawnWisp(
      pool,
      originX + offsetX,
      originY + offsetY,
      Math.cos(angle) * speed,
      Math.sin(angle) * speed * 0.7 - 8,
      r,
      color,
      life,
      0.34 + Math.random() * 0.1
    );
  }
}

/**
 * Advances physics and dissipation for active wisps.
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

    // Drag
    const drag = Math.pow(0.90, clampedDt * 60);
    w.vx *= drag;
    w.vy *= drag;

    // Upward buoyancy
    w.vy -= 12 * clampedDt * driftAmount;

    // Translation
    w.x += w.vx * clampedDt;
    w.y += w.vy * clampedDt;

    // Soft expansion
    w.radius += (w.targetRadius - w.radius) * 1.5 * clampedDt;

    // Cubic dissipation
    const progress = w.age / w.maxLife;
    const fade = 1 - progress;
    w.opacity = w.initialOpacity * (fade * fade);
  }

  return activeCount;
}

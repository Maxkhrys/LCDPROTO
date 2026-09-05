/** Fixed pool. Positions are screen-space, detached from subsequent body motion. */
import type { CloudWisp } from "./cloudTypes";
export const MAX_WISPS = 8;
export function createWispPool(capacity = MAX_WISPS): CloudWisp[] {
  return Array.from({ length: Math.min(MAX_WISPS, capacity) }, () => ({
    active: false,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    radius: 18,
    targetRadius: 30,
    opacity: 0,
    initialOpacity: 0.3,
    age: 0,
    maxLife: 0.9,
    softness: 1,
    color: "#eaf3ff",
    angle: 0,
    shape: 0,
    curl: 0,
  }));
}
export function spawnWisp(
  pool: CloudWisp[],
  x: number,
  y: number,
  vx: number,
  vy: number,
  radius: number,
  color: string,
  lifetime = 0.85,
  initialOpacity = 0.32,
  sequence = 0,
): boolean {
  const w = pool.find((w) => !w.active);
  if (!w) return false;
  w.active = true;
  w.x = x;
  w.y = y;
  w.vx = vx;
  w.vy = vy;
  w.radius = radius;
  w.targetRadius = radius * 1.8;
  w.age = 0;
  w.maxLife = Math.max(0.4, Math.min(1.3, lifetime));
  w.initialOpacity = Math.max(0, Math.min(0.45, initialOpacity));
  w.opacity = 0;
  w.color = color;
  w.angle = Math.atan2(vy, vx);
  w.shape = sequence % 3;
  w.curl = sequence % 2 ? 0.7 : -0.7;
  return true;
}
export function updateWisps(
  pool: CloudWisp[],
  dt: number,
  drift = 1,
  fadeSpeed = 1,
): number {
  let active = 0;
  for (const w of pool) {
    if (!w.active) continue;
    w.age += dt * Math.max(0.1, fadeSpeed);
    if (w.age >= w.maxLife) {
      w.active = false;
      w.opacity = 0;
      continue;
    }
    const p = w.age / w.maxLife;
    const h = Math.max(0, dt);
    // Exponential drag and bounded curl; cheap scalar equivalent on MCU.
    const decay = Math.exp(-2.2 * h);
    w.vx *= decay;
    w.vy = w.vy * decay - 5 * drift * h;
    w.x += (w.vx + Math.sin(p * Math.PI) * w.curl * 6) * h;
    w.y += w.vy * h;
    w.angle += w.curl * h * 0.4;
    w.radius += (w.targetRadius - w.radius) * (1 - Math.exp(-2 * h));
    w.opacity = w.initialOpacity * Math.min(1, p / 0.1) * Math.pow(1 - p, 1.6);
    active++;
  }
  return active;
}

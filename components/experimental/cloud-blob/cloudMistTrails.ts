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
    radius: 24,
    targetRadius: 48,
    opacity: 0,
    initialOpacity: 0.5,
    age: 0,
    maxLife: 1.0,
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
  lifetime = 0.95,
  initialOpacity = 0.55,
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
  // Detached puffs expand gently as they diffuse into the surrounding air
  w.targetRadius = radius * (1.6 + (sequence % 3) * 0.25);
  w.age = 0;
  w.maxLife = Math.max(0.4, Math.min(1.4, lifetime));
  w.initialOpacity = Math.max(0, Math.min(0.75, initialOpacity));
  w.opacity = 0;
  w.color = color;
  w.angle = Math.atan2(vy, vx) + ((sequence % 5) - 2) * 0.18;
  w.shape = sequence % 3;
  w.curl = ((sequence % 7) - 3) * 0.35;
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
    // Exponential atmospheric drag deceleration
    const decay = Math.exp(-2.6 * h);
    w.vx *= decay;
    // Gentle thermal lift / buoyancy for smoke mist
    w.vy = w.vy * decay - 10 * drift * h;
    // Turbulent vortex drift
    w.x += (w.vx + Math.sin(p * Math.PI * 1.5) * w.curl * 7) * h;
    w.y += w.vy * h;
    w.angle += w.curl * h * 0.35;
    // Puffs expand gently
    w.radius += (w.targetRadius - w.radius) * (1 - Math.exp(-2.8 * h));
    // Smooth bell envelope: prompt rise, soft billowing linger, and ethereal fade
    const fadeIn = Math.min(1, p / 0.15);
    const fadeOut = Math.pow(1 - p, 1.45);
    w.opacity = w.initialOpacity * fadeIn * fadeOut;
    active++;
  }
  return active;
}

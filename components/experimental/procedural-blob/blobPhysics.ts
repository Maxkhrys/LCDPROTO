/**
 * Cheap soft-body feel for the experimental procedural body.
 *
 * R&D ONLY. There is no mesh and no solver here on purpose: the eventual
 * target is an ESP32-class part, so the whole deformation model is a handful
 * of scalar springs — one per shape parameter — integrated semi-implicitly.
 * That is a few dozen multiply-adds per frame and ports to fixed point.
 */

import { NEUTRAL_SHAPE, type ShapeParams } from "./blobShape";

export interface SpringConfig {
  /** Higher = snappier. */
  stiffness: number;
  /** 1 is critically damped. Below 1 overshoots; we stay just under. */
  damping: number;
  /** Seconds the value waits before it starts chasing a new target. */
  lag: number;
}

/**
 * Per-parameter response.
 *
 * The staging the behaviour system eventually wants — eyes react, body
 * follows, jelly settles last — is expressed here as increasing lag and
 * decreasing stiffness down the list. Eye springs would sit above `lean`
 * with lag 0; the body's gross pose follows; the lobe bulges and the ripple
 * are the slowest things on screen, so the jelly is always still moving
 * slightly after the pose has arrived.
 */
const DEFAULT_SPRING: SpringConfig = { stiffness: 90, damping: 0.78, lag: 0.03 };

const SPRINGS: Partial<Record<keyof ShapeParams, SpringConfig>> = {
  // Gross pose — the body's own reaction, one beat after the eyes.
  lean: { stiffness: 105, damping: 0.8, lag: 0.04 },
  rotation: { stiffness: 105, damping: 0.8, lag: 0.04 },
  centerShiftX: { stiffness: 95, damping: 0.76, lag: 0.05 },
  centerShiftY: { stiffness: 95, damping: 0.76, lag: 0.05 },
  scale: { stiffness: 110, damping: 0.85, lag: 0.02 },
  scaleX: { stiffness: 110, damping: 0.85, lag: 0.02 },
  scaleY: { stiffness: 110, damping: 0.85, lag: 0.02 },
  // Volume — overshoots a little, which is what reads as "jelly".
  squash: { stiffness: 78, damping: 0.62, lag: 0.06 },
  stretch: { stiffness: 78, damping: 0.62, lag: 0.06 },
  topHeight: { stiffness: 70, damping: 0.6, lag: 0.08 },
  bottomSag: { stiffness: 70, damping: 0.6, lag: 0.08 },
  // Lobes settle last.
  leftBulge: { stiffness: 58, damping: 0.55, lag: 0.1 },
  rightBulge: { stiffness: 58, damping: 0.55, lag: 0.1 },
  lowerLeftBulge: { stiffness: 52, damping: 0.52, lag: 0.12 },
  lowerRightBulge: { stiffness: 52, damping: 0.52, lag: 0.12 },
  wobbleAmount: { stiffness: 46, damping: 0.72, lag: 0.14 },
};

/** Parameters the springs do not own — they are advanced, not chased. */
const DIRECT: ReadonlySet<keyof ShapeParams> = new Set(["wobblePhase"]);

interface SpringState {
  value: number;
  velocity: number;
  target: number;
  pending: number;
  wait: number;
}

export class BlobSoftBody {
  private readonly state = new Map<keyof ShapeParams, SpringState>();
  private readonly current: ShapeParams;

  constructor(initial: ShapeParams = NEUTRAL_SHAPE) {
    this.current = { ...initial };
    for (const key of Object.keys(NEUTRAL_SHAPE) as (keyof ShapeParams)[]) {
      if (DIRECT.has(key)) continue;
      const v = initial[key];
      this.state.set(key, { value: v, velocity: 0, target: v, pending: v, wait: 0 });
    }
  }

  /** Point the springs at a new pose. Nothing snaps; everything eases. */
  setTarget(next: Partial<ShapeParams>) {
    for (const key of Object.keys(next) as (keyof ShapeParams)[]) {
      const value = next[key];
      if (typeof value !== "number") continue;
      if (DIRECT.has(key)) {
        this.current[key] = value;
        continue;
      }
      const s = this.state.get(key);
      if (!s || s.pending === value) continue;
      s.pending = value;
      s.wait = (SPRINGS[key] ?? DEFAULT_SPRING).lag;
    }
  }

  /** Immediately place the body at a pose, with no motion. Used on mount. */
  snapTo(next: Partial<ShapeParams>) {
    for (const key of Object.keys(next) as (keyof ShapeParams)[]) {
      const value = next[key];
      if (typeof value !== "number") continue;
      this.current[key] = value;
      const s = this.state.get(key);
      if (!s) continue;
      s.value = value;
      s.target = value;
      s.pending = value;
      s.velocity = 0;
      s.wait = 0;
    }
  }

  /**
   * Advances the springs. `dt` is clamped and sub-stepped so a dropped frame
   * or a backgrounded tab cannot make the body explode.
   */
  step(dt: number): ShapeParams {
    const total = Math.min(dt, 0.1);
    const steps = Math.max(1, Math.ceil(total / (1 / 120)));
    const h = total / steps;

    for (const [key, s] of this.state) {
      const cfg = SPRINGS[key] ?? DEFAULT_SPRING;
      for (let i = 0; i < steps; i++) {
        if (s.wait > 0) {
          s.wait -= h;
          if (s.wait <= 0) s.target = s.pending;
        }
        const c = 2 * cfg.damping * Math.sqrt(cfg.stiffness);
        const accel = cfg.stiffness * (s.target - s.value) - c * s.velocity;
        s.velocity += accel * h;
        s.value += s.velocity * h;
      }
      // Settle hard once the motion is below a pixel-ish threshold, so idle
      // frames do no work and the outline stops jittering.
      if (Math.abs(s.value - s.target) < 1e-4 && Math.abs(s.velocity) < 1e-3) {
        s.value = s.target;
        s.velocity = 0;
      }
      this.current[key] = s.value;
    }
    return this.current;
  }

  /** True while anything is still moving; lets the caller skip repaints. */
  get settled(): boolean {
    for (const s of this.state.values()) {
      if (s.wait > 0 || Math.abs(s.velocity) > 1e-3 || Math.abs(s.value - s.target) > 1e-4) {
        return false;
      }
    }
    return true;
  }

  get pose(): ShapeParams {
    return this.current;
  }
}

/**
 * Land-and-settle impulse: a short compression that springs back through a
 * small overshoot. Returned as a target set, so the springs still do the
 * easing — nothing here is keyframed.
 */
export function landingPose(): Partial<ShapeParams> {
  return {
    squash: 0.2,
    stretch: 0,
    bottomSag: 0.05,
    leftBulge: 0.05,
    rightBulge: 0.055,
    lowerLeftBulge: 0.035,
    lowerRightBulge: 0.04,
    wobbleAmount: 0.02,
  };
}

/**
 * Ambient motion: the continuous, always-on layer beneath the behaviour
 * system. Blob drifts between soft positions, breathes, and his body lags
 * slightly behind his own movement the way a soft object would.
 *
 * The float is deliberately *not* a sine wave. It eases between small random
 * targets on slow, unequal intervals, so there is no bounce to lock onto.
 */

export interface IdleConfig {
  enabled: boolean;
  /** Vertical wander amplitude either side of centre, in 240-space pixels. */
  floatPx: number;
  /** Total breathing scale range (0.012 = 1.2% peak to peak). */
  breathAmount: number;
  /** Reference squash magnitude; behaviours scale their deformation by it. */
  squashAmount: number;
  /** Mean seconds between scheduled blinks, before deterministic jitter. */
  blinkInterval: number;
  /** Peak eye travel for a glance, in 240-space pixels. */
  gazeDriftPx: number;
  /** Ambient rotation amplitude either side of centre, in degrees. */
  rotationDeg: number;
  /** Scales quiet gaps between micro-behaviours. Higher = quieter. */
  activityPace: number;
}

export const DEFAULT_IDLE: IdleConfig = {
  enabled: true,
  floatPx: 1.8,
  breathAmount: 0.012,
  squashAmount: 0.014,
  blinkInterval: 5.9,
  gazeDriftPx: 3.5,
  rotationDeg: 0.6,
  activityPace: 1,
};

export const IDLE_LIMITS = {
  floatPx: { min: 0, max: 4, step: 0.1 },
  breathAmount: { min: 0, max: 0.02, step: 0.0005 },
  squashAmount: { min: 0, max: 0.02, step: 0.0005 },
  blinkInterval: { min: 4, max: 10, step: 0.1 },
  gazeDriftPx: { min: 0, max: 4, step: 0.1 },
  rotationDeg: { min: 0, max: 1, step: 0.05 },
  activityPace: { min: 0.65, max: 1.8, step: 0.05 },
} as const;

const BREATH_PERIOD_A = 6100;
const BREATH_PERIOD_B = 8700;
const SHAPE_PERIOD_A = 7600;
const SHAPE_PERIOD_B = 11300;
/** Milliseconds between broad centre-of-mass changes. */
const WANDER_MIN = 3200;
const WANDER_MAX = 6000;
/** Horizontal wander remains inside roughly +/-1.0-1.5 authored pixels. */
const HORIZONTAL_RATIO = 0.72;
const HORIZONTAL_MAX = 1.5;
/** Time constant for the body trailing its own movement. */
const JELLY_TAU = 210;
/** Deformation per pixel of lead, and the cap on it. */
const JELLY_GAIN = 0.006;
const JELLY_MAX = 0.0045;

const TAU = Math.PI * 2;
/** Smootherstep — zero first and second derivative at both ends. */
const ease = (t: number) => {
  const c = t < 0 ? 0 : t > 1 ? 1 : t;
  return c * c * c * (c * (c * 6 - 15) + 10);
};

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SEED = 0xb10b;

export interface AmbientPose {
  x: number;
  y: number;
  rotation: number;
  /** Breathing, as a deviation from scale 1. */
  breath: number;
  /** Jelly lead: positive while the body is still catching up downward. */
  squashX: number;
  squashY: number;
}

/**
 * Continuous drift, breathing and soft-body lag. Deterministic given the same
 * update sequence, and reset() restores the exact starting condition.
 */
export class AmbientDrift {
  private clock = 0;
  private rand = mulberry32(SEED);
  private fromX = 0;
  private fromY = 0;
  private toX = 0;
  private toY = 0;
  private fromRotation = 0;
  private toRotation = 0;
  private legStart = 0;
  private legDuration = WANDER_MIN;
  private initialized = false;
  /** Lagged copy of the character's vertical position. */
  private lagY = 0;
  private readonly pose: AmbientPose = {
    x: 0,
    y: 0,
    rotation: 0,
    breath: 0,
    squashX: 0,
    squashY: 0,
  };

  reset() {
    this.clock = 0;
    this.rand = mulberry32(SEED);
    this.fromX = this.fromY = this.toX = this.toY = 0;
    this.fromRotation = this.toRotation = 0;
    this.legStart = 0;
    this.legDuration = WANDER_MIN;
    this.initialized = false;
    this.lagY = 0;
  }

  /** Picks a target far enough away that each leg has visible travel. */
  private target(amplitude: number, current: number): number {
    if (amplitude <= 0) return 0;
    let candidate = 0;
    for (let attempt = 0; attempt < 4; attempt += 1) {
      candidate = (this.rand() * 2 - 1) * amplitude;
      if (Math.abs(candidate - current) >= amplitude * 0.48) return candidate;
    }
    const magnitude = amplitude * (0.55 + this.rand() * 0.35);
    return current >= 0 ? -magnitude : magnitude;
  }

  private beginLeg(cfg: IdleConfig) {
    const horizontal = Math.min(HORIZONTAL_MAX, cfg.floatPx * HORIZONTAL_RATIO);
    this.fromX = this.toX;
    this.fromY = this.toY;
    this.fromRotation = this.toRotation;
    this.toX = this.target(horizontal, this.fromX);
    this.toY = this.target(cfg.floatPx, this.fromY);
    this.toRotation = this.target(cfg.rotationDeg, this.fromRotation);
    this.legStart = this.clock;
    this.legDuration = WANDER_MIN + this.rand() * (WANDER_MAX - WANDER_MIN);
  }

  /**
   * @param behaviourY vertical contribution from the active micro-behaviour.
   *                   Ambient y is added internally before calculating lag.
   */
  update(dt: number, cfg: IdleConfig, behaviourY: number): AmbientPose {
    this.clock += dt;

    if (!this.initialized) {
      this.initialized = true;
      this.beginLeg(cfg);
    }

    if (this.clock - this.legStart >= this.legDuration) {
      this.beginLeg(cfg);
    }

    const t = ease((this.clock - this.legStart) / this.legDuration);
    this.pose.x = this.fromX + (this.toX - this.fromX) * t;
    this.pose.y = this.fromY + (this.toY - this.fromY) * t;
    this.pose.rotation =
      this.fromRotation + (this.toRotation - this.fromRotation) * t;

    // Two unequal periods keep breathing organic without a visible loop.
    const breathWave =
      Math.sin((this.clock / BREATH_PERIOD_A) * TAU) * 0.72 +
      Math.sin((this.clock / BREATH_PERIOD_B) * TAU) * 0.28;
    this.pose.breath = breathWave * (cfg.breathAmount / 2);

    // A slower asymmetric shape change keeps the silhouette gently fluid.
    const shapeWave =
      Math.sin((this.clock / SHAPE_PERIOD_A) * TAU) * 0.55 +
      Math.sin((this.clock / SHAPE_PERIOD_B) * TAU) * 0.45;
    const shape = shapeWave * cfg.squashAmount * 0.42;

    // Soft-body lag: the body trails its own motion, so a downward move
    // compresses it slightly and it rebounds as it settles.
    const k = 1 - Math.exp(-dt / JELLY_TAU);
    const bodyY = this.pose.y + behaviourY;
    this.lagY += (bodyY - this.lagY) * k;
    const lead = bodyY - this.lagY;
    const def = Math.max(
      -JELLY_MAX,
      Math.min(JELLY_MAX, lead * JELLY_GAIN * (cfg.squashAmount / 0.014))
    );
    this.pose.squashX = shape + def;
    this.pose.squashY = -shape * 0.8 - def;
    return this.pose;
  }
}

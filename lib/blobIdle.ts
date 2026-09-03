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
  /** Total breathing scale range (0.007 = 0.7% peak to peak). */
  breathAmount: number;
  /** Reference squash magnitude; behaviours scale their deformation by it. */
  squashAmount: number;
  /** Pacing of the behaviour schedule, in seconds. Higher = quieter. */
  blinkInterval: number;
  /** Peak eye travel for a glance, in 240-space pixels. */
  gazeDriftPx: number;
}

export const DEFAULT_IDLE: IdleConfig = {
  enabled: true,
  floatPx: 1.5,
  breathAmount: 0.007,
  squashAmount: 0.006,
  blinkInterval: 5.5,
  gazeDriftPx: 1.3,
};

export const IDLE_LIMITS = {
  floatPx: { min: 0, max: 4, step: 0.1 },
  breathAmount: { min: 0, max: 0.02, step: 0.0005 },
  squashAmount: { min: 0, max: 0.02, step: 0.0005 },
  blinkInterval: { min: 1.5, max: 15, step: 0.1 },
  gazeDriftPx: { min: 0, max: 4, step: 0.1 },
} as const;

const BREATH_PERIOD = 6800;
/** Seconds between broad positional changes. */
const WANDER_MIN = 7000;
const WANDER_MAX = 11000;
/** Horizontal wander is a fraction of the vertical, per the brief. */
const HORIZONTAL_RATIO = 0.6;
/** Time constant for the body trailing its own movement. */
const JELLY_TAU = 190;
/** Deformation per pixel of lead, and the cap on it. */
const JELLY_GAIN = 0.006;
const JELLY_MAX = 0.005;

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
  private legStart = 0;
  private legDuration = WANDER_MIN;
  /** Lagged copy of the character's vertical position. */
  private lagY = 0;
  private readonly pose: AmbientPose = {
    x: 0,
    y: 0,
    breath: 0,
    squashX: 0,
    squashY: 0,
  };

  reset() {
    this.clock = 0;
    this.rand = mulberry32(SEED);
    this.fromX = this.fromY = this.toX = this.toY = 0;
    this.legStart = 0;
    this.legDuration = WANDER_MIN;
    this.lagY = 0;
  }

  /**
   * @param bodyY the character's total vertical offset this frame, including
   *              whatever a behaviour is contributing, so the jelly lag
   *              responds to real movement rather than the drift alone.
   */
  update(dt: number, cfg: IdleConfig, bodyY: number): AmbientPose {
    this.clock += dt;

    if (this.clock - this.legStart >= this.legDuration) {
      this.legStart = this.clock;
      this.legDuration = WANDER_MIN + this.rand() * (WANDER_MAX - WANDER_MIN);
      this.fromX = this.toX;
      this.fromY = this.toY;
      // New target, biased away from the current one so it actually travels.
      this.toY = (this.rand() * 2 - 1) * cfg.floatPx;
      this.toX = (this.rand() * 2 - 1) * cfg.floatPx * HORIZONTAL_RATIO;
    }

    const t = ease((this.clock - this.legStart) / this.legDuration);
    this.pose.x = this.fromX + (this.toX - this.fromX) * t;
    this.pose.y = this.fromY + (this.toY - this.fromY) * t;
    this.pose.breath =
      Math.sin((this.clock / BREATH_PERIOD) * TAU) * (cfg.breathAmount / 2);

    // Soft-body lag: the body trails its own motion, so a downward move
    // compresses it slightly and it rebounds as it settles.
    const k = 1 - Math.exp(-dt / JELLY_TAU);
    this.lagY += (bodyY - this.lagY) * k;
    const lead = bodyY - this.lagY;
    const def = Math.max(
      -JELLY_MAX,
      Math.min(JELLY_MAX, lead * JELLY_GAIN * (cfg.squashAmount / 0.006))
    );
    this.pose.squashX = def;
    this.pose.squashY = -def;
    return this.pose;
  }
}

import {
  NEUTRAL_BLOB,
  NEUTRAL_ELEMENT,
  type BlobRig,
  type ElementTransform,
} from "./blobRig";

/**
 * Procedural idle motion.
 *
 * Everything here is a pure function of elapsed time — no accumulated state,
 * no random draws at runtime — so the same moment always produces the same
 * pose. That makes the motion reproducible, pausable and easy to reason about.
 *
 * Nothing generates new artwork: the whole idle is transforms applied to the
 * existing layers. body.png is never warped, only translated and scaled.
 */

export interface IdleConfig {
  enabled: boolean;
  /**
   * Total vertical travel, in 240-space pixels — the blob moves half this far
   * either side of centre. Stated as travel rather than amplitude so the slider
   * reads as the distance actually covered.
   */
  floatPx: number;
  /** Total breathing scale range, as a fraction (0.007 = 0.7% peak to peak). */
  breathAmount: number;
  /**
   * Maximum deviation of scaleX from 1. scaleY moves inversely by the same
   * amount, so the X-to-Y ratio deviates by roughly twice this.
   */
  squashAmount: number;
  /** Mean seconds between blinks. */
  blinkInterval: number;
}

/**
 * Deliberately understated: the brief is "alive, not bouncy". Float and
 * breathing sit at the low end of the requested ranges, squash below it.
 */
export const DEFAULT_IDLE: IdleConfig = {
  enabled: true,
  floatPx: 1.4,
  breathAmount: 0.007,
  squashAmount: 0.006,
  blinkInterval: 5.5,
};

/** Periods are mutually prime-ish so the cycles never visibly line up. */
const PERIOD = {
  float: 5200,
  breath: 6800,
  squash: 4300,
  driftGate: 11000,
  driftDirection: 7300,
} as const;

const BLINK_MS = 130;
/** Fraction of the blink spent closing; opening is slower, as real lids are. */
const BLINK_CLOSE = 0.4;
/** How far the eye compresses at full closure. */
const BLINK_MIN_SCALE_Y = 0.06;
/** Peak eye drift, in 240-space pixels. */
const DRIFT_PX = 1.6;

const TAU = Math.PI * 2;
const smoothstep = (t: number) => t * t * (3 - 2 * t);

/** Deterministic 0..1 from an integer, for per-blink jitter. */
function hash(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/**
 * Blink closure at time t, 0 = open, 1 = fully closed.
 *
 * Blinks are scheduled one per interval window, jittered inside it, so they
 * read as irregular rather than metronomic. The previous window is checked too
 * so a blink straddling the boundary is not cut off.
 */
function blinkAmount(t: number, intervalMs: number): number {
  if (intervalMs <= 0) return 0;
  const cycle = Math.floor(t / intervalMs);
  let amount = 0;
  for (let k = cycle - 1; k <= cycle; k++) {
    if (k < 0) continue;
    const start = k * intervalMs + hash(k) * intervalMs * 0.65;
    const d = t - start;
    if (d < 0 || d >= BLINK_MS) continue;
    const p = d / BLINK_MS;
    const closure =
      p < BLINK_CLOSE
        ? smoothstep(p / BLINK_CLOSE)
        : 1 - smoothstep((p - BLINK_CLOSE) / (1 - BLINK_CLOSE));
    amount = Math.max(amount, closure);
  }
  return amount;
}

/**
 * Occasional shared eye drift. A gated envelope keeps the eyes still most of
 * the time, then lets them wander a pixel or so together — the way eyes settle
 * rather than track something.
 */
function eyeDrift(t: number): { x: number; y: number } {
  const gate = Math.pow(Math.max(0, Math.sin((t / PERIOD.driftGate) * TAU)), 4);
  const dir = Math.sin((t / PERIOD.driftDirection) * TAU);
  const dirY = Math.sin((t / (PERIOD.driftDirection * 1.4)) * TAU + 2.1);
  return { x: gate * dir * DRIFT_PX, y: gate * dirY * DRIFT_PX * 0.45 };
}

/**
 * Builds the complete idle pose for a moment in time.
 * Returns the neutral rig when idle motion is switched off.
 */
export function idleRig(t: number, cfg: IdleConfig): BlobRig {
  if (!cfg.enabled) {
    return {
      blob: { ...NEUTRAL_BLOB },
      leftEye: { ...NEUTRAL_ELEMENT },
      rightEye: { ...NEUTRAL_ELEMENT },
      mouth: { ...NEUTRAL_ELEMENT },
    };
  }

  // floatPx and breathAmount are stated as total travel, so halve them to get
  // the amplitude either side of neutral.
  const float = Math.sin((t / PERIOD.float) * TAU) * (cfg.floatPx / 2);
  const breath = Math.sin((t / PERIOD.breath) * TAU) * (cfg.breathAmount / 2);
  // Inverse squash: wider as it flattens, narrower as it rises.
  const squash = Math.sin((t / PERIOD.squash) * TAU) * cfg.squashAmount;

  const drift = eyeDrift(t);
  const blink = blinkAmount(t, cfg.blinkInterval * 1000);
  const eyeScaleY = 1 - blink * (1 - BLINK_MIN_SCALE_Y);

  const eye: ElementTransform = {
    ...NEUTRAL_ELEMENT,
    x: drift.x,
    y: drift.y,
    scaleY: eyeScaleY,
  };

  return {
    blob: {
      ...NEUTRAL_BLOB,
      y: float,
      scale: 1 + breath,
      scaleX: 1 + squash,
      scaleY: 1 - squash,
    },
    leftEye: { ...eye },
    rightEye: { ...eye },
    // The mouth rides the whole-character transform and nothing else.
    mouth: { ...NEUTRAL_ELEMENT },
  };
}

/** Sanity clamps for the dev sliders. */
export const IDLE_LIMITS = {
  floatPx: { min: 0, max: 4, step: 0.1 },
  breathAmount: { min: 0, max: 0.02, step: 0.0005 },
  squashAmount: { min: 0, max: 0.02, step: 0.0005 },
  blinkInterval: { min: 1.5, max: 15, step: 0.1 },
} as const;

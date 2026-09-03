/**
 * HOME micro-behaviour system.
 *
 * HOME is not a loop. Blob rests most of the time and occasionally performs
 * one small spontaneous behaviour, then goes quiet again. These are internal
 * behaviours — the device state is still HOME.
 *
 * Scheduling is deterministic: a seeded PRNG picks what happens next and how
 * long the quiet gaps are, so a run is reproducible, resettable, and does
 * nothing during render (no hydration risk). Timing advances only from the
 * clock the caller supplies, so pausing genuinely freezes the character.
 *
 * Everything a behaviour produces is a small *delta* on top of the neutral
 * pose. Nothing here reads or writes the rig directly, so a future device
 * state can take the rig over at any moment — see `cancel()`.
 */

export type BehaviourId =
  | "REST"
  | "NORMAL_BLINK"
  | "DOUBLE_BLINK"
  | "GLANCE_LEFT"
  | "GLANCE_RIGHT"
  | "LOOK_UP"
  | "BODY_SETTLE"
  | "TINY_SQUISH"
  | "SOFT_SWAY_LEFT"
  | "SOFT_SWAY_RIGHT"
  | "MOUTH_RELAX"
  | "MOUTH_TWITCH";

/** Additive deltas on the neutral pose. Scales are deviations from 1. */
export interface PoseDelta {
  blobX: number;
  blobY: number;
  blobRotation: number;
  blobScaleX: number;
  blobScaleY: number;
  eyeX: number;
  eyeY: number;
  /** Multiplier on eye scaleY, for lid closure. */
  eyeLid: number;
  mouthX: number;
  mouthY: number;
  mouthScaleX: number;
  mouthScaleY: number;
  mouthRotation: number;
}

export const NEUTRAL_DELTA: PoseDelta = {
  blobX: 0,
  blobY: 0,
  blobRotation: 0,
  blobScaleX: 0,
  blobScaleY: 0,
  eyeX: 0,
  eyeY: 0,
  eyeLid: 1,
  mouthX: 0,
  mouthY: 0,
  mouthScaleX: 0,
  mouthScaleY: 0,
  mouthRotation: 0,
};

/** Amplitudes the dev sliders scale. */
export interface BehaviourConfig {
  /** Peak eye travel for a glance, in 240-space pixels. */
  gazePx: number;
  /** Reference squash magnitude; body deformations scale against it. */
  squash: number;
  /** Scales every quiet gap. 1 = the tuned default. */
  paceScale: number;
  /** Mean time between blinks, before deterministic jitter. */
  blinkIntervalMs: number;
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smoothstep = (t: number) => {
  const c = clamp01(t);
  return c * c * (3 - 2 * c);
};

/**
 * Attack / hold / release envelope over a normalised phase. `lag` shifts the
 * whole envelope later, which is how the body trails the eyes.
 */
function envelope(p: number, attack: number, release: number, lag = 0): number {
  const t = (p - lag) / (1 - lag);
  if (t <= 0 || t >= 1) return 0;
  if (t < attack) return smoothstep(t / attack);
  if (t > 1 - release) return smoothstep((1 - t) / release);
  return 1;
}

/** Lid closure over a blink: quick to shut, a little softer opening. */
function lidCurve(p: number): number {
  if (p <= 0 || p >= 1) return 0;
  const CLOSE = 0.38;
  return p < CLOSE
    ? smoothstep(p / CLOSE)
    : 1 - smoothstep((p - CLOSE) / (1 - CLOSE));
}

const LID_MIN = 0.07;

interface BehaviourDef {
  duration: number;
  /** Relative frequency when choosing what to do next. */
  weight: number;
  evaluate: (p: number, cfg: BehaviourConfig, out: PoseDelta) => void;
}

/** Body trails the face by this fraction of a behaviour. Roughly 90-115ms. */
const BODY_LAG = 0.07;

function glance(dir: 1 | -1): BehaviourDef["evaluate"] {
  return (p, cfg, out) => {
    const eye = envelope(p, 0.12, 0.4);
    // The body starts after the eyes and settles after them too, which is what
    // stops the face and body reading as separate layers.
    const body = envelope(p, 0.2, 0.27, BODY_LAG);
    out.eyeX = dir * cfg.gazePx * eye;
    out.eyeY = -0.18 * eye;
    out.blobRotation = dir * 1.1 * body;
    out.blobX = dir * 1.15 * body;
    out.blobScaleX = cfg.squash * 0.32 * body;
    out.blobScaleY = -cfg.squash * 0.32 * body;
  };
}

function softSway(dir: 1 | -1): BehaviourDef["evaluate"] {
  return (p, cfg, out) => {
    const face = envelope(p, 0.18, 0.42);
    const body = envelope(p, 0.24, 0.28, BODY_LAG);
    // Face shifts first, then mass follows and is last to settle.
    out.eyeX = dir * 0.8 * face;
    out.blobX = dir * 1.6 * body;
    out.blobRotation = dir * 0.7 * body;
    out.blobScaleX = cfg.squash * 0.3 * body;
    out.blobScaleY = -cfg.squash * 0.22 * body;
  };
}

export const BEHAVIOURS: Record<BehaviourId, BehaviourDef> = {
  REST: { duration: 2000, weight: 0, evaluate: () => {} },

  NORMAL_BLINK: {
    duration: 180,
    weight: 0,
    evaluate: (p, _cfg, out) => {
      out.eyeLid = 1 - lidCurve(p) * (1 - LID_MIN);
    },
  },

  DOUBLE_BLINK: {
    duration: 510,
    weight: 0,
    evaluate: (p, _cfg, out) => {
      // Two closures with a short beat between them.
      const first = lidCurve(p / 0.3);
      const second = lidCurve((p - 0.48) / 0.34);
      out.eyeLid = 1 - Math.max(first, second) * (1 - LID_MIN);
    },
  },

  GLANCE_LEFT: { duration: 1450, weight: 14, evaluate: glance(-1) },
  GLANCE_RIGHT: { duration: 1450, weight: 14, evaluate: glance(1) },

  LOOK_UP: {
    duration: 1550,
    weight: 10,
    evaluate: (p, cfg, out) => {
      const eye = envelope(p, 0.14, 0.4);
      const body = envelope(p, 0.22, 0.28, BODY_LAG);
      out.eyeY = -cfg.gazePx * 0.76 * eye;
      // Reaching up reads as a slight vertical stretch.
      out.blobScaleY = cfg.squash * 0.76 * body;
      out.blobScaleX = -cfg.squash * 0.5 * body;
      out.blobY = -0.6 * body;
    },
  },

  BODY_SETTLE: {
    duration: 1080,
    weight: 16,
    evaluate: (p, cfg, out) => {
      // One weighted drop and soft recovery. No repeated bounce.
      const drop = Math.sin(Math.PI * p) + 0.1 * Math.sin(2 * Math.PI * p);
      out.blobY = 1.35 * drop;
      out.blobScaleY = -cfg.squash * 0.95 * drop;
      out.blobScaleX = cfg.squash * 0.82 * drop;
    },
  },

  TINY_SQUISH: {
    duration: 820,
    weight: 14,
    evaluate: (p, cfg, out) => {
      const s =
        p < 0.72
          ? Math.sin(Math.PI * (p / 0.72))
          : -0.13 * Math.sin(Math.PI * ((p - 0.72) / 0.28));
      out.blobScaleX = cfg.squash * 1.18 * s;
      out.blobScaleY = -cfg.squash * 1.18 * s;
    },
  },

  SOFT_SWAY_LEFT: { duration: 1600, weight: 8, evaluate: softSway(-1) },
  SOFT_SWAY_RIGHT: { duration: 1600, weight: 8, evaluate: softSway(1) },

  MOUTH_RELAX: {
    duration: 1550,
    weight: 9,
    evaluate: (p, _cfg, out) => {
      const e = envelope(p, 0.22, 0.38);
      out.mouthScaleX = 0.05 * e;
      out.mouthScaleY = -0.04 * e;
      out.mouthY = 0.55 * e;
    },
  },

  MOUTH_TWITCH: {
    duration: 620,
    weight: 7,
    evaluate: (p, _cfg, out) => {
      const s = Math.sin(Math.PI * p);
      out.mouthX = 0.7 * s;
      out.mouthRotation = 2 * s;
      out.mouthScaleX = 0.025 * s;
    },
  },
};

/** Stable authored order keeps the seeded schedule varied from its first run. */
const PICKABLE: readonly BehaviourId[] = [
  "BODY_SETTLE",
  "GLANCE_LEFT",
  "MOUTH_RELAX",
  "SOFT_SWAY_RIGHT",
  "TINY_SQUISH",
  "GLANCE_RIGHT",
  "LOOK_UP",
  "MOUTH_TWITCH",
  "SOFT_SWAY_LEFT",
];

/** Small, fast, deterministic PRNG. */
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

const SEED = 0x5eed1e;

export interface BehaviourStatus {
  id: BehaviourId;
  /** 0..1 through the current behaviour. */
  phase: number;
  remainingMs: number;
  /** Time until the next scheduled action starts, including current settle. */
  nextBehaviourMs: number;
  blinkState: "open" | "closing" | "closed" | "opening";
}

export interface HomeActivityStatus extends BehaviourStatus {
  idleX: number;
  idleY: number;
  bodyRotation: number;
}

/**
 * Drives the behaviour schedule. Stateful on purpose: a pure function of time
 * could not be interrupted mid-behaviour, which SENSED will need to do.
 */
export class BehaviourController {
  private clock = 0;
  private startedAt = 0;
  private duration = 0;
  private current: BehaviourId = "REST";
  private rand = mulberry32(SEED);
  private lastPerformed: BehaviourId | null = null;
  private initialized = false;
  private nextBehaviourAt = 0;
  private nextBlinkAt = 0;
  private readonly delta: PoseDelta = { ...NEUTRAL_DELTA };

  /** Returns to the neutral pose and restarts the schedule from the top. */
  reset() {
    this.clock = 0;
    this.startedAt = 0;
    this.duration = 0;
    this.current = "REST";
    this.rand = mulberry32(SEED);
    this.lastPerformed = null;
    this.initialized = false;
    this.nextBehaviourAt = 0;
    this.nextBlinkAt = 0;
  }

  /**
   * Abandons whatever is running and returns to REST immediately. The pose
   * snaps to neutral rather than being left half-way through a glance, which
   * is what lets a device state take the rig over cleanly.
   */
  cancel() {
    this.current = "REST";
    this.startedAt = this.clock;
    this.duration = 0;
    this.nextBehaviourAt = this.clock + 1800;
  }

  /** Runs a behaviour now, cutting short anything in progress. */
  trigger(id: BehaviourId, cfg: BehaviourConfig) {
    this.ensureSchedule(cfg);
    if (id === "REST") {
      this.cancel();
      return;
    }
    this.start(id, cfg, this.clock);
  }

  private start(id: BehaviourId, cfg: BehaviourConfig, at: number) {
    this.current = id;
    this.startedAt = at;
    this.duration = BEHAVIOURS[id].duration;
    if (BEHAVIOURS[id].weight > 0) this.lastPerformed = id;

    if (id === "NORMAL_BLINK" || id === "DOUBLE_BLINK") {
      this.nextBlinkAt = at + this.blinkDuration(cfg);
    }

    const end = at + this.duration;
    const normalNext = end + this.restDuration(cfg.paceScale);
    // Never stack a blink directly on an expressive pose. Let body finish,
    // then leave a tiny physical beat before closing the eyes.
    const blinkNext = Math.max(this.nextBlinkAt, end + 220);
    this.nextBehaviourAt = Math.max(at + 1800, Math.min(normalNext, blinkNext));
  }

  update(dt: number, cfg: BehaviourConfig) {
    this.ensureSchedule(cfg);
    this.clock += dt;

    // A while-loop keeps deterministic timing intact after a long frame.
    let guard = 0;
    while (guard++ < 8) {
      if (this.current !== "REST") {
        const end = this.startedAt + this.duration;
        if (this.clock < end) break;
        this.current = "REST";
        this.startedAt = end;
        this.duration = 0;
        continue;
      }

      if (this.clock < this.nextBehaviourAt) break;
      const at = this.nextBehaviourAt;
      const blinkDue = this.nextBlinkAt <= at + 1;
      this.start(blinkDue ? this.pickBlink() : this.pick(), cfg, at);
    }
  }

  private ensureSchedule(cfg: BehaviourConfig) {
    if (this.initialized) return;
    this.initialized = true;
    this.nextBlinkAt = this.clock + this.blinkDuration(cfg);
    this.nextBehaviourAt = this.clock + 1200 + this.rand() * 800;
  }

  private blinkDuration(cfg: BehaviourConfig): number {
    return cfg.blinkIntervalMs * (0.85 + this.rand() * 0.3);
  }

  private pickBlink(): BehaviourId {
    return this.rand() < 0.14 ? "DOUBLE_BLINK" : "NORMAL_BLINK";
  }

  private restDuration(paceScale: number): number {
    let d = 1300 + this.rand() * 1500;
    // Rare longer breath. Most action starts remain roughly 2-5s apart.
    if (this.rand() < 0.12) d += 1300 + this.rand() * 900;
    return d * paceScale;
  }

  private pick(): BehaviourId {
    // Never repeat the previous non-blink action, so no short cycle is learned.
    let total = 0;
    for (const id of PICKABLE) {
      if (id !== this.lastPerformed) total += BEHAVIOURS[id].weight;
    }
    let r = this.rand() * total;
    for (const id of PICKABLE) {
      if (id === this.lastPerformed) continue;
      r -= BEHAVIOURS[id].weight;
      if (r <= 0) return id;
    }
    return PICKABLE[PICKABLE.length - 1];
  }

  /** Current pose delta. The returned object is reused between frames. */
  pose(cfg: BehaviourConfig): PoseDelta {
    Object.assign(this.delta, NEUTRAL_DELTA);
    const p =
      this.current === "REST" || this.duration === 0
        ? 0
        : clamp01((this.clock - this.startedAt) / this.duration);
    BEHAVIOURS[this.current].evaluate(p, cfg, this.delta);
    return this.delta;
  }

  status(eyeLid = 1): BehaviourStatus {
    const elapsed = this.clock - this.startedAt;
    const phase =
      this.current === "REST" || this.duration === 0
        ? 0
        : clamp01(elapsed / this.duration);
    const blinking =
      this.current === "NORMAL_BLINK" || this.current === "DOUBLE_BLINK";
    let blinkState: BehaviourStatus["blinkState"] = "open";
    if (blinking) {
      if (eyeLid <= 0.13) {
        blinkState = "closed";
      } else if (this.current === "NORMAL_BLINK") {
        blinkState = phase < 0.38 ? "closing" : "opening";
      } else if (phase < 0.3) {
        blinkState = phase / 0.3 < 0.38 ? "closing" : "opening";
      } else if (phase >= 0.48 && phase < 0.82) {
        blinkState = (phase - 0.48) / 0.34 < 0.38 ? "closing" : "opening";
      }
    }
    return {
      id: this.current,
      phase,
      remainingMs:
        this.current === "REST" ? 0 : Math.max(0, this.duration - elapsed),
      nextBehaviourMs: Math.max(0, this.nextBehaviourAt - this.clock),
      blinkState,
    };
  }
}

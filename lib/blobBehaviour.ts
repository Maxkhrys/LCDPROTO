/**
 * Concurrent HOME animation director.
 *
 * HOME is composed from independent mood, gaze, lids, mouth and body channels.
 * Every channel retargets its current spring state, preserving velocity, so an
 * incoming device state can interrupt from the exact presented pose. The
 * deterministic scheduler never calls Math.random() and allocates nothing in
 * the frame loop. All values are simple affine transforms suitable for ESP32.
 */

export type BehaviourId =
  | "REST"
  | "NORMAL_BLINK"
  | "DOUBLE_BLINK"
  | "GLANCE_LEFT"
  | "GLANCE_RIGHT"
  | "LOOK_UP"
  | "LOOK_DOWN"
  | "CURIOUS_TILT_LEFT"
  | "CURIOUS_TILT_RIGHT"
  | "BODY_SETTLE"
  | "TINY_SQUISH"
  | "SOFT_SWAY_LEFT"
  | "SOFT_SWAY_RIGHT"
  | "SIDE_SQUISH_LEFT"
  | "SIDE_SQUISH_RIGHT"
  | "TALL_STRETCH"
  | "JELLY_TWIST_LEFT"
  | "JELLY_TWIST_RIGHT"
  | "SOFT_SQUINT"
  | "ONE_EYE_SQUINT_LEFT"
  | "ONE_EYE_SQUINT_RIGHT"
  | "CURIOUS_WIDE"
  | "BREATH_STRETCH"
  | "MOUTH_RELAX"
  | "MOUTH_TWITCH"
  | "MOUTH_O"
  | "MOUTH_FLIP"
  | "SENSED_WORRIED"
  | "SENSED_SURPRISED"
  | "ANGRY_STARE"
  | "ANGRY_SQUINT"
  | "ANGRY_TILT"
  | "SAD_DOWNCAST"
  | "SAD_WOBBLE"
  | "SAD_SMALL"
  | "IDLE_SOFT_BREATH"
  | "IDLE_LOOK_AROUND"
  | "IDLE_SETTLE";

export type HomeMood =
  | "CONTENT"
  | "CURIOUS"
  | "SLEEPY"
  | "AMUSED"
  | "DISTRACTED"
  | "THOUGHTFUL";

type GazeBehaviour =
  | "GLANCE_LEFT"
  | "GLANCE_RIGHT"
  | "LOOK_UP"
  | "LOOK_DOWN"
  | "CURIOUS_TILT_LEFT"
  | "CURIOUS_TILT_RIGHT";
type ExpressionBehaviour =
  | "SOFT_SQUINT"
  | "ONE_EYE_SQUINT_LEFT"
  | "ONE_EYE_SQUINT_RIGHT"
  | "CURIOUS_WIDE";
type MouthBehaviour =
  | "MOUTH_RELAX"
  | "MOUTH_TWITCH"
  | "MOUTH_O"
  | "MOUTH_FLIP";
type BodyBehaviour = Exclude<
  BehaviourId,
  | "REST"
  | "NORMAL_BLINK"
  | "DOUBLE_BLINK"
  | GazeBehaviour
  | ExpressionBehaviour
  | MouthBehaviour
>;

export interface BehaviourConfig {
  gazePx: number;
  squash: number;
  paceScale: number;
  blinkIntervalMs: number;
}

/** Additive deltas on the calibrated neutral pose. */
export interface PoseDelta {
  blobX: number;
  blobY: number;
  blobRotation: number;
  blobScaleX: number;
  blobScaleY: number;
  bodyX: number;
  bodyY: number;
  bodyRotation: number;
  bodyScaleX: number;
  bodyScaleY: number;
  bodySkewX: number;
  bodySkewY: number;
  /** Pivot in local body space: -1 left/top, +1 right/bottom. */
  bodyOriginX: number;
  bodyOriginY: number;
  eyeX: number;
  eyeY: number;
  leftEyeX: number;
  leftEyeY: number;
  leftEyeScaleX: number;
  leftEyeScaleY: number;
  leftEyeRotation: number;
  rightEyeX: number;
  rightEyeY: number;
  rightEyeScaleX: number;
  rightEyeScaleY: number;
  rightEyeRotation: number;
  eyeLid: number;
  leftEyeTension: number;
  rightEyeTension: number;
  mouthX: number;
  mouthY: number;
  mouthScaleX: number;
  mouthScaleY: number;
  mouthRotation: number;
  mouthOpacity: number;
  mouthCurve: number;
  mouthO: number;
}

export const NEUTRAL_DELTA: PoseDelta = {
  blobX: 0,
  blobY: 0,
  blobRotation: 0,
  blobScaleX: 0,
  blobScaleY: 0,
  bodyX: 0,
  bodyY: 0,
  bodyRotation: 0,
  bodyScaleX: 0,
  bodyScaleY: 0,
  bodySkewX: 0,
  bodySkewY: 0,
  bodyOriginX: 0,
  bodyOriginY: 0.82,
  eyeX: 0,
  eyeY: 0,
  leftEyeX: 0,
  leftEyeY: 0,
  leftEyeScaleX: 0,
  leftEyeScaleY: 0,
  leftEyeRotation: 0,
  rightEyeX: 0,
  rightEyeY: 0,
  rightEyeScaleX: 0,
  rightEyeScaleY: 0,
  rightEyeRotation: 0,
  eyeLid: 1,
  leftEyeTension: 1,
  rightEyeTension: 1,
  mouthX: 0,
  mouthY: 0,
  mouthScaleX: 0,
  mouthScaleY: 0,
  mouthRotation: 0,
  mouthOpacity: 1,
  mouthCurve: 0.82,
  mouthO: 0,
};

const clamp = (v: number, min: number, max: number) =>
  v < min ? min : v > max ? max : v;
const clamp01 = (v: number) => clamp(v, 0, 1);
const smoothstep = (v: number) => {
  const t = clamp01(v);
  return t * t * (3 - 2 * t);
};
const preserveAreaX = (scaleYDelta: number) => 1 / (1 + scaleYDelta) - 1;

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

class SpringAxis {
  value: number;
  velocity = 0;
  target: number;

  constructor(initial = 0) {
    this.value = initial;
    this.target = initial;
  }

  reset(initial = 0) {
    this.value = initial;
    this.target = initial;
    this.velocity = 0;
  }

  step(dt: number, frequency: number, damping: number) {
    const omega = Math.PI * 2 * frequency;
    const acceleration =
      (this.target - this.value) * omega * omega -
      this.velocity * (2 * damping * omega);
    this.velocity += acceleration * dt;
    this.value += this.velocity * dt;
  }
}

interface MoodPose {
  leftTension: number;
  rightTension: number;
  eyeScaleX: number;
  eyeScaleY: number;
  mouthX: number;
  mouthY: number;
  mouthScaleX: number;
  mouthScaleY: number;
  mouthRotation: number;
  mouthCurve: number;
}

const MOODS: Record<HomeMood, MoodPose> = {
  CONTENT: {
    leftTension: 0.97,
    rightTension: 0.985,
    eyeScaleX: 0,
    eyeScaleY: 0,
    mouthX: 0,
    mouthY: 0,
    mouthScaleX: 0,
    mouthScaleY: 0,
    mouthRotation: 0,
    mouthCurve: 0.84,
  },
  CURIOUS: {
    leftTension: 1.06,
    rightTension: 1.08,
    eyeScaleX: 0.025,
    eyeScaleY: 0.06,
    mouthX: 0.25,
    mouthY: -0.18,
    mouthScaleX: -0.12,
    mouthScaleY: 0.09,
    mouthRotation: 2,
    mouthCurve: 0.45,
  },
  SLEEPY: {
    leftTension: 0.84,
    rightTension: 0.87,
    eyeScaleX: 0.035,
    eyeScaleY: -0.02,
    mouthX: -0.12,
    mouthY: 0.42,
    mouthScaleX: 0.05,
    mouthScaleY: -0.05,
    mouthRotation: -1.5,
    mouthCurve: 0.18,
  },
  AMUSED: {
    leftTension: 0.9,
    rightTension: 0.93,
    eyeScaleX: 0.02,
    eyeScaleY: -0.015,
    mouthX: 0.15,
    mouthY: -0.18,
    mouthScaleX: 0.075,
    mouthScaleY: 0.025,
    mouthRotation: 1.5,
    mouthCurve: 0.96,
  },
  DISTRACTED: {
    leftTension: 0.97,
    rightTension: 1.02,
    eyeScaleX: 0,
    eyeScaleY: 0.025,
    mouthX: 0.35,
    mouthY: 0.12,
    mouthScaleX: -0.06,
    mouthScaleY: 0.02,
    mouthRotation: 3,
    mouthCurve: 0.25,
  },
  THOUGHTFUL: {
    leftTension: 0.9,
    rightTension: 0.97,
    eyeScaleX: 0.025,
    eyeScaleY: -0.01,
    mouthX: -0.35,
    mouthY: 0.24,
    mouthScaleX: -0.08,
    mouthScaleY: 0.015,
    mouthRotation: -4,
    mouthCurve: -0.12,
  },
};

const MOOD_ORDER: readonly HomeMood[] = [
  "CONTENT",
  "CURIOUS",
  "SLEEPY",
  "AMUSED",
  "DISTRACTED",
  "THOUGHTFUL",
];

export interface BehaviourStatus {
  id: BehaviourId;
  phase: number;
  remainingMs: number;
  nextBehaviourMs: number;
  blinkState: "open" | "closing" | "closed" | "opening";
}

export interface HomeActivityStatus extends BehaviourStatus {
  mood: HomeMood;
  gaze: string;
  lids: string;
  mouth: string;
  body: string;
  nextGazeMs: number;
  nextBlinkMs: number;
  nextMouthMs: number;
  nextBodyMs: number;
  idleX: number;
  idleY: number;
  bodyRotation: number;
  bodySpeed: number;
}

/** Independent-channel director with current-presentation retargeting. */
export class BehaviourController {
  private clock = 0;
  private initialized = false;
  private autoWasEnabled = true;
  private rand = mulberry32(0x1a11ee);
  private mood: HomeMood = "CONTENT";
  private lastMood: HomeMood = "CONTENT";
  private nextMoodAt = 0;
  private nextMicroAt = 0;
  private nextGazeAt = 0;
  private nextBlinkAt = 0;
  private nextExpressionAt = 0;
  private nextMouthAt = 0;
  private nextBodyAt = 0;
  private nextBeatAt = 0;

  /** One authored thought can cue several channels without random collisions. */
  private beatUntil = 0;
  private beatExpressionAt = 0;
  private beatMouthAt = 0;
  private beatBodyAt = 0;
  private beatExpressionId: ExpressionBehaviour | null = null;
  private beatMouthId: MouthBehaviour | null = null;
  private beatBodyId: BodyBehaviour | null = null;
  private manualBeat = false;

  private gazeAction = "RESTING";
  private lidAction = "OPEN";
  private mouthAction = "SMILE";
  private bodyAction = "SUSPENDED";
  private gazeReleaseAt = 0;
  private expressionReleaseAt = 0;
  private mouthReleaseAt = 0;
  private bodyReleaseAt = 0;
  private followAt = 0;
  private followReleaseAt = 0;
  private followXTarget = 0;
  private followRotationTarget = 0;
  private followScaleYTarget = 0;

  private activityId: BehaviourId = "REST";
  private activityStartedAt = 0;
  private activityUntil = 0;

  private blinkStartedAt = -1;
  private blinkDouble = false;
  private blinkLid = 1;
  private blinkState: BehaviourStatus["blinkState"] = "open";

  private baseGazeX = 0;
  private baseGazeY = 0;
  private microX = 0;
  private microY = 0;

  private readonly leftX = new SpringAxis();
  private readonly leftY = new SpringAxis();
  private readonly rightX = new SpringAxis();
  private readonly rightY = new SpringAxis();
  private readonly leftScaleX = new SpringAxis();
  private readonly leftScaleY = new SpringAxis();
  private readonly rightScaleX = new SpringAxis();
  private readonly rightScaleY = new SpringAxis();
  private readonly leftRotation = new SpringAxis();
  private readonly rightRotation = new SpringAxis();
  private readonly leftTension = new SpringAxis(1);
  private readonly rightTension = new SpringAxis(1);
  private readonly mouthX = new SpringAxis();
  private readonly mouthY = new SpringAxis();
  private readonly mouthScaleX = new SpringAxis();
  private readonly mouthScaleY = new SpringAxis();
  private readonly mouthRotation = new SpringAxis();
  private readonly mouthCurve = new SpringAxis(0.82);
  private readonly mouthO = new SpringAxis();
  private mouthOpacityValue = 1;
  private mouthTurnStartedAt = -1;
  private mouthTurnTarget = 0;
  private mouthTurnSnapped = false;

  private bodyXTarget = 0;
  private bodyYTarget = 0;
  private bodyRotationTarget = 0;
  private bodyScaleYTarget = 0;
  private massXTarget = 0;
  private massYTarget = 0;
  private massRotationTarget = 0;
  private massScaleYTarget = 0;
  private massSkewXTarget = 0;
  private massSkewYTarget = 0;
  private massOriginXTarget = 0;
  private massOriginYTarget = 0.82;

  private readonly delta: PoseDelta = { ...NEUTRAL_DELTA };

  reset() {
    this.clock = 0;
    this.initialized = false;
    this.autoWasEnabled = true;
    this.rand = mulberry32(0x1a11ee);
    this.mood = "CONTENT";
    this.lastMood = "CONTENT";
    this.nextMoodAt = 0;
    this.nextMicroAt = 0;
    this.nextGazeAt = 0;
    this.nextBlinkAt = 0;
    this.nextExpressionAt = 0;
    this.nextMouthAt = 0;
    this.nextBodyAt = 0;
    this.nextBeatAt = 0;
    this.clearBeatCues();
    this.gazeAction = "RESTING";
    this.lidAction = "OPEN";
    this.mouthAction = "SMILE";
    this.bodyAction = "SUSPENDED";
    this.gazeReleaseAt = 0;
    this.expressionReleaseAt = 0;
    this.mouthReleaseAt = 0;
    this.bodyReleaseAt = 0;
    this.followAt = 0;
    this.followReleaseAt = 0;
    this.followXTarget = 0;
    this.followRotationTarget = 0;
    this.followScaleYTarget = 0;
    this.activityId = "REST";
    this.activityStartedAt = 0;
    this.activityUntil = 0;
    this.blinkStartedAt = -1;
    this.blinkDouble = false;
    this.blinkLid = 1;
    this.blinkState = "open";
    this.baseGazeX = 0;
    this.baseGazeY = 0;
    this.microX = 0;
    this.microY = 0;
    this.leftX.reset();
    this.leftY.reset();
    this.rightX.reset();
    this.rightY.reset();
    this.leftScaleX.reset();
    this.leftScaleY.reset();
    this.rightScaleX.reset();
    this.rightScaleY.reset();
    this.leftRotation.reset();
    this.rightRotation.reset();
    this.leftTension.reset(1);
    this.rightTension.reset(1);
    this.mouthX.reset();
    this.mouthY.reset();
    this.mouthScaleX.reset();
    this.mouthScaleY.reset();
    this.mouthRotation.reset();
    this.mouthCurve.reset(0.82);
    this.mouthO.reset();
    this.mouthOpacityValue = 1;
    this.mouthTurnStartedAt = -1;
    this.mouthTurnTarget = 0;
    this.mouthTurnSnapped = false;
    this.clearBodyTargets();
    this.applyMoodTargets();
    Object.assign(this.delta, NEUTRAL_DELTA);
  }

  /** Future device states can take over every channel from the current pose. */
  cancel() {
    this.clearBeatCues();
    this.gazeReleaseAt = this.expressionReleaseAt = this.mouthReleaseAt = 0;
    this.bodyReleaseAt = this.followAt = this.followReleaseAt = 0;
    this.baseGazeX = this.baseGazeY = this.microX = this.microY = 0;
    this.mouthOpacityValue = 1;
    this.mouthTurnStartedAt = -1;
    this.mouthTurnTarget = 0;
    this.mouthTurnSnapped = false;
    this.retargetEyes();
    this.clearBodyTargets();
    this.mood = "CONTENT";
    this.applyMoodTargets();
    this.activityId = "REST";
    this.activityUntil = this.clock;
    this.nextBeatAt = this.clock + 900;
  }

  trigger(id: BehaviourId, cfg: BehaviourConfig) {
    this.ensureSchedule(cfg);
    this.clearBeatCues();
    if (id === "REST") {
      this.cancel();
      return;
    }
    if (id === "NORMAL_BLINK" || id === "DOUBLE_BLINK") {
      this.startBlink(id === "DOUBLE_BLINK", cfg);
      return;
    }
    if (
      id === "GLANCE_LEFT" ||
      id === "GLANCE_RIGHT" ||
      id === "LOOK_UP" ||
      id === "LOOK_DOWN" ||
      id === "CURIOUS_TILT_LEFT" ||
      id === "CURIOUS_TILT_RIGHT"
    ) {
      this.startGaze(id, cfg);
      return;
    }
    if (
      id === "SOFT_SQUINT" ||
      id === "ONE_EYE_SQUINT_LEFT" ||
      id === "ONE_EYE_SQUINT_RIGHT" ||
      id === "CURIOUS_WIDE"
    ) {
      this.startExpression(id);
      return;
    }
    if (
      id === "MOUTH_RELAX" ||
      id === "MOUTH_TWITCH" ||
      id === "MOUTH_O" ||
      id === "MOUTH_FLIP"
    ) {
      this.startMouth(id);
      return;
    }
    if (id === "SENSED_WORRIED" || id === "SENSED_SURPRISED") {
      this.startSensedVariant(id, cfg);
      return;
    }
    if (
      id === "ANGRY_STARE" ||
      id === "ANGRY_SQUINT" ||
      id === "ANGRY_TILT" ||
      id === "SAD_DOWNCAST" ||
      id === "SAD_WOBBLE" ||
      id === "SAD_SMALL" ||
      id === "IDLE_SOFT_BREATH" ||
      id === "IDLE_LOOK_AROUND" ||
      id === "IDLE_SETTLE"
    ) {
      this.startLibraryBeat(id, cfg);
      return;
    }
    this.startBody(id, cfg);
  }

  /**
   * Advance the presentation every frame. `autoEnabled` only gates the seeded
   * playlist; direct trigger() calls and any active spring are always allowed
   * to finish, which keeps manual cue inspection useful.
   */
  update(dtMs: number, cfg: BehaviourConfig, autoEnabled = true) {
    this.ensureSchedule(cfg);
    this.clock += Math.max(0, dtMs);

    if (!autoEnabled && this.autoWasEnabled && !this.manualBeat)
      this.clearBeatCues();
    if (autoEnabled && !this.autoWasEnabled) this.resumeAutomaticSchedule(cfg);
    this.autoWasEnabled = autoEnabled;

    if (this.gazeReleaseAt > 0 && this.clock >= this.gazeReleaseAt) {
      this.gazeReleaseAt = 0;
      this.baseGazeX = 0;
      this.baseGazeY = 0;
      this.gazeAction = "RESTING";
      this.retargetEyes();
    }
    if (this.expressionReleaseAt > 0 && this.clock >= this.expressionReleaseAt) {
      this.expressionReleaseAt = 0;
      this.lidAction = "MOOD";
      this.applyMoodEyeTargets();
    }
    if (this.mouthReleaseAt > 0 && this.clock >= this.mouthReleaseAt) {
      this.mouthReleaseAt = 0;
      this.mouthAction = "MOOD";
      this.applyMoodMouthTargets();
    }
    if (this.bodyReleaseAt > 0 && this.clock >= this.bodyReleaseAt) {
      this.bodyReleaseAt = 0;
      this.bodyAction = "SETTLING";
      this.clearBodyTargets();
    }
    if (this.followAt > 0 && this.clock >= this.followAt) {
      this.followAt = 0;
      this.followReleaseAt = this.clock + 520;
    }
    if (this.followReleaseAt > 0 && this.clock >= this.followReleaseAt) {
      this.followReleaseAt = 0;
      this.followXTarget = 0;
      this.followRotationTarget = 0;
      this.followScaleYTarget = 0;
    }

    if (autoEnabled) {
      this.runBeatCues(cfg);

      if (this.clock >= this.nextMoodAt) this.pickMood(cfg);
      if (this.clock >= this.nextMicroAt) this.pickMicro(cfg);
      if (this.clock >= this.nextBeatAt && this.beatUntil === 0)
        this.pickBeat(cfg);
      if (this.clock >= this.nextBlinkAt && this.blinkStartedAt < 0)
        this.startBlink(this.rand() < 0.14, cfg);
    }

    this.updateBlink();
    this.updateMouthTurn();
    this.stepFaceSprings(dtMs);
  }

  private ensureSchedule(cfg: BehaviourConfig) {
    if (this.initialized) return;
    this.initialized = true;
    this.nextMoodAt = 5600 + this.rand() * 2200;
    this.nextMicroAt = 260 + this.rand() * 280;
    this.nextBeatAt = 1100 + this.rand() * 900;
    this.nextGazeAt = this.nextBeatAt;
    this.nextExpressionAt = this.nextBeatAt;
    this.nextMouthAt = this.nextBeatAt;
    this.nextBodyAt = this.nextBeatAt;
    this.nextBlinkAt = this.clock + this.blinkGap(cfg);
    this.applyMoodTargets();
  }

  /** Start a fresh, non-backlogged playlist after manual inspection. */
  private resumeAutomaticSchedule(cfg: BehaviourConfig) {
    this.nextMoodAt = this.clock + this.interval(5200, 8200, cfg);
    this.nextMicroAt = this.clock + this.interval(350, 900, cfg);
    this.nextBeatAt = this.clock + this.interval(1000, 1700, cfg);
    this.nextGazeAt = this.nextBeatAt;
    this.nextExpressionAt = this.nextBeatAt;
    this.nextMouthAt = this.nextBeatAt;
    this.nextBodyAt = this.nextBeatAt;
    this.nextBlinkAt = this.clock + this.blinkGap(cfg);
  }

  private clearBeatCues() {
    this.beatUntil = 0;
    this.beatExpressionAt = 0;
    this.beatMouthAt = 0;
    this.beatBodyAt = 0;
    this.beatExpressionId = null;
    this.beatMouthId = null;
    this.beatBodyId = null;
    this.manualBeat = false;
  }

  /** Deliver delayed cues in face-first, body-last order. */
  private runBeatCues(cfg: BehaviourConfig) {
    if (this.beatExpressionAt > 0 && this.clock >= this.beatExpressionAt) {
      const id = this.beatExpressionId;
      this.beatExpressionAt = 0;
      this.beatExpressionId = null;
      if (id) this.startExpression(id);
    }
    if (this.beatMouthAt > 0 && this.clock >= this.beatMouthAt) {
      const id = this.beatMouthId;
      this.beatMouthAt = 0;
      this.beatMouthId = null;
      if (id) this.startMouth(id);
    }
    if (this.beatBodyAt > 0 && this.clock >= this.beatBodyAt) {
      const id = this.beatBodyId;
      this.beatBodyAt = 0;
      this.beatBodyId = null;
      if (id) this.startBody(id, cfg);
    }
    if (
      this.beatUntil > 0 &&
      this.clock >= this.beatUntil &&
      this.beatExpressionAt === 0 &&
      this.beatMouthAt === 0 &&
      this.beatBodyAt === 0
    ) {
      this.beatUntil = 0;
      this.manualBeat = false;
    }
  }

  /**
   * Pick one small thought and stage its channels. This replaces four
   * unrelated random action clocks: eyes lead, expression follows, then the
   * body answers. Blinks and micro-saccades remain independent overlays.
   */
  private pickBeat(cfg: BehaviourConfig) {
    const side = this.rand() < 0.5 ? "LEFT" : "RIGHT";
    const r = this.rand();
    let gaze: GazeBehaviour | null = null;
    let expression: ExpressionBehaviour | null = null;
    let mouth: MouthBehaviour | null = null;
    let body: BodyBehaviour | null = null;

    if (r < 0.23) {
      gaze = side === "LEFT" ? "GLANCE_LEFT" : "GLANCE_RIGHT";
      expression =
        this.rand() < 0.42
          ? side === "LEFT"
            ? "ONE_EYE_SQUINT_RIGHT"
            : "ONE_EYE_SQUINT_LEFT"
          : null;
      mouth = this.rand() < 0.34 ? "MOUTH_TWITCH" : null;
    } else if (r < 0.39) {
      gaze = "LOOK_UP";
      expression = "CURIOUS_WIDE";
      mouth = this.rand() < 0.74 ? "MOUTH_O" : "MOUTH_TWITCH";
    } else if (r < 0.53) {
      gaze = "LOOK_DOWN";
      expression = "SOFT_SQUINT";
      mouth = "MOUTH_RELAX";
    } else if (r < 0.68) {
      gaze = side === "LEFT" ? "CURIOUS_TILT_LEFT" : "CURIOUS_TILT_RIGHT";
      expression =
        side === "LEFT" ? "ONE_EYE_SQUINT_LEFT" : "ONE_EYE_SQUINT_RIGHT";
      mouth = "MOUTH_TWITCH";
      body = side === "LEFT" ? "SOFT_SWAY_LEFT" : "SOFT_SWAY_RIGHT";
    } else if (r < 0.82) {
      expression = "SOFT_SQUINT";
      mouth = "MOUTH_RELAX";
      body = this.rand() < 0.52 ? "BODY_SETTLE" : "TINY_SQUISH";
    } else if (r < 0.94) {
      expression =
        side === "LEFT" ? "ONE_EYE_SQUINT_LEFT" : "ONE_EYE_SQUINT_RIGHT";
      mouth = "MOUTH_TWITCH";
      body = side === "LEFT" ? "SIDE_SQUISH_LEFT" : "SIDE_SQUISH_RIGHT";
    } else {
      gaze = "LOOK_UP";
      expression = "CURIOUS_WIDE";
      mouth = "MOUTH_O";
      body =
        this.rand() < 0.58
          ? "TALL_STRETCH"
          : side === "LEFT"
            ? "JELLY_TWIST_LEFT"
            : "JELLY_TWIST_RIGHT";
    }

    // The inverted mouth is a rare readable beat, not a normal resting pose.
    if (mouth && this.rand() < 0.14) mouth = "MOUTH_FLIP";

    const expressionDelay = expression ? 48 + this.rand() * 35 : 0;
    const mouthDelay = mouth ? 82 + this.rand() * 42 : 0;
    const bodyDelay = body ? 106 + this.rand() * 24 : 0;
    this.beatExpressionAt = expression ? this.clock + expressionDelay : 0;
    this.beatMouthAt = mouth ? this.clock + mouthDelay : 0;
    this.beatBodyAt = body ? this.clock + bodyDelay : 0;
    this.beatExpressionId = expression;
    this.beatMouthId = mouth;
    this.beatBodyId = body;
    this.beatUntil = this.clock + (body ? 2050 : gaze ? 1650 : 1400);

    if (gaze) this.startGaze(gaze, cfg);

    const next = this.clock + this.interval(1850, 3400, cfg);
    this.nextBeatAt = Math.max(next, this.beatUntil + 260);
    this.nextGazeAt = this.nextBeatAt;
    this.nextExpressionAt = this.nextBeatAt;
    this.nextMouthAt = this.nextBeatAt;
    this.nextBodyAt = this.nextBeatAt;
  }

  private interval(min: number, max: number, cfg: BehaviourConfig) {
    return (min + this.rand() * (max - min)) * cfg.paceScale;
  }

  private blinkGap(cfg: BehaviourConfig) {
    return cfg.blinkIntervalMs * (0.82 + this.rand() * 0.36);
  }

  private mark(id: BehaviourId, duration: number) {
    this.activityId = id;
    this.activityStartedAt = this.clock;
    this.activityUntil = this.clock + duration;
  }

  private pickMood(cfg: BehaviourConfig) {
    let next = this.lastMood;
    while (next === this.lastMood) {
      next = MOOD_ORDER[Math.floor(this.rand() * MOOD_ORDER.length)];
    }
    this.mood = next;
    this.lastMood = next;
    this.nextMoodAt = this.clock + this.interval(6000, 11000, cfg);
    if (this.expressionReleaseAt === 0) this.applyMoodEyeTargets();
    if (this.mouthReleaseAt === 0) this.applyMoodMouthTargets();
  }

  private pickMicro(cfg: BehaviourConfig) {
    const amplitude = 0.32 + this.rand() * 0.48;
    const angle = this.rand() * Math.PI * 2;
    this.microX = Math.cos(angle) * amplitude;
    this.microY = Math.sin(angle) * amplitude * 0.62;
    this.retargetEyes();
    this.nextMicroAt = this.clock + this.interval(350, 900, cfg);
  }

  private startGaze(id: BehaviourId, cfg: BehaviourConfig) {
    const amount = clamp(cfg.gazePx, 0, 4.5);
    let x = 0;
    let y = 0;
    let bodyDir = 0;
    let duration = 900;
    if (id === "GLANCE_LEFT" || id === "GLANCE_RIGHT") {
      bodyDir = id === "GLANCE_LEFT" ? -1 : 1;
      x = bodyDir * amount * (0.92 + this.rand() * 0.22);
      y = -0.2 + this.rand() * 0.38;
      duration = 820 + this.rand() * 520;
    } else if (id === "LOOK_UP") {
      y = -amount * 0.78;
      x = (this.rand() * 2 - 1) * 0.35;
      duration = 900 + this.rand() * 500;
    } else if (id === "LOOK_DOWN") {
      y = amount * 0.64;
      x = (this.rand() * 2 - 1) * 0.45;
      duration = 780 + this.rand() * 430;
    } else {
      bodyDir = id === "CURIOUS_TILT_LEFT" ? -1 : 1;
      x = bodyDir * amount * 0.72;
      y = -amount * 0.28;
      duration = 1050 + this.rand() * 520;
    }
    this.leftRotation.target =
      id === "CURIOUS_TILT_LEFT" || id === "CURIOUS_TILT_RIGHT"
        ? bodyDir * 1.6
        : 0;
    this.rightRotation.target =
      id === "CURIOUS_TILT_LEFT" || id === "CURIOUS_TILT_RIGHT"
        ? bodyDir * 1.15
        : 0;
    this.baseGazeX = x;
    this.baseGazeY = y;
    this.microX = 0;
    this.microY = 0;
    this.gazeAction = id;
    this.gazeReleaseAt = this.clock + duration;
    this.retargetEyes();
    this.followAt = this.clock + 85 + this.rand() * 35;
    this.followXTarget = bodyDir * 1.5;
    this.followRotationTarget = bodyDir * 1.25;
    this.followScaleYTarget = y < -1 ? 0.025 : y > 1 ? -0.022 : -0.012;
    this.mark(id, duration + 650);
  }

  private retargetEyes() {
    const x = this.baseGazeX + this.microX;
    const y = this.baseGazeY + this.microY;
    this.leftX.target = x;
    this.leftY.target = y;
    this.rightX.target = x * 0.965;
    this.rightY.target = y * 0.98;
  }

  private startExpression(id: BehaviourId) {
    const mood = MOODS[this.mood];
    let duration = 850;
    if (id === "SOFT_SQUINT") {
      this.leftTension.target = 0.7;
      this.rightTension.target = 0.76;
      this.leftScaleX.target = mood.eyeScaleX + 0.055;
      this.rightScaleX.target = mood.eyeScaleX + 0.045;
      duration = 850 + this.rand() * 650;
    } else if (id === "ONE_EYE_SQUINT_LEFT") {
      this.leftTension.target = 0.58;
      this.rightTension.target = mood.rightTension * 0.98;
      this.leftRotation.target = -2.2;
      duration = 680 + this.rand() * 500;
    } else if (id === "ONE_EYE_SQUINT_RIGHT") {
      this.rightTension.target = 0.58;
      this.leftTension.target = mood.leftTension * 0.98;
      this.rightRotation.target = 2.2;
      duration = 680 + this.rand() * 500;
    } else {
      this.leftTension.target = 1.1;
      this.rightTension.target = 1.12;
      this.leftScaleX.target = mood.eyeScaleX + 0.045;
      this.rightScaleX.target = mood.eyeScaleX + 0.045;
      this.leftScaleY.target = mood.eyeScaleY + 0.12;
      this.rightScaleY.target = mood.eyeScaleY + 0.12;
      duration = 760 + this.rand() * 520;
    }
    this.lidAction = id;
    this.expressionReleaseAt = this.clock + duration;
    this.mark(id, duration + 300);
  }

  private startMouth(id: BehaviourId) {
    let duration = 720;
    if (id === "MOUTH_RELAX") {
      this.mouthX.target = 0;
      this.mouthY.target = 0.7;
      this.mouthScaleX.target = 0.09;
      this.mouthScaleY.target = -0.1;
      this.mouthCurve.target = 0.5;
      this.mouthO.target = 0;
      this.setMouthRotationTarget(0);
      duration = 900 + this.rand() * 500;
    } else if (id === "MOUTH_TWITCH") {
      const dir = this.rand() < 0.5 ? -1 : 1;
      this.mouthX.target = dir * 0.9;
      this.mouthY.target = -0.08;
      this.mouthScaleX.target = 0.04;
      this.mouthScaleY.target = -0.02;
      this.mouthCurve.target = 0.62 + dir * 0.18;
      this.mouthO.target = 0;
      this.setMouthRotationTarget(dir * 4.5);
      duration = 380 + this.rand() * 260;
    } else if (id === "MOUTH_O") {
      this.mouthX.target = 0;
      this.mouthY.target = -0.28;
      this.mouthScaleX.target = -0.16;
      this.mouthScaleY.target = 0.08;
      this.mouthCurve.target = 0;
      this.mouthO.target = 1;
      this.setMouthRotationTarget(0);
      duration = 820 + this.rand() * 520;
    } else {
      this.mouthX.target = 0;
      this.mouthY.target = 0.3;
      this.mouthScaleX.target = -0.12;
      this.mouthScaleY.target = 0.06;
      this.mouthCurve.target = -1;
      this.mouthO.target = 0;
      this.setMouthRotationTarget(0);
      duration = 1100 + this.rand() * 650;
    }
    this.mouthAction = id;
    this.mouthReleaseAt = this.clock + duration;
    this.mark(id, duration + 300);
  }

  /**
   * SENSED variants are short coordinated thoughts, not separate animation
   * systems. Eyes lead, mouth follows, and the jelly body answers last while
   * the normal SENSED idle playlist remains available between beats.
   */
  private startSensedVariant(
    id: "SENSED_WORRIED" | "SENSED_SURPRISED",
    cfg: BehaviourConfig
  ) {
    this.clearBeatCues();
    const worried = id === "SENSED_WORRIED";
    this.startGaze(worried ? "LOOK_DOWN" : "LOOK_UP", cfg);
    this.beatExpressionAt = this.clock + 58;
    this.beatExpressionId = worried ? "SOFT_SQUINT" : "CURIOUS_WIDE";
    this.beatMouthAt = this.clock + 94;
    this.beatMouthId = worried ? "MOUTH_FLIP" : "MOUTH_O";
    this.beatBodyAt = this.clock + 122;
    this.beatBodyId = worried ? "BODY_SETTLE" : "TALL_STRETCH";
    this.beatUntil = this.clock + (worried ? 1900 : 1650);
    this.manualBeat = true;
    this.nextBeatAt = Math.max(this.nextBeatAt, this.beatUntil + 260);
    this.activityId = id;
    this.activityStartedAt = this.clock;
    this.activityUntil = this.beatUntil;
    // Let the authored beat land cleanly before an automatic blink competes
    // with it. Manual blink tests still work immediately.
    this.nextBlinkAt = Math.max(this.nextBlinkAt, this.beatUntil + 180);
  }

  /** Reusable emotion and idle beats for the expression library. */
  private startLibraryBeat(
    id:
      | "ANGRY_STARE"
      | "ANGRY_SQUINT"
      | "ANGRY_TILT"
      | "SAD_DOWNCAST"
      | "SAD_WOBBLE"
      | "SAD_SMALL"
      | "IDLE_SOFT_BREATH"
      | "IDLE_LOOK_AROUND"
      | "IDLE_SETTLE",
    cfg: BehaviourConfig
  ) {
    this.clearBeatCues();
    let gaze: GazeBehaviour | null = null;
    let expression: ExpressionBehaviour | null = null;
    let mouth: MouthBehaviour | null = null;
    let body: BodyBehaviour | null = null;
    let duration = 1500;

    switch (id) {
      case "ANGRY_STARE":
        expression = "SOFT_SQUINT";
        mouth = "MOUTH_FLIP";
        body = "JELLY_TWIST_RIGHT";
        duration = 1650;
        break;
      case "ANGRY_SQUINT":
        expression = "SOFT_SQUINT";
        mouth = "MOUTH_FLIP";
        body = "SIDE_SQUISH_RIGHT";
        duration = 1450;
        break;
      case "ANGRY_TILT":
        gaze = "CURIOUS_TILT_RIGHT";
        expression = "ONE_EYE_SQUINT_RIGHT";
        mouth = "MOUTH_FLIP";
        body = "JELLY_TWIST_RIGHT";
        duration = 1750;
        break;
      case "SAD_DOWNCAST":
        gaze = "LOOK_DOWN";
        expression = "SOFT_SQUINT";
        mouth = "MOUTH_FLIP";
        body = "BODY_SETTLE";
        duration = 1900;
        break;
      case "SAD_WOBBLE":
        gaze = "LOOK_DOWN";
        expression = "ONE_EYE_SQUINT_LEFT";
        mouth = "MOUTH_FLIP";
        body = "SOFT_SWAY_LEFT";
        duration = 1850;
        break;
      case "SAD_SMALL":
        gaze = "LOOK_DOWN";
        expression = "SOFT_SQUINT";
        mouth = "MOUTH_RELAX";
        body = "BREATH_STRETCH";
        duration = 1700;
        break;
      case "IDLE_SOFT_BREATH":
        expression = "SOFT_SQUINT";
        mouth = "MOUTH_RELAX";
        body = "BREATH_STRETCH";
        duration = 1550;
        break;
      case "IDLE_LOOK_AROUND":
        gaze = "GLANCE_LEFT";
        duration = 1250;
        break;
      case "IDLE_SETTLE":
        expression = "SOFT_SQUINT";
        mouth = "MOUTH_RELAX";
        body = "BODY_SETTLE";
        duration = 1600;
        break;
    }

    if (gaze) this.startGaze(gaze, cfg);
    this.beatExpressionAt = expression ? this.clock + 56 : 0;
    this.beatMouthAt = mouth ? this.clock + 92 : 0;
    this.beatBodyAt = body ? this.clock + 118 : 0;
    this.beatExpressionId = expression;
    this.beatMouthId = mouth;
    this.beatBodyId = body;
    this.beatUntil = this.clock + duration;
    this.manualBeat = true;
    this.nextBeatAt = Math.max(this.nextBeatAt, this.beatUntil + 260);
    this.activityId = id;
    this.activityStartedAt = this.clock;
    this.activityUntil = this.beatUntil;
  }

  private startBody(id: BehaviourId, cfg: BehaviourConfig) {
    const strength = clamp(cfg.squash / 0.032, 0.55, 1.35);
    let sy = 0;
    let duration = 620;
    let dir = 0;
    this.clearBodyTargets();
    if (id === "BODY_SETTLE") {
      sy = -0.064 * strength;
      this.bodyYTarget = 3.2;
      this.massYTarget = 1.6;
      this.massScaleYTarget = -0.025 * strength;
      this.massOriginYTarget = 0.96;
      duration = 520;
    } else if (id === "TINY_SQUISH") {
      sy = -0.052 * strength;
      this.bodyYTarget = 1.8;
      this.massYTarget = 0.8;
      this.massScaleYTarget = -0.02 * strength;
      this.massOriginYTarget = 0.94;
      duration = 420;
    } else if (id === "SOFT_SWAY_LEFT" || id === "SOFT_SWAY_RIGHT") {
      dir = id === "SOFT_SWAY_LEFT" ? -1 : 1;
      sy = -0.025 * strength;
      this.bodyXTarget = dir * 3;
      this.bodyRotationTarget = dir * 1.75;
      this.massXTarget = dir * 2;
      this.massRotationTarget = dir * 1.45;
      this.massSkewYTarget = dir * 1.8;
      this.massOriginXTarget = -dir * 0.9;
      duration = 760;
    } else if (id === "SIDE_SQUISH_LEFT" || id === "SIDE_SQUISH_RIGHT") {
      dir = id === "SIDE_SQUISH_LEFT" ? -1 : 1;
      const sx = -0.066 * strength;
      sy = 1 / (1 + sx) - 1;
      this.bodyXTarget = dir * 3.4;
      this.bodyRotationTarget = dir * 1.05;
      this.massXTarget = dir * 2.5;
      this.massRotationTarget = dir * 1.7;
      this.massSkewYTarget = dir * 2.6;
      this.massOriginXTarget = -dir;
      this.bodyScaleYTarget = sy;
      this.massScaleYTarget = sy * 0.34;
      duration = 570;
    } else if (id === "TALL_STRETCH" || id === "BREATH_STRETCH") {
      sy = (id === "TALL_STRETCH" ? 0.082 : 0.058) * strength;
      this.bodyYTarget = id === "TALL_STRETCH" ? -2.6 : -1.5;
      this.massYTarget = -1.1;
      this.massScaleYTarget = sy * 0.38;
      this.massOriginYTarget = 0.98;
      duration = id === "TALL_STRETCH" ? 690 : 920;
    } else {
      dir = id === "JELLY_TWIST_LEFT" ? -1 : 1;
      sy = 0.034 * strength;
      this.bodyXTarget = dir * 2.4;
      this.bodyRotationTarget = dir * 1.55;
      this.massXTarget = dir * 1.8;
      this.massRotationTarget = dir * 3.2;
      this.massSkewXTarget = -dir * 1.8;
      this.massSkewYTarget = dir * 2.8;
      this.massOriginXTarget = -dir * 0.95;
      duration = 670;
    }
    if (id !== "SIDE_SQUISH_LEFT" && id !== "SIDE_SQUISH_RIGHT") {
      this.bodyScaleYTarget = sy;
    }
    this.bodyAction = id;
    this.bodyReleaseAt = this.clock + duration;
    this.mark(id, duration + 750);
  }

  private clearBodyTargets() {
    this.bodyXTarget = 0;
    this.bodyYTarget = 0;
    this.bodyRotationTarget = 0;
    this.bodyScaleYTarget = 0;
    this.massXTarget = 0;
    this.massYTarget = 0;
    this.massRotationTarget = 0;
    this.massScaleYTarget = 0;
    this.massSkewXTarget = 0;
    this.massSkewYTarget = 0;
    this.massOriginXTarget = 0;
    this.massOriginYTarget = 0.82;
  }

  private startBlink(double: boolean, cfg?: BehaviourConfig) {
    this.blinkStartedAt = this.clock;
    this.blinkDouble = double;
    this.lidAction = double ? "DOUBLE_BLINK" : "NORMAL_BLINK";
    this.mark(double ? "DOUBLE_BLINK" : "NORMAL_BLINK", double ? 515 : 205);
    if (cfg) this.nextBlinkAt = this.clock + this.blinkGap(cfg);
  }

  private updateBlink() {
    if (this.blinkStartedAt < 0) {
      this.blinkLid = 1;
      this.blinkState = "open";
      return;
    }
    const elapsed = this.clock - this.blinkStartedAt;
    const cycle = 205;
    const gap = 105;
    const local =
      this.blinkDouble && elapsed >= cycle + gap ? elapsed - cycle - gap : elapsed;
    const inGap = this.blinkDouble && elapsed >= cycle && elapsed < cycle + gap;
    const done = this.blinkDouble ? elapsed >= cycle * 2 + gap : elapsed >= cycle;
    if (done) {
      this.blinkStartedAt = -1;
      this.blinkLid = 1;
      this.blinkState = "open";
      this.lidAction = this.expressionReleaseAt > 0 ? this.lidAction : "MOOD";
      return;
    }
    if (inGap) {
      this.blinkLid = 1;
      this.blinkState = "open";
      return;
    }
    const closeMs = 65;
    const min = 0;
    if (local < closeMs) {
      const t = smoothstep(local / closeMs);
      this.blinkLid = 1 - t * (1 - min);
      this.blinkState = t > 0.9 ? "closed" : "closing";
    } else {
      const t = smoothstep((local - closeMs) / (cycle - closeMs));
      this.blinkLid = min + t * (1 - min);
      this.blinkState = t < 0.08 ? "closed" : "opening";
    }
  }

  private applyMoodTargets() {
    this.applyMoodEyeTargets();
    this.applyMoodMouthTargets();
  }

  private applyMoodEyeTargets() {
    const mood = MOODS[this.mood];
    this.leftTension.target = mood.leftTension;
    this.rightTension.target = mood.rightTension;
    this.leftScaleX.target = mood.eyeScaleX;
    this.rightScaleX.target = mood.eyeScaleX;
    this.leftScaleY.target = mood.eyeScaleY;
    this.rightScaleY.target = mood.eyeScaleY;
    this.leftRotation.target = 0;
    this.rightRotation.target = 0;
  }

  private applyMoodMouthTargets() {
    const mood = MOODS[this.mood];
    this.mouthX.target = mood.mouthX;
    this.mouthY.target = mood.mouthY;
    this.mouthScaleX.target = mood.mouthScaleX;
    this.mouthScaleY.target = mood.mouthScaleY;
    this.mouthCurve.target = mood.mouthCurve;
    this.mouthO.target = 0;
    this.setMouthRotationTarget(mood.mouthRotation);
  }

  private setMouthRotationTarget(target: number) {
    // Mouth orientation stays stable. Smile/frown morph belongs to vertical
    // scale, so the artwork never spins or vanishes between expressions.
    this.mouthRotation.target = clamp(target, -12, 12);
    this.mouthTurnStartedAt = -1;
    this.mouthTurnTarget = 0;
    this.mouthTurnSnapped = false;
    this.mouthOpacityValue = 1;
  }

  private updateMouthTurn() {
    this.mouthOpacityValue = 1;
  }

  private stepFaceSprings(dtMs: number) {
    const seconds = Math.min(Math.max(dtMs, 0), 100) / 1000;
    if (seconds <= 0) return;
    const steps = Math.max(1, Math.ceil(seconds * 120));
    const dt = seconds / steps;
    for (let i = 0; i < steps; i += 1) {
      this.leftX.step(dt, 9.4, 0.72);
      this.leftY.step(dt, 9.2, 0.72);
      this.rightX.step(dt, 7.9, 0.74);
      this.rightY.step(dt, 7.8, 0.74);
      this.leftScaleX.step(dt, 7, 0.72);
      this.leftScaleY.step(dt, 7.2, 0.72);
      this.rightScaleX.step(dt, 6.5, 0.74);
      this.rightScaleY.step(dt, 6.7, 0.74);
      this.leftRotation.step(dt, 6.4, 0.72);
      this.rightRotation.step(dt, 6.1, 0.74);
      this.leftTension.step(dt, 7.8, 0.76);
      this.rightTension.step(dt, 7.2, 0.77);
      this.mouthX.step(dt, 6.4, 0.7);
      this.mouthY.step(dt, 6.2, 0.7);
      this.mouthScaleX.step(dt, 6.8, 0.69);
      this.mouthScaleY.step(dt, 6.6, 0.7);
      this.mouthRotation.step(dt, 5.5, 0.72);
      this.mouthCurve.step(dt, 5.8, 0.72);
      this.mouthO.step(dt, 6.2, 0.7);
    }
  }

  /** Reused every frame. */
  pose(): PoseDelta {
    const followActive = this.followReleaseAt > 0;
    const scaleY =
      this.bodyScaleYTarget + (followActive ? this.followScaleYTarget : 0);
    const horizontalSpeed = Math.max(
      Math.abs(this.leftX.velocity),
      Math.abs(this.rightX.velocity)
    );
    const verticalUpSpeed = Math.max(
      0,
      -Math.min(this.leftY.velocity, this.rightY.velocity)
    );
    const velocityNarrow = Math.min(0.065, horizontalSpeed * 0.00165);
    const velocityStretch = Math.min(0.075, verticalUpSpeed * 0.0021);

    this.delta.blobX =
      this.bodyXTarget + (followActive ? this.followXTarget : 0);
    this.delta.blobY = this.bodyYTarget;
    this.delta.blobRotation =
      this.bodyRotationTarget +
      (followActive ? this.followRotationTarget : 0);
    this.delta.blobScaleY = scaleY;
    this.delta.blobScaleX = preserveAreaX(scaleY);
    this.delta.bodyX = this.massXTarget;
    this.delta.bodyY = this.massYTarget;
    this.delta.bodyRotation = this.massRotationTarget;
    this.delta.bodyScaleY = this.massScaleYTarget;
    this.delta.bodyScaleX = preserveAreaX(this.massScaleYTarget);
    this.delta.bodySkewX = this.massSkewXTarget;
    this.delta.bodySkewY = this.massSkewYTarget;
    this.delta.bodyOriginX = this.massOriginXTarget;
    this.delta.bodyOriginY = this.massOriginYTarget;
    this.delta.eyeX = 0;
    this.delta.eyeY = 0;
    this.delta.leftEyeX = this.leftX.value;
    this.delta.leftEyeY = this.leftY.value;
    this.delta.leftEyeScaleX = this.leftScaleX.value - velocityNarrow;
    this.delta.leftEyeScaleY = this.leftScaleY.value + velocityStretch;
    this.delta.leftEyeRotation = this.leftRotation.value;
    this.delta.rightEyeX = this.rightX.value;
    this.delta.rightEyeY = this.rightY.value;
    this.delta.rightEyeScaleX = this.rightScaleX.value - velocityNarrow * 0.9;
    this.delta.rightEyeScaleY = this.rightScaleY.value + velocityStretch * 0.92;
    this.delta.rightEyeRotation = this.rightRotation.value;
    this.delta.eyeLid = this.blinkLid;
    this.delta.leftEyeTension = this.leftTension.value;
    this.delta.rightEyeTension = this.rightTension.value;
    this.delta.mouthX = this.mouthX.value;
    this.delta.mouthY = this.mouthY.value;
    this.delta.mouthScaleX = this.mouthScaleX.value;
    this.delta.mouthScaleY = this.mouthScaleY.value;
    this.delta.mouthRotation = this.mouthRotation.value;
    this.delta.mouthOpacity = this.mouthOpacityValue;
    this.delta.mouthCurve = this.mouthCurve.value;
    this.delta.mouthO = this.mouthO.value;
    return this.delta;
  }

  status(): BehaviourStatus &
    Pick<
      HomeActivityStatus,
      | "mood"
      | "gaze"
      | "lids"
      | "mouth"
      | "body"
      | "nextGazeMs"
      | "nextBlinkMs"
      | "nextMouthMs"
      | "nextBodyMs"
    > {
    const active = this.clock < this.activityUntil;
    const duration = Math.max(1, this.activityUntil - this.activityStartedAt);
    const next = Math.min(
      this.nextGazeAt,
      this.nextBlinkAt,
      this.nextExpressionAt,
      this.nextMouthAt,
      this.nextBodyAt,
      this.nextMicroAt
    );
    return {
      id: active ? this.activityId : "REST",
      phase: active
        ? clamp01((this.clock - this.activityStartedAt) / duration)
        : 0,
      remainingMs: active ? Math.max(0, this.activityUntil - this.clock) : 0,
      nextBehaviourMs: Math.max(0, next - this.clock),
      blinkState: this.blinkState,
      mood: this.mood,
      gaze: this.gazeAction,
      lids: this.lidAction,
      mouth: this.mouthAction,
      body: this.bodyAction,
      nextGazeMs: Math.max(0, this.nextGazeAt - this.clock),
      nextBlinkMs: Math.max(0, this.nextBlinkAt - this.clock),
      nextMouthMs: Math.max(0, this.nextMouthAt - this.clock),
      nextBodyMs: Math.max(0, this.nextBodyAt - this.clock),
    };
  }
}

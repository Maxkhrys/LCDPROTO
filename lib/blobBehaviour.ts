import {
  BlobMind,
  type BlobDestination,
  type BlobIntention,
  type MindStory,
} from "./blobMind";
import { FACE_STYLE } from "./blobRig";

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
  | "SPIN_360"
  | "WALL_IMPACT_LEFT"
  | "WALL_IMPACT_RIGHT"
  | "HAPPY_BOUNCE"
  | "SHOCKED_RECOIL"
  | "CONFUSED_TILT"
  | "SLEEPY_MELT"
  | "LAUGH_SQUISH"
  | "PLAYFUL_WINK"
  | "PANIC_SHAKE"
  | "PROUD_STRETCH"
  | "ANGRY_BROWS"
  | "SOFT_SQUINT"
  | "ONE_EYE_SQUINT_LEFT"
  | "ONE_EYE_SQUINT_RIGHT"
  | "CURIOUS_WIDE"
  | "HAPPY_EYES"
  | "EXCITED_EYES"
  | "ANGRY_EYES"
  | "SHY_EYES"
  | "SLEEPY_EYES"
  | "SAD_EYES"
  | "CONFUSED_EYES"
  | "LOVE_EYES"
  | "PANIC_EYES"
  | "DEADPAN_EYES"
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
  | "IDLE_SETTLE"
  | "CREEP_IN_LEFT"
  | "CREEP_IN_RIGHT"
  | "POP_OUT_IN"
  | "VANISH_REAPPEAR"
  | "CASUAL_SQUINT"
  | "LAZY_LOOK"
  | "SOFT_SIGH"
  | "JOY_HOP"
  | "EXCITED_WIGGLE"
  | "CURIOUS_DOUBLE_TAKE"
  | "SHY_PEEK"
  | "EMBARRASSED_BLUSH"
  | "SLEEPY_YAWN"
  | "DEADPAN_SIDE_EYE"
  | "ANGRY_FLARE"
  | "DIZZY_WOBBLE"
  | "LOVE_SPARKLE"
  | "SURPRISE_POP"
  | "TEARY_POUT";

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
/** Glance directions used by the free look-around scheduler. */
const IDLE_GAZES: readonly GazeBehaviour[] = [
  "GLANCE_LEFT",
  "LOOK_UP",
  "GLANCE_RIGHT",
  "LOOK_DOWN",
  "CURIOUS_TILT_LEFT",
  "CURIOUS_TILT_RIGHT",
];

type ExpressionBehaviour =
  | "SOFT_SQUINT"
  | "ONE_EYE_SQUINT_LEFT"
  | "ONE_EYE_SQUINT_RIGHT"
  | "CURIOUS_WIDE"
  | "ANGRY_BROWS"
  | "HAPPY_EYES"
  | "EXCITED_EYES"
  | "ANGRY_EYES"
  | "SHY_EYES"
  | "SLEEPY_EYES"
  | "SAD_EYES"
  | "CONFUSED_EYES"
  | "LOVE_EYES"
  | "PANIC_EYES"
  | "DEADPAN_EYES";
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

type SpecialBehaviour =
  | "CREEP_IN_LEFT"
  | "CREEP_IN_RIGHT"
  | "POP_OUT_IN"
  | "VANISH_REAPPEAR";

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
  /** Temporary whole-Blob scale and opacity for entrance/exit beats. */
  blobScale: number;
  blobOpacity: number;
  /** Procedural face style and anime mark strength. */
  faceStyle: number;
  faceAccent: number;
  /** Normalised distance from the panel: positive is closer to the viewer. */
  blobDepth: number;
  /** Yaw and pitch are presentation-space degrees for the simple 3D turn. */
  blobYaw: number;
  blobPitch: number;
  blobRotation: number;
  blobSpin: number;
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
  leftPupilX: number;
  leftPupilY: number;
  rightPupilX: number;
  rightPupilY: number;
  pupilScale: number;
  leftLidBias: number;
  rightLidBias: number;
  leftEyeStyle: number;
  rightEyeStyle: number;
  leftBrowRotation: number;
  rightBrowRotation: number;
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
  blobScale: 0,
  blobOpacity: 1,
  faceStyle: FACE_STYLE.CONTENT,
  faceAccent: 0,
  blobDepth: 0,
  blobYaw: 0,
  blobPitch: 0,
  blobRotation: 0,
  blobSpin: 0,
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
  leftPupilX: 0,
  leftPupilY: 0,
  rightPupilX: 0,
  rightPupilY: 0,
  pupilScale: 1,
  leftLidBias: 0,
  rightLidBias: 0,
  leftEyeStyle: -1,
  rightEyeStyle: -1,
  leftBrowRotation: 0,
  rightBrowRotation: 0,
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
const mix = (from: number, to: number, amount: number) =>
  from + (to - from) * clamp01(amount);
const preserveAreaX = (scaleYDelta: number) => 1 / (1 + scaleYDelta) - 1;
// Intentional exit point: once the Blob has faded, move its tiny remnant
// beyond the 233px circular glass so the vanish is spatial, not just opacity.
const VANISH_EDGE = 248;

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

const MOOD_FACE: Record<
  HomeMood,
  { style: number; accent: number; pupilScale: number }
> = {
  CONTENT: { style: FACE_STYLE.CONTENT, accent: 0.08, pupilScale: 0.96 },
  CURIOUS: { style: FACE_STYLE.SURPRISED, accent: 0.22, pupilScale: 1.08 },
  SLEEPY: { style: FACE_STYLE.SLEEPY, accent: 0.12, pupilScale: 0.78 },
  AMUSED: { style: FACE_STYLE.HAPPY, accent: 0.42, pupilScale: 1.12 },
  DISTRACTED: { style: FACE_STYLE.CONFUSED, accent: 0.28, pupilScale: 0.9 },
  THOUGHTFUL: { style: FACE_STYLE.DEADPAN, accent: 0.16, pupilScale: 0.84 },
};

export interface BehaviourStatus {
  id: BehaviourId;
  phase: number;
  remainingMs: number;
  nextBehaviourMs: number;
  blinkState: "open" | "closing" | "closed" | "opening";
}

export interface HomeActivityStatus extends BehaviourStatus {
  mood: HomeMood;
  intention: BlobIntention;
  story: string;
  destination: BlobDestination;
  depth: number;
  yaw: number;
  pitch: number;
  energy: number;
  curiosity: number;
  memory: string;
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
  faceStyle: number;
  faceAccent: number;
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
  private spinStartedAt = -1;
  private spinRotation = 0;
  private impactAt = 0;
  private impactDirection = 0;
  private specialAction: SpecialBehaviour | null = null;
  private lastIdleGaze: GazeBehaviour | null = null;
  private specialStartedAt = -1;
  private specialEmoteStarted = false;
  private specialScale = 0;
  private specialOpacity = 1;
  private specialDirection = 1;

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
  private readonly leftBrowRotation = new SpringAxis();
  private readonly rightBrowRotation = new SpringAxis();
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

  /** Independent eye life: pupils dart quickly while the sockets lag behind. */
  private readonly leftPupilX = new SpringAxis();
  private readonly leftPupilY = new SpringAxis();
  private readonly rightPupilX = new SpringAxis();
  private readonly rightPupilY = new SpringAxis();
  private readonly pupilScale = new SpringAxis(1);
  private readonly leftLidBias = new SpringAxis();
  private readonly rightLidBias = new SpringAxis();
  private faceStyle: number = FACE_STYLE.CONTENT;
  private leftEyeStyle: number = -1;
  private rightEyeStyle: number = -1;
  private readonly faceAccent = new SpringAxis();

  private massXTarget = 0;
  private massYTarget = 0;
  private massRotationTarget = 0;
  private massScaleYTarget = 0;
  private massSkewXTarget = 0;
  private massSkewYTarget = 0;
  private massOriginXTarget = 0;
  private massOriginYTarget = 0.82;
  private bodyStartedAt = 0;
  private bodyBaseTravelX = 0;
  private bodyBaseTravelY = 0;
  private bodyBaseRotation = 0;
  private bodyBaseScaleY = 0;

  private readonly delta: PoseDelta = { ...NEUTRAL_DELTA };
  private readonly mind = new BlobMind();
  private mindIntentionOverride: BlobIntention | null = null;
  private mindDestinationOverride: BlobDestination | null = null;
  private mindDepthOverride: number | null = null;
  private mindStoryRequestPending = false;
  private currentStory: MindStory | null = null;
  private lastStoryId = "SETTLE_CENTER";
  private lastIntention: BlobIntention = "REST";
  private lastDestination: BlobDestination = "CENTER";
  private storyMoveAt = 0;
  private storyMoveApplied = false;
  private travelXTarget = 0;
  private travelYTarget = 0;
  private travelRotationTarget = 0;
  private travelScaleYTarget = 0;
  private travelDepthTarget = 0;
  private travelYawTarget = 0;
  private travelPitchTarget = 0;

  reset() {
    this.clock = 0;
    this.initialized = false;
    this.autoWasEnabled = true;
    this.rand = mulberry32(0x1a11ee);
    this.mind.reset();
    this.mindIntentionOverride = null;
    this.mindDestinationOverride = null;
    this.mindDepthOverride = null;
    this.mindStoryRequestPending = false;
    this.currentStory = null;
    this.lastStoryId = "SETTLE_CENTER";
    this.lastIntention = "REST";
    this.lastDestination = "CENTER";
    this.storyMoveAt = 0;
    this.storyMoveApplied = false;
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
    this.travelXTarget = 0;
    this.travelYTarget = 0;
    this.travelRotationTarget = 0;
    this.travelScaleYTarget = 0;
    this.travelDepthTarget = 0;
    this.travelYawTarget = 0;
    this.travelPitchTarget = 0;
    this.spinStartedAt = -1;
    this.spinRotation = 0;
    this.impactAt = 0;
    this.impactDirection = 0;
    this.specialAction = null;
    this.lastIdleGaze = null;
    this.specialStartedAt = -1;
    this.specialEmoteStarted = false;
    this.specialScale = 0;
    this.specialOpacity = 1;
    this.specialDirection = 1;
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
    this.leftBrowRotation.reset();
    this.rightBrowRotation.reset();
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
    this.leftPupilX.reset();
    this.leftPupilY.reset();
    this.rightPupilX.reset();
    this.rightPupilY.reset();
    this.pupilScale.reset(1);
    this.leftLidBias.reset();
    this.rightLidBias.reset();
    this.faceStyle = FACE_STYLE.CONTENT;
    this.leftEyeStyle = -1;
    this.rightEyeStyle = -1;
    this.faceAccent.reset();
    this.bodyStartedAt = 0;
    this.bodyBaseTravelX = 0;
    this.bodyBaseTravelY = 0;
    this.bodyBaseRotation = 0;
    this.bodyBaseScaleY = 0;
    this.clearBodyTargets();
    this.applyMoodTargets();
    Object.assign(this.delta, NEUTRAL_DELTA);
  }

  setMood(mood: HomeMood | null) {
    if (!mood) {
      this.nextMoodAt = this.clock + 7000;
      return;
    }
    this.mood = mood;
    this.lastMood = mood;
    this.nextMoodAt = this.clock + 1000000000;
    if (this.expressionReleaseAt === 0) {
      this.applyMoodEyeTargets();
      this.applyMoodFace();
    }
    if (this.mouthReleaseAt === 0) this.applyMoodMouthTargets();
  }

  /** Changes the director's test overrides without restarting the render loop. */
  setMindOverrides(
    intention: BlobIntention | null,
    destination: BlobDestination | null,
    depth: number | null
  ) {
    if (
      intention === this.mindIntentionOverride &&
      destination === this.mindDestinationOverride &&
      depth === this.mindDepthOverride
    ) {
      return;
    }
    this.mindIntentionOverride = intention;
    this.mindDestinationOverride = destination;
    this.mindDepthOverride = depth;
    // A changed test target should be visible on the next tick, but an active
    // manual cue is left to its caller. Auto will choose the new story once.
    if (this.initialized) {
      this.mindStoryRequestPending = true;
      if (!this.manualBeat) {
        this.currentStory = null;
        this.storyMoveAt = 0;
        this.storyMoveApplied = false;
        this.nextBeatAt = this.clock;
      }
    }
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
    this.currentStory = null;
    this.mindStoryRequestPending = false;
    this.lastIntention = "REST";
    this.lastDestination = "CENTER";
    this.storyMoveAt = 0;
    this.storyMoveApplied = false;
    this.travelXTarget = 0;
    this.travelYTarget = 0;
    this.travelRotationTarget = 0;
    this.travelScaleYTarget = 0;
    this.travelDepthTarget = 0;
    this.travelYawTarget = 0;
    this.travelPitchTarget = 0;
    this.spinStartedAt = -1;
    this.spinRotation = 0;
    this.impactAt = 0;
    this.impactDirection = 0;
    this.specialAction = null;
    this.specialStartedAt = -1;
    this.specialEmoteStarted = false;
    this.specialScale = 0;
    this.specialOpacity = 1;
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
    // A click can arrive between React's Auto toggle render and the next
    // animation tick. Keep this direct cue alive through that transition;
    // Auto only controls the seeded playlist, never manual inspection.
    this.manualBeat = true;
    if (id === "SPIN_360") {
      this.startSpin();
      return;
    }
    if (
      id === "CREEP_IN_LEFT" ||
      id === "CREEP_IN_RIGHT" ||
      id === "POP_OUT_IN" ||
      id === "VANISH_REAPPEAR"
    ) {
      this.startSpecial(id, cfg);
      return;
    }
    if (id === "WALL_IMPACT_LEFT" || id === "WALL_IMPACT_RIGHT") {
      this.startWallImpact(id, cfg);
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
      id === "CURIOUS_WIDE" ||
      id === "ANGRY_BROWS" ||
      id === "HAPPY_EYES" ||
      id === "EXCITED_EYES" ||
      id === "ANGRY_EYES" ||
      id === "SHY_EYES" ||
      id === "SLEEPY_EYES" ||
      id === "SAD_EYES" ||
      id === "CONFUSED_EYES" ||
      id === "LOVE_EYES" ||
      id === "PANIC_EYES" ||
      id === "DEADPAN_EYES"
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
      id === "IDLE_SETTLE" ||
      id === "HAPPY_BOUNCE" ||
      id === "SHOCKED_RECOIL" ||
      id === "CONFUSED_TILT" ||
      id === "SLEEPY_MELT" ||
      id === "LAUGH_SQUISH" ||
      id === "PLAYFUL_WINK" ||
      id === "PANIC_SHAKE" ||
      id === "PROUD_STRETCH" ||
      id === "CASUAL_SQUINT" ||
      id === "LAZY_LOOK" ||
      id === "SOFT_SIGH" ||
      id === "JOY_HOP" ||
      id === "EXCITED_WIGGLE" ||
      id === "CURIOUS_DOUBLE_TAKE" ||
      id === "SHY_PEEK" ||
      id === "EMBARRASSED_BLUSH" ||
      id === "SLEEPY_YAWN" ||
      id === "DEADPAN_SIDE_EYE" ||
      id === "ANGRY_FLARE" ||
      id === "DIZZY_WOBBLE" ||
      id === "LOVE_SPARKLE" ||
      id === "SURPRISE_POP" ||
      id === "TEARY_POUT"
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

    this.updateSpecial();
    this.updateStoryTravel();
    this.updateSpin();
    this.updateBodyBeat();
    if (this.impactAt > 0 && this.clock >= this.impactAt) {
      this.impactAt = 0;
      // Impact arrives after the travel. Compress hard, then let the body
      // spring rebound from the wall instead of holding one static squish.
      this.travelXTarget = this.impactDirection * -4.5;
      this.travelRotationTarget = this.impactDirection * -5.2;
      this.massXTarget = this.impactDirection * -3.2;
      this.massRotationTarget = this.impactDirection * -5.4;
      this.travelYTarget = 4.8;
      this.travelScaleYTarget = -0.145;
      this.massYTarget = 3.7;
      this.massScaleYTarget = -0.105;
      this.massSkewYTarget = this.impactDirection * 3.2;
    }

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
      this.applyMoodFace();
    }
    if (this.mouthReleaseAt > 0 && this.clock >= this.mouthReleaseAt) {
      this.mouthReleaseAt = 0;
      this.mouthAction = "MOOD";
      this.applyMoodMouthTargets();
    }
    if (this.bodyReleaseAt > 0 && this.clock >= this.bodyReleaseAt) {
      if (this.bodyAction === "CURIOUS_DOUBLE_TAKE") {
        this.baseGazeX = 0;
        this.baseGazeY = 0;
        this.retargetEyes();
      }
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

    if (this.mindStoryRequestPending && !this.manualBeat) {
      this.mindStoryRequestPending = false;
      this.pickMindStory(cfg);
      // Treat an explicit director selection like a manual preview so it also
      // works while the seeded Auto playlist is switched off.
      this.manualBeat = true;
    }

    // Manual preview cues must continue even when Auto is off. The old gate
    // here made staged expression beats silently freeze halfway through.
    this.runBeatCues(cfg);

    if (autoEnabled) {

      if (this.clock >= this.nextMoodAt) this.pickMood(cfg);
      if (this.clock >= this.nextMicroAt) this.pickMicro(cfg);
      if (
        this.clock >= this.nextBeatAt &&
        this.beatUntil === 0 &&
        this.specialAction === null
      )
        this.pickMindStory(cfg);
      // Between stories Blob still looks around on his own. Without this the
      // eyes only ever moved when a whole thought was scheduled, which read as
      // a stare.
      if (
        this.clock >= this.nextGazeAt &&
        this.gazeReleaseAt === 0 &&
        this.beatUntil === 0 &&
        this.specialAction === null
      )
        this.pickIdleGaze(cfg);
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
    this.currentStory = null;
    this.storyMoveAt = 0;
    this.storyMoveApplied = false;
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
      this.currentStory = null;
      this.storyMoveAt = 0;
      this.storyMoveApplied = false;
    }
  }

  /** Move the whole character only after the face has announced the thought. */
  private updateStoryTravel() {
    const story = this.currentStory;
    if (!story || this.storyMoveApplied || this.clock < this.storyMoveAt) return;
    this.travelXTarget = story.x;
    this.travelYTarget = story.y;
    // A small roll sells weight; yaw is rendered separately as depth.
    this.travelRotationTarget = story.yaw * 0.14;
    this.travelScaleYTarget = 0;
    this.travelDepthTarget = story.depth;
    this.travelYawTarget = story.yaw;
    this.travelPitchTarget = story.pitch;
    this.storyMoveApplied = true;
  }

  /** Choose one intention-led thought and stage its channels as a story. */
  private pickMindStory(cfg: BehaviourConfig) {
    const next = this.mind.choose(
      this.mood,
      this.mindIntentionOverride,
      this.mindDestinationOverride,
      this.mindDepthOverride
    );
    this.currentStory = next;
    this.lastStoryId = next.id;
    this.lastIntention = next.intention;
    this.lastDestination = next.destination;
    this.storyMoveAt = this.clock + next.moveDelayMs;
    this.storyMoveApplied = false;
    this.beatExpressionAt = next.expression
      ? this.clock + next.expressionDelayMs
      : 0;
    this.beatMouthAt = next.mouth ? this.clock + next.mouthDelayMs : 0;
    this.beatBodyAt = next.body ? this.clock + next.bodyDelayMs : 0;
    this.beatExpressionId = next.expression;
    this.beatMouthId = next.mouth;
    this.beatBodyId = next.body;
    this.beatUntil = this.clock + next.durationMs;
    this.manualBeat = false;

    if (next.gaze) this.startGaze(next.gaze, cfg);
    this.activityId = next.primary;
    this.activityStartedAt = this.clock;
    this.activityUntil = this.beatUntil;

    // A quiet tail lets the destination feel chosen rather than constantly
    // re-targeted. The next story will still begin before the screen feels
    // frozen, and a different story is preferred by BlobMind.
    this.nextBeatAt = this.beatUntil + this.interval(520, 1180, cfg);
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
    if (this.expressionReleaseAt === 0) {
      this.applyMoodEyeTargets();
      this.applyMoodFace();
    }
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

  /**
   * A free glance between scheduled thoughts. Directions rotate through the
   * deterministic sequence, never repeating the last one, so Blob covers left,
   * right, up and down instead of favouring one axis.
   */
  private pickIdleGaze(cfg: BehaviourConfig) {
    let next = IDLE_GAZES[Math.floor(this.rand() * IDLE_GAZES.length)];
    if (next === this.lastIdleGaze) {
      next = IDLE_GAZES[(IDLE_GAZES.indexOf(next) + 2) % IDLE_GAZES.length];
    }
    this.lastIdleGaze = next;
    this.startGaze(next, cfg);
    this.nextGazeAt = this.gazeReleaseAt + this.interval(420, 1400, cfg);
  }

  private startGaze(id: BehaviourId, cfg: BehaviourConfig) {
    const amount = clamp(cfg.gazePx, 0, 11);
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
    this.followXTarget = bodyDir * 3;
    this.followRotationTarget = bodyDir * 1.25;
    this.followScaleYTarget = y < -1 ? 0.025 : y > 1 ? -0.022 : -0.012;
    // A gaze shift gets a small confirming blink after the eyes land. The
    // seeded interval still controls ordinary blinks; this only moves the next
    // one earlier when a look has just happened.
    this.nextBlinkAt = Math.min(
      this.nextBlinkAt,
      this.gazeReleaseAt + 70 + this.rand() * 90
    );
    this.mark(id, duration + 650);
  }

  private retargetEyes() {
    const x = this.baseGazeX + this.microX;
    const y = this.baseGazeY + this.microY;
    this.leftX.target = x;
    this.leftY.target = y;
    this.rightX.target = x * 0.965;
    this.rightY.target = y * 0.98;
    this.leftPupilX.target = clamp(x * 0.62, -5.4, 5.4);
    this.leftPupilY.target = clamp(y * 0.5, -4.2, 4.2);
    this.rightPupilX.target = clamp(x * 0.59, -5.2, 5.2);
    this.rightPupilY.target = clamp(y * 0.48, -4, 4);
  }

  private startExpression(id: ExpressionBehaviour) {
    const mood = MOODS[this.mood];
    const moodFace = MOOD_FACE[this.mood];
    let duration = 850;
    let style = moodFace.style;
    let accent = moodFace.accent;
    let pupilScale = moodFace.pupilScale;
    let leftLidBias = 0;
    let rightLidBias = 0;

    // Every expression establishes complete eye targets. Without this reset,
    // a prior one-eye squint or curious tilt leaves stale scale and rotation
    // behind, making later buttons look broken.
    this.leftRotation.target = 0;
    this.rightRotation.target = 0;
    this.leftScaleX.target = mood.eyeScaleX;
    this.rightScaleX.target = mood.eyeScaleX;
    this.leftScaleY.target = mood.eyeScaleY;
    this.rightScaleY.target = mood.eyeScaleY;
    this.leftBrowRotation.target = 0;
    this.rightBrowRotation.target = 0;
    this.leftTension.target = mood.leftTension;
    this.rightTension.target = mood.rightTension;

    if (id === "SOFT_SQUINT") {
      // Squint is a real two-lid closure, not a mild scale change. Both
      // apertures narrow toward a readable centre slit.
      this.leftTension.target = 0.24;
      this.rightTension.target = 0.29;
      this.leftScaleX.target = mood.eyeScaleX + 0.055;
      this.rightScaleX.target = mood.eyeScaleX + 0.045;
      this.leftScaleY.target = mood.eyeScaleY - 0.025;
      this.rightScaleY.target = mood.eyeScaleY - 0.02;
      leftLidBias = -0.08;
      rightLidBias = 0.08;
      duration = 850 + this.rand() * 650;
    } else if (id === "ANGRY_BROWS" || id === "ANGRY_EYES") {
      style = FACE_STYLE.ANGRY;
      accent = 0.95;
      pupilScale = 0.68;
      this.leftTension.target = id === "ANGRY_EYES" ? 0.22 : 0.32;
      this.rightTension.target = id === "ANGRY_EYES" ? 0.25 : 0.35;
      this.leftScaleX.target = mood.eyeScaleX + 0.035;
      this.rightScaleX.target = mood.eyeScaleX + 0.03;
      this.leftScaleY.target = mood.eyeScaleY - 0.015;
      this.rightScaleY.target = mood.eyeScaleY - 0.012;
      // Inner brow corners drop toward Blob's nose. The matching lid bias
      // makes the upper lids join the brow instead of leaving round eyes below.
      this.leftBrowRotation.target = 5.4;
      this.rightBrowRotation.target = -5.4;
      leftLidBias = -0.52;
      rightLidBias = 0.52;
      duration = id === "ANGRY_EYES" ? 1080 : 900 + this.rand() * 520;
    } else if (id === "ONE_EYE_SQUINT_LEFT") {
      style = FACE_STYLE.HAPPY;
      accent = 0.28;
      this.leftTension.target = 0.58;
      this.rightTension.target = mood.rightTension * 0.98;
      this.leftRotation.target = -2.2;
      this.leftBrowRotation.target = -1.6;
      this.leftScaleY.target = mood.eyeScaleY - 0.015;
      duration = 680 + this.rand() * 500;
    } else if (id === "ONE_EYE_SQUINT_RIGHT") {
      style = FACE_STYLE.HAPPY;
      accent = 0.28;
      this.rightTension.target = 0.58;
      this.leftTension.target = mood.leftTension * 0.98;
      this.rightRotation.target = 2.2;
      this.rightBrowRotation.target = 1.6;
      this.rightScaleY.target = mood.eyeScaleY - 0.015;
      duration = 680 + this.rand() * 500;
    } else if (id === "CURIOUS_WIDE") {
      style = FACE_STYLE.SURPRISED;
      accent = 0.26;
      pupilScale = 1.12;
      this.leftTension.target = 1.1;
      this.rightTension.target = 1.12;
      this.leftScaleX.target = mood.eyeScaleX + 0.045;
      this.rightScaleX.target = mood.eyeScaleX + 0.045;
      this.leftScaleY.target = mood.eyeScaleY + 0.12;
      this.rightScaleY.target = mood.eyeScaleY + 0.12;
      duration = 760 + this.rand() * 520;
    } else if (id === "HAPPY_EYES") {
      style = FACE_STYLE.HAPPY;
      accent = 0.56;
      pupilScale = 1.18;
      this.leftTension.target = 1.06;
      this.rightTension.target = 1.08;
      this.leftScaleX.target = mood.eyeScaleX + 0.035;
      this.rightScaleX.target = mood.eyeScaleX + 0.03;
      this.leftScaleY.target = mood.eyeScaleY + 0.055;
      this.rightScaleY.target = mood.eyeScaleY + 0.05;
      duration = 980;
    } else if (id === "EXCITED_EYES") {
      style = FACE_STYLE.EXCITED;
      accent = 0.9;
      pupilScale = 1.32;
      this.leftTension.target = 1.18;
      this.rightTension.target = 1.2;
      this.leftScaleX.target = mood.eyeScaleX + 0.07;
      this.rightScaleX.target = mood.eyeScaleX + 0.065;
      this.leftScaleY.target = mood.eyeScaleY + 0.14;
      this.rightScaleY.target = mood.eyeScaleY + 0.135;
      duration = 920;
    } else if (id === "SHY_EYES") {
      style = FACE_STYLE.SHY;
      accent = 0.82;
      pupilScale = 0.9;
      this.leftTension.target = 0.72;
      this.rightTension.target = 0.76;
      this.leftScaleX.target = mood.eyeScaleX + 0.02;
      this.rightScaleX.target = mood.eyeScaleX + 0.015;
      this.leftScaleY.target = mood.eyeScaleY - 0.02;
      this.rightScaleY.target = mood.eyeScaleY - 0.016;
      leftLidBias = 0.22;
      rightLidBias = -0.18;
      duration = 1200;
    } else if (id === "SLEEPY_EYES") {
      style = FACE_STYLE.SLEEPY;
      accent = 0.22;
      pupilScale = 0.74;
      this.leftTension.target = 0.23;
      this.rightTension.target = 0.27;
      this.leftScaleX.target = mood.eyeScaleX + 0.04;
      this.rightScaleX.target = mood.eyeScaleX + 0.035;
      this.leftScaleY.target = mood.eyeScaleY - 0.055;
      this.rightScaleY.target = mood.eyeScaleY - 0.05;
      leftLidBias = 0.18;
      rightLidBias = 0.14;
      duration = 1350;
    } else if (id === "SAD_EYES") {
      style = FACE_STYLE.SAD;
      accent = 0.76;
      pupilScale = 0.76;
      this.leftTension.target = 0.66;
      this.rightTension.target = 0.7;
      this.leftScaleX.target = mood.eyeScaleX + 0.015;
      this.rightScaleX.target = mood.eyeScaleX + 0.012;
      this.leftScaleY.target = mood.eyeScaleY - 0.03;
      this.rightScaleY.target = mood.eyeScaleY - 0.028;
      this.leftBrowRotation.target = -3.4;
      this.rightBrowRotation.target = 3.4;
      leftLidBias = 0.12;
      rightLidBias = -0.12;
      duration = 1280;
    } else if (id === "CONFUSED_EYES") {
      style = FACE_STYLE.CONFUSED;
      accent = 0.58;
      pupilScale = 0.9;
      this.leftTension.target = 0.88;
      this.rightTension.target = 0.76;
      this.leftRotation.target = -3.2;
      this.rightRotation.target = 2.2;
      this.leftBrowRotation.target = -2.2;
      this.rightBrowRotation.target = 2.6;
      leftLidBias = -0.16;
      rightLidBias = 0.2;
      duration = 1180;
    } else if (id === "LOVE_EYES") {
      style = FACE_STYLE.LOVE;
      accent = 0.95;
      pupilScale = 1.05;
      this.leftTension.target = 1.02;
      this.rightTension.target = 1.04;
      this.leftScaleY.target = mood.eyeScaleY + 0.08;
      this.rightScaleY.target = mood.eyeScaleY + 0.075;
      duration = 1300;
    } else if (id === "PANIC_EYES") {
      style = FACE_STYLE.PANIC;
      accent = 0.92;
      pupilScale = 0.62;
      this.leftTension.target = 1.16;
      this.rightTension.target = 1.18;
      this.leftScaleX.target = mood.eyeScaleX + 0.06;
      this.rightScaleX.target = mood.eyeScaleX + 0.055;
      this.leftScaleY.target = mood.eyeScaleY + 0.16;
      this.rightScaleY.target = mood.eyeScaleY + 0.15;
      duration = 860;
    } else if (id === "DEADPAN_EYES") {
      style = FACE_STYLE.DEADPAN;
      accent = 0.24;
      pupilScale = 0.82;
      this.leftTension.target = 0.58;
      this.rightTension.target = 0.62;
      this.leftScaleY.target = mood.eyeScaleY - 0.025;
      this.rightScaleY.target = mood.eyeScaleY - 0.022;
      duration = 1500;
    }

    this.faceStyle = style;
    this.faceAccent.target = accent;
    this.pupilScale.target = pupilScale;
    this.leftLidBias.target = leftLidBias;
    this.rightLidBias.target = rightLidBias;
    this.leftEyeStyle = style;
    this.rightEyeStyle = style;
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
      | "IDLE_SETTLE"
      | "HAPPY_BOUNCE"
      | "SHOCKED_RECOIL"
      | "CONFUSED_TILT"
      | "SLEEPY_MELT"
      | "LAUGH_SQUISH"
      | "PLAYFUL_WINK"
      | "PANIC_SHAKE"
      | "PROUD_STRETCH"
      | "CASUAL_SQUINT"
      | "LAZY_LOOK"
      | "SOFT_SIGH"
      | "JOY_HOP"
      | "EXCITED_WIGGLE"
      | "CURIOUS_DOUBLE_TAKE"
      | "SHY_PEEK"
      | "EMBARRASSED_BLUSH"
      | "SLEEPY_YAWN"
      | "DEADPAN_SIDE_EYE"
      | "ANGRY_FLARE"
      | "DIZZY_WOBBLE"
      | "LOVE_SPARKLE"
      | "SURPRISE_POP"
      | "TEARY_POUT",
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
        expression = "ANGRY_EYES";
        mouth = "MOUTH_FLIP";
        body = "JELLY_TWIST_RIGHT";
        duration = 1650;
        break;
      case "ANGRY_SQUINT":
        expression = "ANGRY_EYES";
        mouth = "MOUTH_FLIP";
        body = "SIDE_SQUISH_RIGHT";
        duration = 1450;
        break;
      case "ANGRY_TILT":
        gaze = "CURIOUS_TILT_RIGHT";
        expression = "ANGRY_EYES";
        mouth = "MOUTH_FLIP";
        body = "JELLY_TWIST_RIGHT";
        duration = 1750;
        break;
      case "SAD_DOWNCAST":
        gaze = "LOOK_DOWN";
        expression = "SAD_EYES";
        mouth = "MOUTH_FLIP";
        body = "BODY_SETTLE";
        duration = 1900;
        break;
      case "SAD_WOBBLE":
        gaze = "LOOK_DOWN";
        expression = "SAD_EYES";
        mouth = "MOUTH_FLIP";
        body = "SOFT_SWAY_LEFT";
        duration = 1850;
        break;
      case "SAD_SMALL":
        gaze = "LOOK_DOWN";
        expression = "SAD_EYES";
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
      case "HAPPY_BOUNCE":
        expression = "HAPPY_EYES";
        mouth = "MOUTH_RELAX";
        body = "JOY_HOP";
        duration = 1550;
        break;
      case "SHOCKED_RECOIL":
        gaze = "LOOK_UP";
        expression = "CURIOUS_WIDE";
        mouth = "MOUTH_O";
        body = "BODY_SETTLE";
        duration = 1750;
        break;
      case "CONFUSED_TILT":
        gaze = "CURIOUS_TILT_LEFT";
        expression = "CONFUSED_EYES";
        mouth = "MOUTH_TWITCH";
        body = "JELLY_TWIST_LEFT";
        duration = 1700;
        break;
      case "SLEEPY_MELT":
        gaze = "LOOK_DOWN";
        expression = "SLEEPY_EYES";
        mouth = "MOUTH_RELAX";
        body = "SLEEPY_MELT";
        duration = 2100;
        break;
      case "LAUGH_SQUISH":
        expression = "HAPPY_EYES";
        mouth = "MOUTH_TWITCH";
        body = "SIDE_SQUISH_LEFT";
        duration = 1450;
        break;
      case "PLAYFUL_WINK":
        gaze = "GLANCE_RIGHT";
        expression = "ONE_EYE_SQUINT_LEFT";
        mouth = "MOUTH_TWITCH";
        body = "SOFT_SWAY_RIGHT";
        duration = 1500;
        break;
      case "PANIC_SHAKE":
        expression = "PANIC_EYES";
        mouth = "MOUTH_O";
        body = "EXCITED_WIGGLE";
        duration = 1300;
        break;
      case "PROUD_STRETCH":
        expression = "HAPPY_EYES";
        mouth = "MOUTH_RELAX";
        body = "TALL_STRETCH";
        duration = 1800;
        break;
      case "CASUAL_SQUINT":
        expression = "SOFT_SQUINT";
        mouth = "MOUTH_RELAX";
        body = "BODY_SETTLE";
        duration = 1650;
        break;
      case "LAZY_LOOK":
        gaze = "LOOK_DOWN";
        expression = "ONE_EYE_SQUINT_RIGHT";
        mouth = "MOUTH_TWITCH";
        body = "SOFT_SWAY_LEFT";
        duration = 1800;
        break;
      case "SOFT_SIGH":
        gaze = "LOOK_DOWN";
        expression = "SOFT_SQUINT";
        mouth = "MOUTH_RELAX";
        body = "BREATH_STRETCH";
        duration = 2100;
        break;
      case "JOY_HOP":
        expression = "HAPPY_EYES";
        mouth = "MOUTH_RELAX";
        body = "JOY_HOP";
        duration = 1700;
        break;
      case "EXCITED_WIGGLE":
        expression = "EXCITED_EYES";
        mouth = "MOUTH_O";
        body = "EXCITED_WIGGLE";
        duration = 1550;
        break;
      case "CURIOUS_DOUBLE_TAKE":
        expression = "CURIOUS_WIDE";
        mouth = "MOUTH_O";
        body = "CURIOUS_DOUBLE_TAKE";
        duration = 2050;
        break;
      case "SHY_PEEK":
        expression = "SHY_EYES";
        mouth = "MOUTH_TWITCH";
        body = "SHY_PEEK";
        duration = 1850;
        break;
      case "EMBARRASSED_BLUSH":
        expression = "SHY_EYES";
        mouth = "MOUTH_FLIP";
        body = "SHY_PEEK";
        duration = 1700;
        break;
      case "SLEEPY_YAWN":
        gaze = "LOOK_DOWN";
        expression = "SLEEPY_EYES";
        mouth = "MOUTH_O";
        body = "SLEEPY_YAWN";
        duration = 2450;
        break;
      case "DEADPAN_SIDE_EYE":
        gaze = "GLANCE_RIGHT";
        expression = "DEADPAN_EYES";
        mouth = "MOUTH_TWITCH";
        body = "SOFT_SWAY_RIGHT";
        duration = 1750;
        break;
      case "ANGRY_FLARE":
        expression = "ANGRY_EYES";
        mouth = "MOUTH_FLIP";
        body = "ANGRY_FLARE";
        duration = 1550;
        break;
      case "DIZZY_WOBBLE":
        expression = "CONFUSED_EYES";
        mouth = "MOUTH_O";
        body = "DIZZY_WOBBLE";
        duration = 1900;
        break;
      case "LOVE_SPARKLE":
        expression = "LOVE_EYES";
        mouth = "MOUTH_RELAX";
        body = "SOFT_SWAY_RIGHT";
        duration = 2150;
        break;
      case "SURPRISE_POP":
        gaze = "LOOK_UP";
        expression = "EXCITED_EYES";
        mouth = "MOUTH_O";
        body = "SURPRISE_POP";
        duration = 1850;
        break;
      case "TEARY_POUT":
        gaze = "LOOK_DOWN";
        expression = "SAD_EYES";
        mouth = "MOUTH_FLIP";
        body = "TEARY_POUT";
        duration = 2050;
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
    if (id === "SPIN_360") {
      this.startSpin();
      return;
    }
    if (id === "WALL_IMPACT_LEFT" || id === "WALL_IMPACT_RIGHT") {
      this.startWallImpact(id, cfg);
      return;
    }
    const strength = clamp(cfg.squash / 0.032, 0.55, 1.35);
    const storyOwnsTravel = this.currentStory !== null && this.storyMoveApplied;
    let sy = 0;
    let duration = 620;
    let dir = 0;
    const dynamic =
      id === "JOY_HOP" ||
      id === "EXCITED_WIGGLE" ||
      id === "CURIOUS_DOUBLE_TAKE" ||
      id === "SHY_PEEK" ||
      id === "SLEEPY_MELT" ||
      id === "SLEEPY_YAWN" ||
      id === "ANGRY_FLARE" ||
      id === "DIZZY_WOBBLE" ||
      id === "SURPRISE_POP" ||
      id === "TEARY_POUT";
    this.clearBodyTargets();
    if (dynamic) {
      duration =
        id === "JOY_HOP"
          ? 1320
          : id === "EXCITED_WIGGLE"
            ? 1220
            : id === "CURIOUS_DOUBLE_TAKE"
              ? 1480
              : id === "SHY_PEEK"
                ? 1320
                : id === "SLEEPY_MELT"
                  ? 1780
                  : id === "SLEEPY_YAWN"
                    ? 1980
                    : id === "ANGRY_FLARE"
                      ? 1180
                      : id === "DIZZY_WOBBLE"
                        ? 1540
                        : id === "SURPRISE_POP"
                          ? 1260
                          : 1420;
    } else if (id === "BODY_SETTLE") {
      sy = -0.064 * strength;
      if (!storyOwnsTravel) this.travelYTarget = 6.2;
      this.massYTarget = 3.1;
      this.massScaleYTarget = -0.025 * strength;
      this.massOriginYTarget = 0.96;
      duration = 520;
    } else if (id === "TINY_SQUISH") {
      sy = -0.052 * strength;
      if (!storyOwnsTravel) this.travelYTarget = 3.5;
      this.massYTarget = 1.6;
      this.massScaleYTarget = -0.02 * strength;
      this.massOriginYTarget = 0.94;
      duration = 420;
    } else if (id === "SOFT_SWAY_LEFT" || id === "SOFT_SWAY_RIGHT") {
      dir = id === "SOFT_SWAY_LEFT" ? -1 : 1;
      sy = -0.025 * strength;
      if (!storyOwnsTravel) {
        this.travelXTarget = dir * 5.8;
        this.travelRotationTarget = dir * 1.75;
      }
      this.massXTarget = dir * 3.9;
      this.massRotationTarget = dir * 1.45;
      this.massSkewYTarget = dir * 1.8;
      this.massOriginXTarget = -dir * 0.9;
      duration = 760;
    } else if (id === "SIDE_SQUISH_LEFT" || id === "SIDE_SQUISH_RIGHT") {
      dir = id === "SIDE_SQUISH_LEFT" ? -1 : 1;
      const sx = -0.066 * strength;
      sy = 1 / (1 + sx) - 1;
      if (!storyOwnsTravel) {
        this.travelXTarget = dir * 6.6;
        this.travelRotationTarget = dir * 1.05;
      }
      this.massXTarget = dir * 4.8;
      this.massRotationTarget = dir * 1.7;
      this.massSkewYTarget = dir * 2.6;
      this.massOriginXTarget = -dir;
      if (!storyOwnsTravel) this.travelScaleYTarget = sy;
      this.massScaleYTarget = sy * 0.34;
      duration = 570;
    } else if (id === "TALL_STRETCH" || id === "BREATH_STRETCH") {
      sy = (id === "TALL_STRETCH" ? 0.082 : 0.058) * strength;
      if (!storyOwnsTravel) {
        this.travelYTarget = id === "TALL_STRETCH" ? -5 : -2.9;
      }
      this.massYTarget = -2.1;
      this.massScaleYTarget = sy * 0.38;
      this.massOriginYTarget = 0.98;
      duration = id === "TALL_STRETCH" ? 690 : 920;
    } else {
      dir = id === "JELLY_TWIST_LEFT" ? -1 : 1;
      sy = 0.034 * strength;
      if (!storyOwnsTravel) {
        this.travelXTarget = dir * 4.7;
        this.travelRotationTarget = dir * 1.55;
      }
      this.massXTarget = dir * 3.5;
      this.massRotationTarget = dir * 3.2;
      this.massSkewXTarget = -dir * 1.8;
      this.massSkewYTarget = dir * 2.8;
      this.massOriginXTarget = -dir * 0.95;
      duration = 670;
    }
    if (!dynamic && id !== "SIDE_SQUISH_LEFT" && id !== "SIDE_SQUISH_RIGHT") {
      if (!storyOwnsTravel) this.travelScaleYTarget = sy;
    }
    this.bodyAction = id;
    this.bodyStartedAt = this.clock;
    this.bodyBaseTravelX = this.travelXTarget;
    this.bodyBaseTravelY = this.travelYTarget;
    this.bodyBaseRotation = this.travelRotationTarget;
    this.bodyBaseScaleY = this.travelScaleYTarget;
    this.bodyReleaseAt = this.clock + duration;
    this.mark(id, duration + 750);
  }

  /** Short authored body phrases. Each uses the same scalar springs as drag. */
  private updateBodyBeat() {
    const id = this.bodyAction;
    if (this.bodyReleaseAt <= this.clock || this.bodyStartedAt <= 0) return;
    if (
      id !== "JOY_HOP" &&
      id !== "EXCITED_WIGGLE" &&
      id !== "CURIOUS_DOUBLE_TAKE" &&
      id !== "SHY_PEEK" &&
      id !== "SLEEPY_MELT" &&
      id !== "SLEEPY_YAWN" &&
      id !== "ANGRY_FLARE" &&
      id !== "DIZZY_WOBBLE" &&
      id !== "SURPRISE_POP" &&
      id !== "TEARY_POUT"
    ) {
      return;
    }

    const duration =
      id === "JOY_HOP"
        ? 1320
        : id === "EXCITED_WIGGLE"
          ? 1220
          : id === "CURIOUS_DOUBLE_TAKE"
            ? 1480
            : id === "SHY_PEEK"
              ? 1320
              : id === "SLEEPY_MELT"
                ? 1780
                : id === "SLEEPY_YAWN"
                  ? 1980
                  : id === "ANGRY_FLARE"
                    ? 1180
                    : id === "DIZZY_WOBBLE"
                      ? 1540
                      : id === "SURPRISE_POP"
                        ? 1260
                        : 1420;
    const t = clamp01((this.clock - this.bodyStartedAt) / duration);
    const eased = smoothstep(t);
    let offsetX = 0;
    let offsetY = 0;
    let offsetRotation = 0;
    let offsetScaleY = 0;
    let massX = 0;
    let massY = 0;
    let massRotation = 0;
    let massScaleY = 0;
    let skewX = 0;
    let skewY = 0;

    if (id === "JOY_HOP") {
      if (t < 0.16) {
        const p = smoothstep(t / 0.16);
        offsetY = 6 * p;
        offsetScaleY = -0.08 * p;
      } else if (t < 0.43) {
        const p = smoothstep((t - 0.16) / 0.27);
        offsetY = mix(6, -17, p);
        offsetScaleY = mix(-0.08, 0.065, p);
      } else if (t < 0.62) {
        const p = smoothstep((t - 0.43) / 0.19);
        offsetY = mix(-17, -13, p);
        offsetScaleY = mix(0.065, 0.035, p);
      } else if (t < 0.78) {
        const p = smoothstep((t - 0.62) / 0.16);
        offsetY = mix(-13, 7, p);
        offsetScaleY = mix(0.035, -0.115, p);
      } else {
        const p = smoothstep((t - 0.78) / 0.22);
        offsetY = mix(7, 0, p);
        offsetScaleY = mix(-0.115, 0, p);
      }
      massY = offsetY * 0.36;
      massScaleY = offsetScaleY * 0.35;
    } else if (id === "EXCITED_WIGGLE") {
      const envelope = Math.sin(Math.PI * eased);
      const wave = Math.sin(eased * Math.PI * 3.6);
      offsetX = wave * 8.5 * envelope;
      offsetY = -Math.abs(wave) * 3.5 * envelope;
      offsetRotation = wave * 4.4 * envelope;
      offsetScaleY = (Math.abs(wave) * 0.04 - 0.022) * envelope;
      massX = offsetX * 0.7;
      massY = offsetY * 0.7;
      massRotation = offsetRotation * 0.82;
      massScaleY = offsetScaleY * 0.4;
      skewX = -wave * 3.2 * envelope;
    } else if (id === "CURIOUS_DOUBLE_TAKE") {
      if (t < 0.18) {
        const p = smoothstep(t / 0.18);
        offsetX = 3.8 * p;
      } else if (t < 0.38) {
        const p = smoothstep((t - 0.18) / 0.2);
        offsetX = mix(3.8, -5.4, p);
      } else if (t < 0.58) {
        const p = smoothstep((t - 0.38) / 0.2);
        offsetX = mix(-5.4, 4.2, p);
      } else {
        offsetX = mix(4.2, 0, smoothstep((t - 0.58) / 0.42));
      }
      offsetRotation = offsetX * 0.33;
      massX = offsetX * 0.72;
      massRotation = offsetRotation * 0.9;
      skewY = offsetX * 0.42;
      const gazeX =
        t < 0.18
          ? 0
          : t < 0.38
            ? 6.2
            : t < 0.58
              ? -6.4
              : mix(-6.4, 0, smoothstep((t - 0.58) / 0.42));
      const gazeY = t < 0.38 ? -0.8 : t < 0.58 ? -0.1 : 0;
      this.baseGazeX = gazeX;
      this.baseGazeY = gazeY;
      this.retargetEyes();
    } else if (id === "SHY_PEEK") {
      const retreat = Math.sin(Math.PI * eased);
      offsetX = -5.6 * retreat;
      offsetY = 2.7 * retreat;
      offsetRotation = -2.3 * retreat;
      offsetScaleY = -0.038 * retreat;
      massX = offsetX * 0.74;
      massY = offsetY * 0.74;
      massRotation = offsetRotation * 0.8;
      massScaleY = offsetScaleY * 0.4;
    } else if (id === "SLEEPY_MELT") {
      const settle = t < 0.58 ? smoothstep(t / 0.58) : smoothstep((1 - t) / 0.42);
      offsetY = t < 0.58 ? 8 * settle : 8 * settle;
      offsetScaleY = -0.085 * settle;
      offsetRotation = 1.3 * settle;
      massY = offsetY * 0.48;
      massScaleY = offsetScaleY * 0.4;
      massRotation = offsetRotation * 0.7;
    } else if (id === "SLEEPY_YAWN") {
      if (t < 0.2) {
        const p = smoothstep(t / 0.2);
        offsetY = 4 * p;
        offsetScaleY = -0.05 * p;
      } else if (t < 0.48) {
        const p = smoothstep((t - 0.2) / 0.28);
        offsetY = mix(4, -8, p);
        offsetScaleY = mix(-0.05, 0.06, p);
      } else if (t < 0.7) {
        const p = smoothstep((t - 0.48) / 0.22);
        offsetY = mix(-8, 4, p);
        offsetScaleY = mix(0.06, -0.075, p);
      } else {
        const p = smoothstep((t - 0.7) / 0.3);
        offsetY = mix(4, 0, p);
        offsetScaleY = mix(-0.075, 0, p);
      }
      massY = offsetY * 0.4;
      massScaleY = offsetScaleY * 0.34;
    } else if (id === "ANGRY_FLARE") {
      const pulse = Math.sin(Math.PI * eased);
      const shake = Math.sin(eased * Math.PI * 7.2) * pulse;
      offsetX = shake * 3.2;
      offsetY = 2.6 * pulse;
      offsetRotation = shake * 2.8;
      offsetScaleY = -0.075 * pulse;
      massX = offsetX * 0.8;
      massY = offsetY * 0.72;
      massRotation = offsetRotation * 0.82;
      massScaleY = offsetScaleY * 0.38;
      skewY = shake * 2.4;
    } else if (id === "DIZZY_WOBBLE") {
      const envelope = Math.sin(Math.PI * eased);
      const wave = Math.sin(eased * Math.PI * 2.5);
      offsetX = wave * 7.2 * envelope;
      offsetY = Math.abs(wave) * 2.2 * envelope;
      offsetRotation = wave * 6.5 * envelope;
      offsetScaleY = -0.035 * envelope;
      massX = offsetX * 0.7;
      massY = offsetY * 0.78;
      massRotation = offsetRotation * 0.9;
      massScaleY = offsetScaleY * 0.4;
      skewX = -wave * 3.8 * envelope;
    } else if (id === "SURPRISE_POP") {
      if (t < 0.17) {
        const p = smoothstep(t / 0.17);
        offsetY = 5 * p;
        offsetScaleY = -0.07 * p;
      } else if (t < 0.42) {
        const p = smoothstep((t - 0.17) / 0.25);
        offsetY = mix(5, -19, p);
        offsetScaleY = mix(-0.07, 0.09, p);
      } else if (t < 0.62) {
        const p = smoothstep((t - 0.42) / 0.2);
        offsetY = mix(-19, -13, p);
        offsetScaleY = mix(0.09, 0.03, p);
      } else {
        const p = smoothstep((t - 0.62) / 0.38);
        offsetY = mix(-13, 0, p);
        offsetScaleY = mix(0.03, 0, p);
      }
      massY = offsetY * 0.34;
      massScaleY = offsetScaleY * 0.3;
    } else if (id === "TEARY_POUT") {
      const settle = Math.sin(Math.PI * eased);
      offsetY = 3.8 * settle;
      offsetScaleY = -0.048 * settle;
      offsetRotation = -1.2 * settle;
      massY = offsetY * 0.52;
      massScaleY = offsetScaleY * 0.4;
      massRotation = offsetRotation * 0.72;
    }

    this.travelXTarget = this.bodyBaseTravelX + offsetX;
    this.travelYTarget = this.bodyBaseTravelY + offsetY;
    this.travelRotationTarget = this.bodyBaseRotation + offsetRotation;
    this.travelScaleYTarget = this.bodyBaseScaleY + offsetScaleY;
    this.massXTarget = massX;
    this.massYTarget = massY;
    this.massRotationTarget = massRotation;
    this.massScaleYTarget = massScaleY;
    this.massSkewXTarget = skewX;
    this.massSkewYTarget = skewY;
  }

  /**
   * Storybook-style entrances and exits. Targets change in phases so the same
   * spring system can sell weight, peek, and recovery without sprite sequences.
   */
  private startSpecial(id: SpecialBehaviour, cfg: BehaviourConfig) {
    this.clearBeatCues();
    this.clearBodyTargets();
    this.spinStartedAt = -1;
    this.spinRotation = 0;
    this.impactAt = 0;
    this.specialAction = id;
    this.specialDirection = id === "VANISH_REAPPEAR" && this.rand() < 0.5 ? -1 : 1;
    this.specialStartedAt = this.clock;
    this.specialEmoteStarted = false;
    this.specialScale = 0;
    this.specialOpacity = 1;
    this.travelXTarget = 0;
    this.travelYTarget = 0;
    this.travelRotationTarget = 0;
    this.travelDepthTarget = 0;
    this.travelYawTarget = 0;
    this.travelPitchTarget = 0;
    this.travelScaleYTarget = 0;
    this.manualBeat = true;

    const duration = id === "VANISH_REAPPEAR" ? 1900 : id === "POP_OUT_IN" ? 2050 : 2250;
    this.bodyAction = id;
    this.bodyReleaseAt = this.clock + duration;
    this.activityId = id;
    this.activityStartedAt = this.clock;
    this.activityUntil = this.clock + duration;
    this.nextBeatAt = Math.max(this.nextBeatAt, this.clock + duration + 600 * cfg.paceScale);
  }

  private updateSpecial() {
    const id = this.specialAction;
    if (!id || this.specialStartedAt < 0) return;
    const duration = id === "VANISH_REAPPEAR" ? 1900 : id === "POP_OUT_IN" ? 2050 : 2250;
    const t = clamp01((this.clock - this.specialStartedAt) / duration);
    const direction =
      id === "CREEP_IN_LEFT"
        ? -1
        : id === "CREEP_IN_RIGHT"
          ? 1
          : this.specialDirection;

    this.specialScale = 0;
    this.specialOpacity = 1;
    if (id === "CREEP_IN_LEFT" || id === "CREEP_IN_RIGHT") {
      if (t < 0.2) {
        const p = smoothstep(t / 0.2);
        this.travelXTarget = mix(0, direction * 370, p);
        this.travelYawTarget = mix(0, direction * 28, p);
      } else if (t < 0.5) {
        const p = smoothstep((t - 0.2) / 0.3);
        this.travelXTarget = mix(direction * 370, direction * 235, p);
        this.travelYawTarget = mix(direction * 28, direction * 16, p);
        this.travelScaleYTarget = 0.05 * (1 - p);
      } else if (t < 0.76) {
        const p = smoothstep((t - 0.5) / 0.26);
        this.travelXTarget = mix(direction * 235, direction * 150, p);
        this.travelYawTarget = mix(direction * 16, direction * 9, p);
        this.travelScaleYTarget = 0.028 * (1 - p);
      } else {
        const p = smoothstep((t - 0.76) / 0.24);
        this.travelXTarget = mix(direction * 150, 0, p);
        this.travelYawTarget = mix(direction * 9, 0, p);
      }
    } else if (id === "POP_OUT_IN") {
      if (t < 0.22) {
        const p = smoothstep(t / 0.22);
        this.travelYTarget = mix(0, -370, p);
        this.travelPitchTarget = mix(0, -14, p);
      } else if (t < 0.5) {
        const p = smoothstep((t - 0.22) / 0.28);
        this.travelYTarget = mix(-370, -235, p);
        this.travelPitchTarget = mix(-14, -6, p);
        this.travelScaleYTarget = 0.06 * (1 - p);
      } else {
        const p = smoothstep((t - 0.5) / 0.5);
        this.travelYTarget = mix(-235, 0, p);
        this.travelPitchTarget = mix(-6, 0, p);
        this.travelScaleYTarget = 0.03 * (1 - p);
      }
    } else {
      const out = smoothstep(clamp01(t / 0.25));
      const back = smoothstep(clamp01((t - 0.42) / 0.3));
      if (id === "VANISH_REAPPEAR") {
        // Leave through a bounded edge pocket, hold invisibly for one beat,
        // then return from that same side. The old version only changed scale
        // and could leave an off-screen target behind after interruption.
        if (t < 0.16) {
          const p = smoothstep(t / 0.16);
          this.travelXTarget = mix(0, direction * 38, p);
          this.travelYTarget = mix(0, -5, p);
          this.travelRotationTarget = mix(0, direction * 2.5, p);
          this.specialScale = mix(0, -0.1, p);
          this.specialOpacity = 1;
        } else if (t < 0.43) {
          const p = smoothstep((t - 0.16) / 0.27);
          this.travelXTarget = mix(direction * 38, direction * VANISH_EDGE, p);
          this.travelYTarget = mix(-5, -15, p);
          this.travelRotationTarget = mix(direction * 2.5, direction * 8, p);
          this.specialScale = mix(-0.1, -0.94, p);
          this.specialOpacity = mix(1, 0, p);
        } else if (t < 0.59) {
          this.travelXTarget = direction * VANISH_EDGE;
          this.travelYTarget = -15;
          this.travelRotationTarget = direction * 8;
          this.specialScale = -0.94;
          this.specialOpacity = 0;
        } else if (t < 0.87) {
          const p = smoothstep((t - 0.59) / 0.28);
          this.travelXTarget = mix(direction * VANISH_EDGE, 0, p);
          this.travelYTarget = mix(-15, 0, p);
          this.travelRotationTarget = mix(direction * 8, 0, p);
          this.specialScale = mix(-0.94, -0.02, p);
          this.specialOpacity = mix(0, 1, p);
        } else {
          const p = smoothstep((t - 0.87) / 0.13);
          this.travelXTarget = 0;
          this.travelYTarget = mix(0, 0.5, p);
          this.travelRotationTarget = 0;
          this.specialScale = mix(-0.02, 0, p);
          this.specialOpacity = 1;
        }
      } else {
        this.specialScale = mix(0, -0.88, out);
        this.specialOpacity = mix(1, 0, out);
        if (t > 0.42) {
          this.specialScale = mix(-0.88, 0, back);
          this.specialOpacity = mix(0, 1, back);
        }
      }
      if (t > 0.68 && !this.specialEmoteStarted) {
        this.specialEmoteStarted = true;
        this.startExpression("CURIOUS_WIDE");
        this.startMouth("MOUTH_O");
        this.activityId = id;
        this.activityStartedAt = this.specialStartedAt;
        this.activityUntil = this.specialStartedAt + duration;
      }
    }

    if (t >= 1) {
      this.specialAction = null;
      this.specialStartedAt = -1;
      this.specialScale = 0;
      this.specialOpacity = 1;
      this.travelXTarget = 0;
      this.travelYTarget = 0;
      this.travelRotationTarget = 0;
      this.travelDepthTarget = 0;
      this.travelYawTarget = 0;
      this.travelPitchTarget = 0;
      this.manualBeat = false;
      this.bodyAction = "SETTLING";
      this.clearBodyTargets();
      this.bodyReleaseAt = this.clock + 850;
    }
  }

  private clearBodyTargets() {
    // Travel targets are persistent world positions. Only the temporary
    // deformation target resets when a body cue finishes, otherwise Blob would
    // snap back to centre after every little thought.
    this.travelScaleYTarget = 0;
    this.massXTarget = 0;
    this.massYTarget = 0;
    this.massRotationTarget = 0;
    this.massScaleYTarget = 0;
    this.massSkewXTarget = 0;
    this.massSkewYTarget = 0;
    this.massOriginXTarget = 0;
    this.massOriginYTarget = 0.82;
  }

  private startSpin() {
    this.clearBeatCues();
    this.clearBodyTargets();
    this.spinStartedAt = this.clock;
    this.spinRotation = 0;
    this.bodyAction = "SPIN_360";
    this.bodyReleaseAt = this.clock + 2350;
    this.mark("SPIN_360", 2350);
    this.nextBeatAt = Math.max(this.nextBeatAt, this.clock + 2700);
  }

  private startWallImpact(
    id: "WALL_IMPACT_LEFT" | "WALL_IMPACT_RIGHT",
    cfg: BehaviourConfig
  ) {
    this.clearBeatCues();
    this.clearBodyTargets();
    const direction = id === "WALL_IMPACT_LEFT" ? -1 : 1;
    const strength = clamp(cfg.squash / 0.032, 0.8, 1.5);
    this.impactDirection = direction;
    this.impactAt = this.clock + 320;
    this.travelXTarget = direction * 31;
    this.travelRotationTarget = direction * 2.8;
    this.massXTarget = direction * 14.5;
    this.massRotationTarget = direction * 3.8;
    this.massSkewYTarget = direction * 3.2;
    this.massOriginXTarget = -direction;
    this.travelScaleYTarget = 0.025 * strength;
    this.massScaleYTarget = 0.018 * strength;
    this.bodyAction = id;
    this.bodyReleaseAt = this.clock + 1040;
    this.mark(id, 1500);
  }

  private updateSpin() {
    if (this.spinStartedAt < 0) return;
    const elapsed = this.clock - this.spinStartedAt;
    const duration = 1900;
    const t = clamp01(elapsed / duration);
    // One unwrapped turn. At 360 degrees the orientation is identical to
    // neutral, so clearing to zero after completion does not snap visually.
    this.spinRotation = 360 * smoothstep(t);
    const wobbleEnvelope = Math.sin(Math.PI * t);
    const wobble = Math.sin(t * Math.PI * 4.2) * wobbleEnvelope;
    const bob = Math.sin(t * Math.PI * 1.8) * wobbleEnvelope;
      this.travelXTarget = wobble * 6;
    this.travelYTarget = bob * 3;
    this.travelRotationTarget = wobble * 3.4;
    this.travelScaleYTarget = (-0.035 + bob * 0.018) * wobbleEnvelope;
    this.massXTarget = wobble * 6.6;
    this.massYTarget = bob * 3.5;
    this.massRotationTarget = wobble * 5.8;
    this.massScaleYTarget = -0.036 * wobbleEnvelope;
    this.massSkewXTarget = -wobble * 4.8;
    this.massSkewYTarget = wobble * 4.4;
    if (t >= 1) {
      this.spinStartedAt = -1;
      // Keep 360° as the spring's equivalent endpoint. Angle wrapping in
      // BlobJellyPhysics then returns to zero's visual orientation without
      // forcing a second backwards turn.
      this.spinRotation = 360;
      this.bodyAction = "SETTLING";
      this.clearBodyTargets();
      this.bodyReleaseAt = this.clock + 850;
    }
  }

  private startBlink(double: boolean, cfg?: BehaviourConfig) {
    this.blinkStartedAt = this.clock;
    this.blinkDouble = double;
    this.lidAction = double ? "DOUBLE_BLINK" : "NORMAL_BLINK";
    this.mark(double ? "DOUBLE_BLINK" : "NORMAL_BLINK", double ? 665 : 280);
    if (cfg) this.nextBlinkAt = this.clock + this.blinkGap(cfg);
  }

  private updateBlink() {
    if (this.blinkStartedAt < 0) {
      this.blinkLid = 1;
      this.blinkState = "open";
      return;
    }
    const elapsed = this.clock - this.blinkStartedAt;
    // A readable anime blink: 90ms close, 60ms hold, 130ms open.
    const cycle = 280;
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
    const closeMs = 90;
    const holdMs = 60;
    const min = 0.025;
    if (local < closeMs) {
      const t = smoothstep(local / closeMs);
      this.blinkLid = 1 - t * (1 - min);
      this.blinkState = t > 0.9 ? "closed" : "closing";
    } else if (local < closeMs + holdMs) {
      this.blinkLid = min;
      this.blinkState = "closed";
    } else {
      const t = smoothstep(
        (local - closeMs - holdMs) / (cycle - closeMs - holdMs)
      );
      this.blinkLid = min + t * (1 - min);
      this.blinkState = t < 0.08 ? "closed" : "opening";
    }
  }

  private applyMoodTargets() {
    this.applyMoodEyeTargets();
    this.applyMoodMouthTargets();
    this.applyMoodFace();
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
    this.leftBrowRotation.target = 0;
    this.rightBrowRotation.target = 0;
    this.leftLidBias.target = 0;
    this.rightLidBias.target = 0;
    this.leftEyeStyle = -1;
    this.rightEyeStyle = -1;
  }

  private applyMoodFace() {
    const mood = MOOD_FACE[this.mood];
    this.faceStyle = mood.style;
    this.faceAccent.target = mood.accent;
    this.pupilScale.target = mood.pupilScale;
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
      this.leftBrowRotation.step(dt, 5.4, 0.74);
      this.rightBrowRotation.step(dt, 5.4, 0.74);
      this.leftTension.step(dt, 7.8, 0.76);
      this.rightTension.step(dt, 7.2, 0.77);
      this.leftPupilX.step(dt, 13.5, 0.62);
      this.leftPupilY.step(dt, 13.1, 0.64);
      this.rightPupilX.step(dt, 12.9, 0.64);
      this.rightPupilY.step(dt, 12.6, 0.66);
      this.pupilScale.step(dt, 5.2, 0.78);
      this.leftLidBias.step(dt, 6.4, 0.72);
      this.rightLidBias.step(dt, 6.1, 0.74);
      this.faceAccent.step(dt, 5.8, 0.78);
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
      this.travelScaleYTarget + (followActive ? this.followScaleYTarget : 0);
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
      this.travelXTarget + (followActive ? this.followXTarget : 0);
    this.delta.blobY = this.travelYTarget;
    this.delta.blobDepth = this.travelDepthTarget;
    // The manual 360 cue is a full unwrapped yaw around the vertical axis.
    // It must not also become a 2D canvas roll; that was why Blob lay sideways
    // in the old recording.
    this.delta.blobYaw = this.travelYawTarget + this.spinRotation;
    this.delta.blobPitch = this.travelPitchTarget;
    this.delta.blobRotation =
      this.travelRotationTarget +
      (followActive ? this.followRotationTarget : 0);
    this.delta.blobSpin = 0;
    this.delta.blobScale = this.specialScale;
    this.delta.blobOpacity = this.specialOpacity;
    this.delta.faceStyle = this.faceStyle;
    this.delta.faceAccent = clamp(this.faceAccent.value, 0, 1);
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
    this.delta.leftPupilX = this.leftPupilX.value;
    this.delta.leftPupilY = this.leftPupilY.value;
    this.delta.rightPupilX = this.rightPupilX.value;
    this.delta.rightPupilY = this.rightPupilY.value;
    this.delta.pupilScale = clamp(this.pupilScale.value, 0.55, 1.45);
    this.delta.leftLidBias = this.leftLidBias.value;
    this.delta.rightLidBias = this.rightLidBias.value;
    this.delta.leftEyeStyle = this.leftEyeStyle;
    this.delta.rightEyeStyle = this.rightEyeStyle;
    this.delta.leftBrowRotation = this.leftBrowRotation.value;
    this.delta.rightBrowRotation = this.rightBrowRotation.value;
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
      | "intention"
      | "story"
      | "destination"
      | "depth"
      | "yaw"
      | "pitch"
      | "energy"
      | "curiosity"
      | "memory"
      | "gaze"
      | "lids"
      | "mouth"
      | "body"
      | "nextGazeMs"
      | "nextBlinkMs"
      | "nextMouthMs"
      | "nextBodyMs"
      | "faceStyle"
      | "faceAccent"
    > {
    const active = this.clock < this.activityUntil;
    const mindState = this.mind.state();
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
      intention: this.currentStory?.intention ?? this.lastIntention,
      story: this.currentStory?.id ?? this.lastStoryId,
      destination: this.currentStory?.destination ?? this.lastDestination,
      depth: this.delta.blobDepth,
      yaw: this.delta.blobYaw,
      pitch: this.delta.blobPitch,
      energy: mindState.energy,
      curiosity: mindState.curiosity,
      memory: mindState.memory,
      nextGazeMs: Math.max(0, this.nextGazeAt - this.clock),
      nextBlinkMs: Math.max(0, this.nextBlinkAt - this.clock),
      nextMouthMs: Math.max(0, this.nextMouthAt - this.clock),
      nextBodyMs: Math.max(0, this.nextBodyAt - this.clock),
      faceStyle: this.delta.faceStyle,
      faceAccent: this.delta.faceAccent,
    };
  }
}

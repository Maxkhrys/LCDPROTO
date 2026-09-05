import type { BlobDestination, BlobIntention } from "../blobMind";
import { FACE_STYLE } from "../blobRig";

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

export type GazeBehaviour =
  | "GLANCE_LEFT"
  | "GLANCE_RIGHT"
  | "LOOK_UP"
  | "LOOK_DOWN"
  | "CURIOUS_TILT_LEFT"
  | "CURIOUS_TILT_RIGHT";

/** Glance directions used by the free look-around scheduler. */
export const IDLE_GAZES: readonly GazeBehaviour[] = [
  "GLANCE_LEFT",
  "LOOK_UP",
  "GLANCE_RIGHT",
  "LOOK_DOWN",
  "CURIOUS_TILT_LEFT",
  "CURIOUS_TILT_RIGHT",
];

export type ExpressionBehaviour =
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

export type MouthBehaviour =
  | "MOUTH_RELAX"
  | "MOUTH_TWITCH"
  | "MOUTH_O"
  | "MOUTH_FLIP";

export type BodyBehaviour = Exclude<
  BehaviourId,
  | "REST"
  | "NORMAL_BLINK"
  | "DOUBLE_BLINK"
  | GazeBehaviour
  | ExpressionBehaviour
  | MouthBehaviour
>;

export type SpecialBehaviour =
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
  /** Procedural face style retained for expression scheduling. */
  faceStyle: number;
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
  mouthD: number;
  mouthCrescent: number;
}

export const NEUTRAL_DELTA: PoseDelta = {
  blobX: 0,
  blobY: 0,
  blobScale: 0,
  blobOpacity: 1,
  faceStyle: FACE_STYLE.CONTENT,
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
  mouthD: 0,
  mouthCrescent: 0,
};

export const MOOD_LIST: readonly HomeMood[] = [
  "CONTENT",
  "CURIOUS",
  "SLEEPY",
  "AMUSED",
  "DISTRACTED",
  "THOUGHTFUL",
];

export const MOOD_FACE: Record<
  HomeMood,
  { style: number; pupilScale: number }
> = {
  CONTENT: { style: FACE_STYLE.CONTENT, pupilScale: 0.96 },
  CURIOUS: { style: FACE_STYLE.SURPRISED, pupilScale: 1.08 },
  SLEEPY: { style: FACE_STYLE.SLEEPY, pupilScale: 0.78 },
  AMUSED: { style: FACE_STYLE.HAPPY, pupilScale: 1.12 },
  DISTRACTED: { style: FACE_STYLE.CONFUSED, pupilScale: 0.9 },
  THOUGHTFUL: { style: FACE_STYLE.DEADPAN, pupilScale: 0.84 },
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
}

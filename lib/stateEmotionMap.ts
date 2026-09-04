import type { DeviceState } from "./deviceStates";

export interface StateEmotionConfig {
  stateId: DeviceState;
  label: string;
  expressionId: string;
  performanceId: string;
  description: string;
  /** Normalized intimacy/engagement level: 0 (remote/idle) to 1.0 (fully synchronized/connected) */
  intimacyLevel: number;
  /** Body lean factor (-1 to +1) indicating physical approach posture */
  bodyLean: number;
  /** Depth bias (-1 to +1): positive is closer to the glass */
  depthBias: number;
  /** Pupil dilation multiplier (0.8 to 1.4) reflecting emotional arousal */
  pupilDilation: number;
}

/**
 * Declarative interaction state emotion and performance mapping.
 * Connects high-level hardware proximity states to character moments.
 */
export const STATE_EMOTION_MAP: Record<DeviceState, StateEmotionConfig> = {
  HOME: {
    stateId: "HOME",
    label: "Home / Autonomous",
    expressionId: "NEUTRAL",
    performanceId: "JOY_HOP",
    description: "Living naturally in its environment, self-contained autonomy with ambient curiosity.",
    intimacyLevel: 0.1,
    bodyLean: 0,
    depthBias: 0,
    pupilDilation: 1.0,
  },
  SENSED: {
    stateId: "SENSED",
    label: "Sensed / Peripheral Notice",
    expressionId: "CURIOUS",
    performanceId: "CURIOUS_DOUBLE_TAKE",
    description: "First notice of human presence at periphery. Alert double-take and focal lock.",
    intimacyLevel: 0.3,
    bodyLean: 2,
    depthBias: 0.1,
    pupilDilation: 1.15,
  },
  APPROACHING: {
    stateId: "APPROACHING",
    label: "Approaching / Tracking",
    expressionId: "CURIOUS",
    performanceId: "CURIOUS_DOUBLE_TAKE",
    description: "Human is stepping closer. Eyes widen, head pitches forward, following motion.",
    intimacyLevel: 0.5,
    bodyLean: 5,
    depthBias: 0.25,
    pupilDilation: 1.2,
  },
  VERY_CLOSE: {
    stateId: "VERY_CLOSE",
    label: "Very Close / Anticipation",
    expressionId: "EXCITED",
    performanceId: "EXCITED_WIGGLE",
    description: "Human is right at the glass. High emotional arousal and joyful anticipation.",
    intimacyLevel: 0.75,
    bodyLean: 8,
    depthBias: 0.45,
    pupilDilation: 1.3,
  },
  TOGETHER: {
    stateId: "TOGETHER",
    label: "Together / Shared Presence",
    expressionId: "HAPPY",
    performanceId: "LAUGH_SQUISH",
    description: "Both are settled together. Warm, content squishes and cozy soft smiles.",
    intimacyLevel: 0.85,
    bodyLean: 4,
    depthBias: 0.3,
    pupilDilation: 1.1,
  },
  SYNC: {
    stateId: "SYNC",
    label: "Sync / Co-Regulation",
    expressionId: "HAPPY",
    performanceId: "JOY_HOP",
    description: "Harmonic breathing and movement synchronization with the companion.",
    intimacyLevel: 0.92,
    bodyLean: 0,
    depthBias: 0.35,
    pupilDilation: 1.15,
  },
  CONNECTED: {
    stateId: "CONNECTED",
    label: "Connected / Deep Bond",
    expressionId: "HAPPY",
    performanceId: "LAUGH_SQUISH",
    description: "Unbroken emotional link. Radiant expressions, relaxed body posture, affectionate micro-glances.",
    intimacyLevel: 0.98,
    bodyLean: 3,
    depthBias: 0.4,
    pupilDilation: 1.25,
  },
  RECOGNIZED: {
    stateId: "RECOGNIZED",
    label: "Recognized / Familiar Greeting",
    expressionId: "SURPRISED",
    performanceId: "SURPRISE_POP",
    description: "Instantaneous recognition spark! Surprised pop of joy upon confirming known companion.",
    intimacyLevel: 0.9,
    bodyLean: 6,
    depthBias: 0.5,
    pupilDilation: 1.35,
  },
};

export function getStateEmotionConfig(state: DeviceState): StateEmotionConfig {
  return STATE_EMOTION_MAP[state] ?? STATE_EMOTION_MAP.HOME;
}

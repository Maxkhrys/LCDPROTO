/**
 * Procedural Blob Body - Damped Spring & Jelly Physics
 *
 * Simulates restrained, soft-body jelly motion:
 * - Second-order damped spring per deformation channel
 * - Slight overshoot with natural settle
 * - No wild rubbery bouncing
 * - Presets for squash, stretch, lean, wobble, and land/settle
 */

import { type DeformationParams, DEFAULT_DEFORMATION } from "./blobShape";

export type PresetName =
  | "NEUTRAL"
  | "SQUASH"
  | "STRETCH"
  | "LEAN LEFT"
  | "LEAN RIGHT"
  | "SOFT WOBBLE"
  | "LAND / SETTLE";

export interface SpringChannel {
  current: number;
  target: number;
  velocity: number;
  stiffness: number; // spring constant k (default ~160)
  damping: number; // damping coefficient (default ~16)
}

export type SpringState = {
  [K in keyof DeformationParams]: SpringChannel;
};

export const DEFAULT_SPRING_CONFIG = {
  stiffness: 160,
  damping: 15,
};

export function createSpringState(
  initial: DeformationParams = DEFAULT_DEFORMATION
): SpringState {
  const state: Partial<SpringState> = {};
  const keys = Object.keys(DEFAULT_DEFORMATION) as (keyof DeformationParams)[];

  for (const key of keys) {
    state[key] = {
      current: initial[key],
      target: initial[key],
      velocity: 0,
      stiffness: DEFAULT_SPRING_CONFIG.stiffness,
      damping: DEFAULT_SPRING_CONFIG.damping,
    };
  }

  // Slightly customize stiffness / damping for certain channels
  if (state.wobbleAmount) {
    state.wobbleAmount.stiffness = 90;
    state.wobbleAmount.damping = 8;
  }
  if (state.squash) {
    state.squash.stiffness = 180;
    state.squash.damping = 16;
  }
  if (state.lean) {
    state.lean.stiffness = 140;
    state.lean.damping = 13;
  }

  return state as SpringState;
}

/**
 * Steps the physics simulation forward by deltaTime seconds.
 */
export function stepSpringSimulation(
  state: SpringState,
  dt: number
): { params: DeformationParams; isSettled: boolean } {
  // Clamp maximum dt to avoid numerical instability
  const clampedDt = Math.min(dt, 0.05);
  let isSettled = true;

  const currentParams: Partial<DeformationParams> = {};
  const keys = Object.keys(state) as (keyof DeformationParams)[];

  for (const key of keys) {
    const ch = state[key];

    // Special handling for continuous phase
    if (key === "wobblePhase") {
      ch.current += 5.5 * clampedDt;
      currentParams[key] = ch.current;
      continue;
    }

    const displacement = ch.current - ch.target;
    const springForce = -ch.stiffness * displacement;
    const dampingForce = -ch.damping * ch.velocity;
    const acceleration = springForce + dampingForce;

    ch.velocity += acceleration * clampedDt;
    ch.current += ch.velocity * clampedDt;

    // Check settled status
    if (Math.abs(ch.velocity) > 0.001 || Math.abs(displacement) > 0.001) {
      isSettled = false;
    }

    currentParams[key] = ch.current;
  }

  return {
    params: currentParams as DeformationParams,
    isSettled,
  };
}

/**
 * Sets new target values for all deformation channels.
 */
export function setSpringTargets(
  state: SpringState,
  targets: Partial<DeformationParams>
): void {
  const keys = Object.keys(targets) as (keyof DeformationParams)[];
  for (const key of keys) {
    if (state[key]) {
      state[key].target = targets[key] as number;
    }
  }
}

/**
 * Instantly snaps current values and targets to the specified parameters.
 */
export function resetSpringState(
  state: SpringState,
  params: Partial<DeformationParams> = DEFAULT_DEFORMATION
): void {
  const keys = Object.keys(state) as (keyof DeformationParams)[];
  for (const key of keys) {
    const val = params[key] ?? DEFAULT_DEFORMATION[key];
    state[key].current = val;
    state[key].target = val;
    state[key].velocity = 0;
  }
}

/**
 * Preset target parameters for interactive preview buttons.
 */
export const PRESETS: Record<PresetName, Partial<DeformationParams>> = {
  NEUTRAL: {
    scale: 1,
    scaleX: 1,
    scaleY: 1,
    rotation: 0,
    lean: 0,
    topHeight: 0,
    leftBulge: 0,
    rightBulge: 0,
    lowerLeftBulge: 0,
    lowerRightBulge: 0,
    bottomSag: 0,
    squash: 0,
    stretch: 0,
    centerShiftX: 0,
    centerShiftY: 0,
    wobbleAmount: 0,
    highlightShift: 0,
  },
  SQUASH: {
    squash: 0.72,
    stretch: 0,
    lean: 0,
    bottomSag: 8,
    lowerLeftBulge: 14,
    lowerRightBulge: 14,
    topHeight: -12,
    wobbleAmount: 0.15,
  },
  STRETCH: {
    stretch: 0.78,
    squash: 0,
    topHeight: 22,
    lean: 0,
    bottomSag: -6,
    leftBulge: -8,
    rightBulge: -8,
    lowerLeftBulge: -6,
    lowerRightBulge: -6,
    wobbleAmount: 0.12,
  },
  "LEAN LEFT": {
    lean: -24,
    topHeight: -3,
    leftBulge: 9,
    rightBulge: -5,
    lowerLeftBulge: 6,
    squash: 0.12,
    stretch: 0,
    highlightShift: -8,
  },
  "LEAN RIGHT": {
    lean: 24,
    topHeight: -3,
    rightBulge: 9,
    leftBulge: -5,
    lowerRightBulge: 6,
    squash: 0.12,
    stretch: 0,
    highlightShift: 8,
  },
  "SOFT WOBBLE": {
    wobbleAmount: 0.85,
    squash: 0.15,
    stretch: 0,
    lean: 6,
  },
  "LAND / SETTLE": {
    squash: 0.85,
    bottomSag: 14,
    lowerLeftBulge: 18,
    lowerRightBulge: 18,
    topHeight: -16,
    centerShiftY: 8,
    wobbleAmount: 0.45,
  },
};

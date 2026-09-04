/**
 * A small deterministic director for Blob's idle life.
 *
 * The behaviour controller still owns the face and jelly channels. This file
 * only decides what Blob is trying to do next, where he is trying to do it,
 * and which channels belong to the same little thought. Keeping that decision
 * separate stops the idle animation from reading like unrelated random cues.
 */

import type { BehaviourId, HomeMood } from "./blobBehaviour";

export type BlobIntention =
  | "REST"
  | "EXPLORE"
  | "INSPECT"
  | "PLAY"
  | "WATCH"
  | "THINK"
  | "RECOVER";

export type BlobDestination =
  | "CENTER"
  | "UP_LEFT"
  | "UP_RIGHT"
  | "LEFT"
  | "RIGHT"
  | "DOWN_LEFT"
  | "DOWN_RIGHT";

export type BlobStoryId =
  | "SETTLE_CENTER"
  | "CURIOUS_PEEK"
  | "CURIOUS_APPROACH"
  | "SLOW_WANDER"
  | "WATCHFUL_PAUSE"
  | "PLAYFUL_ORBIT"
  | "CHEEKY_GLANCE"
  | "THOUGHTFUL_LOOK"
  | "SLEEPY_DRIFT"
  | "STARTLED_RECOVER";

type StoryGaze =
  | "GLANCE_LEFT"
  | "GLANCE_RIGHT"
  | "LOOK_UP"
  | "LOOK_DOWN"
  | "CURIOUS_TILT_LEFT"
  | "CURIOUS_TILT_RIGHT";
type StoryExpression =
  | "SOFT_SQUINT"
  | "ONE_EYE_SQUINT_LEFT"
  | "ONE_EYE_SQUINT_RIGHT"
  | "CURIOUS_WIDE"
  | "ANGRY_BROWS";
type StoryMouth =
  | "MOUTH_RELAX"
  | "MOUTH_TWITCH"
  | "MOUTH_O"
  | "MOUTH_FLIP";
type StoryBody = Exclude<
  BehaviourId,
  | "REST"
  | "NORMAL_BLINK"
  | "DOUBLE_BLINK"
  | StoryGaze
  | StoryExpression
  | StoryMouth
>;

export interface MindStory {
  id: BlobStoryId;
  intention: BlobIntention;
  destination: BlobDestination;
  x: number;
  y: number;
  depth: number;
  yaw: number;
  pitch: number;
  gaze: StoryGaze | null;
  expression: StoryExpression | null;
  mouth: StoryMouth | null;
  body: StoryBody | null;
  /** Total length of the thought, including its quiet tail. */
  durationMs: number;
  /** Face leads; the body starts travelling after this delay. */
  moveDelayMs: number;
  expressionDelayMs: number;
  mouthDelayMs: number;
  bodyDelayMs: number;
  primary: BehaviourId;
}

export interface BlobMindState {
  energy: number;
  curiosity: number;
  memory: string;
}

export const INTENTIONS: readonly BlobIntention[] = [
  "REST",
  "EXPLORE",
  "INSPECT",
  "PLAY",
  "WATCH",
  "THINK",
  "RECOVER",
] as const;

export const DESTINATIONS: readonly BlobDestination[] = [
  "CENTER",
  "UP_LEFT",
  "UP_RIGHT",
  "LEFT",
  "RIGHT",
  "DOWN_LEFT",
  "DOWN_RIGHT",
] as const;

const DESTINATION_POSES: Record<
  BlobDestination,
  { x: number; y: number; depth: number; yaw: number; pitch: number }
> = {
  CENTER: { x: 0, y: 0, depth: 0, yaw: 0, pitch: 0 },
  UP_LEFT: { x: -50, y: -37, depth: 0.08, yaw: -16, pitch: -4 },
  UP_RIGHT: { x: 50, y: -37, depth: 0.08, yaw: 16, pitch: -4 },
  LEFT: { x: -60, y: 0, depth: 0.14, yaw: -18, pitch: 0 },
  RIGHT: { x: 60, y: 0, depth: 0.14, yaw: 18, pitch: 0 },
  DOWN_LEFT: { x: -45, y: 39, depth: -0.14, yaw: -13, pitch: 4 },
  DOWN_RIGHT: { x: 45, y: 39, depth: -0.14, yaw: 13, pitch: 4 },
};

const story = (
  values: Omit<MindStory, "x" | "y" | "depth" | "yaw" | "pitch"> & {
    destination: BlobDestination;
  }
): MindStory => ({
  ...values,
  ...DESTINATION_POSES[values.destination],
});

const STORIES: Record<BlobStoryId, MindStory> = {
  SETTLE_CENTER: story({
    id: "SETTLE_CENTER",
    intention: "REST",
    destination: "CENTER",
    gaze: null,
    expression: "SOFT_SQUINT",
    mouth: "MOUTH_RELAX",
    body: "BODY_SETTLE",
    durationMs: 3600,
    moveDelayMs: 210,
    expressionDelayMs: 58,
    mouthDelayMs: 104,
    bodyDelayMs: 142,
    primary: "BODY_SETTLE",
  }),
  CURIOUS_PEEK: story({
    id: "CURIOUS_PEEK",
    intention: "INSPECT",
    destination: "UP_RIGHT",
    gaze: "GLANCE_RIGHT",
    expression: "CURIOUS_WIDE",
    mouth: "MOUTH_O",
    body: "SOFT_SWAY_RIGHT",
    durationMs: 4050,
    moveDelayMs: 190,
    expressionDelayMs: 54,
    mouthDelayMs: 102,
    bodyDelayMs: 138,
    primary: "GLANCE_RIGHT",
  }),
  CURIOUS_APPROACH: story({
    id: "CURIOUS_APPROACH",
    intention: "INSPECT",
    destination: "UP_LEFT",
    gaze: "LOOK_UP",
    expression: "CURIOUS_WIDE",
    mouth: "MOUTH_TWITCH",
    body: "TALL_STRETCH",
    durationMs: 4200,
    moveDelayMs: 225,
    expressionDelayMs: 60,
    mouthDelayMs: 112,
    bodyDelayMs: 154,
    primary: "LOOK_UP",
  }),
  SLOW_WANDER: story({
    id: "SLOW_WANDER",
    intention: "EXPLORE",
    destination: "LEFT",
    gaze: "GLANCE_LEFT",
    expression: "SOFT_SQUINT",
    mouth: "MOUTH_RELAX",
    body: "SOFT_SWAY_LEFT",
    durationMs: 4550,
    moveDelayMs: 240,
    expressionDelayMs: 64,
    mouthDelayMs: 118,
    bodyDelayMs: 166,
    primary: "GLANCE_LEFT",
  }),
  WATCHFUL_PAUSE: story({
    id: "WATCHFUL_PAUSE",
    intention: "WATCH",
    destination: "UP_LEFT",
    gaze: "GLANCE_LEFT",
    expression: "SOFT_SQUINT",
    mouth: "MOUTH_RELAX",
    body: "SOFT_SWAY_LEFT",
    durationMs: 4400,
    moveDelayMs: 235,
    expressionDelayMs: 62,
    mouthDelayMs: 116,
    bodyDelayMs: 160,
    primary: "GLANCE_LEFT",
  }),
  PLAYFUL_ORBIT: story({
    id: "PLAYFUL_ORBIT",
    intention: "PLAY",
    destination: "DOWN_LEFT",
    gaze: "CURIOUS_TILT_LEFT",
    expression: "CURIOUS_WIDE",
    mouth: "MOUTH_TWITCH",
    body: "JELLY_TWIST_LEFT",
    durationMs: 3900,
    moveDelayMs: 172,
    expressionDelayMs: 48,
    mouthDelayMs: 96,
    bodyDelayMs: 130,
    primary: "JELLY_TWIST_LEFT",
  }),
  CHEEKY_GLANCE: story({
    id: "CHEEKY_GLANCE",
    intention: "PLAY",
    destination: "RIGHT",
    gaze: "GLANCE_RIGHT",
    expression: "ONE_EYE_SQUINT_LEFT",
    mouth: "MOUTH_TWITCH",
    body: "SIDE_SQUISH_RIGHT",
    durationMs: 3600,
    moveDelayMs: 184,
    expressionDelayMs: 52,
    mouthDelayMs: 98,
    bodyDelayMs: 136,
    primary: "GLANCE_RIGHT",
  }),
  THOUGHTFUL_LOOK: story({
    id: "THOUGHTFUL_LOOK",
    intention: "THINK",
    destination: "DOWN_RIGHT",
    gaze: "LOOK_DOWN",
    expression: "SOFT_SQUINT",
    mouth: "MOUTH_RELAX",
    body: "BODY_SETTLE",
    durationMs: 4750,
    moveDelayMs: 255,
    expressionDelayMs: 70,
    mouthDelayMs: 126,
    bodyDelayMs: 176,
    primary: "LOOK_DOWN",
  }),
  SLEEPY_DRIFT: story({
    id: "SLEEPY_DRIFT",
    intention: "REST",
    destination: "DOWN_LEFT",
    gaze: "LOOK_DOWN",
    expression: "SOFT_SQUINT",
    mouth: "MOUTH_RELAX",
    body: "BREATH_STRETCH",
    durationMs: 5300,
    moveDelayMs: 270,
    expressionDelayMs: 72,
    mouthDelayMs: 132,
    bodyDelayMs: 184,
    primary: "BREATH_STRETCH",
  }),
  STARTLED_RECOVER: story({
    id: "STARTLED_RECOVER",
    intention: "RECOVER",
    destination: "CENTER",
    gaze: "LOOK_UP",
    expression: "CURIOUS_WIDE",
    mouth: "MOUTH_O",
    body: "BODY_SETTLE",
    durationMs: 3200,
    moveDelayMs: 150,
    expressionDelayMs: 42,
    mouthDelayMs: 82,
    bodyDelayMs: 112,
    primary: "SHOCKED_RECOIL",
  }),
};

const MOOD_STORIES: Record<HomeMood, readonly BlobStoryId[]> = {
  CONTENT: ["SLOW_WANDER", "WATCHFUL_PAUSE", "CURIOUS_PEEK", "SETTLE_CENTER", "THOUGHTFUL_LOOK"],
  CURIOUS: ["CURIOUS_PEEK", "CURIOUS_APPROACH", "THOUGHTFUL_LOOK", "SLOW_WANDER"],
  SLEEPY: ["SLEEPY_DRIFT", "SETTLE_CENTER", "THOUGHTFUL_LOOK"],
  AMUSED: ["PLAYFUL_ORBIT", "CHEEKY_GLANCE", "CURIOUS_PEEK", "SLOW_WANDER"],
  DISTRACTED: ["SLOW_WANDER", "WATCHFUL_PAUSE", "THOUGHTFUL_LOOK", "CURIOUS_PEEK", "SETTLE_CENTER"],
  THOUGHTFUL: ["THOUGHTFUL_LOOK", "CURIOUS_APPROACH", "SLEEPY_DRIFT", "SETTLE_CENTER"],
};

const MOOD_BIAS: Record<HomeMood, { energy: number; curiosity: number }> = {
  CONTENT: { energy: 0.58, curiosity: 0.54 },
  CURIOUS: { energy: 0.7, curiosity: 0.86 },
  SLEEPY: { energy: 0.3, curiosity: 0.32 },
  AMUSED: { energy: 0.82, curiosity: 0.72 },
  DISTRACTED: { energy: 0.56, curiosity: 0.68 },
  THOUGHTFUL: { energy: 0.44, curiosity: 0.76 },
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

const clamp = (value: number, min: number, max: number) =>
  value < min ? min : value > max ? max : value;

/** Stateful but deterministic: reset() always returns to the same story path. */
export class BlobMind {
  private rand = mulberry32(0xb10b51);
  private recent: BlobStoryId[] = [];
  private energy = 0.62;
  private curiosity = 0.58;

  reset() {
    this.rand = mulberry32(0xb10b51);
    this.recent = [];
    this.energy = 0.62;
    this.curiosity = 0.58;
  }

  state(): BlobMindState {
    return {
      energy: this.energy,
      curiosity: this.curiosity,
      memory: this.recent.length > 0 ? this.recent.join(" → ") : "new",
    };
  }

  choose(
    mood: HomeMood,
    intentionOverride: BlobIntention | null = null,
    destinationOverride: BlobDestination | null = null,
    depthOverride: number | null = null
  ): MindStory {
    const bias = MOOD_BIAS[mood];
    this.energy = clamp(
      this.energy * 0.82 + bias.energy * 0.18 + (this.rand() - 0.5) * 0.06,
      0.18,
      0.95
    );
    this.curiosity = clamp(
      this.curiosity * 0.78 + bias.curiosity * 0.22 + (this.rand() - 0.5) * 0.07,
      0.18,
      0.96
    );
    const moodStories = MOOD_STORIES[mood];
    let candidates = intentionOverride
      ? moodStories.filter((id) => STORIES[id].intention === intentionOverride)
      : [...moodStories];
    if (candidates.length === 0 && intentionOverride) {
      candidates = Object.keys(STORIES).filter(
        (id): id is BlobStoryId => STORIES[id as BlobStoryId].intention === intentionOverride
      );
    }
    if (candidates.length === 0) candidates = ["SETTLE_CENTER"];

    if (!intentionOverride && this.curiosity > 0.78) {
      const curiousStories = candidates.filter(
        (id) => STORIES[id].intention === "INSPECT" || STORIES[id].intention === "WATCH"
      );
      if (curiousStories.length > 0) candidates = curiousStories;
    }
    if (!intentionOverride && this.energy > 0.78) {
      const livelyStories = candidates.filter(
        (id) => STORIES[id].intention === "PLAY" || STORIES[id].intention === "EXPLORE"
      );
      if (livelyStories.length > 0) candidates = livelyStories;
    }

    const fresh = candidates.filter((id) => !this.recent.includes(id));
    const pool =
      !intentionOverride && this.rand() < 0.035
        ? (["STARTLED_RECOVER"] as BlobStoryId[])
        : fresh.length > 0
          ? fresh
          : candidates;
    const selected = STORIES[pool[Math.floor(this.rand() * pool.length)]];
    this.recent = [...this.recent.slice(-2), selected.id];

    const destination = destinationOverride ?? selected.destination;
    const destinationPose = DESTINATION_POSES[destination];
    return {
      ...selected,
      intention: intentionOverride ?? selected.intention,
      destination,
      x: destinationPose.x,
      y: destinationPose.y,
      depth: clamp(depthOverride ?? destinationPose.depth, -0.2, 0.2),
      yaw: destinationPose.yaw,
      pitch: destinationPose.pitch,
    };
  }
}

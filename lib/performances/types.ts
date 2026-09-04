import type { CharacterBodyPose } from "../characterTypes";

export interface PerformanceBeat {
  /** Timestamp in milliseconds from clip start. */
  atMs: number;
  /** Name of the beat for animator timeline display. */
  label?: string;
  /** Optional facial expression to cue at this beat (e.g. "HAPPY", "SURPRISED"). */
  expressionId?: string;
  /** Target body transform at this keyframe. */
  body?: Partial<CharacterBodyPose>;
  /** Optional transition duration to reach this keyframe. If omitted, interpolates from previous beat. */
  transitionMs?: number;
}

export interface PerformanceClip {
  id: string;
  label: string;
  durationMs: number;
  loop?: boolean;
  /** Recommended expression to pair with this performance by default. */
  defaultExpressionId?: string;
  description?: string;
  beats: readonly PerformanceBeat[];
}

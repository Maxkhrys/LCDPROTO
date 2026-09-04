import type { CharacterBodyPose } from "../characterTypes";
import { DEFAULT_BODY_POSE } from "../characterTypes";
import type { PerformanceClip } from "./types";

/**
 * Cubic smoothstep easing: smooth deceleration and acceleration.
 */
function smoothstep(t: number): number {
  const clamped = Math.max(0, Math.min(1, t));
  return clamped * clamped * (3 - 2 * clamped);
}

/**
 * Pure function: Sample a clip at a given timestamp in milliseconds.
 * Computes smoothly interpolated CharacterBodyPose and identifies the active expression cue.
 */
export function sampleClipAt(
  clip: PerformanceClip,
  timeMs: number
): {
  body: CharacterBodyPose;
  activeExpressionId?: string;
  currentBeatIndex: number;
} {
  const beats = clip.beats;
  if (!beats || beats.length === 0) {
    return {
      body: { ...DEFAULT_BODY_POSE },
      activeExpressionId: clip.defaultExpressionId,
      currentBeatIndex: -1,
    };
  }

  const duration = Math.max(clip.durationMs, beats[beats.length - 1].atMs);
  const clampedTime = Math.max(0, Math.min(duration, timeMs));

  // Find the beat at or immediately before clampedTime
  let prevIdx = 0;
  for (let i = 0; i < beats.length; i++) {
    if (beats[i].atMs <= clampedTime) {
      prevIdx = i;
    } else {
      break;
    }
  }

  // Find the active expression cue (most recent beat at or before clampedTime that defines expressionId)
  let activeExpressionId = clip.defaultExpressionId;
  for (let i = prevIdx; i >= 0; i--) {
    if (beats[i].expressionId) {
      activeExpressionId = beats[i].expressionId;
      break;
    }
  }

  // If at or past the last beat, return its pose
  if (prevIdx >= beats.length - 1) {
    const lastBeat = beats[beats.length - 1];
    return {
      body: {
        ...DEFAULT_BODY_POSE,
        ...(lastBeat.body ?? {}),
      },
      activeExpressionId,
      currentBeatIndex: prevIdx,
    };
  }

  // Interpolate between prevBeat and nextBeat
  const prevBeat = beats[prevIdx];
  const nextBeat = beats[prevIdx + 1];

  const span = nextBeat.atMs - prevBeat.atMs;
  const progress = span > 0 ? (clampedTime - prevBeat.atMs) / span : 1;
  const eased = smoothstep(progress);

  const prevBody = { ...DEFAULT_BODY_POSE, ...(prevBeat.body ?? {}) };
  const nextBody = { ...DEFAULT_BODY_POSE, ...(nextBeat.body ?? {}) };

  const lerp = (a: number, b: number) => a + (b - a) * eased;

  const interpolatedBody: CharacterBodyPose = {
    x: lerp(prevBody.x, nextBody.x),
    y: lerp(prevBody.y, nextBody.y),
    depth: lerp(prevBody.depth, nextBody.depth),
    yaw: lerp(prevBody.yaw, nextBody.yaw),
    pitch: lerp(prevBody.pitch, nextBody.pitch),
    rotation: lerp(prevBody.rotation, nextBody.rotation),
    scaleX: lerp(prevBody.scaleX, nextBody.scaleX),
    scaleY: lerp(prevBody.scaleY, nextBody.scaleY),
    squash: lerp(prevBody.squash, nextBody.squash),
    stretch: lerp(prevBody.stretch, nextBody.stretch),
    lean: lerp(prevBody.lean, nextBody.lean),
    skewX: lerp(prevBody.skewX, nextBody.skewX),
    skewY: lerp(prevBody.skewY, nextBody.skewY),
    opacity: lerp(prevBody.opacity, nextBody.opacity),
  };

  return {
    body: interpolatedBody,
    activeExpressionId,
    currentBeatIndex: prevIdx,
  };
}

export interface PerformanceRunnerOptions {
  onExpressionCue?: (expressionId: string, beatIndex: number) => void;
  onFinished?: () => void;
}

/**
 * Deterministic stateful player for PerformanceClips.
 * Supports play, pause, scrub, speed multiplier, loop, and cue callbacks.
 */
export class PerformanceRunner {
  private clip: PerformanceClip | null = null;
  private currentTimeMs = 0;
  private isPlaying = false;
  private speed = 1.0;
  private isLoop = false;
  private lastTriggeredBeatIdx = -1;

  public onExpressionCue?: (expressionId: string, beatIndex: number) => void;
  public onFinished?: () => void;

  constructor(clip?: PerformanceClip, options?: PerformanceRunnerOptions) {
    if (clip) {
      this.loadClip(clip);
    }
    if (options?.onExpressionCue) {
      this.onExpressionCue = options.onExpressionCue;
    }
    if (options?.onFinished) {
      this.onFinished = options.onFinished;
    }
  }

  public loadClip(clip: PerformanceClip, autoPlay = false) {
    this.clip = clip;
    this.currentTimeMs = 0;
    this.isLoop = clip.loop ?? false;
    this.lastTriggeredBeatIdx = -1;
    this.isPlaying = autoPlay;

    // Check if initial beat (at 0ms) has an expression cue
    if (clip.beats.length > 0 && clip.beats[0].atMs <= 0 && clip.beats[0].expressionId) {
      this.lastTriggeredBeatIdx = 0;
      this.onExpressionCue?.(clip.beats[0].expressionId, 0);
    }
  }

  public play() {
    if (!this.clip) return;
    if (this.currentTimeMs >= this.clip.durationMs) {
      this.currentTimeMs = 0;
      this.lastTriggeredBeatIdx = -1;
    }
    this.isPlaying = true;
  }

  public pause() {
    this.isPlaying = false;
  }

  public replay() {
    this.currentTimeMs = 0;
    this.lastTriggeredBeatIdx = -1;
    this.isPlaying = true;
    if (this.clip && this.clip.beats.length > 0 && this.clip.beats[0].expressionId) {
      this.lastTriggeredBeatIdx = 0;
      this.onExpressionCue?.(this.clip.beats[0].expressionId, 0);
    }
  }

  public seek(timeMs: number) {
    if (!this.clip) return;
    const duration = this.clip.durationMs;
    this.currentTimeMs = Math.max(0, Math.min(duration, timeMs));

    // Update lastTriggeredBeatIdx up to current time without firing callbacks on seek
    this.lastTriggeredBeatIdx = -1;
    for (let i = 0; i < this.clip.beats.length; i++) {
      if (this.clip.beats[i].atMs <= this.currentTimeMs) {
        this.lastTriggeredBeatIdx = i;
      } else {
        break;
      }
    }
  }

  public setSpeed(multiplier: number) {
    this.speed = Math.max(0.1, Math.min(5.0, multiplier));
  }

  public setLoop(loop: boolean) {
    this.isLoop = loop;
  }

  public getPlaybackState() {
    return {
      isPlaying: this.isPlaying,
      currentTimeMs: this.currentTimeMs,
      durationMs: this.clip?.durationMs ?? 0,
      speed: this.speed,
      isLoop: this.isLoop,
      clipId: this.clip?.id ?? null,
    };
  }

  public update(dtMs: number): {
    body: CharacterBodyPose;
    activeExpressionId?: string;
    currentBeatIndex: number;
    finished: boolean;
  } {
    if (!this.clip) {
      return {
        body: { ...DEFAULT_BODY_POSE },
        currentBeatIndex: -1,
        finished: true,
      };
    }

    if (this.isPlaying) {
      const prevTime = this.currentTimeMs;
      this.currentTimeMs += dtMs * this.speed;

      // Check for cue triggers in between prevTime and currentTimeMs
      const beats = this.clip.beats;
      for (let i = 0; i < beats.length; i++) {
        if (beats[i].atMs > prevTime && beats[i].atMs <= this.currentTimeMs) {
          if (beats[i].expressionId && i > this.lastTriggeredBeatIdx) {
            this.lastTriggeredBeatIdx = i;
            this.onExpressionCue?.(beats[i].expressionId!, i);
          }
        }
      }

      // Check completion
      if (this.currentTimeMs >= this.clip.durationMs) {
        if (this.isLoop) {
          this.currentTimeMs = this.currentTimeMs % this.clip.durationMs;
          this.lastTriggeredBeatIdx = -1;
        } else {
          this.currentTimeMs = this.clip.durationMs;
          this.isPlaying = false;
          this.onFinished?.();
        }
      }
    }

    const sample = sampleClipAt(this.clip, this.currentTimeMs);
    return {
      ...sample,
      finished: !this.isPlaying && this.currentTimeMs >= (this.clip?.durationMs ?? 0),
    };
  }
}

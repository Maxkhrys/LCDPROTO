import type { PerformanceClip } from "./types";

/**
 * 8 Core Physical Performances for Blob.
 *
 * Authored according to the golden rule:
 * FACE LEADS -> BODY FOLLOWS -> BODY SETTLES LAST.
 */

export const CORE_PERFORMANCES: readonly PerformanceClip[] = [
  {
    id: "JOY_HOP",
    label: "Joy Hop",
    durationMs: 1100,
    defaultExpressionId: "HAPPY",
    description: "Anticipate downward squash -> explosive buoyant hop -> landing cushion -> elastic recovery",
    beats: [
      { atMs: 0, label: "Face leads happy", expressionId: "HAPPY", body: { y: 0, squash: 0, stretch: 0 } },
      { atMs: 140, label: "Anticipation crouch", body: { y: 12, squash: 0.32, stretch: -0.15, scaleX: 1.08, scaleY: 0.92 } },
      { atMs: 380, label: "Upward hop launch", body: { y: -38, squash: -0.15, stretch: 0.38, scaleX: 0.92, scaleY: 1.12 } },
      { atMs: 600, label: "Apex float", body: { y: -42, squash: 0, stretch: 0.08, scaleX: 0.98, scaleY: 1.02 } },
      { atMs: 760, label: "Landing squash", body: { y: 8, squash: 0.36, stretch: -0.18, scaleX: 1.12, scaleY: 0.88 } },
      { atMs: 940, label: "Rebound lift", body: { y: -6, squash: -0.08, stretch: 0.12, scaleX: 0.96, scaleY: 1.04 } },
      { atMs: 1100, label: "Settle into rest", body: { y: 0, squash: 0, stretch: 0, scaleX: 1.0, scaleY: 1.0 } },
    ],
  },
  {
    id: "LAUGH_SQUISH",
    label: "Laugh Squish",
    durationMs: 950,
    defaultExpressionId: "HAPPY",
    description: "Three rapid rhythmic laughing squishes with buoyant swaying",
    beats: [
      { atMs: 0, label: "Face smile", expressionId: "HAPPY", body: { y: 0, squash: 0 } },
      { atMs: 120, label: "Chuckle 1", body: { y: 5, squash: 0.22, scaleX: 1.06, scaleY: 0.94, lean: -4 } },
      { atMs: 260, label: "Release 1", body: { y: -3, squash: -0.08, scaleX: 0.97, scaleY: 1.03, lean: 2 } },
      { atMs: 400, label: "Chuckle 2", body: { y: 6, squash: 0.26, scaleX: 1.08, scaleY: 0.92, lean: 4 } },
      { atMs: 540, label: "Release 2", body: { y: -3, squash: -0.06, scaleX: 0.98, scaleY: 1.02, lean: -2 } },
      { atMs: 680, label: "Chuckle 3", body: { y: 4, squash: 0.18, scaleX: 1.05, scaleY: 0.95, lean: 1 } },
      { atMs: 950, label: "Settle", body: { y: 0, squash: 0, lean: 0, scaleX: 1.0, scaleY: 1.0 } },
    ],
  },
  {
    id: "EXCITED_WIGGLE",
    label: "Excited Wiggle",
    durationMs: 900,
    defaultExpressionId: "EXCITED",
    description: "High-frequency alternating jelly rotation burst with joy bounce",
    beats: [
      { atMs: 0, label: "Wide eyes cue", expressionId: "EXCITED", body: { rotation: 0, y: 0 } },
      { atMs: 120, label: "Tilt left", body: { rotation: -7, lean: -12, y: -8, stretch: 0.15 } },
      { atMs: 250, label: "Tilt right", body: { rotation: 7, lean: 12, y: -12, stretch: 0.18 } },
      { atMs: 380, label: "Tilt left", body: { rotation: -6, lean: -10, y: -10, stretch: 0.12 } },
      { atMs: 510, label: "Tilt right", body: { rotation: 6, lean: 10, y: -8, stretch: 0.14 } },
      { atMs: 680, label: "Squash drop", body: { rotation: 0, lean: 0, y: 6, squash: 0.24, stretch: 0 } },
      { atMs: 900, label: "Rest return", body: { rotation: 0, lean: 0, y: 0, squash: 0, stretch: 0 } },
    ],
  },
  {
    id: "CURIOUS_DOUBLE_TAKE",
    label: "Curious Double Take",
    durationMs: 1300,
    defaultExpressionId: "CURIOUS",
    description: "Look left -> sudden snap look right -> lean in to inspect closer",
    beats: [
      { atMs: 0, label: "Curious eyes", expressionId: "CURIOUS", body: { x: 0, lean: 0 } },
      { atMs: 220, label: "Casual glance left", body: { x: -14, lean: -8, rotation: -3 } },
      { atMs: 440, label: "Hold beat", body: { x: -16, lean: -9, rotation: -3 } },
      { atMs: 560, label: "Snap right!", expressionId: "SURPRISED", body: { x: 22, lean: 14, rotation: 5, stretch: 0.18 } },
      { atMs: 820, label: "Lean in closer", expressionId: "CURIOUS", body: { x: 28, y: -4, depth: 0.2, lean: 16, rotation: 6, stretch: 0.1 } },
      { atMs: 1050, label: "Pondering hold", body: { x: 18, y: -2, depth: 0.1, lean: 8, rotation: 3 } },
      { atMs: 1300, label: "Float back center", body: { x: 0, y: 0, depth: 0, lean: 0, rotation: 0 } },
    ],
  },
  {
    id: "ANGRY_FLARE",
    label: "Angry Flare",
    durationMs: 1000,
    defaultExpressionId: "ANGRY",
    description: "Tight crouch compression -> sudden rigid flare forward with firm posture",
    beats: [
      { atMs: 0, label: "Brow drops", expressionId: "ANGRY", body: { y: 0, squash: 0 } },
      { atMs: 180, label: "Tense crouch", body: { y: 10, squash: 0.38, stretch: -0.2, scaleX: 1.15, scaleY: 0.85 } },
      { atMs: 400, label: "Stomp flare forward", body: { y: -12, depth: 0.25, squash: -0.15, stretch: 0.25, scaleX: 1.05, scaleY: 1.08, lean: 0 } },
      { atMs: 650, label: "Rigid hold", body: { y: -8, depth: 0.22, squash: 0, stretch: 0.12 } },
      { atMs: 820, label: "Cooling exhale", body: { y: 2, depth: 0.08, squash: 0.12, stretch: 0 } },
      { atMs: 1000, label: "Rest settle", body: { y: 0, depth: 0, squash: 0, stretch: 0 } },
    ],
  },
  {
    id: "SURPRISE_POP",
    label: "Surprise Pop",
    durationMs: 850,
    defaultExpressionId: "SURPRISED",
    description: "Micro-crouch shock -> sudden vertical launch pop -> floaty parachuting recovery",
    beats: [
      { atMs: 0, label: "Eyes snap wide", expressionId: "SURPRISED", body: { y: 0, squash: 0 } },
      { atMs: 80, label: "Micro shock crouch", body: { y: 8, squash: 0.28, stretch: -0.12 } },
      { atMs: 280, label: "Rocket pop up!", body: { y: -52, squash: -0.25, stretch: 0.52, scaleX: 0.85, scaleY: 1.25 } },
      { atMs: 500, label: "Parachute hover", body: { y: -36, squash: 0.15, stretch: -0.05, scaleX: 1.08, scaleY: 0.94 } },
      { atMs: 700, label: "Touchdown sag", body: { y: 6, squash: 0.22, stretch: -0.1 } },
      { atMs: 850, label: "Reset center", body: { y: 0, squash: 0, stretch: 0, scaleX: 1.0, scaleY: 1.0 } },
    ],
  },
  {
    id: "SLEEPY_YAWN",
    label: "Sleepy Yawn",
    durationMs: 1500,
    defaultExpressionId: "SLEEPY",
    description: "Slow deep inhale stretch -> wide yawn -> heavy downward exhalation melt",
    beats: [
      { atMs: 0, label: "Heavy lids", expressionId: "SLEEPY", body: { y: 0, squash: 0 } },
      { atMs: 250, label: "Begin inhale", body: { y: -8, stretch: 0.18, squash: -0.08, scaleX: 0.95, scaleY: 1.08 } },
      { atMs: 650, label: "Peak yawn stretch", body: { y: -22, stretch: 0.38, squash: -0.14, scaleX: 0.9, scaleY: 1.2, lean: -4 } },
      { atMs: 950, label: "Exhale begins", body: { y: -6, stretch: 0.1, squash: 0.05, lean: -2 } },
      { atMs: 1250, label: "Slump to floor", body: { y: 16, squash: 0.42, stretch: -0.22, scaleX: 1.18, scaleY: 0.82, lean: 0 } },
      { atMs: 1500, label: "Resting puddle", body: { y: 10, squash: 0.28, stretch: -0.12, scaleX: 1.1, scaleY: 0.9 } },
    ],
  },
  {
    id: "SAD_SETTLE",
    label: "Sad Settle",
    durationMs: 1200,
    defaultExpressionId: "SAD",
    description: "Melancholic weight shift -> drooping sigh -> slow sinking sag",
    beats: [
      { atMs: 0, label: "Sad eyes", expressionId: "SAD", body: { y: 0, squash: 0, lean: 0 } },
      { atMs: 250, label: "Droop left", body: { y: 4, lean: -8, rotation: -2, squash: 0.12 } },
      { atMs: 550, label: "Slow sigh drop", body: { y: 14, lean: -4, rotation: -1, squash: 0.28, stretch: -0.14 } },
      { atMs: 850, label: "Bottom out", body: { y: 18, lean: 0, rotation: 0, squash: 0.35, stretch: -0.18, scaleX: 1.12, scaleY: 0.88 } },
      { atMs: 1200, label: "Melancholy rest", body: { y: 12, squash: 0.24, stretch: -0.1, scaleX: 1.06, scaleY: 0.94 } },
    ],
  },
] as const;

export const CORE_PERFORMANCE_MAP: Record<string, PerformanceClip> =
  Object.fromEntries(CORE_PERFORMANCES.map((p) => [p.id, p]));

export function getCorePerformance(id: string): PerformanceClip {
  return CORE_PERFORMANCE_MAP[id] ?? CORE_PERFORMANCES[0];
}

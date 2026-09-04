import type { CharacterEyePose, CharacterFacePose, CharacterMouthPose } from "../characterTypes";
import type { ExpressionRecipe, EyeRecipe, MouthRecipe } from "./types";
import { recipeToFacePose } from "./types";
import { CORE_EXPRESSIONS } from "./coreExpressions";

export type BlendEasing = "linear" | "easeOutQuad" | "easeInOutCubic" | "smootherstep";

const clamp = (v: number, min = 0, max = 1) =>
  v < min ? min : v > max ? max : v;

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export function evaluateEasing(t: number, easing: BlendEasing = "easeInOutCubic"): number {
  const c = clamp(t, 0, 1);
  switch (easing) {
    case "linear":
      return c;
    case "easeOutQuad":
      return 1 - (1 - c) * (1 - c);
    case "smootherstep":
      return c * c * c * (c * (c * 6 - 15) + 10);
    case "easeInOutCubic":
    default:
      return c < 0.5 ? 4 * c * c * c : 1 - Math.pow(-2 * c + 2, 3) / 2;
  }
}

export function interpolateEye(
  from: CharacterEyePose,
  to: EyeRecipe,
  t: number
): CharacterEyePose {
  return {
    socketX: lerp(from.socketX, to.socketX, t),
    socketY: lerp(from.socketY, to.socketY, t),
    width: lerp(from.width, to.width, t),
    height: lerp(from.height, to.height, t),
    open: lerp(from.open, to.open, t),
    browLift: lerp(from.browLift, to.browLift, t),
    browTilt: lerp(from.browTilt, to.browTilt, t),
    lidBias: lerp(from.lidBias ?? 0, to.lidBias ?? 0, t),
    pupilX: from.pupilX,
    pupilY: from.pupilY,
    pupilScale: from.pupilScale,
  };
}

export function interpolateMouth(
  from: CharacterMouthPose,
  to: MouthRecipe,
  t: number
): CharacterMouthPose {
  return {
    x: lerp(from.x, to.x, t),
    y: lerp(from.y, to.y, t),
    width: lerp(from.width, to.width, t),
    height: lerp(from.height, to.height, t),
    curve: lerp(from.curve, to.curve, t),
    dAmount: lerp(from.dAmount, to.dAmount, t),
    oAmount: lerp(from.oAmount, to.oAmount, t),
  };
}

export function interpolateFacePose(
  from: CharacterFacePose,
  to: ExpressionRecipe,
  progress: number,
  easing: BlendEasing = "easeInOutCubic"
): CharacterFacePose {
  const t = evaluateEasing(progress, easing);
  return {
    leftEye: interpolateEye(from.leftEye, to.leftEye, t),
    rightEye: interpolateEye(from.rightEye, to.rightEye, t),
    mouth: interpolateMouth(from.mouth, to.mouth, t),
  };
}

/**
 * Stateful expression blender managing smooth, interruptible transitions
 * between facial expressions without ever snapping or resetting to neutral.
 */
export class ExpressionBlender {
  private currentPose: CharacterFacePose;
  private startPose: CharacterFacePose;
  private targetRecipe: ExpressionRecipe;
  private elapsedMs = 0;
  private durationMs = 200;
  private easing: BlendEasing = "easeInOutCubic";
  private blending = false;

  constructor(initialRecipe: ExpressionRecipe = CORE_EXPRESSIONS[0]) {
    this.targetRecipe = initialRecipe;
    this.currentPose = recipeToFacePose(initialRecipe);
    this.startPose = { ...this.currentPose };
  }

  get pose(): CharacterFacePose {
    return this.currentPose;
  }

  get target(): ExpressionRecipe {
    return this.targetRecipe;
  }

  get isBlending(): boolean {
    return this.blending;
  }

  get progress(): number {
    if (!this.blending || this.durationMs <= 0) return 1.0;
    return clamp(this.elapsedMs / this.durationMs, 0, 1);
  }

  /**
   * Interruptibly blend from the CURRENT facial pose to a new target recipe.
   */
  transitionTo(
    target: ExpressionRecipe,
    durationMs?: number,
    easing: BlendEasing = "easeInOutCubic"
  ): void {
    if (this.targetRecipe.id === target.id && !this.blending) return;

    // Snapshot exact instantaneous current pose to transition smoothly from wherever we are
    this.startPose = {
      leftEye: { ...this.currentPose.leftEye },
      rightEye: { ...this.currentPose.rightEye },
      mouth: { ...this.currentPose.mouth },
      blush: this.currentPose.blush,
      style: this.currentPose.style,
    };
    this.targetRecipe = target;
    this.durationMs = durationMs ?? target.defaultTransitionMs ?? 220;
    this.elapsedMs = 0;
    this.easing = easing;
    this.blending = this.durationMs > 0;

    if (!this.blending) {
      this.currentPose = recipeToFacePose(target);
    }
  }

  /**
   * Advance the transition by dt milliseconds.
   */
  update(dtMs: number): CharacterFacePose {
    if (!this.blending) {
      return this.currentPose;
    }

    this.elapsedMs += dtMs;
    const rawProgress = this.elapsedMs / this.durationMs;

    if (rawProgress >= 1.0) {
      this.blending = false;
      this.currentPose = recipeToFacePose(this.targetRecipe);
    } else {
      this.currentPose = interpolateFacePose(
        this.startPose,
        this.targetRecipe,
        rawProgress,
        this.easing
      );
    }

    return this.currentPose;
  }

  /** Instant hard snap to recipe (used in editor resets). */
  snapTo(recipe: ExpressionRecipe): void {
    this.targetRecipe = recipe;
    this.currentPose = recipeToFacePose(recipe);
    this.startPose = { ...this.currentPose };
    this.blending = false;
    this.elapsedMs = 0;
  }
}

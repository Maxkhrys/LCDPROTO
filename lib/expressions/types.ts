import type { BlobRig } from "../blobRig";
import { FACE_STYLE, NEUTRAL_BLOB, NEUTRAL_ELEMENT } from "../blobRig";
import type { FaceCalibration } from "../blobCalibration";
import { DEFAULT_FACE_CALIBRATION } from "../blobCalibration";
import type { CharacterFacePose } from "../characterTypes";

export interface EyeRecipe {
  socketX: number;
  socketY: number;
  width: number;
  height: number;
  open: number;
  browLift: number;
  browTilt: number;
  lidBias?: number;
}

export interface MouthRecipe {
  x: number;
  y: number;
  width: number;
  height: number;
  curve: number;
  dAmount: number;
  oAmount: number;
}

export interface ExpressionRecipe {
  id: string;
  label: string;
  category: "core" | "custom" | "anime" | "state";
  isCustom?: boolean;
  leftEye: EyeRecipe;
  rightEye: EyeRecipe;
  mouth: MouthRecipe;
  /** Optional transition duration hint when entering this expression directly. */
  defaultTransitionMs?: number;
  /** Optional author notes or semantic intent. */
  description?: string;
}

export const DEFAULT_EYE_RECIPE: EyeRecipe = {
  socketX: 0,
  socketY: 0,
  width: 1,
  height: 1,
  open: 1,
  browLift: 0,
  browTilt: 0,
  lidBias: 0,
};

export const DEFAULT_MOUTH_RECIPE: MouthRecipe = {
  x: 0,
  y: 0,
  width: 1,
  height: 1,
  curve: 0.82,
  dAmount: 0,
  oAmount: 0,
};

/** Convert recipe into universal CharacterFacePose */
export function recipeToFacePose(recipe: ExpressionRecipe): CharacterFacePose {
  return {
    leftEye: { ...recipe.leftEye },
    rightEye: { ...recipe.rightEye },
    mouth: { ...recipe.mouth },
  };
}

/** Convert recipe directly into production BlobRig */
export function recipeToBlobRig(
  recipe: ExpressionRecipe,
  cal: FaceCalibration = DEFAULT_FACE_CALIBRATION
): BlobRig {
  const leftC = cal.leftEye;
  const rightC = cal.rightEye;
  const mouthC = cal.mouth;

  const makeEye = (e: EyeRecipe, c: { x: number; y: number; scale: number }) => ({
    ...NEUTRAL_ELEMENT,
    x: e.socketX + c.x,
    y: e.socketY + c.y,
    socketX: e.socketX + c.x,
    socketY: e.socketY + c.y,
    scaleX: e.width * c.scale,
    scaleY: e.height * c.scale,
    eyeSocketScaleX: e.width * c.scale,
    eyeSocketScaleY: e.height * c.scale,
    eyeOpen: e.open,
    browLift: e.browLift,
    browRotation: e.browTilt,
    lidBias: e.lidBias ?? 0,
  });

  return {
    blob: { ...NEUTRAL_BLOB, faceStyle: FACE_STYLE.CONTENT },
    body: { ...NEUTRAL_ELEMENT },
    leftEye: makeEye(recipe.leftEye, leftC),
    rightEye: makeEye(recipe.rightEye, rightC),
    mouth: {
      ...NEUTRAL_ELEMENT,
      x: recipe.mouth.x + mouthC.x,
      y: recipe.mouth.y + mouthC.y,
      scaleX: recipe.mouth.width * mouthC.scale,
      scaleY: recipe.mouth.height * mouthC.scale,
      mouthCurve: recipe.mouth.curve,
      mouthD: recipe.mouth.dAmount,
      mouthO: recipe.mouth.oAmount,
    },
  };
}

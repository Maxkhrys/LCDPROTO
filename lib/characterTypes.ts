/**
 * Universal character interfaces decoupling face pose, body pose, and
 * performance moments.
 *
 * This allows multiple body renderers (e.g. Jelly Blob, Cloud Blob) to share
 * the exact same facial expression vocabulary, emotion blending, and
 * choreography engine without binding to any specific raster or canvas code.
 */

export interface CharacterEyePose {
  socketX: number;
  socketY: number;
  width: number;
  height: number;
  open: number;
  browLift: number;
  browTilt: number;
  lidBias?: number;
  pupilX?: number;
  pupilY?: number;
  pupilScale?: number;
}

export interface CharacterMouthPose {
  x: number;
  y: number;
  width: number;
  height: number;
  curve: number;
  dAmount: number;
  oAmount: number;
  crescentSmileAmount?: number;
}

export interface CharacterFacePose {
  leftEye: CharacterEyePose;
  rightEye: CharacterEyePose;
  mouth: CharacterMouthPose;
  /** Optional whole-face metadata (e.g. style variant or blush warmth 0..1). */
  blush?: number;
  style?: number;
}

export interface CharacterBodyPose {
  x: number;
  y: number;
  depth: number;
  yaw: number;
  pitch: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
  squash: number;
  stretch: number;
  lean: number;
  skewX: number;
  skewY: number;
  opacity: number;
}

export const DEFAULT_BODY_POSE: CharacterBodyPose = {
  x: 0,
  y: 0,
  depth: 0,
  yaw: 0,
  pitch: 0,
  rotation: 0,
  scaleX: 1,
  scaleY: 1,
  squash: 0,
  stretch: 0,
  lean: 0,
  skewX: 0,
  skewY: 0,
  opacity: 1,
};

export const DEFAULT_FACE_POSE: CharacterFacePose = {
  leftEye: {
    socketX: 0,
    socketY: 0,
    width: 1,
    height: 1,
    open: 1,
    browLift: 0,
    browTilt: 0,
  },
  rightEye: {
    socketX: 0,
    socketY: 0,
    width: 1,
    height: 1,
    open: 1,
    browLift: 0,
    browTilt: 0,
  },
  mouth: {
    x: 0,
    y: 0,
    width: 1,
    height: 1,
    curve: 0.82,
    dAmount: 0,
    oAmount: 0,
    crescentSmileAmount: 0,
  },
};

/**
 * A combined character moment: facial expression + physical performance.
 */
export interface CharacterMoment {
  expressionId: string;
  performanceId: string;
  face: CharacterFacePose;
  body: CharacterBodyPose;
}

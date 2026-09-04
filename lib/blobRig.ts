/**
 * Layered Blob character rig.
 *
 * All four layers are extracted from the parts sheet by
 * scripts/extractBlobParts.mjs — see that file for how transparency is
 * recovered. body.png is the permanent body: it is never morphed, regenerated
 * or swapped between states. Expressions come only from transforming layers.
 *
 * Geometry below is measured from the extracted PNGs. Placement is expressed
 * relative to the body's solid width so it holds at any render size.
 */

export interface BlobLayerAsset {
  src: string;
  width: number;
  height: number;
  /** Centre of the artwork's alpha bounds within the file, in source pixels. */
  centerX: number;
  centerY: number;
}

export type BlobColour =
  | "purple"
  | "teal"
  | "yellow"
  | "green"
  | "blue"
  | "red";

export const BLOB_COLOURS: readonly { id: BlobColour; label: string }[] = [
  { id: "purple", label: "Purple" },
  { id: "teal", label: "Teal" },
  { id: "yellow", label: "Yellow" },
  { id: "green", label: "Green" },
  { id: "blue", label: "Blue" },
  { id: "red", label: "Red" },
] as const;

/** The locked body. Carries real alpha; nothing is keyed at runtime. */
export const BODY_LAYER = {
  src: "/blob/rig/body.png",
  width: 606,
  height: 589,
  centerX: 302.5,
  centerY: 294.0,
  /** Opaque-core width, used to size the body against the screen. */
  solidWidth: 598,
} as const;

/** Facial layers, painted after the body in FACE_ORDER. */
export const FACE_LAYERS = {
  leftEye: {
    src: "/blob/rig/eye-left.png",
    width: 281,
    height: 409,
    centerX: 139.5,
    centerY: 204.0,
  },
  rightEye: {
    src: "/blob/rig/eye-right.png",
    width: 285,
    height: 426,
    centerX: 142.5,
    centerY: 212.5,
  },
  mouth: {
    src: "/blob/rig/mouth-home.png",
    width: 440,
    height: 176,
    centerX: 220.0,
    centerY: 88.0,
  },
} as const satisfies Record<string, BlobLayerAsset>;

/** Same authored rig, extracted from colour-specific parts sheets. */
export const RIG_ASSETS = {
  purple: {
    body: BODY_LAYER,
    face: FACE_LAYERS,
  },
  teal: {
    body: {
      src: "/blob/rig/teal/body.png",
      width: 607,
      height: 586,
      centerX: 303,
      centerY: 292.5,
      solidWidth: 599,
    },
    face: {
      leftEye: {
        src: "/blob/rig/teal/eye-left.png",
        width: 278,
        height: 408,
        centerX: 138.5,
        centerY: 203.5,
      },
      rightEye: {
        src: "/blob/rig/teal/eye-right.png",
        width: 283,
        height: 424,
        centerX: 141,
        centerY: 211.5,
      },
      mouth: {
        src: "/blob/rig/teal/mouth-home.png",
        width: 438,
        height: 173,
        centerX: 218.5,
        centerY: 86,
      },
    },
  },
  yellow: {
    body: {
      src: "/blob/rig/yellow/body.png",
      width: 582,
      height: 595,
      centerX: 290.5,
      centerY: 297,
      solidWidth: 574,
    },
    face: {
      leftEye: {
        src: "/blob/rig/yellow/eye-left.png",
        width: 276,
        height: 406,
        centerX: 137.5,
        centerY: 202.5,
      },
      rightEye: {
        src: "/blob/rig/yellow/eye-right.png",
        width: 279,
        height: 424,
        centerX: 139,
        centerY: 211.5,
      },
      mouth: {
        src: "/blob/rig/yellow/mouth-home.png",
        width: 426,
        height: 172,
        centerX: 212.5,
        centerY: 85.5,
      },
    },
  },
  green: {
    body: {
      src: "/blob/rig/green/body.png",
      width: 593,
      height: 591,
      centerX: 296,
      centerY: 295,
      solidWidth: 585,
    },
    face: {
      leftEye: {
        src: "/blob/rig/green/eye-left.png",
        width: 275,
        height: 405,
        centerX: 137,
        centerY: 202,
      },
      rightEye: {
        src: "/blob/rig/green/eye-right.png",
        width: 279,
        height: 421,
        centerX: 139,
        centerY: 210,
      },
      mouth: {
        src: "/blob/rig/green/mouth-home.png",
        width: 429,
        height: 171,
        centerX: 214,
        centerY: 85,
      },
    },
  },
  blue: {
    body: {
      src: "/blob/rig/blue/body.png",
      width: 509,
      height: 504,
      centerX: 254,
      centerY: 251.5,
      solidWidth: 499,
    },
    face: FACE_LAYERS,
  },
  red: {
    body: {
      src: "/blob/rig/red/body.png",
      width: 506,
      height: 504,
      centerX: 252.5,
      centerY: 251.5,
      solidWidth: 496,
    },
    face: FACE_LAYERS,
  },
} as const;

export type FaceLayerId = keyof typeof FACE_LAYERS;

export const FACE_ORDER: readonly FaceLayerId[] = ["leftEye", "rightEye", "mouth"];

/**
 * Share of the 466px screen diameter the body's solid core spans.
 *
 * V3 reduced this from 0.68 so Blob floats inside the display rather than
 * filling it, leaving room for leaning, squash and future state transitions.
 */
export const BODY_FRACTION = 0.535;

/**
 * Neutral face placement, calibrated against the artwork.
 *
 * `dx`/`dy` are offsets from the screen centre as a fraction of the body's
 * solid width. `scale` is relative to the body's own scale — the parts are
 * drawn much larger than life on the sheet, so the face is reduced to sit
 * correctly on the body.
 */
export const FACE_PLACEMENT: Record<
  FaceLayerId,
  { dx: number; dy: number; scale: number }
> = {
  // Slight left/right differences are deliberate: a perfectly mirrored face
  // reads as mechanical, and the two eye assets are not identical either.
  leftEye: { dx: -0.158, dy: -0.038, scale: 0.305 },
  rightEye: { dx: 0.163, dy: -0.034, scale: 0.305 },
  mouth: { dx: 0.003, dy: 0.114, scale: 0.238 },
};

/** Scale applied to the body image so its solid core spans BODY_FRACTION. */
export function bodyScale(screen: number, colour: BlobColour = "purple"): number {
  return (screen * BODY_FRACTION) / RIG_ASSETS[colour].body.solidWidth;
}

/** Neutral geometry of a facial layer in 466-space pixels. */
export function faceAnchor(
  id: FaceLayerId,
  screen: number,
  colour: BlobColour = "purple"
) {
  const layer = RIG_ASSETS[colour].face[id];
  const p = FACE_PLACEMENT[id];
  const bodyW = screen * BODY_FRACTION;
  const s = bodyScale(screen, colour) * p.scale;
  return {
    x: screen / 2 + p.dx * bodyW,
    y: screen / 2 + p.dy * bodyW,
    width: layer.width * s,
    height: layer.height * s,
  };
}

// --- Rig -------------------------------------------------------------------

/** Independent transform available on the body and every facial element. */
export interface ElementTransform {
  /** Offset from the measured neutral position, in 466-space pixels. */
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
  /** Degrees, clockwise, about the element's own centre. */
  rotation: number;
  /** Degrees of affine shear. Used by the body; neutral for face layers. */
  skewX: number;
  skewY: number;
  /** Transform pivot in local space: -1 left/top, +1 right/bottom. */
  originX: number;
  originY: number;
  opacity: number;
  /** Body-space socket position; eye texture can move inside it while looking. */
  socketX: number;
  socketY: number;
  /** Normalised opening and aperture size, used only by eye layers. */
  eyeOpen: number;
  eyeSocketScaleX: number;
  eyeSocketScaleY: number;
  /** Expression-only eyebrow lift; deliberately independent from blink. */
  browLift: number;
  /** Expression-only brow tilt, independent from eye rotation. */
  browRotation: number;
  /** Procedural mouth shape controls. */
  mouthCurve: number;
  mouthO: number;
  /**
   * Contact normal and pressure for the soft-body silhouette warp.
   *
   * Uniform scaleX/scaleY alone reads as "smaller", never as "squashed": a
   * jelly pressed against glass flattens on the contact side and bulges
   * opposite it. These drive that per-slice deformation in BlobCharacter.
   */
  contactX: number;
  contactY: number;
  contactPressure: number;
  /** Body-only surface ripple offsets, in 466-space pixels. */
  rippleTop: number;
  rippleUpper: number;
  rippleLower: number;
  rippleBottom: number;
}

/** Transform applied to the whole character; everything inherits it. */
export interface BlobTransform {
  x: number;
  y: number;
  /** Normalised distance from the LCD plane; positive is closer to camera. */
  depth: number;
  /** Simple presentation-space turn axes, in degrees. */
  yaw: number;
  pitch: number;
  scale: number;
  /** Non-uniform scale on top of `scale`, for jelly squash and stretch. */
  scaleX: number;
  scaleY: number;
  rotation: number;
  opacity: number;
}

export interface BlobRig {
  blob: BlobTransform;
  body: ElementTransform;
  leftEye: ElementTransform;
  rightEye: ElementTransform;
  mouth: ElementTransform;
}

export const NEUTRAL_ELEMENT: ElementTransform = {
  x: 0,
  y: 0,
  scaleX: 1,
  scaleY: 1,
  rotation: 0,
  skewX: 0,
  skewY: 0,
  originX: 0,
  originY: 0,
  opacity: 1,
  socketX: 0,
  socketY: 0,
  eyeOpen: 1,
  eyeSocketScaleX: 1,
  eyeSocketScaleY: 1,
  browLift: 0,
  browRotation: 0,
  mouthCurve: 0,
  mouthO: 0,
  contactX: 0,
  contactY: 0,
  contactPressure: 0,
  rippleTop: 0,
  rippleUpper: 0,
  rippleLower: 0,
  rippleBottom: 0,
};

export const NEUTRAL_BLOB: BlobTransform = {
  x: 0,
  y: 0,
  depth: 0,
  yaw: 0,
  pitch: 0,
  scale: 1,
  scaleX: 1,
  scaleY: 1,
  rotation: 0,
  opacity: 1,
};

/** All-neutral rig — the calibrated HOME pose. */
export const NEUTRAL_RIG: BlobRig = {
  blob: { ...NEUTRAL_BLOB },
  body: { ...NEUTRAL_ELEMENT },
  leftEye: { ...NEUTRAL_ELEMENT },
  rightEye: { ...NEUTRAL_ELEMENT },
  mouth: { ...NEUTRAL_ELEMENT },
};

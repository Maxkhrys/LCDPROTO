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

export type FaceLayerId = keyof typeof FACE_LAYERS;

export const FACE_ORDER: readonly FaceLayerId[] = ["leftEye", "rightEye", "mouth"];

/**
 * Share of the 240px screen diameter the body's solid core spans.
 *
 * V2 reduced this from 0.68 so Blob floats inside the display rather than
 * filling it, leaving room for leaning, squash and future state transitions.
 */
export const BODY_FRACTION = 0.57;

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
export function bodyScale(screen: number): number {
  return (screen * BODY_FRACTION) / BODY_LAYER.solidWidth;
}

/** Neutral geometry of a facial layer in 240-space pixels. */
export function faceAnchor(id: FaceLayerId, screen: number) {
  const layer = FACE_LAYERS[id];
  const p = FACE_PLACEMENT[id];
  const bodyW = screen * BODY_FRACTION;
  const s = bodyScale(screen) * p.scale;
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
  /** Offset from the measured neutral position, in 240-space pixels. */
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
  /** Degrees, clockwise, about the element's own centre. */
  rotation: number;
  opacity: number;
}

/** Transform applied to the whole character; everything inherits it. */
export interface BlobTransform {
  x: number;
  y: number;
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
  opacity: 1,
};

export const NEUTRAL_BLOB: BlobTransform = {
  x: 0,
  y: 0,
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

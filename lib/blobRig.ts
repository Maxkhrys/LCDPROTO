/**
 * Layered Blob character rig.
 *
 * body.png is the permanent, locked body. It is never morphed, regenerated or
 * swapped between states — every expression is produced by transforming the
 * facial layers that sit on top of it.
 *
 * All geometry below was measured, not guessed. The facial PNGs are tight
 * crops lifted pixel-for-pixel out of the original master (home.png): FFT
 * template matching recovered each crop's exact original position, and
 * re-compositing them back onto the master reproduces it with zero differing
 * pixels. Those positions are stored here as fractions of the master body
 * width, so the face lands in its original place at any render size.
 */

/** Master reference: solid-body bounding box of home.png (luminance > 100). */
const MASTER = {
  bodyWidth: 1027,
  centerX: 647.0,
  centerY: 612.0,
} as const;

export interface BlobLayerAsset {
  src: string;
  width: number;
  height: number;
  /**
   * Centre of this crop's rectangle in master-image coordinates. Using the
   * crop rectangle (rather than its alpha bounds) keeps the pivot for scale
   * and rotation deterministic.
   */
  centerX: number;
  centerY: number;
}

/**
 * The locked body. Exported as RGB on black with no alpha channel, so its
 * transparency is keyed from luminance at load time — see BlobCharacter.
 * centerX/centerY here are its own solid-bbox centre, used to sit it on the
 * screen centre.
 */
export const BODY_LAYER = {
  src: "/blob/Blob-body.png",
  width: 1300,
  height: 1210,
  centerX: 661.5,
  centerY: 603.0,
  /** Solid bbox width, used to size the body against the screen. */
  solidWidth: 1074,
} as const;

/** Facial layers, in paint order after the body. */
export const FACE_LAYERS = {
  leftEye: {
    src: "/blob/eye-left.png",
    width: 160,
    height: 220,
    centerX: 410.0,
    centerY: 645.0,
  },
  rightEye: {
    src: "/blob/eye-right.png",
    width: 180,
    height: 220,
    centerX: 735.0,
    centerY: 650.0,
  },
  mouth: {
    src: "/blob/mouth-smile.png",
    width: 125,
    height: 100,
    centerX: 562.5,
    centerY: 750.0,
  },
} as const satisfies Record<string, BlobLayerAsset>;

export type FaceLayerId = keyof typeof FACE_LAYERS;

/** Paint order: body first, then these, in this sequence. */
export const FACE_ORDER: readonly FaceLayerId[] = [
  "leftEye",
  "rightEye",
  "mouth",
];

/** Share of the 240px screen diameter the body spans. */
export const BODY_FRACTION = 0.68;

/** Master pixels -> 240-space pixels. */
export function masterUnit(screen: number): number {
  return (screen * BODY_FRACTION) / MASTER.bodyWidth;
}

/** Neutral position of a facial layer's centre, in 240-space pixels. */
export function faceAnchor(id: FaceLayerId, screen: number) {
  const layer = FACE_LAYERS[id];
  const unit = masterUnit(screen);
  return {
    x: screen / 2 + (layer.centerX - MASTER.centerX) * unit,
    y: screen / 2 + (layer.centerY - MASTER.centerY) * unit,
    width: layer.width * unit,
    height: layer.height * unit,
  };
}

/** Scale applied to the body image so its solid width matches the screen. */
export function bodyScale(screen: number): number {
  return (screen * BODY_FRACTION) / BODY_LAYER.solidWidth;
}

// --- Rig -------------------------------------------------------------------

/** Independent transform available on every facial element. */
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

/** Transform applied to the whole character, body included. */
export interface BlobTransform {
  x: number;
  y: number;
  scale: number;
  rotation: number;
  opacity: number;
}

export interface BlobRig {
  blob: BlobTransform;
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
  rotation: 0,
  opacity: 1,
};

/** All-neutral rig — this is exactly the HOME appearance. */
export const NEUTRAL_RIG: BlobRig = {
  blob: { ...NEUTRAL_BLOB },
  leftEye: { ...NEUTRAL_ELEMENT },
  rightEye: { ...NEUTRAL_ELEMENT },
  mouth: { ...NEUTRAL_ELEMENT },
};

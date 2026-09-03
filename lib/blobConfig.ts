/**
 * Blob character layout, measured directly from the source PNGs.
 *
 * The two frames were authored independently, so their canvases, body scale
 * and silhouettes differ slightly. Rather than eyeballing offsets, both assets
 * are anchored on the same landmark — the midpoint between the eyes, plus the
 * distance between them as a scale reference. Aligning on that lands the eyes
 * within a fraction of a pixel and matches body scale to ~0.2%.
 *
 * Numbers below are the centres of each eye's bounding box in source pixels.
 * Re-measure only if the artwork is regenerated.
 */
export interface BlobAsset {
  src: string;
  /** Natural pixel size of the PNG. */
  width: number;
  height: number;
  /** Centre of the left/right eye bounding box, in source pixels. */
  eyeLeft: readonly [number, number];
  eyeRight: readonly [number, number];
}

export const BLOB_ASSETS = {
  home: {
    src: "/blob/home.png",
    width: 1295,
    height: 1214,
    eyeLeft: [416.0, 661.0],
    eyeRight: [740.5, 668.0],
  },
  reaction: {
    src: "/blob/reaction.png",
    width: 1254,
    height: 1254,
    eyeLeft: [393.5, 632.0],
    eyeRight: [703.5, 641.0],
  },
} as const satisfies Record<string, BlobAsset>;

export type BlobFrame = keyof typeof BLOB_ASSETS;

/**
 * Solid-body bounding box of the HOME frame (source pixels, alpha > 128).
 * Used to centre the character and to size it against the screen.
 */
export const HOME_BODY = {
  centerX: 647.0,
  centerY: 612.0,
  width: 1027,
} as const;

/** Share of the 240px screen diameter the body should span (brief: 65–72%). */
export const BODY_FRACTION = 0.68;

/**
 * Face crossfade mask, in eye-distance units around the eye anchor.
 *
 * The body silhouettes genuinely differ between the two frames, so a
 * full-image crossfade double-edges the rim. Instead the HOME body is held
 * at full opacity for the whole transition and only this elliptical region —
 * eyes and mouth, comfortably inside the silhouette — crossfades. The result
 * is that the face changes while the body is provably stationary.
 */
export const FACE_MASK = {
  offsetX: 0.02,
  offsetY: 0.03,
  radiusX: 1.02,
  radiusY: 0.8,
  /** Fraction of the radius at which the feather begins. */
  feather: 0.62,
} as const;

/** Idle "alive but almost still" motion. Milliseconds and rendered pixels. */
export const IDLE = {
  /** Vertical float amplitude in 240-space pixels (brief: 1–2px). */
  floatPx: 1.5,
  floatPeriod: 5200,
  /** Scale breathing amplitude (brief: 0.5–1%). */
  breathAmount: 0.006,
  breathPeriod: 6800,
  /** Occasional ambient glow swell. */
  glowPeriod: 9000,
} as const;

/** HOME -> REACTION timeline. Total ~700ms, inside the 600–800ms target. */
export const REACTION = {
  /** Beat before anything reads as a reaction. */
  anticipationEnd: 150,
  /** Face crossfade window. */
  faceStart: 150,
  faceEnd: 580,
  /** Glow swell fired as the reaction lands; rises and falls over this long. */
  pulseDuration: 320,
  /** Returning to HOME is a plain settle — no anticipation, no pulse. */
  releaseDuration: 420,
} as const;

/** Temporary calibration offsets for reaction.png, driven by the dev controls. */
export interface BlobCalibration {
  /** Horizontal nudge in 240-space pixels. */
  offsetX: number;
  /** Vertical nudge in 240-space pixels. */
  offsetY: number;
  /** Multiplier on the measured alignment scale. */
  scale: number;
}

/** Defaults are 0/0/1 because the measured anchors already align the frames. */
export const DEFAULT_CALIBRATION: BlobCalibration = {
  offsetX: 0,
  offsetY: 0,
  scale: 1,
};

import type { BlobRig, FaceLayerId } from "./blobRig";
import { NEUTRAL_ELEMENT, NEUTRAL_BLOB } from "./blobRig";

/**
 * Temporary per-element calibration, driven by the dev controls.
 *
 * Offsets are in 240-space pixels — 1 unit is one real pixel on the target
 * panel. Scale is a multiplier on the measured neutral size. All defaults are
 * 0 / 0 / 1 because the measured anchors in blobRig.ts already reproduce the
 * master's face placement; these exist so the placement can be nudged by eye
 * and the final numbers folded back into blobRig.ts.
 */
export interface ElementCalibration {
  x: number;
  y: number;
  scale: number;
}

export type FaceCalibration = Record<FaceLayerId, ElementCalibration>;

export const DEFAULT_ELEMENT_CALIBRATION: ElementCalibration = {
  x: 0,
  y: 0,
  scale: 1,
};

export const DEFAULT_FACE_CALIBRATION: FaceCalibration = {
  leftEye: { ...DEFAULT_ELEMENT_CALIBRATION },
  rightEye: { ...DEFAULT_ELEMENT_CALIBRATION },
  mouth: { ...DEFAULT_ELEMENT_CALIBRATION },
};

/**
 * Layers the calibration onto a pose: offsets add to whatever the animation is
 * doing, scale multiplies it. Calibration is a static correction, so it must
 * not overwrite the idle motion — a blink still closes an eye that has been
 * nudged 2px left.
 */
export function applyCalibration(rig: BlobRig, cal: FaceCalibration): BlobRig {
  const merge = (t: BlobRig["leftEye"], c: ElementCalibration) => ({
    ...t,
    x: t.x + c.x,
    y: t.y + c.y,
    scaleX: t.scaleX * c.scale,
    scaleY: t.scaleY * c.scale,
    socketX: t.socketX + c.x,
    socketY: t.socketY + c.y,
    eyeSocketScaleX: t.eyeSocketScaleX * c.scale,
    eyeSocketScaleY: t.eyeSocketScaleY * c.scale,
  });
  return {
    blob: rig.blob,
    body: rig.body,
    leftEye: merge(rig.leftEye, cal.leftEye),
    rightEye: merge(rig.rightEye, cal.rightEye),
    mouth: merge(rig.mouth, cal.mouth),
  };
}

/** Neutral pose with only the calibration applied. */
export function rigFromCalibration(
  cal: FaceCalibration,
  blob: BlobRig["blob"] = NEUTRAL_BLOB
): BlobRig {
  return applyCalibration(
    {
      blob,
      body: { ...NEUTRAL_ELEMENT },
      leftEye: { ...NEUTRAL_ELEMENT },
      rightEye: { ...NEUTRAL_ELEMENT },
      mouth: { ...NEUTRAL_ELEMENT },
    },
    cal
  );
}

/** Human-readable dump for SAVE CALIBRATION. */
export function formatCalibration(cal: FaceCalibration): string {
  const line = (id: FaceLayerId, label: string) => {
    const c = cal[id];
    return `${label.padEnd(10)} x: ${c.x.toFixed(2).padStart(7)}   y: ${c.y
      .toFixed(2)
      .padStart(7)}   scale: ${c.scale.toFixed(3)}`;
  };
  return [
    "// 240-space pixels; paste back so these can be hardcoded",
    line("leftEye", "LEFT EYE"),
    line("rightEye", "RIGHT EYE"),
    line("mouth", "MOUTH"),
  ].join("\n");
}

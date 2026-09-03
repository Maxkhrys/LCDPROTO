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

/** Builds a full rig from a whole-blob transform plus the face calibration. */
export function rigFromCalibration(
  cal: FaceCalibration,
  blob: BlobRig["blob"] = NEUTRAL_BLOB
): BlobRig {
  const element = (c: ElementCalibration) => ({
    ...NEUTRAL_ELEMENT,
    x: c.x,
    y: c.y,
    scaleX: c.scale,
    scaleY: c.scale,
  });
  return {
    blob,
    leftEye: element(cal.leftEye),
    rightEye: element(cal.rightEye),
    mouth: element(cal.mouth),
  };
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

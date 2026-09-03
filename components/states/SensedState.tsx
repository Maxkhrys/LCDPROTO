"use client";

import { useMemo } from "react";
import BlobCharacter from "@/components/blob/BlobCharacter";
import { applyCalibration } from "@/lib/blobCalibration";
import {
  NEUTRAL_BLOB,
  NEUTRAL_ELEMENT,
  type BlobRig,
} from "@/lib/blobRig";
import type { StateViewProps } from "@/lib/deviceStates";
import SensedField from "./SensedField";

/**
 * SENSED — Blob has noticed a nearby signal. The field is deliberately sparse
 * so the green points feel like quiet sensing rather than a busy radar.
 */
export default function SensedState({
  size,
  playing,
  speed,
  renderScale,
  calibration,
  blobColour,
}: StateViewProps) {
  const rig = useMemo<BlobRig>(
    () =>
      applyCalibration(
        {
          blob: { ...NEUTRAL_BLOB },
          body: { ...NEUTRAL_ELEMENT },
          leftEye: {
            ...NEUTRAL_ELEMENT,
            x: 3.1,
            y: -0.6,
            eyeSocketScaleX: 1.06,
            eyeSocketScaleY: 1.08,
            scaleX: 1.04,
            scaleY: 1.05,
            browLift: 0.14,
          },
          rightEye: {
            ...NEUTRAL_ELEMENT,
            x: 3.35,
            y: -0.45,
            eyeSocketScaleX: 1.06,
            eyeSocketScaleY: 1.08,
            scaleX: 1.04,
            scaleY: 1.05,
            browLift: 0.12,
          },
          mouth: {
            ...NEUTRAL_ELEMENT,
            y: -0.4,
            scaleX: 1.08,
            scaleY: 1.05,
            mouthCurve: 0.28,
            mouthO: 0.2,
          },
        },
        calibration
      ),
    [calibration]
  );

  return (
    <div
      className="relative h-full w-full overflow-hidden rounded-full"
      style={{ width: size, height: size }}
    >
      <SensedField
        size={size}
        renderScale={renderScale}
        playing={playing}
        speed={speed}
      />
      <div className="absolute inset-0 flex items-center justify-center">
        <BlobCharacter
          size={size}
          renderScale={renderScale}
          rig={rig}
          colour={blobColour}
        />
      </div>
    </div>
  );
}

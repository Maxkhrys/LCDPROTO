"use client";

import { useEffect, useRef, useState } from "react";
import BlobCharacter from "@/components/blob/BlobCharacter";
import { rigFromCalibration } from "@/lib/blobCalibration";
import { NEUTRAL_BLOB, type BlobRig } from "@/lib/blobRig";
import type { StateViewProps } from "@/lib/deviceStates";

/** Idle "alive but almost still" motion, applied to the whole character. */
const IDLE = {
  floatPx: 1.5,
  floatPeriod: 5200,
  breathAmount: 0.006,
  breathPeriod: 6800,
} as const;

/**
 * HOME — the neutral Blob, reconstructed from the layered rig.
 *
 * Nothing here transforms the face: every facial element sits at its measured
 * neutral position, so this is the reference pose. The only motion is the
 * whole-character float and breathe, which moves body and face as one.
 */
export default function HomeState({
  size,
  playing,
  speed,
  runId,
  fps,
  renderScale,
  calibration,
}: StateViewProps) {
  const [blob, setBlob] = useState<BlobRig["blob"]>(NEUTRAL_BLOB);
  const timeRef = useRef(0);

  useEffect(() => {
    timeRef.current = 0;
  }, [runId]);

  useEffect(() => {
    let last = performance.now();
    let accumulator = 0;
    let frameId = 0;
    const frameInterval = 1000 / fps;

    const apply = () => {
      const t = timeRef.current;
      setBlob({
        ...NEUTRAL_BLOB,
        y: Math.sin((t / IDLE.floatPeriod) * Math.PI * 2) * IDLE.floatPx,
        scale:
          1 + Math.sin((t / IDLE.breathPeriod) * Math.PI * 2) * IDLE.breathAmount,
      });
    };

    const loop = (now: number) => {
      frameId = requestAnimationFrame(loop);
      const delta = Math.min(now - last, 100);
      last = now;
      accumulator += delta;
      if (accumulator < frameInterval) return;
      accumulator = 0;
      timeRef.current += delta * speed;
      apply();
    };

    apply();
    if (playing) frameId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frameId);
  }, [playing, speed, fps, runId]);

  return (
    <div className="relative h-full w-full bg-black">
      <BlobCharacter
        size={size}
        renderScale={renderScale}
        rig={rigFromCalibration(calibration, blob)}
      />
    </div>
  );
}

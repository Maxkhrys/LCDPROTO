"use client";

import { useEffect, useRef, useState } from "react";
import BlobCharacter from "@/components/blob/BlobCharacter";
import { applyCalibration, rigFromCalibration } from "@/lib/blobCalibration";
import { idleRig } from "@/lib/blobIdle";
import type { BlobRig } from "@/lib/blobRig";
import type { StateViewProps } from "@/lib/deviceStates";

/**
 * HOME — the neutral Blob with procedural idle motion.
 *
 * The pose is derived entirely from elapsed time (see lib/blobIdle.ts), so the
 * animation is reproducible and freezes cleanly on pause. No expression
 * animation lives here yet; the face only breathes, drifts and blinks.
 */
export default function HomeState({
  size,
  playing,
  speed,
  runId,
  fps,
  renderScale,
  calibration,
  idle,
}: StateViewProps) {
  const timeRef = useRef(0);
  const [rig, setRig] = useState<BlobRig>(() =>
    rigFromCalibration(calibration)
  );

  useEffect(() => {
    timeRef.current = 0;
  }, [runId]);

  useEffect(() => {
    let last = performance.now();
    let accumulator = 0;
    let frameId = 0;
    const frameInterval = 1000 / fps;

    const apply = () =>
      setRig(applyCalibration(idleRig(timeRef.current, idle), calibration));

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

    // Always paint the current pose, so a paused screen is never blank and
    // slider changes take effect immediately.
    apply();
    if (playing && idle.enabled) frameId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frameId);
  }, [playing, speed, fps, runId, idle, calibration]);

  return (
    <div className="relative h-full w-full bg-black">
      <BlobCharacter size={size} renderScale={renderScale} rig={rig} />
    </div>
  );
}

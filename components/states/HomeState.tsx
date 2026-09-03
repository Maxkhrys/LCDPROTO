"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import BlobCharacter from "@/components/blob/BlobCharacter";
import { applyCalibration } from "@/lib/blobCalibration";
import {
  BehaviourController,
  type BehaviourConfig,
  type BehaviourStatus,
} from "@/lib/blobBehaviour";
import { AmbientDrift } from "@/lib/blobIdle";
import { NEUTRAL_BLOB, NEUTRAL_ELEMENT, type BlobRig } from "@/lib/blobRig";
import type { StateViewProps } from "@/lib/deviceStates";

/** Safety cap on total body deformation, whatever the layers add up to. */
const MAX_DEFORM = 0.015;
const clampDeform = (v: number) =>
  v < -MAX_DEFORM ? -MAX_DEFORM : v > MAX_DEFORM ? MAX_DEFORM : v;

/**
 * HOME — the neutral Blob, driven by the micro-behaviour system.
 *
 * Two layers compose into one pose: continuous ambient drift and breathing,
 * and whatever single behaviour the scheduler is currently running. Both are
 * deltas on the calibrated neutral pose, so with behaviour off, or the moment
 * a future device state takes over, the rig returns cleanly to neutral.
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
  behaviourEnabled,
  triggerRequest,
  onBehaviourStatus,
}: StateViewProps) {
  const [rig, setRig] = useState<BlobRig>(() =>
    applyCalibration(
      {
        blob: { ...NEUTRAL_BLOB },
        body: { ...NEUTRAL_ELEMENT },
        leftEye: { ...NEUTRAL_ELEMENT },
        rightEye: { ...NEUTRAL_ELEMENT },
        mouth: { ...NEUTRAL_ELEMENT },
      },
      calibration
    )
  );

  const controller = useRef<BehaviourController>(null as never);
  if (controller.current === null) controller.current = new BehaviourController();
  const ambient = useRef<AmbientDrift>(null as never);
  if (ambient.current === null) ambient.current = new AmbientDrift();

  // Live config is read through a ref so changing a slider never restarts the
  // animation loop (which would visibly reset the character).
  const cfg = useRef({ calibration, idle, behaviourEnabled, onBehaviourStatus });
  cfg.current = { calibration, idle, behaviourEnabled, onBehaviourStatus };

  const reset = useCallback(() => {
    controller.current.reset();
    ambient.current.reset();
  }, []);

  useEffect(() => {
    reset();
  }, [runId, reset]);

  // Dev trigger buttons: a new nonce means "run this behaviour now".
  const lastNonce = useRef(-1);
  useEffect(() => {
    if (!triggerRequest || triggerRequest.nonce === lastNonce.current) return;
    lastNonce.current = triggerRequest.nonce;
    controller.current.trigger(triggerRequest.id);
  }, [triggerRequest]);

  useEffect(() => {
    let last = performance.now();
    let accumulator = 0;
    let frameId = 0;
    let statusAt = 0;
    let lastStatus: BehaviourStatus | null = null;
    const frameInterval = 1000 / fps;

    const build = (dt: number) => {
      const { calibration: cal, idle: cfgIdle, behaviourEnabled: on } = cfg.current;
      const bc: BehaviourConfig = {
        gazePx: cfgIdle.gazeDriftPx,
        squash: cfgIdle.squashAmount,
        paceScale: cfgIdle.blinkInterval / 5.5,
      };

      if (on && cfgIdle.enabled) controller.current.update(dt, bc);
      const d = on && cfgIdle.enabled
        ? controller.current.pose(bc)
        : controller.current.pose({ ...bc, gazePx: 0, squash: 0 });

      // Ambient sees the behaviour's vertical contribution too, so the soft-body
      // lag reacts to real movement rather than only to the drift.
      const amb = cfgIdle.enabled
        ? ambient.current.update(dt, cfgIdle, d.blobY)
        : { x: 0, y: 0, breath: 0, squashX: 0, squashY: 0 };

      const active = on && cfgIdle.enabled;
      const dsx = (active ? d.blobScaleX : 0) + amb.squashX;
      const dsy = (active ? d.blobScaleY : 0) + amb.squashY;

      const eye = {
        ...NEUTRAL_ELEMENT,
        x: active ? d.eyeX : 0,
        y: active ? d.eyeY : 0,
        scaleY: active ? d.eyeLid : 1,
      };

      return applyCalibration(
        {
          blob: {
            x: amb.x + (active ? d.blobX : 0),
            y: amb.y + (active ? d.blobY : 0),
            scale: 1 + amb.breath,
            scaleX: 1 + clampDeform(dsx),
            scaleY: 1 + clampDeform(dsy),
            rotation: active ? d.blobRotation : 0,
            opacity: 1,
          },
          // The body carries no transform of its own: lean and deformation are
          // applied to the whole character, which is what keeps the face welded
          // to the body instead of sliding across it.
          body: { ...NEUTRAL_ELEMENT },
          leftEye: { ...eye },
          rightEye: { ...eye },
          mouth: {
            ...NEUTRAL_ELEMENT,
            x: active ? d.mouthX : 0,
            y: active ? d.mouthY : 0,
            scaleX: 1 + (active ? d.mouthScaleX : 0),
            scaleY: 1 + (active ? d.mouthScaleY : 0),
            rotation: active ? d.mouthRotation : 0,
          },
        },
        cal
      );
    };

    const report = (now: number) => {
      const s = controller.current.status();
      if (now - statusAt < 200 && lastStatus?.id === s.id) return;
      statusAt = now;
      lastStatus = s;
      cfg.current.onBehaviourStatus?.(s);
    };

    const loop = (now: number) => {
      frameId = requestAnimationFrame(loop);
      const delta = Math.min(now - last, 100);
      last = now;
      accumulator += delta;
      if (accumulator < frameInterval) return;
      accumulator = 0;
      setRig(build(delta * speed));
      report(now);
    };

    // Paint the current pose immediately so a paused screen is never blank and
    // slider changes take effect without waiting for a frame.
    setRig(build(0));
    report(performance.now());
    if (playing) frameId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frameId);
  }, [playing, speed, fps, runId]);

  return (
    <div className="relative h-full w-full bg-black">
      <BlobCharacter size={size} renderScale={renderScale} rig={rig} />
    </div>
  );
}

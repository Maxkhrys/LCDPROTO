"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import BlobCharacter from "@/components/blob/BlobCharacter";
import { applyCalibration } from "@/lib/blobCalibration";
import {
  BehaviourController,
  type BehaviourConfig,
  type HomeActivityStatus,
} from "@/lib/blobBehaviour";
import { AmbientDrift, type IdleConfig } from "@/lib/blobIdle";
import { BlobJellyPhysics, type JellyTarget } from "@/lib/blobPhysics";
import { NEUTRAL_BLOB, NEUTRAL_ELEMENT, type BlobRig } from "@/lib/blobRig";
import type { StateViewProps } from "@/lib/deviceStates";

/** Safety cap on total body deformation, whatever the layers add up to. */
const MAX_DEFORM = 0.1;
const MAX_BODY_DEFORM = 0.05;
const clampDeform = (v: number) =>
  v < -MAX_DEFORM ? -MAX_DEFORM : v > MAX_DEFORM ? MAX_DEFORM : v;
const clampBodyDeform = (v: number) =>
  v < -MAX_BODY_DEFORM
    ? -MAX_BODY_DEFORM
    : v > MAX_BODY_DEFORM
      ? MAX_BODY_DEFORM
      : v;

const ZERO_AMBIENT = {
  x: 0,
  y: 0,
  rotation: 0,
  breath: 0,
  squashX: 0,
  squashY: 0,
};

const behaviourConfig = (idle: IdleConfig): BehaviourConfig => ({
  gazePx: idle.gazeDriftPx,
  squash: idle.squashAmount,
  paceScale: idle.activityPace,
  blinkIntervalMs: idle.blinkInterval * 1000,
});

/**
 * HOME — the neutral Blob, driven by the micro-behaviour system.
 *
 * Ambient drift composes with concurrent mood, gaze, lids, mouth and body
 * channels. Face springs lead, body springs follow, and the secondary mass is
 * last to settle. A future state can still interrupt from any presented frame.
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
  autoBehaviourEnabled,
  triggerRequest,
  onBehaviourStatus,
  displayMode,
  blobColour,
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
  const physics = useRef<BlobJellyPhysics>(null as never);
  if (physics.current === null) physics.current = new BlobJellyPhysics();

  // Live config is read through a ref so changing a slider never restarts the
  // animation loop (which would visibly reset the character).
  const cfg = useRef({ calibration, idle, autoBehaviourEnabled, onBehaviourStatus });
  cfg.current = { calibration, idle, autoBehaviourEnabled, onBehaviourStatus };

  const reset = useCallback(() => {
    controller.current.reset();
    ambient.current.reset();
    physics.current.reset();
  }, []);

  useEffect(() => {
    reset();
  }, [runId, reset]);

  // Dev trigger buttons: a new nonce means "run this behaviour now".
  const lastNonce = useRef(-1);
  useEffect(() => {
    if (!triggerRequest || triggerRequest.nonce === lastNonce.current) return;
    lastNonce.current = triggerRequest.nonce;
    controller.current.trigger(triggerRequest.id, behaviourConfig(cfg.current.idle));
  }, [triggerRequest]);

  useEffect(() => {
    let last = performance.now();
    let accumulator = 0;
    let frameId = 0;
    let statusAt = 0;
    let lastStatus: HomeActivityStatus | null = null;
    let latestIdleX = 0;
    let latestIdleY = 0;
    let latestRotation = 0;
    let latestBodySpeed = 0;
    const jellyTarget: JellyTarget = {
      x: 0,
      y: 0,
      rotation: 0,
      scaleX: 0,
      scaleY: 0,
      bodyX: 0,
      bodyY: 0,
      bodyRotation: 0,
      bodyScaleX: 0,
      bodyScaleY: 0,
      bodySkewX: 0,
      bodySkewY: 0,
      bodyOriginX: 0,
      bodyOriginY: 0.82,
      jellyAmount: 1,
      rippleAmount: 1,
    };
    const frameInterval = 1000 / fps;

    const build = (dt: number) => {
      const {
        calibration: cal,
        idle: cfgIdle,
        autoBehaviourEnabled,
      } = cfg.current;
      const bc = behaviourConfig(cfgIdle);

      controller.current.update(dt, bc, autoBehaviourEnabled);
      const d = controller.current.pose();

      // Ambient sees the behaviour's vertical contribution too, so the soft-body
      // lag reacts to real movement rather than only to the drift.
      const amb = cfgIdle.enabled
        ? ambient.current.update(dt, cfgIdle, d.blobY)
        : ZERO_AMBIENT;

      const dsx = d.blobScaleX + amb.squashX;
      const dsy = d.blobScaleY + amb.squashY;
      jellyTarget.x = amb.x + d.blobX;
      jellyTarget.y = amb.y + d.blobY;
      jellyTarget.rotation = amb.rotation + d.blobRotation;
      jellyTarget.scaleX = clampDeform(dsx);
      jellyTarget.scaleY = clampDeform(dsy);
      jellyTarget.bodyX = d.bodyX;
      jellyTarget.bodyY = d.bodyY;
      jellyTarget.bodyRotation = d.bodyRotation;
      jellyTarget.bodyScaleX = clampBodyDeform(d.bodyScaleX);
      jellyTarget.bodyScaleY = clampBodyDeform(d.bodyScaleY);
      jellyTarget.bodySkewX = d.bodySkewX;
      jellyTarget.bodySkewY = d.bodySkewY;
      jellyTarget.bodyOriginX = d.bodyOriginX;
      jellyTarget.bodyOriginY = d.bodyOriginY;
      jellyTarget.jellyAmount = cfgIdle.jellyAmount;
      jellyTarget.rippleAmount = cfgIdle.rippleAmount;
      const physical = physics.current.update(dt, jellyTarget);

      latestIdleX = amb.x;
      latestIdleY = amb.y;
      latestRotation = physical.rotation;
      latestBodySpeed = physical.bodySpeed;

      const deformX = clampDeform(physical.scaleX);
      const deformY = clampDeform(physical.scaleY);

      return applyCalibration(
        {
          blob: {
            x: physical.x,
            y: physical.y,
            scale: 1 + amb.breath,
            // Squash lives on the shared body surface. BlobCharacter applies
            // that same transform to every face anchor, so features stay
            // attached instead of preserving a separate screen-space grid.
            scaleX: 1,
            scaleY: 1,
            rotation: latestRotation,
            opacity: 1,
          },
          // The body is the actual deforming surface. Facial anchors inherit
          // this full transform in BlobCharacter; the face artwork itself is
          // partially compensated there to stay crisp.
          body: {
            ...NEUTRAL_ELEMENT,
            x: physical.bodyX,
            y: physical.bodyY,
            rotation: physical.bodyRotation,
            skewX: physical.bodySkewX,
            skewY: physical.bodySkewY,
            originX: physical.bodyOriginX,
            originY: physical.bodyOriginY,
            scaleX: 1 + deformX + clampBodyDeform(physical.bodyScaleX),
            scaleY: 1 + deformY + clampBodyDeform(physical.bodyScaleY),
          },
          leftEye: {
            ...NEUTRAL_ELEMENT,
            x: d.eyeX + d.leftEyeX,
            y: d.eyeY + d.leftEyeY,
            // Gaze moves texture; socketX/socketY stay at the body-space
            // anchor. eyeOpen drives an anchored top-down lid closure.
            eyeOpen: d.eyeLid * d.leftEyeTension,
            eyeSocketScaleX: 1 + d.leftEyeScaleX,
            eyeSocketScaleY: 1 + d.leftEyeScaleY,
            browLift: d.leftEyeTension - 1,
            scaleX: 1 + d.leftEyeScaleX,
            scaleY: 1 + d.leftEyeScaleY,
            rotation: d.leftEyeRotation,
          },
          rightEye: {
            ...NEUTRAL_ELEMENT,
            x: d.eyeX + d.rightEyeX,
            y: d.eyeY + d.rightEyeY,
            eyeOpen: d.eyeLid * d.rightEyeTension,
            eyeSocketScaleX: 1 + d.rightEyeScaleX,
            eyeSocketScaleY: 1 + d.rightEyeScaleY,
            browLift: d.rightEyeTension - 1,
            scaleX: 1 + d.rightEyeScaleX,
            scaleY: 1 + d.rightEyeScaleY,
            rotation: d.rightEyeRotation,
          },
          mouth: {
            ...NEUTRAL_ELEMENT,
            x: d.mouthX,
            y: d.mouthY,
            scaleX: 1 + d.mouthScaleX,
            scaleY: 1 + d.mouthScaleY,
            rotation: d.mouthRotation,
            opacity: d.mouthOpacity,
            mouthCurve: d.mouthCurve,
            mouthO: d.mouthO,
          },
        },
        cal
      );
    };

    const report = (now: number) => {
      const base = controller.current.status();
      const s: HomeActivityStatus = {
        ...base,
        idleX: latestIdleX,
        idleY: latestIdleY,
        bodyRotation: latestRotation,
        bodySpeed: latestBodySpeed,
      };
      if (
        now - statusAt < 100 &&
        lastStatus?.id === s.id &&
        lastStatus.blinkState === s.blinkState
      ) {
        return;
      }
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
      const elapsed = Math.floor(accumulator / frameInterval) * frameInterval;
      accumulator -= elapsed;
      setRig(build(elapsed * speed));
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
    <div
      className="relative h-full w-full"
      style={{ background: displayMode === "warm" ? "#cfc3b4" : "#000" }}
    >
      <BlobCharacter
        size={size}
        renderScale={renderScale}
        rig={rig}
        colour={blobColour}
      />
    </div>
  );
}

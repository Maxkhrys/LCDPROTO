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
import {
  DISPLAY_BACKGROUNDS,
  type StateViewProps,
} from "@/lib/deviceStates";
import SensedField from "./SensedField";

const MAX_DEFORM = 0.1;
const MAX_BODY_DEFORM = 0.05;
const clampDeform = (value: number) =>
  value < -MAX_DEFORM ? -MAX_DEFORM : value > MAX_DEFORM ? MAX_DEFORM : value;
const clampBodyDeform = (value: number) =>
  value < -MAX_BODY_DEFORM
    ? -MAX_BODY_DEFORM
    : value > MAX_BODY_DEFORM
      ? MAX_BODY_DEFORM
      : value;

const ZERO_AMBIENT = {
  x: 0,
  y: 0,
  rotation: 0,
  breath: 0,
  squashX: 0,
  squashY: 0,
};

/** SENSED borrows HOME's motion vocabulary, with quieter expression density. */
function sensedIdleConfig(idle: IdleConfig): IdleConfig {
  return {
    ...idle,
    floatPx: idle.floatPx * 0.62,
    breathAmount: idle.breathAmount * 0.84,
    squashAmount: idle.squashAmount * 0.72,
    jellyAmount: idle.jellyAmount * 0.88,
    rippleAmount: idle.rippleAmount * 0.78,
    blinkInterval: idle.blinkInterval * 1.28,
    gazeDriftPx: idle.gazeDriftPx * 0.78,
    rotationDeg: idle.rotationDeg * 0.72,
    activityPace: idle.activityPace * 1.3,
  };
}

const behaviourConfig = (idle: IdleConfig): BehaviourConfig => ({
  gazePx: idle.gazeDriftPx,
  squash: idle.squashAmount,
  paceScale: idle.activityPace,
  blinkIntervalMs: idle.blinkInterval * 1000,
});

/** SENSED face: attentive side-look, slightly open mouth, raised brows. */
const SENSED_FACE = {
  leftEyeX: 2.2,
  rightEyeX: 2.45,
  eyeY: -0.35,
  eyeSocketScaleX: 1.04,
  eyeSocketScaleY: 1.06,
  eyeScaleX: 1.025,
  eyeScaleY: 1.04,
  leftBrow: 0.1,
  rightBrow: 0.08,
  mouthY: -0.22,
  mouthScaleX: 1.07,
  mouthScaleY: 1.04,
  mouthCurve: 0.46,
  mouthO: 0.08,
} as const;

/**
 * SENSED — same concurrent HOME motion system, lower activity and a quieter
 * sensing field. The two SENSED variants are coordinated beats inside the
 * shared controller, so they keep face-first/body-last timing.
 */
export default function SensedState({
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
        leftEye: { ...NEUTRAL_ELEMENT, x: SENSED_FACE.leftEyeX },
        rightEye: { ...NEUTRAL_ELEMENT, x: SENSED_FACE.rightEyeX },
        mouth: { ...NEUTRAL_ELEMENT },
      },
      calibration
    )
  );

  const controller = useRef<BehaviourController>(null as never);
  if (controller.current === null) {
    controller.current = new BehaviourController();
  }
  const ambient = useRef<AmbientDrift>(null as never);
  if (ambient.current === null) ambient.current = new AmbientDrift();
  const physics = useRef<BlobJellyPhysics>(null as never);
  if (physics.current === null) physics.current = new BlobJellyPhysics();

  const cfg = useRef({
    calibration,
    idle,
    autoBehaviourEnabled,
    onBehaviourStatus,
  });
  cfg.current = {
    calibration,
    idle,
    autoBehaviourEnabled,
    onBehaviourStatus,
  };

  const reset = useCallback(() => {
    controller.current.reset();
    ambient.current.reset();
    physics.current.reset();
  }, []);

  useEffect(() => {
    reset();
  }, [reset, runId]);

  const lastNonce = useRef(-1);
  useEffect(() => {
    if (!triggerRequest || triggerRequest.nonce === lastNonce.current) return;
    lastNonce.current = triggerRequest.nonce;
    controller.current.trigger(
      triggerRequest.id,
      behaviourConfig(sensedIdleConfig(cfg.current.idle))
    );
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
      const { calibration: cal, idle: sourceIdle, autoBehaviourEnabled } =
        cfg.current;
      const sensedIdle = sensedIdleConfig(sourceIdle);
      const bc = behaviourConfig(sensedIdle);

      controller.current.update(dt, bc, autoBehaviourEnabled);
      const d = controller.current.pose();
      const amb = sensedIdle.enabled
        ? ambient.current.update(dt, sensedIdle, d.blobY)
        : ZERO_AMBIENT;

      jellyTarget.x = amb.x + d.blobX;
      jellyTarget.y = amb.y + d.blobY;
      jellyTarget.rotation = amb.rotation + d.blobRotation;
      jellyTarget.scaleX = clampDeform(d.blobScaleX + amb.squashX);
      jellyTarget.scaleY = clampDeform(d.blobScaleY + amb.squashY);
      jellyTarget.bodyX = d.bodyX;
      jellyTarget.bodyY = d.bodyY;
      jellyTarget.bodyRotation = d.bodyRotation;
      jellyTarget.bodyScaleX = clampBodyDeform(d.bodyScaleX);
      jellyTarget.bodyScaleY = clampBodyDeform(d.bodyScaleY);
      jellyTarget.bodySkewX = d.bodySkewX;
      jellyTarget.bodySkewY = d.bodySkewY;
      jellyTarget.bodyOriginX = d.bodyOriginX;
      jellyTarget.bodyOriginY = d.bodyOriginY;
      jellyTarget.jellyAmount = sensedIdle.jellyAmount;
      jellyTarget.rippleAmount = sensedIdle.rippleAmount;
      const physical = physics.current.update(dt, jellyTarget);

      latestIdleX = amb.x;
      latestIdleY = amb.y;
      latestRotation = physical.rotation;
      latestBodySpeed = physical.bodySpeed;

      const bodyDeformX = clampDeform(physical.scaleX);
      const bodyDeformY = clampDeform(physical.scaleY);

      return applyCalibration(
        {
          blob: {
            x: physical.x,
            y: physical.y,
            scale: 1 + amb.breath,
            scaleX: 1,
            scaleY: 1,
            rotation: latestRotation,
            opacity: 1,
          },
          body: {
            ...NEUTRAL_ELEMENT,
            x: physical.bodyX,
            y: physical.bodyY,
            rotation: physical.bodyRotation,
            skewX: physical.bodySkewX,
            skewY: physical.bodySkewY,
            originX: physical.bodyOriginX,
            originY: physical.bodyOriginY,
            scaleX: 1 + bodyDeformX + clampBodyDeform(physical.bodyScaleX),
            scaleY: 1 + bodyDeformY + clampBodyDeform(physical.bodyScaleY),
            rippleTop: physical.rippleTop,
            rippleUpper: physical.rippleUpper,
            rippleLower: physical.rippleLower,
            rippleBottom: physical.rippleBottom,
          },
          leftEye: {
            ...NEUTRAL_ELEMENT,
            x: SENSED_FACE.leftEyeX + d.eyeX + d.leftEyeX,
            y: SENSED_FACE.eyeY + d.eyeY + d.leftEyeY,
            eyeOpen: d.eyeLid * d.leftEyeTension,
            eyeSocketScaleX: SENSED_FACE.eyeSocketScaleX + d.leftEyeScaleX,
            eyeSocketScaleY: SENSED_FACE.eyeSocketScaleY + d.leftEyeScaleY,
            browLift: SENSED_FACE.leftBrow + d.leftEyeTension - 1,
            scaleX: SENSED_FACE.eyeScaleX + d.leftEyeScaleX,
            scaleY: SENSED_FACE.eyeScaleY + d.leftEyeScaleY,
            rotation: d.leftEyeRotation,
          },
          rightEye: {
            ...NEUTRAL_ELEMENT,
            x: SENSED_FACE.rightEyeX + d.eyeX + d.rightEyeX,
            y: SENSED_FACE.eyeY + d.eyeY + d.rightEyeY,
            eyeOpen: d.eyeLid * d.rightEyeTension,
            eyeSocketScaleX: SENSED_FACE.eyeSocketScaleX + d.rightEyeScaleX,
            eyeSocketScaleY: SENSED_FACE.eyeSocketScaleY + d.rightEyeScaleY,
            browLift: SENSED_FACE.rightBrow + d.rightEyeTension - 1,
            scaleX: SENSED_FACE.eyeScaleX + d.rightEyeScaleX,
            scaleY: SENSED_FACE.eyeScaleY + d.rightEyeScaleY,
            rotation: d.rightEyeRotation,
          },
          mouth: {
            ...NEUTRAL_ELEMENT,
            x: d.mouthX,
            y: SENSED_FACE.mouthY + d.mouthY,
            scaleX: SENSED_FACE.mouthScaleX + d.mouthScaleX,
            scaleY: SENSED_FACE.mouthScaleY + d.mouthScaleY,
            rotation: d.mouthRotation,
            opacity: d.mouthOpacity,
            mouthCurve: SENSED_FACE.mouthCurve + d.mouthCurve - 0.82,
            mouthO: Math.max(SENSED_FACE.mouthO, d.mouthO),
          },
        },
        cal
      );
    };

    const report = (now: number) => {
      const base = controller.current.status();
      const status: HomeActivityStatus = {
        ...base,
        idleX: latestIdleX,
        idleY: latestIdleY,
        bodyRotation: latestRotation,
        bodySpeed: latestBodySpeed,
      };
      if (
        now - statusAt < 100 &&
        lastStatus?.id === status.id &&
        lastStatus.blinkState === status.blinkState
      ) {
        return;
      }
      statusAt = now;
      lastStatus = status;
      cfg.current.onBehaviourStatus?.(status);
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

    setRig(build(0));
    report(performance.now());
    if (playing) frameId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frameId);
  }, [fps, playing, runId, speed]);

  return (
    <div
      className="relative h-full w-full"
      style={{ background: DISPLAY_BACKGROUNDS[displayMode] }}
    >
      <SensedField
        size={size}
        renderScale={renderScale}
        playing={playing}
        speed={speed}
      />
      <BlobCharacter
        size={size}
        renderScale={renderScale}
        rig={rig}
        colour={blobColour}
      />
    </div>
  );
}

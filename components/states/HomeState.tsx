"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import BlobCharacter from "@/components/blob/BlobCharacter";
import CloudCharacter from "@/components/blob/CloudCharacter";
import { CHARACTERS } from "@/lib/characters";
import { applyCalibration } from "@/lib/blobCalibration";
import {
  BehaviourController,
  type BehaviourConfig,
  type HomeActivityStatus,
} from "@/lib/blobBehaviour";
import { AmbientDrift, type IdleConfig } from "@/lib/blobIdle";
import { BlobJellyPhysics, type JellyTarget } from "@/lib/blobPhysics";
import { BlobDragController } from "@/lib/blobDrag";
import EnvironmentLayer from "./EnvironmentLayer";
import {
  BODY_FRACTION,
  NEUTRAL_BLOB,
  NEUTRAL_ELEMENT,
  type BlobRig,
} from "@/lib/blobRig";
import type { StateViewProps } from "@/lib/deviceStates";

/** Safety cap on total body deformation, whatever the layers add up to. */
const MAX_DEFORM = 0.1;
const MAX_BODY_DEFORM = 0.34;
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
  viewportSize,
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
  screenColour,
  onOpenBlobTools,
  onCloseBlobTools,
  blobToolsOpen,
  mood,
  showPupils,
  blobColour,
  character,
  cloudSettings,
  characterScale,
  mindIntention,
  mindDestination,
  mindDepth,
  environment,
  onEnvironmentStatus,
}: StateViewProps) {
  const cssSize = viewportSize ?? size;
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
  const drag = useRef<BlobDragController>(null as never);
  if (drag.current === null) drag.current = new BlobDragController();

  // Live config is read through a ref so changing a slider never restarts the
  // animation loop (which would visibly reset the character).
  const cfg = useRef({
    size,
    character,
    calibration,
    idle,
    autoBehaviourEnabled,
    onBehaviourStatus,
    mindIntention,
    mindDestination,
    mindDepth,
    characterScale,
  });
  cfg.current = {
    size,
    character,
    calibration,
    idle,
    autoBehaviourEnabled,
    onBehaviourStatus,
    mindIntention,
    mindDestination,
    mindDepth,
    characterScale,
  };

  const reset = useCallback(() => {
    controller.current.reset();
    ambient.current.reset();
    physics.current.reset();
    drag.current.reset();
  }, []);

  useEffect(() => {
    reset();
  }, [runId, reset]);

  useEffect(() => {
    if (mood) controller.current.setMood(mood);
  }, [mood]);

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
    let contactX = 0;
    let contactY = 0;
    let contactPressure = 0;
    let latestDepth = 0;
    let latestYaw = 0;
    let latestPitch = 0;
    const jellyTarget: JellyTarget = {
      x: 0,
      y: 0,
      depth: 0,
      yaw: 0,
      pitch: 0,
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
      bodyDeformAngle: 0,
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

      controller.current.setMindOverrides(
        cfg.current.mindIntention,
        cfg.current.mindDestination,
        cfg.current.mindDepth
      );
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
      jellyTarget.depth = d.blobDepth;
      jellyTarget.yaw = d.blobYaw;
      jellyTarget.pitch = d.blobPitch;
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
      // The grab moves Blob before the jelly springs see it, so dragging
      // inherits the existing body lag, squash and ripple response instead of
      // running a second animation system beside it.
      const screen = cfg.current.size;
      // Each body has its own silhouette, so each stops at its own wall.
      const characterRadius =
        CHARACTERS.find((entry) => entry.id === cfg.current.character)
          ?.radiusFraction ?? 0.5;
      const blobScaleNow = (1 + amb.breath) * (1 + d.blobScale);
      const dragPose = drag.current.step(
        dt,
        screen,
        screen * BODY_FRACTION * characterRadius * blobScaleNow,
        jellyTarget.x,
        jellyTarget.y
      );
      jellyTarget.x += dragPose.x;
      jellyTarget.y += dragPose.y;
      jellyTarget.rotation += dragPose.rotation;
      jellyTarget.scaleX = clampDeform(dsx + dragPose.scaleX);
      jellyTarget.scaleY = clampDeform(dsy + dragPose.scaleY);
      // Keep wall squash on the shared body surface. The angle is local to
      // the body, so every radial wall direction deforms correctly.
      jellyTarget.bodyDeformAngle =
        dragPose.wallPressure > 0.01
          ? dragPose.deformAngle - d.bodyRotation
          : 0;
      jellyTarget.bodyScaleX = clampBodyDeform(
        d.bodyScaleX + dragPose.bodyScaleX
      );
      jellyTarget.bodyScaleY = clampBodyDeform(
        d.bodyScaleY + dragPose.bodyScaleY
      );
      contactX = dragPose.contactX;
      contactY = dragPose.contactY;
      contactPressure = dragPose.wallPressure;
      jellyTarget.bodySkewX = d.bodySkewX + dragPose.skewX;
      jellyTarget.bodySkewY = d.bodySkewY + dragPose.skewY;

      const physical = physics.current.update(dt, jellyTarget);

      latestIdleX = amb.x;
      latestIdleY = amb.y;
      latestRotation = physical.rotation;
      latestBodySpeed = physical.bodySpeed;
      latestDepth = physical.depth;
      latestYaw = physical.yaw;
      latestPitch = physical.pitch;

      const deformX = clampDeform(physical.scaleX);
      const deformY = clampDeform(physical.scaleY);

      return applyCalibration(
        {
          blob: {
            x: physical.x,
            y: physical.y,
            depth: physical.depth,
            yaw: physical.yaw,
            pitch: physical.pitch,
            scale: cfg.current.characterScale * (1 + amb.breath) * (1 + d.blobScale),
            // Squash lives on the shared body surface. BlobCharacter applies
            // that same transform to every face anchor, so features stay
            // attached instead of preserving a separate screen-space grid.
            scaleX: 1,
            scaleY: 1,
            rotation: latestRotation + d.blobSpin,
            opacity: d.blobOpacity,
            faceStyle: d.faceStyle,
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
            deformAngle: physical.bodyDeformAngle,
            scaleX: 1 + deformX + clampBodyDeform(physical.bodyScaleX),
            scaleY: 1 + deformY + clampBodyDeform(physical.bodyScaleY),
            contactX,
            contactY,
            contactPressure,
            rippleTop: physical.rippleTop,
            rippleUpper: physical.rippleUpper,
            rippleLower: physical.rippleLower,
            rippleBottom: physical.rippleBottom,
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
            browRotation: d.leftBrowRotation,
            pupilX: d.leftPupilX,
            pupilY: d.leftPupilY,
            pupilScale: d.pupilScale,
            lidBias: d.leftLidBias,
            eyeStyle: d.leftEyeStyle,
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
            browRotation: d.rightBrowRotation,
            pupilX: d.rightPupilX,
            pupilY: d.rightPupilY,
            pupilScale: d.pupilScale,
            lidBias: d.rightLidBias,
            eyeStyle: d.rightEyeStyle,
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
            mouthD: d.mouthD,
            mouthCrescent: d.mouthCrescent,
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
        depth: latestDepth,
        yaw: latestYaw,
        pitch: latestPitch,
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
      className="relative isolate h-full w-full"
      style={{ background: screenColour }}
    >
      <EnvironmentLayer
        size={size}
        viewportSize={cssSize}
        renderScale={renderScale}
        playing={playing}
        speed={speed}
        screenColour={screenColour}
        displayMode={displayMode}
        rig={rig}
        config={environment}
        onStatus={onEnvironmentStatus}
      />
      <div className="relative z-10 h-full w-full">
        {character === "cloud" ? (
          <CloudCharacter
          size={size}
          viewportSize={cssSize}
          renderScale={renderScale}
          rig={rig}
          colour={blobColour}
          onOpenTools={onOpenBlobTools}
          onCloseTools={onCloseBlobTools}
          settingsOpen={blobToolsOpen}
          showPupils={showPupils}
          drag={drag.current}
            cloudParams={cloudSettings.params}
            cloudMotion={cloudSettings.motion}
            cloudTrails={cloudSettings.trails}
            cloudColour={cloudSettings.colour}
            cloudFace={cloudSettings.face}
            cloudPalette={cloudSettings.palettePreset}
          />
        ) : (
          <BlobCharacter
          size={size}
          viewportSize={cssSize}
          renderScale={renderScale}
          rig={rig}
          colour={blobColour}
          onOpenTools={onOpenBlobTools}
          onCloseTools={onCloseBlobTools}
          settingsOpen={blobToolsOpen}
          showPupils={showPupils}
          drag={drag.current}
          />
        )}
      </div>
    </div>
  );
}

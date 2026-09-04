"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import CloudBlobBody from "./CloudBlobBody";
import CloudBlobControls, { type ViewMode } from "./CloudBlobControls";
import BlobCharacter from "@/components/blob/BlobCharacter";
import {
  type CloudDeformationParams,
  type CloudMotionConfig,
  type CloudTrailConfig,
  type CloudPresetName,
  type DragInteractionState,
} from "./cloudTypes";
import {
  DEFAULT_DEFORMATION,
  DEFAULT_MOTION_CONFIG,
  PRESETS,
} from "./cloudLobeSystem";
import {
  NEUTRAL_BLOB,
  NEUTRAL_ELEMENT,
  type BlobRig,
  type BlobColour,
} from "@/lib/blobRig";
import {
  BehaviourController,
  type BehaviourConfig,
  type BehaviourId,
} from "@/lib/blobBehaviour";
import { AmbientDrift, DEFAULT_IDLE } from "@/lib/blobIdle";
import { BlobJellyPhysics, type JellyTarget } from "@/lib/blobPhysics";
import { applyCalibration, DEFAULT_FACE_CALIBRATION } from "@/lib/blobCalibration";

const BC_CONFIG: BehaviourConfig = {
  gazePx: DEFAULT_IDLE.gazeDriftPx,
  squash: DEFAULT_IDLE.squashAmount,
  paceScale: DEFAULT_IDLE.activityPace,
  blinkIntervalMs: DEFAULT_IDLE.blinkInterval * 1000,
};

export default function CloudBlobTest() {
  const [viewMode, setViewMode] = useState<ViewMode>("cloud");
  const [blobColour, setBlobColour] = useState<BlobColour>("teal");
  const [showFace, setShowFace] = useState(true);
  const [dragEnabled, setDragEnabled] = useState(true);
  const [idleEnabled, setIdleEnabled] = useState(true);

  const [params, setParams] = useState<CloudDeformationParams>(DEFAULT_DEFORMATION);
  const [motion, setMotion] = useState<CloudMotionConfig>(DEFAULT_MOTION_CONFIG);
  const [trails, setTrails] = useState<CloudTrailConfig>({
    enabled: true,
    spawnRate: 1.0,
    lifetime: 0.9,
    fadeSpeed: 1.0,
    trailStrength: 1.0,
    driftAmount: 1.0,
  });

  const [activePreset, setActivePreset] = useState<CloudPresetName | null>("NEUTRAL");
  const [activeBehaviour, setActiveBehaviour] = useState<BehaviourId | "HOME / REST">("HOME / REST");
  const [zoom, setZoom] = useState(1.0);
  const [displayMode, setDisplayMode] = useState<"dark" | "warm">("dark");

  // Drag interaction state
  const [dragState, setDragState] = useState<DragInteractionState>({
    isDragging: false,
    offsetX: 0,
    offsetY: 0,
    speed: 0,
  });

  // Telemetry state
  const [fps, setFps] = useState(60);
  const [frameTimeMs, setFrameTimeMs] = useState(0.4);
  const [activeWisps, setActiveWisps] = useState(0);
  const [avgLag, setAvgLag] = useState(64);

  // Production Rig Generator (BehaviourController + AmbientDrift + JellyPhysics)
  const controller = useRef<BehaviourController>(null as never);
  if (controller.current === null) controller.current = new BehaviourController();
  const ambient = useRef<AmbientDrift>(null as never);
  if (ambient.current === null) ambient.current = new AmbientDrift();
  const physics = useRef<BlobJellyPhysics>(null as never);
  if (physics.current === null) physics.current = new BlobJellyPhysics();

  const [currentRig, setCurrentRig] = useState<BlobRig>(() =>
    applyCalibration(
      {
        blob: { ...NEUTRAL_BLOB },
        body: { ...NEUTRAL_ELEMENT },
        leftEye: { ...NEUTRAL_ELEMENT },
        rightEye: { ...NEUTRAL_ELEMENT },
        mouth: { ...NEUTRAL_ELEMENT },
      },
      DEFAULT_FACE_CALIBRATION
    )
  );

  const handleTelemetry = useCallback(
    (currentFps: number, currentFrameTimeMs: number, currentWisps: number, currentLag: number) => {
      setFps(currentFps);
      setFrameTimeMs(currentFrameTimeMs);
      setActiveWisps(currentWisps);
      setAvgLag(currentLag);
    },
    []
  );

  const handleChangeParam = useCallback(
    (key: keyof CloudDeformationParams, val: number) => {
      setActivePreset(null);
      setParams((prev) => ({ ...prev, [key]: val }));
    },
    []
  );

  const handleChangeMotion = useCallback(
    (key: keyof CloudMotionConfig, val: number) => {
      setMotion((prev) => ({ ...prev, [key]: val }));
    },
    []
  );

  const handleChangeTrails = useCallback((patch: Partial<CloudTrailConfig>) => {
    setTrails((prev) => ({ ...prev, ...patch }));
  }, []);

  const handleSelectPreset = useCallback((preset: CloudPresetName) => {
    setActivePreset(preset);
    const patch = PRESETS[preset];
    if (patch) {
      setParams({
        ...DEFAULT_DEFORMATION,
        ...patch,
      });
    }
  }, []);

  // --- Production Behaviour Controller Triggers -----------------------------

  const handleTriggerBehaviour = useCallback((id: BehaviourId) => {
    setActiveBehaviour(id);
    controller.current.trigger(id, BC_CONFIG);
  }, []);

  const handleTriggerNeutral = useCallback(() => {
    setActiveBehaviour("HOME / REST");
    setActivePreset("NEUTRAL");
    setParams(DEFAULT_DEFORMATION);
    controller.current.trigger("REST", BC_CONFIG);
  }, []);

  const handleTriggerBlink = useCallback(() => {
    setActiveBehaviour("NORMAL_BLINK");
    controller.current.trigger("NORMAL_BLINK", BC_CONFIG);
  }, []);

  const handleTriggerGlance = useCallback((dir: "left" | "right") => {
    const id: BehaviourId = dir === "left" ? "GLANCE_LEFT" : "GLANCE_RIGHT";
    setActiveBehaviour(id);
    controller.current.trigger(id, BC_CONFIG);
  }, []);

  const handleTriggerCurious = useCallback(() => {
    setActiveBehaviour("CURIOUS_TILT_LEFT");
    controller.current.trigger("CURIOUS_TILT_LEFT", BC_CONFIG);
    setParams((prev) => ({ ...prev, lean: -12, stretch: 0.12 }));
    setTimeout(() => {
      setParams((prev) => ({ ...prev, lean: 0, stretch: 0 }));
    }, 1800);
  }, []);

  const handleTriggerHappy = useCallback(() => {
    setActiveBehaviour("CURIOUS_WIDE");
    controller.current.trigger("CURIOUS_WIDE", BC_CONFIG);
    setParams((prev) => ({ ...prev, squash: 0.22, puff: 0.15 }));
    setTimeout(() => {
      setParams((prev) => ({ ...prev, squash: -0.1, stretch: 0.18 }));
      setTimeout(() => {
        setParams((prev) => ({ ...prev, squash: 0, stretch: 0, puff: 0 }));
      }, 350);
    }, 280);
  }, []);

  const handleTriggerSleepy = useCallback(() => {
    setActiveBehaviour("SOFT_SQUINT");
    controller.current.trigger("SOFT_SQUINT", BC_CONFIG);
    setParams((prev) => ({ ...prev, squash: 0.18, puff: 0.2 }));
    setTimeout(() => {
      setParams((prev) => ({ ...prev, squash: 0, puff: 0 }));
    }, 2500);
  }, []);

  const handleTriggerSettle = useCallback(() => {
    setActiveBehaviour("BODY_SETTLE");
    controller.current.trigger("BODY_SETTLE", BC_CONFIG);
    setParams((prev) => ({ ...prev, squash: 0.38 }));
    setTimeout(() => {
      setParams((prev) => ({ ...prev, squash: -0.15, stretch: 0.2 }));
      setTimeout(() => {
        setParams((prev) => ({ ...prev, squash: 0, stretch: 0 }));
      }, 300);
    }, 250);
  }, []);

  const handleResetPose = useCallback(() => {
    controller.current.reset();
    ambient.current.reset();
    physics.current.reset();
    setActiveBehaviour("HOME / REST");
    setActivePreset("NEUTRAL");
    setParams(DEFAULT_DEFORMATION);
    setMotion(DEFAULT_MOTION_CONFIG);
  }, []);

  const handleReturnToCentre = useCallback(() => {
    setDragState({ isDragging: false, offsetX: 0, offsetY: 0, speed: 0 });
  }, []);

  const handleClearWisps = useCallback(() => {
    setTrails((prev) => ({ ...prev, enabled: false }));
    setTimeout(() => {
      setTrails((prev) => ({ ...prev, enabled: true }));
    }, 50);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const urlParams = new URLSearchParams(window.location.search);

    const v = urlParams.get("view") as ViewMode | null;
    if (v === "cloud" || v === "production" || v === "compare") {
      setViewMode(v);
    }

    const c = urlParams.get("colour") as BlobColour | null;
    if (c === "teal" || c === "purple" || c === "yellow" || c === "green") {
      setBlobColour(c);
    }

    const faceParam = urlParams.get("face");
    if (faceParam === "false" || faceParam === "off" || faceParam === "0") {
      setShowFace(false);
    }

    const emote = urlParams.get("emote");
    if (emote === "curious") handleTriggerCurious();
    else if (emote === "happy") handleTriggerHappy();
    else if (emote === "sleepy") handleTriggerSleepy();
    else if (emote === "settle") handleTriggerSettle();
    else if (emote === "blink") handleTriggerBlink();
    else if (emote === "glance_left") handleTriggerGlance("left");
    else if (emote === "glance_right") handleTriggerGlance("right");

    const drag = urlParams.get("drag");
    if (drag === "true" || drag === "1") {
      setDragState({ isDragging: true, offsetX: 55, offsetY: -35, speed: 125 });
      setParams((prev) => ({ ...prev, x: 55, y: -35, stretch: 0.18, lean: 14 }));
    }

    const p = urlParams.get("preset") as CloudPresetName | null;
    if (p && PRESETS[p]) {
      handleSelectPreset(p);
    }
  }, [
    handleTriggerCurious,
    handleTriggerHappy,
    handleTriggerSleepy,
    handleTriggerSettle,
    handleTriggerBlink,
    handleTriggerGlance,
    handleSelectPreset,
  ]);

  // --- Animation loop to drive production rig poses --------------------------

  useEffect(() => {
    let last = performance.now();
    let animId: number;

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
    };

    const loop = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;

      if (idleEnabled) {
        controller.current.update(dt, BC_CONFIG);
      }
      const d = controller.current.pose();

      const amb = idleEnabled
        ? ambient.current.update(dt, DEFAULT_IDLE, d.blobY)
        : { x: 0, y: 0, rotation: 0, breath: 0, squashX: 0, squashY: 0 };

      jellyTarget.x = amb.x + d.blobX;
      jellyTarget.y = amb.y + d.blobY;
      jellyTarget.rotation = amb.rotation + d.blobRotation;
      jellyTarget.scaleX = d.blobScaleX + amb.squashX;
      jellyTarget.scaleY = d.blobScaleY + amb.squashY;
      jellyTarget.bodyX = d.bodyX;
      jellyTarget.bodyY = d.bodyY;
      jellyTarget.bodyRotation = d.bodyRotation;
      jellyTarget.bodyScaleX = d.bodyScaleX;
      jellyTarget.bodyScaleY = d.bodyScaleY;
      jellyTarget.bodySkewX = d.bodySkewX;
      jellyTarget.bodySkewY = d.bodySkewY;
      jellyTarget.bodyOriginX = d.bodyOriginX;
      jellyTarget.bodyOriginY = 0.82;

      const physical = physics.current.update(dt, jellyTarget);

      const rigOutput = applyCalibration(
        {
          blob: {
            x: physical.x,
            y: physical.y,
            scale: 1 + amb.breath,
            scaleX: 1,
            scaleY: 1,
            rotation: physical.rotation,
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
            scaleX: 1 + physical.scaleX,
            scaleY: 1 + physical.scaleY,
          },
          leftEye: {
            ...NEUTRAL_ELEMENT,
            x: d.eyeX + d.leftEyeX,
            y: d.eyeY + d.leftEyeY,
            eyeOpen: d.eyeLid * d.leftEyeTension,
            eyeSocketScaleX: 1 + d.leftEyeScaleX,
            eyeSocketScaleY: 1 + d.leftEyeScaleY,
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
        DEFAULT_FACE_CALIBRATION
      );

      setCurrentRig(rigOutput);

      // Status check
      const st = controller.current.status();
      if (st && st.id !== "REST") {
        setActiveBehaviour(st.id);
      }

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [idleEnabled]);

  const targetSize = 466;
  const displaySize = Math.round(targetSize * zoom);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-8">
      {/* Header & Navigation */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Link
              href="/"
              className="font-mono text-xs text-cyan-400/80 transition hover:text-cyan-300"
            >
              &larr; Return to Simulator
            </Link>
            <span className="text-white/20">/</span>
            <span className="font-mono text-xs text-white/50">Experimental</span>
          </div>
          <h1 className="mt-1 font-mono text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Cloud Blob Body <span className="text-cyan-400">R&amp;D</span>
          </h1>
          <p className="mt-1 text-xs text-neutral-400">
            Alternate volumetric character body with 1:1 production face rig &amp; emote parity
          </p>
        </div>

        {/* View Controls */}
        <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
          <div className="flex items-center rounded-lg border border-white/10 bg-white/5 p-0.5">
            <button
              type="button"
              onClick={() => setZoom(0.75)}
              className={`rounded px-2 py-1 transition ${
                zoom === 0.75 ? "bg-white/20 text-white font-semibold" : "text-white/50 hover:text-white"
              }`}
            >
              75%
            </button>
            <button
              type="button"
              onClick={() => setZoom(1.0)}
              className={`rounded px-2 py-1 transition ${
                zoom === 1.0 ? "bg-white/20 text-white font-semibold" : "text-white/50 hover:text-white"
              }`}
            >
              100% (466px)
            </button>
            <button
              type="button"
              onClick={() => setZoom(1.2)}
              className={`rounded px-2 py-1 transition ${
                zoom === 1.2 ? "bg-white/20 text-white font-semibold" : "text-white/50 hover:text-white"
              }`}
            >
              120%
            </button>
          </div>

          <button
            type="button"
            onClick={() => setDisplayMode(displayMode === "dark" ? "warm" : "dark")}
            className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-white/60 transition hover:bg-white/10 hover:text-white"
          >
            {displayMode === "dark" ? "AMOLED Dark" : "Warm Gray"}
          </button>
        </div>
      </header>

      {/* Simulator Bezel Workspace */}
      <section className="flex flex-col items-center justify-center gap-6">
        <div className="flex flex-wrap items-center justify-center gap-8">
          {/* Main Cloud Body View */}
          {(viewMode === "cloud" || viewMode === "compare") && (
            <div className="flex flex-col items-center gap-3">
              <span className="font-mono text-[11px] uppercase tracking-wider text-cyan-400 font-semibold">
                {viewMode === "compare" ? "1. Cloud Mist Body (Alternate)" : "Cloud Blob Character"}
              </span>
              <div
                className="relative flex items-center justify-center rounded-full p-4 shadow-2xl transition-all duration-300"
                style={{
                  background:
                    "radial-gradient(circle at 35% 35%, #2a2c35 0%, #16171d 65%, #0d0e12 100%)",
                  boxShadow:
                    "0 25px 60px -15px rgba(0, 0, 0, 0.9), inset 0 2px 4px rgba(255, 255, 255, 0.15), inset 0 -4px 8px rgba(0, 0, 0, 0.8)",
                  width: displaySize + 32,
                  height: displaySize + 32,
                }}
              >
                {/* 466 Round Display Canvas */}
                <div
                  className="relative overflow-hidden rounded-full shadow-inner"
                  style={{
                    width: displaySize,
                    height: displaySize,
                    background: displayMode === "dark" ? "#000000" : "#cfc3b4",
                  }}
                >
                  <div
                    style={{
                      transform: `scale(${zoom})`,
                      transformOrigin: "top left",
                      width: targetSize,
                      height: targetSize,
                    }}
                  >
                    <CloudBlobBody
                      size={targetSize}
                      renderScale={1}
                      rig={currentRig}
                      colour={blobColour}
                      params={params}
                      motionConfig={motion}
                      trailConfig={trails}
                      showFace={showFace}
                      dragEnabled={dragEnabled}
                      onDragChange={setDragState}
                      onTelemetry={handleTelemetry}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Production Blob Comparison View */}
          {(viewMode === "production" || viewMode === "compare") && (
            <div className="flex flex-col items-center gap-3">
              <span className="font-mono text-[11px] uppercase tracking-wider text-purple-400 font-semibold">
                {viewMode === "compare" ? "2. Production Blob (Master)" : "Production Blob Character"}
              </span>
              <div
                className="relative flex items-center justify-center rounded-full p-4 shadow-2xl transition-all duration-300"
                style={{
                  background:
                    "radial-gradient(circle at 35% 35%, #2a2c35 0%, #16171d 65%, #0d0e12 100%)",
                  boxShadow:
                    "0 25px 60px -15px rgba(0, 0, 0, 0.9), inset 0 2px 4px rgba(255, 255, 255, 0.15), inset 0 -4px 8px rgba(0, 0, 0, 0.8)",
                  width: displaySize + 32,
                  height: displaySize + 32,
                }}
              >
                <div
                  className="relative overflow-hidden rounded-full shadow-inner"
                  style={{
                    width: displaySize,
                    height: displaySize,
                    background: displayMode === "dark" ? "#000000" : "#cfc3b4",
                  }}
                >
                  <div
                    style={{
                      transform: `scale(${zoom})`,
                      transformOrigin: "top left",
                      width: targetSize,
                      height: targetSize,
                    }}
                  >
                    <BlobCharacter
                      size={targetSize}
                      renderScale={1}
                      rig={currentRig}
                      colour={blobColour}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Drag Interaction Guidance Hint */}
        <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1 font-mono text-[11px] text-white/60">
          <span className="size-2 rounded-full bg-cyan-400 animate-pulse" />
          <span>
            {dragEnabled
              ? "Direct manipulation enabled: Click / touch and drag character inside bezel to feel inertia & jiggle"
              : "Direct manipulation disabled in settings"}
          </span>
        </div>
      </section>

      {/* Developer Controls Panel */}
      <section>
        <CloudBlobControls
          viewMode={viewMode}
          onChangeViewMode={setViewMode}
          blobColour={blobColour}
          onChangeColour={setBlobColour}
          showFace={showFace}
          onToggleFace={setShowFace}
          dragEnabled={dragEnabled}
          onToggleDrag={setDragEnabled}
          idleEnabled={idleEnabled}
          onToggleIdle={setIdleEnabled}
          trails={trails}
          onChangeTrails={handleChangeTrails}
          params={params}
          onChangeParam={handleChangeParam}
          motion={motion}
          onChangeMotion={handleChangeMotion}
          activePreset={activePreset}
          onSelectPreset={handleSelectPreset}
          activeBehaviour={activeBehaviour}
          onTriggerBehaviour={handleTriggerBehaviour}
          onTriggerNeutral={handleTriggerNeutral}
          onTriggerHappy={handleTriggerHappy}
          onTriggerSleepy={handleTriggerSleepy}
          onTriggerCurious={handleTriggerCurious}
          onTriggerSettle={handleTriggerSettle}
          onTriggerBlink={handleTriggerBlink}
          onTriggerGlance={handleTriggerGlance}
          onResetPose={handleResetPose}
          onReturnToCentre={handleReturnToCentre}
          onClearWisps={handleClearWisps}
          dragState={dragState}
          telemetry={{
            fps,
            frameTimeMs,
            activeWisps,
            avgLag,
          }}
        />
      </section>
    </div>
  );
}

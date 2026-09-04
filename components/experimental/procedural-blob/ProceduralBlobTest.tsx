"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import BlobBody, { type BlobBodyDebugOptions } from "./BlobBody";
import BlobControls from "./BlobControls";
import {
  type DeformationParams,
  DEFAULT_DEFORMATION,
} from "./blobShape";
import { type MaterialOptions } from "./blobMaterial";
import {
  type PresetName,
  PRESETS,
  createSpringState,
  stepSpringSimulation,
  setSpringTargets,
  resetSpringState,
} from "./blobPhysics";

export default function ProceduralBlobTest() {
  const [params, setParams] = useState<DeformationParams>(DEFAULT_DEFORMATION);
  const [activePreset, setActivePreset] = useState<PresetName | null>("NEUTRAL");
  const [physicsEnabled, setPhysicsEnabled] = useState(true);
  const [debug, setDebug] = useState<BlobBodyDebugOptions>({
    showSilhouetteGuide: false,
    showControlPoints: false,
    showBoundingBox: false,
    showCenterPoint: false,
    showFaceOverlay: false,
  });
  const [material, setMaterial] = useState<MaterialOptions>({
    showHighlights: true,
    showFolds: true,
    showParticles: true,
    showRim: true,
    rimIntensity: 1,
    coreGlowIntensity: 1,
  });

  // Reference comparison options
  const [refType, setRefType] = useState<"master_crop" | "master_asset">("master_crop");
  const [overlayMode, setOverlayMode] = useState(false);
  const [overlayOpacity, setOverlayOpacity] = useState(0.5);
  const [zoom, setZoom] = useState(1.4);

  // Performance telemetry
  const [fps, setFps] = useState(60);
  const [frameTimeMs, setFrameTimeMs] = useState(0.3);

  // Damped spring physics ref
  const springStateRef = useRef(createSpringState(DEFAULT_DEFORMATION));
  const lastTimeRef = useRef<number | null>(null);
  const frameCountRef = useRef(0);
  const fpsTimerRef = useRef(0);

  // Continuous animation loop for physics & harmonic wobble
  useEffect(() => {
    let animId: number;

    const tick = (now: number) => {
      if (lastTimeRef.current === null) {
        lastTimeRef.current = now;
      }
      const dt = (now - lastTimeRef.current) / 1000;
      lastTimeRef.current = now;

      // FPS calculation
      frameCountRef.current++;
      fpsTimerRef.current += dt;
      if (fpsTimerRef.current >= 0.5) {
        setFps(Math.round(frameCountRef.current / fpsTimerRef.current));
        frameCountRef.current = 0;
        fpsTimerRef.current = 0;
      }

      if (physicsEnabled) {
        const t0 = performance.now();
        const { params: updatedParams } = stepSpringSimulation(
          springStateRef.current,
          dt
        );
        const t1 = performance.now();
        setFrameTimeMs(Number((t1 - t0).toFixed(2)));

        setParams(updatedParams);

        // Auto-decay wobble amount gently if not in continuous wobble mode
        if (
          springStateRef.current.wobbleAmount.target > 0 &&
          activePreset !== "SOFT WOBBLE"
        ) {
          springStateRef.current.wobbleAmount.target = Math.max(
            0,
            springStateRef.current.wobbleAmount.target - dt * 0.4
          );
        }
      }

      animId = requestAnimationFrame(tick);
    };

    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, [physicsEnabled, activePreset]);

  // Handle manual slider changes
  const handleChangeParam = useCallback(
    (key: keyof DeformationParams, val: number) => {
      setActivePreset(null);
      if (physicsEnabled) {
        setSpringTargets(springStateRef.current, { [key]: val });
      } else {
        setParams((prev) => ({ ...prev, [key]: val }));
      }
    },
    [physicsEnabled]
  );

  // Handle preset selection
  const handleSelectPreset = useCallback(
    (name: PresetName) => {
      setActivePreset(name);
      const presetValues = PRESETS[name];

      if (physicsEnabled) {
        if (name === "LAND / SETTLE") {
          // Instant squash impact then spring settle
          resetSpringState(springStateRef.current, {
            ...DEFAULT_DEFORMATION,
            squash: 0.95,
            bottomSag: 16,
            lowerLeftBulge: 20,
            lowerRightBulge: 20,
            centerShiftY: 10,
          });
          setSpringTargets(springStateRef.current, DEFAULT_DEFORMATION);
        } else {
          setSpringTargets(springStateRef.current, presetValues);
        }
      } else {
        setParams((prev) => ({ ...prev, ...presetValues }));
      }
    },
    [physicsEnabled]
  );

  // Reset to default
  const handleReset = useCallback(() => {
    setActivePreset("NEUTRAL");
    if (physicsEnabled) {
      resetSpringState(springStateRef.current, DEFAULT_DEFORMATION);
      setSpringTargets(springStateRef.current, DEFAULT_DEFORMATION);
    }
    setParams(DEFAULT_DEFORMATION);
  }, [physicsEnabled]);

  const handleToggleDebug = useCallback((key: keyof BlobBodyDebugOptions) => {
    setDebug((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const handleToggleMaterial = useCallback((key: keyof MaterialOptions) => {
    setMaterial((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const refSrc =
    refType === "master_crop"
      ? "/blob/master_blob_reference.png"
      : "/blob/rig/body.png";

  const displaySize = Math.round(240 * zoom);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-8">
      {/* Navigation & Header */}
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="inline-flex size-2 rounded-full bg-cyan-400 shadow-[0_0_8px_#22d3ee]" />
            <h1 className="font-mono text-sm font-semibold uppercase tracking-[0.25em] text-white">
              Procedural Blob Body R&amp;D
            </h1>
            <span className="rounded bg-violet-500/20 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-violet-300">
              Isolated Experiment
            </span>
          </div>
          <p className="mt-1 font-mono text-[11px] text-white/50">
            Deformable 10-point cubic Bezier body with 7-layer cosmic jelly material.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-neutral-900/80 px-3 py-1.5 font-mono text-[11px]">
            <span className="text-white/40">FPS:</span>
            <span className="font-medium text-green-400">{fps}</span>
            <span className="text-white/20">|</span>
            <span className="text-white/40">Frame:</span>
            <span className="font-medium text-cyan-400">{frameTimeMs}ms</span>
          </div>

          <Link
            href="/experimental/cloud"
            className="rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider text-cyan-300 transition hover:bg-cyan-500/20 hover:text-white"
          >
            Cloud Blob (466px) &rarr;
          </Link>

          <Link
            href="/"
            className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider text-white/80 transition hover:bg-white/10 hover:text-white"
          >
            &larr; Simulator
          </Link>
        </div>
      </header>

      {/* Side-by-Side Comparison Stage */}
      <section className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-black/60 p-6 backdrop-blur-xl">
        {/* Stage Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-4">
          <div className="flex items-center gap-3 font-mono text-[11px]">
            <span className="text-white/50 uppercase tracking-wider">Reference Source:</span>
            <div className="inline-flex rounded-lg border border-white/10 bg-neutral-900 p-0.5">
              <button
                type="button"
                onClick={() => setRefType("master_crop")}
                className={`rounded-md px-2.5 py-1 text-[10px] uppercase transition ${
                  refType === "master_crop"
                    ? "bg-violet-600 text-white shadow-sm"
                    : "text-white/60 hover:text-white"
                }`}
              >
                Uploaded Master
              </button>
              <button
                type="button"
                onClick={() => setRefType("master_asset")}
                className={`rounded-md px-2.5 py-1 text-[10px] uppercase transition ${
                  refType === "master_asset"
                    ? "bg-violet-600 text-white shadow-sm"
                    : "text-white/60 hover:text-white"
                }`}
              >
                Full Rig Asset
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4 font-mono text-[11px]">
            {/* Overlay comparison mode */}
            <label className="flex cursor-pointer items-center gap-2 text-white/70 hover:text-white">
              <input
                type="checkbox"
                checked={overlayMode}
                onChange={(e) => setOverlayMode(e.target.checked)}
                className="size-3.5 rounded border-white/20 bg-neutral-800 text-cyan-500"
              />
              Ghost Overlay
            </label>

            {overlayMode && (
              <div className="flex items-center gap-2">
                <span className="text-white/40 text-[10px]">Alpha:</span>
                <input
                  type="range"
                  min={0.1}
                  max={0.9}
                  step={0.05}
                  value={overlayOpacity}
                  onChange={(e) => setOverlayOpacity(parseFloat(e.target.value))}
                  className="w-16 accent-cyan-400"
                />
              </div>
            )}

            {/* Zoom scale */}
            <div className="flex items-center gap-2">
              <span className="text-white/40 text-[10px]">Scale:</span>
              {[1, 1.4, 1.8].map((z) => (
                <button
                  key={z}
                  type="button"
                  onClick={() => setZoom(z)}
                  className={`rounded px-1.5 py-0.5 text-[10px] ${
                    zoom === z ? "bg-white/20 text-white" : "text-white/40 hover:text-white"
                  }`}
                >
                  {z}x
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Viewport Comparison Grid */}
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
          {/* LEFT: Procedural Blob */}
          <div className="flex flex-col items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-cyan-400" />
              <span className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-white/90">
                Left: Procedural Blob (Code)
              </span>
            </div>

            {/* Circular LCD Simulator Bezel Frame */}
            <div
              className="relative flex items-center justify-center rounded-full border-4 border-neutral-800 bg-neutral-950 p-2 shadow-2xl shadow-black/80"
              style={{ width: displaySize + 32, height: displaySize + 32 }}
            >
              {/* LCD Screen boundary */}
              <div
                className="relative overflow-hidden rounded-full bg-black shadow-inner shadow-black"
                style={{ width: displaySize, height: displaySize }}
              >
                {/* Optional Master reference ghosting underneath */}
                {overlayMode && (
                  <div
                    className="pointer-events-none absolute inset-0 flex items-center justify-center mix-blend-screen"
                    style={{ opacity: 1 - overlayOpacity }}
                  >
                    <Image
                      src={refSrc}
                      alt="Ghost Reference"
                      width={displaySize * 0.9}
                      height={displaySize * 0.9}
                      className="object-contain"
                      unoptimized
                    />
                  </div>
                )}

                {/* Procedural Canvas */}
                <div
                  className="absolute inset-0 flex items-center justify-center"
                  style={{ opacity: overlayMode ? overlayOpacity : 1 }}
                >
                  <BlobBody
                    size={240}
                    renderScale={zoom}
                    params={params}
                    materialOptions={material}
                    debug={debug}
                    className="transition-transform"
                  />
                </div>
              </div>
            </div>

            <span className="font-mono text-[10px] text-white/40 uppercase tracking-widest">
              240x240 Native Canvas 2D Pipeline
            </span>
          </div>

          {/* RIGHT: Master Blob Reference */}
          <div className="flex flex-col items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-violet-400" />
              <span className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-white/90">
                Right: Master Blob Reference
              </span>
            </div>

            {/* Circular Frame matching procedural side */}
            <div
              className="relative flex items-center justify-center rounded-full border-4 border-neutral-800 bg-neutral-950 p-2 shadow-2xl shadow-black/80"
              style={{ width: displaySize + 32, height: displaySize + 32 }}
            >
              <div
                className="relative flex items-center justify-center overflow-hidden rounded-full bg-black"
                style={{ width: displaySize, height: displaySize }}
              >
                <Image
                  src={refSrc}
                  alt="Master Blob Reference"
                  width={displaySize * 0.88}
                  height={displaySize * 0.88}
                  className="object-contain"
                  unoptimized
                  priority
                />

                {/* Crosshair guide on master */}
                {debug.showCenterPoint && (
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                    <div className="h-4 w-[1px] bg-red-500/80" />
                    <div className="absolute h-[1px] w-4 bg-red-500/80" />
                  </div>
                )}
              </div>
            </div>

            <span className="font-mono text-[10px] text-white/40 uppercase tracking-widest">
              {refType === "master_crop" ? "User Attached Reference" : "Artwork Asset Source"}
            </span>
          </div>
        </div>
      </section>

      {/* Dev Controls Panel */}
      <BlobControls
        params={params}
        onChangeParam={handleChangeParam}
        onReset={handleReset}
        onSelectPreset={handleSelectPreset}
        activePreset={activePreset}
        physicsEnabled={physicsEnabled}
        onTogglePhysics={setPhysicsEnabled}
        debug={debug}
        onToggleDebug={handleToggleDebug}
        material={material}
        onToggleMaterial={handleToggleMaterial}
      />
    </div>
  );
}

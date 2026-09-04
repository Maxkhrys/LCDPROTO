"use client";

import { useState } from "react";
import {
  type CloudDeformationParams,
  type CloudMotionConfig,
  type CloudTrailConfig,
  type CloudPresetName,
  type DragInteractionState,
} from "./cloudTypes";
import {
  BLOB_COLOURS,
  type BlobColour,
} from "@/lib/blobRig";
import {
  HOME_EXPRESSION_GROUPS,
  type ExpressionFilter,
} from "@/lib/expressionCatalog";
import type { BehaviourId } from "@/lib/blobBehaviour";

export type ViewMode = "cloud" | "production" | "compare";

interface CloudBlobControlsProps {
  blobColour: BlobColour;
  onChangeColour: (colour: BlobColour) => void;
  showFace: boolean;
  onToggleFace: (show: boolean) => void;
  dragEnabled: boolean;
  onToggleDrag: (enabled: boolean) => void;
  idleEnabled: boolean;
  onToggleIdle: (enabled: boolean) => void;
  trails: CloudTrailConfig;
  onChangeTrails: (patch: Partial<CloudTrailConfig>) => void;
  params: CloudDeformationParams;
  onChangeParam: (key: keyof CloudDeformationParams, val: number | boolean) => void;
  motion: CloudMotionConfig;
  onChangeMotion: (key: keyof CloudMotionConfig, val: number) => void;
  activePreset: CloudPresetName | null;
  onSelectPreset: (preset: CloudPresetName) => void;
  activeBehaviour: BehaviourId | "HOME / REST";
  onTriggerBehaviour: (id: BehaviourId) => void;
  onTriggerNeutral: () => void;
  onTriggerHappy: () => void;
  onTriggerSleepy: () => void;
  onTriggerCurious: () => void;
  onTriggerSettle: () => void;
  onTriggerBlink: () => void;
  onTriggerGlance: (dir: "left" | "right") => void;
  onResetPose: () => void;
  onReturnToCentre: () => void;
  onClearWisps: () => void;
  dragState: DragInteractionState;
  telemetry: {
    fps: number;
    frameTimeMs: number;
    activeWisps: number;
    avgLag: number;
  };
}

export default function CloudBlobControls({
  blobColour,
  onChangeColour,
  showFace,
  onToggleFace,
  dragEnabled,
  onToggleDrag,
  idleEnabled,
  onToggleIdle,
  trails,
  onChangeTrails,
  params,
  onChangeParam,
  motion,
  onChangeMotion,
  activePreset,
  onSelectPreset,
  activeBehaviour,
  onTriggerBehaviour,
  onTriggerNeutral,
  onTriggerHappy,
  onTriggerSleepy,
  onTriggerCurious,
  onTriggerSettle,
  onTriggerBlink,
  onTriggerGlance,
  onResetPose,
  onReturnToCentre,
  onClearWisps,
  dragState,
  telemetry,
}: CloudBlobControlsProps) {
  const [expressionFilter, setExpressionFilter] = useState<ExpressionFilter>("ALL");
  const [activeTab, setActiveTab] = useState<"expressions" | "physics" | "deformation">("expressions");

  const presets: CloudPresetName[] = [
    "NEUTRAL",
    "SQUASH",
    "STRETCH",
    "LEAN LEFT",
    "LEAN RIGHT",
    "MIST TRAIL",
    "SETTLE",
    "SLEEPY FLATTEN",
    "EXCITED PUFF",
  ];

  return (
    <div className="flex w-full flex-col gap-6 rounded-2xl border border-white/10 bg-neutral-900/90 p-6 backdrop-blur-xl">
      {/* 1. Telemetry & Debug Status Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-white/10 bg-black/60 px-4 py-3 font-mono text-[11px]">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="text-white/40 uppercase tracking-wider">Active Expression:</span>
            <span className="font-semibold text-cyan-400">{activeBehaviour}</span>
          </div>
          <span className="text-white/20">|</span>
          <div className="flex items-center gap-1.5">
            <span className="text-white/40 uppercase tracking-wider">Dragging:</span>
            <span className={dragState.isDragging ? "font-bold text-amber-400" : "text-white/60"}>
              {dragState.isDragging ? `TRUE (${dragState.speed} px/s)` : "FALSE"}
            </span>
          </div>
          <span className="text-white/20">|</span>
          <div className="flex items-center gap-1.5">
            <span className="text-white/40 uppercase tracking-wider">Visible Wisps:</span>
            <span className="font-semibold text-purple-400">{telemetry.activeWisps} / 24</span>
          </div>
          <span className="text-white/20">|</span>
          <div className="flex items-center gap-1.5">
            <span className="text-white/40 uppercase tracking-wider">Avg Lobe Lag:</span>
            <span className="font-semibold text-amber-400">{telemetry.avgLag}ms</span>
          </div>
          <span className="text-white/20">|</span>
          <div className="flex items-center gap-1.5">
            <span className="text-white/40 uppercase tracking-wider">Face Rig:</span>
            <span className="font-semibold text-emerald-400">Production Face Rig (100% Crisp)</span>
          </div>
        </div>

        <div className="flex items-center gap-2 font-mono">
          <span className="text-white/40">Engine:</span>
          <span className="font-semibold text-green-400">{telemetry.fps} FPS</span>
          <span className="text-white/30">({telemetry.frameTimeMs}ms)</span>
        </div>
      </div>

      {/* 2. Primary Modes, Toggles & Colour Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-5">
        {/* Character Badge & Fluffiness Quick-Selector */}
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-500/40 bg-cyan-500/10 px-3 py-1 font-mono text-[11px] font-semibold text-cyan-300 shadow-sm">
            <span className="size-2 rounded-full bg-cyan-400 animate-pulse" />
            LIVING CLOUD BLOB
          </span>
          <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 p-0.5">
            {[
              { label: "Soft", val: 0.7 },
              { label: "Fluffy", val: 1.25 },
              { label: "Ultra Fluffy", val: 1.85 },
            ].map((f) => {
              const active = Math.abs(params.fluffiness - f.val) < 0.25;
              return (
                <button
                  key={f.label}
                  type="button"
                  onClick={() => onChangeParam("fluffiness", f.val)}
                  className={`rounded px-2.5 py-1 font-mono text-[10px] uppercase transition ${
                    active
                      ? "bg-cyan-400 text-black font-semibold shadow-sm"
                      : "text-white/60 hover:text-white"
                  }`}
                >
                  {f.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Colour Palette Selection */}
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] uppercase tracking-wider text-white/50">Colour:</span>
          <div className="flex gap-1.5">
            {BLOB_COLOURS.map((c) => {
              const active = blobColour === c.id;
              const colourDots: Record<BlobColour, string> = {
                teal: "bg-teal-400",
                purple: "bg-purple-400",
                yellow: "bg-amber-400",
                green: "bg-emerald-400",
                blue: "bg-blue-400",
                red: "bg-red-400",
              };
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => onChangeColour(c.id)}
                  className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 font-mono text-[11px] capitalize transition ${
                    active
                      ? "border-white/40 bg-white/15 text-white font-medium shadow-sm"
                      : "border-white/10 bg-white/5 text-white/60 hover:border-white/20 hover:text-white"
                  }`}
                >
                  <span className={`size-2 rounded-full ${colourDots[c.id]}`} />
                  <span>{c.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Global Toggles */}
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-1.5 cursor-pointer font-mono text-[11px] text-white/70 hover:text-white select-none">
            <input
              type="checkbox"
              checked={showFace}
              onChange={(e) => onToggleFace(e.target.checked)}
              className="size-3.5 rounded border-white/20 bg-white/5 text-cyan-500 focus:ring-0"
            />
            <span>Face ON</span>
          </label>

          <label className="flex items-center gap-1.5 cursor-pointer font-mono text-[11px] text-white/70 hover:text-white select-none">
            <input
              type="checkbox"
              checked={params.cloudBrows}
              onChange={(e) => onChangeParam("cloudBrows", e.target.checked)}
              className="size-3.5 rounded border-white/20 bg-white/5 text-cyan-500 focus:ring-0"
            />
            <span className={params.cloudBrows ? "text-cyan-300 font-medium" : ""}>Brows ON</span>
          </label>

          <label className="flex items-center gap-1.5 cursor-pointer font-mono text-[11px] text-white/70 hover:text-white select-none">
            <input
              type="checkbox"
              checked={params.cheekBlush > 0.05}
              onChange={(e) => onChangeParam("cheekBlush", e.target.checked ? 0.85 : 0)}
              className="size-3.5 rounded border-white/20 bg-white/5 text-pink-500 focus:ring-0"
            />
            <span className={params.cheekBlush > 0.05 ? "text-pink-400 font-medium" : ""}>Blush ON</span>
          </label>

          <label className="flex items-center gap-1.5 cursor-pointer font-mono text-[11px] text-white/70 hover:text-white select-none">
            <input
              type="checkbox"
              checked={dragEnabled}
              onChange={(e) => onToggleDrag(e.target.checked)}
              className="size-3.5 rounded border-white/20 bg-white/5 text-cyan-500 focus:ring-0"
            />
            <span className={dragEnabled ? "text-amber-400 font-medium" : ""}>Direct Drag ON</span>
          </label>

          <label className="flex items-center gap-1.5 cursor-pointer font-mono text-[11px] text-white/70 hover:text-white select-none">
            <input
              type="checkbox"
              checked={idleEnabled}
              onChange={(e) => onToggleIdle(e.target.checked)}
              className="size-3.5 rounded border-white/20 bg-white/5 text-cyan-500 focus:ring-0"
            />
            <span>Idle ON</span>
          </label>

          <label className="flex items-center gap-1.5 cursor-pointer font-mono text-[11px] text-white/70 hover:text-white select-none">
            <input
              type="checkbox"
              checked={trails.enabled}
              onChange={(e) => onChangeTrails({ enabled: e.target.checked })}
              className="size-3.5 rounded border-white/20 bg-white/5 text-cyan-500 focus:ring-0"
            />
            <span>Trails ON</span>
          </label>
        </div>
      </div>

      {/* 3. Primary Emotional / State Triggers */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-white/70">
            <span className="size-1.5 rounded-full bg-cyan-400" />
            <span>Primary Emote Triggers (Real Production Rig)</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onReturnToCentre}
              className="rounded-md border border-white/10 bg-white/5 px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-white/60 transition hover:bg-white/10 hover:text-white"
            >
              Return Centre
            </button>
            <button
              type="button"
              onClick={onClearWisps}
              className="rounded-md border border-white/10 bg-white/5 px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-white/60 transition hover:bg-white/10 hover:text-white"
            >
              Clear Wisps
            </button>
            <button
              type="button"
              onClick={onResetPose}
              className="rounded-md border border-white/10 bg-white/5 px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-white/60 transition hover:bg-white/10 hover:text-white"
            >
              Reset Pose
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
          <button
            type="button"
            onClick={onTriggerNeutral}
            className="flex flex-col items-center justify-center rounded-xl border border-white/10 bg-white/5 p-2.5 text-center transition hover:border-cyan-400 hover:bg-cyan-500/15"
          >
            <span className="font-mono text-xs font-semibold text-white">Neutral / Home</span>
            <span className="mt-0.5 font-mono text-[9px] text-white/40">relaxed gaze</span>
          </button>

          <button
            type="button"
            onClick={onTriggerBlink}
            className="flex flex-col items-center justify-center rounded-xl border border-white/10 bg-white/5 p-2.5 text-center transition hover:border-cyan-400 hover:bg-cyan-500/15"
          >
            <span className="font-mono text-xs font-semibold text-white">Blink</span>
            <span className="mt-0.5 font-mono text-[9px] text-white/40">natural closure</span>
          </button>

          <button
            type="button"
            onClick={() => onTriggerGlance("left")}
            className="flex flex-col items-center justify-center rounded-xl border border-white/10 bg-white/5 p-2.5 text-center transition hover:border-cyan-400 hover:bg-cyan-500/15"
          >
            <span className="font-mono text-xs font-semibold text-white">Glance Left</span>
            <span className="mt-0.5 font-mono text-[9px] text-white/40">eyes lead</span>
          </button>

          <button
            type="button"
            onClick={() => onTriggerGlance("right")}
            className="flex flex-col items-center justify-center rounded-xl border border-white/10 bg-white/5 p-2.5 text-center transition hover:border-cyan-400 hover:bg-cyan-500/15"
          >
            <span className="font-mono text-xs font-semibold text-white">Glance Right</span>
            <span className="mt-0.5 font-mono text-[9px] text-white/40">eyes lead</span>
          </button>

          <button
            type="button"
            onClick={onTriggerCurious}
            className="flex flex-col items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/10 p-2.5 text-center transition hover:border-amber-400 hover:bg-amber-500/20"
          >
            <span className="font-mono text-xs font-semibold text-amber-300">Curious / Sensed</span>
            <span className="mt-0.5 font-mono text-[9px] text-amber-200/50">tilt + alert look</span>
          </button>

          <button
            type="button"
            onClick={onTriggerHappy}
            className="flex flex-col items-center justify-center rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-2.5 text-center transition hover:border-emerald-400 hover:bg-emerald-500/20"
          >
            <span className="font-mono text-xs font-semibold text-emerald-300">Happy / Excited</span>
            <span className="mt-0.5 font-mono text-[9px] text-emerald-200/50">smile + bounce</span>
          </button>

          <button
            type="button"
            onClick={onTriggerSleepy}
            className="flex flex-col items-center justify-center rounded-xl border border-purple-500/30 bg-purple-500/10 p-2.5 text-center transition hover:border-purple-400 hover:bg-purple-500/20"
          >
            <span className="font-mono text-xs font-semibold text-purple-300">Sleepy / Relaxed</span>
            <span className="mt-0.5 font-mono text-[9px] text-purple-200/50">squint + slow breath</span>
          </button>

          <button
            type="button"
            onClick={onTriggerSettle}
            className="flex flex-col items-center justify-center rounded-xl border border-cyan-500/30 bg-cyan-500/10 p-2.5 text-center transition hover:border-cyan-400 hover:bg-cyan-500/20"
          >
            <span className="font-mono text-xs font-semibold text-cyan-300">Squish &amp; Settle</span>
            <span className="mt-0.5 font-mono text-[9px] text-cyan-200/50">drop + recover</span>
          </button>
        </div>
      </div>

      {/* 4. Tab Navigation for Detailed Controls */}
      <div className="flex border-b border-white/10">
        <button
          type="button"
          onClick={() => setActiveTab("expressions")}
          className={`border-b-2 px-4 py-2 font-mono text-xs uppercase tracking-wider transition ${
            activeTab === "expressions"
              ? "border-cyan-400 text-cyan-300 font-semibold"
              : "border-transparent text-white/50 hover:text-white"
          }`}
        >
          Full Expression Catalog (27 Authored)
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("physics")}
          className={`border-b-2 px-4 py-2 font-mono text-xs uppercase tracking-wider transition ${
            activeTab === "physics"
              ? "border-cyan-400 text-cyan-300 font-semibold"
              : "border-transparent text-white/50 hover:text-white"
          }`}
        >
          Physics &amp; Lobe Lag Dynamics
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("deformation")}
          className={`border-b-2 px-4 py-2 font-mono text-xs uppercase tracking-wider transition ${
            activeTab === "deformation"
              ? "border-cyan-400 text-cyan-300 font-semibold"
              : "border-transparent text-white/50 hover:text-white"
          }`}
        >
          Deformation &amp; Face Depth
        </button>
      </div>

      {/* Tab Content: 1. Full Expression Catalog */}
      {activeTab === "expressions" && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] uppercase text-white/40">Category Filter:</span>
            {(["ALL", "Gaze", "Lids", "Body", "Mouth"] as ExpressionFilter[]).map((filter) => (
              <button
                key={filter}
                type="button"
                onClick={() => setExpressionFilter(filter)}
                className={`rounded-md px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wider transition ${
                  expressionFilter === filter
                    ? "bg-cyan-500 text-black font-semibold"
                    : "bg-white/5 text-white/60 hover:bg-white/10 hover:text-white"
                }`}
              >
                {filter}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
            {HOME_EXPRESSION_GROUPS.filter(
              (group) => expressionFilter === "ALL" || group.id === expressionFilter
            ).flatMap((group) =>
              group.entries.map((entry) => {
                const active = activeBehaviour === entry.id;
                return (
                  <button
                    key={entry.id}
                    type="button"
                    onClick={() => onTriggerBehaviour(entry.id)}
                    className={`flex flex-col items-start rounded-lg border p-2 text-left transition ${
                      active
                        ? "border-cyan-400 bg-cyan-500/20 text-white"
                        : "border-white/10 bg-white/5 text-white/70 hover:border-white/20 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    <span className="font-mono text-[11px] font-medium">{entry.label}</span>
                    <span className="font-mono text-[9px] text-white/40">{entry.hint}</span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Tab Content: 2. Physics & Lobe Lag Dynamics */}
      {activeTab === "physics" && (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          <div className="flex flex-col gap-2">
            <div className="flex justify-between font-mono text-xs">
              <span className="text-white/70">Spring Stiffness</span>
              <span className="text-cyan-400 font-semibold">{motion.springStiffness}</span>
            </div>
            <input
              type="range"
              min={50}
              max={300}
              step={5}
              value={motion.springStiffness}
              onChange={(e) => onChangeMotion("springStiffness", parseFloat(e.target.value))}
              className="accent-cyan-400"
            />
            <span className="font-mono text-[9px] text-white/30">Higher = snappier return to shape</span>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex justify-between font-mono text-xs">
              <span className="text-white/70">Spring Damping</span>
              <span className="text-cyan-400 font-semibold">{motion.springDamping}</span>
            </div>
            <input
              type="range"
              min={5}
              max={30}
              step={0.5}
              value={motion.springDamping}
              onChange={(e) => onChangeMotion("springDamping", parseFloat(e.target.value))}
              className="accent-cyan-400"
            />
            <span className="font-mono text-[9px] text-white/30">Controls jiggle duration on release</span>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex justify-between font-mono text-xs">
              <span className="text-white/70">Lobe Lag Hierarchy</span>
              <span className="text-cyan-400 font-semibold">{motion.lobeLag.toFixed(2)}x</span>
            </div>
            <input
              type="range"
              min={0}
              max={2.0}
              step={0.05}
              value={motion.lobeLag}
              onChange={(e) => onChangeMotion("lobeLag", parseFloat(e.target.value))}
              className="accent-cyan-400"
            />
            <span className="font-mono text-[9px] text-white/30">Cheeks &amp; base drag behind core</span>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex justify-between font-mono text-xs">
              <span className="text-white/70">Wisp Amount</span>
              <span className="text-purple-400 font-semibold">{trails.spawnRate.toFixed(2)}x</span>
            </div>
            <input
              type="range"
              min={0}
              max={2.5}
              step={0.1}
              value={trails.spawnRate}
              onChange={(e) => onChangeTrails({ spawnRate: parseFloat(e.target.value) })}
              className="accent-purple-400"
            />
            <span className="font-mono text-[9px] text-white/30">Shed on fast motion &amp; rebound</span>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex justify-between font-mono text-xs">
              <span className="text-white/70">Wisp Drift Lift</span>
              <span className="text-purple-400 font-semibold">{trails.driftAmount.toFixed(2)}x</span>
            </div>
            <input
              type="range"
              min={0}
              max={2.0}
              step={0.1}
              value={trails.driftAmount}
              onChange={(e) => onChangeTrails({ driftAmount: parseFloat(e.target.value) })}
              className="accent-purple-400"
            />
            <span className="font-mono text-[9px] text-white/30">Buoyancy upward drift</span>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex justify-between font-mono text-xs">
              <span className="text-white/70">Float &amp; Drift Pace</span>
              <span className="text-cyan-400 font-semibold">{motion.floatAmount.toFixed(1)}px</span>
            </div>
            <input
              type="range"
              min={0}
              max={10}
              step={0.5}
              value={motion.floatAmount}
              onChange={(e) => onChangeMotion("floatAmount", parseFloat(e.target.value))}
              className="accent-cyan-400"
            />
            <span className="font-mono text-[9px] text-white/30">Natural floating levitation</span>
          </div>
        </div>
      )}

      {/* Tab Content: 3. Deformation & Face Embed Depth */}
      {activeTab === "deformation" && (
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
            <div className="flex flex-col gap-2">
              <div className="flex justify-between font-mono text-xs">
                <span className="text-white/70">Squash</span>
                <span className="text-cyan-400 font-semibold">{params.squash.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min={-0.4}
                max={0.8}
                step={0.02}
                value={params.squash}
                onChange={(e) => onChangeParam("squash", parseFloat(e.target.value))}
                className="accent-cyan-400"
              />
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex justify-between font-mono text-xs">
                <span className="text-white/70">Stretch</span>
                <span className="text-cyan-400 font-semibold">{params.stretch.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min={-0.4}
                max={0.8}
                step={0.02}
                value={params.stretch}
                onChange={(e) => onChangeParam("stretch", parseFloat(e.target.value))}
                className="accent-cyan-400"
              />
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex justify-between font-mono text-xs">
                <span className="text-white/70">Lean</span>
                <span className="text-cyan-400 font-semibold">{params.lean.toFixed(1)}&deg;</span>
              </div>
              <input
                type="range"
                min={-40}
                max={40}
                step={1}
                value={params.lean}
                onChange={(e) => onChangeParam("lean", parseFloat(e.target.value))}
                className="accent-cyan-400"
              />
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex justify-between font-mono text-xs">
                <span className="text-white/70">Puffiness</span>
                <span className="text-cyan-400 font-semibold">{params.puff.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min={0}
                max={1.0}
                step={0.05}
                value={params.puff}
                onChange={(e) => onChangeParam("puff", parseFloat(e.target.value))}
                className="accent-cyan-400"
              />
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex justify-between font-mono text-xs">
                <span className="text-white/70">Fluffiness (Cumulus Billows)</span>
                <span className="text-cyan-300 font-semibold">{params.fluffiness.toFixed(2)}x</span>
              </div>
              <input
                type="range"
                min={0}
                max={2.0}
                step={0.05}
                value={params.fluffiness}
                onChange={(e) => onChangeParam("fluffiness", parseFloat(e.target.value))}
                className="accent-cyan-400"
              />
              <span className="font-mono text-[9px] text-white/30">Multi-octave billow puff clusters</span>
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex justify-between font-mono text-xs">
                <span className="text-white/70">Sunlight Angle</span>
                <span className="text-amber-300 font-semibold">{params.lightAngle.toFixed(0)}&deg;</span>
              </div>
              <input
                type="range"
                min={-180}
                max={180}
                step={5}
                value={params.lightAngle}
                onChange={(e) => onChangeParam("lightAngle", parseFloat(e.target.value))}
                className="accent-amber-400"
              />
              <span className="font-mono text-[9px] text-white/30">Directional volumetric key lighting</span>
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex justify-between font-mono text-xs">
                <span className="text-white/70">Cheek Blush Warmth</span>
                <span className="text-pink-400 font-semibold">{(params.cheekBlush * 100).toFixed(0)}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={1.0}
                step={0.05}
                value={params.cheekBlush}
                onChange={(e) => onChangeParam("cheekBlush", parseFloat(e.target.value))}
                className="accent-pink-400"
              />
              <span className="font-mono text-[9px] text-white/30">Internal bioluminescent blush radiance</span>
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex justify-between font-mono text-xs">
                <span className="text-white/70">Face Embed Depth</span>
                <span className="text-emerald-400 font-semibold">{params.faceEmbedDepth.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min={0}
                max={0.30}
                step={0.01}
                value={params.faceEmbedDepth}
                onChange={(e) => onChangeParam("faceEmbedDepth", parseFloat(e.target.value))}
                className="accent-emerald-400"
              />
              <span className="font-mono text-[9px] text-white/30">0 = on surface, 0.12 = naturally submerged, 0.30 = deep mist</span>
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex justify-between font-mono text-xs">
                <span className="text-white/70">Sand Floor Bounce</span>
                <span className="text-amber-300 font-semibold">{((params.sandBounce ?? 0.65) * 100).toFixed(0)}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={1.0}
                step={0.05}
                value={params.sandBounce ?? 0.65}
                onChange={(e) => onChangeParam("sandBounce", parseFloat(e.target.value))}
                className="accent-amber-400"
              />
              <span className="font-mono text-[9px] text-white/30">Warm environmental ground reflection</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 border-t border-white/10 pt-4">
            <span className="font-mono text-[10px] uppercase text-white/40">Shape Presets:</span>
            {presets.map((name) => {
              const active = activePreset === name;
              return (
                <button
                  key={name}
                  type="button"
                  onClick={() => onSelectPreset(name)}
                  className={`rounded-lg border px-3 py-1 font-mono text-[10px] uppercase tracking-wider transition ${
                    active
                      ? "border-cyan-400 bg-cyan-500/25 font-semibold text-white"
                      : "border-white/10 bg-white/5 text-white/60 hover:border-white/20 hover:text-white"
                  }`}
                >
                  {name}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { type DeformationParams } from "./blobShape";
import { type MaterialOptions } from "./blobMaterial";
import { type PresetName } from "./blobPhysics";
import { type BlobBodyDebugOptions } from "./BlobBody";

interface BlobControlsProps {
  params: DeformationParams;
  onChangeParam: (key: keyof DeformationParams, value: number) => void;
  onReset: () => void;
  onSelectPreset: (name: PresetName) => void;
  activePreset: PresetName | null;
  physicsEnabled: boolean;
  onTogglePhysics: (enabled: boolean) => void;
  debug: BlobBodyDebugOptions;
  onToggleDebug: (key: keyof BlobBodyDebugOptions) => void;
  material: MaterialOptions;
  onToggleMaterial: (key: keyof MaterialOptions) => void;
}

interface SliderConfig {
  key: keyof DeformationParams;
  label: string;
  min: number;
  max: number;
  step: number;
  unit?: string;
}

const SLIDERS: SliderConfig[] = [
  { key: "squash", label: "Squash", min: 0, max: 1, step: 0.02 },
  { key: "stretch", label: "Stretch", min: 0, max: 1, step: 0.02 },
  { key: "lean", label: "Lean", min: -30, max: 30, step: 1, unit: "px" },
  { key: "leftBulge", label: "Left Bulge", min: -25, max: 25, step: 1, unit: "px" },
  { key: "rightBulge", label: "Right Bulge", min: -25, max: 25, step: 1, unit: "px" },
  { key: "lowerLeftBulge", label: "Lower-L Bulge", min: -25, max: 25, step: 1, unit: "px" },
  { key: "lowerRightBulge", label: "Lower-R Bulge", min: -25, max: 25, step: 1, unit: "px" },
  { key: "topHeight", label: "Top Height", min: -25, max: 25, step: 1, unit: "px" },
  { key: "bottomSag", label: "Bottom Sag", min: -25, max: 25, step: 1, unit: "px" },
  { key: "centerShiftX", label: "Center X", min: -30, max: 30, step: 1, unit: "px" },
  { key: "centerShiftY", label: "Center Y", min: -30, max: 30, step: 1, unit: "px" },
  { key: "wobbleAmount", label: "Wobble", min: 0, max: 1, step: 0.05 },
  { key: "highlightShift", label: "Highlight Shift", min: -20, max: 20, step: 1, unit: "px" },
];

const PRESET_NAMES: PresetName[] = [
  "NEUTRAL",
  "SQUASH",
  "STRETCH",
  "LEAN LEFT",
  "LEAN RIGHT",
  "SOFT WOBBLE",
  "LAND / SETTLE",
];

export default function BlobControls({
  params,
  onChangeParam,
  onReset,
  onSelectPreset,
  activePreset,
  physicsEnabled,
  onTogglePhysics,
  debug,
  onToggleDebug,
  material,
  onToggleMaterial,
}: BlobControlsProps) {
  return (
    <div className="flex flex-col gap-6 rounded-2xl border border-white/10 bg-neutral-900/90 p-5 text-neutral-200 shadow-xl backdrop-blur-md">
      {/* Top Header & Presets */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-violet-400">
            Presets (Restrained Jelly)
          </span>
          <div className="flex items-center gap-2">
            <label className="flex cursor-pointer items-center gap-1.5 text-[11px] font-mono text-white/60 hover:text-white">
              <input
                type="checkbox"
                checked={physicsEnabled}
                onChange={(e) => onTogglePhysics(e.target.checked)}
                className="size-3.5 rounded border-white/20 bg-neutral-800 text-violet-500 focus:ring-0"
              />
              Spring Lag
            </label>
            <button
              type="button"
              onClick={onReset}
              className="rounded-md border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider text-white/70 hover:bg-white/10 hover:text-white"
            >
              Reset
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {PRESET_NAMES.map((name) => {
            const isActive = activePreset === name;
            return (
              <button
                key={name}
                type="button"
                onClick={() => onSelectPreset(name)}
                className={`rounded-lg border px-3 py-2 text-left font-mono text-[10px] uppercase tracking-wider transition-all ${
                  isActive
                    ? "border-violet-500 bg-violet-600/30 text-white shadow-sm shadow-violet-500/20"
                    : "border-white/10 bg-white/5 text-white/75 hover:border-white/20 hover:bg-white/10 hover:text-white"
                }`}
              >
                {name}
              </button>
            );
          })}
        </div>
      </div>

      {/* Sliders Grid */}
      <div>
        <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-neutral-400">
          Deformation Channels (Local & Global)
        </div>
        <div className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
          {SLIDERS.map((s) => {
            const val = params[s.key];
            const isZero = Math.abs(val) < 0.001;
            return (
              <div key={s.key} className="flex flex-col gap-1">
                <div className="flex items-center justify-between text-[11px] font-mono">
                  <span className="text-white/70">{s.label}</span>
                  <span className={isZero ? "text-white/30" : "text-violet-300 font-medium"}>
                    {typeof val === "number" ? val.toFixed(s.step < 0.1 ? 2 : 0) : val}
                    {s.unit ?? ""}
                  </span>
                </div>
                <input
                  type="range"
                  min={s.min}
                  max={s.max}
                  step={s.step}
                  value={val}
                  onChange={(e) => onChangeParam(s.key, parseFloat(e.target.value))}
                  className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-neutral-800 accent-violet-500 hover:accent-violet-400"
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* Toggles Bar: Debug Overlays & Material Layers */}
      <div className="grid grid-cols-1 gap-4 border-t border-white/10 pt-4 sm:grid-cols-2">
        {/* Debug Overlays */}
        <div>
          <span className="mb-2 block text-[10px] font-mono uppercase tracking-[0.2em] text-white/40">
            Debug Overlays
          </span>
          <div className="flex flex-wrap gap-2">
            {[
              { key: "showSilhouetteGuide" as const, label: "Silhouette Guide" },
              { key: "showControlPoints" as const, label: "10 Control Points" },
              { key: "showBoundingBox" as const, label: "Bounding Box" },
              { key: "showCenterPoint" as const, label: "Center Point" },
              { key: "showFaceOverlay" as const, label: "Face Preview" },
            ].map(({ key, label }) => {
              const active = !!debug[key];
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => onToggleDebug(key)}
                  className={`rounded-md border px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider transition ${
                    active
                      ? "border-cyan-500/70 bg-cyan-500/20 text-cyan-200"
                      : "border-white/10 bg-white/5 text-white/50 hover:text-white/80"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Material Layers */}
        <div>
          <span className="mb-2 block text-[10px] font-mono uppercase tracking-[0.2em] text-white/40">
            Material Layers
          </span>
          <div className="flex flex-wrap gap-2">
            {[
              { key: "showHighlights" as const, label: "Specular Highlights" },
              { key: "showFolds" as const, label: "Internal Folds" },
              { key: "showParticles" as const, label: "Stars & Bubbles" },
              { key: "showRim" as const, label: "Outer Rim Light" },
            ].map(({ key, label }) => {
              const active = material[key] ?? true;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => onToggleMaterial(key)}
                  className={`rounded-md border px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider transition ${
                    active
                      ? "border-violet-500/70 bg-violet-500/20 text-violet-200"
                      : "border-white/10 bg-white/5 text-white/40 hover:text-white/70"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

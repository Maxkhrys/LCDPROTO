"use client";

/** R&D control panel for the procedural body experiment. Not production UI. */

import { landingPose } from "./blobPhysics";
import { NEUTRAL_SHAPE, type ShapeParams } from "./blobShape";
import { PALETTES, type PaletteId } from "./blobMaterial";
import type { DebugOverlays } from "./BlobBody";

export type Pose = Partial<ShapeParams>;

interface SliderSpec {
  key: keyof ShapeParams;
  label: string;
  min: number;
  max: number;
  step: number;
}

export const SLIDERS: readonly SliderSpec[] = [
  { key: "squash", label: "squash", min: 0, max: 0.5, step: 0.005 },
  { key: "stretch", label: "stretch", min: 0, max: 0.5, step: 0.005 },
  { key: "lean", label: "lean", min: -0.6, max: 0.6, step: 0.005 },
  { key: "leftBulge", label: "leftBulge", min: -0.2, max: 0.3, step: 0.005 },
  { key: "rightBulge", label: "rightBulge", min: -0.2, max: 0.3, step: 0.005 },
  { key: "lowerLeftBulge", label: "lowerLeftBulge", min: -0.2, max: 0.3, step: 0.005 },
  { key: "lowerRightBulge", label: "lowerRightBulge", min: -0.2, max: 0.3, step: 0.005 },
  { key: "topHeight", label: "topHeight", min: -0.2, max: 0.3, step: 0.005 },
  { key: "bottomSag", label: "bottomSag", min: -0.2, max: 0.3, step: 0.005 },
  { key: "centerShiftX", label: "centerShiftX", min: -0.3, max: 0.3, step: 0.005 },
  { key: "centerShiftY", label: "centerShiftY", min: -0.3, max: 0.3, step: 0.005 },
  { key: "wobbleAmount", label: "wobbleAmount", min: 0, max: 0.09, step: 0.002 },
] as const;

/** Preset poses. Every one is a spring target, so all transitions ease. */
export const PRESETS: readonly { id: string; label: string; pose: Pose }[] = [
  { id: "neutral", label: "Neutral", pose: {} },
  {
    id: "squash",
    label: "Squash",
    pose: { squash: 0.28, leftBulge: 0.07, rightBulge: 0.075, bottomSag: 0.05, wobbleAmount: 0.012 },
  },
  {
    id: "stretch",
    label: "Stretch",
    pose: { stretch: 0.26, topHeight: 0.09, leftBulge: -0.05, rightBulge: -0.05, wobbleAmount: 0.008 },
  },
  {
    id: "leanLeft",
    label: "Lean left",
    pose: { lean: -0.4, centerShiftX: -0.06, lowerRightBulge: 0.07, leftBulge: 0.03, rotation: -3 },
  },
  {
    id: "leanRight",
    label: "Lean right",
    pose: { lean: 0.4, centerShiftX: 0.06, lowerLeftBulge: 0.07, rightBulge: 0.03, rotation: 3 },
  },
  { id: "wobble", label: "Soft wobble", pose: { wobbleAmount: 0.045 } },
  { id: "land", label: "Land / settle", pose: landingPose() },
] as const;

interface Props {
  pose: Pose;
  onPose: (next: Pose) => void;
  palette: PaletteId;
  onPalette: (p: PaletteId) => void;
  highlightShift: number;
  onHighlightShift: (v: number) => void;
  debug: DebugOverlays;
  onDebug: (next: DebugOverlays) => void;
  frameCost: number;
}

const row = "flex items-center gap-3 py-[3px]";
const labelCls = "w-[124px] shrink-0 font-mono text-[10px] uppercase tracking-[0.12em] text-white/45";
const valueCls = "w-[46px] shrink-0 text-right font-mono text-[10px] text-white/70";
const button =
  "rounded-full border border-white/15 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-white/70 transition hover:border-white/40 hover:text-white";

export default function BlobControls({
  pose,
  onPose,
  palette,
  onPalette,
  highlightShift,
  onHighlightShift,
  debug,
  onDebug,
  frameCost,
}: Props) {
  const value = (key: keyof ShapeParams) => (pose[key] ?? NEUTRAL_SHAPE[key]) as number;

  return (
    <div className="w-full max-w-[420px] rounded-2xl border border-white/10 bg-white/[0.02] p-5">
      <div className="mb-3 flex flex-wrap gap-2">
        {PRESETS.map((p) => (
          <button key={p.id} type="button" className={button} onClick={() => onPose({ ...p.pose })}>
            {p.label}
          </button>
        ))}
      </div>

      <div className="mb-4 border-t border-white/10 pt-3">
        {SLIDERS.map((s) => (
          <label key={s.key} className={row}>
            <span className={labelCls}>{s.label}</span>
            <input
              type="range"
              min={s.min}
              max={s.max}
              step={s.step}
              value={value(s.key)}
              onChange={(e) => onPose({ ...pose, [s.key]: Number(e.target.value) })}
              className="h-1 w-full accent-white/80"
            />
            <span className={valueCls}>{value(s.key).toFixed(3)}</span>
          </label>
        ))}
        <label className={row}>
          <span className={labelCls}>highlightShift</span>
          <input
            type="range"
            min={-1}
            max={1}
            step={0.01}
            value={highlightShift}
            onChange={(e) => onHighlightShift(Number(e.target.value))}
            className="h-1 w-full accent-white/80"
          />
          <span className={valueCls}>{highlightShift.toFixed(2)}</span>
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-white/10 pt-3">
        {(Object.keys(PALETTES) as PaletteId[]).map((id) => (
          <button
            key={id}
            type="button"
            className={`${button} ${palette === id ? "border-white/60 text-white" : ""}`}
            onClick={() => onPalette(id)}
          >
            {PALETTES[id].label}
          </button>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap gap-3 border-t border-white/10 pt-3">
        {(Object.keys(debug) as (keyof DebugOverlays)[]).map((key) => (
          <label key={key} className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-white/50">
            <input
              type="checkbox"
              checked={debug[key]}
              onChange={(e) => onDebug({ ...debug, [key]: e.target.checked })}
              className="accent-white/80"
            />
            {key}
          </label>
        ))}
      </div>

      <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.12em] text-white/30">
        frame {frameCost.toFixed(2)} ms
      </p>
    </div>
  );
}

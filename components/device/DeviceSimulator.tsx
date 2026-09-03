"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import DeviceBezel from "./DeviceBezel";
import DeviceScreen from "./DeviceScreen";
import { DEVICE_CONFIG, type Fps, type Speed } from "@/lib/deviceConfig";
import {
  DEFAULT_FACE_CALIBRATION,
  formatCalibration,
  type ElementCalibration,
  type FaceCalibration,
} from "@/lib/blobCalibration";
import type { FaceLayerId } from "@/lib/blobRig";
import { DEFAULT_IDLE, IDLE_LIMITS, type IdleConfig } from "@/lib/blobIdle";
import {
  DEFAULT_STATE,
  DEVICE_STATES,
  getStateMeta,
  type DeviceState,
} from "@/lib/deviceStates";

const BEZEL_FACTOR = 1 + DEVICE_CONFIG.bezelRatio * 2;
const MAX_OUTER = Math.round(DEVICE_CONFIG.desktopScreenSize * BEZEL_FACTOR);

/**
 * Prototype shell: the virtual device plus the state selector and the
 * secondary developer controls. This owns all prototype-only state; the
 * device components below it stay presentational.
 */
export default function DeviceSimulator() {
  const [state, setState] = useState<DeviceState>(DEFAULT_STATE);
  const [playing, setPlaying] = useState(true);
  const [fps, setFps] = useState<Fps>(60);
  const [speed, setSpeed] = useState<Speed>(1);
  const [runId, setRunId] = useState(0);

  // Temporary facial-layer alignment controls. The measured anchors in
  // lib/blobRig.ts already reproduce the master, so these start at 0/0/1x.
  const [calibration, setCalibration] = useState<FaceCalibration>(
    DEFAULT_FACE_CALIBRATION
  );
  const [saved, setSaved] = useState<string | null>(null);
  const [idle, setIdle] = useState<IdleConfig>(DEFAULT_IDLE);
  const [showCalibration, setShowCalibration] = useState(false);
  /** When true the panel rasterises at exactly 240x240 — real hardware pixels. */
  const [nativePixels, setNativePixels] = useState(false);
  const [dpr, setDpr] = useState(1);

  useEffect(() => {
    const read = () => setDpr(window.devicePixelRatio || 1);
    read();
    window.addEventListener("resize", read);
    return () => window.removeEventListener("resize", read);
  }, []);

  // The outer size is decided by CSS so there is no layout shift; JS only
  // measures it to work out the 240 -> CSS pixel scale factor.
  const frameRef = useRef<HTMLDivElement>(null);
  const [outerSize, setOuterSize] = useState(MAX_OUTER);

  useEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      const width = entry.contentRect.width;
      if (width > 0) setOuterSize(width);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const reset = useCallback(() => {
    setState(DEFAULT_STATE);
    setSpeed(1);
    setPlaying(true);
    setNativePixels(false);
    setCalibration(DEFAULT_FACE_CALIBRATION);
    setIdle(DEFAULT_IDLE);
    setSaved(null);
    setRunId((n) => n + 1);
  }, []);

  const screenSize = Math.round(outerSize / BEZEL_FACTOR);
  const meta = getStateMeta(state);

  // Rasterise at the resolution the panel is actually displayed at, so the
  // 240-space design is sampled finely enough to survive magnification.
  const renderScale = nativePixels
    ? 1
    : Math.min(
        4,
        Math.max(1, Math.ceil((screenSize * dpr) / DEVICE_CONFIG.resolution))
      );

  return (
    <div className="flex w-full flex-col items-center gap-7 sm:gap-8">
      <div
        ref={frameRef}
        className="aspect-square w-full"
        style={{ width: `min(100%, ${MAX_OUTER}px, 50vh)` }}
      >
        <DeviceBezel screenSize={screenSize}>
          <DeviceScreen
            state={state}
            screenSize={screenSize}
            playing={playing}
            speed={speed}
            runId={runId}
            fps={fps}
            calibration={calibration}
            renderScale={renderScale}
            idle={idle}
          />
        </DeviceBezel>
      </div>

      {/* State selector */}
      <div className="flex w-full max-w-2xl flex-wrap justify-center gap-1.5">
        {DEVICE_STATES.map((s) => {
          const active = s.id === state;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => setState(s.id)}
              aria-pressed={active}
              className={`rounded-full border px-3.5 py-1.5 text-[11px] uppercase tracking-[0.14em] transition-colors duration-200 ${
                active
                  ? "border-white/20 bg-white/[0.07] text-white"
                  : "border-white/[0.07] text-white/40 hover:border-white/15 hover:text-white/70"
              }`}
            >
              {s.label}
            </button>
          );
        })}
      </div>

      {/* Developer controls — deliberately secondary */}
      <div className="flex w-full max-w-2xl flex-wrap items-center justify-center gap-x-6 gap-y-3 border-t border-white/[0.06] pt-5">
        <div className="flex items-center gap-1.5">
          <DevButton onClick={() => setPlaying((p) => !p)}>
            {playing ? "Pause" : "Play"}
          </DevButton>
          <DevButton onClick={reset}>Reset</DevButton>
        </div>

        <DevGroup label="FPS">
          {DEVICE_CONFIG.fpsOptions.map((f) => (
            <DevButton key={f} active={f === fps} onClick={() => setFps(f)}>
              {f}
            </DevButton>
          ))}
        </DevGroup>

        <DevGroup label="Speed">
          {DEVICE_CONFIG.speedOptions.map((s) => (
            <DevButton key={s} active={s === speed} onClick={() => setSpeed(s)}>
              {s}x
            </DevButton>
          ))}
        </DevGroup>

        <DevButton
          active={idle.enabled}
          onClick={() => setIdle((v) => ({ ...v, enabled: !v.enabled }))}
        >
          Idle
        </DevButton>

        <DevButton
          active={nativePixels}
          onClick={() => setNativePixels((v) => !v)}
        >
          1:1
        </DevButton>

        <DevButton
          active={showCalibration}
          onClick={() => setShowCalibration((v) => !v)}
        >
          Calibrate
        </DevButton>
      </div>

      {showCalibration && (
        <IdlePanel value={idle} onChange={setIdle} onReset={() => setIdle(DEFAULT_IDLE)} />
      )}

      {showCalibration && (
        <CalibrationPanel
          value={calibration}
          onChange={setCalibration}
          onReset={() => {
            setCalibration(DEFAULT_FACE_CALIBRATION);
            setSaved(null);
          }}
          saved={saved}
          onSave={() => setSaved(formatCalibration(calibration))}
        />
      )}

      {/* Dev readout — outside the device, never inside the panel */}
      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 font-mono text-[10px] uppercase tracking-[0.18em] text-white/25">
        <span>240&times;240</span>
        <span aria-hidden className="text-white/10">
          /
        </span>
        <span style={{ color: `${meta.accent}b3` }}>{meta.label}</span>
        <span aria-hidden className="text-white/10">
          /
        </span>
        <span>{fps} fps</span>
        <span aria-hidden className="text-white/10">
          /
        </span>
        <span>{nativePixels ? "1:1 pixels" : `${renderScale}x sampled`}</span>
        <span aria-hidden className="text-white/10">
          /
        </span>
        <span>{idle.enabled ? "idle on" : "idle off"}</span>
        <span aria-hidden className="text-white/10">
          /
        </span>
        <span>{playing ? "running" : "paused"}</span>
      </div>
    </div>
  );
}

function DevGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/25">
        {label}
      </span>
      <div className="flex items-center gap-1.5">{children}</div>
    </div>
  );
}

function DevButton({
  active,
  onClick,
  children,
}: {
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`min-w-11 rounded-md border px-2.5 py-1 text-[11px] tracking-wide transition-colors duration-200 ${
        active
          ? "border-white/15 bg-white/[0.06] text-white/80"
          : "border-white/[0.06] text-white/35 hover:border-white/12 hover:text-white/65"
      }`}
    >
      {children}
    </button>
  );
}

/**
 * Temporary idle-motion controls.
 *
 * Defaults sit at the quiet end of the brief's ranges — the goal is "alive",
 * which reads as almost subconscious rather than as animation.
 */
function IdlePanel({
  value,
  onChange,
  onReset,
}: {
  value: IdleConfig;
  onChange: (v: IdleConfig) => void;
  onReset: () => void;
}) {
  return (
    <div className="flex w-full max-w-md flex-col gap-3 rounded-lg border border-white/[0.06] bg-white/[0.015] p-4">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/30">
          idle motion
        </span>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => onChange({ ...value, enabled: !value.enabled })}
            className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/40 transition-colors hover:text-white/80"
          >
            {value.enabled ? "On" : "Off"}
          </button>
          <button
            type="button"
            onClick={onReset}
            className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/30 transition-colors hover:text-white/60"
          >
            Reset
          </button>
        </div>
      </div>

      <Slider
        label="Float"
        {...IDLE_LIMITS.floatPx}
        value={value.floatPx}
        format={(v) => `${v.toFixed(1)} px`}
        onChange={(floatPx) => onChange({ ...value, floatPx })}
      />
      <Slider
        label="Breath"
        {...IDLE_LIMITS.breathAmount}
        value={value.breathAmount}
        format={(v) => `${(v * 100).toFixed(2)}%`}
        onChange={(breathAmount) => onChange({ ...value, breathAmount })}
      />
      <Slider
        label="Squash"
        {...IDLE_LIMITS.squashAmount}
        value={value.squashAmount}
        format={(v) => `${(v * 100).toFixed(2)}%`}
        onChange={(squashAmount) => onChange({ ...value, squashAmount })}
      />
      <Slider
        label="Blink"
        {...IDLE_LIMITS.blinkInterval}
        value={value.blinkInterval}
        format={(v) => `${v.toFixed(1)} s`}
        onChange={(blinkInterval) => onChange({ ...value, blinkInterval })}
      />
    </div>
  );
}

/**
 * Temporary calibration for the layered face.
 *
 * Offsets are in 240-space pixels, so 1 unit is one real pixel on the target
 * panel. Everything starts at 0 / 0 / 1.000x because the measured anchors in
 * lib/blobRig.ts already reproduce the master's face placement. Once these are
 * dialled in, SAVE CALIBRATION prints the numbers to hardcode.
 */
function CalibrationPanel({
  value,
  onChange,
  onReset,
  onSave,
  saved,
}: {
  value: FaceCalibration;
  onChange: (v: FaceCalibration) => void;
  onReset: () => void;
  onSave: () => void;
  saved: string | null;
}) {
  const groups: { id: FaceLayerId; label: string }[] = [
    { id: "leftEye", label: "Left eye" },
    { id: "rightEye", label: "Right eye" },
    { id: "mouth", label: "Mouth" },
  ];

  const set = (id: FaceLayerId, patch: Partial<ElementCalibration>) =>
    onChange({ ...value, [id]: { ...value[id], ...patch } });

  return (
    <div className="flex w-full max-w-md flex-col gap-4 rounded-lg border border-white/[0.06] bg-white/[0.015] p-4">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/30">
          face calibration
        </span>
        <button
          type="button"
          onClick={onReset}
          className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/30 transition-colors hover:text-white/60"
        >
          Reset
        </button>
      </div>

      {groups.map(({ id, label }) => (
        <div key={id} className="flex flex-col gap-2">
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/40">
            {label}
          </span>
          <Slider
            label="X"
            min={-20}
            max={20}
            step={0.25}
            value={value[id].x}
            format={(v) => `${v > 0 ? "+" : ""}${v.toFixed(2)} px`}
            onChange={(x) => set(id, { x })}
          />
          <Slider
            label="Y"
            min={-20}
            max={20}
            step={0.25}
            value={value[id].y}
            format={(v) => `${v > 0 ? "+" : ""}${v.toFixed(2)} px`}
            onChange={(y) => set(id, { y })}
          />
          <Slider
            label="Scale"
            min={0.5}
            max={1.5}
            step={0.005}
            value={value[id].scale}
            format={(v) => `${v.toFixed(3)}x`}
            onChange={(scale) => set(id, { scale })}
          />
        </div>
      ))}

      <button
        type="button"
        onClick={onSave}
        className="rounded-md border border-white/15 bg-white/[0.06] px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-white/70 transition-colors hover:border-white/25 hover:text-white"
      >
        Save calibration
      </button>

      {saved && <SavedValues text={saved} />}
    </div>
  );
}

/** Shows the saved numbers as selectable text, with a copy button. */
function SavedValues({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* Clipboard blocked — the text is selectable below regardless. */
    }
  };

  return (
    <div className="flex flex-col gap-2 rounded-md border border-white/[0.08] bg-black/40 p-3">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-white/30">
          current values
        </span>
        <button
          type="button"
          onClick={copy}
          className="font-mono text-[9px] uppercase tracking-[0.14em] text-white/40 transition-colors hover:text-white/80"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="overflow-x-auto font-mono text-[10px] leading-relaxed text-white/60 select-all">
        {text}
      </pre>
    </div>
  );
}

function Slider({
  label,
  min,
  max,
  step,
  value,
  format,
  onChange,
}: {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  format: (v: number) => string;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex items-center gap-3">
      <span className="w-10 shrink-0 font-mono text-[10px] uppercase tracking-[0.14em] text-white/30">
        {label}
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1 flex-1 cursor-pointer appearance-none rounded-full bg-white/10 accent-[#8A60E8]"
      />
      <span className="w-16 shrink-0 text-right font-mono text-[10px] tabular-nums text-white/40">
        {format(value)}
      </span>
    </label>
  );
}

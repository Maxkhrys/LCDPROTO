"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import DeviceBezel from "./DeviceBezel";
import DeviceScreen from "./DeviceScreen";
import { DEVICE_CONFIG, type Fps, type Speed } from "@/lib/deviceConfig";
import {
  DEFAULT_CALIBRATION,
  type BlobCalibration,
} from "@/lib/blobConfig";
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

  // Temporary reaction.png alignment controls. The measured anchors in
  // lib/blobConfig.ts already align the frames, so these start at 0/0/1x.
  const [calibration, setCalibration] =
    useState<BlobCalibration>(DEFAULT_CALIBRATION);
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
    setCalibration(DEFAULT_CALIBRATION);
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
        <CalibrationPanel
          value={calibration}
          onChange={setCalibration}
          onReset={() => setCalibration(DEFAULT_CALIBRATION)}
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
 * Temporary alignment controls for reaction.png.
 *
 * Offsets are in 240-space pixels, so 1 unit is one real pixel on the target
 * panel. Once a good set of numbers is found, fold them into
 * DEFAULT_CALIBRATION in lib/blobConfig.ts and this panel can be deleted.
 */
function CalibrationPanel({
  value,
  onChange,
  onReset,
}: {
  value: BlobCalibration;
  onChange: (v: BlobCalibration) => void;
  onReset: () => void;
}) {
  return (
    <div className="flex w-full max-w-md flex-col gap-3 rounded-lg border border-white/[0.06] bg-white/[0.015] p-4">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/30">
          reaction.png alignment
        </span>
        <button
          type="button"
          onClick={onReset}
          className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/30 transition-colors hover:text-white/60"
        >
          Reset
        </button>
      </div>

      <Slider
        label="X"
        min={-8}
        max={8}
        step={0.25}
        value={value.offsetX}
        format={(v) => `${v > 0 ? "+" : ""}${v.toFixed(2)} px`}
        onChange={(offsetX) => onChange({ ...value, offsetX })}
      />
      <Slider
        label="Y"
        min={-8}
        max={8}
        step={0.25}
        value={value.offsetY}
        format={(v) => `${v > 0 ? "+" : ""}${v.toFixed(2)} px`}
        onChange={(offsetY) => onChange({ ...value, offsetY })}
      />
      <Slider
        label="Scale"
        min={0.9}
        max={1.1}
        step={0.002}
        value={value.scale}
        format={(v) => `${v.toFixed(3)}x`}
        onChange={(scale) => onChange({ ...value, scale })}
      />
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

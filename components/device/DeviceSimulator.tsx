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
import {
  BLOB_COLOURS,
  type BlobColour,
  type FaceLayerId,
} from "@/lib/blobRig";
import { DEFAULT_IDLE, IDLE_LIMITS, type IdleConfig } from "@/lib/blobIdle";
import type { BehaviourId, HomeActivityStatus, HomeMood } from "@/lib/blobBehaviour";
import {
  EXPRESSION_FILTERS,
  EXPRESSION_GROUPS_BY_STATE,
  HOME_EXPRESSION_GROUPS,
  type ExpressionFilter,
} from "@/lib/expressionCatalog";
import {
  DEFAULT_STATE,
  DEVICE_STATES,
  DISPLAY_BACKGROUNDS,
  getStateMeta,
  type DisplayMode,
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
  const [displayMode, setDisplayMode] = useState<DisplayMode>("dark");
  const [screenColour, setScreenColour] = useState(DISPLAY_BACKGROUNDS.dark);
  const [blobColour, setBlobColour] = useState<BlobColour>("teal");
  const [showPupils, setShowPupils] = useState(false);
  const [blobToolsOpen, setBlobToolsOpen] = useState(false);
  const [activeBlobTool, setActiveBlobTool] = useState<"colour" | "face" | "pupils" | null>(null);
  const [mood, setMood] = useState<HomeMood | null>(null);

  // Temporary facial-layer alignment controls. The measured anchors in
  // lib/blobRig.ts already reproduce the master, so these start at 0/0/1x.
  const [calibration, setCalibration] = useState<FaceCalibration>(
    DEFAULT_FACE_CALIBRATION
  );
  const [saved, setSaved] = useState<string | null>(null);
  const [idle, setIdle] = useState<IdleConfig>(DEFAULT_IDLE);
  const [autoBehaviourEnabled, setAutoBehaviourEnabled] = useState(true);
  const [trigger, setTrigger] = useState<{ id: BehaviourId; nonce: number } | null>(
    null
  );
  const [status, setStatus] = useState<HomeActivityStatus | null>(null);
  const fire = useCallback(
    (id: BehaviourId) => setTrigger((t) => ({ id, nonce: (t?.nonce ?? 0) + 1 })),
    []
  );
  const [showCalibration, setShowCalibration] = useState(false);
  const [showExpressions, setShowExpressions] = useState(false);
  const [expressionFilter, setExpressionFilter] =
    useState<ExpressionFilter>("ALL");
  const [expressionQuery, setExpressionQuery] = useState("");
  /** When true the panel rasterises at exactly 240x240 — real hardware pixels. */
  const [nativePixels, setNativePixels] = useState(false);
  const [dpr, setDpr] = useState(1);

  useEffect(() => {
    document.documentElement.dataset.simulatorTheme = displayMode;
    return () => {
      delete document.documentElement.dataset.simulatorTheme;
    };
  }, [displayMode]);

  useEffect(() => {
    setStatus(null);
  }, [state]);

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
    setDisplayMode("dark");
    setScreenColour(DISPLAY_BACKGROUNDS.dark);
    setBlobColour("teal");
    setShowPupils(false);
    setBlobToolsOpen(false);
    setActiveBlobTool(null);
    setMood(null);
    setCalibration(DEFAULT_FACE_CALIBRATION);
    setIdle(DEFAULT_IDLE);
    setAutoBehaviourEnabled(true);
    setTrigger(null);
    setSaved(null);
    setShowExpressions(false);
    setExpressionFilter("ALL");
    setExpressionQuery("");
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
    <div className="sim-ui relative flex w-full flex-col items-center gap-7 sm:gap-8">
      <div className="flex w-full max-w-[920px] flex-col items-center gap-7 lg:flex-row lg:items-start lg:justify-center lg:gap-8">
        <div className="flex shrink-0 flex-col items-center">
          <div
            ref={frameRef}
            className="aspect-square w-full"
            style={{ width: `min(100%, ${MAX_OUTER}px, 50vh)` }}
          >
            <DeviceBezel screenSize={screenSize}>
              <div className="relative">
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
                  autoBehaviourEnabled={autoBehaviourEnabled}
                  triggerRequest={trigger}
                  onBehaviourStatus={setStatus}
                  displayMode={displayMode}
                  screenColour={screenColour}
                  onOpenBlobTools={() => {
                    if (!blobToolsOpen) {
                      setBlobToolsOpen(true);
                      setActiveBlobTool(null);
                    }
                  }}
                  onCloseBlobTools={() => {
                    setBlobToolsOpen(false);
                    setActiveBlobTool(null);
                  }}
                  blobToolsOpen={blobToolsOpen}
                  mood={mood}
                  showPupils={showPupils}
                  blobColour={blobColour}
                />
                <BlobToolOrbs
                  open={blobToolsOpen}
                  active={activeBlobTool}
                  screenSize={screenSize}
                  blobColour={blobColour}
                  showPupils={showPupils}
                  onSelect={(tool) => {
                    setActiveBlobTool(tool);
                    if (tool === "face") setShowExpressions(true);
                    if (tool === "pupils") setShowPupils((value) => !value);
                  }}
                  onColourChange={setBlobColour}
                />
              </div>
            </DeviceBezel>
          </div>

        </div>

        {/* The tuning rail stays beside Blob on desktop so edits are visible. */}
        <aside className="flex w-full max-w-md shrink-0 flex-col gap-4 lg:max-h-[min(80vh,720px)] lg:overflow-y-auto lg:pr-1">
          {/* Developer controls — deliberately secondary */}
          <div className="flex w-full flex-wrap items-center gap-x-4 gap-y-3 rounded-lg border border-white/[0.06] bg-white/[0.015] p-4">
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

            <DevGroup label="Blob">
              {BLOB_COLOURS.map((colour) => (
                <DevButton
                  key={colour.id}
                  active={blobColour === colour.id}
                  onClick={() => setBlobColour(colour.id)}
                >
                  {colour.label}
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
              active={autoBehaviourEnabled}
              onClick={() => setAutoBehaviourEnabled((v) => !v)}
            >
              Auto
            </DevButton>

            <DevGroup label="Mood">
              <DevButton active={mood === null} onClick={() => setMood(null)}>
                Auto
              </DevButton>
              {(["CONTENT", "CURIOUS", "SLEEPY", "AMUSED", "DISTRACTED", "THOUGHTFUL"] as const).map(
                (option) => (
                  <DevButton
                    key={option}
                    active={mood === option}
                    onClick={() => setMood(option)}
                  >
                    {option.toLowerCase()}
                  </DevButton>
                )
              )}
            </DevGroup>

            <DevButton
              active={nativePixels}
              onClick={() => setNativePixels((v) => !v)}
            >
              1:1
            </DevButton>

            <DevGroup label="Screen">
              {(["dark", "warm", "brown"] as const).map((mode) => (
                <DevButton
                  key={mode}
                  active={displayMode === mode}
                  onClick={() => {
                    setDisplayMode(mode);
                    setScreenColour(DISPLAY_BACKGROUNDS[mode]);
                  }}
                >
                  {mode}
                </DevButton>
              ))}
            </DevGroup>

            <label className="flex items-center gap-2">
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/25">
                LCD colour
              </span>
              <input
                aria-label="LCD screen background colour"
                type="color"
                value={screenColour}
                onChange={(event) => setScreenColour(event.currentTarget.value)}
                className="h-7 w-9 cursor-pointer rounded border border-white/[0.1] bg-transparent p-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/50"
              />
              <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-white/35">
                {screenColour}
              </span>
            </label>

            <DevButton
              active={showCalibration}
              onClick={() => setShowCalibration((v) => !v)}
            >
              Tune
            </DevButton>
          </div>

          <ActivityReadout
            status={status}
            playing={playing}
            autoEnabled={autoBehaviourEnabled}
            idleEnabled={idle.enabled}
          />

          {showCalibration && (
            <BehaviourPanel
              status={status}
              autoEnabled={autoBehaviourEnabled}
              onToggle={() => setAutoBehaviourEnabled((v) => !v)}
              onTrigger={fire}
            />
          )}

          {showCalibration && (
            <IdlePanel
              value={idle}
              onChange={setIdle}
              onReset={() => setIdle(DEFAULT_IDLE)}
            />
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
        </aside>
      </div>

      {/* State selector stays below activity and tuning controls on mobile. */}
      <div className="flex w-full max-w-2xl flex-wrap justify-center gap-1.5">
        {DEVICE_STATES.map((s) => {
          const active = s.id === state;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => setState(s.id)}
              aria-pressed={active}
              className={`rounded-full border px-3.5 py-1.5 text-[11px] uppercase tracking-[0.14em] transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/50 ${
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
        <span>{blobColour}</span>
        <span aria-hidden className="text-white/10">
          /
        </span>
        <span>{idle.enabled ? "idle on" : "idle off"}</span>
        <span aria-hidden className="text-white/10">
          /
        </span>
        <span className="text-white/40">
          {autoBehaviourEnabled
            ? (status?.id ?? "REST")
            : status?.id && status.id !== "REST"
              ? status.id
              : "manual"}
        </span>
        <span aria-hidden className="text-white/10">
          /
        </span>
        <span>{playing ? "running" : "paused"}</span>
      </div>

      <ExpressionDrawer
        open={showExpressions}
        state={state}
        filter={expressionFilter}
        query={expressionQuery}
        onToggle={() => setShowExpressions((v) => !v)}
        onStateChange={(next) => {
          setState(next);
          setExpressionFilter("ALL");
        }}
        onFilterChange={setExpressionFilter}
        onQueryChange={setExpressionQuery}
        onTrigger={fire}
      />
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

type BlobTool = "colour" | "face" | "pupils";

function BlobToolOrbs({
  open,
  active,
  screenSize,
  blobColour,
  showPupils,
  onSelect,
  onColourChange,
}: {
  open: boolean;
  active: BlobTool | null;
  screenSize: number;
  blobColour: BlobColour;
  showPupils: boolean;
  onSelect: (tool: BlobTool) => void;
  onColourChange: (colour: BlobColour) => void;
}) {
  if (!open) return null;
  const orbSize = Math.max(34, Math.min(52, screenSize * 0.14));
  const orbStyle = (left: string, top: number) => ({
    left,
    top: screenSize * top,
    width: orbSize,
    height: orbSize,
    transform: "translateX(-50%)",
  });

  return (
    <div className="pointer-events-none absolute inset-0 z-30">
      <div
        className="pointer-events-auto absolute"
        style={{ ...orbStyle("25%", 0.13), transform: "translateX(-50%) rotate(-12deg)" }}
      >
        <OrbButton active={active === "colour"} label="Blob colour" onClick={() => onSelect("colour")}>
          <span className="h-4 w-4 rounded-full border border-white/70" style={{ background: blobColourSwatch(blobColour) }} />
        </OrbButton>
      </div>
      <div className="pointer-events-auto absolute" style={orbStyle("50%", 0.055)}>
        <OrbButton active={active === "face"} label="Eyes and mouth settings" onClick={() => onSelect("face")}>
          <span className="text-[17px] leading-none">☺</span>
        </OrbButton>
      </div>
      <div
        className="pointer-events-auto absolute"
        style={{ ...orbStyle("75%", 0.13), transform: "translateX(-50%) rotate(12deg)" }}
      >
        <OrbButton active={active === "pupils"} label={showPupils ? "Hide pupils" : "Show pupils"} onClick={() => onSelect("pupils")}>
          <span className="relative block h-4 w-4 rounded-full border border-white/75">
            <span className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white" />
          </span>
        </OrbButton>
      </div>

      {active === "colour" && (
        <div className="pointer-events-auto absolute left-1/2 top-[30%] flex -translate-x-1/2 gap-1.5 rounded-xl border border-white/15 bg-black/75 p-2 shadow-2xl backdrop-blur-sm">
          {BLOB_COLOURS.map((colour) => (
            <button
              key={colour.id}
              type="button"
              aria-label={`Use ${colour.label} Blob`}
              aria-pressed={blobColour === colour.id}
              onClick={() => onColourChange(colour.id)}
              className="h-6 w-6 rounded-full border border-white/30 transition-transform hover:scale-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              style={{ background: blobColourSwatch(colour.id) }}
            />
          ))}
        </div>
      )}

      {active === "face" && (
        <div className="pointer-events-none absolute left-1/2 top-[30%] -translate-x-1/2 rounded-xl border border-white/15 bg-black/75 px-3 py-2 text-center shadow-2xl backdrop-blur-sm">
          <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-white/70">Face library open</p>
          <p className="mt-1 text-[10px] text-white/40">Use Expressions tab</p>
        </div>
      )}
    </div>
  );
}

function OrbButton({
  active,
  label,
  onClick,
  children,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      className={`flex h-full w-full items-center justify-center rounded-full border text-white shadow-[0_8px_24px_rgba(0,0,0,0.45)] transition duration-200 hover:scale-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${
        active
          ? "border-white/60 bg-white/20"
          : "border-white/25 bg-black/65 hover:border-white/50 hover:bg-white/15"
      }`}
    >
      {children}
    </button>
  );
}

function blobColourSwatch(colour: BlobColour) {
  const swatches: Record<BlobColour, string> = {
    purple: "#9a63ed",
    teal: "#28c9c4",
    yellow: "#f3c431",
    green: "#55d963",
    blue: "#398cff",
    red: "#ef4b59",
  };
  return swatches[colour];
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
      className={`min-w-11 rounded-md border px-2.5 py-1 text-[11px] tracking-wide transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/50 ${
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
 * Defaults are tuned for native 240x240 readability while remaining restrained.
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
        label="Drift"
        {...IDLE_LIMITS.driftSpeed}
        value={value.driftSpeed}
        format={(v) => `${v.toFixed(2)}x`}
        onChange={(driftSpeed) => onChange({ ...value, driftSpeed })}
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
        label="Jelly"
        {...IDLE_LIMITS.jellyAmount}
        value={value.jellyAmount}
        format={(v) => `${v.toFixed(2)}x`}
        onChange={(jellyAmount) => onChange({ ...value, jellyAmount })}
      />
      <Slider
        label="Ripple"
        {...IDLE_LIMITS.rippleAmount}
        value={value.rippleAmount}
        format={(v) => `${v.toFixed(2)}x`}
        onChange={(rippleAmount) => onChange({ ...value, rippleAmount })}
      />
      <Slider
        label="Blink"
        {...IDLE_LIMITS.blinkInterval}
        value={value.blinkInterval}
        format={(v) => `${v.toFixed(1)} s`}
        onChange={(blinkInterval) => onChange({ ...value, blinkInterval })}
      />
      <Slider
        label="Gaze"
        {...IDLE_LIMITS.gazeDriftPx}
        value={value.gazeDriftPx}
        format={(v) => `${v.toFixed(1)} px`}
        onChange={(gazeDriftPx) => onChange({ ...value, gazeDriftPx })}
      />
      <Slider
        label="Rotate"
        {...IDLE_LIMITS.rotationDeg}
        value={value.rotationDeg}
        format={(v) => `${v.toFixed(2)} deg`}
        onChange={(rotationDeg) => onChange({ ...value, rotationDeg })}
      />
      <Slider
        label="Activity"
        {...IDLE_LIMITS.activityPace}
        value={value.activityPace}
        format={(v) => `${v.toFixed(2)}x`}
        onChange={(activityPace) => onChange({ ...value, activityPace })}
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

/**
 * Temporary window onto the HOME behaviour scheduler: what is running now, and
 * a way to fire each behaviour on demand for inspection.
 */
function BehaviourPanel({
  status,
  autoEnabled,
  onToggle,
  onTrigger,
}: {
  status: HomeActivityStatus | null;
  autoEnabled: boolean;
  onToggle: () => void;
  onTrigger: (id: BehaviourId) => void;
}) {
  const resting = !status || status.id === "REST";
  return (
    <div className="flex w-full max-w-md flex-col gap-3 rounded-lg border border-white/[0.06] bg-white/[0.015] p-4">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/30">
          auto playlist
        </span>
        <button
          type="button"
          onClick={onToggle}
          aria-pressed={autoEnabled}
          className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/40 transition-colors hover:text-white/80"
        >
          {autoEnabled ? "On" : "Off"}
        </button>
      </div>

      <p className="text-[11px] leading-relaxed text-white/35">
        Auto plays the HOME catalogue. The individual cue buttons below always
        work manually.
      </p>

      <div className="flex items-baseline justify-between gap-3 rounded-md border border-white/[0.06] bg-black/40 px-3 py-2">
        <span
          className={`font-mono text-[11px] tracking-[0.12em] ${
            resting ? "text-white/35" : "text-[#b295ff]"
          }`}
        >
          {autoEnabled
            ? (status?.id ?? "REST")
            : status?.id && status.id !== "REST"
              ? status.id
              : "MANUAL"}
        </span>
        <span className="font-mono text-[10px] tabular-nums text-white/25">
          {status
            ? status.id === "REST"
              ? autoEnabled
                ? `${(status.nextBehaviourMs / 1000).toFixed(1)}s next`
                : "ready for cue"
              : `${(status.remainingMs / 1000).toFixed(1)}s left`
            : "—"}
        </span>
      </div>

      <div className="flex flex-col gap-3">
        <div>
          <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-white/25">
            neutral
          </span>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => onTrigger("REST")}
              className="rounded-md border border-white/[0.07] px-2.5 py-1 text-[10px] tracking-wide text-white/40 transition-colors hover:border-white/20 hover:text-white/80"
            >
              Return to neutral
            </button>
          </div>
        </div>
        {HOME_EXPRESSION_GROUPS.map((group) => (
          <div key={group.id}>
            <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-white/25">
              {group.label}
            </span>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {group.entries.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => onTrigger(entry.id)}
                  className="rounded-md border border-white/[0.07] px-2.5 py-1 text-[10px] tracking-wide text-white/40 transition-colors hover:border-white/20 hover:text-white/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/50"
                >
                  {entry.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ExpressionDrawer({
  open,
  state,
  filter,
  query,
  onToggle,
  onStateChange,
  onFilterChange,
  onQueryChange,
  onTrigger,
}: {
  open: boolean;
  state: DeviceState;
  filter: ExpressionFilter;
  query: string;
  onToggle: () => void;
  onStateChange: (state: DeviceState) => void;
  onFilterChange: (filter: ExpressionFilter) => void;
  onQueryChange: (query: string) => void;
  onTrigger: (id: BehaviourId) => void;
}) {
  const groups = EXPRESSION_GROUPS_BY_STATE[state] ?? [];
  const normalizedQuery = query.trim().toLowerCase();
  const filteredGroups =
    filter === "ALL" ? groups : groups.filter((group) => group.id === filter);
  const visibleGroups = normalizedQuery
    ? filteredGroups
        .map((group) => ({
          ...group,
          entries: group.entries.filter(
            (entry) =>
              entry.label.toLowerCase().includes(normalizedQuery) ||
              entry.hint.toLowerCase().includes(normalizedQuery)
          ),
        }))
        .filter((group) => group.entries.length > 0)
    : filteredGroups;
  const meta = getStateMeta(state);

  return (
    <div className="pointer-events-none fixed inset-y-0 right-0 z-50 flex items-center">
      <div
        className="pointer-events-auto flex items-stretch transition-transform duration-200 ease-out"
        style={{
          transform: open ? "translateX(0)" : "translateX(calc(100% - 2.6rem))",
        }}
      >
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-controls="expression-library"
          className="flex h-36 w-10 shrink-0 items-center justify-center rounded-l-xl border border-r-0 border-white/[0.1] bg-black/40 text-white/55 shadow-xl transition-colors hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/50"
        >
          <span
            className="font-mono text-[9px] uppercase tracking-[0.2em]"
            style={{ writingMode: "vertical-rl" }}
          >
            Expressions
          </span>
        </button>

        <aside
          id="expression-library"
          aria-label="Expression library"
          className="expression-drawer flex h-[min(78vh,680px)] w-[min(350px,calc(100vw-52px))] flex-col rounded-l-xl border border-white/[0.1] shadow-2xl"
          style={{
            background: "var(--dev-panel-bg)",
            borderColor: "var(--dev-panel-border)",
          }}
        >
          <div className="flex items-start justify-between gap-3 border-b border-white/[0.07] px-4 py-4">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/70">
                Expression library
              </p>
              <p className="mt-1 text-[11px] leading-relaxed text-white/35">
                Tap any cue to preview this state’s behaviour.
              </p>
            </div>
            <button
              type="button"
              onClick={onToggle}
              aria-label="Close expression library"
              className="rounded-md px-1.5 text-lg leading-none text-white/35 transition-colors hover:text-white/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/50"
            >
              ×
            </button>
          </div>

          <div className="border-b border-white/[0.07] px-3 py-3">
            <p className="mb-2 font-mono text-[9px] uppercase tracking-[0.16em] text-white/25">
              State
            </p>
            <div className="flex gap-1 overflow-x-auto pb-1">
              {DEVICE_STATES.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onStateChange(item.id)}
                  aria-pressed={item.id === state}
                  className={
                    item.id === state
                      ? "shrink-0 rounded-md border border-white/20 bg-white/[0.07] px-2 py-1 text-[9px] uppercase tracking-[0.12em] text-white/80 transition-colors"
                      : "shrink-0 rounded-md border border-white/[0.06] px-2 py-1 text-[9px] uppercase tracking-[0.12em] text-white/30 transition-colors hover:border-white/15 hover:text-white/65 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/50"
                  }
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div className="border-b border-white/[0.07] px-3 py-3">
            <label className="block">
              <span className="sr-only">Search expressions</span>
              <input
                type="search"
                value={query}
                onChange={(event) => onQueryChange(event.target.value)}
                placeholder="Search cues"
                className="w-full rounded-md border border-white/[0.08] bg-black/15 px-3 py-2 text-[11px] text-white/75 outline-none placeholder:text-white/25 focus:border-white/25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/50"
              />
            </label>
          </div>

          <div className="border-b border-white/[0.07] px-3 py-3">
            <p className="mb-2 font-mono text-[9px] uppercase tracking-[0.16em] text-white/25">
              Filter
            </p>
            <div className="flex flex-wrap gap-1">
              {EXPRESSION_FILTERS.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => onFilterChange(item)}
                  aria-pressed={item === filter}
                  className={
                    item === filter
                      ? "rounded-md border border-white/20 bg-white/[0.07] px-2 py-1 text-[9px] uppercase tracking-[0.12em] text-white/80 transition-colors"
                      : "rounded-md border border-white/[0.06] px-2 py-1 text-[9px] uppercase tracking-[0.12em] text-white/30 transition-colors hover:border-white/15 hover:text-white/65 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/50"
                  }
                >
                  {item === "ALL" ? "All" : item}
                </button>
              ))}
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
            {groups.length === 0 ? (
              <div className="rounded-lg border border-white/[0.07] bg-black/10 px-3 py-4">
                <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/45">
                  {meta.label}
                </p>
                <p className="mt-1 text-[11px] leading-relaxed text-white/30">
                  No expressions authored yet. This slot is ready for the next
                  state pass.
                </p>
              </div>
            ) : visibleGroups.length === 0 ? (
              <p className="px-1 py-4 text-[11px] text-white/35">
                {normalizedQuery ? "No matching cues." : "No cues in this filter."}
              </p>
            ) : (
              <div className="flex flex-col gap-4">
                <section>
                  <div className="mb-1.5 flex items-center justify-between">
                    <h2 className="font-mono text-[9px] uppercase tracking-[0.16em] text-white/35">
                      Neutral
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => onTrigger("REST")}
                    className="group flex w-full items-center justify-between gap-3 rounded-lg border border-white/[0.06] px-3 py-2 text-left transition-colors hover:border-white/20 hover:bg-white/[0.05] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/50"
                  >
                    <span className="text-[11px] text-white/65 group-hover:text-white/90">
                      Return to neutral
                    </span>
                    <span className="shrink-0 font-mono text-[9px] uppercase tracking-[0.1em] text-white/25">
                      reset cues
                    </span>
                  </button>
                </section>
                {visibleGroups.map((group) => (
                  <section key={group.id}>
                    <div className="mb-1.5 flex items-center justify-between">
                      <h2 className="font-mono text-[9px] uppercase tracking-[0.16em] text-white/35">
                        {group.label}
                      </h2>
                      <span className="font-mono text-[9px] tabular-nums text-white/20">
                        {group.entries.length}
                      </span>
                    </div>
                    <div className="flex flex-col gap-1">
                      {group.entries.map((entry) => (
                        <button
                          key={entry.id}
                          type="button"
                          onClick={() => onTrigger(entry.id)}
                          className="group flex items-center justify-between gap-3 rounded-lg border border-white/[0.06] px-3 py-2 text-left transition-colors hover:border-white/20 hover:bg-white/[0.05] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/50"
                        >
                          <span className="min-w-0 text-[11px] text-white/65 group-hover:text-white/90">
                            {entry.label}
                          </span>
                          <span className="shrink-0 font-mono text-[9px] uppercase tracking-[0.1em] text-white/25">
                            {entry.hint}
                          </span>
                        </button>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            )}
          </div>

          <div className="border-t border-white/[0.07] px-4 py-3">
            <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-white/25">
              {groups.length > 0
                ? meta.label + " catalogue · preview buttons fire controller cues"
                : meta.label + " catalogue · not authored"}
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}

function ActivityReadout({
  status,
  playing,
  autoEnabled,
  idleEnabled,
}: {
  status: HomeActivityStatus | null;
  playing: boolean;
  autoEnabled: boolean;
  idleEnabled: boolean;
}) {
  const behaviour = autoEnabled
    ? (status?.id ?? "REST")
    : status?.id && status.id !== "REST"
      ? status.id
      : "MANUAL";
  const next =
    playing && status
      ? autoEnabled
        ? `${(status.nextBehaviourMs / 1000).toFixed(1)}s`
        : status.id === "REST"
          ? "ready"
          : `${(status.remainingMs / 1000).toFixed(1)}s`
      : "paused";
  const x = idleEnabled ? (status?.idleX ?? 0) : 0;
  const y = idleEnabled ? (status?.idleY ?? 0) : 0;
  const rotation = status?.bodyRotation ?? 0;
  const blink = status?.blinkState ?? "open";

  return (
    <div className="grid w-full max-w-2xl grid-cols-2 gap-x-5 gap-y-3 rounded-lg border border-white/[0.06] bg-white/[0.015] px-4 py-3 font-mono text-[10px] sm:grid-cols-5">
      <ActivityValue label="Activity" value={behaviour} accent />
      <ActivityValue label="Next" value={next} />
      <ActivityValue label="Mood" value={status?.mood ?? "CONTENT"} />
      <ActivityValue label="Gaze" value={status?.gaze ?? "RESTING"} />
      <ActivityValue label="Lids" value={status?.lids ?? "OPEN"} />
      <ActivityValue label="Mouth" value={status?.mouth ?? "SMILE"} />
      <ActivityValue label="Body" value={status?.body ?? "SUSPENDED"} />
      <ActivityValue label="Idle offset" value={`${x.toFixed(2)}, ${y.toFixed(2)} px`} />
      <ActivityValue label="Body rotation" value={`${rotation.toFixed(2)} deg`} />
      <ActivityValue
        label="Blink / speed"
        value={`${blink} / ${(status?.bodySpeed ?? 0).toFixed(1)} px/s`}
      />
    </div>
  );
}

function ActivityValue({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="min-w-0">
      <div className="uppercase tracking-[0.15em] text-white/25">{label}</div>
      <div
        className={`mt-1 truncate tabular-nums ${
          accent ? "text-[#b295ff]" : "text-white/50"
        }`}
        title={value}
      >
        {value}
      </div>
    </div>
  );
}

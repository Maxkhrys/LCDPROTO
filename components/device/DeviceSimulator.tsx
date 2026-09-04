"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import DeviceBezel from "./DeviceBezel";
import ScreenStage from "@/components/screens/ScreenStage";
import ScreenBrowser from "@/components/screens/ScreenBrowser";
import { ScreenLifecycle, type LifecycleSnapshot } from "@/lib/screenLifecycle";
import { isDeviceState, type FlowId, type ScreenId } from "@/lib/screenCatalogue";
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
  DESTINATIONS,
  INTENTIONS,
  type BlobDestination,
  type BlobIntention,
} from "@/lib/blobMind";
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
import {
  DEFAULT_ENVIRONMENT,
  type EnvironmentConfig,
  type EnvironmentStatus,
} from "@/lib/environmentConfig";

const BEZEL_FACTOR = 1 + DEVICE_CONFIG.bezelRatio * 2;
const DEFAULT_OUTER = Math.round(DEVICE_CONFIG.desktopScreenSize * BEZEL_FACTOR);
const DEFAULT_DISPLAY_MODE: DisplayMode = "brown";
const DEFAULT_BLOB_COLOUR: BlobColour = "blue";
const DEFAULT_CHARACTER_SCALE = 0.88;

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
  const [displayMode, setDisplayMode] = useState<DisplayMode>(DEFAULT_DISPLAY_MODE);
  const [screenColour, setScreenColour] = useState(DISPLAY_BACKGROUNDS[DEFAULT_DISPLAY_MODE]);
  const [blobColour, setBlobColour] = useState<BlobColour>(DEFAULT_BLOB_COLOUR);
  const [characterScale, setCharacterScale] = useState(DEFAULT_CHARACTER_SCALE);
  const [screenScale, setScreenScale] = useState(1.2);
  const [environment, setEnvironment] = useState<EnvironmentConfig>(DEFAULT_ENVIRONMENT);
  const [environmentStatus, setEnvironmentStatus] = useState<EnvironmentStatus | null>(null);
  const [showPupils, setShowPupils] = useState(false);
  const [blobToolsOpen, setBlobToolsOpen] = useState(false);
  const [activeBlobTool, setActiveBlobTool] = useState<"colour" | "face" | "pupils" | null>(null);
  const [mood, setMood] = useState<HomeMood | null>(null);
  const [mindIntention, setMindIntention] = useState<BlobIntention | null>(null);
  const [mindDestination, setMindDestination] = useState<BlobDestination | null>(null);
  const [mindDepth, setMindDepth] = useState<number | null>(null);
  const [showScreens, setShowScreens] = useState(false);
  const [showActivity, setShowActivity] = useState(false);

  // Screen lifecycle. It owns only which screen is up and how far through it
  // is — Blob's personality keeps running underneath, untouched.
  const lifecycle = useRef<ScreenLifecycle>(null as never);
  if (lifecycle.current === null) lifecycle.current = new ScreenLifecycle();
  const [screenSnapshot, setScreenSnapshot] = useState<LifecycleSnapshot>(() =>
    lifecycle.current.update(0)
  );
  const [screenTime, setScreenTime] = useState(0);

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
  const [openMenu, setOpenMenu] = useState<TopMenuId | null>(null);
  const [expressionFilter, setExpressionFilter] =
    useState<ExpressionFilter>("ALL");
  const [expressionQuery, setExpressionQuery] = useState("");
  /** When true the panel rasterises at exactly 466x466 — real hardware pixels. */
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
    setEnvironmentStatus(null);
  }, [state]);

  useEffect(() => {
    const read = () => setDpr(window.devicePixelRatio || 1);
    read();
    window.addEventListener("resize", read);
    return () => window.removeEventListener("resize", read);
  }, []);

  // The outer size is decided by CSS so there is no layout shift; JS only
  // measures it to work out the 466 -> CSS pixel scale factor.
  // One loop drives the lifecycle clock. Screen visuals are then pure
  // functions of the snapshot, so pausing genuinely freezes them.
  useEffect(() => {
    let frameId = 0;
    let last = performance.now();
    let clock = 0;
    const tick = (now: number) => {
      frameId = requestAnimationFrame(tick);
      const delta = Math.min(now - last, 100);
      last = now;
      const snapshot = lifecycle.current.update(playing ? delta * speed : 0);
      if (playing && snapshot.playing) clock += delta * speed;
      setScreenTime(clock);
      setScreenSnapshot({ ...snapshot });
    };
    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [playing, speed]);

  // Picking a device state from the top nav is the same action as picking it
  // in the screen browser.
  useEffect(() => {
    lifecycle.current.select(state);
  }, [state]);

  const selectScreen = useCallback((id: ScreenId) => {
    lifecycle.current.select(id);
    if (isDeviceState(id)) setState(id);
  }, []);

  const playFlow = useCallback((flow: FlowId) => {
    lifecycle.current.playFlow(flow);
  }, []);

  const frameRef = useRef<HTMLDivElement>(null);
  const [outerSize, setOuterSize] = useState(DEFAULT_OUTER);

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
    setDisplayMode(DEFAULT_DISPLAY_MODE);
    setScreenColour(DISPLAY_BACKGROUNDS[DEFAULT_DISPLAY_MODE]);
    setBlobColour(DEFAULT_BLOB_COLOUR);
    setCharacterScale(DEFAULT_CHARACTER_SCALE);
    setScreenScale(1.2);
    setEnvironment(DEFAULT_ENVIRONMENT);
    setEnvironmentStatus(null);
    setShowPupils(false);
    setBlobToolsOpen(false);
    setActiveBlobTool(null);
    setMood(null);
    setMindIntention(null);
    setMindDestination(null);
    setMindDepth(null);
    setCalibration(DEFAULT_FACE_CALIBRATION);
    setIdle(DEFAULT_IDLE);
    setAutoBehaviourEnabled(true);
    setTrigger(null);
    setSaved(null);
    setShowExpressions(false);
    setShowScreens(false);
    setShowActivity(false);
    setOpenMenu(null);
    setExpressionFilter("ALL");
    setExpressionQuery("");
    setRunId((n) => n + 1);
  }, []);

  const screenSize = Math.round(outerSize / BEZEL_FACTOR);
  const meta = getStateMeta(state);

  // Rasterise at the resolution the panel is actually displayed at, so the
  // 466-space design is sampled finely enough to survive magnification.
  const renderScale = nativePixels
    ? 1
    : Math.min(
        4,
        Math.max(1, Math.ceil((screenSize * dpr) / DEVICE_CONFIG.resolution))
      );

  return (
    <div className="sim-ui relative flex min-h-[calc(100dvh-24px)] w-full flex-col items-center gap-3 sm:gap-4">
      <div className="sticky top-0 z-40 w-full max-w-[1500px] pt-2">
        <nav
          aria-label="Simulator settings"
          className="simulator-toolbar relative rounded-xl border border-white/[0.08] bg-white/[0.035] p-1.5 shadow-[0_12px_30px_rgba(0,0,0,0.14)] backdrop-blur-md"
        >
          <TopMenu label="State" summary={meta.label} open={openMenu === "state"} onToggle={() => setOpenMenu((v) => v === "state" ? null : "state")}>
            <p className="menu-kicker">Display state</p>
            <p className="menu-help">Choose device state to preview.</p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {DEVICE_STATES.map((item) => (
                <DevButton key={item.id} active={item.id === state} onClick={() => setState(item.id)}>
                  {item.label}
                </DevButton>
              ))}
            </div>
          </TopMenu>

          <TopMenu label="Playback" summary={`${fps} fps · ${speed}x`} open={openMenu === "playback"} onToggle={() => setOpenMenu((v) => v === "playback" ? null : "playback")}>
            <p className="menu-kicker">Playback</p>
            <p className="menu-help">Control time and preview frame rate.</p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <DevButton onClick={() => setPlaying((p) => !p)}>{playing ? "Pause" : "Play"}</DevButton>
              {DEVICE_CONFIG.fpsOptions.map((f) => <DevButton key={f} active={f === fps} onClick={() => setFps(f)}>FPS {f}</DevButton>)}
              {DEVICE_CONFIG.speedOptions.map((s) => <DevButton key={s} active={s === speed} onClick={() => setSpeed(s)}>{s}x</DevButton>)}
            </div>
          </TopMenu>

          <TopMenu label="Blob" summary={`${blobColour} · ${characterScale.toFixed(2)}x`} open={openMenu === "blob"} onToggle={() => setOpenMenu((v) => v === "blob" ? null : "blob")}>
            <p className="menu-kicker">Blob character</p>
            <p className="menu-help">Colour, idle life, mood and automatic behaviour.</p>
            <ChoiceGroup label="Colour">
              {BLOB_COLOURS.map((colour) => <DevButton key={colour.id} active={blobColour === colour.id} onClick={() => setBlobColour(colour.id)}>{colour.label}</DevButton>)}
            </ChoiceGroup>
            <ChoiceGroup label="Size">
              {[
                { label: "Micro", value: 0.68 },
                { label: "Tiny", value: 0.78 },
                { label: "Small", value: DEFAULT_CHARACTER_SCALE },
                { label: "Standard", value: 1 },
                { label: "Large", value: 1.12 },
              ].map((option) => <DevButton key={option.label} active={characterScale === option.value} onClick={() => setCharacterScale(option.value)}>{option.label}</DevButton>)}
            </ChoiceGroup>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <DevButton active={idle.enabled} onClick={() => setIdle((v) => ({ ...v, enabled: !v.enabled }))}>Idle {idle.enabled ? "on" : "off"}</DevButton>
              <DevButton active={autoBehaviourEnabled} onClick={() => setAutoBehaviourEnabled((v) => !v)}>Auto {autoBehaviourEnabled ? "on" : "off"}</DevButton>
            </div>
            <ChoiceGroup label="Mood">
              <DevButton active={mood === null} onClick={() => setMood(null)}>Auto</DevButton>
              {(["CONTENT", "CURIOUS", "SLEEPY", "AMUSED", "DISTRACTED", "THOUGHTFUL"] as const).map((option) => <DevButton key={option} active={mood === option} onClick={() => setMood(option)}>{option.toLowerCase()}</DevButton>)}
            </ChoiceGroup>
          </TopMenu>

          <TopMenu label="Motion" summary={mindDestination?.toLowerCase().replace("_", " ") ?? "auto"} open={openMenu === "motion"} onToggle={() => setOpenMenu((v) => v === "motion" ? null : "motion")}>
            <p className="menu-kicker">Motion and depth</p>
            <p className="menu-help">Direct Blob’s attention, destination and 3D preview.</p>
            <ChoiceGroup label="Mind">
              <DevButton active={mindIntention === null} onClick={() => setMindIntention(null)}>Auto</DevButton>
              {INTENTIONS.filter((option) => option !== "REST").map((option) => <DevButton key={option} active={mindIntention === option} onClick={() => setMindIntention(option)}>{option.toLowerCase()}</DevButton>)}
            </ChoiceGroup>
            <ChoiceGroup label="Target">
              <DevButton active={mindDestination === null} onClick={() => setMindDestination(null)}>Auto</DevButton>
              {DESTINATIONS.filter((option) => option !== "CENTER").map((option) => <DevButton key={option} active={mindDestination === option} onClick={() => setMindDestination(option)}>{option.replace("_", " ").toLowerCase()}</DevButton>)}
            </ChoiceGroup>
            <div className="mt-3 flex items-center gap-3">
              <span className="w-12 shrink-0 font-mono text-[10px] uppercase tracking-[0.15em] text-white/30">Depth</span>
              <input aria-label="Blob depth override" type="range" min={-0.2} max={0.2} step={0.01} value={mindDepth ?? 0} onChange={(event) => setMindDepth(Number(event.currentTarget.value))} className="h-1 min-w-0 flex-1 cursor-pointer appearance-none rounded-full bg-white/10 accent-[#8A60E8]" />
              <span className="w-12 shrink-0 text-right font-mono text-[10px] tabular-nums text-white/40">{mindDepth === null ? "auto" : mindDepth.toFixed(2)}</span>
              <DevButton active={mindDepth === null} onClick={() => setMindDepth(null)}>Auto</DevButton>
            </div>
            <ChoiceGroup label="3D tests">
              <DevButton onClick={() => fire("SPIN_360")}>Spin</DevButton>
              <DevButton onClick={() => fire("WALL_IMPACT_LEFT")}>Impact left</DevButton>
              <DevButton onClick={() => fire("WALL_IMPACT_RIGHT")}>Impact right</DevButton>
            </ChoiceGroup>
          </TopMenu>

          <TopMenu label="Screen" summary={`${displayMode} · ${screenScale.toFixed(2)}x`} open={openMenu === "screen"} onToggle={() => setOpenMenu((v) => v === "screen" ? null : "screen")}>
            <p className="menu-kicker">AMOLED screen</p>
            <p className="menu-help">Set the editable viewport size and preview the native pixel surface.</p>
            <ControlRange label="Viewport" value={screenScale} min={0.72} max={1.5} step={0.01} display={`${screenScale.toFixed(2)}x`} onChange={setScreenScale} />
            <label className="mt-3 flex items-center gap-2">
              <span className="w-14 shrink-0 font-mono text-[10px] uppercase tracking-[0.15em] text-white/30">Custom</span>
              <input aria-label="LCD screen background colour" type="color" value={screenColour} onChange={(event) => { setScreenColour(event.currentTarget.value); setDisplayMode("dark"); }} className="h-7 w-9 cursor-pointer rounded border border-white/[0.1] bg-transparent p-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/50" />
              <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-white/40">{screenColour}</span>
            </label>
            <DevButton active={nativePixels} onClick={() => setNativePixels((v) => !v)}>Native pixels 1:1 {nativePixels ? "on" : "off"}</DevButton>
          </TopMenu>

          <TopMenu label="Environment" summary={environment.enabled ? "sand · live" : "off"} open={openMenu === "environment"} onToggle={() => setOpenMenu((v) => v === "environment" ? null : "environment")} wide>
            <p className="menu-kicker">Miniature world</p>
            <p className="menu-help">Tune the sand, contact shadow, warm light and sparse dust around Blob.</p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <DevButton active={environment.enabled} onClick={() => setEnvironment((value) => ({ ...value, enabled: !value.enabled }))}>Environment {environment.enabled ? "on" : "off"}</DevButton>
              <DevButton active={environment.shadowEnabled} onClick={() => setEnvironment((value) => ({ ...value, shadowEnabled: !value.shadowEnabled }))}>Shadow</DevButton>
              <DevButton active={environment.particlesEnabled} onClick={() => setEnvironment((value) => ({ ...value, particlesEnabled: !value.particlesEnabled }))}>Dust</DevButton>
              <DevButton active={environment.bounceEnabled} onClick={() => setEnvironment((value) => ({ ...value, bounceEnabled: !value.bounceEnabled }))}>Bounce light</DevButton>
              <DevButton active={environment.parallaxEnabled} onClick={() => setEnvironment((value) => ({ ...value, parallaxEnabled: !value.parallaxEnabled }))}>Parallax</DevButton>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <ControlRange label="Shadow width" value={environment.shadowWidth} min={0.65} max={1.4} step={0.01} display={`${environment.shadowWidth.toFixed(2)}x`} onChange={(value) => setEnvironment((current) => ({ ...current, shadowWidth: value }))} />
              <ControlRange label="Shadow height" value={environment.shadowHeight} min={0.55} max={1.5} step={0.01} display={`${environment.shadowHeight.toFixed(2)}x`} onChange={(value) => setEnvironment((current) => ({ ...current, shadowHeight: value }))} />
              <ControlRange label="Shadow opacity" value={environment.shadowOpacity} min={0.1} max={0.9} step={0.01} display={environment.shadowOpacity.toFixed(2)} onChange={(value) => setEnvironment((current) => ({ ...current, shadowOpacity: value }))} />
              <ControlRange label="Softness" value={environment.shadowSoftness} min={0.35} max={0.95} step={0.01} display={environment.shadowSoftness.toFixed(2)} onChange={(value) => setEnvironment((current) => ({ ...current, shadowSoftness: value }))} />
              <ControlRange label="Shadow lag" value={environment.shadowLag} min={40} max={180} step={1} display={`${Math.round(environment.shadowLag)}ms`} onChange={(value) => setEnvironment((current) => ({ ...current, shadowLag: value }))} />
              <ControlRange label="Shadow Y" value={environment.shadowYOffset} min={-12} max={18} step={1} display={`${Math.round(environment.shadowYOffset)}px`} onChange={(value) => setEnvironment((current) => ({ ...current, shadowYOffset: value }))} />
              <ControlRange label="Dust count" value={environment.particleCount} min={0} max={8} step={1} display={`${Math.round(environment.particleCount)}`} onChange={(value) => setEnvironment((current) => ({ ...current, particleCount: value }))} />
              <ControlRange label="Dust speed" value={environment.particleSpeed} min={0.25} max={2} step={0.01} display={`${environment.particleSpeed.toFixed(2)}x`} onChange={(value) => setEnvironment((current) => ({ ...current, particleSpeed: value }))} />
              <ControlRange label="Ambient light" value={environment.ambientLight} min={0} max={1} step={0.01} display={environment.ambientLight.toFixed(2)} onChange={(value) => setEnvironment((current) => ({ ...current, ambientLight: value }))} />
              <ControlRange label="Bounce light" value={environment.bounceLight} min={0} max={1} step={0.01} display={environment.bounceLight.toFixed(2)} onChange={(value) => setEnvironment((current) => ({ ...current, bounceLight: value }))} />
              <ControlRange label="Parallax" value={environment.parallax} min={0} max={1} step={0.01} display={environment.parallax.toFixed(2)} onChange={(value) => setEnvironment((current) => ({ ...current, parallax: value }))} />
            </div>
            <div className="mt-4 rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
              <p className="menu-kicker">Environment readout</p>
              <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-white/45">
                <span>Blob height <b className="font-normal text-white/75">{environmentStatus?.blobHeight.toFixed(2) ?? "—"}</b></span>
                <span>Particles <b className="font-normal text-white/75">{environmentStatus?.particleCount ?? "—"}</b></span>
                <span>Shadow X <b className="font-normal text-white/75">{environmentStatus?.shadowScaleX.toFixed(2) ?? "—"}</b></span>
                <span>Shadow Y <b className="font-normal text-white/75">{environmentStatus?.shadowScaleY.toFixed(2) ?? "—"}</b></span>
                <span>Shadow alpha <b className="font-normal text-white/75">{environmentStatus?.shadowOpacity.toFixed(2) ?? "—"}</b></span>
                <span>Shadow offset <b className="font-normal text-white/75">{environmentStatus ? `${environmentStatus.shadowOffset.toFixed(1)}px` : "—"}</b></span>
              </div>
            </div>
          </TopMenu>

          <TopMenu label="Tools" summary={showExpressions ? "library open" : "tuning"} open={openMenu === "tools"} onToggle={() => setOpenMenu((v) => v === "tools" ? null : "tools")} wide>
            <p className="menu-kicker">Animation tools</p>
            <p className="menu-help">Tune motion, fire individual cues and browse state libraries.</p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <DevButton active={showCalibration} onClick={() => setShowCalibration((v) => !v)}>{showCalibration ? "Hide tuning" : "Show tuning"}</DevButton>
              <DevButton active={showExpressions} onClick={() => setShowExpressions((v) => !v)}>{showExpressions ? "Hide library" : "Open library"}</DevButton>
            </div>
            {showCalibration && <div className="mt-3 flex max-h-[min(64vh,620px)] flex-col gap-3 overflow-y-auto pr-1">
              <BehaviourPanel status={status} autoEnabled={autoBehaviourEnabled} onToggle={() => setAutoBehaviourEnabled((v) => !v)} onTrigger={fire} />
              <IdlePanel value={idle} onChange={setIdle} onReset={() => setIdle(DEFAULT_IDLE)} />
              <CalibrationPanel value={calibration} onChange={setCalibration} onReset={() => { setCalibration(DEFAULT_FACE_CALIBRATION); setSaved(null); }} saved={saved} onSave={() => setSaved(formatCalibration(calibration))} />
            </div>}
          </TopMenu>

          <div className="simulator-toolbar-reset">
            <DevButton onClick={reset}>Reset</DevButton>
          </div>
        </nav>
      </div>

      <div className="flex min-h-0 w-full flex-1 items-center justify-center">
        <div ref={frameRef} className="flex aspect-square w-full max-w-full items-center justify-center" style={{ width: `min(100%, ${Math.round(DEFAULT_OUTER * screenScale)}px, max(280px, calc(100dvh - 176px)))` }}>
          <DeviceBezel screenSize={screenSize}>
            <div className="relative">
              <ScreenStage
                screen={screenSnapshot.screen}
                progress={screenSnapshot.progress}
                simulated={screenSnapshot.simulated}
                time={screenTime}
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
                onOpenBlobTools={() => { if (!blobToolsOpen) { setBlobToolsOpen(true); setActiveBlobTool(null); } }}
                onCloseBlobTools={() => { setBlobToolsOpen(false); setActiveBlobTool(null); }}
                blobToolsOpen={blobToolsOpen}
                mood={mood}
                showPupils={showPupils}
                blobColour={blobColour}
                characterScale={characterScale}
                mindIntention={mindIntention}
                mindDestination={mindDestination}
                mindDepth={mindDepth}
                environment={environment}
                onEnvironmentStatus={setEnvironmentStatus}
              />
                <BlobToolOrbs open={blobToolsOpen} active={activeBlobTool} screenSize={screenSize} blobColour={blobColour} showPupils={showPupils} onSelect={(tool) => { setActiveBlobTool(tool); if (tool === "face") setShowExpressions(true); if (tool === "pupils") setShowPupils((value) => !value); }} onColourChange={setBlobColour} />
            </div>
          </DeviceBezel>
        </div>
      </div>

      <ScreenDrawer
        open={showScreens}
        snapshot={screenSnapshot}
        fps={fps}
        onToggle={() => {
          setShowScreens((value) => {
            const next = !value;
            if (next) setShowActivity(false);
            return next;
          });
          setOpenMenu(null);
        }}
        onSelect={selectScreen}
        onPlayFlow={playFlow}
        onPlay={() => { lifecycle.current.play(); setPlaying(true); }}
        onPause={() => lifecycle.current.pause()}
        onReplay={() => lifecycle.current.replay()}
        onReset={() => lifecycle.current.reset()}
        onFps={(value) => setFps(value as Fps)}
      />

      <ActivityDrawer
        open={showActivity}
        status={status}
        playing={playing}
        autoEnabled={autoBehaviourEnabled}
        idleEnabled={idle.enabled}
        onToggle={() => {
          setShowActivity((value) => {
            const next = !value;
            if (next) setShowScreens(false);
            return next;
          });
        }}
      />

      <SceneColourDots value={displayMode} onChange={(mode) => { setDisplayMode(mode); setScreenColour(DISPLAY_BACKGROUNDS[mode]); }} />

      {/* Dev readout — outside the device, never inside the panel */}
      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 font-mono text-[10px] uppercase tracking-[0.18em] text-white/25">
        <span>
          {DEVICE_CONFIG.resolution}&times;{DEVICE_CONFIG.resolution}
        </span>
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

type TopMenuId = "state" | "playback" | "blob" | "motion" | "screen" | "environment" | "tools";

function TopMenu({
  label,
  summary,
  open,
  onToggle,
  wide = false,
  children,
}: {
  label: string;
  summary: string;
  open: boolean;
  onToggle: () => void;
  wide?: boolean;
  children: React.ReactNode;
}) {
  const anchorRef = useRef<HTMLDivElement>(null);
  const [popoverPosition, setPopoverPosition] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);

  useLayoutEffect(() => {
    if (!open) {
      setPopoverPosition(null);
      return;
    }

    const updatePosition = () => {
      const anchor = anchorRef.current;
      if (!anchor) return;

      const rect = anchor.getBoundingClientRect();
      const viewportPadding = 12;
      const viewportWidth =
        document.documentElement.clientWidth || window.innerWidth;
      const width = Math.min(
        wide ? 540 : 420,
        Math.max(0, viewportWidth - viewportPadding * 2)
      );
      const maxHeight = Math.min(window.innerHeight * 0.7, 620);
      const top = Math.max(
        viewportPadding,
        Math.min(
          rect.bottom + 8,
          window.innerHeight - maxHeight - viewportPadding
        )
      );
      const left = Math.max(
        viewportPadding,
        Math.min(rect.left, viewportWidth - width - viewportPadding)
      );

      setPopoverPosition((previous) =>
        previous &&
        previous.top === top &&
        previous.left === left &&
        previous.width === width
          ? previous
          : { top, left, width }
      );
    };

    updatePosition();
    const anchor = anchorRef.current;
    const resizeObserver = anchor ? new ResizeObserver(updatePosition) : null;
    if (anchor && resizeObserver) resizeObserver.observe(anchor);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, wide]);

  return (
    <div ref={anchorRef} className="top-menu-anchor relative">
      <button type="button" aria-expanded={open} onClick={onToggle} className={`top-menu-trigger ${open ? "top-menu-trigger-active" : ""}`}>
        <span className="top-menu-label">{label}</span>
        <span className="top-menu-summary">{summary}</span>
        <span aria-hidden className={`top-menu-chevron ${open ? "rotate-180" : ""}`}>⌄</span>
      </button>
      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className={`top-menu-popover ${wide ? "top-menu-popover-wide" : ""}`}
            style={{
              top: popoverPosition?.top ?? 64,
              left: popoverPosition?.left ?? 12,
              width:
                popoverPosition?.width ??
                Math.min(wide ? 540 : 420, Math.max(0, window.innerWidth - 24)),
            }}
          >
            {children}
          </div>,
          document.body
        )}
    </div>
  );
}

function SceneColourDots({ value, onChange }: { value: DisplayMode; onChange: (mode: DisplayMode) => void }) {
  const options: { mode: DisplayMode; label: string; colour: string }[] = [
    { mode: "dark", label: "True black AMOLED", colour: "#000000" },
    { mode: "warm", label: "Warm inspection screen", colour: "#d4c9bb" },
    { mode: "brown", label: "Brown inspection screen", colour: "#a58d76" },
  ];
  return (
    <div className="flex items-center gap-3" aria-label="Scene colour">
      <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-white/30">Scene</span>
      <div className="flex items-center gap-2">
        {options.map((option) => <button key={option.mode} type="button" aria-label={option.label} aria-pressed={value === option.mode} onClick={() => onChange(option.mode)} className={`scene-colour-dot ${value === option.mode ? "scene-colour-dot-active" : ""}`} style={{ backgroundColor: option.colour }} />)}
      </div>
    </div>
  );
}

function ChoiceGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
      <span className="w-14 shrink-0 font-mono text-[10px] uppercase tracking-[0.15em] text-white/30">
        {label}
      </span>
      <div className="flex min-w-0 flex-wrap items-center gap-1.5">{children}</div>
    </div>
  );
}

function ControlRange({
  label,
  value,
  min,
  max,
  step,
  display,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  display: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="flex min-w-0 items-center gap-2 rounded-md border border-white/[0.05] bg-white/[0.015] px-2.5 py-2">
      <span className="w-20 shrink-0 font-mono text-[9px] uppercase tracking-[0.12em] text-white/35">
        {label}
      </span>
      <input
        aria-label={label}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.currentTarget.value))}
        className="h-1 min-w-0 flex-1 cursor-pointer appearance-none rounded-full bg-white/10 accent-[#8A60E8]"
      />
      <output className="w-12 shrink-0 text-right font-mono text-[10px] tabular-nums text-white/55">
        {display}
      </output>
    </label>
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
  });

  return (
    <div className="pointer-events-none absolute inset-0 z-30">
      <div
        className="blob-tool-orb blob-tool-orb-left pointer-events-auto absolute"
        style={orbStyle("25%", 0.13)}
      >
        <OrbButton active={active === "colour"} label="Blob colour" onClick={() => onSelect("colour")}>
          <span className="h-4 w-4 rounded-full border border-white/70" style={{ background: blobColourSwatch(blobColour) }} />
        </OrbButton>
      </div>
      <div className="blob-tool-orb blob-tool-orb-center pointer-events-auto absolute" style={orbStyle("50%", 0.055)}>
        <OrbButton active={active === "face"} label="Eyes and mouth settings" onClick={() => onSelect("face")}>
          <span className="text-[17px] leading-none">☺</span>
        </OrbButton>
      </div>
      <div
        className="blob-tool-orb blob-tool-orb-right pointer-events-auto absolute"
        style={orbStyle("75%", 0.13)}
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
 * Defaults are tuned for native 466x466 readability while remaining restrained.
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
 * Offsets are in 466-space pixels, so 1 unit is one real pixel on the target
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

function ScreenDrawer({
  open,
  snapshot,
  fps,
  onToggle,
  onSelect,
  onPlayFlow,
  onPlay,
  onPause,
  onReplay,
  onReset,
  onFps,
}: {
  open: boolean;
  snapshot: LifecycleSnapshot;
  fps: Fps;
  onToggle: () => void;
  onSelect: (id: ScreenId) => void;
  onPlayFlow: (flow: FlowId) => void;
  onPlay: () => void;
  onPause: () => void;
  onReplay: () => void;
  onReset: () => void;
  onFps: (fps: number) => void;
}) {
  return (
    <div className="screen-drawer-shell pointer-events-none fixed left-0 z-50">
      <div
        className="screen-drawer-track flex items-end transition-transform duration-200 ease-out"
        style={{ transform: open ? "translateX(0)" : "translateX(calc(-100% + 2.75rem))" }}
      >
        <aside
          id="screen-browser"
          aria-label="Screen browser"
          className="screen-drawer-panel pointer-events-auto flex min-h-0 flex-col overflow-hidden rounded-r-xl border border-l-0 shadow-2xl"
          style={{
            background: "var(--dev-panel-bg)",
            borderColor: "var(--dev-panel-border)",
          }}
        >
          <ScreenBrowser
            snapshot={snapshot}
            fps={fps}
            nativeResolution={DEVICE_CONFIG.resolution}
            onSelect={onSelect}
            onPlayFlow={onPlayFlow}
            onPlay={onPlay}
            onPause={onPause}
            onReplay={onReplay}
            onReset={onReset}
            onFps={onFps}
            onClose={onToggle}
          />
        </aside>
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-controls="screen-browser"
          className="drawer-tab drawer-tab-screens pointer-events-auto flex shrink-0 items-center justify-center rounded-r-xl border border-l-0 bg-black/40 text-white/55 shadow-xl transition-colors hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/50"
        >
          <span
            className="font-mono text-[9px] uppercase tracking-[0.2em]"
            style={{ writingMode: "vertical-rl" }}
          >
            Screens
          </span>
        </button>
      </div>
    </div>
  );
}

function ActivityDrawer({
  open,
  status,
  playing,
  autoEnabled,
  idleEnabled,
  onToggle,
}: {
  open: boolean;
  status: HomeActivityStatus | null;
  playing: boolean;
  autoEnabled: boolean;
  idleEnabled: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="activity-drawer-shell pointer-events-none fixed bottom-4 left-0 z-50">
      <div
        className="activity-drawer-track flex items-end transition-transform duration-200 ease-out"
        style={{ transform: open ? "translateX(0)" : "translateX(calc(-100% + 2.75rem))" }}
      >
        <aside
          id="activity-readout"
          aria-label="Live activity"
          className="activity-drawer-panel pointer-events-auto flex min-h-0 flex-col gap-3 overflow-y-auto rounded-r-xl border border-l-0 p-4 shadow-2xl"
          style={{
            background: "var(--dev-panel-bg)",
            borderColor: "var(--dev-panel-border)",
          }}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="menu-kicker">Live activity</p>
              <p className="menu-help">Current intent, expression, body state and timing.</p>
            </div>
            <button
              type="button"
              onClick={onToggle}
              aria-label="Close activity panel"
              className="rounded-md px-1.5 text-lg leading-none text-white/35 transition-colors hover:text-white/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/50"
            >
              ×
            </button>
          </div>
          <ActivityReadout
            status={status}
            playing={playing}
            autoEnabled={autoEnabled}
            idleEnabled={idleEnabled}
            compact
          />
        </aside>
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-controls="activity-readout"
          className="drawer-tab drawer-tab-activity pointer-events-auto flex shrink-0 items-center justify-center rounded-r-xl border border-l-0 bg-black/40 text-white/55 shadow-xl transition-colors hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/50"
        >
          <span
            className="font-mono text-[9px] uppercase tracking-[0.2em]"
            style={{ writingMode: "vertical-rl" }}
          >
            Activity
          </span>
        </button>
      </div>
    </div>
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
    <div className="expression-drawer-shell pointer-events-none fixed inset-y-0 z-50 flex items-center">
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
  compact = false,
}: {
  status: HomeActivityStatus | null;
  playing: boolean;
  autoEnabled: boolean;
  idleEnabled: boolean;
  compact?: boolean;
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
    <div className={`grid w-full max-w-2xl grid-cols-2 gap-x-5 gap-y-3 rounded-lg border border-white/[0.06] bg-white/[0.015] px-4 py-3 font-mono text-[10px] ${compact ? "" : "sm:grid-cols-5"}`}>
      <ActivityValue label="Activity" value={behaviour} accent />
      <ActivityValue label="Next" value={next} />
      <ActivityValue label="Mood" value={status?.mood ?? "CONTENT"} />
      <ActivityValue label="Intention" value={status?.intention ?? "REST"} accent />
      <ActivityValue label="Story" value={status?.story ?? "SETTLE_CENTER"} />
      <ActivityValue label="Destination" value={status?.destination ?? "CENTER"} />
      <ActivityValue
        label="Energy / curiosity"
        value={`${((status?.energy ?? 0.62) * 100).toFixed(0)}% / ${((status?.curiosity ?? 0.58) * 100).toFixed(0)}%`}
      />
      <ActivityValue
        label="Social / comfort"
        value={`${((status?.social ?? 0.5) * 100).toFixed(0)}% / ${((status?.comfort ?? 0.8) * 100).toFixed(0)}%`}
      />
      <ActivityValue
        label="Bored / habituated"
        value={`${((status?.boredom ?? 0) * 100).toFixed(0)}% / ${((status?.habituation ?? 1) * 100).toFixed(0)}%`}
      />
      <ActivityValue label="Memory" value={status?.memory ?? "new"} />
      <ActivityValue label="Gaze" value={status?.gaze ?? "RESTING"} />
      <ActivityValue label="Lids" value={status?.lids ?? "OPEN"} />
      <ActivityValue label="Mouth" value={status?.mouth ?? "SMILE"} />
      <ActivityValue label="Body" value={status?.body ?? "SUSPENDED"} />
      <ActivityValue
        label="Depth / turn"
        value={`${(status?.depth ?? 0).toFixed(2)} / ${(status?.yaw ?? 0).toFixed(1)}°`}
      />
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

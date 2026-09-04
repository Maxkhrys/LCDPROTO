"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import DeviceBezel from "./DeviceBezel";
import ControlCenter, {
  type ControlSectionDefinition,
  type ControlSectionId,
} from "./ControlCenter";
import ScreenStage from "@/components/screens/ScreenStage";
import ScreenBrowser from "@/components/screens/ScreenBrowser";
import EmojiMakerPanel from "./EmojiMakerPanel";
import PerformanceLabPanel from "./PerformanceLabPanel";
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
  const [activeBlobTool, setActiveBlobTool] = useState<"colour" | "face" | "performance" | "pupils" | null>(null);
  const [mood, setMood] = useState<HomeMood | null>(null);
  const [mindIntention, setMindIntention] = useState<BlobIntention | null>(null);
  const [mindDestination, setMindDestination] = useState<BlobDestination | null>(null);
  const [mindDepth, setMindDepth] = useState<number | null>(null);
  const [controlsOpen, setControlsOpen] = useState(false);
  const [activeControl, setActiveControl] =
    useState<ControlSectionId>("screens");

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
  const [toolPanel, setToolPanel] =
    useState<"behaviour" | "idle" | "face">("behaviour");
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
    setControlsOpen(false);
    setActiveControl("screens");
    setToolPanel("behaviour");
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

  const controlSections: ControlSectionDefinition[] = [
    {
      id: "screens",
      label: "Screens",
      description: "Browse every lifecycle screen, run flows, and inspect timing.",
      summary: screenSnapshot.screen.replaceAll("_", " ").toLowerCase(),
      group: "Monitor",
    },
    {
      id: "activity",
      label: "Activity",
      description: "Watch Blob's live intent, face, body, motion, and scheduler.",
      summary: status?.id?.replaceAll("_", " ").toLowerCase() ?? "rest",
      group: "Monitor",
    },
    {
      id: "blob",
      label: "Blob",
      description: "Set character colour, scale, mood, and automatic behaviour.",
      summary: `${blobColour} · ${characterScale.toFixed(2)}x`,
      group: "Character",
    },
    {
      id: "motion",
      label: "Motion",
      description: "Direct attention, travel target, depth, and physical tests.",
      summary: mindDestination?.replaceAll("_", " ").toLowerCase() ?? "auto",
      group: "Character",
    },
    {
      id: "expressions",
      label: "Expressions",
      description: "Search the authored cue library and fire expressions directly.",
      summary: meta.label.toLowerCase(),
      group: "Character",
    },
    {
      id: "emoji",
      label: "Expression Maker",
      description: "Build a face recipe, preview it on Blob, and export a native PNG or TS code.",
      summary: "face editor",
      group: "Character",
    },
    {
      id: "performance",
      label: "Performance Lab",
      description: "Pair facial expressions with physical acting and scrub the keyframe timeline.",
      summary: "acting studio",
      group: "Character",
    },
    {
      id: "display",
      label: "Display",
      description: "Tune the AMOLED viewport, scene colour, and pixel sampling.",
      summary: `${displayMode} · ${screenScale.toFixed(2)}x`,
      group: "World",
    },
    {
      id: "environment",
      label: "Environment",
      description: "Tune sand, contact shadow, warm light, dust, and parallax.",
      summary: environment.enabled ? "world live" : "off",
      group: "World",
    },
    {
      id: "state",
      label: "State",
      description: "Choose the device state currently shown on the round display.",
      summary: meta.label.toLowerCase(),
      group: "System",
    },
    {
      id: "playback",
      label: "Playback",
      description: "Control time, speed, and the target preview frame rate.",
      summary: `${fps} fps · ${speed}x`,
      group: "System",
    },
    {
      id: "tools",
      label: "Tuning",
      description: "Inspect behaviours, idle motion, and face-layer calibration.",
      summary: toolPanel,
      group: "System",
    },
  ];

  const controlContent = (() => {
    switch (activeControl) {
      case "screens":
        return (
          <ScreenBrowser
            snapshot={screenSnapshot}
            fps={fps}
            nativeResolution={DEVICE_CONFIG.resolution}
            onSelect={selectScreen}
            onPlayFlow={playFlow}
            onPlay={() => {
              lifecycle.current.play();
              setPlaying(true);
            }}
            onPause={() => lifecycle.current.pause()}
            onReplay={() => lifecycle.current.replay()}
            onReset={() => lifecycle.current.reset()}
            onFps={(value) => setFps(value as Fps)}
          />
        );
      case "activity":
        return (
          <ActivityReadout
            status={status}
            playing={playing}
            autoEnabled={autoBehaviourEnabled}
            idleEnabled={idle.enabled}
          />
        );
      case "state":
        return (
          <ControlCard
            title="Device state"
            description="Selecting a state also selects its matching lifecycle screen."
          >
            <div className="control-button-grid">
              {DEVICE_STATES.map((item) => (
                <DevButton
                  key={item.id}
                  active={item.id === state}
                  onClick={() => setState(item.id)}
                >
                  {item.label}
                </DevButton>
              ))}
            </div>
          </ControlCard>
        );
      case "playback":
        return (
          <div className="control-card-stack">
            <ControlCard title="Transport" description="Pause or resume the full simulator clock.">
              <div className="control-button-grid">
                <DevButton active={playing} onClick={() => setPlaying((value) => !value)}>
                  {playing ? "Pause playback" : "Resume playback"}
                </DevButton>
                {DEVICE_CONFIG.speedOptions.map((option) => (
                  <DevButton
                    key={option}
                    active={option === speed}
                    onClick={() => setSpeed(option)}
                  >
                    Speed {option}x
                  </DevButton>
                ))}
              </div>
            </ControlCard>
            <ControlCard title="Frame rate" description="Preview the controller at its target cadence.">
              <div className="control-button-grid">
                {DEVICE_CONFIG.fpsOptions.map((option) => (
                  <DevButton key={option} active={option === fps} onClick={() => setFps(option)}>
                    {option} FPS
                  </DevButton>
                ))}
              </div>
            </ControlCard>
          </div>
        );
      case "blob":
        return (
          <div className="control-card-stack">
            <ControlCard title="Character colour">
              <ChoiceGroup label="Colour">
                {BLOB_COLOURS.map((colour) => (
                  <DevButton
                    key={colour.id}
                    active={blobColour === colour.id}
                    onClick={() => setBlobColour(colour.id)}
                  >
                    {colour.label}
                  </DevButton>
                ))}
              </ChoiceGroup>
            </ControlCard>
            <ControlCard title="Character scale" description="Five bounded preview sizes, with Small as default.">
              <ChoiceGroup label="Size">
                {[
                  { label: "Micro", value: 0.68 },
                  { label: "Tiny", value: 0.78 },
                  { label: "Small", value: DEFAULT_CHARACTER_SCALE },
                  { label: "Standard", value: 1 },
                  { label: "Large", value: 1.12 },
                ].map((option) => (
                  <DevButton
                    key={option.label}
                    active={characterScale === option.value}
                    onClick={() => setCharacterScale(option.value)}
                  >
                    {option.label}
                  </DevButton>
                ))}
              </ChoiceGroup>
            </ControlCard>
            <ControlCard title="Personality" description="Automatic values continue unless manually overridden.">
              <ChoiceGroup label="Systems">
                <DevButton
                  active={idle.enabled}
                  onClick={() => setIdle((value) => ({ ...value, enabled: !value.enabled }))}
                >
                  Idle {idle.enabled ? "on" : "off"}
                </DevButton>
                <DevButton
                  active={autoBehaviourEnabled}
                  onClick={() => setAutoBehaviourEnabled((value) => !value)}
                >
                  Auto {autoBehaviourEnabled ? "on" : "off"}
                </DevButton>
              </ChoiceGroup>
              <ChoiceGroup label="Mood">
                <DevButton active={mood === null} onClick={() => setMood(null)}>
                  Automatic
                </DevButton>
                {(["CONTENT", "CURIOUS", "SLEEPY", "AMUSED", "DISTRACTED", "THOUGHTFUL"] as const).map(
                  (option) => (
                    <DevButton key={option} active={mood === option} onClick={() => setMood(option)}>
                      {option.toLowerCase()}
                    </DevButton>
                  )
                )}
              </ChoiceGroup>
            </ControlCard>
          </div>
        );
      case "motion":
        return (
          <div className="control-card-stack">
            <ControlCard title="Mind and destination" description="Use Automatic to return control to the scheduler.">
              <ChoiceGroup label="Intention">
                <DevButton active={mindIntention === null} onClick={() => setMindIntention(null)}>
                  Automatic
                </DevButton>
                {INTENTIONS.filter((option) => option !== "REST").map((option) => (
                  <DevButton
                    key={option}
                    active={mindIntention === option}
                    onClick={() => setMindIntention(option)}
                  >
                    {option.toLowerCase()}
                  </DevButton>
                ))}
              </ChoiceGroup>
              <ChoiceGroup label="Destination">
                <DevButton active={mindDestination === null} onClick={() => setMindDestination(null)}>
                  Automatic
                </DevButton>
                {DESTINATIONS.filter((option) => option !== "CENTER").map((option) => (
                  <DevButton
                    key={option}
                    active={mindDestination === option}
                    onClick={() => setMindDestination(option)}
                  >
                    {option.replaceAll("_", " ").toLowerCase()}
                  </DevButton>
                ))}
              </ChoiceGroup>
            </ControlCard>
            <ControlCard title="Depth override" description="Restricted to the authored ±0.20 depth range.">
              <ControlRange
                label="Depth"
                value={mindDepth ?? 0}
                min={-0.2}
                max={0.2}
                step={0.01}
                display={mindDepth === null ? "auto" : mindDepth.toFixed(2)}
                onChange={setMindDepth}
              />
              <div className="control-inline-action">
                <DevButton active={mindDepth === null} onClick={() => setMindDepth(null)}>
                  Return to automatic depth
                </DevButton>
              </div>
            </ControlCard>
            <ControlCard title="Physical tests">
              <div className="control-button-grid">
                <DevButton onClick={() => fire("SPIN_360")}>Spin 360</DevButton>
                <DevButton onClick={() => fire("WALL_IMPACT_LEFT")}>Impact left</DevButton>
                <DevButton onClick={() => fire("WALL_IMPACT_RIGHT")}>Impact right</DevButton>
              </div>
            </ControlCard>
          </div>
        );
      case "display":
        return (
          <div className="control-card-stack">
            <ControlCard title="Viewport" description="Changes editor size only; authored math remains 466 × 466.">
              <ControlRange
                label="Preview scale"
                value={screenScale}
                min={0.72}
                max={1.5}
                step={0.01}
                display={`${screenScale.toFixed(2)}x`}
                onChange={setScreenScale}
              />
              <div className="control-inline-action">
                <DevButton active={nativePixels} onClick={() => setNativePixels((value) => !value)}>
                  Native pixels 1:1 {nativePixels ? "on" : "off"}
                </DevButton>
              </div>
            </ControlCard>
            <ControlCard title="Inspection scene" description="Brown is the default environment inspection mode.">
              <SceneColourDots
                value={displayMode}
                onChange={(mode) => {
                  setDisplayMode(mode);
                  setScreenColour(DISPLAY_BACKGROUNDS[mode]);
                }}
              />
              <label className="control-colour-field">
                <span>
                  <strong>Custom background</strong>
                  <small>Choosing a custom colour switches to dark mode.</small>
                </span>
                <input
                  aria-label="LCD screen background colour"
                  type="color"
                  value={screenColour}
                  onChange={(event) => {
                    setScreenColour(event.currentTarget.value);
                    setDisplayMode("dark");
                  }}
                />
                <output>{screenColour}</output>
              </label>
            </ControlCard>
          </div>
        );
      case "environment":
        return (
          <div className="control-card-stack">
            <ControlCard title="World layers" description="Toggle each environmental layer without changing Blob artwork.">
              <div className="control-button-grid">
                <DevButton
                  active={environment.enabled}
                  onClick={() => setEnvironment((value) => ({ ...value, enabled: !value.enabled }))}
                >
                  Environment {environment.enabled ? "on" : "off"}
                </DevButton>
                <DevButton
                  active={environment.shadowEnabled}
                  onClick={() => setEnvironment((value) => ({ ...value, shadowEnabled: !value.shadowEnabled }))}
                >
                  Contact shadow
                </DevButton>
                <DevButton
                  active={environment.particlesEnabled}
                  onClick={() => setEnvironment((value) => ({ ...value, particlesEnabled: !value.particlesEnabled }))}
                >
                  Dust
                </DevButton>
                <DevButton
                  active={environment.bounceEnabled}
                  onClick={() => setEnvironment((value) => ({ ...value, bounceEnabled: !value.bounceEnabled }))}
                >
                  Bounce light
                </DevButton>
                <DevButton
                  active={environment.parallaxEnabled}
                  onClick={() => setEnvironment((value) => ({ ...value, parallaxEnabled: !value.parallaxEnabled }))}
                >
                  Parallax
                </DevButton>
              </div>
            </ControlCard>
            <ControlCard title="Shadow geometry">
              <div className="control-range-grid">
                <ControlRange label="Width" value={environment.shadowWidth} min={0.65} max={1.4} step={0.01} display={`${environment.shadowWidth.toFixed(2)}x`} onChange={(value) => setEnvironment((current) => ({ ...current, shadowWidth: value }))} />
                <ControlRange label="Height" value={environment.shadowHeight} min={0.55} max={1.5} step={0.01} display={`${environment.shadowHeight.toFixed(2)}x`} onChange={(value) => setEnvironment((current) => ({ ...current, shadowHeight: value }))} />
                <ControlRange label="Opacity" value={environment.shadowOpacity} min={0.1} max={0.9} step={0.01} display={environment.shadowOpacity.toFixed(2)} onChange={(value) => setEnvironment((current) => ({ ...current, shadowOpacity: value }))} />
                <ControlRange label="Softness" value={environment.shadowSoftness} min={0.35} max={0.95} step={0.01} display={environment.shadowSoftness.toFixed(2)} onChange={(value) => setEnvironment((current) => ({ ...current, shadowSoftness: value }))} />
                <ControlRange label="Lag" value={environment.shadowLag} min={40} max={180} step={1} display={`${Math.round(environment.shadowLag)}ms`} onChange={(value) => setEnvironment((current) => ({ ...current, shadowLag: value }))} />
                <ControlRange label="Vertical offset" value={environment.shadowYOffset} min={-12} max={18} step={1} display={`${Math.round(environment.shadowYOffset)}px`} onChange={(value) => setEnvironment((current) => ({ ...current, shadowYOffset: value }))} />
              </div>
            </ControlCard>
            <ControlCard title="Atmosphere">
              <div className="control-range-grid">
                <ControlRange label="Dust count" value={environment.particleCount} min={0} max={8} step={1} display={`${Math.round(environment.particleCount)}`} onChange={(value) => setEnvironment((current) => ({ ...current, particleCount: value }))} />
                <ControlRange label="Dust speed" value={environment.particleSpeed} min={0.25} max={2} step={0.01} display={`${environment.particleSpeed.toFixed(2)}x`} onChange={(value) => setEnvironment((current) => ({ ...current, particleSpeed: value }))} />
                <ControlRange label="Ambient light" value={environment.ambientLight} min={0} max={1} step={0.01} display={environment.ambientLight.toFixed(2)} onChange={(value) => setEnvironment((current) => ({ ...current, ambientLight: value }))} />
                <ControlRange label="Bounce light" value={environment.bounceLight} min={0} max={1} step={0.01} display={environment.bounceLight.toFixed(2)} onChange={(value) => setEnvironment((current) => ({ ...current, bounceLight: value }))} />
                <ControlRange label="Parallax" value={environment.parallax} min={0} max={1} step={0.01} display={environment.parallax.toFixed(2)} onChange={(value) => setEnvironment((current) => ({ ...current, parallax: value }))} />
              </div>
            </ControlCard>
            <EnvironmentReadout status={environmentStatus} />
          </div>
        );
      case "tools":
        return (
          <div className="control-card-stack">
            <div className="control-subnav" role="tablist" aria-label="Tuning tools">
              {(["behaviour", "idle", "face"] as const).map((panel) => (
                <button
                  key={panel}
                  type="button"
                  role="tab"
                  aria-selected={toolPanel === panel}
                  className={toolPanel === panel ? "control-subnav-active" : ""}
                  onClick={() => setToolPanel(panel)}
                >
                  {panel === "face" ? "Face calibration" : panel}
                </button>
              ))}
            </div>
            {toolPanel === "behaviour" && (
              <BehaviourPanel
                status={status}
                autoEnabled={autoBehaviourEnabled}
                onToggle={() => setAutoBehaviourEnabled((value) => !value)}
                onTrigger={fire}
              />
            )}
            {toolPanel === "idle" && (
              <IdlePanel value={idle} onChange={setIdle} onReset={() => setIdle(DEFAULT_IDLE)} />
            )}
            {toolPanel === "face" && (
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
          </div>
        );
      case "expressions":
        return (
          <ExpressionLibrary
            state={state}
            filter={expressionFilter}
            query={expressionQuery}
            onStateChange={(next) => {
              setState(next);
              setExpressionFilter("ALL");
            }}
            onFilterChange={setExpressionFilter}
            onQueryChange={setExpressionQuery}
            onTrigger={fire}
          />
        );
      case "emoji":
        return <EmojiMakerPanel colour={blobColour} />;
      case "performance":
        return <PerformanceLabPanel colour={blobColour} />;
    }
  })();

  return (
    <div className="sim-ui relative flex min-h-[calc(100dvh-24px)] w-full flex-col items-center gap-3 sm:gap-4">
      <ControlCenter
        open={controlsOpen}
        active={activeControl}
        sections={controlSections}
        onOpenChange={setControlsOpen}
        onActiveChange={setActiveControl}
        onReset={reset}
      >
        {controlContent}
      </ControlCenter>

      <div className="flex min-h-0 w-full flex-1 items-center justify-center">
        <div ref={frameRef} className="flex aspect-square w-full max-w-full items-center justify-center" style={{ width: `min(100%, ${Math.round(DEFAULT_OUTER * screenScale)}px, max(280px, calc(100dvh - 76px)))` }}>
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
                <BlobToolOrbs
                  open={blobToolsOpen}
                  active={activeBlobTool}
                  screenSize={screenSize}
                  blobColour={blobColour}
                  showPupils={showPupils}
                  onSelect={(tool) => {
                    setActiveBlobTool(tool);
                    if (tool === "face") {
                      setActiveControl("emoji");
                      setControlsOpen(true);
                    }
                    if (tool === "performance") {
                      setActiveControl("performance");
                      setControlsOpen(true);
                    }
                    if (tool === "pupils") setShowPupils((value) => !value);
                  }}
                  onColourChange={setBlobColour}
                />
            </div>
          </DeviceBezel>
        </div>
      </div>

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
    </div>
  );
}

function ControlCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="control-card">
      <div className="control-card-heading">
        <h2>{title}</h2>
        {description && <p>{description}</p>}
      </div>
      <div className="control-card-body">{children}</div>
    </section>
  );
}

function EnvironmentReadout({ status }: { status: EnvironmentStatus | null }) {
  return (
    <ControlCard title="Live environment readout">
      <div className="environment-readout">
        <ActivityValue label="Blob height" value={status?.blobHeight.toFixed(2) ?? "—"} />
        <ActivityValue label="Particles" value={`${status?.particleCount ?? "—"}`} />
        <ActivityValue label="Shadow width" value={status?.shadowScaleX.toFixed(2) ?? "—"} />
        <ActivityValue label="Shadow height" value={status?.shadowScaleY.toFixed(2) ?? "—"} />
        <ActivityValue label="Shadow alpha" value={status?.shadowOpacity.toFixed(2) ?? "—"} />
        <ActivityValue
          label="Shadow offset"
          value={status ? `${status.shadowOffset.toFixed(1)} px` : "—"}
        />
      </div>
    </ControlCard>
  );
}

function SceneColourDots({ value, onChange }: { value: DisplayMode; onChange: (mode: DisplayMode) => void }) {
  const options: { mode: DisplayMode; label: string; colour: string }[] = [
    { mode: "dark", label: "True black AMOLED", colour: "#000000" },
    { mode: "warm", label: "Warm inspection screen", colour: "#d4c9bb" },
    { mode: "brown", label: "Brown inspection screen", colour: "#a58d76" },
  ];
  return (
    <div className="scene-colour-options" aria-label="Scene colour" role="group">
      {options.map((option) => (
        <button
          key={option.mode}
          type="button"
          aria-pressed={value === option.mode}
          onClick={() => onChange(option.mode)}
          className={`scene-colour-option ${value === option.mode ? "scene-colour-option-active" : ""}`}
        >
          <span className="scene-colour-dot" style={{ backgroundColor: option.colour }} />
          <span>
            <strong>{option.mode === "dark" ? "AMOLED black" : option.mode}</strong>
            <small>{option.label}</small>
          </span>
        </button>
      ))}
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
    <div className="choice-group">
      <span>{label}</span>
      <div>{children}</div>
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
    <label className="control-range-field">
      <span className="control-range-label">{label}</span>
      <output>{display}</output>
      <input
        aria-label={label}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.currentTarget.value))}
        className="control-range-input"
      />
    </label>
  );
}

type BlobTool = "colour" | "face" | "performance" | "pupils";

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
  const orbSize = Math.max(32, Math.min(48, screenSize * 0.125));
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
        style={orbStyle("18%", 0.14)}
      >
        <OrbButton active={active === "colour"} label="Blob colour" onClick={() => onSelect("colour")}>
          <span className="h-4 w-4 rounded-full border border-white/70" style={{ background: blobColourSwatch(blobColour) }} />
        </OrbButton>
      </div>
      <div
        className="blob-tool-orb blob-tool-orb-face pointer-events-auto absolute"
        style={orbStyle("38%", 0.06)}
      >
        <OrbButton active={active === "face"} label="Expression Maker" onClick={() => onSelect("face")}>
          <span className="text-[17px] leading-none">☺</span>
        </OrbButton>
      </div>
      <div
        className="blob-tool-orb blob-tool-orb-performance pointer-events-auto absolute"
        style={orbStyle("62%", 0.06)}
      >
        <OrbButton active={active === "performance"} label="Performance Lab" onClick={() => onSelect("performance")}>
          <span className="text-[16px] leading-none">🎭</span>
        </OrbButton>
      </div>
      <div
        className="blob-tool-orb blob-tool-orb-right pointer-events-auto absolute"
        style={orbStyle("82%", 0.14)}
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
      className={`dev-control-button ${active ? "dev-control-button-active" : ""}`}
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
    <div className="tuning-panel flex w-full flex-col gap-3">
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
    <div className="tuning-panel flex w-full flex-col gap-4">
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
    <label className="tuning-slider">
      <span>{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="control-range-input"
      />
      <output>
        {format(value)}
      </output>
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
    <div className="tuning-panel flex w-full flex-col gap-3">
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

function ExpressionLibrary({
  state,
  filter,
  query,
  onStateChange,
  onFilterChange,
  onQueryChange,
  onTrigger,
}: {
  state: DeviceState;
  filter: ExpressionFilter;
  query: string;
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
    <div id="expression-library" className="expression-library">
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
    <div className="activity-dashboard">
      <section className="activity-hero">
        <div>
          <span>Current activity</span>
          <strong>{behaviour.replaceAll("_", " ")}</strong>
        </div>
        <div>
          <span>Scheduler</span>
          <strong>{next}</strong>
        </div>
        <div className="activity-system-state">
          <span>{playing ? "Running" : "Paused"}</span>
          <span>{autoEnabled ? "Automatic" : "Manual"}</span>
          <span>{idleEnabled ? "Idle life on" : "Idle life off"}</span>
        </div>
      </section>

      <div className="activity-card-grid">
        <ActivityGroup title="Mind">
          <ActivityValue label="Mood" value={status?.mood ?? "CONTENT"} />
          <ActivityValue label="Intention" value={status?.intention ?? "REST"} accent />
          <ActivityValue label="Destination" value={status?.destination ?? "CENTER"} />
          <ActivityValue label="Story" value={status?.story ?? "SETTLE_CENTER"} />
          <ActivityValue
            label="Energy / curiosity"
            value={`${((status?.energy ?? 0.62) * 100).toFixed(0)}% / ${((status?.curiosity ?? 0.58) * 100).toFixed(0)}%`}
          />
          <ActivityValue label="Memory" value={status?.memory ?? "new"} />
        </ActivityGroup>
        <ActivityGroup title="Face">
          <ActivityValue label="Gaze" value={status?.gaze ?? "RESTING"} />
          <ActivityValue label="Lids" value={status?.lids ?? "OPEN"} />
          <ActivityValue label="Mouth" value={status?.mouth ?? "SMILE"} />
          <ActivityValue label="Blink" value={blink} />
        </ActivityGroup>
        <ActivityGroup title="Body and motion">
          <ActivityValue label="Body" value={status?.body ?? "SUSPENDED"} />
          <ActivityValue
            label="Depth / turn"
            value={`${(status?.depth ?? 0).toFixed(2)} / ${(status?.yaw ?? 0).toFixed(1)}°`}
          />
          <ActivityValue label="Idle offset" value={`${x.toFixed(2)}, ${y.toFixed(2)} px`} />
          <ActivityValue label="Rotation" value={`${rotation.toFixed(2)}°`} />
          <ActivityValue label="Speed" value={`${(status?.bodySpeed ?? 0).toFixed(1)} px/s`} />
        </ActivityGroup>
      </div>
    </div>
  );
}

function ActivityGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="activity-group">
      <h2>{title}</h2>
      <div>{children}</div>
    </section>
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
    <div className="activity-value">
      <div>{label}</div>
      <div
        className={accent ? "activity-value-accent" : ""}
        title={value}
      >
        {value}
      </div>
    </div>
  );
}

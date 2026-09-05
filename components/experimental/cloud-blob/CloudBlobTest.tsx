"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import CloudBlobBody from "./CloudBlobBody";
import CloudBlobControls from "./CloudBlobControls";
import {
  DEFAULT_DEFORMATION,
  DEFAULT_MOTION_CONFIG,
  PRESETS,
  COLOUR_PRESETS,
} from "./cloudLobeSystem";
import type {
  CloudDeformationParams,
  CloudMotionConfig,
  CloudTrailConfig,
} from "./cloudTypes";
import {
  CloudPerformance,
  CLOUD_EMOTIONS,
  type CloudEmotion,
} from "./cloudPerformance";
import type { BehaviourId } from "@/lib/blobBehaviour";
import {
  NEUTRAL_RIG,
  NEUTRAL_BLOB,
  NEUTRAL_ELEMENT,
  type BlobColour,
} from "@/lib/blobRig";
import EnvironmentLayer from "@/components/states/EnvironmentLayer";
import { DEFAULT_ENVIRONMENT } from "@/lib/environmentConfig";
import "./cloudLab.css";
const INITIAL_TRAILS: CloudTrailConfig = {
  enabled: true,
  spawnRate: 1,
  lifetime: 0.9,
  fadeSpeed: 1,
  trailStrength: 1,
  driftAmount: 1,
};
const CLOUD_ENVIRONMENT = {
  ...DEFAULT_ENVIRONMENT,
  particleCount: 4,
  ambientLight: 0.3,
  bounceLight: 0.2,
};
const PALETTES: Record<BlobColour, string> = {
  teal: "Cool Mist",
  purple: "Purple Void",
  yellow: "Golden Dawn",
  green: "Emerald Vapor",
  blue: "Baby Blue",
  red: "Blush Rose",
};
export default function CloudBlobTest() {
  const [params, setParams] = useState({ ...DEFAULT_DEFORMATION });
  const [motion, setMotion] = useState({ ...DEFAULT_MOTION_CONFIG });
  const [trails, setTrails] = useState({ ...INITIAL_TRAILS });
  const [colour, setColour] = useState<BlobColour>("teal");
  const [face, setFace] = useState(true),
    [idle, setIdle] = useState(true),
    [drag, setDrag] = useState(true);
  const [playing, setPlaying] = useState(true),
    [fps, setFps] = useState<30 | 60>(60),
    [debug, setDebug] = useState(false);
  const [scene, setScene] = useState(false),
    [zoom, setZoom] = useState(1);
  const [resetId, resetNonce] = useState(0),
    [centreId, centreNonce] = useState(0),
    [clearId, clearNonce] = useState(0);
  const [active, setActive] = useState("Neutral");
  const [telemetry, setTelemetry] = useState({
    fps: 0,
    ms: 0,
    wisps: 0,
    lag: 0,
  });
  const performanceRef = useRef<CloudPerformance | null>(null);
  if (!performanceRef.current) performanceRef.current = new CloudPerformance();
  const testRef = useRef({ mode: "" as "" | "drag" | "trail", time: 0 });
  const environmentRig = useRef({
    ...NEUTRAL_RIG,
    blob: { ...NEUTRAL_BLOB },
    body: { ...NEUTRAL_ELEMENT },
  });
  const previewRef = useRef<HTMLDivElement>(null);
  const [available, setAvailable] = useState(600);
  useEffect(() => {
    const node = previewRef.current!;
    const observer = new ResizeObserver(([entry]) =>
      setAvailable(entry.contentRect.width),
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches)
      setPlaying(false);
  }, []);
  const trigger = useCallback((id: BehaviourId) => {
    testRef.current.mode = "";
    performanceRef.current!.trigger(id);
    setActive(id.replaceAll("_", " "));
  }, []);
  const emotion = useCallback(
    (e: CloudEmotion) => {
      trigger(CLOUD_EMOTIONS[e]);
    },
    [trigger],
  );
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const e = q.get("emote")?.toUpperCase() as CloudEmotion;
    if (e && e in CLOUD_EMOTIONS) emotion(e);
    if (q.get("idle") === "0") setIdle(false);
    if (q.get("fps") === "30") setFps(30);
  }, [emotion]);
  const advanceRig = useCallback(
    (dt: number) => {
      const rig = performanceRef.current!.update(dt, idle);
      const test = testRef.current;
      if (test.mode && dt > 0) {
        test.time += dt / 1000;
        const phase = Math.min(1, test.time / 4);
        const envelope = Math.sin(Math.PI * phase) ** 2;
        rig.blob.x +=
          Math.sin(test.time * (test.mode === "trail" ? 7 : 2.5)) *
          62 *
          envelope;
        rig.blob.y += Math.sin(test.time * 3.4) * 32 * envelope;
        if (phase >= 1) test.mode = "";
      }
      return rig;
    },
    [idle],
  );
  const reset = () => {
    performanceRef.current!.reset();
    testRef.current.mode = "";
    setParams({ ...DEFAULT_DEFORMATION });
    setMotion({ ...DEFAULT_MOTION_CONFIG });
    setTrails({ ...INITIAL_TRAILS });
    setActive("Neutral");
    resetNonce((n) => n + 1);
  };
  const displaySize = Math.max(240, Math.min(466 * zoom, available - 32));
  return (
    <main className="cloud-lab">
      <header className="cloud-header">
        <div>
          <Link href="/">LCDPROTO / Simulator</Link>
          <h1>Cloud study</h1>
          <p>Shared face. A different kind of weight.</p>
        </div>
        <span className="cloud-native">
          466 × 466
          <br />
          AMOLED · ESP32-S3
        </span>
      </header>
      <div className="cloud-workspace">
        <section className="cloud-preview" ref={previewRef}>
          <div className="cloud-toolbar">
            <button onClick={() => setPlaying((v) => !v)}>
              {playing ? "Pause" : "Play"}
            </button>
            <label>
              Rate
              <select
                aria-label="Frame rate"
                value={fps}
                onChange={(e) => setFps(Number(e.target.value) as 30 | 60)}
              >
                <option value={30}>30 FPS</option>
                <option value={60}>60 FPS</option>
              </select>
            </label>
            <label>
              Size
              <select
                aria-label="Preview zoom"
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
              >
                <option value={0.75}>75%</option>
                <option value={1}>1:1 native</option>
                <option value={1.2}>120%</option>
              </select>
            </label>
            <button aria-pressed={scene} onClick={() => setScene((v) => !v)}>
              {scene ? "Sand" : "Black"}
            </button>
          </div>
          <div
            className="cloud-bezel"
            style={{ width: displaySize + 24, height: displaySize + 24 }}
          >
            <div
              className="cloud-panel"
              style={{ width: displaySize, height: displaySize }}
            >
              <div
                style={{
                  width: 466,
                  height: 466,
                  transform: `scale(${displaySize / 466})`,
                  transformOrigin: "top left",
                }}
              >
                {scene && (
                  <EnvironmentLayer
                    size={466}
                    viewportSize={466}
                    renderScale={1}
                    playing={playing}
                    speed={1}
                    screenColour="#b7a18b"
                    displayMode="brown"
                    rig={environmentRig.current}
                    config={CLOUD_ENVIRONMENT}
                  />
                )}
                <div className="cloud-body-layer">
                  <CloudBlobBody
                    size={466}
                    renderScale={1}
                    params={params}
                    motionConfig={motion}
                    trailConfig={trails}
                    colour={colour}
                    cloudColour={COLOUR_PRESETS[PALETTES[colour]]}
                    showFace={face}
                    showContactShadow={!scene}
                    dragEnabled={drag}
                    playing={playing}
                    fps={fps}
                    idleEnabled={idle}
                    debug={debug}
                    resetId={resetId}
                    centreId={centreId}
                    clearWispsId={clearId}
                    advanceRig={advanceRig}
                    onPose={(x, y, scale) => {
                      environmentRig.current.blob.x = x;
                      environmentRig.current.blob.y = y;
                      environmentRig.current.blob.scale = scale;
                    }}
                    onTelemetry={(fps, ms, wisps, lag) =>
                      setTelemetry({ fps, ms, wisps, lag })
                    }
                  />
                </div>
              </div>
            </div>
          </div>
          <div className="cloud-caption">
            <strong>{active}</strong>
            <span>Grab cloud to move. Release to settle.</span>
            <span>{Math.round(displaySize)} CSS px · 466 px buffer</span>
          </div>
        </section>
        <CloudBlobControls
          colour={colour}
          setColour={setColour}
          params={params}
          param={(k: keyof CloudDeformationParams, v) =>
            setParams((p) => ({ ...p, [k]: v }))
          }
          motion={motion}
          setMotion={(k: keyof CloudMotionConfig, v) =>
            setMotion((p) => ({ ...p, [k]: v }))
          }
          trails={trails}
          setTrails={(p) => setTrails((t) => ({ ...t, ...p }))}
          face={face}
          setFace={setFace}
          idle={idle}
          setIdle={setIdle}
          drag={drag}
          setDrag={setDrag}
          debug={debug}
          setDebug={setDebug}
          trigger={trigger}
          emotion={emotion}
          preset={(p) => {
            setParams({ ...DEFAULT_DEFORMATION, ...PRESETS[p] });
            setActive(p);
          }}
          reset={reset}
          centre={() => {
            testRef.current.mode = "";
            setParams((p) => ({ ...p, x: 0, y: 0 }));
            centreNonce((n) => n + 1);
          }}
          clear={() => clearNonce((n) => n + 1)}
          test={(mode) => {
            performanceRef.current!.reset();
            testRef.current = { mode, time: 0 };
            setActive(`${mode} test`);
          }}
          telemetry={telemetry}
        />
      </div>
    </main>
  );
}

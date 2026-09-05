"use client";
import type { ReactNode } from "react";
import type {
  CloudDeformationParams,
  CloudMotionConfig,
  CloudTrailConfig,
  CloudPresetName,
} from "./cloudTypes";
import { BLOB_COLOURS, type BlobColour } from "@/lib/blobRig";
import { HOME_EXPRESSION_GROUPS } from "@/lib/expressionCatalog";
import type { BehaviourId } from "@/lib/blobBehaviour";
import { CLOUD_EMOTIONS, type CloudEmotion } from "./cloudPerformance";
import { PRESETS } from "./cloudLobeSystem";
interface Props {
  colour: BlobColour;
  setColour: (v: BlobColour) => void;
  params: CloudDeformationParams;
  param: (k: keyof CloudDeformationParams, v: number | boolean) => void;
  motion: CloudMotionConfig;
  setMotion: (k: keyof CloudMotionConfig, v: number) => void;
  trails: CloudTrailConfig;
  setTrails: (v: Partial<CloudTrailConfig>) => void;
  face: boolean;
  setFace: (v: boolean) => void;
  idle: boolean;
  setIdle: (v: boolean) => void;
  drag: boolean;
  setDrag: (v: boolean) => void;
  debug: boolean;
  setDebug: (v: boolean) => void;
  trigger: (v: BehaviourId) => void;
  emotion: (v: CloudEmotion) => void;
  preset: (v: CloudPresetName) => void;
  reset: () => void;
  centre: () => void;
  clear: () => void;
  test: (v: "drag" | "trail") => void;
  telemetry: { fps: number; ms: number; wisps: number; lag: number };
}
function Section({
  title,
  children,
  open = false,
}: {
  title: string;
  children: ReactNode;
  open?: boolean;
}) {
  return (
    <details open={open} className="cloud-section">
      <summary>{title}</summary>
      <div className="cloud-fields">{children}</div>
    </details>
  );
}
function Slider({
  label,
  value,
  min,
  max,
  step = 0.01,
  change,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  change: (v: number) => void;
}) {
  return (
    <label className="cloud-slider">
      <span>
        {label}
        <output>{value.toFixed(step >= 1 ? 0 : 2)}</output>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => change(Number(e.target.value))}
      />
    </label>
  );
}
function Toggle({
  label,
  value,
  change,
}: {
  label: string;
  value: boolean;
  change: (v: boolean) => void;
}) {
  return (
    <label className="cloud-toggle">
      <input
        type="checkbox"
        checked={value}
        onChange={(e) => change(e.target.checked)}
      />
      {label}
    </label>
  );
}
export default function CloudBlobControls(p: Props) {
  const scalar = (
    key: keyof CloudDeformationParams,
    label: string,
    min: number,
    max: number,
    step = 0.01,
  ) => (
    <Slider
      key={key}
      label={label}
      value={p.params[key] as number}
      min={min}
      max={max}
      step={step}
      change={(v) => p.param(key, v)}
    />
  );
  return (
    <aside className="cloud-controls" aria-label="Cloud controls">
      <Section title="Character" open>
        <div className="cloud-actions">
          {(Object.keys(CLOUD_EMOTIONS) as CloudEmotion[]).map((e) => (
            <button key={e} onClick={() => p.emotion(e)}>
              {e.toLowerCase()}
            </button>
          ))}
        </div>
        {scalar("scale", "Overall scale", 0.5, 1.2)}
        <div className="cloud-actions">
          <button onClick={p.reset}>Reset all</button>
          <button onClick={p.centre}>Return to centre</button>
        </div>
      </Section>
      <Section title="Face">
        <Toggle label="Production face" value={p.face} change={p.setFace} />
        <label className="cloud-select">
          Face palette
          <select
            value={p.colour}
            onChange={(e) => p.setColour(e.target.value as BlobColour)}
          >
            {BLOB_COLOURS.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        {scalar("faceEmbedDepth", "Face embed", 0, 0.3)}
        {scalar("gazeX", "Gaze X", -1, 1)}
        {scalar("gazeY", "Gaze Y", -1, 1)}
        <Toggle
          label="Secondary mist brows"
          value={p.params.cloudBrows}
          change={(v) => p.param("cloudBrows", v)}
        />
        {scalar("cheekBlush", "Secondary blush", 0, 1)}
        <label className="cloud-select">
          Production action
          <select
            value=""
            onChange={(e) => p.trigger(e.target.value as BehaviourId)}
          >
            <option value="" disabled>
              Choose action
            </option>
            {HOME_EXPRESSION_GROUPS.map((g) => (
              <optgroup key={g.id} label={g.label}>
                {g.entries.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
      </Section>
      <Section title="Body">
        {scalar("puff", "Puff", -0.2, 0.8)}
        {scalar("squash", "Squash", 0, 0.8)}
        {scalar("stretch", "Stretch", 0, 0.8)}
        {scalar("lean", "Lean", -30, 30, 1)}
        {scalar("coreDensity", "Core density", 0.7, 1.4)}
        {scalar("lobeSoftness", "Outer softness", 0.75, 1.3)}
        {scalar("fluffiness", "Secondary billows", 0, 1.2)}
        <label className="cloud-select">
          Shape preset
          <select
            value=""
            onChange={(e) => p.preset(e.target.value as CloudPresetName)}
          >
            <option value="" disabled>
              Choose shape
            </option>
            {Object.keys(PRESETS).map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
      </Section>
      <Section title="Motion">
        <Toggle label="Automatic idle" value={p.idle} change={p.setIdle} />
        <Toggle
          label="Pointer / touch drag"
          value={p.drag}
          change={p.setDrag}
        />
        <Slider
          label="Lobe lag"
          value={p.motion.lobeLag}
          min={0}
          max={2}
          change={(v) => p.setMotion("lobeLag", v)}
        />
        <Slider
          label="Damping"
          value={p.motion.springDamping}
          min={8}
          max={30}
          step={0.5}
          change={(v) => p.setMotion("springDamping", v)}
        />
        <Slider
          label="Stiffness"
          value={p.motion.springStiffness}
          min={50}
          max={300}
          step={5}
          change={(v) => p.setMotion("springStiffness", v)}
        />
        <Slider
          label="Float"
          value={p.motion.floatAmount}
          min={0}
          max={10}
          step={0.5}
          change={(v) => p.setMotion("floatAmount", v)}
        />
        <Slider
          label="Drift"
          value={p.motion.driftAmount}
          min={0}
          max={10}
          step={0.5}
          change={(v) => p.setMotion("driftAmount", v)}
        />
        <div className="cloud-actions">
          <button onClick={() => p.test("drag")}>Drag test</button>
          <button onClick={() => p.trigger("BODY_SETTLE")}>Settle</button>
        </div>
      </Section>
      <Section title="Trails">
        <Toggle
          label="Motion trails"
          value={p.trails.enabled}
          change={(v) => p.setTrails({ enabled: v })}
        />
        <Slider
          label="Trail strength"
          value={p.trails.trailStrength}
          min={0}
          max={1.4}
          change={(v) => p.setTrails({ trailStrength: v })}
        />
        <Slider
          label="Lifetime (s)"
          value={p.trails.lifetime}
          min={0.4}
          max={1.3}
          change={(v) => p.setTrails({ lifetime: v })}
        />
        <Slider
          label="Emission rate"
          value={p.trails.spawnRate}
          min={0}
          max={2}
          change={(v) => p.setTrails({ spawnRate: v })}
        />
        <Slider
          label="Fade speed"
          value={p.trails.fadeSpeed}
          min={0.5}
          max={2}
          change={(v) => p.setTrails({ fadeSpeed: v })}
        />
        <div className="cloud-actions">
          <button onClick={() => p.test("trail")}>Trail test</button>
          <button onClick={p.clear}>Clear wisps</button>
        </div>
      </Section>
      <Section title="Lighting">
        {scalar("lightAngle", "Light angle", -180, 180, 5)}
        {scalar("lightStrength", "Light strength", 0, 1)}
      </Section>
      <Section title="Performance" open>
        <dl className="cloud-metrics">
          <dt>Presented FPS</dt>
          <dd>{p.telemetry.fps.toFixed(1)}</dd>
          <dt>CPU frame mean</dt>
          <dd>{p.telemetry.ms.toFixed(2)} ms</dd>
          <dt>Active wisps</dt>
          <dd>{p.telemetry.wisps} / 8</dd>
          <dt>Mean lobe displacement</dt>
          <dd>{p.telemetry.lag.toFixed(1)} px</dd>
        </dl>
        <p>Native 466 × 466. CPU submission timing excludes GPU completion.</p>
      </Section>
      <Section title="Debug">
        <Toggle
          label="Bounds, centres, velocity, face anchor"
          value={p.debug}
          change={p.setDebug}
        />
        <p>7 main lobes · 6 secondary billows · 14 internal lights</p>
      </Section>
    </aside>
  );
}

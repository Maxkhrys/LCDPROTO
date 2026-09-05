"use client";
import { useCallback, useEffect, useRef, type PointerEvent } from "react";
import type { CloudBlobBodyProps } from "./cloudTypes";
import {
  DEFAULT_DEFORMATION,
  DEFAULT_MOTION_CONFIG,
  DEFAULT_COLOUR,
  createLobeStates,
  stepLobePhysics,
  LOBE_DEFINITIONS,
} from "./cloudLobeSystem";
import { createWispPool, spawnWisp, updateWisps } from "./cloudMistTrails";
import { renderCloudBlob, type RenderOptions } from "./cloudRenderer";
import { NEUTRAL_RIG } from "@/lib/blobRig";
import { BlobDragController, type DragPose } from "@/lib/blobDrag";
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

/** One clock owns face, body, drag, wisps and pause. No per-frame React updates. */
export default function CloudBlobBody(props: CloudBlobBodyProps) {
  const { size = 466, renderScale = 1, className } = props;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cfg = useRef(props);
  cfg.current = props;
  const sim = useRef<ReturnType<typeof createSimulation> | null>(null);
  if (!sim.current) sim.current = createSimulation();
  const native = (e: PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return {
      x: ((e.clientX - r.left) * size) / r.width,
      y: ((e.clientY - r.top) * size) / r.height,
    };
  };
  const release = useCallback((e: PointerEvent<HTMLCanvasElement>) => {
    const s = sim.current!;
    if (s.pointer !== e.pointerId) return;
    s.pointer = null;
    s.drag.end();
    if (e.currentTarget.hasPointerCapture(e.pointerId))
      e.currentTarget.releasePointerCapture(e.pointerId);
    cfg.current.onDragChange?.({
      isDragging: false,
      offsetX: s.x,
      offsetY: s.y,
      speed: 0,
    });
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const raster = clamp(renderScale, 1, 4);
    canvas.width = canvas.height = Math.round(size * raster);
    const s = sim.current!;
    let frame = 0,
      last = performance.now(),
      accumulator = 0;
    let telemetryTime = 0,
      frames = 0,
      cost = 0;
    const options: RenderOptions = {
      size,
      renderScale: raster,
      lobeStates: s.lobes,
      colour: DEFAULT_COLOUR,
      wisps: s.wisps,
      showFace: true,
      rig: NEUTRAL_RIG,
      colourName: "teal",
      idleTime: 0,
      params: { ...DEFAULT_DEFORMATION },
      wallAngle: 0,
      wallScaleX: 1,
      wallScaleY: 1,
      debug: false,
      vx: 0,
      vy: 0,
      safeRadius: 60,
    };
    const tick = (now: number) => {
      frame = requestAnimationFrame(tick);
      const c = cfg.current;
      const elapsed = Math.max(0, now - last);
      last = now;
      const interval = 1000 / (c.fps ?? 60);
      accumulator += Math.min(100, elapsed);
      telemetryTime += elapsed;
      if (accumulator + 0.01 < interval) return;
      const frameMs = Math.floor((accumulator + 0.01) / interval) * interval;
      accumulator = Math.max(0, accumulator - frameMs);
      const playing = c.playing !== false;
      const dt = playing ? Math.min(frameMs, 50) / 1000 : 0;
      const t0 = performance.now();
      if (s.resetId !== (c.resetId ?? 0)) {
        s.resetId = c.resetId ?? 0;
        s.lobes = createLobeStates();
        s.drag.reset();
        s.lastDrag = null;
        s.wisps.forEach((w) => {
          w.active = false;
        });
        s.time = 0;
        s.previous = false;
        s.emission = 0;
        s.sequence = 0;
        s.pointer = null;
      }
      if (s.centreId !== (c.centreId ?? 0)) {
        s.centreId = c.centreId ?? 0;
        s.drag.reset();
        s.lastDrag = null;
        s.pointer = null;
        s.previous = false;
      }
      if (c.dragEnabled === false || !playing) {
        s.drag.end();
        s.pointer = null;
      }
      if (
        s.clearId !== (c.clearWispsId ?? 0) ||
        c.trailConfig?.enabled === false
      ) {
        s.clearId = c.clearWispsId ?? 0;
        s.wisps.forEach((w) => {
          w.active = false;
        });
        s.emission = 0;
      }
      s.time += dt;
      const rig =
        c.advanceRig?.(dt * 1000) ?? c.rig ?? c.faceRig ?? NEUTRAL_RIG;
      const p = options.params;
      Object.assign(p, DEFAULT_DEFORMATION, c.params);
      Object.assign(s.motion, DEFAULT_MOTION_CONFIG, c.motionConfig);
      const ambient = c.idleEnabled === false ? 0 : 1;
      const baseX =
        p.x +
        rig.blob.x +
        rig.body.x +
        Math.sin(s.time * 0.45) * s.motion.driftAmount * ambient;
      const baseY =
        p.y +
        rig.blob.y +
        rig.body.y +
        Math.sin(s.time * 0.8) * s.motion.floatAmount * ambient;
      p.scale = clamp(p.scale * rig.blob.scale, 0.4, 1.3);
      p.scaleX *= rig.blob.scaleX;
      p.scaleY *= rig.blob.scaleY;
      p.rotation += rig.blob.rotation + rig.body.rotation * 0.5;
      p.squash += Math.max(0, 1 - rig.body.scaleY) * 1.4;
      p.stretch += Math.max(0, rig.body.scaleY - 1) * 1.4;
      p.lean += rig.body.skewX * 0.5;
      // Radius includes current puff/softness; shared production drag handles all walls.
      const bodyRadius =
        170 *
        p.scale *
        Math.max(p.scaleX, p.scaleY) *
        (1 + Math.max(0, p.puff) * 0.3) *
        clamp(p.lobeSoftness, 0.75, 1.3);
      if (playing || !s.lastDrag)
        s.lastDrag = s.drag.step(dt * 1000, size, bodyRadius, baseX, baseY);
      const drag = s.lastDrag;
      p.x = baseX + drag.x;
      p.y = baseY + drag.y;
      // Oversize manual presets stay contained; normal acting keeps its chosen scale.
      const maxScale = (size / 2 - 5) / Math.max(bodyRadius, 1);
      if (maxScale < 1) p.scale *= maxScale;
      const vx = dt > 0 && s.previous ? (p.x - s.x) / dt : s.vx;
      const vy = dt > 0 && s.previous ? (p.y - s.y) / dt : s.vy;
      const speed = Math.hypot(vx, vy);
      const acceleration =
        dt > 0 && s.previous ? Math.hypot(vx - s.vx, vy - s.vy) / dt : 0;
      p.lean += clamp(vx * 0.022, -12, 12);
      p.stretch += Math.min(0.14, speed * 0.0003);
      stepLobePhysics(
        s.lobes,
        p,
        s.motion,
        vx / p.scale,
        vy / p.scale,
        ambient ? s.time : 0,
        dt,
      );
      const trails = c.trailConfig;
      const active = updateWisps(
        s.wisps,
        dt,
        trails?.driftAmount ?? 1,
        trails?.fadeSpeed ?? 1,
      );
      // Rate is time-based. No emission at mount, from cursor alone, or while paused.
      if (dt > 0 && trails?.enabled !== false && s.previous) {
        const isDragging = Boolean(drag.grabbed || s.pointer);
        const dragBonus = isDragging ? 1.4 : 0;
        const energy =
          clamp((speed - 15) / 100, 0, 1.5) +
          (speed > 10 ? clamp((acceleration - 500) / 3500, 0, 0.8) : 0) +
          dragBonus;
        s.emission =
          energy > 0
            ? s.emission + energy * 8 * dt * (trails?.spawnRate ?? 1)
            : 0;
        const cap = isDragging ? 32 : (speed > 180 ? 28 : (speed > 45 ? 18 : 8));
        while (s.emission >= 1 && active < cap) {
          s.emission -= 1;
          const speedNorm = Math.max(1, speed);
          const nx = vx / speedNorm,
            ny = vy / speedNorm;
          const seq = s.sequence++;
          const radiusJitter = ((seq % 5) - 2) * 3;
          const puffRadius = 22 + (seq % 4) * 6 + radiusJitter;
          const sideOffset = Math.sin(seq * 2.1) * 32 * p.scale;
          const trailOffset = (84 + (seq % 3) * 18) * p.scale;

          spawnWisp(
            s.wisps,
            size / 2 + p.x - nx * trailOffset - ny * sideOffset,
            size / 2 + p.y - ny * trailOffset + nx * sideOffset,
            -vx * 0.14 + Math.sin(seq * 2.5) * 14,
            -vy * 0.14 - 12 + Math.cos(seq * 2.1) * 12,
            puffRadius * p.scale,
            seq % 3 === 0 ? options.colour.body : options.colour.edge,
            (trails?.lifetime ?? 0.95) * (1 + (seq % 3) * 0.25),
            0.55 * (trails?.trailStrength ?? 1),
            seq,
          );
        }
        s.emission = Math.min(s.emission, 2);
      }
      if (dt > 0 || !s.previous) {
        s.x = p.x;
        s.y = p.y;
        s.vx = vx;
        s.vy = vy;
        s.previous = true;
      }
      options.lobeStates = s.lobes;
      options.rig = rig;
      options.colour = c.cloudColour
        ? Object.assign(s.colour, DEFAULT_COLOUR, c.cloudColour)
        : DEFAULT_COLOUR;
      options.colourName = c.colour ?? c.blobColour ?? "teal";
      options.showFace = c.showFace !== false;
      options.idleTime = ambient ? s.time : 0;
      options.debug = c.debug ?? false;
      options.wallAngle =
        (drag.deformAngle * Math.PI) / 180 - (p.rotation * Math.PI) / 180;
      options.wallScaleX = 1 + drag.bodyScaleX * 0.55;
      options.wallScaleY = 1 + drag.bodyScaleY;
      options.vx = vx;
      options.vy = vy;
      options.safeRadius = Math.max(0, size / 2 - bodyRadius);
      s.hitRadius = Math.min(bodyRadius, size / 2 - 5);
      renderCloudBlob(ctx, options);
      c.onPose?.(p.x, p.y, p.scale);
      cost += performance.now() - t0;
      frames++;
      if (telemetryTime >= 500) {
        let lag = 0,
          count = 0;
        for (const d of LOBE_DEFINITIONS)
          lag += Math.hypot(
            s.lobes[d.id].x - d.baseX,
            s.lobes[d.id].y - d.baseY,
          );
        for (const w of s.wisps) if (w.active) count++;
        c.onTelemetry?.(
          playing ? (frames * 1000) / telemetryTime : 0,
          cost / frames,
          count,
          lag / LOBE_DEFINITIONS.length,
        );
        c.onDragChange?.({
          isDragging: s.drag.isGrabbed,
          offsetX: p.x,
          offsetY: p.y,
          speed,
        });
        // Developer-only DOM telemetry, readable without a React render per frame.
        canvas.dataset.frameMs = String(cost / frames);
        canvas.dataset.wisps = String(count);
        canvas.dataset.x = String(p.x);
        canvas.dataset.y = String(p.y);
        frames = 0;
        cost = 0;
        telemetryTime = 0;
      }
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      s.drag.end();
      s.pointer = null;
    };
  }, [size, renderScale]);

  return (
    <canvas
      ref={canvasRef}
      aria-label="Cloud character preview"
      className={`block touch-none select-none ${className ?? ""}`}
      style={{
        width: size,
        height: size,
        cursor: props.dragEnabled === false ? "default" : "grab",
      }}
      onPointerDown={(e) => {
        const s = sim.current!;
        if (
          cfg.current.dragEnabled === false ||
          cfg.current.playing === false ||
          s.pointer !== null ||
          !e.isPrimary ||
          e.button !== 0
        )
          return;
        const p = native(e);
        if (
          Math.hypot(p.x - size / 2 - s.x, p.y - size / 2 - s.y) >
          s.hitRadius * 0.82
        )
          return;
        e.preventDefault();
        s.pointer = e.pointerId;
        e.currentTarget.setPointerCapture(e.pointerId);
        s.drag.begin(p.x, p.y, e.timeStamp);
      }}
      onPointerMove={(e) => {
        if (sim.current!.pointer !== e.pointerId) return;
        const p = native(e);
        sim.current!.drag.move(p.x, p.y, e.timeStamp);
      }}
      onPointerUp={release}
      onPointerCancel={release}
      onLostPointerCapture={release}
    />
  );
}
function createSimulation() {
  return {
    lobes: createLobeStates(),
    wisps: createWispPool(),
    drag: new BlobDragController(),
    lastDrag: null as DragPose | null,
    motion: { ...DEFAULT_MOTION_CONFIG },
    colour: { ...DEFAULT_COLOUR },
    pointer: null as number | null,
    time: 0,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    hitRadius: 170,
    previous: false,
    emission: 0,
    sequence: 0,
    resetId: 0,
    centreId: 0,
    clearId: 0,
  };
}

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  BLOB_ASSETS,
  DEFAULT_CALIBRATION,
  FACE_MASK,
  IDLE,
  REACTION,
  type BlobCalibration,
  type BlobFrame,
} from "@/lib/blobConfig";
import { anchorOf, computeLayout, frameScale } from "./blobLayout";
import { drawDownscaled } from "./downscale";

interface BlobStageProps {
  /** Native screen size in pixels (240). */
  size: number;
  /** Which expression the stage should settle on. */
  expression: BlobFrame;
  playing: boolean;
  speed: number;
  runId: number;
  fps: number;
  calibration?: BlobCalibration;
  /**
   * Pixels rasterised per 240-space pixel. All drawing stays in 240-space —
   * this only decides how finely it is sampled, so the artwork survives being
   * magnified on a desktop display. 1 shows true hardware pixels.
   */
  renderScale: number;
}

const easeInOut = (t: number) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2);
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/**
 * Renders the Blob into the native 240x240 buffer.
 *
 * The HOME body is always the base layer. The reaction frame is pre-composited
 * into a face-shaped mask once per calibration change, so the per-frame cost is
 * two drawImage calls regardless of how large the source PNGs are.
 */
export default function BlobStage({
  size,
  expression,
  playing,
  speed,
  runId,
  fps,
  calibration = DEFAULT_CALIBRATION,
  renderScale,
}: BlobStageProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [images, setImages] = useState<Record<BlobFrame, HTMLImageElement> | null>(
    null
  );

  // Load both frames once.
  useEffect(() => {
    let cancelled = false;
    const entries = Object.entries(BLOB_ASSETS) as [
      BlobFrame,
      (typeof BLOB_ASSETS)[BlobFrame],
    ][];
    Promise.all(
      entries.map(
        ([key, asset]) =>
          new Promise<[BlobFrame, HTMLImageElement]>((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve([key, img]);
            img.onerror = () => reject(new Error(`Failed to load ${asset.src}`));
            img.src = asset.src;
          })
      )
    )
      .then((loaded) => {
        if (!cancelled) {
          setImages(Object.fromEntries(loaded) as Record<BlobFrame, HTMLImageElement>);
        }
      })
      .catch(() => {
        /* Nothing to draw; the screen simply stays black. */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Motion state lives in refs so switching expression mid-transition resumes
  // rather than snapping, and so the loop can restart without losing position.
  const progressRef = useRef(0);
  const pulseRef = useRef(0);
  const holdRef = useRef(0);
  const timeRef = useRef(0);

  useEffect(() => {
    progressRef.current = 0;
    pulseRef.current = 0;
    holdRef.current = 0;
    timeRef.current = 0;
  }, [runId]);

  // Pre-composite the two draw layers once per calibration change. Scaling the
  // ~1300px sources every frame would be wasteful; after this the per-frame
  // cost is two drawImage calls of 240x240 buffers.
  const layers = useMemo(() => {
    if (!images || typeof document === "undefined") return null;
    const layout = computeLayout(size);

    const bake = (frame: BlobFrame, masked: boolean) => {
      const buf = document.createElement("canvas");
      buf.width = size * renderScale;
      buf.height = size * renderScale;
      const bctx = buf.getContext("2d");
      if (!bctx) return buf;
      bctx.imageSmoothingQuality = "high";
      // Draw in 240-space; the backing store just carries more samples.
      bctx.setTransform(renderScale, 0, 0, renderScale, 0, 0);

      const a = anchorOf(BLOB_ASSETS[frame]);
      const asset = BLOB_ASSETS[frame];
      const cal = masked ? calibration : DEFAULT_CALIBRATION;
      const s = frameScale(frame, layout) * cal.scale;
      const ax = layout.anchorX + cal.offsetX;
      const ay = layout.anchorY + cal.offsetY;

      drawDownscaled(
        bctx,
        images[frame],
        asset.width,
        asset.height,
        ax - a.midX * s,
        ay - a.midY * s,
        asset.width * s,
        asset.height * s
      );

      if (masked) {
        // Keep only the facial region, feathered, so the differing body rims
        // never take part in the crossfade.
        const e = layout.eyeScreen;
        bctx.globalCompositeOperation = "destination-in";
        bctx.save();
        bctx.translate(ax + FACE_MASK.offsetX * e, ay + FACE_MASK.offsetY * e);
        bctx.scale(FACE_MASK.radiusX * e, FACE_MASK.radiusY * e);
        const g = bctx.createRadialGradient(0, 0, FACE_MASK.feather, 0, 0, 1);
        g.addColorStop(0, "rgba(255,255,255,1)");
        g.addColorStop(0.5, "rgba(255,255,255,0.85)");
        g.addColorStop(0.8, "rgba(255,255,255,0.4)");
        g.addColorStop(1, "rgba(255,255,255,0)");
        bctx.fillStyle = g;
        bctx.beginPath();
        bctx.arc(0, 0, 1, 0, Math.PI * 2);
        bctx.fill();
        bctx.restore();
        bctx.globalCompositeOperation = "source-over";
      }
      return buf;
    };

    return { body: bake("home", false), face: bake("reaction", true) };
  }, [images, size, calibration, renderScale]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx || !layers) return;

    ctx.setTransform(renderScale, 0, 0, renderScale, 0, 0);
    const center = size / 2;
    const target = expression === "reaction" ? 1 : 0;
    const faceDuration = REACTION.faceEnd - REACTION.faceStart;

    // Starting the reaction from rest gets a real beat of dead time first.
    if (target === 1 && progressRef.current === 0 && holdRef.current === 0) {
      holdRef.current = REACTION.anticipationEnd;
    }

    const draw = () => {
      const t = timeRef.current;
      const p = progressRef.current;
      const pulse = pulseRef.current;

      // The anticipation beat reads as a barely-there settle inwards.
      const anticipation =
        holdRef.current > 0
          ? Math.sin((1 - holdRef.current / REACTION.anticipationEnd) * Math.PI) *
            0.004
          : 0;
      const breath =
        Math.sin((t / IDLE.breathPeriod) * Math.PI * 2) * IDLE.breathAmount;
      const float =
        Math.sin((t / IDLE.floatPeriod) * Math.PI * 2) * IDLE.floatPx;
      const scale = 1 + breath - anticipation + pulse * 0.006;

      const ambient = 0.5 + 0.5 * Math.sin((t / IDLE.glowPeriod) * Math.PI * 2);
      const glow = 0.05 + ambient * 0.028 + pulse * 0.14;

      ctx.fillStyle = "#000000";
      ctx.fillRect(0, 0, size, size);

      // Extremely subtle ambient purple behind the character.
      const halo = ctx.createRadialGradient(
        center,
        center + float,
        size * 0.16,
        center,
        center + float,
        size * 0.52
      );
      halo.addColorStop(0, `rgba(138, 96, 232, ${glow})`);
      halo.addColorStop(0.55, `rgba(104, 70, 196, ${glow * 0.34})`);
      halo.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = halo;
      ctx.fillRect(0, 0, size, size);

      ctx.save();
      ctx.translate(center, center + float);
      ctx.scale(scale, scale);
      ctx.translate(-center, -center);
      ctx.drawImage(layers.body, 0, 0, size, size);
      if (p > 0.001) {
        ctx.globalAlpha = easeInOut(p);
        ctx.drawImage(layers.face, 0, 0, size, size);
        ctx.globalAlpha = 1;
      }
      ctx.restore();
    };

    const advance = (dt: number) => {
      timeRef.current += dt;

      if (holdRef.current > 0) {
        holdRef.current = Math.max(0, holdRef.current - dt);
      } else if (target === 1 && progressRef.current < 1) {
        progressRef.current = clamp01(progressRef.current + dt / faceDuration);
        // Fire the glow swell at the moment the reaction lands.
        if (progressRef.current >= 1) pulseTimer = REACTION.pulseDuration;
      } else if (target === 0 && progressRef.current > 0) {
        progressRef.current = clamp01(
          progressRef.current - dt / REACTION.releaseDuration
        );
      }

      if (pulseTimer > 0) {
        pulseTimer = Math.max(0, pulseTimer - dt);
        // Half-sine envelope: swells up and back down rather than snapping on.
        pulseRef.current = Math.sin(
          (1 - pulseTimer / REACTION.pulseDuration) * Math.PI
        );
      } else {
        pulseRef.current = 0;
      }
    };

    let pulseTimer = 0;
    let last = performance.now();
    let accumulator = 0;
    let frameId = 0;
    const frameInterval = 1000 / fps;

    const loop = (now: number) => {
      frameId = requestAnimationFrame(loop);
      const delta = Math.min(now - last, 100);
      last = now;
      accumulator += delta;
      if (accumulator < frameInterval) return;
      accumulator = 0;
      advance(delta * speed);
      draw();
    };

    // Always paint one frame so a paused screen is never blank.
    draw();
    if (playing) frameId = requestAnimationFrame(loop);

    return () => cancelAnimationFrame(frameId);
  }, [layers, size, expression, playing, speed, fps, renderScale]);

  return (
    <canvas
      ref={canvasRef}
      width={size * renderScale}
      height={size * renderScale}
      className="block rounded-full bg-black"
      style={{
        width: size,
        height: size,
        // At 1:1 show real hardware pixels rather than a smoothed guess.
        imageRendering: renderScale === 1 ? "pixelated" : "auto",
      }}
    />
  );
}

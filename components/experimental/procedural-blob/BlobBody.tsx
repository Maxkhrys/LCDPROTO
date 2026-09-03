"use client";

/**
 * Experimental procedural Blob body.
 *
 * R&D ONLY — nothing here is imported by the production rig, HOME, or any
 * state view. It renders only the body layer; the face is deliberately absent
 * so this can later drop in under the existing eyes and mouth unchanged.
 *
 * Canvas 2D was chosen over SVG. See the notes on the test page for why.
 */

import { useEffect, useRef } from "react";
import { BODY_FRACTION } from "@/lib/blobRig";
import {
  NEUTRAL_SHAPE,
  buildBlobShape,
  tracePath,
  type BlobShape,
  type ShapeParams,
} from "./blobShape";
import { PALETTES, paintBlobBody, type PaletteId } from "./blobMaterial";
import { BlobSoftBody } from "./blobPhysics";

/**
 * Supersample factor for the body pass. The buffer is then mip-halved down
 * to the target with the rig's existing downscaler, which is what keeps the
 * curve edges and the thin rim clean at 240px.
 */
const SUPERSAMPLE = 2;

export interface DebugOverlays {
  silhouette: boolean;
  controlPoints: boolean;
  boundingBox: boolean;
  center: boolean;
}

export interface BlobBodyProps {
  /** Authored screen size; 240 on the real panel. */
  size: number;
  /** Visible pixels per authored pixel. 1 renders a true 240x240 buffer. */
  renderScale?: number;
  /** Pose the springs are asked to reach. */
  target: Partial<ShapeParams>;
  palette?: PaletteId;
  highlightShift?: number;
  /** Continuous idle ripple speed, in radians per second. */
  wobbleSpeed?: number;
  debug?: Partial<DebugOverlays>;
  /** Reports smoothed frame cost in milliseconds. */
  onFrameCost?: (ms: number) => void;
  className?: string;
}

export default function BlobBody({
  size,
  renderScale = 1,
  target,
  palette = "amber",
  highlightShift = 0,
  wobbleSpeed = 1.6,
  debug,
  onFrameCost,
  className,
}: BlobBodyProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bufferRef = useRef<HTMLCanvasElement | null>(null);
  const midRef = useRef<HTMLCanvasElement | null>(null);
  const bodyRef = useRef<BlobSoftBody | null>(null);
  const targetRef = useRef(target);
  const optsRef = useRef({ palette, highlightShift, wobbleSpeed, debug });

  targetRef.current = target;
  optsRef.current = { palette, highlightShift, wobbleSpeed, debug };

  if (!bodyRef.current) {
    bodyRef.current = new BlobSoftBody(NEUTRAL_SHAPE);
    bodyRef.current.snapTo(target);
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    const soft = bodyRef.current;
    if (!canvas || !soft) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const ss = size * SUPERSAMPLE;
    let buffer = bufferRef.current;
    if (!buffer) {
      buffer = document.createElement("canvas");
      bufferRef.current = buffer;
    }
    buffer.width = ss;
    buffer.height = ss;
    const bctx = buffer.getContext("2d");
    if (!bctx) return;

    // Canvas has no mipmaps, so an odd shrink ratio samples too sparsely and
    // softens the rim. At 2x the buffer resolves to the target in a single
    // exactly-halving drawImage, which is the well-sampled case and needs no
    // intermediate; the persistent mid canvas below covers any other factor
    // without allocating a canvas sixty times a second the way the rig's
    // drawDownscaled would.
    let mid = midRef.current;
    if (!mid) {
      mid = document.createElement("canvas");
      midRef.current = mid;
    }
    const half = Math.round(ss / 2);
    mid.width = half;
    mid.height = half;
    const mctx = mid.getContext("2d");
    if (!mctx) return;
    mctx.imageSmoothingEnabled = true;
    mctx.imageSmoothingQuality = "high";

    let raf = 0;
    let last = performance.now();
    let phase = 0;
    let cost = 0;

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min((now - last) / 1000, 0.1);
      last = now;
      const t0 = performance.now();

      const o = optsRef.current;
      phase += dt * o.wobbleSpeed;

      soft.setTarget(targetRef.current);
      const pose = soft.step(dt);
      pose.wobblePhase = phase;

      // --- body pass, supersampled ---------------------------------------
      bctx.setTransform(1, 0, 0, 1, 0, 0);
      bctx.clearRect(0, 0, ss, ss);
      bctx.save();
      bctx.translate(ss / 2, ss / 2);

      const halfWidth = (size * BODY_FRACTION * SUPERSAMPLE) / 2;
      const shape = buildBlobShape(pose, halfWidth);
      paintBlobBody(bctx, shape, {
        palette: PALETTES[o.palette ?? "amber"],
        highlightShift: o.highlightShift ?? 0,
        rimStrength: 1,
      });
      bctx.restore();

      // --- resolve to the authored resolution -----------------------------
      const out = size * renderScale;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, out, out);
      mctx.clearRect(0, 0, half, half);
      mctx.drawImage(buffer, 0, 0, ss, ss, 0, 0, half, half);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(mid, 0, 0, half, half, 0, 0, out, out);

      if (o.debug) drawDebug(ctx, shape, size, renderScale, o.debug);

      const ms = performance.now() - t0;
      cost = cost === 0 ? ms : cost * 0.9 + ms * 0.1;
      onFrameCost?.(cost);
    };

    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [size, renderScale, onFrameCost]);

  const out = size * renderScale;
  return (
    <canvas
      ref={canvasRef}
      width={out}
      height={out}
      className={className}
      style={{
        width: "100%",
        height: "100%",
        imageRendering: renderScale === 1 ? "pixelated" : "auto",
      }}
    />
  );
}

/** Overlays are drawn at the output resolution, over the resolved image. */
function drawDebug(
  ctx: CanvasRenderingContext2D,
  shape: BlobShape,
  size: number,
  renderScale: number,
  debug: Partial<DebugOverlays>
) {
  // The shape was built in supersampled space; bring it back to output space.
  const k = renderScale / SUPERSAMPLE;
  ctx.save();
  ctx.translate((size * renderScale) / 2, (size * renderScale) / 2);
  ctx.scale(k, k);
  const px = 1 / k;

  if (debug.boundingBox) {
    const b = shape.bounds;
    ctx.strokeStyle = "rgba(90, 220, 255, 0.7)";
    ctx.lineWidth = px;
    ctx.setLineDash([4 * px * SUPERSAMPLE, 4 * px * SUPERSAMPLE]);
    ctx.strokeRect(b.minX, b.minY, b.maxX - b.minX, b.maxY - b.minY);
    ctx.setLineDash([]);
  }

  if (debug.silhouette) {
    tracePath(ctx, shape);
    ctx.strokeStyle = "rgba(0, 255, 190, 0.9)";
    ctx.lineWidth = px;
    ctx.stroke();
  }

  if (debug.controlPoints) {
    for (const seg of shape.segments) {
      ctx.strokeStyle = "rgba(255, 120, 200, 0.45)";
      ctx.lineWidth = px;
      ctx.beginPath();
      ctx.moveTo(seg.p0.x, seg.p0.y);
      ctx.lineTo(seg.c0.x, seg.c0.y);
      ctx.moveTo(seg.p1.x, seg.p1.y);
      ctx.lineTo(seg.c1.x, seg.c1.y);
      ctx.stroke();
    }
    for (const p of shape.points) {
      ctx.fillStyle = "rgba(255, 60, 130, 0.95)";
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2.2 * px * SUPERSAMPLE, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  if (debug.center) {
    const c = shape.center;
    ctx.strokeStyle = "rgba(255, 255, 255, 0.85)";
    ctx.lineWidth = px;
    const r = 4 * px * SUPERSAMPLE;
    ctx.beginPath();
    ctx.moveTo(c.x - r, c.y);
    ctx.lineTo(c.x + r, c.y);
    ctx.moveTo(c.x, c.y - r);
    ctx.lineTo(c.x, c.y + r);
    ctx.stroke();
  }

  ctx.restore();
}

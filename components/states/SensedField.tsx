"use client";

import { useEffect, useRef } from "react";

/**
 * The SENSED proximity field is intentionally quieter than a radar:
 * five hairline orbits and a small, fixed set of green signal points.
 * Positions are authored in the panel's native 466-space so this remains
 * straightforward to reproduce on the eventual display firmware.
 */
const CENTRE = 233;
const RINGS = [
  { radius: 60, alpha: 0.18 },
  { radius: 93, alpha: 0.14 },
  { radius: 130, alpha: 0.12 },
  { radius: 169, alpha: 0.1 },
  { radius: 206, alpha: 0.08 },
] as const;

interface SignalPoint {
  ring: number;
  angle: number;
  phase: number;
  period: number;
  radius: number;
  peak: number;
}

// Sparse and deliberately irregular. The phase offsets stop the field from
// reading as one repeating loading animation.
const SIGNAL_POINTS: readonly SignalPoint[] = [
  { ring: 0, angle: -1.08, phase: 0.2, period: 2.8, radius: 0.8, peak: 0.72 },
  { ring: 0, angle: 1.74, phase: 1.7, period: 3.6, radius: 0.65, peak: 0.58 },
  { ring: 0, angle: 3.18, phase: 3.2, period: 2.4, radius: 0.58, peak: 0.48 },
  { ring: 1, angle: -2.48, phase: 2.1, period: 3.9, radius: 0.65, peak: 0.62 },
  { ring: 1, angle: -0.32, phase: 0.8, period: 2.7, radius: 0.7, peak: 0.78 },
  { ring: 1, angle: 1.16, phase: 3.7, period: 4.2, radius: 0.58, peak: 0.55 },
  { ring: 1, angle: 2.72, phase: 5.1, period: 3.1, radius: 0.72, peak: 0.68 },
  { ring: 2, angle: -2.82, phase: 1.2, period: 4.5, radius: 0.58, peak: 0.5 },
  { ring: 2, angle: -1.52, phase: 4.1, period: 2.9, radius: 0.72, peak: 0.7 },
  { ring: 2, angle: 0.18, phase: 2.8, period: 3.7, radius: 0.62, peak: 0.62 },
  { ring: 2, angle: 2.08, phase: 5.6, period: 2.5, radius: 0.8, peak: 0.8 },
  { ring: 3, angle: -2.12, phase: 3.4, period: 3.8, radius: 0.66, peak: 0.7 },
  { ring: 3, angle: -0.82, phase: 0.4, period: 4.8, radius: 0.56, peak: 0.5 },
  { ring: 3, angle: 0.96, phase: 4.7, period: 3.2, radius: 0.74, peak: 0.72 },
  { ring: 3, angle: 2.76, phase: 1.9, period: 2.8, radius: 0.62, peak: 0.58 },
  { ring: 4, angle: -2.68, phase: 5.2, period: 4.1, radius: 0.68, peak: 0.68 },
  { ring: 4, angle: -0.56, phase: 2.6, period: 3.4, radius: 0.6, peak: 0.56 },
  { ring: 4, angle: 1.52, phase: 0.9, period: 4.6, radius: 0.78, peak: 0.78 },
] as const;

const TAU = Math.PI * 2;

function drawField(
  ctx: CanvasRenderingContext2D,
  size: number,
  timeSeconds: number
) {
  ctx.clearRect(0, 0, size, size);
  // Soft sensing wash. It is a native-pixel colour field, not a CSS glow or
  // blur, so it stays cheap enough to reproduce on the eventual display.
  const washPulse = (Math.sin((timeSeconds / 4.8) * TAU - 0.7) + 1) * 0.5;
  const wash = ctx.createRadialGradient(
    CENTRE,
    CENTRE,
    35,
    CENTRE,
    CENTRE,
    229
  );
  wash.addColorStop(0, `rgba(83, 235, 127, ${0.015 + washPulse * 0.02})`);
  wash.addColorStop(0.58, `rgba(83, 235, 127, ${0.035 + washPulse * 0.035})`);
  wash.addColorStop(0.88, `rgba(103, 244, 145, ${0.075 + washPulse * 0.065})`);
  wash.addColorStop(1, `rgba(103, 244, 145, ${0.12 + washPulse * 0.08})`);
  ctx.globalAlpha = 1;
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, size, size);

  ctx.lineWidth = 1.1;
  ctx.strokeStyle = "#62e895";

  for (const ring of RINGS) {
    ctx.globalAlpha = ring.alpha;
    ctx.beginPath();
    ctx.arc(CENTRE, CENTRE, ring.radius, 0, TAU);
    ctx.stroke();
  }

  ctx.fillStyle = "#73f3a1";
  for (const point of SIGNAL_POINTS) {
    const ring = RINGS[point.ring];
    const pulse =
      (Math.sin((timeSeconds / point.period) * TAU + point.phase) + 1) * 0.5;
    // A quiet base keeps the point present; the high-power pulse makes the
    // occasional twinkle read clearly at native size without a glow filter.
    const twinkle = Math.pow(pulse, 5);
    ctx.globalAlpha = 0.16 + twinkle * point.peak * 0.84;
    const radius = point.radius * 2 + twinkle * 0.7;
    const x = CENTRE + Math.cos(point.angle) * ring.radius;
    const y = CENTRE + Math.sin(point.angle) * ring.radius;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, TAU);
    ctx.fill();
  }

  ctx.globalAlpha = 1;
}

interface SensedFieldProps {
  size: number;
  viewportSize?: number;
  renderScale: number;
  playing: boolean;
  speed: number;
}

export default function SensedField({
  size,
  viewportSize = size,
  renderScale,
  playing,
  speed,
}: SensedFieldProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const timeRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    let frameId = 0;
    let last = performance.now();

    const frame = (now: number) => {
      const elapsed = Math.min(100, now - last);
      last = now;
      timeRef.current += (elapsed / 1000) * speed;
      ctx.setTransform(renderScale, 0, 0, renderScale, 0, 0);
      drawField(ctx, size, timeRef.current);
      if (playing) frameId = requestAnimationFrame(frame);
    };

    ctx.setTransform(renderScale, 0, 0, renderScale, 0, 0);
    drawField(ctx, size, timeRef.current);
    if (playing) frameId = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(frameId);
  }, [playing, renderScale, size, speed]);

  return (
    <canvas
      ref={canvasRef}
      width={size * renderScale}
      height={size * renderScale}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-0 block"
      style={{
        width: viewportSize,
        height: viewportSize,
        imageRendering: "auto",
      }}
    />
  );
}

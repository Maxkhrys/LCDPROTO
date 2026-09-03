"use client";

import { useEffect, useRef } from "react";
import type { StateViewProps } from "@/lib/deviceStates";

/**
 * HOME — "VOID" placeholder.
 *
 * Deep black field, extremely subtle violet ambient rings, a small soft
 * central orb with a very slow breathing cycle, and sparse tiny particles.
 * Drawn procedurally on a native 240x240 canvas so it costs roughly what it
 * will cost on the real panel. No text inside the screen.
 *
 * The orb is a placeholder for the future companion character — do not
 * treat it as the character design.
 */

const PARTICLE_COUNT = 14;
const RING_RADII = [58, 82, 106] as const;

interface Particle {
  angle: number;
  radius: number;
  drift: number;
  size: number;
  phase: number;
}

function createParticles(size: number): Particle[] {
  const particles: Particle[] = [];
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    // Deterministic-ish spread so the field never clumps.
    const angle = (i / PARTICLE_COUNT) * Math.PI * 2 + Math.random() * 0.4;
    particles.push({
      angle,
      radius: size * (0.18 + Math.random() * 0.28),
      drift: (Math.random() > 0.5 ? 1 : -1) * (0.008 + Math.random() * 0.014),
      size: Math.random() > 0.75 ? 1.4 : 0.9,
      phase: Math.random() * Math.PI * 2,
    });
  }
  return particles;
}

export default function HomeState({
  size,
  playing,
  speed,
  runId,
  fps,
}: StateViewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const center = size / 2;
    const particles = createParticles(size);
    let time = 0;
    let last = performance.now();
    let accumulator = 0;
    let frame = 0;
    const frameInterval = 1000 / fps;

    const draw = () => {
      // Breathing cycle: ~7s at 1x, slowed further by the speed control.
      const breath = (Math.sin(time / 7000) + 1) / 2;

      ctx.fillStyle = "#000000";
      ctx.fillRect(0, 0, size, size);

      // Ambient violet haze.
      const haze = ctx.createRadialGradient(
        center,
        center,
        0,
        center,
        center,
        center
      );
      haze.addColorStop(0, `rgba(126, 92, 214, ${0.1 + breath * 0.05})`);
      haze.addColorStop(0.45, "rgba(80, 56, 150, 0.035)");
      haze.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = haze;
      ctx.fillRect(0, 0, size, size);

      // Concentric ambient rings, each breathing slightly out of phase.
      ctx.lineWidth = 1;
      RING_RADII.forEach((base, i) => {
        const offset = Math.sin(time / 7000 + i * 0.9) * 1.6;
        ctx.strokeStyle = `rgba(140, 108, 226, ${0.05 - i * 0.011 + breath * 0.02})`;
        ctx.beginPath();
        ctx.arc(center, center, base + offset, 0, Math.PI * 2);
        ctx.stroke();
      });

      // Sparse particles, slowly orbiting and softly twinkling.
      for (const p of particles) {
        p.angle += p.drift * 0.02;
        const twinkle = 0.25 + ((Math.sin(time / 1400 + p.phase) + 1) / 2) * 0.4;
        const x = center + Math.cos(p.angle) * p.radius;
        const y = center + Math.sin(p.angle) * p.radius;
        ctx.fillStyle = `rgba(196, 178, 246, ${twinkle * 0.5})`;
        ctx.beginPath();
        ctx.arc(x, y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }

      // Central orb: soft halo plus a small dense core.
      const orbRadius = 13 + breath * 2.5;
      const halo = ctx.createRadialGradient(
        center,
        center,
        0,
        center,
        center,
        orbRadius * 3.2
      );
      halo.addColorStop(0, `rgba(178, 152, 255, ${0.5 + breath * 0.18})`);
      halo.addColorStop(0.32, "rgba(136, 106, 226, 0.18)");
      halo.addColorStop(1, "rgba(96, 72, 180, 0)");
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(center, center, orbRadius * 3.2, 0, Math.PI * 2);
      ctx.fill();

      const core = ctx.createRadialGradient(
        center,
        center,
        0,
        center,
        center,
        orbRadius
      );
      core.addColorStop(0, `rgba(238, 232, 255, ${0.9 + breath * 0.1})`);
      core.addColorStop(0.55, "rgba(174, 148, 252, 0.55)");
      core.addColorStop(1, "rgba(120, 92, 210, 0)");
      ctx.fillStyle = core;
      ctx.beginPath();
      ctx.arc(center, center, orbRadius, 0, Math.PI * 2);
      ctx.fill();
    };

    const loop = (now: number) => {
      frame = requestAnimationFrame(loop);
      const delta = now - last;
      last = now;
      accumulator += delta;
      if (accumulator < frameInterval) return;
      accumulator = 0;
      time += delta * speed;
      draw();
    };

    // Always paint one frame so a paused screen is never blank.
    draw();
    if (playing) frame = requestAnimationFrame(loop);

    return () => cancelAnimationFrame(frame);
  }, [size, playing, speed, runId, fps]);

  return (
    <canvas
      ref={canvasRef}
      width={size}
      height={size}
      className="block rounded-full bg-black"
      style={{ width: size, height: size }}
    />
  );
}

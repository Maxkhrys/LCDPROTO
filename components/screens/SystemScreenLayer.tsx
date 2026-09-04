"use client";

import { useEffect, useRef } from "react";
import {
  getScreen,
  type ScreenId,
  type ScreenTransition,
} from "@/lib/screenCatalogue";

const TAU = Math.PI * 2;
const CENTRE = 233;

const clamp = (value: number, min: number, max: number) =>
  value < min ? min : value > max ? max : value;

/** Smootherstep, shared by every transition so they all feel related. */
const ease = (t: number) => {
  const c = clamp(t, 0, 1);
  return c * c * c * (c * (c * 6 - 15) + 10);
};

/**
 * Screen palette. Colour carries the meaning, so it stays consistent:
 * cyan for wireless, green for success, amber for working, red for faults,
 * soft white for neutral system states.
 */
const INK = {
  neutral: "222, 230, 238",
  wireless: "86, 196, 240",
  ready: "96, 208, 150",
  working: "230, 176, 84",
  fault: "226, 96, 88",
} as const;

const rgba = (ink: string, alpha: number) =>
  `rgba(${ink}, ${clamp(alpha, 0, 1).toFixed(3)})`;

/** Fraction of a screen's run spent arriving and leaving. */
const IN_PORTION = 0.18;
const OUT_PORTION = 0.16;

interface Envelope {
  /** 0..1 overall presence of the screen's own marks. */
  alpha: number;
  /** Small vertical lift for "rise" transitions, in 466-space pixels. */
  lift: number;
  /** Extra brightness for "bloom" transitions. */
  bloom: number;
}

/**
 * One transition system for every screen. Each screen only declares which
 * transition it uses; the timing and shape live here.
 */
function envelope(
  progress: number,
  transitionIn: ScreenTransition,
  transitionOut: ScreenTransition
): Envelope {
  const enter = clamp(progress / IN_PORTION, 0, 1);
  const exit = clamp((1 - progress) / OUT_PORTION, 0, 1);
  const inEase = transitionIn === "cut" ? 1 : ease(enter);
  const outEase = transitionOut === "cut" ? 1 : ease(exit);
  return {
    alpha: inEase * outEase,
    lift: transitionIn === "rise" ? (1 - inEase) * 9 : 0,
    bloom:
      (transitionIn === "bloom" ? 1 - inEase : 0) +
      (transitionOut === "bloom" ? 1 - outEase : 0),
  };
}

/**
 * How dark a veil sits over Blob and the environment for this screen.
 *
 * This is how the power screens work without touching the Blob rig: he keeps
 * running his own idle underneath, and the screen decides how much of him the
 * panel actually shows.
 */
export function screenVeil(id: ScreenId, progress: number): number {
  const p = ease(progress);
  switch (id) {
    case "BOOT_BLACK":
    case "DISPLAY_INIT":
    case "LCDPROTO_MARK":
    case "ASSET_LOADING":
    case "SEARCHING":
    case "PAIRING":
    case "CONNECTING":
    case "OFFLINE":
    case "RECONNECTING":
    case "ERROR":
    case "FIRMWARE_UPDATE":
    case "UPDATE_COMPLETE":
    case "LOW_POWER":
      // Blob is not part of these screens at all.
      return 1;
    case "BLOB_WAKE":
      // He emerges: full black lifting away to nothing.
      return 1 - ease(clamp(progress / 0.72, 0, 1));
    case "WAKE":
      return 1 - ease(clamp(progress / 0.85, 0, 1));
    case "SLEEP":
      // Fades all the way to true black and stays there.
      return p;
    case "DIMMED_PAUSE":
      return 0.5;
    case "PAUSE":
      return 0.12;
    case "BLOB_READY":
    case "CONNECTED_CONFIRMATION":
      return 0;
    default:
      return 0;
  }
}

/** Screens where Blob's own motion should quieten without being frozen. */
export function screenStillness(id: ScreenId): number {
  switch (id) {
    case "PAUSE":
      return 0.45;
    case "DIMMED_PAUSE":
      return 0.75;
    case "SLEEP":
      return 0.92;
    case "BLOB_READY":
      return 0.3;
    default:
      return 0;
  }
}

// --- Marks -----------------------------------------------------------------

function ring(
  ctx: CanvasRenderingContext2D,
  radius: number,
  width: number,
  colour: string,
  from = -Math.PI / 2,
  to = -Math.PI / 2 + TAU
) {
  ctx.beginPath();
  ctx.lineWidth = width;
  ctx.strokeStyle = colour;
  ctx.arc(CENTRE, CENTRE, radius, from, to);
  ctx.stroke();
}

function checkMark(
  ctx: CanvasRenderingContext2D,
  reveal: number,
  colour: string,
  scale = 1
) {
  // Two segments drawn in sequence, so the check writes itself rather than
  // popping in. Path only — no font, nothing to rasterise.
  const r = clamp(reveal, 0, 1);
  const a = { x: CENTRE - 20 * scale, y: CENTRE + 2 * scale };
  const b = { x: CENTRE - 6 * scale, y: CENTRE + 16 * scale };
  const c = { x: CENTRE + 21 * scale, y: CENTRE - 15 * scale };
  ctx.beginPath();
  ctx.lineWidth = 3.4 * scale;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = colour;
  ctx.moveTo(a.x, a.y);
  const first = clamp(r / 0.4, 0, 1);
  ctx.lineTo(a.x + (b.x - a.x) * first, a.y + (b.y - a.y) * first);
  if (r > 0.4) {
    const second = clamp((r - 0.4) / 0.6, 0, 1);
    ctx.lineTo(b.x + (c.x - b.x) * second, b.y + (c.y - b.y) * second);
  }
  ctx.stroke();
}

/**
 * Draws one screen's own marks. Blob and the environment are separate layers
 * underneath — nothing here knows about them.
 */
function drawScreen(
  ctx: CanvasRenderingContext2D,
  id: ScreenId,
  progress: number,
  simulated: number,
  time: number,
  env: Envelope,
  reducedMotion: boolean
) {
  const a = env.alpha;
  if (a <= 0.001) return;
  const breath = reducedMotion ? 0 : Math.sin(time / 1400) * 0.5 + 0.5;
  ctx.save();
  ctx.translate(0, env.lift);
  ctx.lineCap = "round";

  switch (id) {
    case "BOOT_BLACK":
      // Deliberately nothing. True black is the screen.
      break;

    case "DISPLAY_INIT": {
      // One dim ring lifting out of black. Peak brightness stays low so the
      // panel reads as waking rather than switching on.
      const glow = 0.05 + ease(progress) * 0.16;
      ring(ctx, 150, 1, rgba(INK.neutral, glow * a));
      ring(ctx, 150 - 9, 1, rgba(INK.neutral, glow * 0.3 * a));
      break;
    }

    case "LCDPROTO_MARK": {
      // A ring with a single break, plus one centre dot. No wordmark.
      const settle = ease(clamp(progress / 0.5, 0, 1));
      const gap = 0.42 * (1 - settle) + 0.12;
      ring(
        ctx,
        86,
        2,
        rgba(INK.neutral, 0.72 * a),
        -Math.PI / 2 + gap,
        -Math.PI / 2 + TAU - gap
      );
      ctx.beginPath();
      ctx.fillStyle = rgba(INK.neutral, 0.85 * a * settle);
      ctx.arc(CENTRE, CENTRE, 5.5, 0, TAU);
      ctx.fill();
      break;
    }

    case "ASSET_LOADING": {
      // A calm breathing core inside a progress arc: no spinner, and nothing
      // sitting bright and static in one place.
      const core = 26 + breath * 4;
      ctx.beginPath();
      ctx.fillStyle = rgba(INK.neutral, (0.1 + breath * 0.07) * a);
      ctx.arc(CENTRE, CENTRE, core, 0, TAU);
      ctx.fill();
      ring(ctx, 118, 1, rgba(INK.neutral, 0.09 * a));
      ring(
        ctx,
        118,
        2.4,
        rgba(INK.neutral, 0.62 * a),
        -Math.PI / 2,
        -Math.PI / 2 + TAU * simulated
      );
      break;
    }

    case "BLOB_WAKE":
    case "WAKE": {
      // A soft ring cue expands and fades as Blob comes back underneath.
      const spread = ease(clamp(progress / 0.7, 0, 1));
      ring(
        ctx,
        60 + spread * 120,
        1.6,
        rgba(INK.neutral, 0.4 * (1 - spread) * a)
      );
      break;
    }

    case "BLOB_READY": {
      const settle = ease(clamp(progress / 0.6, 0, 1));
      ring(ctx, 150 + settle * 14, 1.4, rgba(INK.ready, 0.34 * (1 - settle) * a));
      break;
    }

    case "PAUSE":
    case "DIMMED_PAUSE":
    case "SLEEP":
      // Power screens are carried entirely by the veil and by Blob quietening.
      // Nothing is drawn: a lit indicator held on a sleeping AMOLED is exactly
      // what burns the panel.
      break;

    case "SEARCHING": {
      // Two rings breathing outward. Restrained, and explicitly not a radar
      // sweep — no rotating wedge, no trailing tail.
      for (let i = 0; i < 2; i += 1) {
        const phase = reducedMotion
          ? 0.5
          : ((time / 2100 + i * 0.5) % 1 + 1) % 1;
        const radius = 58 + phase * 96;
        ring(
          ctx,
          radius,
          1.6,
          rgba(INK.wireless, 0.42 * (1 - phase) * a)
        );
      }
      ctx.beginPath();
      ctx.fillStyle = rgba(INK.wireless, 0.5 * a);
      ctx.arc(CENTRE, CENTRE, 5, 0, TAU);
      ctx.fill();
      break;
    }

    case "PAIRING": {
      // A ring closing from two points. The first attempt swung two arcs
      // around by an offset, which at larger offsets stacked them on the same
      // side and read as one lopsided arc.
      const meet = ease(simulated);
      const half = Math.PI * meet;
      ring(ctx, 104, 1, rgba(INK.wireless, 0.1 * a));
      ring(ctx, 104, 2.4, rgba(INK.wireless, 0.62 * a), -Math.PI / 2, -Math.PI / 2 + half);
      ring(ctx, 104, 2.4, rgba(INK.wireless, 0.62 * a), Math.PI / 2, Math.PI / 2 + half);
      ctx.beginPath();
      ctx.fillStyle = rgba(INK.wireless, 0.3 * meet * a);
      ctx.arc(CENTRE, CENTRE, 4 + meet * 3, 0, TAU);
      ctx.fill();
      break;
    }

    case "CONNECTING": {
      ring(ctx, 104, 1, rgba(INK.wireless, 0.12 * a));
      ring(
        ctx,
        104,
        2.6,
        rgba(INK.wireless, 0.7 * a),
        -Math.PI / 2,
        -Math.PI / 2 + TAU * simulated
      );
      break;
    }

    case "CONNECTED_CONFIRMATION": {
      const settle = ease(clamp(progress / 0.55, 0, 1));
      ring(ctx, 104 + settle * 10, 2.2, rgba(INK.ready, 0.66 * (1 - settle * 0.6) * a));
      break;
    }

    case "OFFLINE": {
      // A broken ring: the gap is the message. Dim and completely still.
      const gap = 0.34;
      ring(
        ctx,
        96,
        2,
        rgba(INK.fault, 0.42 * a),
        -Math.PI / 2 + gap,
        -Math.PI / 2 + TAU - gap
      );
      break;
    }

    case "RECONNECTING": {
      const phase = reducedMotion ? 0.25 : ((time / 2600) % 1 + 1) % 1;
      const head = -Math.PI / 2 + TAU * phase;
      ring(ctx, 96, 1, rgba(INK.working, 0.1 * a));
      ring(ctx, 96, 2.4, rgba(INK.working, 0.62 * a), head, head + TAU * 0.22);
      break;
    }

    case "ERROR": {
      // One controlled shake that decays to nothing, then it simply holds.
      const shake = reducedMotion
        ? 0
        : Math.sin(progress * 46) * 4 * Math.max(0, 1 - progress / 0.28);
      ctx.translate(shake, 0);
      ring(ctx, 96, 2.2, rgba(INK.fault, 0.6 * a));
      ctx.beginPath();
      ctx.lineWidth = 2.4;
      ctx.strokeStyle = rgba(INK.fault, 0.75 * a);
      ctx.moveTo(CENTRE, CENTRE - 22);
      ctx.lineTo(CENTRE, CENTRE + 6);
      ctx.stroke();
      ctx.beginPath();
      ctx.fillStyle = rgba(INK.fault, 0.75 * a);
      ctx.arc(CENTRE, CENTRE + 19, 2.6, 0, TAU);
      ctx.fill();
      break;
    }

    case "FIRMWARE_UPDATE": {
      // Deterministic progress, with tick marks so movement is legible even
      // when the arc is advancing slowly.
      ring(ctx, 112, 1, rgba(INK.working, 0.12 * a));
      for (let i = 0; i < 12; i += 1) {
        const angle = -Math.PI / 2 + (TAU * i) / 12;
        const lit = simulated > i / 12;
        ctx.beginPath();
        ctx.lineWidth = 1.6;
        ctx.strokeStyle = rgba(INK.working, (lit ? 0.5 : 0.12) * a);
        ctx.moveTo(
          CENTRE + Math.cos(angle) * 122,
          CENTRE + Math.sin(angle) * 122
        );
        ctx.lineTo(
          CENTRE + Math.cos(angle) * 129,
          CENTRE + Math.sin(angle) * 129
        );
        ctx.stroke();
      }
      ring(
        ctx,
        112,
        2.8,
        rgba(INK.working, 0.7 * a),
        -Math.PI / 2,
        -Math.PI / 2 + TAU * simulated
      );
      break;
    }

    case "UPDATE_COMPLETE": {
      ring(ctx, 112, 2.4, rgba(INK.ready, 0.6 * a));
      checkMark(ctx, clamp(progress / 0.55, 0, 1), rgba(INK.ready, 0.85 * a));
      break;
    }

    case "LOW_POWER": {
      // Deliberately dim: this screen exists to use less light, not more.
      const level = 0.18;
      ring(ctx, 96, 1, rgba(INK.working, 0.1 * a));
      ring(
        ctx,
        96,
        2.6,
        rgba(INK.working, 0.5 * a),
        Math.PI / 2 - TAU * level,
        Math.PI / 2 + TAU * level
      );
      break;
    }

    default:
      // Existing device states draw themselves; nothing is overlaid.
      break;
  }

  if (env.bloom > 0.001) {
    ctx.globalCompositeOperation = "lighter";
    ctx.beginPath();
    ctx.fillStyle = rgba(INK.neutral, env.bloom * 0.05);
    ctx.arc(CENTRE, CENTRE, 233, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

interface SystemScreenLayerProps {
  /** Native screen size in pixels (466). */
  size: number;
  /** Visible CSS diameter; drawing coordinates remain in native space. */
  viewportSize?: number;
  renderScale: number;
  screen: ScreenId;
  progress: number;
  simulated: number;
  /** Monotonic time in ms, for the few screens with continuous motion. */
  time: number;
  reducedMotion?: boolean;
}

/**
 * The system-screen marks, drawn above Blob and the environment.
 *
 * Everything is paths on one canvas at native resolution — no images to decode,
 * no blur filters, no sprite sheets — so the same drawing calls port to the
 * ESP32 with only the 2D context swapped out.
 */
export default function SystemScreenLayer({
  size,
  viewportSize = size,
  renderScale,
  screen,
  progress,
  simulated,
  time,
  reducedMotion = false,
}: SystemScreenLayerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(renderScale, 0, 0, renderScale, 0, 0);
    ctx.clearRect(0, 0, size, size);
    const definition = getScreen(screen);
    if (definition.category === "state") return;
    const env = envelope(
      definition.durationMs > 0 ? progress : 1,
      definition.transitionIn,
      definition.transitionOut
    );
    drawScreen(ctx, screen, progress, simulated, time, env, reducedMotion);
  }, [size, renderScale, screen, progress, simulated, time, reducedMotion]);

  return (
    <canvas
      ref={canvasRef}
      width={size * renderScale}
      height={size * renderScale}
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        width: viewportSize,
        height: viewportSize,
        pointerEvents: "none",
        zIndex: 5,
        imageRendering: renderScale === 1 ? "pixelated" : "auto",
      }}
    />
  );
}

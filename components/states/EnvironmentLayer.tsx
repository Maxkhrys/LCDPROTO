"use client";

import { useEffect, useRef } from "react";
import { BODY_FRACTION, type BlobRig } from "@/lib/blobRig";
import type {
  EnvironmentConfig,
  EnvironmentStatus,
} from "@/lib/environmentConfig";

const TAU = Math.PI * 2;
const CENTRE = 233;
/**
 * Half-height of Blob's solid silhouette at 1.00x, in 466-space pixels.
 *
 * BODY_FRACTION of the display wide, scaled by the body artwork's aspect, and
 * then by 0.94 because the PNG carries transparent padding and his underside
 * is rounded — his lowest drawn pixel sits above the image edge. Measured
 * against the rendered canvas.
 */
const BODY_HALF_HEIGHT = 233 * BODY_FRACTION * (589 / 598) * 0.94;
/** Largest background shift, in 466-space pixels. Restrained on purpose. */
const PARALLAX_LIMIT = 2;
/** Gap between that foot and the centre of the contact patch. */
const SHADOW_DROP = 10;
/**
 * Resting patch size. Scaled from Blob's solid core rather than fixed: at 76px
 * the shadow was narrower than his own base and stayed hidden behind him.
 */
const SHADOW_BASE_WIDTH = 233 * BODY_FRACTION * 0.86;
const SHADOW_BASE_HEIGHT = SHADOW_BASE_WIDTH * 0.17;

interface EnvironmentLayerProps {
  size: number;
  viewportSize?: number;
  renderScale: number;
  playing: boolean;
  speed: number;
  screenColour: string;
  displayMode: "dark" | "warm" | "brown";
  rig: BlobRig;
  config: EnvironmentConfig;
  onStatus?: (status: EnvironmentStatus) => void;
}

interface Mote {
  x: number;
  y: number;
  radius: number;
  phase: number;
  drift: number;
  depth: number;
  foreground: boolean;
}

const MOTES: readonly Mote[] = [
  { x: 76, y: 174, radius: 0.85, phase: 0.1, drift: 0.7, depth: 0.5, foreground: false },
  { x: 122, y: 104, radius: 0.7, phase: 1.4, drift: 0.45, depth: 0.25, foreground: false },
  { x: 352, y: 131, radius: 0.9, phase: 2.6, drift: 0.56, depth: 0.7, foreground: false },
  { x: 392, y: 238, radius: 0.72, phase: 3.7, drift: 0.38, depth: 0.35, foreground: false },
  { x: 91, y: 302, radius: 0.62, phase: 4.9, drift: 0.3, depth: 0.18, foreground: false },
  { x: 373, y: 330, radius: 0.8, phase: 5.6, drift: 0.52, depth: 0.6, foreground: false },
  { x: 176, y: 72, radius: 0.65, phase: 2.1, drift: 0.33, depth: 0.8, foreground: true },
  { x: 309, y: 357, radius: 0.72, phase: 4.2, drift: 0.28, depth: 0.9, foreground: true },
] as const;

class ScalarSpring {
  value = 0;
  velocity = 0;

  reset() {
    this.value = 0;
    this.velocity = 0;
  }

  step(target: number, dt: number, frequency: number, damping: number) {
    const steps = Math.max(1, Math.ceil(dt * 120));
    const h = dt / steps;
    const omega = Math.PI * 2 * frequency;
    for (let i = 0; i < steps; i++) {
      const acceleration =
        (target - this.value) * omega * omega - this.velocity * 2 * damping * omega;
      this.velocity += acceleration * h;
      this.value += this.velocity * h;
    }
  }
}

const clamp = (value: number, min: number, max: number) =>
  value < min ? min : value > max ? max : value;

function rgba(hex: string, alpha: number) {
  const value = hex.replace("#", "");
  const r = Number.parseInt(value.slice(0, 2), 16) || 0;
  const g = Number.parseInt(value.slice(2, 4), 16) || 0;
  const b = Number.parseInt(value.slice(4, 6), 16) || 0;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function scenePalette(mode: EnvironmentLayerProps["displayMode"]) {
  if (mode === "warm") {
    return {
      sandLight: "#ddcbb5",
      sandMid: "#b99b7a",
      sandDark: "#80684f",
      ripple: "#76593d",
      dust: "#ffe7bd",
      bounce: "#e2a34e",
    };
  }
  if (mode === "brown") {
    return {
      sandLight: "#b99e81",
      sandMid: "#92765b",
      sandDark: "#5d4735",
      ripple: "#4f392a",
      dust: "#f3c98b",
      bounce: "#c3833d",
    };
  }
  return {
    sandLight: "#1b120b",
    sandMid: "#090705",
    sandDark: "#000000",
    ripple: "#6b4524",
    dust: "#f1be72",
    bounce: "#a86122",
  };
}

function drawStaticScene(
  ctx: CanvasRenderingContext2D,
  size: number,
  displayMode: EnvironmentLayerProps["displayMode"],
  screenColour: string
) {
  const palette = scenePalette(displayMode);
  const base = displayMode === "dark" ? screenColour : palette.sandMid;
  ctx.clearRect(0, 0, size, size);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);

  const atmosphere = ctx.createRadialGradient(CENTRE, 177, 32, CENTRE, 215, 285);
  atmosphere.addColorStop(0, rgba(palette.sandLight, displayMode === "dark" ? 0.16 : 0.86));
  atmosphere.addColorStop(0.55, rgba(palette.sandMid, displayMode === "dark" ? 0.08 : 0.5));
  atmosphere.addColorStop(1, rgba(palette.sandDark, displayMode === "dark" ? 0.28 : 0.44));
  ctx.fillStyle = atmosphere;
  ctx.fillRect(0, 0, size, size);

  // A few broad zen-garden ripples. They are static geometry, so the device
  // only needs to redraw a cached bitmap during animation.
  ctx.save();
  ctx.translate(CENTRE, 393);
  ctx.rotate(-0.035);
  ctx.lineWidth = 1.2;
  ctx.strokeStyle = rgba(palette.ripple, displayMode === "dark" ? 0.22 : 0.26);
  for (let i = 0; i < 8; i += 1) {
    ctx.globalAlpha = 0.82 - i * 0.065;
    ctx.beginPath();
    ctx.ellipse(0, i * 7, 182 - i * 11, 28 - i * 1.8, 0, Math.PI * 0.08, Math.PI * 0.92);
    ctx.stroke();
  }
  ctx.restore();
}

function drawMote(
  ctx: CanvasRenderingContext2D,
  mote: Mote,
  time: number,
  speed: number,
  palette: ReturnType<typeof scenePalette>,
  alphaScale: number
) {
  const cycle = (time * mote.drift * speed + mote.phase * 33) % 420;
  const y = mote.y - cycle * 0.08;
  const x = mote.x + Math.sin(time * 0.34 + mote.phase) * (1.4 + mote.depth);
  const twinkle = 0.35 + Math.pow((Math.sin(time * 0.7 + mote.phase) + 1) * 0.5, 7) * 0.65;
  const radius = mote.radius * (0.82 + twinkle * 0.22);
  ctx.globalAlpha = alphaScale * twinkle * (0.34 + mote.depth * 0.24);
  ctx.fillStyle = palette.dust;
  ctx.beginPath();
  ctx.arc(x, y < 42 ? y + 330 : y, radius, 0, TAU);
  ctx.fill();
}

function drawShadow(
  ctx: CanvasRenderingContext2D,
  scaleX: number,
  scaleY: number,
  opacity: number,
  x: number,
  y: number,
  softness: number,
  colour: string
) {
  const width = SHADOW_BASE_WIDTH * scaleX;
  const height = SHADOW_BASE_HEIGHT * scaleY;
  const edge = clamp(softness, 0.35, 0.95);
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1, height / Math.max(width, 1));
  // The gradient has to be built AFTER the transform and centred on the local
  // origin. Built in page space beforehand, the translate below moved its
  // centre to roughly (2x, 2y) — far outside the ellipse — so every pixel of
  // the shadow sampled the transparent tail and nothing was drawn at all.
  const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, width * 0.58);
  gradient.addColorStop(0, rgba(colour, opacity));
  gradient.addColorStop(edge, rgba(colour, opacity * 0.42));
  gradient.addColorStop(1, rgba(colour, 0));
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.ellipse(0, 0, width, width, 0, 0, TAU);
  ctx.fill();
  ctx.restore();
}

/**
 * Warm miniature-world layer. It deliberately stays separate from
 * BlobCharacter: the rig remains the only source of character pixels.
 */
export default function EnvironmentLayer({
  size,
  viewportSize = size,
  renderScale,
  playing,
  speed,
  screenColour,
  displayMode,
  rig,
  config,
  onStatus,
}: EnvironmentLayerProps) {
  const backgroundRef = useRef<HTMLCanvasElement>(null);
  const foregroundRef = useRef<HTMLCanvasElement>(null);
  const staticSceneRef = useRef<HTMLCanvasElement | null>(null);
  const rigRef = useRef(rig);
  const configRef = useRef(config);
  const statusRef = useRef(onStatus);
  const elapsedRef = useRef(0);
  const shadowX = useRef(new ScalarSpring());
  const shadowY = useRef(new ScalarSpring());
  const shadowHeight = useRef(new ScalarSpring());

  rigRef.current = rig;
  configRef.current = config;
  statusRef.current = onStatus;

  useEffect(() => {
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    drawStaticScene(ctx, size, displayMode, screenColour);
    staticSceneRef.current = canvas;
    shadowX.current.reset();
    shadowY.current.reset();
    shadowHeight.current.reset();
  }, [size, renderScale, displayMode, screenColour]);

  useEffect(() => {
    const background = backgroundRef.current;
    const foreground = foregroundRef.current;
    const backgroundCtx = background?.getContext("2d");
    const foregroundCtx = foreground?.getContext("2d");
    if (!background || !foreground || !backgroundCtx || !foregroundCtx) return;

    let frameId = 0;
    let last = performance.now();
    let statusAt = 0;
    const render = (now: number) => {
      const delta = playing ? Math.min(100, now - last) : 0;
      last = now;
      elapsedRef.current += (delta / 1000) * speed;
      const elapsedSeconds = elapsedRef.current;
      const active = configRef.current;
      const currentRig = rigRef.current;
      const dt = Math.min(delta, 100) * speed / 1000;

      backgroundCtx.setTransform(renderScale, 0, 0, renderScale, 0, 0);
      foregroundCtx.setTransform(renderScale, 0, 0, renderScale, 0, 0);
      backgroundCtx.clearRect(0, 0, size, size);
      foregroundCtx.clearRect(0, 0, size, size);
      const staticScene = staticSceneRef.current;
      if (staticScene) {
        // Clamped, then drawn with overscan. Unclamped this reached ~40px when
        // Blob was dragged, which both overpowered the parallax and slid the
        // scene off its own edge, leaving a bare strip down one side.
        const parallaxX = active.parallaxEnabled
          ? clamp(-currentRig.blob.x * active.parallax, -PARALLAX_LIMIT, PARALLAX_LIMIT)
          : 0;
        backgroundCtx.drawImage(
          staticScene,
          parallaxX - PARALLAX_LIMIT,
          -PARALLAX_LIMIT,
          size + PARALLAX_LIMIT * 2,
          size + PARALLAX_LIMIT * 2
        );
      }

      if (!active.enabled) {
        backgroundCtx.fillStyle = screenColour;
        backgroundCtx.fillRect(0, 0, size, size);
        if (playing) frameId = requestAnimationFrame(render);
        return;
      }

      const palette = scenePalette(displayMode);
      // 1. Core-driven spatial placement (ignore decorative outer wisps/billows)
      const depthScale = clamp(1 + currentRig.blob.depth * 0.28, 0.84, 1.16);
      // Turning alone should not dramatically distort the shadow: subtle footprint modulation only
      const shadowYawMod =
        0.95 + Math.abs(Math.cos((currentRig.blob.yaw * Math.PI) / 180)) * 0.05;
      const wholeScaleX =
        currentRig.blob.scale * depthScale * shadowYawMod * currentRig.blob.scaleX;
      const wholeScaleY =
        currentRig.blob.scale * depthScale * currentRig.blob.scaleY;

      // Subtle lateral ground displacement and spring lag from character lean
      const leanOffset = (currentRig.body.skewX || 0) * 0.28 * wholeScaleX;
      const footX = currentRig.blob.x + (currentRig.body.x + leanOffset) * wholeScaleX;

      // 2. Stable Fake Floor-Plane Ground Model with Guaranteed Minimum Visual Gap
      // The floor plane sits at a stable physical altitude in the 466-space scene
      const FLOOR_REST_Y = CENTRE + BODY_HALF_HEIGHT + SHADOW_DROP + active.shadowYOffset;
      // Core center and bottom underside in screen space
      const coreScreenY = CENTRE + currentRig.blob.y + currentRig.body.y;
      // Belly bottom boundary (dense core underside)
      const bodyUndersideY = coreScreenY + 108 * wholeScaleY;
      // Stable minimum visual gap: the shadow must never visually "kiss" or overlap the body
      const MIN_VISUAL_GAP = 22 * wholeScaleY;
      const minShadowY = bodyUndersideY + MIN_VISUAL_GAP;
      // Floor contact target: stays on the floor plane unless character descends past it
      const targetFloorY = Math.max(FLOOR_REST_Y, minShadowY);

      // 3. True Physical Hover Distance
      const hoverDistance = targetFloorY - bodyUndersideY;
      const RESTING_HOVER_GAP = FLOOR_REST_Y - (CENTRE + 108); // ~40px
      const hoverRatio = clamp(hoverDistance / Math.max(20, RESTING_HOVER_GAP), 0.35, 2.5);

      // Filtered vertical altitude signal for height scale/opacity
      const altitudeSignal = clamp(hoverRatio, 0.35, 2.2);
      shadowX.current.step(footX, dt, 2.05 - active.shadowLag / 260, 0.72);
      shadowY.current.step(targetFloorY - CENTRE, dt, 2.1 - active.shadowLag / 280, 0.75);
      shadowHeight.current.step(altitudeSignal, dt, 2.25 - active.shadowLag / 300, 0.76);
      const height = clamp(shadowHeight.current.value, 0.3, 2.0);

      // 4. Height rules: higher = smaller, softer, lighter; lower = wider, darker, tighter
      const heightScale = clamp(1 - (height - 1.0) * 0.32, 0.42, 1.28);
      const heightOpacity = clamp(1 - (height - 1.0) * 0.40, 0.28, 1.0);

      // 5. Compression & Landing Settlement
      const isGroundedSink = hoverRatio < 0.95 ? (0.95 - hoverRatio) * 0.8 : 0;
      const bodyDeformY = currentRig.body.scaleY - 1;
      const bodyDeformX = currentRig.body.scaleX - 1;
      const squash = Math.max(0, -bodyDeformY) + Math.max(0, bodyDeformX) * 0.35 + isGroundedSink;
      const stretch = Math.max(0, bodyDeformY);
      const stretchComp = 1 - clamp(stretch * 0.25, 0, 0.35);

      // Proportional to how wide character actually is
      const spread = Math.max(0.35, currentRig.body.scaleX * wholeScaleX);
      const shadowScaleX =
        active.shadowWidth * spread * (heightScale * stretchComp + squash * 1.8);
      const shadowScaleY =
        active.shadowHeight * spread * (heightScale * stretchComp * 0.82 + 0.18);
      const shadowOpacity = clamp(
        active.shadowOpacity * (heightOpacity + isGroundedSink * 0.22),
        0,
        0.95
      );
      // Dynamic softness: tighter & crisper when grounded/dropping; lighter & diffused when rising
      const dynamicSoftness = clamp(
        active.shadowSoftness * (0.65 + (height - 1.0) * 0.42),
        0.28,
        1.55
      );
      // Clamped final shadow position: strictly guaranteed to NEVER visually "kiss" the body
      const rawShadowY = CENTRE + shadowY.current.value;
      const shadowYPosition = Math.max(rawShadowY, bodyUndersideY + MIN_VISUAL_GAP);

      if (active.bounceEnabled) {
        const bounce = backgroundCtx.createRadialGradient(
          CENTRE + shadowX.current.value,
          shadowYPosition - 2,
          2,
          CENTRE + shadowX.current.value,
          shadowYPosition - 2,
          68
        );
        bounce.addColorStop(0, rgba(palette.bounce, active.bounceLight * (0.075 + (1 - height) * 0.04)));
        bounce.addColorStop(0.6, rgba(palette.bounce, active.bounceLight * 0.025));
        bounce.addColorStop(1, rgba(palette.bounce, 0));
        backgroundCtx.fillStyle = bounce;
        backgroundCtx.fillRect(0, 0, size, size);
      }

      if (active.shadowEnabled) {
        drawShadow(
          backgroundCtx,
          shadowScaleX,
          shadowScaleY,
          shadowOpacity,
          CENTRE + shadowX.current.value,
          shadowYPosition,
          dynamicSoftness,
          displayMode === "dark" ? "#080604" : "#4b3729"
        );
      }

      const lightPulse = 0.84 + Math.sin(elapsedSeconds / 10.5) * 0.16;
      // Directional ambient light pool follows the character as he moves across the screen
      const charCenterY = 201 + currentRig.blob.y + currentRig.body.y;
      const lightFollowX = CENTRE + shadowX.current.value * 0.72 - 18;
      const lightFollowY = clamp(charCenterY - 24, 60, size - 100);

      const ambient = backgroundCtx.createRadialGradient(
        lightFollowX,
        lightFollowY,
        28 * spread,
        lightFollowX,
        lightFollowY,
        220 * spread
      );
      ambient.addColorStop(0, rgba(palette.bounce, active.ambientLight * 0.034 * lightPulse));
      ambient.addColorStop(0.55, rgba(palette.bounce, active.ambientLight * 0.014 * lightPulse));
      ambient.addColorStop(1, rgba(palette.bounce, 0));
      backgroundCtx.fillStyle = ambient;
      backgroundCtx.fillRect(0, 0, size, size);

      const count = clamp(Math.round(active.particleCount), 0, MOTES.length);
      if (active.particlesEnabled) {
        backgroundCtx.globalAlpha = 1;
        for (let i = 0; i < count; i += 1) {
          const mote = MOTES[i];
          if (!mote.foreground) drawMote(backgroundCtx, mote, elapsedSeconds, active.particleSpeed, palette, 1);
        }
        for (let i = 0; i < count; i += 1) {
          const mote = MOTES[i];
          if (mote.foreground) drawMote(foregroundCtx, mote, elapsedSeconds, active.particleSpeed, palette, 1);
        }
        backgroundCtx.globalAlpha = 1;
        foregroundCtx.globalAlpha = 1;
      }

      if (now - statusAt > 120) {
        statusAt = now;
        statusRef.current?.({
          blobHeight: height,
          shadowScaleX,
          shadowScaleY,
          shadowOpacity,
          shadowOffset: shadowX.current.value,
          particleCount: active.particlesEnabled ? count : 0,
        });
      }

      if (playing) frameId = requestAnimationFrame(render);
    };

    render(performance.now());
    return () => cancelAnimationFrame(frameId);
  }, [config, displayMode, playing, renderScale, screenColour, size, speed]);

  return (
    <>
      <canvas
        ref={backgroundRef}
        width={size * renderScale}
        height={size * renderScale}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-0 block"
        style={{ width: viewportSize, height: viewportSize, imageRendering: "auto" }}
      />
      <canvas
        ref={foregroundRef}
        width={size * renderScale}
        height={size * renderScale}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-20 block"
        style={{ width: viewportSize, height: viewportSize, imageRendering: "auto" }}
      />
    </>
  );
}

/**
 * Blob's miniature world: a static sand environment, a grounded contact
 * shadow, and a few dust motes.
 *
 * The world art is generated once per (size, renderScale, mode) and cached, so
 * the frame loop only ever blits one prepared canvas — no PNG decode, no
 * per-frame path building for the background. The shadow and dust are scalar
 * springs and simple canvas ellipses, which is what the ESP32 can afford.
 *
 * This module never draws Blob and never reads his artwork.
 */

import {
  BODY_FRACTION,
  RIG_ASSETS,
  type BlobColour,
  type BlobRig,
} from "./blobRig";
import type { DisplayMode } from "./deviceStates";

const clamp = (value: number, min: number, max: number) =>
  value < min ? min : value > max ? max : value;

/** Deterministic noise. Nothing in this module calls Math.random. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// --- Ground geometry -------------------------------------------------------

/** Horizon height, as a fraction of the display. Sand fills everything below. */
const HORIZON = 0.44;
/** Where Blob's feet rest, and where the rake rings are centred. */
const GROUND_Y = 0.5;

/**
 * Where Blob actually touches the ground, in 466-space pixels.
 *
 * Everything is derived from the same numbers BlobCharacter uses to draw him —
 * whole-character scale, depth, yaw foreshortening, body offset and body
 * deformation — so the shadow cannot drift away from the character.
 */
export interface BlobGround {
  /** Screen position of the lowest point of Blob's solid core. */
  footX: number;
  footY: number;
  /** Half-width of the solid core at its current deformation. */
  halfWidth: number;
  /** Resting foot height, so lift can be measured against the ground. */
  restY: number;
  /** Combined vertical scale, used for squash and stretch response. */
  scaleY: number;
}

/**
 * Where the body artwork's opaque silhouette actually ends, as a share of its
 * half-height. The PNG carries transparent padding and Blob's underside is
 * rounded, so his lowest drawn pixel sits well above the image edge — measured
 * at 0.79 against the rendered canvas. Using the raw image height instead put
 * the shadow ~30px below him with a visible gap.
 */
const BODY_FOOT_RATIO = 0.94;

export function blobGround(
  rig: BlobRig,
  size: number,
  colour: BlobColour,
  settingsDrop = 0
): BlobGround {
  const asset = RIG_ASSETS[colour].body;
  // The solid core is BODY_FRACTION of the display wide; the artwork's aspect
  // and its measured foot give the height. This is Blob's real silhouette.
  const coreHalfWidth = size * BODY_FRACTION * 0.5;
  const coreHalfHeight =
    coreHalfWidth * (asset.height / asset.solidWidth) * BODY_FOOT_RATIO;

  const { blob, body } = rig;
  const depthScale = clamp(1 + blob.depth * 0.28, 0.84, 1.16);
  const yawWidth = 0.34 + Math.abs(Math.cos((blob.yaw * Math.PI) / 180)) * 0.66;
  const scaleX = blob.scale * depthScale * yawWidth * blob.scaleX;
  const scaleY = blob.scale * depthScale * blob.scaleY;

  const centerX = size / 2 + blob.x;
  const centerY = size / 2 + blob.y + settingsDrop - blob.pitch * 0.18;

  return {
    footX: centerX + body.x * scaleX,
    footY: centerY + (body.y + coreHalfHeight * body.scaleY) * scaleY,
    halfWidth: coreHalfWidth * body.scaleX * scaleX,
    restY: size * GROUND_Y + coreHalfHeight,
    scaleY: body.scaleY * scaleY,
  };
}

// --- Static world art ------------------------------------------------------

interface Palette {
  skyTop: string;
  skyHorizon: string;
  glow: string;
  sandNear: string;
  sandFar: string;
  /** "r, g, b" for the rake crest; alpha is chosen per ring. */
  rake: string;
  stone: string;
  stoneLit: string;
}

const PALETTES: Record<"warm" | "brown", Palette> = {
  warm: {
    skyTop: "#b8843c",
    skyHorizon: "#f6d79a",
    glow: "rgba(255, 240, 205, 0.95)",
    sandFar: "#efd3a1",
    sandNear: "#c99a55",
    rake: "255, 233, 190",
    stone: "#a98a68",
    stoneLit: "#e2cbaa",
  },
  brown: {
    skyTop: "#7d5733",
    skyHorizon: "#c9975b",
    glow: "rgba(246, 214, 165, 0.85)",
    sandFar: "#c49a63",
    sandNear: "#8e6636",
    rake: "255, 226, 180",
    stone: "#8a6b4c",
    stoneLit: "#c2a482",
  },
};

/**
 * Stones, in fractions of the display.
 *
 * Each is placed so that its distance from the centre plus its own radius
 * stays inside 0.48 of the display, which keeps it clear of the circular crop
 * with room to spare. The centre is left open for Blob.
 */
const STONES = [
  { x: 0.185, y: 0.665, rx: 0.1, ry: 0.056, tilt: -0.1 },
  { x: 0.305, y: 0.785, rx: 0.075, ry: 0.043, tilt: 0.05 },
  { x: 0.8, y: 0.7, rx: 0.086, ry: 0.046, tilt: 0.08 },
];

const artCache = new Map<string, HTMLCanvasElement>();

/**
 * Builds — and then reuses — the whole static world.
 *
 * Everything that never changes lives here: sky, horizon glow, sand floor,
 * rake rings, grain, stones and their baked shadows, the brighter patch under
 * Blob, and the circular crop.
 */
export function environmentArt(
  size: number,
  renderScale: number,
  mode: DisplayMode
): HTMLCanvasElement | null {
  if (mode === "dark" || typeof document === "undefined") return null;
  const key = `${mode}:${size}:${renderScale}`;
  const cached = artCache.get(key);
  if (cached) return cached;

  const palette = PALETTES[mode];
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(size * renderScale);
  canvas.height = Math.ceil(size * renderScale);
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.setTransform(renderScale, 0, 0, renderScale, 0, 0);

  const horizonY = size * HORIZON;
  const groundY = size * GROUND_Y;
  const rand = mulberry32(0x5a4d);

  // Sky, warmest at the horizon.
  const sky = ctx.createLinearGradient(0, 0, 0, horizonY);
  sky.addColorStop(0, palette.skyTop);
  sky.addColorStop(1, palette.skyHorizon);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, size, horizonY + 1);

  // Sand floor. A real floor plane, darker as it comes toward the viewer.
  const floor = ctx.createLinearGradient(0, horizonY, 0, size);
  floor.addColorStop(0, palette.sandFar);
  floor.addColorStop(0.45, palette.sandNear);
  floor.addColorStop(1, mode === "warm" ? "#a97d3f" : "#6d4c28");
  ctx.fillStyle = floor;
  ctx.fillRect(0, horizonY, size, size - horizonY);

  // The low sun sitting on the horizon behind Blob.
  const glow = ctx.createRadialGradient(
    size / 2,
    horizonY,
    0,
    size / 2,
    horizonY,
    size * 0.46
  );
  glow.addColorStop(0, palette.glow);
  glow.addColorStop(0.35, "rgba(255, 222, 165, 0.35)");
  glow.addColorStop(1, "rgba(255, 210, 150, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, size, size);

  // Rake rings. Ellipses flattened by perspective, brightest near the centre
  // and fading out before they reach the crop, so they read as raked sand
  // rather than as drawn circles.
  ctx.lineCap = "round";
  for (let i = 1; i <= 9; i += 1) {
    const t = i / 9;
    const radiusX = size * (0.07 + t * 0.52);
    const radiusY = radiusX * 0.3;
    const fade = (1 - t * 0.72) * (mode === "warm" ? 1 : 0.85);
    ctx.lineWidth = 1.1 + t * 1.5;
    // Bright crest with a soft trough under it gives each groove real relief.
    ctx.strokeStyle = `rgba(${palette.rake}, ${(0.42 * fade).toFixed(3)})`;
    ctx.beginPath();
    ctx.ellipse(size / 2, groundY + size * 0.16, radiusX, radiusY, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = `rgba(96, 62, 26, ${(0.16 * fade).toFixed(3)})`;
    ctx.beginPath();
    ctx.ellipse(
      size / 2,
      groundY + size * 0.16 + 1.6 + t * 1.4,
      radiusX,
      radiusY,
      0,
      0,
      Math.PI * 2
    );
    ctx.stroke();
  }

  // Grain. Baked once; it is what stops the floor reading as a flat gradient.
  for (let i = 0; i < 2600; i += 1) {
    const x = rand() * size;
    const y = horizonY + rand() * (size - horizonY);
    const depth = (y - horizonY) / (size - horizonY);
    const a = 0.02 + rand() * 0.07 * (0.35 + depth);
    ctx.fillStyle =
      rand() < 0.5
        ? `rgba(255, 236, 200, ${a.toFixed(3)})`
        : `rgba(88, 56, 22, ${(a * 0.8).toFixed(3)})`;
    ctx.fillRect(x, y, 1 + depth, 1);
  }

  // Stones, each with its own baked contact shadow.
  for (const stone of STONES) {
    const cx = stone.x * size;
    const cy = stone.y * size;
    const rx = stone.rx * size;
    const ry = stone.ry * size;

    ctx.save();
    ctx.fillStyle = "rgba(74, 46, 18, 0.3)";
    ctx.beginPath();
    ctx.ellipse(cx + rx * 0.12, cy + ry * 0.78, rx * 1.02, ry * 0.34, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(stone.tilt);
    const body = ctx.createLinearGradient(0, -ry, 0, ry);
    body.addColorStop(0, palette.stoneLit);
    body.addColorStop(0.55, palette.stone);
    body.addColorStop(1, mode === "warm" ? "#7d6248" : "#5e452f");
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    // A single rim highlight reads as a lit top face without any blur filter.
    const rim = ctx.createRadialGradient(-rx * 0.3, -ry * 0.5, 0, 0, 0, rx);
    rim.addColorStop(0, "rgba(255, 244, 222, 0.42)");
    rim.addColorStop(1, "rgba(255, 244, 222, 0)");
    ctx.fillStyle = rim;
    ctx.beginPath();
    ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // A slightly brighter patch of ground where Blob stands, so he sits in a
  // place rather than on an even field.
  // Wide and weak: an earlier, tighter hotspot sat exactly where the contact
  // shadow lands and cancelled it out.
  const patch = ctx.createRadialGradient(
    size / 2,
    groundY + size * 0.2,
    0,
    size / 2,
    groundY + size * 0.2,
    size * 0.42
  );
  patch.addColorStop(0, "rgba(255, 236, 196, 0.1)");
  patch.addColorStop(1, "rgba(255, 236, 196, 0)");
  ctx.fillStyle = patch;
  ctx.fillRect(0, horizonY, size, size - horizonY);

  // Corner falloff keeps attention in the middle without flattening the world.
  const vignette = ctx.createRadialGradient(
    size / 2,
    size * 0.46,
    size * 0.3,
    size / 2,
    size * 0.5,
    size * 0.56
  );
  vignette.addColorStop(0, "rgba(60, 34, 10, 0)");
  vignette.addColorStop(1, "rgba(60, 34, 10, 0.38)");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, size, size);

  // Circular crop, so nothing can ever touch the bezel.
  ctx.globalCompositeOperation = "destination-in";
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
  ctx.fillStyle = "#fff";
  ctx.fill();

  artCache.set(key, canvas);
  return canvas;
}

// --- Shadow and dust -------------------------------------------------------

/**
 * Resting shadow size.
 *
 * Two earlier attempts failed for opposite reasons. A fixed 74px patch read as
 * a smudge under a character whose solid core is ~250px across; a 136px patch
 * was strong but sat entirely behind his silhouette, so only slivers showed.
 * The patch therefore scales with his core and is deliberately a little wider
 * than his contact area, so it reads on the sand either side of him. The 74px
 * figure survives as the floor for a fully lifted or shrunken pose.
 */
const SHADOW_CORE_RATIO = 1.06;
const SHADOW_MIN_WIDTH = 74;
const SHADOW_ASPECT = 0.15;
/** How far below Blob's lowest point the contact patch sits. */
const SHADOW_DROP = 22;
/**
 * Height at which a rise has fully lightened the shadow.
 *
 * Generous on purpose: ambient breathing already moves Blob ~12px, and at a
 * 30px range that idle drift alone was stealing 40% of the shadow, leaving him
 * looking unanchored at rest. Only a real jump should separate him.
 */
const LIFT_RANGE = 46;
/** Follow lag, in milliseconds. */
const LAG_MS = 100;

/**
 * Multiply strength of the contact patch.
 *
 * Well above the 0.3-ish figure that suits a small alpha-blended blob: this
 * shadow is a multiply under a character occupying half the display, and at
 * lower values it measured as a real darkening but read as nothing at native
 * size. Verified against screenshots at 466x466 rather than chosen on paper.
 */
const SHADOW_OPACITY: Record<DisplayMode, number> = {
  warm: 0.72,
  brown: 0.68,
  dark: 0.3,
};

export interface DustMote {
  x: number;
  y: number;
  radius: number;
  /** Positive drifts right; motes wrap around the display. */
  driftX: number;
  driftY: number;
  phase: number;
  period: number;
  foreground: boolean;
}

export interface EnvironmentPose {
  shadowX: number;
  shadowY: number;
  shadowWidth: number;
  shadowHeight: number;
  shadowOpacity: number;
  /** Background art offset, from Blob's own drift. */
  parallaxX: number;
  parallaxY: number;
  /** 0 grounded, 1 fully lifted. Drives the warm bounce light too. */
  lift: number;
  bounceX: number;
  bounceY: number;
  bounceRadius: number;
  bounceRadiusY: number;
}

/** Total motes. Sparse on purpose — this is grounding, not weather. */
const DUST_COUNT = 5;
const FOREGROUND_MOTES = 2;

/**
 * One lagged shadow and a handful of motes.
 *
 * Three first-order springs — x, y and a shared size/opacity channel — give
 * the shadow its ~100ms trail without any chance of overshoot ringing under a
 * character that is itself already spring-driven.
 */
export class EnvironmentController {
  private x = 0;
  private y = 0;
  private weight = 0;
  private started = false;
  private clock = 0;
  private readonly motes: DustMote[] = [];
  private readonly pose: EnvironmentPose = {
    shadowX: 0,
    shadowY: 0,
    shadowWidth: SHADOW_MIN_WIDTH,
    shadowHeight: SHADOW_MIN_WIDTH * SHADOW_ASPECT,
    shadowOpacity: 0,
    parallaxX: 0,
    parallaxY: 0,
    lift: 0,
    bounceX: 0,
    bounceY: 0,
    bounceRadius: 0,
    bounceRadiusY: 0,
  };

  constructor(size: number) {
    const rand = mulberry32(0xd0571);
    for (let i = 0; i < DUST_COUNT; i += 1) {
      const foreground = i < FOREGROUND_MOTES;
      this.motes.push({
        x: rand() * size,
        y: size * (0.24 + rand() * 0.62),
        // Large enough to actually read at native size.
        radius: foreground ? 2.2 + rand() * 1.1 : 1.5 + rand() * 0.8,
        driftX: (0.3 + rand() * 0.9) * (rand() < 0.5 ? -1 : 1),
        driftY: -0.12 - rand() * 0.3,
        phase: rand(),
        // Long periods keep the twinkle occasional rather than a flicker.
        period: 3400 + rand() * 3600,
        foreground,
      });
    }
  }

  get dust(): readonly DustMote[] {
    return this.motes;
  }

  reset() {
    this.started = false;
    this.clock = 0;
  }

  /**
   * @param drift Blob's own offset from the display centre, for parallax.
   */
  update(dtMs: number, ground: BlobGround, mode: DisplayMode, size: number) {
    const dt = clamp(dtMs, 0, 100);
    this.clock += dt;

    // The ground plane does not move. When Blob rises his feet leave it, and
    // that separation is what the shadow reports.
    const sink = clamp(ground.footY - ground.restY, -4, 34);
    const groundY = ground.restY + sink + SHADOW_DROP;
    const lift = clamp((ground.restY - ground.footY) / LIFT_RANGE, 0, 1);

    // Squash widens the contact patch, stretch narrows it. halfWidth already
    // carries the horizontal deformation, so this only adds the vertical half.
    const squash = clamp(1 + (1 - ground.scaleY) * 0.9, 0.78, 1.3);
    const spread = (ground.halfWidth / (size * BODY_FRACTION * 0.5)) * squash;

    if (!this.started) {
      this.started = true;
      this.x = ground.footX;
      this.y = groundY;
      this.weight = spread;
    } else {
      // First-order lag: value moves a fixed fraction of the remaining
      // distance each millisecond, giving a clean ~100ms trail.
      const k = 1 - Math.exp(-dt / LAG_MS);
      this.x += (ground.footX - this.x) * k;
      this.y += (groundY - this.y) * k;
      this.weight += (spread - this.weight) * k;
    }

    const shrink = 1 - lift * 0.26;
    const base = Math.max(
      SHADOW_MIN_WIDTH,
      size * BODY_FRACTION * SHADOW_CORE_RATIO
    );
    this.pose.shadowX = this.x;
    this.pose.shadowY = this.y;
    this.pose.shadowWidth = base * this.weight * shrink;
    // Stretching narrows the patch, squashing spreads it.
    this.pose.shadowHeight =
      base * SHADOW_ASPECT * shrink * clamp(2 - this.weight, 0.72, 1.24);
    this.pose.shadowOpacity = SHADOW_OPACITY[mode] * (1 - lift * 0.55);
    this.pose.lift = lift;

    // Parallax rates differ per layer, so the world has depth order: the far
    // background moves least, dust most.
    const driftX = ground.footX - size / 2;
    const driftY = ground.footY - ground.restY;
    this.pose.parallaxX = clamp(-driftX * 0.009, -1.5, 1.5);
    this.pose.parallaxY = clamp(-driftY * 0.009, -1.5, 1.5);

    // Warm light bouncing off the sand onto Blob's underside. It has to stay
    // inside his lower body: an earlier, larger version reached down onto the
    // sand and, being an additive pass over the shadow, cancelled it out.
    this.pose.bounceX = ground.footX;
    this.pose.bounceY = ground.footY - ground.halfWidth * 0.42;
    this.pose.bounceRadius = ground.halfWidth * 0.82;
    this.pose.bounceRadiusY = ground.halfWidth * 0.3;
    return this.pose;
  }

  /** Advances the motes. Deterministic; nothing is allocated per frame. */
  stepDust(dtMs: number, size: number) {
    const dt = clamp(dtMs, 0, 100) / 1000;
    for (const mote of this.motes) {
      mote.x += mote.driftX * dt * 6;
      mote.y += mote.driftY * dt * 6;
      if (mote.x < -4) mote.x = size + 4;
      if (mote.x > size + 4) mote.x = -4;
      if (mote.y < size * 0.18) mote.y = size * 0.86;
    }
  }

  /** Occasional twinkle: mostly dim, with a brief rise once per period. */
  moteAlpha(mote: DustMote) {
    const t = ((this.clock / mote.period + mote.phase) % 1 + 1) % 1;
    const pulse = t < 0.22 ? Math.sin((t / 0.22) * Math.PI) : 0;
    return (mote.foreground ? 0.22 : 0.14) + pulse * (mote.foreground ? 0.55 : 0.4);
  }
}

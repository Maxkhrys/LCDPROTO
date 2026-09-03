/**
 * Layered jelly material for the experimental procedural body.
 *
 * R&D ONLY. Everything is Canvas 2D gradients, clipped fills and short
 * strokes — no filters, no wide shadow blurs, no per-layer offscreen
 * compositing. The palettes were sampled out of the master artwork rather
 * than invented.
 *
 * The structure follows what the master actually is:
 *
 *   - a translucent SHELL filling the silhouette,
 *   - a DEPTH CURVE measured off the master, laid down as nested copies of
 *     the silhouette so the shading follows the outline rather than a circle,
 *   - seven named VOLUME LAYERS — a dark core, a front shell, an upper cap,
 *     three lower folds and a right-side reflection — each a sub-blob filled
 *     with a soft gradient that fades out before its own edge, so they read
 *     as masses inside the gel and never as outlines,
 *   - suspended sparks, bubbles and star flares,
 *   - specular highlights,
 *   - a thin rim whose brightness varies by angle.
 *
 * Every layer and feature is derived from the live silhouette or authored in
 * (angle, depth) around the centroid, so the whole material deforms with the
 * body for free.
 */

import {
  NEUTRAL_SHAPE,
  SurfaceRing,
  buildBlobShape,
  tracePath,
  type BlobShape,
  type Point,
} from "./blobShape";

export type PaletteId = "amber" | "violet";

export interface Palette {
  id: PaletteId;
  label: string;
  /** Translucent gel between the volume layers and the outline. */
  shell: string;
  /** Shell in shadow, toward the base. */
  shellDeep: string;
  /** The dense inner mass. */
  core: string;
  /** Deepest gel, where the body is thickest. */
  coreDeep: string;
  /** Illumination suspended inside the body. */
  glow: string;
  /** Inner edge of the rim light. */
  rimInner: string;
  /** Hot outer thread of the rim light. */
  rimOuter: string;
  /** Suspended sparks and bubble walls. */
  spark: string;
}

/**
 * The master reference supplied for this experiment is the amber body, so it
 * is the default. The violet palette is the production Blob's own colour,
 * sampled from public/blob/rig/body.png.
 */
export const PALETTES: Record<PaletteId, Palette> = {
  amber: {
    id: "amber",
    label: "Amber (master)",
    shell: "#ffbe05",
    shellDeep: "#c58001",
    core: "#7a5001",
    coreDeep: "#231400",
    glow: "#ffa500",
    rimInner: "#ffd21a",
    rimOuter: "#fff6c0",
    spark: "#fff2b0",
  },
  violet: {
    id: "violet",
    label: "Violet (production)",
    shell: "#4a0dc4",
    shellDeep: "#230157",
    core: "#170140",
    coreDeep: "#03000a",
    glow: "#6a1fe8",
    rimInner: "#6f0af0",
    rimOuter: "#d9c2ff",
    spark: "#e6d4ff",
  },
};

/**
 * Measured off the master: [depth, deep-tone alpha] from the centroid out to
 * the surface. Not a simple falloff — the master is dark in the core, darkest
 * around 45% of the way out where a viewing ray passes through the most gel,
 * then climbs steeply into the shell and rim.
 */
const DEPTH_PROFILE: readonly [number, number][] = [
  [1, 0],
  [0.93, 0.04],
  [0.82, 0.1],
  [0.65, 0.46],
  [0.45, 0.76],
];

/** How many nested shells approximate that curve. */
const DEPTH_STEPS = 22;

/** Linear read of DEPTH_PROFILE, held flat inside its peak. */
function depthAlpha(d: number): number {
  const p = DEPTH_PROFILE;
  if (d >= p[0][0]) return p[0][1];
  for (let i = 1; i < p.length; i++) {
    if (d >= p[i][0]) {
      const t = (d - p[i][0]) / (p[i - 1][0] - p[i][0]);
      return p[i][1] + (p[i - 1][1] - p[i][1]) * t;
    }
  }
  return p[p.length - 1][1];
}

/**
 * One internal mass, expressed as a sub-blob of the silhouette.
 *
 * Offsets are fractions of the half-width. Each layer is filled with a
 * radial gradient that reaches zero alpha before the layer's own contour, so
 * it reads as a body of gel rather than a drawn shape. `lip` adds a faint
 * catch of light along the contour — enough to suggest a fold edge, far short
 * of an outline.
 */
interface VolumeLayer {
  id: string;
  scale: number;
  dx: number;
  dy: number;
  /** Degrees, to break the nesting so it does not read as concentric rings. */
  rot: number;
  /** Where the gradient is brightest, in (angle, depth) of the layer itself. */
  focusAngle: number;
  focusDepth: number;
  /**
   * Direction of the contour arc that actually shows, in degrees from up.
   *
   * A layer offset upward has its readable edge along its underside, not its
   * top — the top is off the body and gets clipped away. Reusing the focus
   * angle here puts the fold's brightest point outside the silhouette and
   * only its faint tail survives, which is why the folds have to name their
   * visible edge separately.
   */
  lipAngle: number;
  /** Tone: 'dark' deepens, 'light' lifts. */
  dark?: boolean;
  alpha: number;
  lip: number;
}

/**
 * The seven masses read off the master, roughly back to front.
 *
 * The master is not one gradient: it is a stack of overlapping translucent
 * bodies, and the places where two of them overlap are what give it weight.
 */
const VOLUMES: readonly VolumeLayer[] = [
  // A broad dark mass filling the middle, sitting slightly high.
  { id: "core", scale: 0.76, dx: 0.0, dy: -0.06, rot: 0, focusAngle: 190, focusDepth: 0.35, dark: true, alpha: 0.24, lipAngle: 0, lip: 0 },
  // The large translucent front shell, lit from its upper left.
  { id: "frontShell", scale: 0.88, dx: 0.03, dy: 0.09, rot: -5, focusAngle: 320, focusDepth: 0.28, alpha: 0.42, lipAngle: 168, lip: 0.24 },
  // The cap over the crown, and three folds across the heavy lower third.
  //
  // Each of these is offset far enough that only a shallow cap of it crosses
  // the body. That is what puts its visible edge out in the outer third,
  // running roughly parallel to the outline, which is where the master's
  // folds sit — a mass centred on the body instead draws its edge straight
  // through the middle, and the core should stay clean.
  { id: "upperCap", scale: 0.92, dx: 0.12, dy: -1.4, rot: -6, focusAngle: 0, focusDepth: 0.5, alpha: 0.22, lipAngle: 178, lip: 0.34 },
  { id: "lowerLeftFold", scale: 0.8, dx: -0.5, dy: 1.18, rot: -12, focusAngle: 250, focusDepth: 0.5, alpha: 0.2, lipAngle: 30, lip: 0.34 },
  { id: "lowerCentreFold", scale: 0.96, dx: 0.02, dy: 1.46, rot: 4, focusAngle: 190, focusDepth: 0.5, alpha: 0.19, lipAngle: 4, lip: 0.32 },
  { id: "lowerRightFold", scale: 0.8, dx: 0.58, dy: 1.12, rot: 10, focusAngle: 130, focusDepth: 0.5, alpha: 0.2, lipAngle: 332, lip: 0.34 },
  // A subtle inner reflection down the right flank.
  { id: "rightReflection", scale: 0.8, dx: 1.05, dy: -0.06, rot: 6, focusAngle: 90, focusDepth: 0.5, alpha: 0.17, lipAngle: 264, lip: 0.3 },
] as const;

/**
 * Rim intensity by angle, read off the master: hot along the whole lower
 * perimeter and on the side lobes, quiet across the upper right and the
 * crown. A rim of even brightness is what makes a coded blob look like a
 * vector shape with a stroke on it.
 */
const RIM_PROFILE: readonly [number, number][] = [
  [0, 0.3],
  [30, 0.22],
  [50, 0.2],
  [75, 0.5],
  [100, 0.9],
  [122, 0.95],
  [145, 1],
  [183, 1],
  [208, 0.96],
  [242, 1],
  [266, 0.72],
  [288, 0.72],
  [318, 0.46],
  [345, 0.36],
];

/** Cyclic linear read of RIM_PROFILE. */
function rimAt(angle: number): number {
  const a = ((angle % 360) + 360) % 360;
  const p = RIM_PROFILE;
  for (let i = 0; i < p.length; i++) {
    const cur = p[i];
    const next = p[(i + 1) % p.length];
    const end = i === p.length - 1 ? next[0] + 360 : next[0];
    if (a >= cur[0] && a < end) {
      return cur[1] + (next[1] - cur[1]) * ((a - cur[0]) / (end - cur[0]));
    }
  }
  return p[0][1];
}

/** Positions authored against the master's bounding box, in 0..1 uv. */
interface Uv {
  u: number;
  v: number;
}

interface FeatureSpec {
  /** Degrees from up, clockwise, around the body centroid. */
  angle: number;
  /** 0 at the centroid, 1 at the surface. */
  depth: number;
}

/**
 * Measured off the master. Three readable speculars plus two faint catches —
 * the master has no single dominant hotspot, it has a family of them at
 * different strengths.
 */
const HIGHLIGHTS: {
  at: Uv;
  rx: number;
  ry: number;
  tilt: number;
  alpha: number;
}[] = [
  // The large soft specular on the upper-left shoulder.
  { at: { u: 0.278, v: 0.305 }, rx: 0.115, ry: 0.235, tilt: -0.6, alpha: 0.88 },
  // The smaller crown highlight, right of centre on the top edge.
  { at: { u: 0.5, v: 0.085 }, rx: 0.07, ry: 0.165, tilt: 1.15, alpha: 0.82 },
  // Subtle reflection down the right flank.
  { at: { u: 0.79, v: 0.3 }, rx: 0.04, ry: 0.1, tilt: -0.25, alpha: 0.46 },
  // Small catch on the lower-left lobe.
  { at: { u: 0.09, v: 0.76 }, rx: 0.04, ry: 0.055, tilt: -0.9, alpha: 0.5 },
  // Faint catch trailing under the main specular.
  { at: { u: 0.19, v: 0.45 }, rx: 0.03, ry: 0.05, tilt: -0.5, alpha: 0.26 },
];

/** Bright four-point flares in the core, as in the master. */
const FLARES: { at: Uv; size: number; alpha: number }[] = [
  { at: { u: 0.41, v: 0.5 }, size: 0.11, alpha: 0.8 },
  { at: { u: 0.6, v: 0.55 }, size: 0.13, alpha: 0.9 },
  { at: { u: 0.25, v: 0.6 }, size: 0.07, alpha: 0.45 },
];

interface Particle {
  spec: FeatureSpec;
  /** Radius as a fraction of the body half-width. */
  size: number;
  alpha: number;
  bubble: boolean;
}

/** Small deterministic PRNG. Particles are generated once and cached. */
function mulberry(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface MaterialFeatures {
  highlights: (FeatureSpec & { rx: number; ry: number; tilt: number; alpha: number })[];
  flares: (FeatureSpec & { size: number; alpha: number })[];
  particles: Particle[];
}

let cachedFeatures: MaterialFeatures | null = null;

/**
 * Converts every authored uv into (angle, depth) once, against the neutral
 * shape. Done a single time for the lifetime of the module; per frame we only
 * resolve them through the current ring, which is how they stay attached to
 * the body when it deforms.
 */
function features(): MaterialFeatures {
  if (cachedFeatures) return cachedFeatures;

  const shape = buildBlobShape(NEUTRAL_SHAPE, 100);
  const ring = new SurfaceRing(shape);
  const { minX, minY, maxX, maxY } = shape.bounds;
  const w = maxX - minX;
  const h = maxY - minY;

  const toSpec = (uv: Uv): FeatureSpec => {
    const x = minX + uv.u * w - ring.center.x;
    const y = minY + uv.v * h - ring.center.y;
    let angle = (Math.atan2(x, -y) * 180) / Math.PI;
    if (angle < 0) angle += 360;
    const s = ring.surfaceAt(angle);
    const reach = Math.hypot(s.x - ring.center.x, s.y - ring.center.y) || 1;
    return { angle, depth: Math.min(Math.hypot(x, y) / reach, 1.05) };
  };

  const rand = mulberry(0x5f0b);
  const particles: Particle[] = [];
  for (let i = 0; i < 52; i++) {
    particles.push({
      spec: { angle: rand() * 360, depth: 0.05 + rand() * rand() * 0.72 },
      size: 0.0035 + rand() * 0.009,
      alpha: 0.35 + rand() * 0.55,
      bubble: false,
    });
  }
  for (let i = 0; i < 6; i++) {
    particles.push({
      spec: { angle: 110 + rand() * 180, depth: 0.45 + rand() * 0.4 },
      size: 0.016 + rand() * 0.022,
      alpha: 0.3 + rand() * 0.25,
      bubble: true,
    });
  }

  cachedFeatures = {
    highlights: HIGHLIGHTS.map((hl) => ({
      ...toSpec(hl.at),
      rx: hl.rx,
      ry: hl.ry,
      tilt: hl.tilt,
      alpha: hl.alpha,
    })),
    flares: FLARES.map((f) => ({ ...toSpec(f.at), size: f.size, alpha: f.alpha })),
    particles,
  };
  return cachedFeatures;
}

function withAlpha(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

/** Maps a silhouette point into a sub-blob's space. */
function lobeMapper(shape: BlobShape, scale: number, dx: number, dy: number, rot: number) {
  const c = shape.center;
  const hw = shape.halfWidth;
  const r = (rot * Math.PI) / 180;
  const cos = Math.cos(r);
  const sin = Math.sin(r);
  return (p: Point): Point => {
    const x = (p.x - c.x) * scale;
    const y = (p.y - c.y) * scale;
    return {
      x: c.x + x * cos - y * sin + dx * hw,
      y: c.y + x * sin + y * cos + dy * hw,
    };
  };
}

/** Traces the silhouette scaled, rotated and offset about its own centroid. */
function traceLobe(
  ctx: CanvasRenderingContext2D,
  shape: BlobShape,
  scale: number,
  dx: number,
  dy: number,
  rot = 0
) {
  const map = lobeMapper(shape, scale, dx, dy, rot);
  const s = shape.segments;
  ctx.beginPath();
  const start = map(s[0].p0);
  ctx.moveTo(start.x, start.y);
  for (const seg of s) {
    const c0 = map(seg.c0);
    const c1 = map(seg.c1);
    const p1 = map(seg.p1);
    ctx.bezierCurveTo(c0.x, c0.y, c1.x, c1.y, p1.x, p1.y);
  }
  ctx.closePath();
}

export interface MaterialOptions {
  palette: Palette;
  /** Slides the specular set, for a future light-direction control. */
  highlightShift: number;
  /** Rim strength, 0..1. */
  rimStrength: number;
}

/**
 * Paints the whole body. The caller has already placed the origin at the
 * body's centre and scaled to the render buffer.
 */
export function paintBlobBody(
  ctx: CanvasRenderingContext2D,
  shape: BlobShape,
  opts: MaterialOptions
) {
  const { palette, highlightShift } = opts;
  const f = features();
  const ring = new SurfaceRing(shape);
  const hw = shape.halfWidth;
  const b = shape.bounds;

  // Every full-body wash is bounded to the silhouette's own box plus a small
  // margin. Filling a generous square instead costs about four times the
  // pixels for nothing, and these washes are the bulk of the frame.
  const pad = hw * 0.12;
  const fillAll = () =>
    ctx.fillRect(b.minX - pad, b.minY - pad, b.maxX - b.minX + pad * 2, b.maxY - b.minY + pad * 2);

  ctx.save();
  tracePath(ctx, shape);
  ctx.clip();

  // 1. SHELL — the translucent gel, densest and darkest at the base.
  const shell = ctx.createLinearGradient(0, b.minY, 0, b.maxY);
  shell.addColorStop(0, palette.shell);
  shell.addColorStop(0.5, palette.shell);
  shell.addColorStop(0.86, palette.shellDeep);
  shell.addColorStop(1, palette.shellDeep);
  ctx.fillStyle = shell;
  fillAll();

  // 2. DEPTH SHADING — the measured luminance curve, laid down as nested
  // copies of the silhouette. A radial gradient gets the curve right but the
  // wrong shape: it leaves the lobes pale and the flats dark. Nested
  // silhouettes keep the bright shell band a constant distance inside the
  // outline the whole way round, and deform with the body. Each shell carries
  // only the alpha needed to reach the measured cumulative value.
  let reached = 0;
  for (let i = 1; i <= DEPTH_STEPS; i++) {
    const d = 1 - (i / DEPTH_STEPS) * (1 - 0.42);
    const want = depthAlpha(d);
    const step = 1 - (1 - want) / (1 - reached);
    reached = want;
    if (step <= 0.002) continue;
    traceLobe(ctx, shape, d, 0, 0);
    ctx.fillStyle = withAlpha(palette.coreDeep, step);
    ctx.fill();
  }

  const reach = ring.meanReach;
  const c = ring.center;

  // The gel is thickest at the base, so the lower body sits deeper still.
  const deep = ctx.createLinearGradient(0, c.y, 0, b.maxY);
  deep.addColorStop(0, withAlpha(palette.coreDeep, 0));
  deep.addColorStop(1, withAlpha(palette.coreDeep, 0.4));
  ctx.fillStyle = deep;
  fillAll();

  // 3. INTERNAL ILLUMINATION — light suspended in the body, high and left,
  // which is what stops the middle reading as a hole. It goes down before the
  // volume layers, not after: the masses float in front of the light, and a
  // wash laid over them would flatten every fold edge back out again.
  const litAt = ring.at(345 + highlightShift * 40, 0.28);
  const lit = ctx.createRadialGradient(litAt.x, litAt.y, 0, litAt.x, litAt.y, reach * 0.7);
  lit.addColorStop(0, withAlpha(palette.glow, 0.74));
  lit.addColorStop(0.5, withAlpha(palette.glow, 0.36));
  lit.addColorStop(1, withAlpha(palette.glow, 0));
  ctx.fillStyle = lit;
  fillAll();

  // 4. VOLUME LAYERS — the seven internal masses. Each is clipped to its own
  // sub-blob and filled with a gradient that fades to nothing before that
  // contour, so what shows is a body of gel, not a drawn shape.
  for (const v of VOLUMES) {
    ctx.save();
    traceLobe(ctx, shape, v.scale, v.dx, v.dy, v.rot);
    ctx.clip();

    const map = lobeMapper(shape, v.scale, v.dx, v.dy, v.rot);
    const focus = map(ring.at(v.focusAngle, v.focusDepth));
    const radius = reach * v.scale * 0.95;
    const tone = v.dark ? palette.coreDeep : palette.shell;
    const g = ctx.createRadialGradient(focus.x, focus.y, 0, focus.x, focus.y, radius);
    g.addColorStop(0, withAlpha(tone, v.alpha));
    g.addColorStop(0.5, withAlpha(tone, v.alpha * 0.62));
    g.addColorStop(1, withAlpha(tone, 0));
    ctx.fillStyle = g;
    fillAll();
    ctx.restore();

    // A faint catch of light along the mass's own contour. Enough to suggest
    // a fold edge; well short of an outline.
    if (v.lip > 0) {
      traceLobe(ctx, shape, v.scale, v.dx, v.dy, v.rot);
      const lipAt = map(ring.at(v.lipAngle, 1));
      const lip = ctx.createRadialGradient(lipAt.x, lipAt.y, 0, lipAt.x, lipAt.y, radius * 0.95);
      // Warm, not white: a near-white fold edge reads as a pencil line over
      // the gel rather than light caught in it.
      lip.addColorStop(0, withAlpha(palette.rimInner, v.lip));
      lip.addColorStop(0.4, withAlpha(palette.shell, v.lip * 0.6));
      lip.addColorStop(1, withAlpha(palette.shell, 0));
      ctx.strokeStyle = lip;
      ctx.lineWidth = hw * 0.03;
      ctx.stroke();
    }
  }

  // 5. PARTICLES — deterministic, generated once, never regenerated per frame.
  for (const p of f.particles) {
    const at = ring.at(p.spec.angle, p.spec.depth);
    const r = p.size * hw;
    if (p.bubble) {
      ctx.beginPath();
      ctx.arc(at.x, at.y, r, 0, Math.PI * 2);
      ctx.strokeStyle = withAlpha(palette.spark, p.alpha);
      ctx.lineWidth = Math.max(hw * 0.005, r * 0.18);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(at.x - r * 0.3, at.y - r * 0.34, r * 0.26, 0, Math.PI * 2);
      ctx.fillStyle = withAlpha(palette.spark, Math.min(1, p.alpha * 1.8));
      ctx.fill();
    } else {
      const g = ctx.createRadialGradient(at.x, at.y, 0, at.x, at.y, r * 3);
      g.addColorStop(0, withAlpha(palette.spark, p.alpha));
      g.addColorStop(0.3, withAlpha(palette.spark, p.alpha * 0.3));
      g.addColorStop(1, withAlpha(palette.spark, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(at.x, at.y, r * 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // 6. STAR FLARES — a few four-point flares suspended in the core.
  for (const fl of f.flares) {
    const at = ring.at(fl.angle, fl.depth);
    const r = fl.size * hw;
    const g = ctx.createRadialGradient(at.x, at.y, 0, at.x, at.y, r);
    g.addColorStop(0, withAlpha(palette.spark, fl.alpha));
    g.addColorStop(0.18, withAlpha(palette.spark, fl.alpha * 0.35));
    g.addColorStop(1, withAlpha(palette.spark, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(at.x, at.y, r, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = withAlpha(palette.spark, fl.alpha * 0.5);
    ctx.lineWidth = Math.max(hw * 0.004, r * 0.045);
    ctx.beginPath();
    ctx.moveTo(at.x - r, at.y);
    ctx.lineTo(at.x + r, at.y);
    ctx.moveTo(at.x, at.y - r * 0.8);
    ctx.lineTo(at.x, at.y + r * 0.8);
    ctx.stroke();
  }

  // 7. SPECULAR — soft elliptical gradients, no blur filter.
  for (const hl of f.highlights) {
    const at = ring.at(hl.angle + highlightShift * 26, hl.depth);
    ctx.save();
    ctx.translate(at.x, at.y);
    ctx.rotate(hl.tilt);
    ctx.scale(hl.rx, hl.ry);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, hw);
    g.addColorStop(0, `rgba(255, 255, 255, ${hl.alpha})`);
    g.addColorStop(0.45, `rgba(255, 255, 255, ${hl.alpha * 0.7})`);
    g.addColorStop(0.78, withAlpha(palette.rimOuter, hl.alpha * 0.25));
    g.addColorStop(1, withAlpha(palette.rimOuter, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, hw, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // 8. RIM — thin, crisp, and uneven.
  //
  // Canvas cannot vary a stroke's alpha along a path, and a single even
  // stroke is exactly what makes a coded blob read as a vector shape. So the
  // rim is walked as short arcs of the surface ring, each carrying its own
  // intensity from RIM_PROFILE, with a one-step overlap so there are no
  // seams. All of it is inside the clip, so only the inner half of each line
  // survives and the edge stays hard rather than blooming into a halo.
  paintRim(ctx, ring, hw, palette, opts.rimStrength);

  ctx.restore();
}

const RIM_ARCS = 32;
const RIM_SAMPLES = 96;

function paintRim(
  ctx: CanvasRenderingContext2D,
  ring: SurfaceRing,
  hw: number,
  palette: Palette,
  strength: number
) {
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const per = RIM_SAMPLES / RIM_ARCS;

  for (let pass = 0; pass < 2; pass++) {
    // Pass 0 is the soft inner bloom, pass 1 the hot thread on top of it.
    const width = pass === 0 ? hw * 0.3 : hw * 0.062;
    const colour = pass === 0 ? palette.rimInner : palette.rimOuter;
    const base = pass === 0 ? 1 : 1;

    for (let arcIndex = 0; arcIndex < RIM_ARCS; arcIndex++) {
      const from = arcIndex * per;
      const mid = ((from + per / 2) / RIM_SAMPLES) * 360;
      const intensity = rimAt(mid);
      const alpha = base * intensity * strength;
      if (alpha < 0.01) continue;
      // Intensity thins the line as well as dimming it. A rim that only
      // fades keeps its full width all the way round and still reads as a
      // stroke on a vector shape; the master's edge is a hot band low down
      // and barely a thread across the crown.
      const arcWidth = width * (0.34 + 0.66 * intensity);

      ctx.beginPath();
      for (let s = 0; s <= per + 1; s++) {
        const angle = ((from + s) / RIM_SAMPLES) * 360;
        const p = ring.surfaceAt(angle);
        if (s === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      }
      ctx.strokeStyle = withAlpha(colour, alpha);
      ctx.lineWidth = arcWidth;
      ctx.stroke();
    }
  }
}

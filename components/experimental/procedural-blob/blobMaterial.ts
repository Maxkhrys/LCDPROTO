/**
 * Layered jelly material for the experimental procedural body.
 *
 * R&D ONLY. Everything is Canvas 2D gradients, clipped fills and short
 * strokes — no filters, no wide shadow blurs, no per-layer offscreen
 * compositing. The palettes were sampled out of the master artwork rather
 * than invented.
 *
 * The structure follows what the master actually is, which is not a flat
 * gradient with stripes on it:
 *
 *   - a bright translucent SHELL filling the whole silhouette,
 *   - several nested SHELL LOBES inset from the outline at different offsets,
 *     whose overlapping edges are what read as internal folds,
 *   - a DEPTH SHADING curve measured off the master, which darkens the
 *     mid-depths where a viewing ray passes through the most gel,
 *   - internal illumination suspended in the core,
 *   - sparks, star flares and bubbles suspended in the core,
 *   - specular highlights on the shell,
 *   - a thin hot rim thread on the outline.
 *
 * The lobes and the core are traced from the live silhouette, so every fold
 * deforms with the body for free — squash the blob and its folds squash too.
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
  /** Bright translucent gel between the core and the outline. */
  shell: string;
  /** Shell in shadow, toward the base. */
  shellDeep: string;
  /** The denser inner mass. */
  core: string;
  /** Bottom of the core, where the gel is thickest. */
  coreDeep: string;
  /** Illumination suspended inside the core. */
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
 * sampled from public/blob/rig/body.png, so the same material can be checked
 * against the shipping look.
 */
export const PALETTES: Record<PaletteId, Palette> = {
  amber: {
    id: "amber",
    label: "Amber (master)",
    shell: "#ffc50a",
    shellDeep: "#d18f01",
    core: "#a86e01",
    coreDeep: "#2c1a00",
    glow: "#ffb400",
    rimInner: "#ffd21a",
    rimOuter: "#fff6c0",
    spark: "#fff2b0",
  },
  violet: {
    id: "violet",
    label: "Violet (production)",
    shell: "#4a0dc4",
    shellDeep: "#26025f",
    core: "#1c0148",
    coreDeep: "#04000c",
    glow: "#7b3df5",
    rimInner: "#6f0af0",
    rimOuter: "#d9c2ff",
    spark: "#e6d4ff",
  },
};

/**
 * A nested copy of the silhouette.
 *
 * Offsets are fractions of the half-width. Each lobe is a translucent sheet
 * of gel; where two of them overlap the master shows a brighter crease, and
 * so does this.
 */
interface Lobe {
  scale: number;
  dx: number;
  dy: number;
  /** Degrees, to break the nesting so it does not read as concentric rings. */
  rot: number;
  fill: number;
  edge: number;
}

/** Read off the master: the folds run low and to the right, plus a crown lobe. */
const LOBES: readonly Lobe[] = [
  { scale: 0.95, dx: 0.03, dy: -0.05, rot: -4, fill: 0.07, edge: 0.32 },
  { scale: 0.88, dx: 0.11, dy: 0.06, rot: 7, fill: 0.06, edge: 0.3 },
  { scale: 0.86, dx: -0.09, dy: 0.14, rot: -9, fill: 0.06, edge: 0.28 },
  { scale: 0.74, dx: 0.05, dy: 0.24, rot: 5, fill: 0.05, edge: 0.25 },
  { scale: 0.66, dx: -0.16, dy: -0.02, rot: 12, fill: 0.045, edge: 0.2 },
] as const;

/** The dense inner mass, as a fraction of the silhouette. */
/**
 * Measured off the master: [depth, deep-tone alpha]. See the comment at the
 * depth-shading layer for how this curve was read.
 */
const DEPTH_PROFILE: readonly [number, number][] = [
  [1, 0],
  [0.93, 0.02],
  [0.82, 0.2],
  [0.65, 0.7],
  [0.45, 0.87],
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

/** Measured off the master: the bright regions that survive at 240px. */
const HIGHLIGHTS: {
  at: Uv;
  rx: number;
  ry: number;
  tilt: number;
  alpha: number;
}[] = [
  // The signature elongated specular on the upper-left shoulder.
  { at: { u: 0.275, v: 0.3 }, rx: 0.12, ry: 0.245, tilt: -0.62, alpha: 1 },
  // The crown streak, running along the top edge to the right of centre.
  { at: { u: 0.5, v: 0.085 }, rx: 0.072, ry: 0.175, tilt: 1.15, alpha: 0.95 },
  // Subtle reflection down the right flank.
  { at: { u: 0.79, v: 0.31 }, rx: 0.035, ry: 0.085, tilt: -0.25, alpha: 0.5 },
  // Small catch on the lower-left lobe.
  { at: { u: 0.09, v: 0.76 }, rx: 0.04, ry: 0.055, tilt: -0.9, alpha: 0.55 },
  // Faint catch under the main specular.
  { at: { u: 0.19, v: 0.45 }, rx: 0.03, ry: 0.05, tilt: -0.5, alpha: 0.3 },
];

/** Bright four-point flares in the core, as in the master. */
const FLARES: { at: Uv; size: number; alpha: number }[] = [
  { at: { u: 0.41, v: 0.5 }, size: 0.11, alpha: 0.85 },
  { at: { u: 0.6, v: 0.55 }, size: 0.13, alpha: 0.95 },
  { at: { u: 0.25, v: 0.6 }, size: 0.07, alpha: 0.5 },
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
  // Sparse star-like specks, concentrated in the core the way the master's
  // are, and kept off the rim so the outline stays clean.
  for (let i = 0; i < 52; i++) {
    particles.push({
      spec: { angle: rand() * 360, depth: 0.05 + rand() * rand() * 0.72 },
      size: 0.0035 + rand() * 0.009,
      alpha: 0.35 + rand() * 0.55,
      bubble: false,
    });
  }
  // A handful of bubbles, biased low where the master has them.
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

/** Traces the silhouette scaled and offset about its own centroid. */
function traceLobe(
  ctx: CanvasRenderingContext2D,
  shape: BlobShape,
  scale: number,
  dx: number,
  dy: number,
  rot = 0
) {
  const c = shape.center;
  const hw = shape.halfWidth;
  const r = (rot * Math.PI) / 180;
  const cos = Math.cos(r);
  const sin = Math.sin(r);
  const map = (p: Point): Point => {
    const x = (p.x - c.x) * scale;
    const y = (p.y - c.y) * scale;
    return {
      x: c.x + x * cos - y * sin + dx * hw,
      y: c.y + x * sin + y * cos + dy * hw,
    };
  };
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
    ctx.fillRect(
      b.minX - pad,
      b.minY - pad,
      b.maxX - b.minX + pad * 2,
      b.maxY - b.minY + pad * 2
    );

  ctx.save();
  tracePath(ctx, shape);
  ctx.clip();

  // 1. SHELL — the bright translucent gel, densest and darkest at the base.
  const shell = ctx.createLinearGradient(0, b.minY, 0, b.maxY);
  shell.addColorStop(0, palette.shell);
  shell.addColorStop(0.5, palette.shell);
  shell.addColorStop(0.88, palette.shellDeep);
  shell.addColorStop(1, palette.shellDeep);
  ctx.fillStyle = shell;
  fillAll();

  // 2. DEPTH SHADING — the single most important layer for making this read
  // as a volume rather than a vector fill.
  //
  // The master's luminance profile, measured from its centroid out to the
  // surface, is not a simple falloff: it is moderately dark in the core,
  // darkest around 45% of the way out (where a viewing ray passes through the
  // most gel) and then climbs steeply into the hot shell and rim.
  //
  // A radial gradient gets the curve right but the wrong shape — it leaves
  // the lobes pale and the flats dark. So the curve is laid down as nested
  // copies of the silhouette instead, which puts the bright shell band at a
  // constant distance inside the outline the whole way round, and deforms
  // with the body. Each shell carries only the alpha needed to reach the
  // measured cumulative value, so the stack composites to the profile.
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
  deep.addColorStop(1, withAlpha(palette.coreDeep, 0.34));
  ctx.fillStyle = deep;
  fillAll();

  // 3. SHELL LOBES — nested sheets of gel. Their overlapping edges are the
  // internal folds; because they are traced from the live silhouette they
  // deform with the body rather than sliding across it.
  ctx.lineJoin = "round";
  for (const lobe of LOBES) {
    traceLobe(ctx, shape, lobe.scale, lobe.dx, lobe.dy, lobe.rot);
    ctx.fillStyle = withAlpha(palette.shell, lobe.fill);
    ctx.fill();
    ctx.strokeStyle = withAlpha(palette.rimInner, lobe.edge);
    ctx.lineWidth = hw * 0.014;
    ctx.stroke();
  }

  // 4. INTERNAL ILLUMINATION — light suspended inside the core, slightly high
  // and left, which is what stops the middle reading as a hole.
  const litAt = ring.at(345 + highlightShift * 40, 0.28);
  const lit = ctx.createRadialGradient(litAt.x, litAt.y, 0, litAt.x, litAt.y, reach * 0.95);
  lit.addColorStop(0, withAlpha(palette.glow, 0.62));
  lit.addColorStop(0.5, withAlpha(palette.glow, 0.3));
  lit.addColorStop(1, withAlpha(palette.glow, 0));
  ctx.fillStyle = lit;
  fillAll();

  // 5. PARTICLES — deterministic, generated once, never regenerated per frame.
  for (const p of f.particles) {
    const at = ring.at(p.spec.angle, p.spec.depth);
    const r = p.size * hw;
    if (p.bubble) {
      // A bubble is a wall plus a tiny catchlight, not a filled dot.
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

  // 7. SPECULAR — soft elliptical gradients on the shell, no blur filter.
  for (const hl of f.highlights) {
    const at = ring.at(hl.angle + highlightShift * 26, hl.depth);
    ctx.save();
    ctx.translate(at.x, at.y);
    ctx.rotate(hl.tilt);
    ctx.scale(hl.rx, hl.ry);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, hw);
    g.addColorStop(0, `rgba(255, 255, 255, ${hl.alpha})`);
    g.addColorStop(0.45, `rgba(255, 255, 255, ${hl.alpha * 0.72})`);
    g.addColorStop(0.78, withAlpha(palette.rimOuter, hl.alpha * 0.25));
    g.addColorStop(1, withAlpha(palette.rimOuter, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, hw, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // 8. RIM — stroked inside the clip so only the inner half of the line
  // survives. That keeps the light thread hard against the silhouette
  // instead of blooming outward into a halo.
  const s = opts.rimStrength;
  const wide = ctx.createLinearGradient(0, b.minY, 0, b.maxY);
  wide.addColorStop(0, withAlpha(palette.rimInner, 0.8 * s));
  wide.addColorStop(0.3, withAlpha(palette.rimInner, 0.95 * s));
  wide.addColorStop(0.72, withAlpha(palette.rimInner, 1 * s));
  wide.addColorStop(1, withAlpha(palette.rimInner, 0.95 * s));
  tracePath(ctx, shape);
  ctx.strokeStyle = wide;
  ctx.lineWidth = hw * 0.2;
  ctx.stroke();

  tracePath(ctx, shape);
  ctx.strokeStyle = withAlpha(palette.rimOuter, 0.5 * s);
  ctx.lineWidth = hw * 0.07;
  ctx.stroke();

  // The hot thread itself: thin, and clipped to half its width.
  tracePath(ctx, shape);
  ctx.strokeStyle = withAlpha(palette.rimOuter, 0.95 * s);
  ctx.lineWidth = hw * 0.018;
  ctx.stroke();

  ctx.restore();
}

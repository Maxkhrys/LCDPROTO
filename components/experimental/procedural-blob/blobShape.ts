/**
 * Procedural silhouette for the experimental Blob body.
 *
 * R&D ONLY — this file is not wired into the production rig.
 *
 * The neutral anchor table is fitted, not hand-guessed. The master's alpha
 * edge (public/blob/rig/yellow/body.png) was traced radially from its
 * bounding-box centre; anchors were placed on the extrema of that trace and
 * on its highest-curvature points, with the widest remaining arcs split so no
 * stretch of the outline is left unsupported; then angle, radius and per-point
 * tension were optimised against the trace under an ordering constraint.
 *
 * Eighteen anchors reproduce the master outline to an RMS of 0.003 and a
 * worst case of 0.012 in half-width units — 0.2px and 0.8px at the authored
 * 240px size. The previous ten-anchor table peaked at 2.6px, all of it on the
 * right flank around 95-98 degrees, where a single Bezier span had to cover
 * both the mid-right lobe and the cleft below it and cut the corner off both.
 *
 * Radii are fractions of the body's half-width. Angles are degrees measured
 * from straight up, increasing clockwise on screen (90 = right, 180 = down).
 */

export type AnchorId =
  | "top"
  | "topRightDome"
  | "upperRightShoulder"
  | "upperRightLobe"
  | "midRightLobe"
  | "rightLobeCleft"
  | "lowerRightLobe"
  | "lowerRightFold"
  | "bottomRight"
  | "bottomCentre"
  | "bottomLeft"
  | "lowerLeftFold"
  | "lowerLeftLobe"
  | "leftLobeCleft"
  | "midLeftLobe"
  | "upperLeftLobe"
  | "upperLeftShoulder"
  | "topLeftDome";

export interface Anchor {
  id: AnchorId;
  /** Degrees from up, clockwise. */
  angle: number;
  /** Fraction of the body half-width. */
  radius: number;
  /** Catmull-Rom tension at this anchor; per-point, so folds stay sharp. */
  tension: number;
}

/**
 * Eighteen shape points, clockwise from the crown.
 *
 * The master Blob is deliberately asymmetrical and nothing here is mirrored:
 * the crown peaks right of centre and carries a dome on each side rather than
 * an apex, the right flank has a lobe, a cleft and a second larger lobe below
 * it, the left has a shallower pair, the upper-left shoulder is the tightest
 * point on the whole outline, and the bottom third is the widest and heaviest
 * part of the body.
 */
export const NEUTRAL_ANCHORS: readonly Anchor[] = [
  { id: "top", angle: 6.4, radius: 1.0266, tension: 0.31 },
  { id: "topRightDome", angle: 25.8, radius: 0.9193, tension: 0.03 },
  { id: "upperRightShoulder", angle: 43.6, radius: 0.7951, tension: 0.19 },
  { id: "upperRightLobe", angle: 73.2, radius: 0.9063, tension: 0.24 },
  { id: "midRightLobe", angle: 95.6, radius: 0.9231, tension: 0.07 },
  { id: "rightLobeCleft", angle: 106.6, radius: 1.0397, tension: 0.03 },
  { id: "lowerRightLobe", angle: 120.2, radius: 1.0962, tension: 0.2 },
  { id: "lowerRightFold", angle: 138.4, radius: 1.0137, tension: 0.16 },
  { id: "bottomRight", angle: 158.0, radius: 0.9734, tension: 0.11 },
  { id: "bottomCentre", angle: 182.6, radius: 1.0239, tension: 0.24 },
  { id: "bottomLeft", angle: 202.8, radius: 0.9335, tension: 0.05 },
  { id: "lowerLeftFold", angle: 221.8, radius: 0.9829, tension: 0.14 },
  { id: "lowerLeftLobe", angle: 242.0, radius: 1.087, tension: 0.32 },
  { id: "leftLobeCleft", angle: 261.4, radius: 0.9569, tension: 0.02 },
  { id: "midLeftLobe", angle: 283.2, radius: 0.8134, tension: 0.02 },
  { id: "upperLeftLobe", angle: 298.4, radius: 0.7804, tension: 0.31 },
  { id: "upperLeftShoulder", angle: 325.8, radius: 0.7536, tension: 0.18 },
  { id: "topLeftDome", angle: 345.8, radius: 0.9044, tension: 0.04 },
] as const;

/** Every value a caller can drive. All are neutral at the documented default. */
export interface ShapeParams {
  scale: number;
  scaleX: number;
  scaleY: number;
  /** Degrees, clockwise, about the body centre. */
  rotation: number;
  /** Arc bend of the upper mass over a planted base. */
  lean: number;
  topHeight: number;
  leftBulge: number;
  rightBulge: number;
  lowerLeftBulge: number;
  lowerRightBulge: number;
  bottomSag: number;
  squash: number;
  stretch: number;
  /** Mass displacement, not a translation: the trailing side compresses. */
  centerShiftX: number;
  centerShiftY: number;
  /** Amplitude of the travelling surface ripple, in half-width units. */
  wobbleAmount: number;
  /** Ripple phase in radians. Advanced by the caller, never randomised. */
  wobblePhase: number;
}

export const NEUTRAL_SHAPE: ShapeParams = {
  scale: 1,
  scaleX: 1,
  scaleY: 1,
  rotation: 0,
  lean: 0,
  topHeight: 0,
  leftBulge: 0,
  rightBulge: 0,
  lowerLeftBulge: 0,
  lowerRightBulge: 0,
  bottomSag: 0,
  squash: 0,
  stretch: 0,
  centerShiftX: 0,
  centerShiftY: 0,
  wobbleAmount: 0,
  wobblePhase: 0,
};

/**
 * Where each radial parameter acts, as a lobe on the outline.
 *
 * With eighteen anchors, naming the affected ones individually stops being
 * readable and starts being a table nobody can retune. A lobe centre and an
 * angular half-width is the same information in the terms an animator thinks
 * in, and it resolves to per-anchor weights below.
 */
interface Lobe {
  /** Degrees from up, clockwise. */
  center: number;
  /** Degrees to either side before the influence reaches zero. */
  width: number;
}

const PARAM_LOBES: Partial<Record<keyof ShapeParams, Lobe>> = {
  topHeight: { center: 4, width: 76 },
  rightBulge: { center: 88, width: 62 },
  leftBulge: { center: 276, width: 62 },
  lowerRightBulge: { center: 126, width: 52 },
  lowerLeftBulge: { center: 236, width: 52 },
  bottomSag: { center: 183, width: 58 },
};

const DEG = Math.PI / 180;

/** Angular distance in degrees, wrapped to 0..180. */
function arc(a: number, b: number): number {
  const g = Math.abs(a - b) % 360;
  return g > 180 ? 360 - g : g;
}

/** Raised cosine: 1 at the lobe centre, 0 at its edge, smooth in between. */
function lobeWeight(angle: number, lobe: Lobe): number {
  const d = arc(angle, lobe.center);
  if (d >= lobe.width) return 0;
  return 0.5 * (1 + Math.cos((d / lobe.width) * Math.PI));
}

/**
 * Per-anchor weights for each radial parameter, volume-corrected.
 *
 * A bare lobe pushes the outline out and nothing pulls it back, so the body
 * grows a wedge instead of deforming. Real jelly conserves its volume: press
 * one side in and the rest swells to take it.
 *
 * So each parameter gets a wide counter-lobe on the opposite side, and its
 * coefficient is solved numerically so the parameter's first-order area
 * change over the whole outline is zero. Area of a radial contour is
 * ½∫r²dθ, so dA = ∫ r·dr dθ; summing w_i·r_i·dθ_i over the ring and matching
 * the counter term against the lobe term is that integral discretised.
 */
const INFLUENCE: Partial<Record<keyof ShapeParams, number[]>> = (() => {
  const out: Partial<Record<keyof ShapeParams, number[]>> = {};
  const n = NEUTRAL_ANCHORS.length;

  // Angular span each anchor stands for, for the discrete area integral.
  const span = NEUTRAL_ANCHORS.map((a, i) => {
    const prev = NEUTRAL_ANCHORS[(i - 1 + n) % n].angle;
    const next = NEUTRAL_ANCHORS[(i + 1) % n].angle;
    return (arc(a.angle, prev) + arc(a.angle, next)) / 2;
  });

  for (const key in PARAM_LOBES) {
    const lobe = PARAM_LOBES[key as keyof ShapeParams] as Lobe;
    const counter: Lobe = { center: (lobe.center + 180) % 360, width: 118 };

    let lobeArea = 0;
    let counterArea = 0;
    const push: number[] = [];
    const pull: number[] = [];
    for (let i = 0; i < n; i++) {
      const a = NEUTRAL_ANCHORS[i];
      const p = lobeWeight(a.angle, lobe);
      const c = lobeWeight(a.angle, counter);
      push.push(p);
      pull.push(c);
      lobeArea += p * a.radius * span[i];
      counterArea += c * a.radius * span[i];
    }
    const k = counterArea > 1e-6 ? lobeArea / counterArea : 0;
    out[key as keyof ShapeParams] = push.map((p, i) => p - k * pull[i]);
  }
  return out;
})();

/** Fixed per-anchor ripple phases. Deterministic, so wobble never flickers. */
const WOBBLE_PHASE: number[] = NEUTRAL_ANCHORS.map(
  (_, i) => (i * 2.399963) % (Math.PI * 2)
);

export interface Point {
  x: number;
  y: number;
}

export interface BezierSegment {
  p0: Point;
  c0: Point;
  c1: Point;
  p1: Point;
}

export interface BlobShape {
  /** Deformed anchor positions, in body-space pixels around the origin. */
  points: Point[];
  segments: BezierSegment[];
  /** Deformed centroid, in body-space pixels. */
  center: Point;
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
  /** Half-width the radii were scaled by. */
  halfWidth: number;
}

const rotate = (p: Point, rad: number): Point => {
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  return { x: p.x * c - p.y * s, y: p.x * s + p.y * c };
};

/**
 * Builds the deformed silhouette.
 *
 * `halfWidth` is half the neutral body width in whatever pixel space the
 * caller draws in, so the same shape code serves the 240px authored size and
 * a supersampled render buffer without change.
 */
export function buildBlobShape(params: ShapeParams, halfWidth: number): BlobShape {
  const p = params;
  // stretch is just negative squash; keeping both makes the control panel and
  // any future behaviour clips read the way an animator thinks.
  const squash = p.squash - p.stretch;

  const raw: Point[] = NEUTRAL_ANCHORS.map((anchor, i) => {
    let radius = anchor.radius;

    for (const key in INFLUENCE) {
      const w = (INFLUENCE[key as keyof ShapeParams] as number[])[i];
      if (w === 0) continue;
      radius += (p[key as keyof ShapeParams] as number) * w;
    }

    if (p.wobbleAmount !== 0) {
      radius += p.wobbleAmount * Math.sin(p.wobblePhase + WOBBLE_PHASE[i]);
    }

    const a = anchor.angle * DEG;
    let x = Math.sin(a) * radius * halfWidth;
    let y = -Math.cos(a) * radius * halfWidth;

    // Squash pivots on the base, not the centre — a jelly flattens against
    // what it is resting on, it does not shrink symmetrically. Volume is
    // roughly preserved so the silhouette keeps its mass.
    if (squash !== 0) {
      const base = halfWidth * 1.02;
      const sy = 1 - squash * 0.55;
      const sx = 1 + squash * 0.42;
      x *= sx;
      y = base - (base - y) * sy;
      // The mid lobes take the displaced volume, so the sides bow outward
      // instead of the whole outline scaling.
      const side = Math.abs(Math.sin(a));
      x += Math.sign(x || 1) * squash * side * halfWidth * 0.16;
    }

    return { x, y };
  });

  // Lean bends the body over a planted base rather than shearing it. A shear
  // slides the top sideways while the vertical spans stay vertical, which
  // reads as a wedge; rotating each point about a low pivot by an amount that
  // grows with its height keeps local widths intact, so the body curves.
  if (p.lean !== 0) {
    const pivotY = halfWidth * 1.35;
    for (const q of raw) {
      const h = (pivotY - q.y) / (pivotY + halfWidth);
      const t = p.lean * 0.62 * h * h;
      const c = Math.cos(t);
      const s = Math.sin(t);
      const dy = q.y - pivotY;
      const nx = q.x * c - dy * s;
      const ny = q.x * s + dy * c;
      q.x = nx;
      q.y = ny + pivotY;
    }
  }

  // Centre shift moves mass rather than the whole body: anchors facing the
  // shift travel with it while trailing anchors follow only partly and so
  // compress, which is the same volume-redistribution idea as the lobes.
  const shiftX = p.centerShiftX * halfWidth;
  const shiftY = p.centerShiftY * halfWidth;
  const shiftLen = Math.hypot(shiftX, shiftY);
  if (shiftLen > 1e-4) {
    const ux = shiftX / shiftLen;
    const uy = shiftY / shiftLen;
    for (const q of raw) {
      const len = Math.hypot(q.x, q.y) || 1;
      const facing = (q.x / len) * ux + (q.y / len) * uy;
      const follow = 0.62 + 0.38 * facing;
      q.x += shiftX * follow;
      q.y += shiftY * follow;
    }
  }

  const rot = p.rotation * DEG;
  const points = raw.map((q) => {
    const r = rot !== 0 ? rotate(q, rot) : q;
    return {
      x: r.x * p.scale * p.scaleX,
      y: r.y * p.scale * p.scaleY,
    };
  });

  const segments = toSegments(points);

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let cx = 0;
  let cy = 0;
  for (const q of points) {
    if (q.x < minX) minX = q.x;
    if (q.x > maxX) maxX = q.x;
    if (q.y < minY) minY = q.y;
    if (q.y > maxY) maxY = q.y;
    cx += q.x;
    cy += q.y;
  }

  return {
    points,
    segments,
    center: { x: cx / points.length, y: cy / points.length },
    bounds: { minX, minY, maxX, maxY },
    halfWidth,
  };
}

/** Closed Catmull-Rom through the anchors, emitted as cubic Beziers. */
function toSegments(points: Point[]): BezierSegment[] {
  const n = points.length;
  const out: BezierSegment[] = [];
  for (let i = 0; i < n; i++) {
    const p0 = points[(i - 1 + n) % n];
    const p1 = points[i];
    const p2 = points[(i + 1) % n];
    const p3 = points[(i + 2) % n];
    const a = NEUTRAL_ANCHORS[i].tension;
    const b = NEUTRAL_ANCHORS[(i + 1) % n].tension;
    out.push({
      p0: p1,
      c0: { x: p1.x + (p2.x - p0.x) * a, y: p1.y + (p2.y - p0.y) * a },
      c1: { x: p2.x - (p3.x - p1.x) * b, y: p2.y - (p3.y - p1.y) * b },
      p1: p2,
    });
  }
  return out;
}

export function tracePath(ctx: CanvasRenderingContext2D, shape: BlobShape) {
  const s = shape.segments;
  ctx.beginPath();
  ctx.moveTo(s[0].p0.x, s[0].p0.y);
  for (const seg of s) {
    ctx.bezierCurveTo(seg.c0.x, seg.c0.y, seg.c1.x, seg.c1.y, seg.p1.x, seg.p1.y);
  }
  ctx.closePath();
}

const SURFACE_SAMPLES = 96;

/**
 * A ring of surface samples indexed by angle.
 *
 * Material features (folds, highlights, bubbles) are authored in
 * angle/depth space and resolved through this ring, so every one of them
 * deforms with the body instead of floating on top of it.
 */
export class SurfaceRing {
  private readonly ring: Point[] = [];
  readonly center: Point;
  /** Average centroid-to-surface distance; the radius depth 1.0 means. */
  readonly meanReach: number;

  constructor(shape: BlobShape) {
    this.center = shape.center;
    const buckets: (Point | null)[] = new Array(SURFACE_SAMPLES).fill(null);
    for (const seg of shape.segments) {
      for (let i = 0; i < 14; i++) {
        const t = i / 14;
        const u = 1 - t;
        const b0 = u * u * u;
        const b1 = 3 * u * u * t;
        const b2 = 3 * u * t * t;
        const b3 = t * t * t;
        const x = b0 * seg.p0.x + b1 * seg.c0.x + b2 * seg.c1.x + b3 * seg.p1.x;
        const y = b0 * seg.p0.y + b1 * seg.c0.y + b2 * seg.c1.y + b3 * seg.p1.y;
        const dx = x - this.center.x;
        const dy = y - this.center.y;
        let deg = (Math.atan2(dx, -dy) * 180) / Math.PI;
        if (deg < 0) deg += 360;
        const idx = Math.round((deg / 360) * SURFACE_SAMPLES) % SURFACE_SAMPLES;
        const prev = buckets[idx];
        if (!prev || Math.hypot(dx, dy) > Math.hypot(prev.x - this.center.x, prev.y - this.center.y)) {
          buckets[idx] = { x, y };
        }
      }
    }
    // Closed contours can leave a bucket empty at a very concave angle; fill
    // it from the nearest neighbour rather than dropping to the origin.
    for (let i = 0; i < SURFACE_SAMPLES; i++) {
      if (buckets[i]) continue;
      for (let d = 1; d < SURFACE_SAMPLES; d++) {
        const a = buckets[(i - d + SURFACE_SAMPLES) % SURFACE_SAMPLES];
        const b = buckets[(i + d) % SURFACE_SAMPLES];
        if (a || b) {
          buckets[i] = (a ?? b) as Point;
          break;
        }
      }
    }
    this.ring = buckets as Point[];
    let sum = 0;
    for (const q of this.ring) sum += Math.hypot(q.x - this.center.x, q.y - this.center.y);
    this.meanReach = sum / this.ring.length;
  }

  /** Surface point at the given angle (degrees from up, clockwise). */
  surfaceAt(angle: number): Point {
    const t = ((((angle % 360) + 360) % 360) / 360) * SURFACE_SAMPLES;
    const i = Math.floor(t) % SURFACE_SAMPLES;
    const j = (i + 1) % SURFACE_SAMPLES;
    const f = t - Math.floor(t);
    const a = this.ring[i];
    const b = this.ring[j];
    return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f };
  }

  /** Point at `depth` of the way from the centroid to the surface. */
  at(angle: number, depth: number): Point {
    const s = this.surfaceAt(angle);
    return {
      x: this.center.x + (s.x - this.center.x) * depth,
      y: this.center.y + (s.y - this.center.y) * depth,
    };
  }
}

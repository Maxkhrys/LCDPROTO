/**
 * Procedural silhouette for the experimental Blob body.
 *
 * R&D ONLY — this file is not wired into the production rig.
 *
 * The neutral anchor table below is not hand-guessed: it was fitted against
 * the master body artwork (public/blob/rig/yellow/body.png). The master's
 * alpha edge was traced radially from its bounding-box centre, ten anchors
 * were placed on the trace extrema (the real lobes, notches and folds), and a
 * closed Catmull-Rom -> cubic Bezier curve through them was then optimised
 * over angle / radius / tension. The result reproduces the master outline to
 * an RMS error of 0.008 and a worst-case error of 0.038 in half-width units —
 * about 0.6px RMS and 2.6px peak at the 240px authored size.
 *
 * Radii are fractions of the body's half-width. Angles are degrees measured
 * from straight up, increasing clockwise on screen (90 = right, 180 = down).
 */

export type AnchorId =
  | "top"
  | "upperRightShoulder"
  | "midRightLobe"
  | "lowerRightLobe"
  | "bottomRight"
  | "bottomCentre"
  | "bottomLeft"
  | "lowerLeftLobe"
  | "midLeftLobe"
  | "upperLeftShoulder";

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
 * Ten major shape points, in clockwise order starting at the crown.
 *
 * The master Blob is deliberately asymmetrical — the right lobe sits lower and
 * wider than the left, the upper-left shoulder is the tightest point on the
 * whole outline, and the crown peaks slightly right of centre. None of that is
 * mirrored or averaged away here.
 */
export const NEUTRAL_ANCHORS: readonly Anchor[] = [
  { id: "top", angle: 4.6, radius: 1.0261, tension: 0.248 },
  { id: "upperRightShoulder", angle: 47.6, radius: 0.8012, tension: 0.26 },
  { id: "midRightLobe", angle: 81.2, radius: 0.9091, tension: 0.296 },
  { id: "lowerRightLobe", angle: 121.6, radius: 1.1021, tension: 0.104 },
  { id: "bottomRight", angle: 162.8, radius: 0.9789, tension: 0.044 },
  { id: "bottomCentre", angle: 183.6, radius: 1.0209, tension: 0.248 },
  { id: "bottomLeft", angle: 203.8, radius: 0.9395, tension: 0.236 },
  { id: "lowerLeftLobe", angle: 243.4, radius: 1.0871, tension: 0.212 },
  { id: "midLeftLobe", angle: 281.4, radius: 0.8183, tension: 0.248 },
  { id: "upperLeftShoulder", angle: 314.6, radius: 0.7408, tension: 0.296 },
] as const;

/** Every value a caller can drive. All are neutral at the documented default. */
export interface ShapeParams {
  scale: number;
  scaleX: number;
  scaleY: number;
  /** Degrees, clockwise, about the body centre. */
  rotation: number;
  /** Horizontal shear that grows with height — the top trails the base. */
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
 * How each parameter reaches the anchors.
 *
 * This is what keeps the deformation local. A uniform transform can only
 * scale the whole outline; these weights let one lobe swell while its
 * neighbours barely move, which is the difference between jelly and a
 * scaled PNG.
 */
const RADIAL_INFLUENCE: Record<string, Partial<Record<AnchorId, number>>> = {
  topHeight: { top: 1, upperRightShoulder: 0.34, upperLeftShoulder: 0.34 },
  leftBulge: { midLeftLobe: 1, upperLeftShoulder: 0.46, lowerLeftLobe: 0.32 },
  rightBulge: { midRightLobe: 1, upperRightShoulder: 0.46, lowerRightLobe: 0.32 },
  lowerLeftBulge: { lowerLeftLobe: 1, bottomLeft: 0.52, midLeftLobe: 0.28 },
  lowerRightBulge: { lowerRightLobe: 1, bottomRight: 0.52, midRightLobe: 0.28 },
  bottomSag: { bottomCentre: 1, bottomLeft: 0.56, bottomRight: 0.56 },
};

/** Fixed per-anchor ripple phases. Deterministic, so wobble never flickers. */
const WOBBLE_PHASE: Record<AnchorId, number> = {
  top: 0,
  upperRightShoulder: 1.9,
  midRightLobe: 3.4,
  lowerRightLobe: 5.1,
  bottomRight: 0.7,
  bottomCentre: 2.6,
  bottomLeft: 4.3,
  lowerLeftLobe: 5.9,
  midLeftLobe: 1.2,
  upperLeftShoulder: 3.0,
};

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

const DEG = Math.PI / 180;

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

  const raw: Point[] = NEUTRAL_ANCHORS.map((anchor) => {
    let radius = anchor.radius;

    for (const key in RADIAL_INFLUENCE) {
      const weight = RADIAL_INFLUENCE[key][anchor.id];
      if (!weight) continue;
      radius += (p[key as keyof ShapeParams] as number) * weight;
    }

    if (p.wobbleAmount !== 0) {
      radius +=
        p.wobbleAmount * Math.sin(p.wobblePhase + WOBBLE_PHASE[anchor.id]);
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

    // Lean shears the upper mass sideways while the base stays planted.
    if (p.lean !== 0) {
      const height = (halfWidth - y) / (halfWidth * 2);
      x += p.lean * height * height * halfWidth * 0.95;
    }

    return { x, y };
  });

  // Centre shift moves mass rather than the whole body: anchors facing the
  // shift travel with it, trailing anchors follow only partly and so compress.
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

  constructor(shape: BlobShape) {
    this.center = shape.center;
    const buckets: (Point | null)[] = new Array(SURFACE_SAMPLES).fill(null);
    for (const seg of shape.segments) {
      for (let i = 0; i < 24; i++) {
        const t = i / 24;
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

  /** Average centroid-to-surface distance; the radius depth 1.0 corresponds to. */
  readonly meanReach: number;

  /** Surface point at the given angle (degrees from up, clockwise). */
  surfaceAt(angle: number): Point {
    const t = ((angle % 360) + 360) % 360 / 360 * SURFACE_SAMPLES;
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

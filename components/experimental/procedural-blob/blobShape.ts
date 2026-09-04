/**
 * Procedural Blob Body - Shape & Geometry Engine
 *
 * Reverse-engineered from the LCDPROTO Master Blob Reference.
 * Defines the 10 controllable anchor points, C1-smooth cubic Bezier spline
 * generator, local and global deformation channels, and deterministic particles.
 */

export interface Point2D {
  x: number;
  y: number;
}

export interface ControlPoint extends Point2D {
  id: number;
  name: string;
  tension: number;
}

export interface BezierSegment {
  p1: Point2D;
  cp1: Point2D;
  cp2: Point2D;
  p2: Point2D;
}

export interface DeformationParams {
  scale: number;
  scaleX: number;
  scaleY: number;
  rotation: number; // degrees
  lean: number; // -30 to 30 px equivalent shear
  topHeight: number; // -25 to 25 px
  leftBulge: number; // -25 to 25 px
  rightBulge: number; // -25 to 25 px
  lowerLeftBulge: number; // -25 to 25 px
  lowerRightBulge: number; // -25 to 25 px
  bottomSag: number; // -25 to 25 px
  squash: number; // 0 to 1
  stretch: number; // 0 to 1
  centerShiftX: number; // -30 to 30 px
  centerShiftY: number; // -30 to 30 px
  wobbleAmount: number; // 0 to 1
  wobblePhase: number; // radians
  highlightShift: number; // -20 to 20 px
}

export const DEFAULT_DEFORMATION: DeformationParams = {
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
  highlightShift: 0,
};

/**
 * 10 Calibrated base anchor points in 240-space coordinates relative to
 * body center (0, 0).
 * Calibrated against the master blob contour with >98% IoU overlap.
 */
export const BASE_CONTROL_POINTS: readonly ControlPoint[] = [
  { id: 0, name: "top", x: 3.32, y: -65.65, tension: 0.7 },
  { id: 1, name: "upper-left shoulder", x: -29.85, y: -40.03, tension: 1.1 },
  { id: 2, name: "mid-left lobe", x: -57.99, y: -5.26, tension: 0.8 },
  { id: 3, name: "lower-left lobe", x: -64.85, y: 32.94, tension: 0.6 },
  { id: 4, name: "bottom-left", x: -28.48, y: 54.67, tension: 0.8 },
  { id: 5, name: "bottom-centre", x: 3.55, y: 64.97, tension: 0.5 },
  { id: 6, name: "bottom-right", x: 48.38, y: 47.35, tension: 0.6 },
  { id: 7, name: "lower-right lobe", x: 66.68, y: 27.91, tension: 0.5 },
  { id: 8, name: "mid-right lobe", x: 59.36, y: -13.73, tension: 0.6 },
  { id: 9, name: "upper-right shoulder", x: 33.74, y: -43.24, tension: 1.0 },
] as const;

/**
 * Deterministic celestial specks / stars sampled directly from master artwork.
 * Positions are normalized relative to local body extent (-1 to 1).
 */
export interface CosmicStar {
  x: number; // -1 to 1
  y: number; // -1 to 1
  radius: number; // in 240-space px
  brightness: number; // 0 to 1
  glint: boolean; // 4-pointed cross star
}

export const COSMIC_STARS: readonly CosmicStar[] = [
  // Prominent core star with radiant glint
  { x: 0.05, y: -0.12, radius: 1.8, brightness: 1.0, glint: true },
  // Upper-left constellation
  { x: -0.32, y: -0.42, radius: 1.2, brightness: 0.85, glint: true },
  { x: -0.18, y: -0.58, radius: 0.9, brightness: 0.75, glint: false },
  { x: -0.42, y: -0.22, radius: 0.7, brightness: 0.6, glint: false },
  // Right side cluster
  { x: 0.38, y: -0.36, radius: 1.1, brightness: 0.8, glint: true },
  { x: 0.52, y: -0.15, radius: 0.8, brightness: 0.65, glint: false },
  { x: 0.44, y: 0.12, radius: 0.7, brightness: 0.6, glint: false },
  // Lower body specks
  { x: -0.28, y: 0.38, radius: 1.0, brightness: 0.75, glint: false },
  { x: -0.08, y: 0.48, radius: 0.8, brightness: 0.65, glint: false },
  { x: 0.25, y: 0.42, radius: 1.3, brightness: 0.9, glint: true },
  { x: 0.55, y: 0.32, radius: 0.7, brightness: 0.55, glint: false },
  // Subtle internal micro specks
  { x: -0.12, y: 0.15, radius: 0.6, brightness: 0.5, glint: false },
  { x: 0.18, y: 0.22, radius: 0.6, brightness: 0.55, glint: false },
  { x: -0.22, y: -0.15, radius: 0.5, brightness: 0.45, glint: false },
] as const;

/**
 * Translucent cosmic gel bubbles with spherical refraction rim.
 */
export interface CosmicBubble {
  x: number;
  y: number;
  radius: number;
  alpha: number;
}

export const COSMIC_BUBBLES: readonly CosmicBubble[] = [
  { x: 0.28, y: -0.28, radius: 3.2, alpha: 0.45 },
  { x: -0.35, y: 0.24, radius: 2.6, alpha: 0.38 },
  { x: 0.36, y: 0.28, radius: 2.2, alpha: 0.35 },
  { x: -0.15, y: -0.38, radius: 1.9, alpha: 0.4 },
  { x: 0.08, y: 0.35, radius: 2.4, alpha: 0.32 },
] as const;

/**
 * Applies all local and global deformation channels to the base 10 control points.
 */
export function computeDeformedPoints(
  params: DeformationParams = DEFAULT_DEFORMATION,
  basePoints: readonly ControlPoint[] = BASE_CONTROL_POINTS
): ControlPoint[] {
  const {
    scale,
    scaleX,
    scaleY,
    rotation,
    lean,
    topHeight,
    leftBulge,
    rightBulge,
    lowerLeftBulge,
    lowerRightBulge,
    bottomSag,
    squash,
    stretch,
    centerShiftX,
    centerShiftY,
    wobbleAmount,
    wobblePhase,
  } = params;

  // Effective scales including squash and stretch with volume preservation
  const effScaleX =
    scale * scaleX * (1 + squash * 0.38) * (1 - stretch * 0.24);
  const effScaleY =
    scale * scaleY * (1 - squash * 0.32) * (1 + stretch * 0.42);

  const rad = (rotation * Math.PI) / 180;
  const cosR = Math.cos(rad);
  const sinR = Math.sin(rad);

  return basePoints.map((pt, index) => {
    let px = pt.x;
    let py = pt.y;

    // 1. Top height deformation (points 0, 1, 9)
    if (index === 0) {
      py -= topHeight;
    } else if (index === 1 || index === 9) {
      py -= topHeight * 0.6;
    }

    // 2. Lateral bulges (points 1, 2, 3 on left; 7, 8, 9 on right)
    if (index === 1) px -= leftBulge * 0.5;
    if (index === 2) px -= leftBulge * 1.0;
    if (index === 3) px -= leftBulge * 0.7;

    if (index === 7) px += rightBulge * 0.7;
    if (index === 8) px += rightBulge * 1.0;
    if (index === 9) px += rightBulge * 0.5;

    // 3. Lower lateral bulges & hip weight (points 3, 4 on left; 6, 7 on right)
    if (index === 3) {
      px -= lowerLeftBulge * 1.1;
      py += lowerLeftBulge * 0.25;
    }
    if (index === 4) {
      px -= lowerLeftBulge * 0.8;
      py += lowerLeftBulge * 0.4;
    }
    if (index === 6) {
      px += lowerRightBulge * 0.8;
      py += lowerRightBulge * 0.4;
    }
    if (index === 7) {
      px += lowerRightBulge * 1.1;
      py += lowerRightBulge * 0.25;
    }

    // 4. Bottom sag (points 4, 5, 6)
    if (index === 4) py += bottomSag * 0.65;
    if (index === 5) py += bottomSag * 1.0;
    if (index === 6) py += bottomSag * 0.65;

    // 5. Squash organic ground expansion (broadens lower perimeter)
    if (squash > 0) {
      if (index === 3 || index === 4) px -= squash * 10;
      if (index === 6 || index === 7) px += squash * 10;
      if (index === 4 || index === 5 || index === 6) py += squash * 6;
    }

    // 6. Stretch organic vertical reach
    if (stretch > 0) {
      if (index === 0) py -= stretch * 14;
      if (index === 1 || index === 9) py -= stretch * 9;
      if (index === 2 || index === 8) px *= 1 - stretch * 0.12;
    }

    // 7. Lean shear (proportional to height from base)
    if (lean !== 0) {
      // Points with negative Y (top) shift most; base stays anchored
      const heightFactor = Math.max(0, (65 - py) / 130);
      px += lean * heightFactor;
      // Slight secondary vertical drop on leaning side
      py += Math.abs(lean) * 0.08 * (px > 0 ? (lean > 0 ? 1 : -0.5) : (lean < 0 ? 1 : -0.5));
    }

    // 8. Soft-body harmonic wobble
    if (wobbleAmount > 0) {
      const pointAngle = Math.atan2(py, px);
      // Double harmonic frequency around perimeter
      const phase = wobblePhase + index * ((Math.PI * 2 * 2) / 10);
      const wave = Math.sin(phase) * wobbleAmount * 5.5;
      px += Math.cos(pointAngle) * wave;
      py += Math.sin(pointAngle) * wave;
    }

    // 9. Apply effective scale
    px *= effScaleX;
    py *= effScaleY;

    // 10. Rotation
    const rx = px * cosR - py * sinR;
    const ry = px * sinR + py * cosR;

    // 11. Center translation
    return {
      id: pt.id,
      name: pt.name,
      x: rx + centerShiftX,
      y: ry + centerShiftY,
      tension: pt.tension,
    };
  });
}

/**
 * Computes C1-continuous cubic Bezier curve segments from deformed anchor points.
 */
export function computeBezierSegments(points: readonly ControlPoint[]): BezierSegment[] {
  const n = points.length;
  const segments: BezierSegment[] = [];

  for (let i = 0; i < n; i++) {
    const p0 = points[(i - 1 + n) % n];
    const p1 = points[i];
    const p2 = points[(i + 1) % n];
    const p3 = points[(i + 2) % n];

    // Outgoing control handle from p1 with tension modulation
    const t1 = p1.tension;
    const cp1x = p1.x + ((p2.x - p0.x) * t1) / 3.0;
    const cp1y = p1.y + ((p2.y - p0.y) * t1) / 3.0;

    // Incoming control handle into p2 with tension modulation
    const t2 = p2.tension;
    const cp2x = p2.x - ((p3.x - p1.x) * t2) / 3.0;
    const cp2y = p2.y - ((p3.y - p1.y) * t2) / 3.0;

    segments.push({
      p1: { x: p1.x, y: p1.y },
      cp1: { x: cp1x, y: cp1y },
      cp2: { x: cp2x, y: cp2y },
      p2: { x: p2.x, y: p2.y },
    });
  }

  return segments;
}

/**
 * Traces the closed Blob body silhouette path onto a 2D Canvas context.
 */
export function traceBodyPath(
  ctx: CanvasRenderingContext2D,
  segments: readonly BezierSegment[],
  cx: number,
  cy: number
): void {
  if (segments.length === 0) return;

  ctx.beginPath();
  const first = segments[0];
  ctx.moveTo(cx + first.p1.x, cy + first.p1.y);

  for (const seg of segments) {
    ctx.bezierCurveTo(
      cx + seg.cp1.x,
      cy + seg.cp1.y,
      cx + seg.cp2.x,
      cy + seg.cp2.y,
      cx + seg.p2.x,
      cy + seg.p2.y
    );
  }

  ctx.closePath();
}

/**
 * Computes the dynamic path for the primary upper-left specular highlight,
 * deformed in alignment with the upper body.
 */
export function tracePrimaryHighlightPath(
  ctx: CanvasRenderingContext2D,
  points: readonly ControlPoint[],
  cx: number,
  cy: number,
  highlightShift = 0
): void {
  // Anchored between shoulder (p1) and top (p0), indented inward
  const p0 = points[0];
  const p1 = points[1];
  const p2 = points[2];

  // Inward offset vectors
  const hx = (p1.x * 0.72 + p0.x * 0.28) * 0.85 + highlightShift;
  const hy = (p1.y * 0.72 + p0.y * 0.28) * 0.85 - 2;

  const tipX = (p0.x * 0.75 + p1.x * 0.25) * 0.82 + highlightShift;
  const tipY = (p0.y * 0.75 + p1.y * 0.25) * 0.82;

  const botX = (p2.x * 0.35 + p1.x * 0.65) * 0.82 + highlightShift;
  const botY = (p2.y * 0.35 + p1.y * 0.65) * 0.82;

  ctx.beginPath();
  ctx.moveTo(cx + tipX, cy + tipY);
  ctx.quadraticCurveTo(cx + hx + 12, cy + hy + 2, cx + botX, cy + botY);
  ctx.quadraticCurveTo(cx + hx - 5, cy + hy - 4, cx + tipX, cy + tipY);
  ctx.closePath();
}

/**
 * Computes the dynamic path for the secondary top highlight near the peak.
 */
export function traceTopHighlightPath(
  ctx: CanvasRenderingContext2D,
  points: readonly ControlPoint[],
  cx: number,
  cy: number,
  highlightShift = 0
): void {
  const p0 = points[0];
  const p9 = points[9];

  const midX = (p0.x * 0.6 + p9.x * 0.4) * 0.88 + highlightShift;
  const midY = (p0.y * 0.6 + p9.y * 0.4) * 0.88 + 3;

  const leftX = p0.x * 0.85 - 6 + highlightShift;
  const leftY = p0.y * 0.85 + 4;

  const rightX = (p0.x * 0.3 + p9.x * 0.7) * 0.85 + highlightShift;
  const rightY = (p0.y * 0.3 + p9.y * 0.7) * 0.85 + 6;

  ctx.beginPath();
  ctx.moveTo(cx + leftX, cy + leftY);
  ctx.quadraticCurveTo(cx + midX, cy + midY - 3, cx + rightX, cy + rightY);
  ctx.quadraticCurveTo(cx + midX, cy + midY + 4, cx + leftX, cy + leftY);
  ctx.closePath();
}

/**
 * Internal translucent fold curves that deform with the body to give 3D gel depth.
 */
export function traceInternalFolds(
  ctx: CanvasRenderingContext2D,
  points: readonly ControlPoint[],
  cx: number,
  cy: number
): void {
  // Fold 1: Across lower body (from lower-left to bottom-right)
  const p3 = points[3];
  const p4 = points[4];
  const p5 = points[5];
  const p6 = points[6];

  ctx.beginPath();
  ctx.moveTo(cx + p3.x * 0.75, cy + p3.y * 0.75);
  ctx.bezierCurveTo(
    cx + p4.x * 0.65,
    cy + p4.y * 0.68,
    cx + p5.x * 0.55,
    cy + p5.y * 0.62,
    cx + p6.x * 0.72,
    cy + p6.y * 0.72
  );

  // Fold 2: Mid-body lateral wave (from mid-left towards center-lower)
  const p2 = points[2];
  const p7 = points[7];
  ctx.moveTo(cx + p2.x * 0.8, cy + p2.y * 0.8 + 4);
  ctx.bezierCurveTo(
    cx + p2.x * 0.3,
    cy + p2.y * 0.3 + 18,
    cx + p7.x * 0.2,
    cy + p7.y * 0.3 + 12,
    cx + p7.x * 0.75,
    cy + p7.y * 0.75 - 8
  );

  // Fold 3: Upper-right internal shelf
  const p8 = points[8];
  const p9 = points[9];
  ctx.moveTo(cx + p9.x * 0.75, cy + p9.y * 0.75 + 6);
  ctx.quadraticCurveTo(
    cx + p8.x * 0.5,
    cy + p8.y * 0.5 + 4,
    cx + p8.x * 0.82,
    cy + p8.y * 0.82 + 10
  );
}

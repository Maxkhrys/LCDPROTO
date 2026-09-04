/**
 * Procedural Blob Body - Material & Layered Canvas Pipeline
 *
 * Implements the 7-layer cosmic jelly rendering pipeline:
 * 1. Base Body Fill (deep dark purple/indigo gradient)
 * 2. Inner Depth Cavities (3D viscous fluid shading)
 * 3. Inner Volume Core Glow (illuminated violet core)
 * 4. Internal Gel Folds (deformable translucent ribbons)
 * 5. Deterministic Particles (stars, glints, and spherical bubbles)
 * 6. Specular Highlights (large upper-left glossy reflection & top crescent)
 * 7. Outer Luminous Rim (crisp electric violet edge)
 */

import {
  type BezierSegment,
  type ControlPoint,
  type DeformationParams,
  COSMIC_STARS,
  COSMIC_BUBBLES,
  traceBodyPath,
  tracePrimaryHighlightPath,
  traceTopHighlightPath,
} from "./blobShape";

export interface MaterialOptions {
  showHighlights?: boolean;
  showFolds?: boolean;
  showParticles?: boolean;
  showRim?: boolean;
  rimIntensity?: number; // 0 to 1, default 1
  coreGlowIntensity?: number; // 0 to 1, default 1
}

const DEFAULT_OPTIONS: MaterialOptions = {
  showHighlights: true,
  showFolds: true,
  showParticles: true,
  showRim: true,
  rimIntensity: 1,
  coreGlowIntensity: 1,
};

/**
 * Maps a normalized coordinate (-1 to 1) into current deformed body space.
 */
function mapDeformedParticle(
  nx: number,
  ny: number,
  points: readonly ControlPoint[]
): { x: number; y: number } {
  // Determine dominant quadrant to interpolate between corresponding perimeter points
  // Points: 0: top, 2: mid-left, 5: bottom, 7: lower-right, 8: mid-right
  const pTop = points[0];
  const pBottom = points[5];
  const pLeft = points[2];
  const pRight = points[8];

  // Radial interpolation from center (0, 0)
  const targetX = nx > 0 ? pRight.x * nx : -pLeft.x * nx;
  const targetY = ny > 0 ? pBottom.y * ny : -pTop.y * ny;

  return { x: targetX, y: targetY };
}

/**
 * Renders the complete layered procedural Blob body.
 */
export function renderBlobBody(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  points: readonly ControlPoint[],
  segments: readonly BezierSegment[],
  params: DeformationParams,
  options: MaterialOptions = DEFAULT_OPTIONS
): void {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const hShift = params.highlightShift;

  ctx.save();

  // ---------------------------------------------------------------------------
  // 1. BASE BODY FILL
  // ---------------------------------------------------------------------------
  traceBodyPath(ctx, segments, cx, cy);

  // Gradient oriented from upper-left light angle to bottom-right depth
  const baseGrad = ctx.createLinearGradient(
    cx - 60 + hShift * 0.5,
    cy - 65,
    cx + 55,
    cy + 68
  );
  baseGrad.addColorStop(0, "#23064e"); // rich indigo-purple
  baseGrad.addColorStop(0.28, "#18023a"); // deep violet
  baseGrad.addColorStop(0.65, "#0d0124"); // midnight purple
  baseGrad.addColorStop(1, "#050012"); // cosmic void
  ctx.fillStyle = baseGrad;
  ctx.fill();

  // Create clip to body interior for all internal volume layers
  ctx.save();
  traceBodyPath(ctx, segments, cx, cy);
  ctx.clip();

  // ---------------------------------------------------------------------------
  // 2. INNER DEPTH CAVITIES (3D volume shading)
  // ---------------------------------------------------------------------------
  // Dark cavity in lower right and lower flank
  const cavityGrad = ctx.createRadialGradient(
    cx + 25 + params.centerShiftX * 0.5,
    cy + 30 + params.centerShiftY * 0.5,
    5,
    cx + 20,
    cy + 25,
    75
  );
  cavityGrad.addColorStop(0, "rgba(2, 0, 8, 0.88)");
  cavityGrad.addColorStop(0.55, "rgba(5, 0, 16, 0.55)");
  cavityGrad.addColorStop(1, "rgba(10, 0, 30, 0)");
  ctx.fillStyle = cavityGrad;
  ctx.fillRect(cx - 85, cy - 85, 170, 170);

  // ---------------------------------------------------------------------------
  // 3. INNER VOLUME CORE GLOW (electric violet illumination)
  // ---------------------------------------------------------------------------
  if (opts.coreGlowIntensity && opts.coreGlowIntensity > 0) {
    const coreX = cx - 8 + hShift * 0.6;
    const coreY = cy - 6;
    const coreGrad = ctx.createRadialGradient(
      coreX,
      coreY,
      2,
      coreX,
      coreY,
      58 * params.scale
    );
    coreGrad.addColorStop(0, `rgba(132, 28, 255, ${0.82 * opts.coreGlowIntensity})`);
    coreGrad.addColorStop(0.3, `rgba(95, 14, 215, ${0.58 * opts.coreGlowIntensity})`);
    coreGrad.addColorStop(0.65, `rgba(45, 4, 130, ${0.28 * opts.coreGlowIntensity})`);
    coreGrad.addColorStop(1, "rgba(20, 0, 60, 0)");

    ctx.save();
    ctx.globalCompositeOperation = "screen";
    ctx.fillStyle = coreGrad;
    ctx.fillRect(cx - 85, cy - 85, 170, 170);
    ctx.restore();
  }

  // ---------------------------------------------------------------------------
  // 4. INTERNAL GEL FOLDS (viscous fluid layers)
  // ---------------------------------------------------------------------------
  if (opts.showFolds) {
    ctx.save();
    ctx.lineCap = "round";

    // Fold 1: Across lower body
    const p3 = points[3];
    const p4 = points[4];
    const p5 = points[5];
    const p6 = points[6];

    ctx.beginPath();
    ctx.moveTo(cx + p3.x * 0.76, cy + p3.y * 0.76);
    ctx.bezierCurveTo(
      cx + p4.x * 0.68,
      cy + p4.y * 0.7,
      cx + p5.x * 0.58,
      cy + p5.y * 0.64,
      cx + p6.x * 0.74,
      cy + p6.y * 0.74
    );
    ctx.strokeStyle = "rgba(185, 95, 255, 0.28)";
    ctx.lineWidth = 1.8;
    ctx.stroke();

    // Soft companion ridge for fold 1
    ctx.beginPath();
    ctx.moveTo(cx + p3.x * 0.74, cy + p3.y * 0.74 - 2.5);
    ctx.bezierCurveTo(
      cx + p4.x * 0.66,
      cy + p4.y * 0.68 - 2.5,
      cx + p5.x * 0.56,
      cy + p5.y * 0.62 - 2.5,
      cx + p6.x * 0.72,
      cy + p6.y * 0.72 - 2.5
    );
    ctx.strokeStyle = "rgba(30, 0, 80, 0.42)";
    ctx.lineWidth = 1.4;
    ctx.stroke();

    // Fold 2: Mid lateral wave
    const p2 = points[2];
    const p7 = points[7];
    ctx.beginPath();
    ctx.moveTo(cx + p2.x * 0.8, cy + p2.y * 0.8 + 4);
    ctx.bezierCurveTo(
      cx + p2.x * 0.35,
      cy + p2.y * 0.35 + 16,
      cx + p7.x * 0.25,
      cy + p7.y * 0.35 + 10,
      cx + p7.x * 0.74,
      cy + p7.y * 0.74 - 7
    );
    ctx.strokeStyle = "rgba(160, 70, 245, 0.22)";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Fold 3: Upper-right internal shelf
    const p8 = points[8];
    const p9 = points[9];
    ctx.beginPath();
    ctx.moveTo(cx + p9.x * 0.75, cy + p9.y * 0.75 + 5);
    ctx.quadraticCurveTo(
      cx + p8.x * 0.5,
      cy + p8.y * 0.5 + 4,
      cx + p8.x * 0.82,
      cy + p8.y * 0.82 + 8
    );
    ctx.strokeStyle = "rgba(175, 80, 255, 0.25)";
    ctx.lineWidth = 1.6;
    ctx.stroke();

    ctx.restore();
  }

  // ---------------------------------------------------------------------------
  // 5. DETERMINISTIC PARTICLES (stars, glints, spherical bubbles)
  // ---------------------------------------------------------------------------
  if (opts.showParticles) {
    // 5A. Bubbles
    for (const bubble of COSMIC_BUBBLES) {
      const pos = mapDeformedParticle(bubble.x, bubble.y, points);
      const bx = cx + pos.x;
      const by = cy + pos.y;
      const r = bubble.radius * params.scale;

      // Outer refraction ring
      ctx.beginPath();
      ctx.arc(bx, by, r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(130, 45, 230, ${bubble.alpha * 0.35})`;
      ctx.fill();
      ctx.strokeStyle = `rgba(215, 160, 255, ${bubble.alpha * 0.75})`;
      ctx.lineWidth = 0.75;
      ctx.stroke();

      // Specular pinprick on bubble surface
      ctx.beginPath();
      ctx.arc(bx - r * 0.35, by - r * 0.35, r * 0.28, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 255, 255, ${bubble.alpha * 0.85})`;
      ctx.fill();
    }

    // 5B. Cosmic Stars & Glints
    for (const star of COSMIC_STARS) {
      const pos = mapDeformedParticle(star.x, star.y, points);
      const sx = cx + pos.x;
      const sy = cy + pos.y;
      const r = star.radius * params.scale;
      const b = star.brightness;

      // Soft purple corona
      ctx.beginPath();
      ctx.arc(sx, sy, r * 2.6, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(195, 120, 255, ${b * 0.32})`;
      ctx.fill();

      // Sharp white star core
      ctx.beginPath();
      ctx.arc(sx, sy, r * 0.85, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 255, 255, ${b * 0.95})`;
      ctx.fill();

      // 4-Point cross star glint rays
      if (star.glint) {
        ctx.save();
        ctx.strokeStyle = `rgba(255, 255, 255, ${b * 0.85})`;
        ctx.lineWidth = 0.7;

        const rayLen = r * 3.4;
        // Horizontal ray
        ctx.beginPath();
        ctx.moveTo(sx - rayLen, sy);
        ctx.lineTo(sx + rayLen, sy);
        ctx.stroke();

        // Vertical ray
        ctx.beginPath();
        ctx.moveTo(sx, sy - rayLen);
        ctx.lineTo(sx, sy + rayLen);
        ctx.stroke();

        ctx.restore();
      }
    }
  }

  // ---------------------------------------------------------------------------
  // 6. SPECULAR HIGHLIGHTS (glossy liquid reflections)
  // ---------------------------------------------------------------------------
  if (opts.showHighlights) {
    // 6A. Primary Upper-Left Highlight (the signature curved capsule highlight)
    ctx.save();
    tracePrimaryHighlightPath(ctx, points, cx, cy, hShift);

    // Bounding linear gradient aligned with the highlight's angle
    const p1 = points[1];
    const hlGrad = ctx.createLinearGradient(
      cx + p1.x * 0.85 - 15 + hShift,
      cy + p1.y * 0.85 - 12,
      cx + p1.x * 0.85 + 20 + hShift,
      cy + p1.y * 0.85 + 25
    );
    hlGrad.addColorStop(0, "rgba(255, 255, 255, 0.96)"); // bright white core
    hlGrad.addColorStop(0.35, "rgba(235, 215, 255, 0.82)"); // soft lilac
    hlGrad.addColorStop(0.75, "rgba(175, 120, 255, 0.35)"); // violet fade
    hlGrad.addColorStop(1, "rgba(130, 60, 240, 0)"); // transparent
    ctx.fillStyle = hlGrad;
    ctx.fill();

    // Subtle crisp inner stroke
    ctx.strokeStyle = "rgba(255, 255, 255, 0.5)";
    ctx.lineWidth = 0.6;
    ctx.stroke();
    ctx.restore();

    // 6B. Secondary Top Highlight (crest reflection)
    ctx.save();
    traceTopHighlightPath(ctx, points, cx, cy, hShift);

    const topGrad = ctx.createLinearGradient(
      cx - 10 + hShift,
      cy - 65,
      cx + 20 + hShift,
      cy - 50
    );
    topGrad.addColorStop(0, "rgba(255, 255, 255, 0.9)");
    topGrad.addColorStop(0.5, "rgba(220, 185, 255, 0.65)");
    topGrad.addColorStop(1, "rgba(150, 80, 255, 0)");
    ctx.fillStyle = topGrad;
    ctx.fill();
    ctx.restore();

    // 6C. Right flank secondary reflection
    const p8 = points[8];
    const p7 = points[7];
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(cx + p8.x * 0.86, cy + p8.y * 0.86);
    ctx.quadraticCurveTo(
      cx + p7.x * 0.9,
      cy + (p8.y + p7.y) * 0.45,
      cx + p7.x * 0.84,
      cy + p7.y * 0.84
    );
    ctx.strokeStyle = "rgba(215, 140, 255, 0.3)";
    ctx.lineWidth = 1.4;
    ctx.stroke();
    ctx.restore();
  }

  // End clipped internal region
  ctx.restore();

  // ---------------------------------------------------------------------------
  // 7. LUMINOUS VIOLET OUTER RIM LIGHT
  // ---------------------------------------------------------------------------
  if (opts.showRim && opts.rimIntensity && opts.rimIntensity > 0) {
    const rimAlpha = opts.rimIntensity;

    ctx.save();
    // Pass 1: Soft edge glow
    traceBodyPath(ctx, segments, cx, cy);
    ctx.strokeStyle = `rgba(175, 75, 255, ${0.45 * rimAlpha})`;
    ctx.lineWidth = 2.4;
    ctx.stroke();

    // Pass 2: Crisp electric purple rim
    traceBodyPath(ctx, segments, cx, cy);
    const rimGrad = ctx.createLinearGradient(cx - 65, cy - 65, cx + 65, cy + 65);
    rimGrad.addColorStop(0, `rgba(205, 120, 255, ${0.85 * rimAlpha})`);
    rimGrad.addColorStop(0.5, `rgba(185, 80, 255, ${0.75 * rimAlpha})`);
    rimGrad.addColorStop(1, `rgba(225, 145, 255, ${0.95 * rimAlpha})`);
    ctx.strokeStyle = rimGrad;
    ctx.lineWidth = 1.1;
    ctx.stroke();

    ctx.restore();
  }

  ctx.restore();
}

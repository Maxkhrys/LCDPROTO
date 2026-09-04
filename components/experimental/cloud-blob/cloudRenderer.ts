/**
 * Procedural Cloud Blob - Volumetric Canvas 2D Renderer
 *
 * Restores the beloved, award-quality ethereal volumetric cloud material:
 * 1. Soft ambient contact grounding shadow
 * 2. Seamless multi-lobe volume blending via scaled radial gradients
 * 3. Inner volume glowing core (screen composite mode)
 * 4. Suspended luminous micro-droplets with drifting halos & specks
 * 5. Selective crest rim light accent along the crown dome
 * 6. Crisp production-calibrated procedural face (spliced directly from BlobCharacter.tsx)
 * 7. Front translucent mist veil for true depth embedding (no blur mush)
 * 8. Directional mist wisps
 */

import {
  LOBE_DEFINITIONS,
  SUSPENDED_DROPLETS,
} from "./cloudLobeSystem";
import type {
  LobeDefinition,
  LobeState,
  CloudColourConfig,
  CloudWisp,
} from "./cloudTypes";
import {
  faceAnchor,
  NEUTRAL_RIG,
  type BlobRig,
  type BlobColour,
  type ElementTransform,
  type FaceLayerId,
} from "@/lib/blobRig";

interface RenderOptions {
  size: number;
  renderScale: number;
  lobeStates: Record<string, LobeState>;
  colour: CloudColourConfig;
  wisps: CloudWisp[];
  showFace: boolean;
  rig?: BlobRig;
  faceRig?: BlobRig;
  colourName?: BlobColour;
  blobColour?: BlobColour;
  idleTime: number;
  squash: number;
  lean: number;
  gazeX?: number;
  gazeY?: number;
  faceEmbedDepth?: number;
}

const clamp = (v: number, min: number, max: number) =>
  v < min ? min : v > max ? max : v;

export function parseHexColor(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace("#", "");
  if (clean.length === 3) {
    return {
      r: parseInt(clean[0] + clean[0], 16),
      g: parseInt(clean[1] + clean[1], 16),
      b: parseInt(clean[2] + clean[2], 16),
    };
  }
  return {
    r: parseInt(clean.substring(0, 2), 16) || 216,
    g: parseInt(clean.substring(2, 4), 16) || 230,
    b: parseInt(clean.substring(4, 6), 16) || 255,
  };
}

// --- Production Face Rig Logic (from BlobCharacter.tsx) -----------------------

function eyeIrisColour(colour: BlobColour) {
  switch (colour) {
    case "teal":
      return "#54d9d4";
    case "yellow":
      return "#e4b94e";
    case "green":
      return "#79d96a";
    case "blue":
      return "#5ba6f5";
    case "red":
      return "#e55a75";
    default:
      return "#8969e8";
  }
}

function eyePalette(colour: BlobColour) {
  switch (colour) {
    case "teal":
      return {
        shade: "#06383e",
        rim: "#147d83",
        wash: "rgba(26, 207, 205, 0.42)",
        washEdge: "rgba(26, 207, 205, 0)",
      };
    case "yellow":
      return {
        shade: "#3d2c0b",
        rim: "#9b711b",
        wash: "rgba(242, 190, 55, 0.38)",
        washEdge: "rgba(242, 190, 55, 0)",
      };
    case "green":
      return {
        shade: "#123e1d",
        rim: "#348b32",
        wash: "rgba(108, 217, 75, 0.38)",
        washEdge: "rgba(108, 217, 75, 0)",
      };
    case "blue":
      return {
        shade: "#082b58",
        rim: "#1a5fb4",
        wash: "rgba(53, 132, 228, 0.40)",
        washEdge: "rgba(53, 132, 228, 0)",
      };
    case "red":
      return {
        shade: "#4b0d19",
        rim: "#a51d2d",
        wash: "rgba(224, 27, 36, 0.40)",
        washEdge: "rgba(224, 27, 36, 0)",
      };
    default:
      return {
        shade: "#1b0c42",
        rim: "#6529c5",
        wash: "rgba(127, 67, 235, 0.42)",
        washEdge: "rgba(127, 67, 235, 0)",
      };
  }
}

function ellipsePath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radiusX: number,
  radiusY: number
) {
  ctx.beginPath();
  ctx.ellipse(x, y, radiusX, radiusY, 0, 0, Math.PI * 2);
}

function eyeSocketPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number
) {
  ctx.beginPath();
  ctx.moveTo(x, y - height * 0.5);
  ctx.bezierCurveTo(
    x - width * 0.35,
    y - height * 0.52,
    x - width * 0.51,
    y - height * 0.2,
    x - width * 0.49,
    y + height * 0.16
  );
  ctx.bezierCurveTo(
    x - width * 0.47,
    y + height * 0.42,
    x - width * 0.22,
    y + height * 0.52,
    x,
    y + height * 0.5
  );
  ctx.bezierCurveTo(
    x + width * 0.28,
    y + height * 0.48,
    x + width * 0.5,
    y + height * 0.25,
    x + width * 0.47,
    y - height * 0.02
  );
  ctx.bezierCurveTo(
    x + width * 0.44,
    y - height * 0.35,
    x + width * 0.2,
    y - height * 0.5,
    x,
    y - height * 0.5
  );
  ctx.closePath();
}

function drawMouthShape(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  curve: number,
  oAmount: number,
  colour: BlobColour
) {
  const o = clamp(oAmount, 0, 1);
  const lineHalf = Math.max(0.85, height * 0.23) * (1 - o);
  const ovalHalf = Math.max(2.1, height * 0.58) * o;
  const mouthWidth = width * (1 - o * 0.36);
  const centerY = curve * height * 1.05 * (1 - o);
  const topEnd = -lineHalf;
  const bottomEnd = lineHalf;
  const topCenter = centerY - lineHalf - ovalHalf;
  const bottomCenter = centerY + lineHalf + ovalHalf;
  const halfWidth = mouthWidth / 2;
  const corner = Math.min(halfWidth * 0.2, Math.max(0.8, height * 0.18));

  ctx.beginPath();
  ctx.moveTo(-halfWidth + corner, topEnd);
  ctx.bezierCurveTo(
    -halfWidth * 0.72,
    topCenter,
    halfWidth * 0.7,
    topCenter,
    halfWidth - corner,
    topEnd
  );
  ctx.quadraticCurveTo(halfWidth, topEnd, halfWidth, topEnd + corner);
  ctx.bezierCurveTo(
    halfWidth * 0.72,
    bottomCenter,
    -halfWidth * 0.72,
    bottomCenter,
    -halfWidth + corner,
    bottomEnd
  );
  ctx.quadraticCurveTo(-halfWidth, bottomEnd, -halfWidth, bottomEnd - corner);
  ctx.closePath();

  const palette = eyePalette(colour);
  const mouthSurface = ctx.createLinearGradient(0, -height, 0, height);
  mouthSurface.addColorStop(0, "#020203");
  mouthSurface.addColorStop(0.7, "#050506");
  mouthSurface.addColorStop(1, palette.shade);
  ctx.fillStyle = mouthSurface;
  ctx.fill();

  if (o < 0.9) {
    ctx.beginPath();
    ctx.ellipse(-halfWidth, 0, lineHalf, lineHalf, 0, 0, Math.PI * 2);
    ctx.ellipse(halfWidth, 0, lineHalf, lineHalf, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawProceduralEye(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  gazeX: number,
  gazeY: number,
  colour: BlobColour,
  eyeBias: number
) {
  const palette = eyePalette(colour);
  eyeSocketPath(ctx, 0, 0, width, height);
  const surface = ctx.createLinearGradient(0, -height / 2, 0, height / 2);
  surface.addColorStop(0, "#07080a");
  surface.addColorStop(0.58, "#020304");
  surface.addColorStop(0.86, palette.shade);
  surface.addColorStop(1, palette.rim);
  ctx.fillStyle = surface;
  ctx.fill();

  const bottomWash = ctx.createRadialGradient(
    -width * 0.12,
    height * 0.32,
    0,
    -width * 0.02,
    height * 0.25,
    height * 0.75
  );
  bottomWash.addColorStop(0, palette.wash);
  bottomWash.addColorStop(0.58, palette.washEdge);
  eyeSocketPath(ctx, 0, 0, width, height);
  ctx.fillStyle = bottomWash;
  ctx.fill();

  const irisX = gazeX * 0.72 + eyeBias;
  const irisY = gazeY * 0.66;
  const irisWidth = width * 0.17;
  const irisHeight = height * 0.23;

  ellipsePath(ctx, irisX, irisY, irisWidth, irisHeight);
  const iris = ctx.createRadialGradient(
    irisX - width * 0.06,
    irisY - height * 0.1,
    width * 0.03,
    irisX,
    irisY,
    irisHeight * 1.2
  );
  iris.addColorStop(0, eyeIrisColour(colour));
  iris.addColorStop(0.55, palette.shade);
  iris.addColorStop(1, "#020304");
  ctx.fillStyle = iris;
  ctx.fill();

  ellipsePath(ctx, irisX, irisY + height * 0.012, width * 0.065, height * 0.12);
  ctx.fillStyle = "#010203";
  ctx.fill();

  ctx.save();
  ctx.translate(irisX - width * 0.045, irisY - height * 0.115);
  ctx.rotate(-0.28);
  ellipsePath(ctx, 0, 0, width * 0.12, height * 0.17);
  ctx.fillStyle = "#f3ffff";
  ctx.fill();
  ctx.restore();

  ellipsePath(
    ctx,
    irisX + width * 0.08,
    irisY + height * 0.11,
    width * 0.04,
    height * 0.052
  );
  ctx.fillStyle = "#9edbdc";
  ctx.fill();

  ellipsePath(ctx, -width * 0.16, -height * 0.28, width * 0.018, height * 0.018);
  ctx.fillStyle = "#d8ffff";
  ctx.fill();
}

// --- High-Quality Seamless Volumetric Lobe Drawing ---------------------------

function drawVolumetricLobe(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  def: LobeDefinition,
  state: LobeState,
  bodyRgb: { r: number; g: number; b: number },
  edgeRgb: { r: number; g: number; b: number },
  coreRgb: { r: number; g: number; b: number },
  translucency: number,
  softnessMult: number,
  isCore: boolean
) {
  const lx = cx + state.x;
  const ly = cy + state.y;
  const rx = def.radiusX * state.scaleX;
  const ry = def.radiusY * state.scaleY;
  const opacity = state.opacity;

  if (opacity <= 0.001 || rx <= 1 || ry <= 1) return;

  ctx.save();
  ctx.translate(lx, ly);
  ctx.rotate(state.rotation);
  ctx.scale(rx, ry);

  const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, 1.0 * def.baseSoftness * softnessMult);

  if (isCore) {
    const cAlpha = Math.min(1.0, opacity * 1.05);
    const mAlpha = opacity * 0.75 * translucency;
    const eAlpha = opacity * 0.28 * translucency;

    grad.addColorStop(0, `rgba(${coreRgb.r}, ${coreRgb.g}, ${coreRgb.b}, ${cAlpha})`);
    grad.addColorStop(0.38, `rgba(${bodyRgb.r}, ${bodyRgb.g}, ${bodyRgb.b}, ${mAlpha})`);
    grad.addColorStop(0.74, `rgba(${edgeRgb.r}, ${edgeRgb.g}, ${edgeRgb.b}, ${eAlpha})`);
    grad.addColorStop(1.0, `rgba(${edgeRgb.r}, ${edgeRgb.g}, ${edgeRgb.b}, 0)`);
  } else {
    // Outer lobes blend seamlessly with translucent feathered falloff
    const cAlpha = Math.min(0.95, opacity * 0.90);
    const mAlpha = opacity * 0.52 * translucency;
    const eAlpha = opacity * 0.20 * translucency;

    grad.addColorStop(0, `rgba(${bodyRgb.r}, ${bodyRgb.g}, ${bodyRgb.b}, ${cAlpha})`);
    grad.addColorStop(0.44, `rgba(${bodyRgb.r}, ${bodyRgb.g}, ${bodyRgb.b}, ${mAlpha})`);
    grad.addColorStop(0.76, `rgba(${edgeRgb.r}, ${edgeRgb.g}, ${edgeRgb.b}, ${eAlpha})`);
    grad.addColorStop(1.0, `rgba(${edgeRgb.r}, ${edgeRgb.g}, ${edgeRgb.b}, 0)`);
  }

  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(0, 0, 1.0 * def.baseSoftness * softnessMult, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawInnerVolumeGlow(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  coreState: LobeState,
  glowRgb: { r: number; g: number; b: number },
  intensity: number,
  idleTime: number
) {
  const pulse = 1 + Math.sin(idleTime * 1.8) * 0.05;
  const lx = cx + coreState.x;
  const ly = cy + coreState.y - 2;
  const radius = 105 * pulse;

  ctx.save();
  ctx.globalCompositeOperation = "screen";

  const grad = ctx.createRadialGradient(lx, ly, 4, lx, ly, radius);
  const alpha0 = Math.min(0.75, 0.42 * intensity);
  const alpha1 = Math.min(0.4, 0.18 * intensity);

  grad.addColorStop(0, `rgba(${glowRgb.r}, ${glowRgb.g}, ${glowRgb.b}, ${alpha0})`);
  grad.addColorStop(0.52, `rgba(${glowRgb.r}, ${glowRgb.g}, ${glowRgb.b}, ${alpha1})`);
  grad.addColorStop(1.0, `rgba(${glowRgb.r}, ${glowRgb.g}, ${glowRgb.b}, 0)`);

  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(lx, ly, radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawRimAccent(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  topState: LobeState,
  edgeRgb: { r: number; g: number; b: number }
) {
  const rx = 68 * topState.scaleX;
  const ry = 48 * topState.scaleY;
  const lx = cx + topState.x;
  const ly = cy + topState.y - 4;

  ctx.save();
  ctx.globalCompositeOperation = "screen";
  ctx.translate(lx, ly);
  ctx.rotate(topState.rotation - 0.15);

  const grad = ctx.createRadialGradient(0, -ry * 0.55, 4, 0, 0, rx);
  grad.addColorStop(0, `rgba(255, 255, 255, 0.35)`);
  grad.addColorStop(0.35, `rgba(${edgeRgb.r}, ${edgeRgb.g}, ${edgeRgb.b}, 0.18)`);
  grad.addColorStop(0.8, `rgba(${edgeRgb.r}, ${edgeRgb.g}, ${edgeRgb.b}, 0)`);

  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.ellipse(0, -ry * 0.3, rx * 0.85, ry * 0.45, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawSuspendedDroplets(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  coreState: LobeState,
  edgeRgb: { r: number; g: number; b: number },
  idleTime: number
) {
  ctx.save();
  for (const d of SUSPENDED_DROPLETS) {
    const driftX = Math.sin(idleTime * d.driftSpeed + d.driftPhase) * 3.5;
    const driftY = Math.cos(idleTime * d.driftSpeed * 0.75 + d.driftPhase) * 2.5;
    const px = cx + coreState.x + d.x + driftX;
    const py = cy + coreState.y + d.y + driftY;

    ctx.beginPath();
    ctx.arc(px, py, d.radius * 2.2, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(${edgeRgb.r}, ${edgeRgb.g}, ${edgeRgb.b}, ${d.brightness * 0.22})`;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(px, py, d.radius * 0.75, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255, 255, 255, ${d.brightness * 0.88})`;
    ctx.fill();
  }
  ctx.restore();
}

// --- Face Rendering: Sandwiched Inside Volume ---------------------------------

const FACE_ART_SURFACE_INHERIT = 0.56;

function drawSandwichedFace(
  ctx: CanvasRenderingContext2D,
  size: number,
  cx: number,
  cy: number,
  coreState: LobeState,
  activeRig: BlobRig,
  colour: BlobColour,
  bodyRgb: { r: number; g: number; b: number },
  userGazeX = 0,
  userGazeY = 0
) {
  const center = size / 2;
  const leftA = faceAnchor("leftEye", size, colour);
  const rightA = faceAnchor("rightEye", size, colour);
  const mouthA = faceAnchor("mouth", size, colour);

  const { blob, body: bt } = activeRig;

  const faceBaseX = cx + coreState.x + blob.x;
  const faceBaseY = cy + coreState.y + blob.y;
  const faceRot = (coreState.rotation * 0.85) + ((blob.rotation * Math.PI) / 180);

  ctx.save();
  ctx.translate(faceBaseX, faceBaseY);
  ctx.rotate(faceRot);
  ctx.scale(blob.scale * blob.scaleX, blob.scale * blob.scaleY);

  const faceSurfaceScaleX = 1 + (bt.scaleX - 1) * FACE_ART_SURFACE_INHERIT;
  const faceSurfaceScaleY = 1 + (bt.scaleY - 1) * FACE_ART_SURFACE_INHERIT;
  const faceCompensationX = faceSurfaceScaleX / Math.max(0.1, bt.scaleX);
  const faceCompensationY = faceSurfaceScaleY / Math.max(0.1, bt.scaleY);

  // 1. Ambient depth cavity behind face
  ctx.save();
  const cavityGrad = ctx.createRadialGradient(0, -6, 12, 0, 4, 82);
  cavityGrad.addColorStop(0, "rgba(6, 10, 22, 0.45)");
  cavityGrad.addColorStop(0.55, "rgba(8, 14, 30, 0.22)");
  cavityGrad.addColorStop(1.0, "rgba(10, 18, 40, 0)");
  ctx.fillStyle = cavityGrad;
  ctx.beginPath();
  ctx.ellipse(0, 0, 78, 62, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Subtle ambient eye wash
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  ctx.fillStyle = "rgba(140, 195, 255, 0.12)";
  ctx.beginPath();
  ctx.arc(leftA.x - center, leftA.y - center, leftA.width * 0.52, 0, Math.PI * 2);
  ctx.arc(rightA.x - center, rightA.y - center, rightA.width * 0.52, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // 2. Eyes
  const drawEyeComponent = (
    id: FaceLayerId,
    anchor: { x: number; y: number; width: number; height: number },
    t: ElementTransform,
    isLeft: boolean
  ) => {
    const socketX = anchor.x - center + t.socketX;
    const socketY = anchor.y - center + t.socketY;
    const socketScaleX = clamp(t.eyeSocketScaleX, 0.72, 1.35);
    const socketScaleY = clamp(t.eyeSocketScaleY, 0.72, 1.35);
    const socketWidth = anchor.width * socketScaleX;
    const socketHeight = anchor.height * socketScaleY;
    const open = clamp(t.eyeOpen, 0, 1);

    const visibleHeight = socketHeight * open;
    const visibleTop = -visibleHeight / 2 - socketHeight * 0.035 * (1 - open);
    const visibleBottom = visibleTop + visibleHeight;

    const gazeX = clamp(t.x + (userGazeX !== 0 ? userGazeX * 4 : 0), -socketWidth * 0.2, socketWidth * 0.2);
    const gazeY = clamp(t.y + (userGazeY !== 0 ? userGazeY * 3 : 0), -socketHeight * 0.14, socketHeight * 0.14);
    const eyeBias = isLeft ? -socketWidth * 0.012 : socketWidth * 0.012;

    if (open > 0.001) {
      ctx.save();
      ctx.globalAlpha = t.opacity;
      ctx.translate(socketX, socketY);

      eyeSocketPath(ctx, 0, 0, socketWidth, socketHeight);
      ctx.clip();
      ctx.beginPath();
      ctx.rect(-socketWidth / 2, visibleTop, socketWidth, visibleBottom - visibleTop);
      ctx.clip();

      ctx.rotate((t.rotation * Math.PI) / 180);
      drawProceduralEye(
        ctx,
        socketWidth,
        socketHeight,
        gazeX,
        gazeY,
        colour,
        eyeBias
      );
      ctx.restore();
    }

    // Soft cloud tissue eyelid cover
    const coverAmount = 1 - Math.min(1, open);
    if (coverAmount > 0.001) {
      ctx.save();
      ctx.globalAlpha = t.opacity;
      ctx.translate(socketX, socketY);

      eyeSocketPath(ctx, 0, 0, socketWidth, socketHeight);
      ctx.clip();

      ctx.beginPath();
      const coverTop = -socketHeight / 2;
      const coverBottom = socketHeight / 2;
      const topBoundary = Math.max(coverTop, visibleTop);
      const bottomBoundary = Math.min(coverBottom, visibleBottom);
      ctx.rect(-socketWidth / 2, coverTop, socketWidth, topBoundary - coverTop);
      ctx.rect(-socketWidth / 2, bottomBoundary, socketWidth, coverBottom - bottomBoundary);
      ctx.clip();

      const lidGrad = ctx.createLinearGradient(0, coverTop, 0, coverBottom);
      lidGrad.addColorStop(0, `rgba(${bodyRgb.r * 0.75}, ${bodyRgb.g * 0.75}, ${bodyRgb.b * 0.75}, 0.95)`);
      lidGrad.addColorStop(0.65, `rgba(${bodyRgb.r}, ${bodyRgb.g}, ${bodyRgb.b}, 0.88)`);
      lidGrad.addColorStop(1.0, `rgba(${bodyRgb.r * 0.85}, ${bodyRgb.g * 0.85}, ${bodyRgb.b * 0.85}, 0.80)`);
      ctx.fillStyle = lidGrad;
      ctx.fillRect(-socketWidth / 2, -socketHeight / 2, socketWidth, socketHeight);

      ctx.beginPath();
      ctx.ellipse(0, topBoundary, socketWidth * 0.44, 1.2, 0, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(15, 25, 45, 0.45)";
      ctx.fill();

      ctx.restore();
    }
  };

  // 3. Mouth
  const drawMouthComponent = (
    anchor: { x: number; y: number; width: number; height: number },
    t: ElementTransform
  ) => {
    ctx.save();
    ctx.globalAlpha = t.opacity;
    ctx.translate(anchor.x - center + t.x, anchor.y - center + t.y);
    ctx.rotate((t.rotation * Math.PI) / 180);
    ctx.scale(faceCompensationX, faceCompensationY);

    drawMouthShape(
      ctx,
      anchor.width * 0.88 * clamp(t.scaleX, 0.62, 1.18),
      anchor.height * 1.02 * clamp(t.scaleY, 0.7, 1.24),
      clamp(t.mouthCurve, -1, 1),
      clamp(t.mouthO, 0, 1),
      colour
    );
    ctx.restore();
  };

  drawEyeComponent("leftEye", leftA, activeRig.leftEye, true);
  drawEyeComponent("rightEye", rightA, activeRig.rightEye, false);
  drawMouthComponent(mouthA, activeRig.mouth);

  ctx.restore();
}

// --- Mist Wisps -------------------------------------------------------------

function drawMistWisps(
  ctx: CanvasRenderingContext2D,
  wisps: CloudWisp[],
  edgeRgb: { r: number; g: number; b: number }
) {
  ctx.save();
  ctx.globalCompositeOperation = "screen";

  for (const w of wisps) {
    if (!w.active || w.opacity <= 0.001) continue;

    const grad = ctx.createRadialGradient(w.x, w.y, 0, w.x, w.y, w.radius * w.softness);
    grad.addColorStop(0, `rgba(${edgeRgb.r}, ${edgeRgb.g}, ${edgeRgb.b}, ${w.opacity * 0.85})`);
    grad.addColorStop(0.48, `rgba(${edgeRgb.r}, ${edgeRgb.g}, ${edgeRgb.b}, ${w.opacity * 0.32})`);
    grad.addColorStop(1.0, `rgba(${edgeRgb.r}, ${edgeRgb.g}, ${edgeRgb.b}, 0)`);

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(w.x, w.y, w.radius * w.softness, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

// --- Main Render Pipeline ----------------------------------------------------

export function renderCloudBlob(
  ctx: CanvasRenderingContext2D,
  options: RenderOptions
): void {
  const {
    size,
    renderScale,
    lobeStates,
    colour,
    wisps,
    showFace,
    rig,
    faceRig,
    colourName,
    blobColour = "teal",
    idleTime,
    squash,
    lean,
    gazeX = 0,
    gazeY = 0,
    faceEmbedDepth = 0.12,
  } = options;

  ctx.save();
  ctx.scale(renderScale, renderScale);
  ctx.clearRect(0, 0, size, size);

  const cx = size / 2;
  const cy = size / 2;

  const activeColour: BlobColour = colourName || blobColour || "teal";
  const bodyRgb = parseHexColor(colour.body);
  const glowRgb = parseHexColor(colour.innerGlow);
  const edgeRgb = parseHexColor(colour.edge);
  const coreRgb = parseHexColor(colour.coreTint);

  const coreState = lobeStates.core ?? { x: 0, y: 0, vx: 0, vy: 0, scaleX: 1, scaleY: 1, opacity: 1, rotation: 0 };
  const topState = lobeStates.topCrown ?? { x: 0, y: -68, vx: 0, vy: 0, scaleX: 1, scaleY: 1, opacity: 1, rotation: 0 };

  // 1. Soft Ambient Grounding Shadow on AMOLED Black
  const groundY = cy + 134 + squash * 10;
  const shadowX = cx + coreState.x * 0.4 + lean * 0.35;
  const shadowGrad = ctx.createRadialGradient(shadowX, groundY, 14, shadowX, groundY, 130);
  shadowGrad.addColorStop(0, "rgba(2, 5, 14, 0.48)");
  shadowGrad.addColorStop(0.55, "rgba(2, 5, 14, 0.18)");
  shadowGrad.addColorStop(1.0, "rgba(0, 0, 0, 0)");
  ctx.save();
  ctx.scale(1.0, 0.32);
  ctx.fillStyle = shadowGrad;
  ctx.beginPath();
  ctx.arc(shadowX, groundY / 0.32, 130, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // 2. Render Rear Grounded Lobes (depth < 0: bottomBelly, baseLeft, baseRight)
  const rearLobes = LOBE_DEFINITIONS.filter((d) => d.depth < 0);
  for (const def of rearLobes) {
    const state = lobeStates[def.id];
    if (state) {
      drawVolumetricLobe(ctx, cx, cy, def, state, bodyRgb, edgeRgb, coreRgb, colour.translucency, 1.0, false);
    }
  }

  // 3. Render Dominant Central Core (depth = 0)
  const coreDef = LOBE_DEFINITIONS.find((d) => d.id === "core");
  if (coreDef && coreState) {
    drawVolumetricLobe(ctx, cx, cy, coreDef, coreState, bodyRgb, edgeRgb, coreRgb, colour.translucency, 1.0, true);
  }

  // 4. Inner Volume Core Glow (Luminous screen illumination)
  drawInnerVolumeGlow(ctx, cx, cy, coreState, glowRgb, colour.glowIntensity, idleTime);

  // 5. Suspended Luminous Micro-Droplets
  drawSuspendedDroplets(ctx, cx, cy, coreState, edgeRgb, idleTime);

  // 6. Render Mid-Front Lobes (depth > 0 && depth < 10: leftCheek, rightCheek, topCrown)
  const midLobes = LOBE_DEFINITIONS.filter((d) => d.depth > 0 && d.depth < 10);
  for (const def of midLobes) {
    const state = lobeStates[def.id];
    if (state) {
      drawVolumetricLobe(ctx, cx, cy, def, state, bodyRgb, edgeRgb, coreRgb, colour.translucency, 1.0, false);
    }
  }

  // 7. Selective Crest Rim Light Accent along Dome Crown
  drawRimAccent(ctx, cx, cy, topState, edgeRgb);

  // 8. Crisp Production Face Layer
  const activeRig = rig || faceRig || NEUTRAL_RIG;
  if (showFace) {
    drawSandwichedFace(
      ctx,
      size,
      cx,
      cy,
      coreState,
      activeRig,
      activeColour,
      bodyRgb,
      gazeX,
      gazeY
    );
  }

  // 9. Front Translucent Mist Veil (depth = 10)
  const veilDef = LOBE_DEFINITIONS.find((d) => d.id === "frontVeil");
  const veilState = lobeStates.frontVeil;
  if (veilDef && veilState && faceEmbedDepth > 0.01) {
    const adjustedVeil = {
      ...veilState,
      opacity: veilState.opacity * (faceEmbedDepth / 0.12),
    };
    drawVolumetricLobe(ctx, cx, cy, veilDef, adjustedVeil, bodyRgb, edgeRgb, coreRgb, 1.0, 1.0, false);
  }

  // 10. Trailing Mist Wisps
  drawMistWisps(ctx, wisps, edgeRgb);

  ctx.restore();
}

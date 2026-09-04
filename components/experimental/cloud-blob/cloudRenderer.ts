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
  LOBE_SUB_PUFFS,
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
  fluffiness?: number;
  lightAngle?: number;
  cheekBlush?: number;
  cloudBrows?: boolean;
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

// --- High-Quality Fluffy Volumetric Cumulus Lobe Drawing --------------------

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
  isCore: boolean,
  fluffiness = 1.2,
  lightAngle = -45,
  idleTime = 0
) {
  const lx = cx + state.x;
  const ly = cy + state.y;
  const rx = def.radiusX * state.scaleX;
  const ry = def.radiusY * state.scaleY;
  const opacity = state.opacity;

  if (opacity <= 0.001 || rx <= 1 || ry <= 1) return;

  const lightRad = (lightAngle * Math.PI) / 180;
  const lightDirX = Math.cos(lightRad);
  const lightDirY = Math.sin(lightRad);

  // Helper to draw a single volumetric puff stamp with directional key lighting
  const drawPuffStamp = (
    px: number,
    py: number,
    prx: number,
    pry: number,
    rot: number,
    opac: number,
    softness: number,
    coreBlend: boolean,
    isSubPuff: boolean
  ) => {
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(rot);
    ctx.scale(prx, pry);

    // Shift gradient focal center toward light source for realistic 3D volume
    const focalShift = isSubPuff ? 0.30 : 0.22;
    const fx = lightDirX * focalShift;
    const fy = lightDirY * focalShift;
    const outerRadius = 1.0 * softness;

    const grad = ctx.createRadialGradient(fx, fy, 0.04, 0, 0, outerRadius);

    if (coreBlend) {
      const cAlpha = Math.min(1.0, opac * 1.06);
      const mAlpha = opac * 0.74 * translucency;
      const eAlpha = opac * 0.26 * translucency;

      grad.addColorStop(0, `rgba(${Math.min(255, coreRgb.r + 30)}, ${Math.min(255, coreRgb.g + 30)}, ${Math.min(255, coreRgb.b + 35)}, ${cAlpha})`);
      grad.addColorStop(0.38, `rgba(${bodyRgb.r}, ${bodyRgb.g}, ${bodyRgb.b}, ${mAlpha})`);
      grad.addColorStop(0.74, `rgba(${edgeRgb.r}, ${edgeRgb.g}, ${edgeRgb.b}, ${eAlpha})`);
      grad.addColorStop(1.0, `rgba(${edgeRgb.r}, ${edgeRgb.g}, ${edgeRgb.b}, 0)`);
    } else {
      // Outer billowy lobes: bright sunlit crest with translucent feathered falloff
      const cAlpha = Math.min(0.96, opac * (isSubPuff ? 0.84 : 0.90));
      const mAlpha = opac * (isSubPuff ? 0.46 : 0.52) * translucency;
      const eAlpha = opac * (isSubPuff ? 0.16 : 0.20) * translucency;

      const crestR = Math.min(255, edgeRgb.r + (isSubPuff ? 18 : 12));
      const crestG = Math.min(255, edgeRgb.g + (isSubPuff ? 18 : 12));
      const crestB = Math.min(255, edgeRgb.b + (isSubPuff ? 18 : 12));

      grad.addColorStop(0, `rgba(${crestR}, ${crestG}, ${crestB}, ${cAlpha})`);
      grad.addColorStop(0.42, `rgba(${bodyRgb.r}, ${bodyRgb.g}, ${bodyRgb.b}, ${mAlpha})`);
      grad.addColorStop(0.76, `rgba(${edgeRgb.r}, ${edgeRgb.g}, ${edgeRgb.b}, ${eAlpha})`);
      grad.addColorStop(1.0, `rgba(${edgeRgb.r}, ${edgeRgb.g}, ${edgeRgb.b}, 0)`);
    }

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, outerRadius, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  };

  // 1. Draw sub-puffs around perimeter to create rich, fluffy cumulus billows
  const subPuffs = LOBE_SUB_PUFFS[def.id];
  if (subPuffs && fluffiness > 0.05) {
    for (const sub of subPuffs) {
      const breathWobble = Math.sin(idleTime * 2.2 + (sub.phaseOffset ?? 0)) * 2.0 * fluffiness;
      const spx = lx + (sub.offsetX * fluffiness + breathWobble * lightDirX) * state.scaleX;
      const spy = ly + (sub.offsetY * fluffiness + breathWobble * lightDirY) * state.scaleY;
      const sprx = rx * sub.radiusRatio * (1 + breathWobble * 0.015);
      const spry = ry * sub.radiusRatio * (1 + breathWobble * 0.015);
      const subOpacity = opacity * (0.86 + Math.min(0.14, fluffiness * 0.08));

      drawPuffStamp(
        spx,
        spy,
        sprx,
        spry,
        state.rotation + (sub.phaseOffset ?? 0) * 0.08,
        subOpacity,
        (sub.softnessMult ?? def.baseSoftness) * softnessMult,
        false,
        true
      );
    }
  }

  // 2. Draw Primary Lobe Mass
  drawPuffStamp(
    lx,
    ly,
    rx,
    ry,
    state.rotation,
    opacity,
    def.baseSoftness * softnessMult,
    isCore,
    false
  );
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
  const radius = 108 * pulse;

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
  edgeRgb: { r: number; g: number; b: number },
  lightAngle = -45
) {
  const lightRad = (lightAngle * Math.PI) / 180;
  const rx = 72 * topState.scaleX;
  const ry = 50 * topState.scaleY;
  const lx = cx + topState.x + Math.cos(lightRad) * 6;
  const ly = cy + topState.y + Math.sin(lightRad) * 6;

  ctx.save();
  ctx.globalCompositeOperation = "screen";
  ctx.translate(lx, ly);
  ctx.rotate(topState.rotation + (lightAngle + 90) * 0.005);

  const grad = ctx.createRadialGradient(0, -ry * 0.52, 3, 0, 0, rx);
  grad.addColorStop(0, `rgba(255, 255, 255, 0.45)`);
  grad.addColorStop(0.35, `rgba(${edgeRgb.r}, ${edgeRgb.g}, ${edgeRgb.b}, 0.22)`);
  grad.addColorStop(0.8, `rgba(${edgeRgb.r}, ${edgeRgb.g}, ${edgeRgb.b}, 0)`);

  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.ellipse(0, -ry * 0.28, rx * 0.88, ry * 0.46, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawCheekBlush(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  leftCheek: LobeState | undefined,
  rightCheek: LobeState | undefined,
  intensity: number
) {
  if (intensity <= 0.01) return;

  const alpha = Math.min(0.48, 0.40 * intensity);
  const drawBlushSpot = (x: number, y: number, rot: number) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    const grad = ctx.createRadialGradient(0, 0, 2, 0, 0, 38);
    grad.addColorStop(0, `rgba(255, 145, 175, ${alpha})`);
    grad.addColorStop(0.48, `rgba(255, 170, 195, ${alpha * 0.42})`);
    grad.addColorStop(1.0, "rgba(255, 190, 210, 0)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(0, 0, 36, 24, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };

  if (leftCheek) {
    drawBlushSpot(cx + leftCheek.x + 8, cy + leftCheek.y + 12, leftCheek.rotation);
  }
  if (rightCheek) {
    drawBlushSpot(cx + rightCheek.x - 8, cy + rightCheek.y + 12, rightCheek.rotation);
  }
}

function drawEyePillows(
  ctx: CanvasRenderingContext2D,
  center: number,
  leftA: { x: number; y: number; width: number; height: number },
  rightA: { x: number; y: number; width: number; height: number },
  activeRig: BlobRig,
  edgeRgb: { r: number; g: number; b: number }
) {
  const drawPillow = (
    anchor: { x: number; y: number; width: number; height: number },
    t: ElementTransform
  ) => {
    const socketX = anchor.x - center + t.socketX;
    const socketY = anchor.y - center + t.socketY;
    const sw = anchor.width * clamp(t.eyeSocketScaleX, 0.8, 1.25);
    const sh = anchor.height * clamp(t.eyeSocketScaleY, 0.8, 1.25);

    ctx.save();
    ctx.translate(socketX, socketY + 4);
    const grad = ctx.createRadialGradient(0, sh * 0.32, 2, 0, 0, sw * 0.82);
    grad.addColorStop(0, `rgba(255, 255, 255, 0.32)`);
    grad.addColorStop(0.48, `rgba(${edgeRgb.r}, ${edgeRgb.g}, ${edgeRgb.b}, 0.16)`);
    grad.addColorStop(1.0, `rgba(${edgeRgb.r}, ${edgeRgb.g}, ${edgeRgb.b}, 0)`);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(0, sh * 0.20, sw * 0.76, sh * 0.50, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };

  drawPillow(leftA, activeRig.leftEye);
  drawPillow(rightA, activeRig.rightEye);
}

function drawCloudBrows(
  ctx: CanvasRenderingContext2D,
  center: number,
  leftA: { x: number; y: number; width: number; height: number },
  rightA: { x: number; y: number; width: number; height: number },
  activeRig: BlobRig,
  edgeRgb: { r: number; g: number; b: number },
  bodyRgb: { r: number; g: number; b: number }
) {
  const { leftEye: lt, rightEye: rt } = activeRig;

  const drawBrow = (
    anchor: { x: number; y: number; width: number; height: number },
    t: ElementTransform,
    isLeft: boolean
  ) => {
    const browLift = t.browLift * anchor.height * 0.35;
    const browRot = (t.browRotation * Math.PI) / 180 + (isLeft ? -0.06 : 0.06);
    const browX = anchor.x - center + t.socketX + (isLeft ? -anchor.width * 0.04 : anchor.width * 0.04);
    const browY = anchor.y - center + t.socketY - anchor.height * 0.56 - browLift;
    const bw = anchor.width * 0.44 * clamp(t.eyeSocketScaleX, 0.8, 1.25);
    const bh = anchor.height * 0.22 * clamp(t.eyeSocketScaleY, 0.8, 1.25);

    ctx.save();
    ctx.translate(browX, browY);
    ctx.rotate(browRot);

    // Main wispy brow puff
    const grad = ctx.createRadialGradient(-bw * 0.15, -bh * 0.2, 0, 0, 0, bw * 0.95);
    grad.addColorStop(0, `rgba(255, 255, 255, 0.88)`);
    grad.addColorStop(0.45, `rgba(${edgeRgb.r}, ${edgeRgb.g}, ${edgeRgb.b}, 0.55)`);
    grad.addColorStop(0.8, `rgba(${bodyRgb.r}, ${bodyRgb.g}, ${bodyRgb.b}, 0.20)`);
    grad.addColorStop(1.0, `rgba(${edgeRgb.r}, ${edgeRgb.g}, ${edgeRgb.b}, 0)`);

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(0, 0, bw, bh, 0, 0, Math.PI * 2);
    ctx.fill();

    // Outer corner micro-tuft
    const tuftX = isLeft ? -bw * 0.62 : bw * 0.62;
    const tuftY = -bh * 0.12;
    const tGrad = ctx.createRadialGradient(tuftX, tuftY, 0, tuftX, tuftY, bw * 0.5);
    tGrad.addColorStop(0, "rgba(255, 255, 255, 0.75)");
    tGrad.addColorStop(0.5, `rgba(${edgeRgb.r}, ${edgeRgb.g}, ${edgeRgb.b}, 0.35)`);
    tGrad.addColorStop(1.0, "rgba(255, 255, 255, 0)");
    ctx.fillStyle = tGrad;
    ctx.beginPath();
    ctx.ellipse(tuftX, tuftY, bw * 0.42, bh * 0.72, isLeft ? -0.2 : 0.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  };

  drawBrow(leftA, lt, true);
  drawBrow(rightA, rt, false);
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
  edgeRgb: { r: number; g: number; b: number },
  userGazeX = 0,
  userGazeY = 0,
  cloudBrows = true
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

  // Soft fluffy cloud pillows nestling the eye sockets into the volume
  drawEyePillows(ctx, center, leftA, rightA, activeRig, edgeRgb);

  // Wispy cloud brows floating above sockets
  if (cloudBrows) {
    drawCloudBrows(ctx, center, leftA, rightA, activeRig, edgeRgb, bodyRgb);
  }

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
    fluffiness = 1.25,
    lightAngle = -45,
    cheekBlush = 0,
    cloudBrows = true,
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
      drawVolumetricLobe(ctx, cx, cy, def, state, bodyRgb, edgeRgb, coreRgb, colour.translucency, 1.0, false, fluffiness, lightAngle, idleTime);
    }
  }

  // 3. Render Dominant Central Core (depth = 0)
  const coreDef = LOBE_DEFINITIONS.find((d) => d.id === "core");
  if (coreDef && coreState) {
    drawVolumetricLobe(ctx, cx, cy, coreDef, coreState, bodyRgb, edgeRgb, coreRgb, colour.translucency, 1.0, true, fluffiness * 0.8, lightAngle, idleTime);
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
      drawVolumetricLobe(ctx, cx, cy, def, state, bodyRgb, edgeRgb, coreRgb, colour.translucency, 1.0, false, fluffiness, lightAngle, idleTime);
    }
  }

  // 7. Soft Bioluminescent Cheek Blush
  drawCheekBlush(ctx, cx, cy, lobeStates.leftCheek, lobeStates.rightCheek, cheekBlush);

  // 8. Selective Crest Rim Light Accent along Dome Crown
  drawRimAccent(ctx, cx, cy, topState, edgeRgb, lightAngle);

  // 9. Crisp Production Face Layer
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
      edgeRgb,
      gazeX,
      gazeY,
      cloudBrows
    );
  }

  // 10. Front Translucent Mist Veil (depth = 10)
  const veilDef = LOBE_DEFINITIONS.find((d) => d.id === "frontVeil");
  const veilState = lobeStates.frontVeil;
  if (veilDef && veilState && faceEmbedDepth > 0.01) {
    const adjustedVeil = {
      ...veilState,
      opacity: veilState.opacity * (faceEmbedDepth / 0.12),
    };
    drawVolumetricLobe(ctx, cx, cy, veilDef, adjustedVeil, bodyRgb, edgeRgb, coreRgb, 1.0, 1.0, false, fluffiness * 0.6, lightAngle, idleTime);
  }

  // 11. Trailing Mist Wisps
  drawMistWisps(ctx, wisps, edgeRgb);

  ctx.restore();
}

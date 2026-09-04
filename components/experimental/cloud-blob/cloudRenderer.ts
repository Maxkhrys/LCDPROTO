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
  NEUTRAL_RIG,
  BODY_FRACTION,
  type BlobRig,
  type BlobColour,
} from "@/lib/blobRig";
import { drawBlobFace } from "@/components/blob/BlobCharacter";

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
  sandBounce?: number;
  clear?: boolean;
  skipTransform?: boolean;
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
  fluffiness = 1.0,
  lightAngle = -125,
  idleTime = 0,
  sandBounce = 0.65
) {
  const lx = cx + state.x;
  const ly = cy + state.y;
  const rx = def.radiusX * state.scaleX;
  const ry = def.radiusY * state.scaleY;
  const opacity = state.opacity;

  if (opacity <= 0.001 || rx <= 1 || ry <= 1) return;

  // Directional key light: soft warm-white sunlit highlight from top / top-left (-125°)
  const lightRad = (lightAngle * Math.PI) / 180;
  const lightDirX = Math.cos(lightRad);
  const lightDirY = Math.sin(lightRad);

  // Helper to draw a solid, volumetric cumulus billow stamp
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

    const outerRadius = 1.0 * softness;

    // 1. Primary Solid Cumulus Mass: Pure creamy white body with tight soft anti-alias
    // Light focal center shifted toward key light (-125°)
    const fx = lightDirX * 0.28;
    const fy = lightDirY * 0.28;
    const baseGrad = ctx.createRadialGradient(fx, fy, 0.05, 0, 0, outerRadius);

    // Pure brilliant white at sunlit crest
    baseGrad.addColorStop(0.0, `rgba(255, 255, 255, ${Math.min(1.0, opac)})`);
    // Rich, solid creamy white body
    baseGrad.addColorStop(0.55, `rgba(${bodyRgb.r}, ${bodyRgb.g}, ${bodyRgb.b}, ${Math.min(1.0, opac)})`);
    // Remains 95% solid white almost all the way to the edge!
    baseGrad.addColorStop(0.86, `rgba(${bodyRgb.r}, ${bodyRgb.g}, ${bodyRgb.b}, ${Math.min(1.0, opac * 0.96)})`);
    // Tight 4-6px soft anti-aliased edge (NO 40px muddy brown haze!)
    baseGrad.addColorStop(0.96, `rgba(${bodyRgb.r}, ${bodyRgb.g}, ${bodyRgb.b}, ${opac * 0.40})`);
    baseGrad.addColorStop(1.0, `rgba(${bodyRgb.r}, ${bodyRgb.g}, ${bodyRgb.b}, 0)`);

    ctx.fillStyle = baseGrad;
    ctx.beginPath();
    ctx.arc(0, 0, outerRadius, 0, Math.PI * 2);
    ctx.fill();

    // 2. Directional Underside 3D Depth Pillow:
    // Placed off-center at the bottom-right (away from key light), fading out before reaching the outer edge
    const shadowAlpha = isSubPuff
      ? 0.14 * opac
      : coreBlend
      ? 0.08 * opac
      : def.depth < 0
      ? 0.38 * opac
      : def.depth === 1
      ? 0.22 * opac
      : 0.12 * opac; // Crown

    if (shadowAlpha > 0.02) {
      const shx = -lightDirX * 0.28 * outerRadius;
      const shy = -lightDirY * 0.28 * outerRadius;
      const shRadius = outerRadius * 0.68;

      const shadowGrad = ctx.createRadialGradient(shx, shy, 0.02, shx, shy, shRadius);
      shadowGrad.addColorStop(0.0, `rgba(${coreRgb.r}, ${coreRgb.g}, ${coreRgb.b}, ${shadowAlpha})`);
      shadowGrad.addColorStop(0.50, `rgba(${coreRgb.r}, ${coreRgb.g}, ${coreRgb.b}, ${shadowAlpha * 0.45})`);
      shadowGrad.addColorStop(1.0, `rgba(${coreRgb.r}, ${coreRgb.g}, ${coreRgb.b}, 0)`);

      ctx.fillStyle = shadowGrad;
      ctx.beginPath();
      ctx.arc(shx, shy, shRadius, 0, Math.PI * 2);
      ctx.fill();
    }

    // 3. Warm Ground Reflected Light on underside base
    if (!isSubPuff && def.depth < 0 && sandBounce > 0.05) {
      const bounceAlpha = opac * 0.24 * sandBounce;
      const bounceGrad = ctx.createLinearGradient(0, outerRadius * 0.96, 0, -outerRadius * 0.1);
      bounceGrad.addColorStop(0.0, `rgba(238, 210, 180, ${bounceAlpha})`);
      bounceGrad.addColorStop(0.42, `rgba(238, 210, 180, ${bounceAlpha * 0.35})`);
      bounceGrad.addColorStop(1.0, "rgba(238, 210, 180, 0)");

      ctx.fillStyle = bounceGrad;
      ctx.beginPath();
      ctx.arc(0, 0, outerRadius * 0.96, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  };

  // 1. Draw sub-puffs around perimeter to create subtle secondary transitions
  const subPuffs = LOBE_SUB_PUFFS[def.id];
  if (subPuffs && fluffiness > 0.05) {
    for (const sub of subPuffs) {
      const breathWobble = Math.sin(idleTime * 2.0 + (sub.phaseOffset ?? 0)) * 1.4 * fluffiness;
      const spx = lx + (sub.offsetX * fluffiness + breathWobble * lightDirX) * state.scaleX;
      const spy = ly + (sub.offsetY * fluffiness + breathWobble * lightDirY) * state.scaleY;
      const sprx = rx * sub.radiusRatio * (1 + breathWobble * 0.010);
      const spry = ry * sub.radiusRatio * (1 + breathWobble * 0.010);
      const subOpacity = opacity * (0.90 + Math.min(0.10, fluffiness * 0.05));

      drawPuffStamp(
        spx,
        spy,
        sprx,
        spry,
        state.rotation + (sub.phaseOffset ?? 0) * 0.06,
        subOpacity,
        (sub.softnessMult ?? def.baseSoftness) * softnessMult,
        false,
        true
      );
    }
  }

  // 2. Draw Primary Lobe Mass (Solid & sculpted)
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
  if (intensity <= 0.01) return;
  const pulse = 1 + Math.sin(idleTime * 1.6) * 0.04;
  const lx = cx + coreState.x;
  const ly = cy + coreState.y - 2;
  const radius = 95 * pulse;

  // Gentle internal subsurface scattering warmth - NO blown-out screen mode!
  ctx.save();
  const grad = ctx.createRadialGradient(lx - 10, ly - 14, 4, lx, ly, radius);
  const alpha0 = Math.min(0.08, 0.07 * intensity);
  const alpha1 = Math.min(0.03, 0.025 * intensity);

  grad.addColorStop(0, `rgba(255, 250, 240, ${alpha0})`);
  grad.addColorStop(0.48, `rgba(${glowRgb.r}, ${glowRgb.g}, ${glowRgb.b}, ${alpha1})`);
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
  lightAngle = -125
) {
  const lightRad = (lightAngle * Math.PI) / 180;
  const rx = 80 * topState.scaleX;
  const ry = 56 * topState.scaleY;
  const lx = cx + topState.x + Math.cos(lightRad) * 6;
  const ly = cy + topState.y + Math.sin(lightRad) * 6;

  ctx.save();
  ctx.translate(lx, ly);
  ctx.rotate(topState.rotation + 0.02);

  const grad = ctx.createRadialGradient(
    Math.cos(lightRad) * 8,
    -ry * 0.50 + Math.sin(lightRad) * 4,
    2,
    0,
    -ry * 0.18,
    rx * 0.95
  );
  grad.addColorStop(0, "rgba(255, 253, 248, 0.28)");
  grad.addColorStop(0.38, `rgba(${edgeRgb.r}, ${edgeRgb.g}, ${edgeRgb.b}, 0.12)`);
  grad.addColorStop(0.75, `rgba(${edgeRgb.r}, ${edgeRgb.g}, ${edgeRgb.b}, 0.02)`);
  grad.addColorStop(1.0, "rgba(255, 255, 255, 0)");

  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.ellipse(0, -ry * 0.32, rx * 0.88, ry * 0.44, 0, 0, Math.PI * 2);
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

  const alpha = Math.min(0.35, 0.30 * intensity);
  const drawBlushSpot = (x: number, y: number, rot: number) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    const grad = ctx.createRadialGradient(0, 0, 2, 0, 0, 36);
    grad.addColorStop(0, `rgba(255, 155, 168, ${alpha})`);
    grad.addColorStop(0.50, `rgba(255, 175, 185, ${alpha * 0.38})`);
    grad.addColorStop(1.0, "rgba(255, 190, 200, 0)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(0, 0, 34, 22, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };

  if (leftCheek) {
    drawBlushSpot(cx + leftCheek.x + 8, cy + leftCheek.y + 10, leftCheek.rotation);
  }
  if (rightCheek) {
    drawBlushSpot(cx + rightCheek.x - 8, cy + rightCheek.y + 10, rightCheek.rotation);
  }
}

function drawFaceRestingCradle(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  coreState: LobeState,
  bodyRgb: { r: number; g: number; b: number }
) {
  // Calm, smooth, creamy-white front cushion that cradles the facial features.
  // Smooths out bumpy billow seams directly behind eyes and mouth,
  // providing a pure, high-contrast, luminous resting plane.
  const fx = cx + coreState.x;
  const fy = cy + coreState.y - 1;
  ctx.save();
  const cradleGrad = ctx.createRadialGradient(fx, fy - 4, 6, fx, fy, 78);
  cradleGrad.addColorStop(0.0, "rgba(255, 255, 255, 0.95)");
  cradleGrad.addColorStop(0.55, `rgba(${bodyRgb.r}, ${bodyRgb.g}, ${bodyRgb.b}, 0.85)`);
  cradleGrad.addColorStop(1.0, `rgba(${bodyRgb.r}, ${bodyRgb.g}, ${bodyRgb.b}, 0)`);
  ctx.fillStyle = cradleGrad;
  ctx.beginPath();
  ctx.ellipse(fx, fy, 86, 56, 0, 0, Math.PI * 2);
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
  const dropletCount = SUSPENDED_DROPLETS.length;

  for (let i = 0; i < dropletCount; i++) {
    const d = SUSPENDED_DROPLETS[i];
    let px: number;
    let py: number;
    let alpha: number;

    if (i % 3 === 0) {
      // 1. Convection updraft motes rising through warm central core
      const riseSpeed = 0.05 * d.driftSpeed;
      const progress = ((idleTime * riseSpeed + d.driftPhase * 0.25) % 1 + 1) % 1;
      const laneX = d.x * 0.65 + Math.sin(idleTime * 0.35 + d.driftPhase) * 8;
      const spanY = 50 - progress * 105;

      px = cx + coreState.x + laneX;
      py = cy + coreState.y + spanY;

      const verticalFade = Math.sin(progress * Math.PI);
      alpha = d.brightness * verticalFade * 0.65;
    } else {
      // 2. Slow gentle circulation
      const dir = i % 2 === 0 ? 1 : -1;
      const angVel = (0.14 + (d.driftSpeed - 0.7) * 0.08) * dir;
      const homeDist = Math.hypot(d.x, d.y) * 0.92;
      const homeAngle = Math.atan2(d.y, d.x);
      const currentAngle = homeAngle + idleTime * angVel;

      const breathWobble = Math.sin(idleTime * 0.4 + d.driftPhase) * 4;
      const orbRadius = homeDist + breathWobble;

      const lx = Math.cos(currentAngle) * (orbRadius * 1.10);
      const ly = Math.sin(currentAngle) * (orbRadius * 0.85);

      px = cx + coreState.x + lx;
      py = cy + coreState.y + ly;

      const currentDist = Math.hypot(lx, ly);
      const edgeFade = clamp((88 - currentDist) / 24, 0, 1);
      alpha = d.brightness * edgeFade * 0.60;
    }

    if (alpha <= 0.015) continue;

    // Soft, diffuse atmospheric vapor mote (NO pinpoint bright star core)
    const moteRadius = Math.max(1.8, d.radius * 2.2);
    const moteGrad = ctx.createRadialGradient(px, py, 0, px, py, moteRadius);
    moteGrad.addColorStop(0, `rgba(245, 248, 255, ${alpha * 0.55})`);
    moteGrad.addColorStop(0.55, `rgba(${edgeRgb.r}, ${edgeRgb.g}, ${edgeRgb.b}, ${alpha * 0.22})`);
    moteGrad.addColorStop(1.0, `rgba(${edgeRgb.r}, ${edgeRgb.g}, ${edgeRgb.b}, 0)`);

    ctx.fillStyle = moteGrad;
    ctx.beginPath();
    ctx.arc(px, py, moteRadius, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// --- Face Rendering: Sandwiched Inside Volume ---------------------------------

function drawSandwichedFace(
  ctx: CanvasRenderingContext2D,
  size: number,
  cx: number,
  cy: number,
  coreState: LobeState,
  activeRig: BlobRig,
  colour: BlobColour
) {
  const { blob } = activeRig;
  const faceBaseX = cx + coreState.x + blob.x;
  const faceBaseY = cy + coreState.y + blob.y;
  const faceRot = (coreState.rotation * 0.85) + ((blob.rotation * Math.PI) / 180);

  ctx.save();
  ctx.translate(faceBaseX, faceBaseY);
  ctx.rotate(faceRot);
  ctx.scale(blob.scale * blob.scaleX, blob.scale * blob.scaleY);
  ctx.translate(-faceBaseX, -faceBaseY);

  drawBlobFace(ctx, {
    size,
    centre: cx,
    colour,
    rig: activeRig,
    body: {
      ...activeRig.body,
      x: coreState.x,
      y: coreState.y,
      rotation: 0,
      skewX: 0,
      skewY: 0,
      deformAngle: 0,
      scaleX: 1,
      scaleY: 1,
    },
    bodyWidth: size * BODY_FRACTION,
    bodyHeight: size * BODY_FRACTION,
    faceVisibility: 1,
    showPupils: false,
    settingsOpen: false,
  });

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
    faceEmbedDepth = 0.12,
    fluffiness = 1.0,
    lightAngle = -125,
    cheekBlush = 0,
    sandBounce = 0.65,
    clear = true,
    skipTransform = false,
  } = options;

  ctx.save();
  if (!skipTransform) {
    ctx.scale(renderScale, renderScale);
  }
  if (clear) {
    ctx.clearRect(0, 0, size, size);
  }

  const cx = size / 2;
  const cy = size / 2;

  const activeColour: BlobColour = colourName || blobColour || "teal";
  const bodyRgb = parseHexColor(colour.body);
  const glowRgb = parseHexColor(colour.innerGlow);
  const edgeRgb = parseHexColor(colour.edge);
  const coreRgb = parseHexColor(colour.coreTint);

  const coreState = lobeStates.core ?? { x: 0, y: 0, vx: 0, vy: 0, scaleX: 1, scaleY: 1, opacity: 1, rotation: 0 };
  const topState = lobeStates.topCrown ?? { x: 0, y: -76, vx: 0, vy: 0, scaleX: 1, scaleY: 1, opacity: 1, rotation: 0 };

  // 1. Soft Ambient Grounding Shadow on AMOLED Black (squash widening & height softening)
  const groundY = cy + 134 + squash * 10;
  const shadowX = cx + coreState.x * 0.4 + lean * 0.35;
  const shadowRadius = 130 * (1 + squash * 0.25 - (coreState.y < 0 ? Math.min(0.2, -coreState.y / 200) : 0));
  const shadowAlpha = Math.max(0.08, 0.22 * (1 - Math.max(0, -coreState.y) / 120));
  const shadowGrad = ctx.createRadialGradient(shadowX, groundY, 10, shadowX, groundY, shadowRadius);
  shadowGrad.addColorStop(0, `rgba(10, 18, 38, ${shadowAlpha})`);
  shadowGrad.addColorStop(0.55, `rgba(10, 18, 38, ${shadowAlpha * 0.38})`);
  shadowGrad.addColorStop(1.0, "rgba(0, 0, 0, 0)");
  ctx.save();
  ctx.scale(1.0, 0.28);
  ctx.fillStyle = shadowGrad;
  ctx.beginPath();
  ctx.arc(shadowX, groundY / 0.28, shadowRadius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // 2. Render Rear Grounded Lobes (depth < 0: bottomBelly, baseLeft, baseRight, trailingTuft)
  const rearLobes = LOBE_DEFINITIONS.filter((d) => d.depth < 0);
  for (const def of rearLobes) {
    const state = lobeStates[def.id];
    if (state) {
      drawVolumetricLobe(ctx, cx, cy, def, state, bodyRgb, edgeRgb, coreRgb, colour.translucency, 1.0, false, fluffiness, lightAngle, idleTime, sandBounce);
    }
  }

  // 3. Subtle Interior Sculptural Crevice between rear base and core
  const creviceGrad = ctx.createRadialGradient(
    cx + coreState.x,
    cy + coreState.y + 28,
    4,
    cx + coreState.x,
    cy + coreState.y + 28,
    72
  );
  creviceGrad.addColorStop(0, `rgba(${coreRgb.r}, ${coreRgb.g}, ${coreRgb.b}, 0.16)`);
  creviceGrad.addColorStop(0.55, `rgba(${coreRgb.r}, ${coreRgb.g}, ${coreRgb.b}, 0.04)`);
  creviceGrad.addColorStop(1.0, "rgba(0, 0, 0, 0)");
  ctx.save();
  ctx.fillStyle = creviceGrad;
  ctx.beginPath();
  ctx.ellipse(cx + coreState.x, cy + coreState.y + 28, 80, 36, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // 4. Render Dominant Central Core (depth = 0)
  const coreDef = LOBE_DEFINITIONS.find((d) => d.id === "core");
  if (coreDef && coreState) {
    drawVolumetricLobe(ctx, cx, cy, coreDef, coreState, bodyRgb, edgeRgb, coreRgb, colour.translucency, 1.0, true, fluffiness * 0.75, lightAngle, idleTime, sandBounce);
  }

  // 5. Render Mid-Front Lobes (depth > 0 && depth < 10: leftCheek, rightCheek, trailingTuft, topCrown)
  const midLobes = LOBE_DEFINITIONS.filter((d) => d.depth > 0 && d.depth < 10);
  for (const def of midLobes) {
    const state = lobeStates[def.id];
    if (state) {
      drawVolumetricLobe(ctx, cx, cy, def, state, bodyRgb, edgeRgb, coreRgb, colour.translucency, 1.0, false, fluffiness, lightAngle, idleTime, sandBounce);
    }
  }

  // 6. Sculptural Overhang Shadow: Crown dome overhangs the central core
  const crownOverhangGrad = ctx.createRadialGradient(
    cx + topState.x,
    cy + topState.y + 44,
    4,
    cx + topState.x,
    cy + topState.y + 44,
    64
  );
  crownOverhangGrad.addColorStop(0.0, `rgba(${coreRgb.r}, ${coreRgb.g}, ${coreRgb.b}, 0.18)`);
  crownOverhangGrad.addColorStop(0.55, `rgba(${coreRgb.r}, ${coreRgb.g}, ${coreRgb.b}, 0.04)`);
  crownOverhangGrad.addColorStop(1.0, "rgba(0, 0, 0, 0)");
  ctx.save();
  ctx.fillStyle = crownOverhangGrad;
  ctx.beginPath();
  ctx.ellipse(cx + topState.x, cy + topState.y + 44, 76, 18, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // 7. Subtle internal subsurface warmth (faint, atmospheric warmth deep inside)
  drawInnerVolumeGlow(ctx, cx, cy, coreState, glowRgb, colour.glowIntensity, idleTime);

  // 8. Suspended Atmospheric Vapor Motes (sparse, soft, non-sparkling)
  drawSuspendedDroplets(ctx, cx, cy, coreState, edgeRgb, idleTime);

  // 9. Soft Internal Cheek Blush (warm coral/peach vapor tint deep in cheek masses)
  drawCheekBlush(ctx, cx, cy, lobeStates.leftCheek, lobeStates.rightCheek, cheekBlush);

  // 10. Calm Face Resting Cradle (creamy-white luminous cushion smoothing seams behind eyes)
  drawFaceRestingCradle(ctx, cx, cy, coreState, bodyRgb);

  // 11. Selective Crest Rim Light Accent along Dome Crown
  drawRimAccent(ctx, cx, cy, topState, edgeRgb, lightAngle);

  // 12. Crisp Production Face Layer
  const activeRig = rig || faceRig || NEUTRAL_RIG;
  if (showFace) {
    drawSandwichedFace(
      ctx,
      size,
      cx,
      cy,
      coreState,
      activeRig,
      activeColour
    );
  }

  // 13. Front Translucent Mist Veil (depth = 10)
  const veilDef = LOBE_DEFINITIONS.find((d) => d.id === "frontVeil");
  const veilState = lobeStates.frontVeil;
  if (veilDef && veilState && faceEmbedDepth > 0.01) {
    const adjustedVeil = {
      ...veilState,
      opacity: Math.min(0.05, veilState.opacity * (faceEmbedDepth / 0.12)),
    };
    drawVolumetricLobe(ctx, cx, cy, veilDef, adjustedVeil, bodyRgb, edgeRgb, coreRgb, 1.0, 1.0, false, fluffiness * 0.5, lightAngle, idleTime, 0);
  }

  // 14. Trailing Mist Wisps
  drawMistWisps(ctx, wisps, edgeRgb);

  ctx.restore();
}

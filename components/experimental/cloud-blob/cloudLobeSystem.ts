/**
 * Procedural Cloud Blob - Multi-Lobe Soft-Body & Physics Engine
 *
 * Implements an intentional 7-lobe volumetric character silhouette with:
 * - Dominant central core with dense, darker mass
 * - Distinct sculpted top crown (clear dome head)
 * - Fuller pear-shaped lower mass and asymmetric cheeks
 * - Second-order damped harmonic springs with per-lobe lag hierarchy
 * - Asynchronous, out-of-sync breathing cycles
 * - Deterministic suspended droplets
 * - Parametric deformations (squash, stretch, lean, puff, bulges, sag)
 */

import {
  type LobeDefinition,
  type LobeState,
  type CloudDeformationParams,
  type CloudMotionConfig,
  type CloudColourConfig,
  type SuspendedDroplet,
  type CloudPresetName,
} from "./cloudTypes";

export const DEFAULT_DEFORMATION: CloudDeformationParams = {
  scale: 1,
  scaleX: 1,
  scaleY: 1,
  rotation: 0,
  x: 0,
  y: 0,
  squash: 0,
  stretch: 0,
  lean: 0,
  puff: 0.10, // Subtle natural fluff
  leftBulge: 0,
  rightBulge: 0,
  topBulge: 8, // Taller proud dome crown
  bottomSag: 6, // Broad, flatter grounded lower shelf
  coreDensity: 1.10,
  lobeSoftness: 0.98, // Readable, clean billow contours (not blurry soup)
  faceEmbedDepth: 0.08, // Face calmly seated in volume cradle
  fluffiness: 1.05, // Coherent cumulus billow clusters
  lightAngle: -50, // Directional top-left sunlit cumulus
  cheekBlush: 0, // Default ZERO blush
  cloudBrows: true,
  sandBounce: 0.65, // Restrained warm sand bounce on lower underside
  billowContrast: 1.05, // Subtle sculptural 3D separation
  gazeX: 0,
  gazeY: 0,
};

export const DEFAULT_MOTION_CONFIG: CloudMotionConfig = {
  floatAmount: 3.5,
  driftAmount: 1.8,
  wobbleAmount: 0,
  lobeLag: 0.95,
  springStiffness: 145,
  springDamping: 15.0,
};

export const DEFAULT_COLOUR: CloudColourConfig = {
  body: "#f2f5fd", // Creamy cumulus white with subtle warm-sun daylight tone
  innerGlow: "#d4e0fa", // Soft atmospheric sky fill (NOT neon glow)
  edge: "#ffffff", // Crisp sunlit rim highlight
  coreTint: "#90a2c8", // Sculptural cool blue-grey interior depth & ambient occlusion
  glowIntensity: 0.12, // Extremely restrained internal warmth (no bloom ball)
  density: 1.05, // Solid, sculptural cumulus volume
  translucency: 0.88,
};

export const COLOUR_PRESETS: Record<string, CloudColourConfig> = {
  "Disney Cumulus": DEFAULT_COLOUR,
  "Golden Hour": {
    body: "#fff6ea",
    innerGlow: "#fde2b4",
    edge: "#ffffff",
    coreTint: "#b48858",
    glowIntensity: 0.15,
    density: 1.05,
    translucency: 0.86,
  },
  "Twilight Mist": {
    body: "#e8e2fa",
    innerGlow: "#b9a8f2",
    edge: "#f8f5ff",
    coreTint: "#66529c",
    glowIntensity: 0.15,
    density: 1.02,
    translucency: 0.85,
  },
  "Emerald Vapor": {
    body: "#e6faf2",
    innerGlow: "#a8ebd0",
    edge: "#fafffc",
    coreTint: "#4e8c75",
    glowIntensity: 0.12,
    density: 1.02,
    translucency: 0.85,
  },
  "Storm Puff": {
    body: "#d2d8e4",
    innerGlow: "#a6b4cc",
    edge: "#eef3fc",
    coreTint: "#525e76",
    glowIntensity: 0.10,
    density: 1.12,
    translucency: 0.82,
  },
  "Blush Dawn": {
    body: "#fdf0f4",
    innerGlow: "#fcccd8",
    edge: "#ffffff",
    coreTint: "#9e6576",
    glowIntensity: 0.14,
    density: 1.04,
    translucency: 0.86,
  },
};

/**
 * 7 Primary Cumulus Billows + 1 Trailing Tuft + 1 Front Veil.
 * Authored for 466x466 AMOLED screen space.
 * Establishes an iconic Disney/Pixar cumulus silhouette:
 * - Dominant tall crown dome (asymmetrical, slightly left)
 * - Upper-left and upper-right framing shoulders of different heights
 * - Broad central face resting plane
 * - Broad, flatter lower-left and lower-right shelves
 * - Wide grounding belly
 * - One cute asymmetrical trailing wind tuft
 */
export const LOBE_DEFINITIONS: readonly LobeDefinition[] = [
  // 1. REAR BASE LOBES (depth = -2 to -1): Broad, flatter lower shelves
  {
    id: "bottomBelly",
    name: "Broad Lower Grounding Shelf",
    baseX: -4,
    baseY: 78,
    radiusX: 112,
    radiusY: 46, // Broad, flatter foundation
    baseOpacity: 0.92,
    baseSoftness: 1.08,
    lagFactor: 0.88,
    stiffness: 95,
    damping: 11.0,
    breathPhase: 4.2,
    breathAmp: 0.038,
    depth: -2,
    circPhase: 5.4,
  },
  {
    id: "baseLeft",
    name: "Lower-Left Cumulus Shelf",
    baseX: -82,
    baseY: 56,
    radiusX: 94,
    radiusY: 62,
    baseOpacity: 0.92,
    baseSoftness: 1.05,
    lagFactor: 0.72,
    stiffness: 110,
    damping: 12.0,
    breathPhase: 3.14,
    breathAmp: 0.038,
    depth: -1,
    circPhase: 6.2,
  },
  {
    id: "baseRight",
    name: "Lower-Right Asymmetric Shelf",
    baseX: 76,
    baseY: 48,
    radiusX: 86,
    radiusY: 58,
    baseOpacity: 0.90,
    baseSoftness: 1.02,
    lagFactor: 0.76,
    stiffness: 105,
    damping: 12.0,
    breathPhase: 3.8,
    breathAmp: 0.036,
    depth: -1,
    circPhase: 4.6,
  },

  // 2. CENTRAL CORE (depth = 0): Broad calm face cradle mass
  {
    id: "core",
    name: "Central Face Cradle Mass",
    baseX: 0,
    baseY: 6,
    radiusX: 104,
    radiusY: 88,
    baseOpacity: 0.98,
    baseSoftness: 0.92,
    lagFactor: 0.08,
    stiffness: 240,
    damping: 20.0,
    breathPhase: 0.0,
    breathAmp: 0.024,
    depth: 0,
    circPhase: 2.0,
  },

  // 3. MID LOBES (depth = 1): Sculpted asymmetric shoulders framing face
  {
    id: "leftCheek",
    name: "Upper-Left Shoulder Billow",
    baseX: -82,
    baseY: -18,
    radiusX: 68,
    radiusY: 60,
    baseOpacity: 0.90,
    baseSoftness: 1.02,
    lagFactor: 0.48,
    stiffness: 135,
    damping: 13.0,
    breathPhase: 1.2,
    breathAmp: 0.038,
    depth: 1,
    circPhase: 0.0,
  },
  {
    id: "rightCheek",
    name: "Upper-Right Shoulder",
    baseX: 76,
    baseY: -26, // Asymmetrical height vs left
    radiusX: 62,
    radiusY: 54,
    baseOpacity: 0.88,
    baseSoftness: 1.00,
    lagFactor: 0.52,
    stiffness: 130,
    damping: 13.0,
    breathPhase: 1.8,
    breathAmp: 0.036,
    depth: 1,
    circPhase: 3.0,
  },
  {
    id: "trailingTuft",
    name: "Trailing Wind Tuft",
    baseX: 118,
    baseY: 24,
    radiusX: 36,
    radiusY: 30,
    baseOpacity: 0.78,
    baseSoftness: 1.15,
    lagFactor: 0.82, // Lags behind on drag
    stiffness: 90,
    damping: 10.0,
    breathPhase: 2.6,
    breathAmp: 0.048,
    depth: 1,
    circPhase: 3.8,
  },

  // 4. TOP CROWN (depth = 2): Taller, proud dome silhouette
  {
    id: "topCrown",
    name: "Dominant Dome Crown",
    baseX: -6,
    baseY: -76, // Taller crown
    radiusX: 86,
    radiusY: 64, // Dominant mass
    baseOpacity: 0.94,
    baseSoftness: 0.98,
    lagFactor: 0.38,
    stiffness: 155,
    damping: 15.0,
    breathPhase: 0.7,
    breathAmp: 0.040,
    depth: 2,
    circPhase: 1.0,
  },

  // 5. FRONT VEIL (depth = 10): Translucent mist veil
  {
    id: "frontVeil",
    name: "Front Translucent Mist Veil",
    baseX: 0,
    baseY: 10,
    radiusX: 80,
    radiusY: 64,
    baseOpacity: 0.10,
    baseSoftness: 1.25,
    lagFactor: 0.24,
    stiffness: 180,
    damping: 16.5,
    breathPhase: 0.4,
    breathAmp: 0.020,
    depth: 10,
    circPhase: 1.8,
  },
];

export interface LobeSubPuff {
  offsetX: number;
  offsetY: number;
  radiusRatio: number;
  softnessMult?: number;
  phaseOffset?: number;
}

/**
 * Sculpted secondary transition puffs.
 * Restrained to 11 key billow ridges (rather than noisy circular perimeter clusters)
 * preserving 75-80% of each primary billow's clean, readable contour.
 */
export const LOBE_SUB_PUFFS: Partial<Record<string, readonly LobeSubPuff[]>> = {
  topCrown: [
    { offsetX: -28, offsetY: -22, radiusRatio: 0.50, phaseOffset: 0.3 }, // Upper-left dome crest
    { offsetX: 32, offsetY: -16, radiusRatio: 0.44, phaseOffset: 1.1 }, // Upper-right dome crest
  ],
  leftCheek: [
    { offsetX: -32, offsetY: 14, radiusRatio: 0.46, phaseOffset: 0.6 },
    { offsetX: -24, offsetY: -20, radiusRatio: 0.40, phaseOffset: 1.4 },
  ],
  rightCheek: [
    { offsetX: 28, offsetY: 16, radiusRatio: 0.45, phaseOffset: 2.1 },
  ],
  baseLeft: [
    { offsetX: -36, offsetY: 18, radiusRatio: 0.44, phaseOffset: 1.8 },
  ],
  baseRight: [
    { offsetX: 32, offsetY: 16, radiusRatio: 0.42, phaseOffset: 2.6 },
  ],
  bottomBelly: [
    { offsetX: -36, offsetY: 14, radiusRatio: 0.42, phaseOffset: 1.2 },
    { offsetX: 38, offsetY: 12, radiusRatio: 0.40, phaseOffset: 2.8 },
  ],
  trailingTuft: [
    { offsetX: 16, offsetY: -6, radiusRatio: 0.45, phaseOffset: 0.8 },
  ],
  core: [
    { offsetX: 0, offsetY: 28, radiusRatio: 0.40, phaseOffset: 1.6 },
  ],
};

/**
 * 6 Sparse, low-contrast diffuse vapor motes.
 * Replaces previous bright star/fairy-light look with subtle atmospheric motes
 * visible primarily when drifting across darker internal volume pockets.
 */
export const SUSPENDED_DROPLETS: readonly SuspendedDroplet[] = [
  { x: -34, y: 18, radius: 2.2, brightness: 0.32, driftPhase: 0.4, driftSpeed: 0.75 },
  { x: 38, y: -16, radius: 1.8, brightness: 0.26, driftPhase: 1.8, driftSpeed: 0.65 },
  { x: -16, y: 46, radius: 2.4, brightness: 0.30, driftPhase: 3.2, driftSpeed: 0.80 },
  { x: 42, y: 34, radius: 2.0, brightness: 0.24, driftPhase: 4.6, driftSpeed: 0.70 },
  { x: -8, y: -38, radius: 2.1, brightness: 0.28, driftPhase: 1.1, driftSpeed: 0.60 },
  { x: 18, y: 16, radius: 1.9, brightness: 0.25, driftPhase: 5.2, driftSpeed: 0.72 },
];

export function createLobeStates(): Record<string, LobeState> {
  const states: Record<string, LobeState> = {};
  for (const def of LOBE_DEFINITIONS) {
    states[def.id] = {
      x: def.baseX,
      y: def.baseY,
      vx: 0,
      vy: 0,
      scaleX: 1,
      scaleY: 1,
      opacity: def.baseOpacity,
      rotation: 0,
    };
  }
  return states;
}

export function computeLobeTarget(
  def: LobeDefinition,
  params: CloudDeformationParams,
  motion: CloudMotionConfig,
  characterVx: number,
  characterVy: number,
  idleTime: number,
  characterOffsetX = 0,
  characterOffsetY = 0
): {
  targetX: number;
  targetY: number;
  targetScaleX: number;
  targetScaleY: number;
  targetOpacity: number;
  targetRotation: number;
} {
  const puff = params.puff;
  const squash = params.squash;
  const stretch = params.stretch;
  const lean = params.lean;

  let tx = def.baseX;
  let ty = def.baseY;

  // 1. Procedural Traveling Wind Field & Shape Migration:
  // Sequential wave circulating through lobes (leftCheek -> topCrown -> core -> rightCheek -> trailingTuft -> base/belly)
  const circPhase = def.circPhase ?? def.breathPhase;
  const circWave = Math.sin(idleTime * 0.85 - circPhase);
  // Keep primary lobes stable (max 1.2-1.8px displacement, 1.5-2.5% scale)
  const isCore = def.id === "core";
  const circScale = 1 + circWave * (isCore ? 0.015 : 0.025);
  const migX = Math.cos(idleTime * 0.85 - circPhase) * (isCore ? 0.6 : 1.6);
  const migY = Math.sin(idleTime * 0.85 - circPhase) * (isCore ? 0.5 : 1.3);
  const convection = Math.sin(idleTime * 0.38 + def.breathPhase) * 0.9;
  tx += migX;
  ty += migY - convection;

  // 2. Out-of-sync gentle idle breathing
  const breathCycle = Math.sin(idleTime * 1.3 + def.breathPhase) * def.breathAmp;
  const breathScale = circScale * (1 + breathCycle);

  // 3. Squash & Stretch
  if (squash > 0) {
    if (def.id === "topCrown") {
      ty += squash * 24; // Dome compresses downwards
    } else if (def.id === "baseLeft") {
      tx -= squash * 18; // Base spreads outwards
      ty += squash * 8;
    } else if (def.id === "baseRight") {
      tx += squash * 18;
      ty += squash * 8;
    } else if (def.id === "bottomBelly") {
      ty += squash * 12; // Belly presses into ground
    } else if (def.id === "leftCheek" || def.id === "rightCheek") {
      tx += (def.id === "leftCheek" ? -1 : 1) * squash * 12;
      ty += squash * 10;
    } else if (def.id === "trailingTuft") {
      tx += squash * 10;
      ty += squash * 8;
    }
  }

  if (stretch > 0) {
    if (def.id === "topCrown") {
      ty -= stretch * 30; // Dome shoots upward
    } else if (def.id === "bottomBelly") {
      ty -= stretch * 10; // Belly lifts
    } else if (def.id === "baseLeft" || def.id === "baseRight") {
      tx *= 1 - stretch * 0.16; // Narrows horizontally
    } else if (def.id === "leftCheek" || def.id === "rightCheek") {
      tx *= 1 - stretch * 0.14;
      ty -= stretch * 16;
    } else if (def.id === "trailingTuft") {
      tx *= 1 - stretch * 0.12;
      ty -= stretch * 14;
    }
  }

  // 4. Lean effect: sheared displacement & asymmetric compression
  if (Math.abs(lean) > 0.001) {
    const leanRatio = lean / 30;
    if (def.id === "topCrown") {
      tx += leanRatio * 28;
      ty += Math.abs(leanRatio) * 4;
    } else if (def.id === "leftCheek" || def.id === "rightCheek") {
      tx += leanRatio * 20;
    } else if (def.id === "baseLeft") {
      tx += leanRatio > 0 ? -leanRatio * 8 : leanRatio * 16;
    } else if (def.id === "baseRight") {
      tx += leanRatio < 0 ? -leanRatio * 8 : leanRatio * 16;
    } else if (def.id === "trailingTuft") {
      tx += leanRatio * 22;
    }
  }

  // 5. Local bulges & sag
  if (def.id === "baseLeft" || def.id === "leftCheek") {
    tx -= params.leftBulge;
  }
  if (def.id === "baseRight" || def.id === "rightCheek") {
    tx += params.rightBulge;
  }
  if (def.id === "topCrown") {
    ty -= params.topBulge;
  }
  if (def.id === "bottomBelly") {
    ty += params.bottomSag;
  }

  // 6. Harmonic wobble
  if (motion.wobbleAmount > 0) {
    const wobblePhase = idleTime * 5.0 + def.breathPhase;
    const wobbleDist = Math.sin(wobblePhase) * motion.wobbleAmount * 6;
    tx += wobbleDist;
  }

  // 7. CRITICAL LOBE LAG HIERARCHY:
  // Face leads -> core follows (lag 0.08) -> crown & cheeks follow (0.42 - 0.56) -> base & belly lag (0.74 - 0.88)
  const lagStrength = def.lagFactor * motion.lobeLag * 0.09;
  const maxLobeOffset = def.radiusX * 0.48;
  const rawLagX = characterVx * lagStrength;
  const rawLagY = characterVy * lagStrength;
  tx -= Math.max(-maxLobeOffset, Math.min(maxLobeOffset, rawLagX));
  ty -= Math.max(-maxLobeOffset, Math.min(maxLobeOffset, rawLagY));

  // 8. Scale computation
  let sx = breathScale * (1 + puff * 0.3);
  let sy = breathScale * (1 + puff * 0.3);

  if (squash > 0) {
    sx *= 1 + squash * 0.30;
    sy *= 1 - squash * 0.24;
  }
  if (stretch > 0) {
    sx *= 1 - stretch * 0.20;
    sy *= 1 + stretch * 0.36;
  }

  let rot = (lean * 0.38 * (1 - def.lagFactor * 0.45) * Math.PI) / 180;

  // 9. CIRCULAR AMOLED BOUNDARY COLLISION & SOFT-BODY BUNCHING:
  // Native AMOLED R=233. Safe boundary limit R=222 leaves outer mist feathering room.
  const worldX = characterOffsetX + tx;
  const worldY = characterOffsetY + ty;
  const worldDist = Math.hypot(worldX, worldY);
  if (worldDist > 1e-4) {
    const normX = worldX / worldDist;
    const normY = worldY / worldDist;
    const relAngle = Math.atan2(worldY, worldX) - rot;
    const cosA = Math.cos(relAngle);
    const sinA = Math.sin(relAngle);
    const effectiveRadius = Math.sqrt(
      (def.radiusX * sx * cosA) ** 2 + (def.radiusY * sy * sinA) ** 2
    );
    const outerRadius = effectiveRadius * 1.15; // Include sub-puff perimeter billows
    const boundaryLimit = 222;

    if (worldDist + outerRadius > boundaryLimit) {
      const penetration = worldDist + outerRadius - boundaryLimit;
      const pushAmount = penetration * 0.76;
      tx -= normX * pushAmount;
      ty -= normY * pushAmount;

      const compression = Math.min(0.65, Math.max(0, penetration / (outerRadius * 0.65)));
      // Radial flattening normal & tangential volume bunching
      const radialFactor = 1 - compression * 0.44;
      const tangentialFactor = 1 + compression * 0.34;
      const normX2 = normX * normX;
      const normY2 = normY * normY;
      sx *= (radialFactor * normX2 + tangentialFactor * normY2);
      sy *= (radialFactor * normY2 + tangentialFactor * normX2);

      // Subtle rim alignment torque along AMOLED circular glass curvature
      const rimTangentAngle = Math.atan2(normY, normX) + Math.PI / 2;
      rot += Math.sin(rimTangentAngle - rot) * compression * 0.28;
    }
  }

  // Dynamic opacity modulation with circulation wave
  let opacity = def.baseOpacity * (1 - puff * 0.12) * (1 + circWave * 0.028);
  if (def.id === "frontVeil") {
    opacity = def.baseOpacity * (params.faceEmbedDepth / 0.14);
  }

  return {
    targetX: tx,
    targetY: ty,
    targetScaleX: sx,
    targetScaleY: sy,
    targetOpacity: opacity,
    targetRotation: rot,
  };
}

export function stepLobePhysics(
  lobeStates: Record<string, LobeState>,
  params: CloudDeformationParams,
  motion: CloudMotionConfig,
  characterVx: number,
  characterVy: number,
  idleTime: number,
  dt: number,
  characterOffsetX = 0,
  characterOffsetY = 0
): void {
  const clampedDt = Math.min(dt, 0.05);

  for (const def of LOBE_DEFINITIONS) {
    const state = lobeStates[def.id];
    if (!state) continue;

    const {
      targetX,
      targetY,
      targetScaleX,
      targetScaleY,
      targetOpacity,
      targetRotation,
    } = computeLobeTarget(
      def,
      params,
      motion,
      characterVx,
      characterVy,
      idleTime,
      characterOffsetX,
      characterOffsetY
    );

    const stiffness = def.stiffness * (motion.springStiffness / 145);
    const damping = def.damping * (motion.springDamping / 14.5);

    // X axis spring
    const fx = -stiffness * (state.x - targetX) - damping * state.vx;
    state.vx += fx * clampedDt;
    state.x += state.vx * clampedDt;

    // Y axis spring
    const fy = -stiffness * (state.y - targetY) - damping * state.vy;
    state.vy += fy * clampedDt;
    state.y += state.vy * clampedDt;

    // Smooth relaxation
    const rate = 14 * clampedDt;
    state.scaleX += (targetScaleX - state.scaleX) * rate;
    state.scaleY += (targetScaleY - state.scaleY) * rate;
    state.opacity += (targetOpacity - state.opacity) * rate;
    state.rotation += (targetRotation - state.rotation) * rate;
  }
}

export const PRESETS: Record<CloudPresetName, Partial<CloudDeformationParams>> = {
  NEUTRAL: {
    scale: 1,
    scaleX: 1,
    scaleY: 1,
    rotation: 0,
    x: 0,
    y: 0,
    squash: 0,
    stretch: 0,
    lean: 0,
    puff: 0.10,
    leftBulge: 0,
    rightBulge: 0,
    topBulge: 8,
    bottomSag: 6,
    coreDensity: 1.10,
    lobeSoftness: 0.98,
    faceEmbedDepth: 0.08,
    fluffiness: 1.05,
    lightAngle: -50,
    cheekBlush: 0,
    sandBounce: 0.65,
    billowContrast: 1.05,
    gazeX: 0,
    gazeY: 0,
  },
  PUFF: {
    puff: 0.65,
    squash: 0,
    stretch: 0,
    lean: 0,
    scale: 1.10,
    coreDensity: 0.9,
    lobeSoftness: 1.3,
  },
  SQUASH: {
    squash: 0.8,
    stretch: 0,
    lean: 0,
    puff: 0.08,
    bottomSag: 18,
    leftBulge: 20,
    rightBulge: 20,
    topBulge: -16,
    y: 8,
  },
  STRETCH: {
    stretch: 0.85,
    squash: 0,
    lean: 0,
    puff: -0.08,
    topBulge: 26,
    leftBulge: -14,
    rightBulge: -14,
    bottomSag: -10,
    y: -14,
  },
  "LEAN LEFT": {
    lean: -28,
    squash: 0.15,
    stretch: 0,
    leftBulge: 14,
    rightBulge: -8,
    rotation: -4,
    x: -12,
    gazeX: -0.6,
  },
  "LEAN RIGHT": {
    lean: 28,
    squash: 0.15,
    stretch: 0,
    rightBulge: 14,
    leftBulge: -8,
    rotation: 4,
    x: 12,
    gazeX: 0.6,
  },
  "SOFT WOBBLE": {
    squash: 0.2,
    stretch: 0,
    lean: 8,
    puff: 0.15,
  },
  "DRIFT LEFT": {
    x: -36,
    lean: -18,
    scaleX: 1.05,
    scaleY: 0.95,
    gazeX: -0.8,
  },
  "DRIFT RIGHT": {
    x: 36,
    lean: 18,
    scaleX: 1.05,
    scaleY: 0.95,
    gazeX: 0.8,
  },
  "MIST TRAIL": {
    lean: 22,
    puff: 0.35,
    squash: 0.2,
    x: 24,
    gazeX: 0.5,
  },
  SETTLE: {
    squash: 0.9,
    bottomSag: 22,
    leftBulge: 24,
    rightBulge: 24,
    topBulge: -18,
    y: 12,
    gazeY: 0.3,
  },
  "SLEEPY FLATTEN": {
    squash: 0.55,
    scaleY: 0.82,
    scaleX: 1.15,
    bottomSag: 14,
    puff: -0.15,
    coreDensity: 1.0,
    y: 16,
    gazeY: 0.5,
  },
  "EXCITED PUFF": {
    puff: 0.75,
    stretch: 0.3,
    topBulge: 18,
    scale: 1.18,
    y: -18,
    coreDensity: 1.25,
    gazeY: -0.3,
  },
};

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
  puff: 0,
  leftBulge: 0,
  rightBulge: 0,
  topBulge: 0,
  bottomSag: 0,
  coreDensity: 1.15,
  lobeSoftness: 1.0,
  faceEmbedDepth: 0.12,
  fluffiness: 1.25,
  lightAngle: -45,
  cheekBlush: 0,
  cloudBrows: true,
  gazeX: 0,
  gazeY: 0,
};

export const DEFAULT_MOTION_CONFIG: CloudMotionConfig = {
  floatAmount: 4.5,
  driftAmount: 2.5,
  wobbleAmount: 0,
  lobeLag: 1.0,
  springStiffness: 145,
  springDamping: 14.5,
};

export const DEFAULT_COLOUR: CloudColourConfig = {
  body: "#d8e6ff", // soft cool blue-violet mist
  innerGlow: "#7b94ff", // luminous periwinkle inner glow
  edge: "#eaf3ff", // ethereal pale cyan rim
  coreTint: "#627cb5", // darker dense inner core
  glowIntensity: 1.0,
  density: 0.95,
  translucency: 0.82,
};

export const COLOUR_PRESETS: Record<string, CloudColourConfig> = {
  "Cool Mist": DEFAULT_COLOUR,
  "Purple Void": {
    body: "#c4a5ff",
    innerGlow: "#8d42ff",
    edge: "#f0e6ff",
    coreTint: "#542c8e",
    glowIntensity: 1.15,
    density: 0.98,
    translucency: 0.8,
  },
  "Baby Blue": {
    body: "#bce8ff",
    innerGlow: "#36a3f7",
    edge: "#eaf6ff",
    coreTint: "#3b6d9e",
    glowIntensity: 1.05,
    density: 0.92,
    translucency: 0.85,
  },
  "Emerald Vapor": {
    body: "#baf5db",
    innerGlow: "#18b584",
    edge: "#e8fff5",
    coreTint: "#227056",
    glowIntensity: 1.0,
    density: 0.94,
    translucency: 0.82,
  },
  "Blush Rose": {
    body: "#ffd0e2",
    innerGlow: "#f54897",
    edge: "#fff2f7",
    coreTint: "#9c3866",
    glowIntensity: 1.1,
    density: 0.94,
    translucency: 0.82,
  },
  "Golden Dawn": {
    body: "#ffe5b8",
    innerGlow: "#f58814",
    edge: "#fffbe8",
    coreTint: "#94581e",
    glowIntensity: 1.1,
    density: 0.95,
    translucency: 0.82,
  },
};

/**
 * 7 Character-forming lobes + 1 front veil.
 * Authored for 466x466 AMOLED screen space.
 * Establishes a recognizable pear-shaped character silhouette with a rounded crown.
 */
export const LOBE_DEFINITIONS: readonly LobeDefinition[] = [
  // 1. REAR BASE LOBES (depth = -1): Solid, wide lower mass
  {
    id: "bottomBelly",
    name: "Bottom Center Belly",
    baseX: 0,
    baseY: 76,
    radiusX: 90,
    radiusY: 52,
    baseOpacity: 0.90,
    baseSoftness: 1.25,
    lagFactor: 0.88, // Heaviest mass, settles last
    stiffness: 95,
    damping: 11.0,
    breathPhase: 4.2,
    breathAmp: 0.048,
    depth: -2,
    circPhase: 4.1, // Convective return along base
  },
  {
    id: "baseLeft",
    name: "Lower Left Base",
    baseX: -72,
    baseY: 52,
    radiusX: 86,
    radiusY: 66,
    baseOpacity: 0.92,
    baseSoftness: 1.2,
    lagFactor: 0.74,
    stiffness: 110,
    damping: 12.0,
    breathPhase: 3.14,
    breathAmp: 0.042,
    depth: -1,
    circPhase: 5.1, // Completes convective cycle back to left cheek
  },
  {
    id: "baseRight",
    name: "Lower Right Base",
    baseX: 70,
    baseY: 54,
    radiusX: 84,
    radiusY: 64,
    baseOpacity: 0.90,
    baseSoftness: 1.2,
    lagFactor: 0.76,
    stiffness: 105,
    damping: 12.0,
    breathPhase: 3.8,
    breathAmp: 0.040,
    depth: -1,
    circPhase: 3.2, // Receives downdraft from right cheek
  },

  // 2. CENTRAL CORE (depth = 0): Dominant mass, holds character anchor
  {
    id: "core",
    name: "Central Cloud Core",
    baseX: 0,
    baseY: 4,
    radiusX: 94,
    radiusY: 82,
    baseOpacity: 0.98,
    baseSoftness: 0.95,
    lagFactor: 0.08, // Leads character motion right after face
    stiffness: 240,
    damping: 20.0,
    breathPhase: 0.0,
    breathAmp: 0.030,
    depth: 0,
    circPhase: 1.4, // Core swells as wave travels across
  },

  // 3. MID LOBES (depth = 1): Sculpted cheeks flanking eyes
  {
    id: "leftCheek",
    name: "Volumetric Left Cheek",
    baseX: -76,
    baseY: -8,
    radiusX: 70,
    radiusY: 62,
    baseOpacity: 0.86,
    baseSoftness: 1.15,
    lagFactor: 0.52,
    stiffness: 135,
    damping: 13.0,
    breathPhase: 1.2,
    breathAmp: 0.044,
    depth: 1,
    circPhase: 0.0, // Initial puff in sequence (left cheek puffs first)
  },
  {
    id: "rightCheek",
    name: "Asymmetric Right Cheek",
    baseX: 74,
    baseY: -12,
    radiusX: 66,
    radiusY: 58,
    baseOpacity: 0.84,
    baseSoftness: 1.15,
    lagFactor: 0.56,
    stiffness: 130,
    damping: 13.0,
    breathPhase: 1.8,
    breathAmp: 0.040,
    depth: 1,
    circPhase: 2.2, // Right cheek puffs following core
  },

  // 4. TOP CROWN (depth = 2): Friendly dome silhouette
  {
    id: "topCrown",
    name: "Top Head Crown",
    baseX: -2,
    baseY: -68,
    radiusX: 76,
    radiusY: 54,
    baseOpacity: 0.90,
    baseSoftness: 1.10,
    lagFactor: 0.42,
    stiffness: 155,
    damping: 15.0,
    breathPhase: 0.7,
    breathAmp: 0.046,
    depth: 2,
    circPhase: 0.7, // Crown catches ascending updraft
  },

  // 5. FRONT VEIL (depth = 10): Translucent mist over cheeks and lower socket edges
  {
    id: "frontVeil",
    name: "Front Translucent Mist Veil",
    baseX: 0,
    baseY: 8,
    radiusX: 76,
    radiusY: 62,
    baseOpacity: 0.14,
    baseSoftness: 1.40,
    lagFactor: 0.26,
    stiffness: 180,
    damping: 16.5,
    breathPhase: 0.4,
    breathAmp: 0.025,
    depth: 10,
    circPhase: 1.6,
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
 * Organic cumulus sub-puff billow clusters for each lobe.
 * Generates natural fluffy cauliflower-like cloud ridges along each lobe perimeter.
 */
export const LOBE_SUB_PUFFS: Partial<Record<string, readonly LobeSubPuff[]>> = {
  topCrown: [
    { offsetX: 0, offsetY: -20, radiusRatio: 0.64, phaseOffset: 0.2 },
    { offsetX: -36, offsetY: -10, radiusRatio: 0.55, phaseOffset: 0.7 },
    { offsetX: 35, offsetY: -8, radiusRatio: 0.52, phaseOffset: 1.1 },
    { offsetX: -16, offsetY: -26, radiusRatio: 0.42, phaseOffset: 1.6 },
    { offsetX: 18, offsetY: -24, radiusRatio: 0.44, phaseOffset: 2.0 },
  ],
  leftCheek: [
    { offsetX: -32, offsetY: 2, radiusRatio: 0.58, phaseOffset: 0.4 },
    { offsetX: -22, offsetY: -22, radiusRatio: 0.50, phaseOffset: 1.2 },
    { offsetX: -20, offsetY: 26, radiusRatio: 0.52, phaseOffset: 1.9 },
    { offsetX: -40, offsetY: 14, radiusRatio: 0.40, phaseOffset: 2.7 },
  ],
  rightCheek: [
    { offsetX: 30, offsetY: 0, radiusRatio: 0.56, phaseOffset: 0.6 },
    { offsetX: 22, offsetY: -20, radiusRatio: 0.48, phaseOffset: 1.4 },
    { offsetX: 18, offsetY: 24, radiusRatio: 0.50, phaseOffset: 2.1 },
    { offsetX: 38, offsetY: 12, radiusRatio: 0.38, phaseOffset: 2.9 },
  ],
  baseLeft: [
    { offsetX: -34, offsetY: 16, radiusRatio: 0.54, phaseOffset: 0.8 },
    { offsetX: -14, offsetY: 28, radiusRatio: 0.50, phaseOffset: 1.7 },
    { offsetX: -44, offsetY: -2, radiusRatio: 0.44, phaseOffset: 2.5 },
  ],
  baseRight: [
    { offsetX: 32, offsetY: 14, radiusRatio: 0.52, phaseOffset: 1.0 },
    { offsetX: 12, offsetY: 28, radiusRatio: 0.48, phaseOffset: 1.9 },
    { offsetX: 42, offsetY: -4, radiusRatio: 0.42, phaseOffset: 2.8 },
  ],
  bottomBelly: [
    { offsetX: 0, offsetY: 22, radiusRatio: 0.58, phaseOffset: 0.3 },
    { offsetX: -38, offsetY: 16, radiusRatio: 0.52, phaseOffset: 1.1 },
    { offsetX: 38, offsetY: 16, radiusRatio: 0.50, phaseOffset: 1.8 },
    { offsetX: -18, offsetY: 30, radiusRatio: 0.44, phaseOffset: 2.4 },
    { offsetX: 18, offsetY: 30, radiusRatio: 0.44, phaseOffset: 3.1 },
  ],
  core: [
    { offsetX: -28, offsetY: -32, radiusRatio: 0.48, phaseOffset: 0.5 },
    { offsetX: 28, offsetY: -32, radiusRatio: 0.48, phaseOffset: 1.3 },
    { offsetX: -44, offsetY: 8, radiusRatio: 0.45, phaseOffset: 2.2 },
    { offsetX: 44, offsetY: 8, radiusRatio: 0.45, phaseOffset: 2.8 },
  ],
};

/**
 * Deterministic suspended light droplets inside the cloud body.
 */
export const SUSPENDED_DROPLETS: readonly SuspendedDroplet[] = [
  { x: -36, y: -26, radius: 2.2, brightness: 0.85, driftPhase: 0.3, driftSpeed: 1.1 },
  { x: 42, y: -32, radius: 1.8, brightness: 0.75, driftPhase: 1.7, driftSpeed: 0.85 },
  { x: -48, y: 18, radius: 2.4, brightness: 0.80, driftPhase: 3.1, driftSpeed: 1.0 },
  { x: 46, y: 24, radius: 2.0, brightness: 0.70, driftPhase: 4.5, driftSpeed: 0.80 },
  { x: -14, y: 52, radius: 1.6, brightness: 0.65, driftPhase: 2.2, driftSpeed: 1.2 },
  { x: 22, y: 54, radius: 1.9, brightness: 0.72, driftPhase: 5.1, driftSpeed: 0.95 },
  { x: -6, y: -52, radius: 2.5, brightness: 0.92, driftPhase: 0.8, driftSpeed: 1.3 },
  { x: 28, y: -12, radius: 1.5, brightness: 0.60, driftPhase: 3.9, driftSpeed: 0.70 },
  { x: -24, y: -8, radius: 2.0, brightness: 0.78, driftPhase: 2.8, driftSpeed: 0.90 },
  { x: 12, y: 2, radius: 1.7, brightness: 0.82, driftPhase: 4.1, driftSpeed: 1.05 },
  { x: -55, y: -6, radius: 1.4, brightness: 0.55, driftPhase: 1.2, driftSpeed: 0.75 },
  { x: 55, y: -4, radius: 1.4, brightness: 0.55, driftPhase: 5.4, driftSpeed: 0.75 },
  { x: 0, y: -38, radius: 2.6, brightness: 0.95, driftPhase: 0.0, driftSpeed: 1.15 },
  { x: 0, y: 65, radius: 1.8, brightness: 0.60, driftPhase: 3.5, driftSpeed: 0.85 },
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
  // Sequential wave circulating through lobes (leftCheek -> topCrown/core -> rightCheek -> base/belly)
  const circPhase = def.circPhase ?? def.breathPhase;
  const circWave = Math.sin(idleTime * 0.85 - circPhase);
  const circScale = 1 + circWave * 0.045; // Subtle +4.5% puff as the atmospheric wave passes
  const migX = Math.cos(idleTime * 0.85 - circPhase) * 2.2;
  const migY = Math.sin(idleTime * 0.85 - circPhase) * 1.8;
  const convection = Math.sin(idleTime * 0.42 + def.breathPhase) * 1.2;
  tx += migX;
  ty += migY - convection;

  // 2. Out-of-sync gentle idle breathing
  const breathCycle = Math.sin(idleTime * 1.4 + def.breathPhase) * def.breathAmp;
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
    puff: 0,
    leftBulge: 0,
    rightBulge: 0,
    topBulge: 0,
    bottomSag: 0,
    coreDensity: 1.15,
    lobeSoftness: 1.0,
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

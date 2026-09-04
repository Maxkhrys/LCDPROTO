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
  type TwinklingStar,
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
  floatAmount: 4.0,
  driftAmount: 2.2,
  wobbleAmount: 0,
  lobeLag: 1.08,
  springStiffness: 122,
  springDamping: 11.2,
};

export const DEFAULT_COLOUR: CloudColourConfig = {
  body: "#f2f6fc", // Soft, airy sky-tinted cloud white (living atmospheric vapor)
  innerGlow: "#d0e3f8", // Atmospheric sky-blue scattering
  edge: "#ffffff", // Crisp sunlit rim highlight
  coreTint: "#849ab8", // Rich, soft, cool cloud shadow & internal billow depth
  glowIntensity: 0.16, // Gentle internal sky light scattering
  density: 0.98, // Soft, breathable vapor volume
  translucency: 0.82, // Natural light penetration & billow separation
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
 * - Broad, buoyant cauliflower crown dome
 * - Chubby lateral cheeks framing face
 * - Broad, stable resting core
 * - Gentle floating cumulus bottom shelves
 * - One cute asymmetrical trailing wind tuft
 */
export const LOBE_DEFINITIONS: readonly LobeDefinition[] = [
  // 1. REAR BASE LOBES (depth = -2 to -1): Broad, grounded buoyant cushion
  {
    id: "bottomBelly",
    name: "Broad Lower Grounding Shelf",
    baseX: -2,
    baseY: 48,
    radiusX: 106,
    radiusY: 38,
    baseOpacity: 0.96,
    baseSoftness: 0.98,
    lagFactor: 0.85,
    stiffness: 100,
    damping: 12.0,
    breathPhase: 4.2,
    breathAmp: 0.034,
    depth: -2,
    circPhase: 5.4,
  },
  {
    id: "baseLeft",
    name: "Lower-Left Cumulus Shelf",
    baseX: -66,
    baseY: 38,
    radiusX: 76,
    radiusY: 42,
    baseOpacity: 0.95,
    baseSoftness: 0.98,
    lagFactor: 0.72,
    stiffness: 115,
    damping: 12.5,
    breathPhase: 3.14,
    breathAmp: 0.035,
    depth: -1,
    circPhase: 6.2,
  },
  {
    id: "baseRight",
    name: "Lower-Right Asymmetric Shelf",
    baseX: 62,
    baseY: 36,
    radiusX: 72,
    radiusY: 40,
    baseOpacity: 0.94,
    baseSoftness: 0.98,
    lagFactor: 0.76,
    stiffness: 110,
    damping: 12.5,
    breathPhase: 3.8,
    breathAmp: 0.032,
    depth: -1,
    circPhase: 4.6,
  },

  // 2. CENTRAL CORE (depth = 0): Broad buoyant face cradle mass
  {
    id: "core",
    name: "Central Face Cradle Mass",
    baseX: 0,
    baseY: 6,
    radiusX: 96,
    radiusY: 72,
    baseOpacity: 1.0,
    baseSoftness: 0.95,
    lagFactor: 0.08,
    stiffness: 240,
    damping: 20.0,
    breathPhase: 0.0,
    breathAmp: 0.022,
    depth: 0,
    circPhase: 2.0,
  },

  // 3. MID LOBES (depth = 1): Chubby cheek billows framing face
  {
    id: "leftCheek",
    name: "Upper-Left Shoulder Billow",
    baseX: -84,
    baseY: 4,
    radiusX: 68,
    radiusY: 56,
    baseOpacity: 0.95,
    baseSoftness: 0.98,
    lagFactor: 0.48,
    stiffness: 140,
    damping: 13.5,
    breathPhase: 1.2,
    breathAmp: 0.034,
    depth: 1,
    circPhase: 0.0,
  },
  {
    id: "rightCheek",
    name: "Upper-Right Shoulder",
    baseX: 80,
    baseY: 2,
    radiusX: 64,
    radiusY: 52,
    baseOpacity: 0.94,
    baseSoftness: 0.98,
    lagFactor: 0.52,
    stiffness: 135,
    damping: 13.5,
    breathPhase: 1.8,
    breathAmp: 0.032,
    depth: 1,
    circPhase: 3.0,
  },
  {
    id: "trailingTuft",
    name: "Trailing Wind Tuft",
    baseX: 106,
    baseY: 24,
    radiusX: 28,
    radiusY: 22,
    baseOpacity: 0.88,
    baseSoftness: 1.00,
    lagFactor: 0.82,
    stiffness: 95,
    damping: 10.5,
    breathPhase: 2.6,
    breathAmp: 0.042,
    depth: 1,
    circPhase: 3.8,
  },

  // 4. TOP CROWN (depth = 2): Broad, proud cumulus dome
  {
    id: "topCrown",
    name: "Dominant Dome Crown",
    baseX: -4,
    baseY: -48,
    radiusX: 92,
    radiusY: 58,
    baseOpacity: 0.98,
    baseSoftness: 0.96,
    lagFactor: 0.38,
    stiffness: 160,
    damping: 15.5,
    breathPhase: 0.7,
    breathAmp: 0.036,
    depth: 2,
    circPhase: 1.0,
  },

  // 5. FRONT VEIL (depth = 10): Translucent bottom mist veil
  {
    id: "frontVeil",
    name: "Front Translucent Mist Veil",
    baseX: 0,
    baseY: 42,
    radiusX: 74,
    radiusY: 36,
    baseOpacity: 0.06,
    baseSoftness: 1.04,
    lagFactor: 0.24,
    stiffness: 180,
    damping: 16.5,
    breathPhase: 0.4,
    breathAmp: 0.018,
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
 * Organic secondary cumulus billows.
 * Creates authentic cauliflower-like dome clusters, chubby cheek rolls,
 * and pillowy base contours that make the character feel fluffy, soft, and alive.
 */
export const LOBE_SUB_PUFFS: Partial<Record<string, readonly LobeSubPuff[]>> = {
  topCrown: [
    { offsetX: -44, offsetY: -12, radiusRatio: 0.54, phaseOffset: 0.5 }, // Sunward left cauliflower crest
    { offsetX: 40, offsetY: -10, radiusRatio: 0.50, phaseOffset: 1.3 }, // Right dome crest
    { offsetX: -2, offsetY: -26, radiusRatio: 0.52, phaseOffset: 0.9 }, // Top cauliflower crest
  ],
  leftCheek: [
    { offsetX: -32, offsetY: -14, radiusRatio: 0.52, phaseOffset: 1.8 }, // Upper cheek puff
    { offsetX: -26, offsetY: 18, radiusRatio: 0.48, phaseOffset: 2.4 }, // Lower cheek puff
  ],
  rightCheek: [
    { offsetX: 30, offsetY: -12, radiusRatio: 0.50, phaseOffset: 2.9 }, // Upper cheek puff
    { offsetX: 24, offsetY: 16, radiusRatio: 0.46, phaseOffset: 3.5 }, // Lower cheek puff
  ],
  baseLeft: [
    { offsetX: -26, offsetY: 12, radiusRatio: 0.46, phaseOffset: 4.1 },
  ],
  baseRight: [
    { offsetX: 24, offsetY: 10, radiusRatio: 0.44, phaseOffset: 4.7 },
  ],
  bottomBelly: [
    { offsetX: -32, offsetY: 10, radiusRatio: 0.44, phaseOffset: 5.2 },
    { offsetX: 32, offsetY: 8, radiusRatio: 0.42, phaseOffset: 5.8 },
  ],
};

/**
 * 5 Sparse, low-contrast diffuse vapor motes.
 * Very faint, soft atmospheric motes (NO bright stars, NO sparkle, NO fairy lights).
 */
export const SUSPENDED_DROPLETS: readonly SuspendedDroplet[] = [
  { x: -32, y: 38, radius: 2.4, brightness: 0.18, driftPhase: 0.4, driftSpeed: 0.65 },
  { x: 36, y: -24, radius: 2.0, brightness: 0.16, driftPhase: 1.8, driftSpeed: 0.55 },
  { x: -18, y: 52, radius: 2.6, brightness: 0.20, driftPhase: 3.2, driftSpeed: 0.70 },
  { x: 44, y: 38, radius: 2.2, brightness: 0.15, driftPhase: 4.6, driftSpeed: 0.60 },
  { x: 14, y: 22, radius: 2.0, brightness: 0.16, driftPhase: 5.2, driftSpeed: 0.62 },
];

/**
 * 15 Whimsical twinkling stars & spark particles nestled across the cloud body.
 * Attached to specific billow lobes so they ride naturally with the soft-body motion.
 */
export const TWINKLING_STARS: readonly TwinklingStar[] = [
  // 1. Crown crest sparkles (sunlit cauliflower dome peaks)
  { x: -38, y: -24, baseRadius: 3.2, rayLength: 10, speed: 2.2, phase: 0.2, attachedLobe: "topCrown" },
  { x: 34, y: -20, baseRadius: 2.8, rayLength: 8, speed: 1.8, phase: 1.7, attachedLobe: "topCrown" },
  { x: -2, y: -38, baseRadius: 3.6, rayLength: 12, speed: 2.6, phase: 3.1, attachedLobe: "topCrown" },
  { x: -18, y: -14, baseRadius: 2.4, rayLength: 7, speed: 2.0, phase: 4.8, attachedLobe: "topCrown" },

  // 2. Left cheek & shoulder billow sparkles
  { x: -28, y: -12, baseRadius: 3.0, rayLength: 9, speed: 1.9, phase: 1.1, attachedLobe: "leftCheek" },
  { x: -20, y: 16, baseRadius: 2.6, rayLength: 7.5, speed: 2.4, phase: 2.8, attachedLobe: "leftCheek" },
  { x: -40, y: 4, baseRadius: 2.2, rayLength: 6.5, speed: 1.7, phase: 5.2, attachedLobe: "leftCheek" },

  // 3. Right cheek & shoulder billow sparkles
  { x: 26, y: -10, baseRadius: 3.0, rayLength: 9, speed: 2.1, phase: 0.8, attachedLobe: "rightCheek" },
  { x: 22, y: 14, baseRadius: 2.5, rayLength: 7, speed: 1.9, phase: 3.6, attachedLobe: "rightCheek" },
  { x: 36, y: 2, baseRadius: 2.2, rayLength: 6, speed: 2.5, phase: 2.1, attachedLobe: "rightCheek" },

  // 4. Central forehead starlight (above eyes)
  { x: -14, y: -26, baseRadius: 2.8, rayLength: 8.5, speed: 2.3, phase: 2.2, attachedLobe: "core" },
  { x: 16, y: -24, baseRadius: 2.6, rayLength: 8, speed: 1.7, phase: 4.2, attachedLobe: "core" },

  // 5. Trailing wind tuft sparkle
  { x: 10, y: -4, baseRadius: 3.4, rayLength: 11, speed: 2.8, phase: 1.4, attachedLobe: "trailingTuft" },

  // 6. Lower shelf floating sparkles
  { x: -28, y: 12, baseRadius: 2.4, rayLength: 7, speed: 1.6, phase: 3.9, attachedLobe: "bottomBelly" },
  { x: 26, y: 10, baseRadius: 2.4, rayLength: 7, speed: 2.0, phase: 5.5, attachedLobe: "bottomBelly" },
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

  // 8. Scale & Rich Squish / Stretch Soft-Body Deformation
  let sx = breathScale * (1 + puff * 0.3);
  let sy = breathScale * (1 + puff * 0.3);

  if (squash > 0) {
    // Rich, juicy squish physics:
    sx *= 1 + squash * 0.58;
    sy *= 1 - squash * 0.46;

    // Physical displacement on squish:
    // Crown pushes down into body, cheeks spread out wide, base spreads down
    if (def.baseY < -10) {
      ty += squash * Math.abs(def.baseY) * 0.42; // Crown compresses downward
    } else if (def.baseY > 10) {
      ty += squash * 14; // Base shelf expands down
    }
    if (def.baseX < -15) {
      tx -= squash * 22; // Left cheek puffs out wide
    } else if (def.baseX > 15) {
      tx += squash * 22; // Right cheek puffs out wide
    }
  }

  if (stretch > 0) {
    // Dynamic vertical stretch:
    sx *= 1 - stretch * 0.36;
    sy *= 1 + stretch * 0.65;

    // Physical displacement on stretch:
    if (def.baseY < -10) {
      ty -= stretch * 26; // Crown reaches high
    }
    if (def.baseX < -15) {
      tx += stretch * 14; // Cheeks cinch inward
    } else if (def.baseX > 15) {
      tx -= stretch * 14;
    }
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
      const pushAmount = penetration * 0.80;
      tx -= normX * pushAmount;
      ty -= normY * pushAmount;

      const compression = Math.min(0.85, Math.max(0, penetration / (outerRadius * 0.60)));
      // Enhanced radial flattening normal & tangential volume bunching
      const radialFactor = 1 - compression * 0.55;
      const tangentialFactor = 1 + compression * 0.45;
      const normX2 = normX * normX;
      const normY2 = normY * normY;
      sx *= (radialFactor * normX2 + tangentialFactor * normY2);
      sy *= (radialFactor * normY2 + tangentialFactor * normX2);

      // Squeeze torque along AMOLED circular glass curvature
      const rimTangentAngle = Math.atan2(normY, normX) + Math.PI / 2;
      rot += Math.sin(rimTangentAngle - rot) * compression * 0.35;
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

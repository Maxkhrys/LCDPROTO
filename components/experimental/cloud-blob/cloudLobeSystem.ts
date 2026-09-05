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

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

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
  fluffiness: 0.8,
  lightAngle: -135,
  lightStrength: 0.65,
  cheekBlush: 0,
  cloudBrows: false,
  gazeX: 0,
  gazeY: 0,
  turnYaw: 0,
  turnPitch: 0,
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
    baseOpacity: 0.9,
    baseSoftness: 1.25,
    lagFactor: 0.88, // Heaviest mass, settles last
    stiffness: 95,
    damping: 11.0,
    breathPhase: 4.2,
    breathAmp: 0.048,
    depth: -2,
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
  },
  {
    id: "baseRight",
    name: "Lower Right Base",
    baseX: 70,
    baseY: 54,
    radiusX: 84,
    radiusY: 64,
    baseOpacity: 0.9,
    baseSoftness: 1.2,
    lagFactor: 0.76,
    stiffness: 105,
    damping: 12.0,
    breathPhase: 3.8,
    breathAmp: 0.04,
    depth: -1,
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
    breathAmp: 0.03,
    depth: 0,
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
    breathAmp: 0.04,
    depth: 1,
  },

  // 4. TOP CROWN (depth = 2): Friendly dome silhouette
  {
    id: "topCrown",
    name: "Top Head Crown",
    baseX: -2,
    baseY: -68,
    radiusX: 76,
    radiusY: 54,
    baseOpacity: 0.9,
    baseSoftness: 1.1,
    lagFactor: 0.42,
    stiffness: 155,
    damping: 15.0,
    breathPhase: 0.7,
    breathAmp: 0.046,
    depth: 2,
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
    baseSoftness: 1.4,
    lagFactor: 0.26,
    stiffness: 180,
    damping: 16.5,
    breathPhase: 0.4,
    breathAmp: 0.025,
    depth: 10,
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
    { offsetX: -30, offsetY: -24, radiusRatio: 0.58, phaseOffset: 0.7 },
    { offsetX: 30, offsetY: -14, radiusRatio: 0.45, phaseOffset: 1.7 },
  ],
  leftCheek: [
    { offsetX: -32, offsetY: -18, radiusRatio: 0.55, phaseOffset: 1.2 },
  ],
  rightCheek: [
    { offsetX: 30, offsetY: -8, radiusRatio: 0.5, phaseOffset: 2.1 },
  ],
  baseLeft: [
    { offsetX: -32, offsetY: 12, radiusRatio: 0.52, phaseOffset: 2.5 },
  ],
  baseRight: [
    { offsetX: 30, offsetY: 16, radiusRatio: 0.48, phaseOffset: 2.8 },
  ],
};

/**
 * 5 Restrained internal light motes deep within the cloud volume.
 * Gives subtle, living bioluminescent / sunlit moisture twinkle without cluttering or reading as glitter.
 */
export const SUSPENDED_DROPLETS: readonly SuspendedDroplet[] = [
  {
    x: -28,
    y: -22,
    radius: 2.2,
    brightness: 0.55,
    driftPhase: 0.4,
    driftSpeed: 0.45,
  },
  {
    x: 32,
    y: -18,
    radius: 2.0,
    brightness: 0.5,
    driftPhase: 2.2,
    driftSpeed: 0.38,
  },
  {
    x: -34,
    y: 22,
    radius: 1.8,
    brightness: 0.45,
    driftPhase: 4.1,
    driftSpeed: 0.42,
  },
  {
    x: 30,
    y: 26,
    radius: 1.9,
    brightness: 0.48,
    driftPhase: 5.3,
    driftSpeed: 0.35,
  },
  {
    x: 0,
    y: -38,
    radius: 2.4,
    brightness: 0.6,
    driftPhase: 1.2,
    driftSpeed: 0.4,
  },
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
  out = {
    targetX: 0,
    targetY: 0,
    targetScaleX: 1,
    targetScaleY: 1,
    targetOpacity: 1,
    targetRotation: 0,
  },
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

  // 1. Out-of-sync gentle idle breathing
  const calm = 0.35 + 0.65 * Math.pow(Math.sin(idleTime * 0.16), 2);
  const breathCycle =
    Math.sin(idleTime * 1.2 + def.breathPhase) * def.breathAmp * calm;
  const breathScale = 1 + breathCycle;

  // 2. Squash & Stretch
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

  // 3. Lean effect: sheared displacement & asymmetric compression
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

  // 4. Local bulges & sag
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

  // 5. Harmonic wobble
  if (motion.wobbleAmount > 0) {
    const wobblePhase = idleTime * 5.0 + def.breathPhase;
    const wobbleDist = Math.sin(wobblePhase) * motion.wobbleAmount * 6;
    tx += wobbleDist;
  }

  // 6. DIRECTIONAL TURNING SILHOUETTE MORPHING (Pseudo-3D volumetric rotation)
  const turnYaw = params.turnYaw ?? 0;
  const turnPitch = params.turnPitch ?? 0;
  const yawRatio = clamp(turnYaw / 28, -1, 1);
  const pitchRatio = clamp(turnPitch / 18, -1, 1);

  if (Math.abs(yawRatio) > 0.01 || Math.abs(pitchRatio) > 0.01) {
    if (def.id === "topCrown") {
      // Top crown mass leans dynamically into motion
      tx += yawRatio * 20;
      ty += pitchRatio * 10;
    } else if (def.id === "leftCheek") {
      // Left cheek leads and shifts left when turning left; tucks in when turning right
      tx += yawRatio < 0 ? yawRatio * 14 : yawRatio * 18;
      ty += pitchRatio * 6;
    } else if (def.id === "rightCheek") {
      // Right cheek leads and shifts right when turning right; tucks in when turning left
      tx += yawRatio > 0 ? yawRatio * 14 : yawRatio * 18;
      ty += pitchRatio * 6;
    } else if (def.id === "bottomBelly") {
      tx -= yawRatio * 8;
      ty += pitchRatio * 10;
    } else if (def.id === "baseLeft") {
      tx += yawRatio < 0 ? yawRatio * 8 : yawRatio * 12;
    } else if (def.id === "baseRight") {
      tx += yawRatio > 0 ? yawRatio * 8 : yawRatio * 12;
    }
  }

  // 7. CRITICAL LOBE LAG HIERARCHY & DIRECTIONAL AIRFLOW DEFORMATION:
  // Face leads -> core maintains chunky structural presence (lag 0.05, low stretch) -> crown & cheeks follow -> rear base & belly trail along motion wake
  // Asymmetric directional lag: front leading lobes have reduced lag; rear trailing lobes drag along wake
  const isLeadingX = (characterVx > 10 && def.baseX > 10) || (characterVx < -10 && def.baseX < -10);
  const isTrailingX = (characterVx > 10 && def.baseX < -10) || (characterVx < -10 && def.baseX > 10);
  const directionalLagMod = isLeadingX ? 0.45 : isTrailingX ? 1.35 : 1.0;

  const lagStrength = def.lagFactor * motion.lobeLag * 0.09 * directionalLagMod;
  const maxLobeOffset = def.radiusX * 0.48;
  const rawLagX = characterVx * lagStrength;
  const rawLagY = characterVy * lagStrength;
  tx -= Math.max(-maxLobeOffset, Math.min(maxLobeOffset, rawLagX));
  ty -= Math.max(-maxLobeOffset, Math.min(maxLobeOffset, rawLagY));

  // 8. Scale computation with core shape protection and directional airflow
  const speed = Math.hypot(characterVx, characterVy);
  const nvx = speed > 1e-2 ? characterVx / speed : 0;
  const nvy = speed > 1e-2 ? characterVy / speed : 0;
  // Position projection along travel direction: positive = leading into air, negative = trailing behind
  const travelProjection = (def.baseX * nvx + def.baseY * nvy) / 75;

  let sx = breathScale * (1 + puff * 0.3);
  let sy = breathScale * (1 + puff * 0.3);

  const isCore = def.id === "core" || def.id === "frontVeil";
  // Core preserves chunky spherical volume; trailing rear lobes take on fluid elongation
  const squashFactor = isCore ? 0.22 : (def.depth < 0 ? 1.25 : 0.8);
  const stretchFactor = isCore ? 0.22 : (def.depth < 0 ? 1.35 : 0.85);

  if (squash > 0) {
    sx *= 1 + squash * 0.3 * squashFactor;
    sy *= 1 - squash * 0.24 * squashFactor;
  }
  if (stretch > 0) {
    sx *= 1 - stretch * 0.2 * stretchFactor;
    sy *= 1 + stretch * 0.36 * stretchFactor;
  }

  // Directional silhouette volume modulation:
  // Leading side becomes fuller and firmer; trailing rear side compresses and recedes
  if (!isCore) {
    if (def.id === "leftCheek") {
      if (yawRatio < -0.05) {
        // Leading left side becomes fuller
        sx *= 1 + Math.abs(yawRatio) * 0.15;
        sy *= 1 + Math.abs(yawRatio) * 0.08;
      } else if (yawRatio > 0.05) {
        // Trailing side compresses
        sx *= 1 - Math.abs(yawRatio) * 0.20;
        sy *= 1 - Math.abs(yawRatio) * 0.10;
      }
    } else if (def.id === "rightCheek") {
      if (yawRatio > 0.05) {
        // Leading right side becomes fuller
        sx *= 1 + Math.abs(yawRatio) * 0.15;
        sy *= 1 + Math.abs(yawRatio) * 0.08;
      } else if (yawRatio < -0.05) {
        // Trailing side compresses
        sx *= 1 - Math.abs(yawRatio) * 0.20;
        sy *= 1 - Math.abs(yawRatio) * 0.10;
      }
    } else if (def.id === "baseLeft") {
      sx *= yawRatio < 0 ? 1 + Math.abs(yawRatio) * 0.10 : 1 - Math.abs(yawRatio) * 0.15;
    } else if (def.id === "baseRight") {
      sx *= yawRatio > 0 ? 1 + Math.abs(yawRatio) * 0.10 : 1 - Math.abs(yawRatio) * 0.15;
    } else if (def.id === "topCrown") {
      if (pitchRatio < -0.05) {
        sy *= 1 + Math.abs(pitchRatio) * 0.14;
      } else if (pitchRatio > 0.05) {
        sy *= 1 - Math.abs(pitchRatio) * 0.10;
      }
    } else if (def.id === "bottomBelly") {
      if (pitchRatio > 0.05) {
        sy *= 1 + Math.abs(pitchRatio) * 0.14;
      } else if (pitchRatio < -0.05) {
        sy *= 1 - Math.abs(pitchRatio) * 0.12;
      }
    }
  }

  // Aerodynamic motion reaction:
  // Leading lobes compress slightly from airflow resistance; trailing lobes elongate along wake
  if (speed > 25 && !isCore) {
    const airflowLag = clamp(speed / 380, 0, 0.35) * def.lagFactor;
    if (travelProjection > 0.2) {
      // Leading into airflow: compact slightly
      const comp = 1 - airflowLag * 0.45;
      sx *= comp;
      sy *= comp;
    } else if (travelProjection < -0.2) {
      // Trailing behind: stretch gently along motion vector
      sx *= 1 + Math.abs(nvx) * airflowLag * 0.55;
      sy *= 1 + Math.abs(nvy) * airflowLag * 0.65;
    }
  }

  const rot = (lean * 0.38 * (1 - def.lagFactor * 0.45) * Math.PI) / 180;

  let opacity = def.baseOpacity * (1 - puff * 0.12);
  if (def.id === "frontVeil") {
    opacity = def.baseOpacity * (params.faceEmbedDepth / 0.14);
  }

  out.targetX = tx;
  out.targetY = ty;
  out.targetScaleX = sx;
  out.targetScaleY = sy;
  out.targetOpacity = opacity;
  out.targetRotation = rot;
  return out;
}

const target = {
  targetX: 0,
  targetY: 0,
  targetScaleX: 1,
  targetScaleY: 1,
  targetOpacity: 1,
  targetRotation: 0,
};

export function stepLobePhysics(
  lobeStates: Record<string, LobeState>,
  params: CloudDeformationParams,
  motion: CloudMotionConfig,
  characterVx: number,
  characterVy: number,
  idleTime: number,
  dt: number,
): void {
  const clampedDt = Math.max(0, Math.min(dt, 0.05));
  const steps = Math.max(1, Math.ceil(clampedDt * 120));
  const h = clampedDt / steps;

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
      target,
    );

    const stiffness = def.stiffness * (motion.springStiffness / 145);
    const damping = def.damping * (motion.springDamping / 14.5);

    for (let i = 0; i < steps; i++) {
      // X axis spring
      const fx = -stiffness * (state.x - targetX) - damping * state.vx;
      state.vx += fx * h;
      state.x += state.vx * h;

      // Y axis spring
      const fy = -stiffness * (state.y - targetY) - damping * state.vy;
      state.vy += fy * h;
      state.y += state.vy * h;
    }
    // Smooth relaxation
    const rate = 1 - Math.exp(-12 * clampedDt);
    state.scaleX += (targetScaleX - state.scaleX) * rate;
    state.scaleY += (targetScaleY - state.scaleY) * rate;
    state.opacity += (targetOpacity - state.opacity) * rate;
    state.rotation += (targetRotation - state.rotation) * rate;
  }

  // Cohesive Volume Tethering:
  // A cloud is a single connected fluid/vapor volume. Peripheral lobes must NEVER disconnect from the core.
  const coreState = lobeStates.core;
  if (coreState) {
    for (const def of LOBE_DEFINITIONS) {
      if (def.id === "core" || def.id === "frontVeil") continue;
      const s = lobeStates[def.id];
      if (!s) continue;

      const maxDistX = Math.abs(def.baseX) + def.radiusX * 0.28;
      const maxDistY = Math.abs(def.baseY) + def.radiusY * 0.28;

      const dx = s.x - coreState.x;
      const dy = s.y - coreState.y;

      if (Math.abs(dx) > maxDistX) {
        s.x = coreState.x + Math.sign(dx) * (maxDistX + (Math.abs(dx) - maxDistX) * 0.15);
        s.vx *= 0.6;
      }
      if (Math.abs(dy) > maxDistY) {
        s.y = coreState.y + Math.sign(dy) * (maxDistY + (Math.abs(dy) - maxDistY) * 0.15);
        s.vy *= 0.6;
      }
    }
  }
}

export const PRESETS: Record<
  CloudPresetName,
  Partial<CloudDeformationParams>
> = {
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
    scale: 1.1,
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

/**
 * Procedural Cloud Blob - Type Definitions
 *
 * Authored for the 466x466 round AMOLED hardware target.
 * Defines multi-lobe soft-body parameters, springs, mist wisps,
 * deformation channels, color configurations, and face rig integration.
 */

import type { BlobRig, BlobColour } from "@/lib/blobRig";
import type { BehaviourId, HomeMood } from "@/lib/blobBehaviour";

export type LobeId =
  | "core"
  | "topCrown"
  | "leftCheek"
  | "rightCheek"
  | "baseLeft"
  | "baseRight"
  | "bottomBelly"
  | "frontVeil";

export interface LobeDefinition {
  id: LobeId;
  name: string;
  baseX: number;
  baseY: number;
  radiusX: number;
  radiusY: number;
  baseOpacity: number;
  baseSoftness: number;
  lagFactor: number;
  stiffness: number;
  damping: number;
  breathPhase: number;
  breathAmp: number;
  depth: number; // Order: <0 rear base, 0 core, 1-2 mid crown/cheeks, 10 front veil over face
}

export interface LobeState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  scaleX: number;
  scaleY: number;
  opacity: number;
  rotation: number;
}

export interface CloudDeformationParams {
  scale: number;
  scaleX: number;
  scaleY: number;
  rotation: number;
  x: number;
  y: number;
  squash: number;
  stretch: number;
  lean: number;
  puff: number;
  leftBulge: number;
  rightBulge: number;
  topBulge: number;
  bottomSag: number;
  coreDensity: number;
  lobeSoftness: number;
  faceEmbedDepth: number; // 0 (crisp floating) to 0.35 (submerged in mist), default 0.12
  fluffiness: number; // 0 (smooth) to 2.0 (ultra-billowy cumulus fluff), default 1.2
  lightStrength: number;
  lightAngle: number; // Key light angle in degrees, default -45 (top-left sunlight)
  cheekBlush: number; // 0 to 1 warm bioluminescent blush intensity
  cloudBrows: boolean; // Render floating wispy cloud brows
  gazeX: number; // -1 to 1 iris glance
  gazeY: number; // -1 to 1 iris glance
}

export interface CloudMotionConfig {
  floatAmount: number;
  driftAmount: number;
  wobbleAmount: number;
  lobeLag: number;
  springStiffness: number;
  springDamping: number;
}

export interface CloudTrailConfig {
  enabled: boolean;
  spawnRate: number;
  lifetime: number;
  fadeSpeed: number;
  trailStrength: number;
  driftAmount: number;
}

export interface CloudColourConfig {
  body: string;
  innerGlow: string;
  edge: string;
  coreTint: string;
  glowIntensity: number;
  density: number;
  translucency: number;
}

export interface SuspendedDroplet {
  x: number;
  y: number;
  radius: number;
  brightness: number;
  driftPhase: number;
  driftSpeed: number;
}

export interface CloudWisp {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  targetRadius: number;
  opacity: number;
  initialOpacity: number;
  age: number;
  maxLife: number;
  softness: number;
  color: string;
  angle: number;
  shape: number;
  curl: number;
}

export type CloudPresetName =
  | "NEUTRAL"
  | "PUFF"
  | "SQUASH"
  | "STRETCH"
  | "LEAN LEFT"
  | "LEAN RIGHT"
  | "SOFT WOBBLE"
  | "DRIFT LEFT"
  | "DRIFT RIGHT"
  | "MIST TRAIL"
  | "SETTLE"
  | "SLEEPY FLATTEN"
  | "EXCITED PUFF";

export interface DragInteractionState {
  isDragging: boolean;
  offsetX: number;
  offsetY: number;
  speed: number;
}

export interface CloudBlobBodyProps {
  /** Screen diameter in pixels (defaults to 466). */
  size?: number;
  /** Rasterization multiplier (defaults to 1). */
  renderScale?: number;
  /** Production character rig for drop-in parity with BlobCharacter. */
  rig?: BlobRig;
  /** Legacy alias for rig. */
  faceRig?: BlobRig;
  /** Production colour palette selection. */
  colour?: BlobColour;
  /** Legacy alias for colour. */
  blobColour?: BlobColour;
  /** Body deformation sliders. */
  params?: Partial<CloudDeformationParams>;
  /** Motion and spring dynamics config. */
  motionConfig?: Partial<CloudMotionConfig>;
  /** Trailing mist wisp settings. */
  trailConfig?: Partial<CloudTrailConfig>;
  /** Cloud palette overrides. */
  cloudColour?: Partial<CloudColourConfig>;
  /** Master face visibility toggle. */
  showFace?: boolean;
  /** Enable interactive pointer drag / touch manipulation. */
  dragEnabled?: boolean;
  /** Whether to render fallback contact shadow (EnvironmentLayer handles this if present). */
  showContactShadow?: boolean;
  playing?: boolean;
  fps?: 30 | 60;
  idleEnabled?: boolean;
  debug?: boolean;
  resetId?: number;
  centreId?: number;
  clearWispsId?: number;
  /** Called by the single simulation clock; production controllers take ms. */
  advanceRig?: (dtMs: number) => BlobRig;
  onPose?: (x: number, y: number, scale: number) => void;
  /** Additional container styling. */
  className?: string;
  /** Callback fired on drag state change. */
  onDragChange?: (state: DragInteractionState) => void;
  /** Frame performance & physics telemetry callback. */
  onTelemetry?: (fps: number, frameTimeMs: number, activeWisps: number, avgLag: number) => void;
}

export interface EmoteTriggerOption {
  id: string;
  label: string;
  hint: string;
  category?: "Emote" | "Gaze" | "Lids" | "Body" | "Mouth";
  behaviourId?: BehaviourId;
  mood?: HomeMood;
  patch?: Partial<CloudDeformationParams>;
}

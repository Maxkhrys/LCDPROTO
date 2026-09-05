/**
 * The character roster.
 *
 * A character is a *body*. Everything above it — the rig, the behaviour
 * controller, the drives, the jelly physics, the drag and the screen
 * lifecycle — is shared, and so is the face. Adding a body here does not
 * fork any of that; it only changes what the rig is drawn as.
 */

import type {
  CloudColourConfig,
  CloudDeformationParams,
  CloudMotionConfig,
  CloudTrailConfig,
} from "@/components/experimental/cloud-blob/cloudTypes";
import type { BlobColour } from "@/lib/blobRig";

export type CharacterId = "blob" | "cloud";

export interface CharacterMeta {
  id: CharacterId;
  label: string;
  description: string;
  /**
   * Silhouette radius as a fraction of the display, used by the drag wall.
   *
   * Blob's core is BODY_FRACTION wide; the cloud's mist body measures wider
   * than that, so sharing Blob's figure let it be dragged far enough that the
   * circular crop sliced pieces off it.
   */
  radiusFraction: number;
}

export const CHARACTERS: readonly CharacterMeta[] = [
  {
    id: "blob",
    label: "Blob",
    description: "The production jelly body, drawn from the locked artwork.",
    radiusFraction: 0.5,
  },
  {
    id: "cloud",
    label: "Cloud",
    description: "Procedural volumetric lobes wearing the same face.",
    // Calibrated for circular AMOLED boundary (466x466, R=233):
    // Allows generous, responsive drag travel across the display while
    // giving the per-lobe collision physics room to compress and bunch naturally.
    radiusFraction: 0.64,
  },
] as const;

export const DEFAULT_CHARACTER: CharacterId = "blob";

export const CLOUD_PALETTES: Record<BlobColour, string> = {
  teal: "Cool Mist",
  purple: "Purple Void",
  yellow: "Golden Dawn",
  green: "Emerald Vapor",
  blue: "Baby Blue",
  red: "Blush Rose",
};

export const CLOUD_COLOUR_PRESET_NAMES = [
  "Follow Blob colour",
  "Cool Mist",
  "Purple Void",
  "Baby Blue",
  "Emerald Vapor",
  "Blush Rose",
  "Golden Dawn",
] as const;

/** Every cloud-only slider, in one place so the console can drive them all. */
export interface CloudSettings {
  params: Partial<CloudDeformationParams>;
  motion: Partial<CloudMotionConfig>;
  trails: Partial<CloudTrailConfig>;
  colour: Partial<CloudColourConfig>;
  /**
   * Where the shared face sits on the cloud.
   *
   * The face anchors are calibrated against Blob's silhouette, and the cloud
   * is wider and shorter, so it needs its own placement rather than inheriting
   * one that was measured for a different body.
   */
  face: CloudFaceSettings;
  /** Active colour preset name, or "Follow Blob colour" */
  palettePreset?: string;
}

export interface CloudFaceSettings {
  offsetX: number;
  offsetY: number;
  scale: number;
}

/**
 * Starting values.
 *
 * Deliberately empty rather than a copy of the experimental defaults: an empty
 * override means the cloud modules stay the single source of truth for its own
 * look, so improvements to those files show up here without being shadowed by
 * a stale duplicate of their numbers.
 */
export const DEFAULT_CLOUD_SETTINGS: CloudSettings = {
  params: {},
  motion: {},
  trails: {},
  colour: {},
  face: { offsetX: 0, offsetY: 0, scale: 1 },
  palettePreset: "Follow Blob colour",
};

/** Slider definitions for the console, so the UI carries no magic numbers. */
export interface CloudSliderDef {
  group: "params" | "motion" | "trails" | "colour" | "face";
  key: string;
  label: string;
  min: number;
  max: number;
  step: number;
  fallback: number;
}

export const CLOUD_SLIDERS: readonly CloudSliderDef[] = [
  { group: "params", key: "scale", label: "Cloud size", min: 0.5, max: 1.5, step: 0.02, fallback: 1 },
  { group: "params", key: "puff", label: "Puff", min: -0.2, max: 0.8, step: 0.02, fallback: 0 },
  { group: "params", key: "squash", label: "Squash", min: 0, max: 0.8, step: 0.02, fallback: 0 },
  { group: "params", key: "stretch", label: "Stretch", min: 0, max: 0.8, step: 0.02, fallback: 0 },
  { group: "params", key: "lean", label: "Lean", min: -30, max: 30, step: 1, fallback: 0 },
  { group: "params", key: "coreDensity", label: "Core density", min: 0.7, max: 1.4, step: 0.02, fallback: 1 },
  { group: "params", key: "lobeSoftness", label: "Outer softness", min: 0.75, max: 1.3, step: 0.02, fallback: 1 },
  { group: "params", key: "fluffiness", label: "Fluffiness / billows", min: 0, max: 1.2, step: 0.02, fallback: 1.05 },
  { group: "params", key: "lightAngle", label: "Light angle", min: -180, max: 180, step: 5, fallback: -50 },
  { group: "params", key: "lightStrength", label: "Light strength", min: 0, max: 1, step: 0.02, fallback: 0.5 },
  { group: "params", key: "cheekBlush", label: "Cheek blush", min: 0, max: 1, step: 0.02, fallback: 0 },
  { group: "params", key: "faceEmbedDepth", label: "Face embed", min: 0, max: 0.35, step: 0.01, fallback: 0.12 },
  { group: "params", key: "leftBulge", label: "Left bulge", min: -1, max: 1, step: 0.02, fallback: 0 },
  { group: "params", key: "rightBulge", label: "Right bulge", min: -1, max: 1, step: 0.02, fallback: 0 },
  { group: "params", key: "topBulge", label: "Top bulge", min: -1, max: 1, step: 0.02, fallback: 0 },
  { group: "params", key: "bottomSag", label: "Bottom sag", min: -1, max: 1, step: 0.02, fallback: 0 },

  { group: "motion", key: "floatAmount", label: "Float", min: 0, max: 10, step: 0.5, fallback: 4 },
  { group: "motion", key: "driftAmount", label: "Drift", min: 0, max: 10, step: 0.5, fallback: 2 },
  { group: "motion", key: "lobeLag", label: "Lobe lag", min: 0, max: 2, step: 0.02, fallback: 1 },
  { group: "motion", key: "springStiffness", label: "Stiffness", min: 50, max: 300, step: 5, fallback: 140 },
  { group: "motion", key: "springDamping", label: "Damping", min: 8, max: 30, step: 0.5, fallback: 14 },

  { group: "trails", key: "trailStrength", label: "Mist strength", min: 0, max: 1.4, step: 0.02, fallback: 0.6 },
  { group: "trails", key: "lifetime", label: "Mist life (s)", min: 0.4, max: 1.3, step: 0.05, fallback: 0.9 },
  { group: "trails", key: "spawnRate", label: "Emission rate", min: 0, max: 2, step: 0.05, fallback: 1 },
  { group: "trails", key: "fadeSpeed", label: "Fade speed", min: 0.5, max: 2, step: 0.05, fallback: 1 },
  { group: "trails", key: "driftAmount", label: "Mist drift", min: 0, max: 2, step: 0.05, fallback: 1 },

  { group: "colour", key: "glowIntensity", label: "Glow", min: 0, max: 2, step: 0.02, fallback: 0.16 },
  { group: "colour", key: "density", label: "Density", min: 0.5, max: 1.5, step: 0.02, fallback: 0.95 },
  { group: "colour", key: "translucency", label: "Translucency", min: 0, max: 1, step: 0.02, fallback: 0.82 },

  { group: "face", key: "offsetX", label: "Face X", min: -40, max: 40, step: 1, fallback: 0 },
  { group: "face", key: "offsetY", label: "Face Y", min: -40, max: 40, step: 1, fallback: 0 },
  { group: "face", key: "scale", label: "Face scale", min: 0.7, max: 1.4, step: 0.01, fallback: 1 },
];

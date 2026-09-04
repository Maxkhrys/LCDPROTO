import type { FaceCalibration } from "./blobCalibration";
import type { IdleConfig } from "./blobIdle";
import type { BehaviourId, HomeActivityStatus } from "./blobBehaviour";
import type { HomeMood } from "./blobBehaviour";
import type { BlobColour } from "./blobRig";
import type { BlobDestination, BlobIntention } from "./blobMind";

export type DisplayMode = "dark" | "warm" | "brown";

export const DISPLAY_BACKGROUNDS: Record<DisplayMode, string> = {
  dark: "#000",
  warm: "#cfc3b4",
  brown: "#a58d76",
};

/**
 * The device's interaction states. Each one will eventually own a full
 * animation; for now they only carry an accent colour and a label.
 */
export type DeviceState =
  | "HOME"
  | "SENSED"
  | "APPROACHING"
  | "VERY_CLOSE"
  | "TOGETHER"
  | "SYNC"
  | "CONNECTED"
  | "RECOGNIZED";

export interface DeviceStateMeta {
  id: DeviceState;
  /** Short label shown in the selector and dev readout. */
  label: string;
  /** Temporary accent colour, replaced when each state gets designed. */
  accent: string;
}

export const DEVICE_STATES: readonly DeviceStateMeta[] = [
  { id: "HOME", label: "Home", accent: "#6D5BD0" },
  { id: "SENSED", label: "Sensed", accent: "#5B6BD0" },
  { id: "APPROACHING", label: "Approaching", accent: "#4F86C6" },
  { id: "VERY_CLOSE", label: "Very Close", accent: "#3FA9A0" },
  { id: "TOGETHER", label: "Together", accent: "#54A86B" },
  { id: "SYNC", label: "Sync", accent: "#B99A4F" },
  { id: "CONNECTED", label: "Connected", accent: "#C4744F" },
  { id: "RECOGNIZED", label: "Recognized", accent: "#B0587E" },
] as const;

export const DEFAULT_STATE: DeviceState = "HOME";

export function getStateMeta(id: DeviceState): DeviceStateMeta {
  return DEVICE_STATES.find((s) => s.id === id) ?? DEVICE_STATES[0];
}

/** Props every state component receives. Keep this stable — states are isolated. */
export interface StateViewProps {
  /** Native screen size in pixels (240). */
  size: number;
  /** False when the dev controls are paused; states should freeze. */
  playing: boolean;
  /** Animation speed multiplier from the dev controls. */
  speed: number;
  /** Changes on Reset so a state can remount and restart cleanly. */
  runId: number;
  /** Frame rate the preview is throttled to (30 or 60). */
  fps: number;
  /** Temporary facial-layer calibration from the dev controls. */
  calibration: FaceCalibration;
  /** Procedural idle motion settings from the dev controls. */
  idle: IdleConfig;
  /** HOME automatic playlist on/off. Manual cue buttons still work when off. */
  autoBehaviourEnabled: boolean;
  /** Dev request to run a behaviour now; a new nonce fires it. */
  triggerRequest: { id: BehaviourId; nonce: number } | null;
  /** Reports the running behaviour back to the dev readout. */
  onBehaviourStatus?: (s: HomeActivityStatus) => void;
  /**
   * Pixels rasterised per 240-space pixel. Layout and animation always work in
   * 240-space; this only controls sampling fidelity so artwork stays sharp when
   * the panel is magnified on a desktop display. 1 = true hardware pixels.
   */
  renderScale: number;
  /** Dev-only panel contrast preview. Hardware/default remains dark. */
  displayMode: DisplayMode;
  /** Dev-only LCD background colour. Defaults to true black. */
  screenColour: string;
  /** Opens floating Blob edit orbs after a double tap. */
  onOpenBlobTools?: () => void;
  /** Closes floating Blob edit orbs after a single tap on Blob. */
  onCloseBlobTools?: () => void;
  /** Lets Blob shift below the tools and look up at them. */
  blobToolsOpen?: boolean;
  /** Optional mood override; null keeps automatic mood changes. */
  mood: HomeMood | null;
  /** Shows a small light pupil inside each procedural eye. */
  showPupils: boolean;
  /** Dev-only rig colour preview; every colour uses identical transforms. */
  blobColour: BlobColour;
  /** Optional director override for the current Blob intention. */
  mindIntention: BlobIntention | null;
  /** Optional director override for the current travel destination. */
  mindDestination: BlobDestination | null;
  /** Optional normalised depth override; positive moves Blob closer. */
  mindDepth: number | null;
}

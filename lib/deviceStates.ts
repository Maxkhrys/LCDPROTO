import type { FaceCalibration } from "./blobCalibration";

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
  /**
   * Pixels rasterised per 240-space pixel. Layout and animation always work in
   * 240-space; this only controls sampling fidelity so artwork stays sharp when
   * the panel is magnified on a desktop display. 1 = true hardware pixels.
   */
  renderScale: number;
}

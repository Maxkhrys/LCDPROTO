/**
 * Physical/virtual characteristics of the target device.
 * The panel is a 1.43" round AMOLED with a native 466x466 framebuffer.
 * Everything inside the screen is authored in these native pixels and
 * then scaled up visually with a CSS transform, so the prototype always
 * reflects the real pixel budget.
 */
export const DEVICE_CONFIG = {
  model: "Waveshare ESP32 S3 1.43 AMOLED Round Display",
  display: "AMOLED",
  touch: "capacitive",
  displayInterface: "QSPI",
  mcu: "ESP32-S3R8",
  psramMb: 8,
  flashMb: 16,
  /** Native framebuffer size in pixels (square, circularly masked). */
  resolution: 466,
  /** Bezel thickness as a fraction of the screen diameter. */
  bezelRatio: 0.075,
  /** Rendered diameter of the screen on desktop, in CSS pixels. */
  desktopScreenSize: 466,
  /** Frame rates the prototype can be previewed at. */
  fpsOptions: [30, 60] as const,
  /** Prefer 60 FPS; complex scenes must remain stable at 30 FPS. */
  primaryFps: 60,
  minimumFps: 30,
  /** Animation speed multipliers available in the dev controls. */
  speedOptions: [0.5, 1, 1.5] as const,
} as const;

export type Fps = (typeof DEVICE_CONFIG.fpsOptions)[number];
export type Speed = (typeof DEVICE_CONFIG.speedOptions)[number];

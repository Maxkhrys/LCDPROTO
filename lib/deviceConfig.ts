/**
 * Physical/virtual characteristics of the target device.
 * The panel is a 1.28" round LCD with a native 240x240 framebuffer.
 * Everything inside the screen is authored in these native pixels and
 * then scaled up visually with a CSS transform, so the prototype always
 * reflects the real pixel budget.
 */
export const DEVICE_CONFIG = {
  /** Native framebuffer size in pixels (square, circularly masked). */
  resolution: 240,
  /** Bezel thickness as a fraction of the screen diameter. */
  bezelRatio: 0.075,
  /** Rendered diameter of the screen on desktop, in CSS pixels. */
  desktopScreenSize: 480,
  /** Frame rates the prototype can be previewed at. */
  fpsOptions: [30, 60] as const,
  /** Animation speed multipliers available in the dev controls. */
  speedOptions: [0.5, 1, 1.5] as const,
} as const;

export type Fps = (typeof DEVICE_CONFIG.fpsOptions)[number];
export type Speed = (typeof DEVICE_CONFIG.speedOptions)[number];

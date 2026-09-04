/**
 * Prototype-only environment tuning. Values are authored in the native
 * 466-space and deliberately map to cheap canvas operations for the future
 * ESP32-S3 renderer.
 */
export interface EnvironmentConfig {
  enabled: boolean;
  shadowEnabled: boolean;
  particlesEnabled: boolean;
  bounceEnabled: boolean;
  parallaxEnabled: boolean;
  shadowWidth: number;
  shadowHeight: number;
  shadowOpacity: number;
  shadowSoftness: number;
  shadowYOffset: number;
  shadowLag: number;
  particleCount: number;
  particleSpeed: number;
  ambientLight: number;
  bounceLight: number;
  parallax: number;
}

export const DEFAULT_ENVIRONMENT: EnvironmentConfig = {
  enabled: true,
  shadowEnabled: true,
  particlesEnabled: true,
  bounceEnabled: true,
  parallaxEnabled: true,
  shadowWidth: 1,
  shadowHeight: 1,
  shadowOpacity: 0.52,
  shadowSoftness: 0.72,
  shadowYOffset: 4,
  shadowLag: 110,
  particleCount: 6,
  particleSpeed: 1,
  ambientLight: 0.55,
  bounceLight: 0.32,
  parallax: 0.45,
};

export interface EnvironmentStatus {
  blobHeight: number;
  shadowScaleX: number;
  shadowScaleY: number;
  shadowOpacity: number;
  shadowOffset: number;
  particleCount: number;
}

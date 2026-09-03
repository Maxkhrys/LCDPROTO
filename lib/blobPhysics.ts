/**
 * Small, ESP32-portable spring layer for Blob's soft-body follow-through.
 *
 * Behaviours provide authored targets. These scalar underdamped springs make
 * mass trail those targets, pass them once, then settle. No mesh, blur, or
 * browser-only effect is involved: just five position/velocity pairs.
 */

export interface JellyTarget {
  x: number;
  y: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
}

export type JellyPose = JellyTarget;

class DampedAxis {
  value = 0;
  velocity = 0;

  reset() {
    this.value = 0;
    this.velocity = 0;
  }

  step(target: number, dt: number, frequency: number, dampingRatio: number) {
    const omega = Math.PI * 2 * frequency;
    const acceleration =
      (target - this.value) * omega * omega -
      this.velocity * (2 * dampingRatio * omega);
    this.velocity += acceleration * dt;
    this.value += this.velocity * dt;
  }
}

export class BlobJellyPhysics {
  private readonly x = new DampedAxis();
  private readonly y = new DampedAxis();
  private readonly rotation = new DampedAxis();
  private readonly scaleX = new DampedAxis();
  private readonly scaleY = new DampedAxis();
  private readonly pose: JellyPose = {
    x: 0,
    y: 0,
    rotation: 0,
    scaleX: 0,
    scaleY: 0,
  };

  reset() {
    this.x.reset();
    this.y.reset();
    this.rotation.reset();
    this.scaleX.reset();
    this.scaleY.reset();
    Object.assign(this.pose, { x: 0, y: 0, rotation: 0, scaleX: 0, scaleY: 0 });
  }

  /** Returned pose object is reused every frame. */
  update(dtMs: number, target: JellyTarget): JellyPose {
    const seconds = Math.min(Math.max(dtMs, 0), 100) / 1000;
    if (seconds > 0) {
      // Small fixed-ish substeps keep spring response matching at 30 and 60 FPS.
      const steps = Math.max(1, Math.ceil(seconds * 120));
      const dt = seconds / steps;
      for (let i = 0; i < steps; i += 1) {
        this.x.step(target.x, dt, 2.6, 0.64);
        this.y.step(target.y, dt, 2.7, 0.61);
        this.rotation.step(target.rotation, dt, 2.5, 0.6);
        this.scaleX.step(target.scaleX, dt, 3.05, 0.48);
        this.scaleY.step(target.scaleY, dt, 3.05, 0.48);
      }
    }

    this.pose.x = this.x.value;
    this.pose.y = this.y.value;
    this.pose.rotation = this.rotation.value;
    this.pose.scaleX = this.scaleX.value;
    this.pose.scaleY = this.scaleY.value;
    return this.pose;
  }
}

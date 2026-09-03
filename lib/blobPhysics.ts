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
  /** Secondary body mass moving underneath the facial plane. */
  bodyX: number;
  bodyY: number;
  bodyRotation: number;
  bodyScaleX: number;
  bodyScaleY: number;
  bodySkewX: number;
  bodySkewY: number;
  bodyOriginX: number;
  bodyOriginY: number;
}

export interface JellyPose extends JellyTarget {
  /** Combined translational speed, 240-space pixels per second. */
  bodySpeed: number;
}

class DampedAxis {
  value = 0;
  velocity = 0;

  reset(initial = 0) {
    this.value = initial;
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
  private readonly bodyX = new DampedAxis();
  private readonly bodyY = new DampedAxis();
  private readonly bodyRotation = new DampedAxis();
  private readonly bodyScaleX = new DampedAxis();
  private readonly bodyScaleY = new DampedAxis();
  private readonly bodySkewX = new DampedAxis();
  private readonly bodySkewY = new DampedAxis();
  private readonly bodyOriginX = new DampedAxis();
  private readonly bodyOriginY = new DampedAxis();
  private readonly pose: JellyPose = {
    x: 0,
    y: 0,
    rotation: 0,
    scaleX: 0,
    scaleY: 0,
    bodyX: 0,
    bodyY: 0,
    bodyRotation: 0,
    bodyScaleX: 0,
    bodyScaleY: 0,
    bodySkewX: 0,
    bodySkewY: 0,
    bodyOriginX: 0,
    bodyOriginY: 0.82,
    bodySpeed: 0,
  };

  reset() {
    this.x.reset();
    this.y.reset();
    this.rotation.reset();
    this.scaleX.reset();
    this.scaleY.reset();
    this.bodyX.reset();
    this.bodyY.reset();
    this.bodyRotation.reset();
    this.bodyScaleX.reset();
    this.bodyScaleY.reset();
    this.bodySkewX.reset();
    this.bodySkewY.reset();
    this.bodyOriginX.reset();
    this.bodyOriginY.reset(0.82);
    Object.assign(this.pose, {
      x: 0,
      y: 0,
      rotation: 0,
      scaleX: 0,
      scaleY: 0,
      bodyX: 0,
      bodyY: 0,
      bodyRotation: 0,
      bodyScaleX: 0,
      bodyScaleY: 0,
      bodySkewX: 0,
      bodySkewY: 0,
      bodyOriginX: 0,
      bodyOriginY: 0.82,
      bodySpeed: 0,
    });
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
        // Secondary mass is intentionally softer and later than the main pose.
        // One controlled overshoot makes the artwork feel gelatinous without
        // turning the character into a bouncing game sprite.
        this.bodyX.step(target.bodyX, dt, 2.35, 0.46);
        this.bodyY.step(target.bodyY, dt, 2.4, 0.44);
        this.bodyRotation.step(target.bodyRotation, dt, 2.25, 0.45);
        this.bodyScaleX.step(target.bodyScaleX, dt, 2.7, 0.4);
        this.bodyScaleY.step(target.bodyScaleY, dt, 2.7, 0.4);
        this.bodySkewX.step(target.bodySkewX, dt, 2.55, 0.48);
        this.bodySkewY.step(target.bodySkewY, dt, 2.55, 0.48);
        this.bodyOriginX.step(target.bodyOriginX, dt, 4.2, 0.78);
        this.bodyOriginY.step(target.bodyOriginY, dt, 4.2, 0.78);
      }
    }

    // Movement itself deforms the jelly. A new downward target compresses the
    // mass; travel stretches it; the authored axis preserves approximate area.
    const impact = Math.max(-0.022, Math.min(0.022, (this.y.value - target.y) * 0.006));
    const travel = Math.max(
      -0.018,
      Math.min(0.018, -(this.y.velocity + this.bodyY.velocity * 0.55) * 0.0009)
    );
    const dynamicY = impact + travel;
    const dynamicX = 1 / (1 + dynamicY) - 1;

    this.pose.x = this.x.value;
    this.pose.y = this.y.value;
    this.pose.rotation = this.rotation.value;
    this.pose.scaleX = this.scaleX.value + dynamicX;
    this.pose.scaleY = this.scaleY.value + dynamicY;
    this.pose.bodyX = this.bodyX.value;
    this.pose.bodyY = this.bodyY.value;
    this.pose.bodyRotation = this.bodyRotation.value;
    this.pose.bodyScaleX = this.bodyScaleX.value;
    this.pose.bodyScaleY = this.bodyScaleY.value;
    this.pose.bodySkewX = this.bodySkewX.value;
    this.pose.bodySkewY = this.bodySkewY.value;
    this.pose.bodyOriginX = this.bodyOriginX.value;
    this.pose.bodyOriginY = this.bodyOriginY.value;
    this.pose.bodySpeed = Math.hypot(
      this.x.velocity + this.bodyX.velocity,
      this.y.velocity + this.bodyY.velocity
    );
    return this.pose;
  }
}

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
  /** Four low-amplitude body-surface ripple offsets, top to bottom. */
  rippleTop: number;
  rippleUpper: number;
  rippleLower: number;
  rippleBottom: number;
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
  private readonly rippleTop = new DampedAxis();
  private readonly rippleUpper = new DampedAxis();
  private readonly rippleLower = new DampedAxis();
  private readonly rippleBottom = new DampedAxis();
  private previousMotionX = 0;
  private previousMotionY = 0;
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
    rippleTop: 0,
    rippleUpper: 0,
    rippleLower: 0,
    rippleBottom: 0,
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
    this.rippleTop.reset();
    this.rippleUpper.reset();
    this.rippleLower.reset();
    this.rippleBottom.reset();
    this.previousMotionX = 0;
    this.previousMotionY = 0;
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
      rippleTop: 0,
      rippleUpper: 0,
      rippleLower: 0,
      rippleBottom: 0,
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
        this.bodyX.step(target.bodyX, dt, 2.1, 0.36);
        this.bodyY.step(target.bodyY, dt, 2.15, 0.34);
        this.bodyRotation.step(target.bodyRotation, dt, 2.25, 0.45);
        this.bodyScaleX.step(target.bodyScaleX, dt, 2.45, 0.33);
        this.bodyScaleY.step(target.bodyScaleY, dt, 2.45, 0.33);
        this.bodySkewX.step(target.bodySkewX, dt, 2.35, 0.38);
        this.bodySkewY.step(target.bodySkewY, dt, 2.35, 0.38);
        this.bodyOriginX.step(target.bodyOriginX, dt, 4.2, 0.78);
        this.bodyOriginY.step(target.bodyOriginY, dt, 4.2, 0.78);
      }
    }

    const motionX = this.x.velocity + this.bodyX.velocity;
    const motionY = this.y.velocity + this.bodyY.velocity;
    const motionDelta = Math.hypot(
      motionX - this.previousMotionX,
      motionY - this.previousMotionY
    );
    // Spring velocity is in 240-space pixels/second. The previous ripple
    // impulse was sub-pixel, so it could not survive native-size sampling.
    // This is still capped tightly: one visible wave, then decay.
    const impactKick = Math.min(
      36,
      motionDelta * 0.9 + Math.abs(motionY) * 0.75 + Math.abs(motionX) * 0.45
    );
    if (impactKick > 1) {
      const direction = motionY >= 0 ? 1 : -1;
      this.rippleTop.velocity += direction * impactKick * 1.15;
      this.rippleUpper.velocity += direction * impactKick * 0.8;
      this.rippleLower.velocity -= direction * impactKick * 0.55;
      this.rippleBottom.velocity -= direction * impactKick * 0.3;
      this.rippleTop.velocity += motionX * 0.0018;
      this.rippleUpper.velocity += motionX * 0.0011;
    }
    const rippleDt = seconds > 0 ? seconds : 1 / 60;
    this.rippleTop.step(0, rippleDt, 3.8, 0.42);
    this.rippleUpper.step(0, rippleDt, 3.5, 0.44);
    this.rippleLower.step(0, rippleDt, 3.2, 0.48);
    this.rippleBottom.step(0, rippleDt, 2.9, 0.52);
    this.previousMotionX = motionX;
    this.previousMotionY = motionY;

    // Movement itself deforms the jelly. A new downward target compresses the
    // mass; travel stretches it; the authored axis preserves approximate area.
    const impact = Math.max(-0.022, Math.min(0.022, (this.y.value - target.y) * 0.006));
    const travel = Math.max(
      -0.018,
      Math.min(0.018, -(this.y.velocity + this.bodyY.velocity * 0.55) * 0.0009)
    );
    const dynamicY = Math.max(
      -0.032,
      Math.min(0.032, impact * 1.35 + travel * 1.25)
    );
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
    this.pose.rippleTop = Math.max(-2.2, Math.min(2.2, this.rippleTop.value));
    this.pose.rippleUpper = Math.max(-1.8, Math.min(1.8, this.rippleUpper.value));
    this.pose.rippleLower = Math.max(-1.5, Math.min(1.5, this.rippleLower.value));
    this.pose.rippleBottom = Math.max(-1.2, Math.min(1.2, this.rippleBottom.value));
    return this.pose;
  }
}

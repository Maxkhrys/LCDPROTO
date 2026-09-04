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
  /** Normalised distance from the screen plane; positive is nearer. */
  depth: number;
  /** Presentation-space turn axes, in degrees. */
  yaw: number;
  pitch: number;
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
  /** User-tunable multiplier for secondary mass follow-through. */
  jellyAmount: number;
  /** User-tunable multiplier for the internal ripple response. */
  rippleAmount: number;
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

  constructor(initial = 0) {
    this.value = initial;
  }

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
  private readonly depth = new DampedAxis();
  private readonly yaw = new DampedAxis();
  private readonly pitch = new DampedAxis();
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
  private readonly bodyOriginY = new DampedAxis(0.82);
  private readonly rippleTop = new DampedAxis();
  private readonly rippleUpper = new DampedAxis();
  private readonly rippleLower = new DampedAxis();
  private readonly rippleBottom = new DampedAxis();
  private previousMotionX = 0;
  private previousMotionY = 0;
  private readonly pose: JellyPose = {
    x: 0,
    y: 0,
    depth: 0,
    yaw: 0,
    pitch: 0,
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
    jellyAmount: 1,
    rippleAmount: 1,
    bodySpeed: 0,
    rippleTop: 0,
    rippleUpper: 0,
    rippleLower: 0,
    rippleBottom: 0,
  };

  reset() {
    this.x.reset();
    this.y.reset();
    this.depth.reset();
    this.yaw.reset();
    this.pitch.reset();
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
      depth: 0,
      yaw: 0,
      pitch: 0,
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
      jellyAmount: 1,
      rippleAmount: 1,
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
        this.x.step(target.x, dt, 2.8, 0.58);
        this.y.step(target.y, dt, 2.9, 0.56);
        // Depth and turn are deliberately slower than the eye-leading face.
        // That gives a small parallax catch-up without introducing a 3D engine.
        this.depth.step(target.depth, dt, 1.8, 0.66);
        this.yaw.step(target.yaw, dt, 1.95, 0.62);
        this.pitch.step(target.pitch, dt, 1.8, 0.66);
        this.rotation.step(target.rotation, dt, 2.5, 0.6);
        this.scaleX.step(target.scaleX, dt, 3.05, 0.48);
        this.scaleY.step(target.scaleY, dt, 3.05, 0.48);
        const jellyAmount = Math.max(0.5, Math.min(1.6, target.jellyAmount));
        // The secondary mass trails the whole character as well as named body
        // cues. That is what makes a slow float feel like a soft object with
        // weight instead of a rigid icon translated on a screen.
        const bodyLagX = Math.max(
          -2.8,
          Math.min(3.6, -this.x.velocity * 0.11 * jellyAmount)
        );
        const bodyLagY = Math.max(
          -3.2,
          Math.min(4.2, -this.y.velocity * 0.13 * jellyAmount)
        );
        const bodyLagRotation = Math.max(
          -1.4,
          Math.min(1.9, -this.x.velocity * 0.09 * jellyAmount)
        );
        const bodyLagScaleY = Math.max(
          -0.035,
          Math.min(
            0.045,
            -this.y.velocity * 0.0032 * jellyAmount +
              Math.abs(this.x.velocity) * 0.00115 * jellyAmount
          )
        );
        const bodyLagScaleX = 1 / (1 + bodyLagScaleY) - 1;
        const bodyLagSkewX = Math.max(
          -1.8,
          Math.min(2.4, -this.x.velocity * 0.12 * jellyAmount)
        );
        const bodyLagSkewY = Math.max(
          -1.4,
          Math.min(1.9, this.y.velocity * 0.06 * jellyAmount)
        );
        // Secondary mass is intentionally softer and later than the main pose.
        // One controlled overshoot makes the artwork feel gelatinous without
        // turning the character into a bouncing game sprite.
        this.bodyX.step(target.bodyX + bodyLagX, dt, 2.35, 0.3);
        this.bodyY.step(target.bodyY + bodyLagY, dt, 2.4, 0.28);
        this.bodyRotation.step(
          target.bodyRotation + bodyLagRotation,
          dt,
          2.4,
          0.39
        );
        this.bodyScaleX.step(
          target.bodyScaleX + bodyLagScaleX,
          dt,
          2.7,
          0.28
        );
        this.bodyScaleY.step(
          target.bodyScaleY + bodyLagScaleY,
          dt,
          2.7,
          0.28
        );
        this.bodySkewX.step(
          target.bodySkewX + bodyLagSkewX,
          dt,
          2.6,
          0.33
        );
        this.bodySkewY.step(
          target.bodySkewY + bodyLagSkewY,
          dt,
          2.6,
          0.33
        );
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
    const rippleAmount = Math.max(0, Math.min(2, target.rippleAmount));
    const motionSpeed = Math.hypot(motionX, motionY);
    const turnSpeed = Math.abs(this.yaw.velocity) * 0.08;
    const previousSpeed = Math.hypot(
      this.previousMotionX,
      this.previousMotionY
    );
    const speedChange = Math.abs(motionSpeed - previousSpeed);
    const impactKick = Math.min(
      52,
      (motionDelta * 2.1 + speedChange * 0.8 + turnSpeed) *
        (0.65 + rippleAmount * 0.35)
    );
    if (impactKick > 0.55) {
      const direction = motionY >= 0 ? 1 : -1;
      this.rippleTop.velocity += direction * impactKick * 1.15;
      this.rippleUpper.velocity += direction * impactKick * 0.8;
      this.rippleLower.velocity -= direction * impactKick * 0.55;
      this.rippleBottom.velocity -= direction * impactKick * 0.3;
      this.rippleTop.velocity += motionX * 0.035 * rippleAmount;
      this.rippleUpper.velocity += motionX * 0.022 * rippleAmount;
      this.rippleLower.velocity -= motionX * 0.014 * rippleAmount;
      this.rippleBottom.velocity -= motionX * 0.009 * rippleAmount;
      this.rippleTop.velocity += this.yaw.velocity * 0.018 * rippleAmount;
      this.rippleLower.velocity -= this.yaw.velocity * 0.012 * rippleAmount;
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
    const jellyAmount = Math.max(0.5, Math.min(1.6, target.jellyAmount));
    const impact = Math.max(
      -0.03,
      Math.min(0.03, (this.y.value - target.y) * 0.007 * jellyAmount)
    );
    const travel = Math.max(
      -0.026,
      Math.min(
        0.026,
        -(this.y.velocity + this.bodyY.velocity * 0.65) * 0.00115 * jellyAmount
      )
    );
    const dynamicY = Math.max(
      -0.048,
      Math.min(
        0.048,
        (impact * 1.5 + travel * 1.45) * (0.8 + jellyAmount * 0.2)
      )
    );
    const dynamicX = 1 / (1 + dynamicY) - 1;

    this.pose.x = this.x.value;
    this.pose.y = this.y.value;
    this.pose.depth = this.depth.value;
    this.pose.yaw = this.yaw.value;
    this.pose.pitch = this.pitch.value;
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
    this.pose.jellyAmount = target.jellyAmount;
    this.pose.rippleAmount = target.rippleAmount;
    this.pose.bodySpeed = Math.hypot(
      this.x.velocity + this.bodyX.velocity,
      this.y.velocity + this.bodyY.velocity
    ) + Math.abs(this.depth.velocity) * 70 + Math.abs(this.yaw.velocity) * 0.08;
    this.pose.rippleTop = Math.max(
      -3.2,
      Math.min(
        3.2,
        this.rippleTop.value * rippleAmount +
          motionY * 0.018 * rippleAmount +
          motionX * 0.009 * rippleAmount
      )
    );
    this.pose.rippleUpper = Math.max(
      -2.55,
      Math.min(
        2.55,
        this.rippleUpper.value * rippleAmount +
          motionY * 0.012 * rippleAmount +
          motionX * 0.006 * rippleAmount
      )
    );
    this.pose.rippleLower = Math.max(
      -2.15,
      Math.min(
        2.15,
        this.rippleLower.value * rippleAmount -
          motionY * 0.009 * rippleAmount -
          motionX * 0.004 * rippleAmount
      )
    );
    this.pose.rippleBottom = Math.max(
      -1.75,
      Math.min(
        1.75,
        this.rippleBottom.value * rippleAmount -
          motionY * 0.006 * rippleAmount -
          motionX * 0.003 * rippleAmount
      )
    );
    return this.pose;
  }
}

/**
 * Pointer grab, wall resistance and jelly shake.
 *
 * Everything here is scalar: five springs, a soft radial limit and a small set
 * of derived deformation values. No mesh, no filters, no per-frame allocation
 * and no Math.random — the same maths runs unchanged on the ESP32.
 *
 * The controller only produces offsets and deformation deltas. HomeState feeds
 * those into the existing jelly target, so drag inherits the body lag, squash
 * and ripple system that already exists instead of duplicating it.
 */

const clamp = (value: number, min: number, max: number) =>
  value < min ? min : value > max ? max : value;

/** How far past the safe radius Blob can be pulled, in 466-space pixels. */
const WALL_SLACK = 15;
/** Fraction of the safe radius at which wall pressure starts building. */
const WALL_ONSET = 0.8;
/** Keeps the silhouette a little inside the glass. */
const EDGE_MARGIN = 3;
/** Pointer jerk, in px/s^2-ish units, above which a shake registers. */
const SHAKE_THRESHOLD = 900;
const SHAKE_RANGE = 5200;

class Spring {
  value = 0;
  velocity = 0;

  reset(value = 0) {
    this.value = value;
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

/** Additive contribution of the current grab, in 466-space units. */
export interface DragPose {
  x: number;
  y: number;
  /** Whole-character squash and stretch from wall contact and shaking. */
  scaleX: number;
  scaleY: number;
  /** Extra body-only deformation, degrees for rotation and skew. */
  rotation: number;
  skewX: number;
  skewY: number;
  /** 0 free, 1 pressed hard into the wall. */
  wallPressure: number;
  grabbed: boolean;
}

export class BlobDragController {
  private readonly posX = new Spring();
  private readonly posY = new Spring();
  private readonly wobbleX = new Spring();
  private readonly wobbleY = new Spring();
  private grabbed = false;
  /** Pointer target for Blob's centre, relative to the screen centre. */
  private targetX = 0;
  private targetY = 0;
  /** Offset between the pointer and Blob's centre at grab time. */
  private grabOffsetX = 0;
  private grabOffsetY = 0;
  private lastPointerX = 0;
  private lastPointerY = 0;
  private lastPointerAt = 0;
  private lastVelocityX = 0;
  private lastVelocityY = 0;
  private shakeEnergy = 0;
  private readonly pose: DragPose = {
    x: 0,
    y: 0,
    scaleX: 0,
    scaleY: 0,
    rotation: 0,
    skewX: 0,
    skewY: 0,
    wallPressure: 0,
    grabbed: false,
  };

  reset() {
    this.posX.reset();
    this.posY.reset();
    this.wobbleX.reset();
    this.wobbleY.reset();
    this.grabbed = false;
    this.targetX = 0;
    this.targetY = 0;
    this.grabOffsetX = 0;
    this.grabOffsetY = 0;
    this.lastVelocityX = 0;
    this.lastVelocityY = 0;
    this.shakeEnergy = 0;
  }

  get isGrabbed() {
    return this.grabbed;
  }

  /**
   * Starts a grab from wherever Blob currently is. The drag offset is relative
   * to the pointer's position at grab time, so he never jumps to the cursor.
   *
   * @param pointerX 466-space pointer position.
   */
  begin(pointerX: number, pointerY: number, now: number) {
    this.grabbed = true;
    this.grabOffsetX = this.posX.value - pointerX;
    this.grabOffsetY = this.posY.value - pointerY;
    this.targetX = this.posX.value;
    this.targetY = this.posY.value;
    this.lastPointerX = pointerX;
    this.lastPointerY = pointerY;
    this.lastPointerAt = now;
    this.lastVelocityX = 0;
    this.lastVelocityY = 0;
  }

  move(pointerX: number, pointerY: number, now: number) {
    if (!this.grabbed) return;
    this.targetX = pointerX + this.grabOffsetX;
    this.targetY = pointerY + this.grabOffsetY;

    const dt = clamp((now - this.lastPointerAt) / 1000, 0.004, 0.1);
    const velocityX = (pointerX - this.lastPointerX) / dt;
    const velocityY = (pointerY - this.lastPointerY) / dt;
    const jerkX = velocityX - this.lastVelocityX;
    const jerkY = velocityY - this.lastVelocityY;
    const jerk = Math.hypot(jerkX, jerkY);
    if (jerk > SHAKE_THRESHOLD) {
      // A direction reversal is what reads as "shaking". Feed that reversal
      // into an underdamped wobble so the jelly overshoots once or twice and
      // then stops, rather than vibrating for as long as the mouse moves.
      const strength = Math.min(1, (jerk - SHAKE_THRESHOLD) / SHAKE_RANGE);
      this.wobbleX.velocity += clamp(jerkX * 0.02 * strength, -180, 180);
      this.wobbleY.velocity += clamp(jerkY * 0.018 * strength, -180, 180);
      this.shakeEnergy = Math.min(1, this.shakeEnergy + strength * 0.5);
    }
    this.lastPointerX = pointerX;
    this.lastPointerY = pointerY;
    this.lastPointerAt = now;
    this.lastVelocityX = velocityX;
    this.lastVelocityY = velocityY;
  }

  /** Release keeps the current spring velocity, so Blob rebounds and settles. */
  end() {
    this.grabbed = false;
  }

  /**
   * @param screen     Native screen size (466).
   * @param blobRadius Blob's actual rendered radius, including current scale.
   * @param baseX      Where idle and behaviour already place Blob, so the wall
   *                   is measured against his true position, not the drag
   *                   offset alone.
   */
  step(
    dtMs: number,
    screen: number,
    blobRadius: number,
    baseX = 0,
    baseY = 0
  ): DragPose {
    const seconds = clamp(dtMs, 0, 100) / 1000;
    // The soft limit is set back by the full slack, so even a hard pull only
    // brings Blob's silhouette up against the glass, never through it.
    const limit = Math.max(
      6,
      screen * 0.5 - blobRadius - EDGE_MARGIN - WALL_SLACK
    );

    // Resolve the pointer request against the wall. Past the safe radius the
    // remaining travel decays exponentially, so the pull gets steadily harder
    // and Blob can never be dragged off the panel.
    let targetX = 0;
    let targetY = 0;
    let pullPressure = 0;
    if (this.grabbed) {
      const absoluteX = this.targetX + baseX;
      const absoluteY = this.targetY + baseY;
      const radius = Math.hypot(absoluteX, absoluteY);
      targetX = this.targetX;
      targetY = this.targetY;
      if (radius > limit && radius > 1e-4) {
        const over = radius - limit;
        const allowed = limit + WALL_SLACK * (1 - Math.exp(-over / WALL_SLACK));
        targetX = (absoluteX / radius) * allowed - baseX;
        targetY = (absoluteY / radius) * allowed - baseY;
        pullPressure = clamp(over / (WALL_SLACK * 1.6), 0, 1);
      }
    }

    if (seconds > 0) {
      const steps = Math.max(1, Math.ceil(seconds * 120));
      const dt = seconds / steps;
      for (let i = 0; i < steps; i += 1) {
        if (this.grabbed) {
          // Held: a heavy, liquid follow rather than a rigid cursor lock.
          this.posX.step(targetX, dt, 3.2, 0.74);
          this.posY.step(targetY, dt, 3.2, 0.74);
        } else {
          // Released: momentum is preserved, so he carries on, overshoots his
          // resting place once, and settles.
          this.posX.step(0, dt, 1.55, 0.44);
          this.posY.step(0, dt, 1.55, 0.44);
        }
        this.wobbleX.step(0, dt, 3.4, 0.3);
        this.wobbleY.step(0, dt, 3.6, 0.32);
      }
      this.shakeEnergy = Math.max(0, this.shakeEnergy - seconds * 1.6);
    }

    // Wall contact deformation, derived from where he actually is.
    const x = this.posX.value;
    const y = this.posY.value;
    const radius = Math.hypot(x + baseX, y + baseY);
    const contact = clamp(
      (radius - limit * WALL_ONSET) / (limit * (1 - WALL_ONSET) + WALL_SLACK),
      0,
      1
    );
    const pressure = Math.max(contact, pullPressure);
    const angle = radius > 1e-4 ? Math.atan2(y + baseY, x + baseX) : 0;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const cos2 = cos * cos;
    const sin2 = sin * sin;
    // Compression runs along the contact normal; the tangent axis expands, so
    // the silhouette flattens against the glass instead of merely scaling.
    const compression = pressure * 0.085 + this.shakeEnergy * 0.016;
    this.pose.scaleX = -compression * cos2 + compression * 0.82 * sin2;
    this.pose.scaleY = -compression * sin2 + compression * 0.82 * cos2;
    // Rolling into the impact, plus the shake's own counter-rotation.
    this.pose.rotation = clamp(
      pressure * 3.4 * Math.sin(2 * angle) + this.wobbleX.value * 0.05,
      -5,
      5
    );
    this.pose.skewX = clamp(-compression * 52 * cos * sin - this.wobbleX.value * 0.05, -6, 6);
    this.pose.skewY = clamp(compression * 20 * cos * sin + this.wobbleY.value * 0.02, -3, 3);
    this.pose.x = x + this.wobbleX.value;
    this.pose.y = y + this.wobbleY.value;
    this.pose.wallPressure = pressure;
    this.pose.grabbed = this.grabbed;
    return this.pose;
  }
}

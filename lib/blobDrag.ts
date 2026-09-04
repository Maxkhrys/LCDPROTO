/**
 * Pointer grab, wall resistance and jelly shake.
 *
 * Everything here is scalar: four springs, a soft radial limit and a small set
 * of derived deformation values. No mesh, no filters, no per-frame allocation
 * and no Math.random — the same maths runs unchanged on the ESP32.
 *
 * The controller only produces offsets and deformation deltas. HomeState feeds
 * those into the existing jelly target, so drag inherits the body lag, squash
 * and ripple system that already exists instead of duplicating it.
 */

const clamp = (value: number, min: number, max: number) =>
  value < min ? min : value > max ? max : value;

/** Keeps the silhouette a little inside the glass. */
const EDGE_MARGIN = 3;
/** Maximum inward compression at hard wall pressure. */
const MAX_NORMAL_COMPRESSION = 0.34;
/** Matching tangent expansion, preserving a soft blob-like volume. */
const MAX_TANGENT_EXPANSION = 0.38;
/** Wall pressure travel in native pixels before it reaches full strength. */
const PRESSURE_TRAVEL_RATIO = 0.28;
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
  /** Body-only squash in local tangent/normal axes. */
  bodyScaleX: number;
  bodyScaleY: number;
  /** Local x-axis angle for the tangent/normal squash pair. */
  deformAngle: number;
  /** Extra body-only deformation, degrees for rotation and skew. */
  rotation: number;
  skewX: number;
  skewY: number;
  /** 0 free, 1 pressed hard into the wall. */
  wallPressure: number;
  /** Unit vector from the character toward the contact point. */
  contactX: number;
  contactY: number;
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
  private lastNormalX = 1;
  private lastNormalY = 0;
  private shakeEnergy = 0;
  private readonly pose: DragPose = {
    x: 0,
    y: 0,
    scaleX: 0,
    scaleY: 0,
    bodyScaleX: 0,
    bodyScaleY: 0,
    deformAngle: 90,
    rotation: 0,
    skewX: 0,
    skewY: 0,
    wallPressure: 0,
    contactX: 0,
    contactY: 0,
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
    this.lastNormalX = 1;
    this.lastNormalY = 0;
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
    const radiusOfBlob = Math.max(8, blobRadius);
    // This is the centre position for an uncompressed Blob. Pressure then
    // earns a little extra travel as the body flattens into the glass.
    const contactLimit = Math.max(
      6,
      screen * 0.5 - radiusOfBlob - EDGE_MARGIN
    );
    const pressureTravel = clamp(
      radiusOfBlob * PRESSURE_TRAVEL_RATIO,
      18,
      42
    );
    const maxPressedLimit =
      screen * 0.5 -
      radiusOfBlob * (1 - MAX_NORMAL_COMPRESSION) -
      EDGE_MARGIN;

    // Resolve pointer request against a circular boundary. The direction is
    // the radial wall normal, so left, right, top, bottom and every diagonal
    // use the exact same collision path.
    let targetX = 0;
    let targetY = 0;
    let pullPressure = 0;
    let requestedNormalX = this.lastNormalX;
    let requestedNormalY = this.lastNormalY;
    let pressedLimit = contactLimit;
    if (this.grabbed) {
      const requestedX = this.targetX + baseX;
      const requestedY = this.targetY + baseY;
      const requestedRadius = Math.hypot(requestedX, requestedY);
      if (requestedRadius > 1e-4) {
        requestedNormalX = requestedX / requestedRadius;
        requestedNormalY = requestedY / requestedRadius;
        this.lastNormalX = requestedNormalX;
        this.lastNormalY = requestedNormalY;
      }
      targetX = this.targetX;
      targetY = this.targetY;
      if (requestedRadius > contactLimit) {
        const over = requestedRadius - contactLimit;
        pullPressure = clamp(over / pressureTravel, 0, 1);
        const easedPressure = pullPressure * pullPressure * (3 - 2 * pullPressure);
        pressedLimit =
          contactLimit + (maxPressedLimit - contactLimit) * easedPressure;
        const allowedRadius = Math.min(
          requestedRadius,
          contactLimit +
            (maxPressedLimit - contactLimit) *
              (1 - Math.exp(-over / pressureTravel))
        );
        targetX = requestedNormalX * allowedRadius - baseX;
        targetY = requestedNormalY * allowedRadius - baseY;
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

        // A spring can overshoot a target. Resolve that overshoot every
        // substep, otherwise a fast drag can put transparent image edges past
        // the circular display before the next frame has a chance to recover.
        const actualX = this.posX.value + baseX;
        const actualY = this.posY.value + baseY;
        const actualRadius = Math.hypot(actualX, actualY);
        const boundary = this.grabbed ? pressedLimit : contactLimit;
        if (actualRadius > boundary && actualRadius > 1e-4) {
          const nx = actualX / actualRadius;
          const ny = actualY / actualRadius;
          this.posX.value = nx * boundary - baseX;
          this.posY.value = ny * boundary - baseY;
          const outwardVelocity = this.posX.velocity * nx + this.posY.velocity * ny;
          if (outwardVelocity > 0) {
            this.posX.velocity -= nx * outwardVelocity;
            this.posY.velocity -= ny * outwardVelocity;
          }
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
    const nearWallStart = Math.max(0, contactLimit - pressureTravel * 0.72);
    const contact = clamp(
      (radius - nearWallStart) / Math.max(1, contactLimit - nearWallStart),
      0,
      1
    );
    const rawPressure = Math.max(contact, pullPressure);
    const pressure = rawPressure * rawPressure * (3 - 2 * rawPressure);
    const normalX =
      pullPressure > 0
        ? requestedNormalX
        : radius > 1e-4
          ? (x + baseX) / radius
          : this.lastNormalX;
    const normalY =
      pullPressure > 0
        ? requestedNormalY
        : radius > 1e-4
          ? (y + baseY) / radius
          : this.lastNormalY;
    this.lastNormalX = normalX;
    this.lastNormalY = normalY;

    // Local x is tangent to the wall and local y points into its normal. This
    // creates real directional squash instead of independent horizontal and
    // vertical scaling that only looks correct on the side walls.
    const tangentAngle = Math.atan2(normalY, normalX) + Math.PI / 2;
    let deformAngle = (tangentAngle * 180) / Math.PI;
    while (deformAngle > 90) deformAngle -= 180;
    while (deformAngle < -90) deformAngle += 180;
    const compression =
      MAX_NORMAL_COMPRESSION * pressure + this.shakeEnergy * 0.035;
    const expansion =
      MAX_TANGENT_EXPANSION * pressure + this.shakeEnergy * 0.055;
    // Whole-character deformation stays quiet; body deformation carries the
    // visible contact. Face remains attached to that same surface transform.
    this.pose.scaleX = 0;
    this.pose.scaleY = 0;
    this.pose.bodyScaleX = clamp(expansion, 0, 0.44);
    this.pose.bodyScaleY = clamp(-compression, -0.38, 0);
    this.pose.deformAngle = deformAngle;
    // A diagonal impact leans a little, while cardinal impacts stay planted.
    this.pose.rotation = clamp(
      pressure * 5.2 * normalX * normalY + this.wobbleX.value * 0.04,
      -5,
      5
    );
    this.pose.skewX = clamp(-this.wobbleX.value * 0.06, -5, 5);
    this.pose.skewY = clamp(this.wobbleY.value * 0.04, -3, 3);
    this.pose.x = x + this.wobbleX.value;
    this.pose.y = y + this.wobbleY.value;
    this.pose.wallPressure = pressure;
    this.pose.contactX = normalX;
    this.pose.contactY = normalY;
    this.pose.grabbed = this.grabbed;
    return this.pose;
  }
}

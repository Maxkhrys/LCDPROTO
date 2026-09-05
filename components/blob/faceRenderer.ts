import type { BlobColour, ElementTransform } from "@/lib/blobRig";

const clamp = (value: number, min: number, max: number) =>
  value < min ? min : value > max ? max : value;

/**
 * The single source of truth for one eye's silhouette.
 *
 * Eye mass, lids and brow are all derived from this one description, so the
 * black oval and its closures can never drift apart into two shapes.
 */
interface EyeGeometry {
  /** Black oval size, in 466-space pixels. */
  width: number;
  height: number;
  /** Oval centre inside the socket, after gaze travel. */
  centerX: number;
  centerY: number;
  /** Aperture opening, 0 fully closed, 1 fully open. */
  open: number;
}

/** Gaze travel budget, as a share of the eye oval. Roughly 8.6 x 6.5 px. */
const GAZE_TRAVEL_X = 0.28;
const GAZE_TRAVEL_Y = 0.13;
/** Minimum native-space gap kept between a brow's lowest point and the eye. */
export const BROW_CLEARANCE_RATIO = 2.4 / 466;

export function eyeGeometry(
  anchorWidth: number,
  anchorHeight: number,
  t: ElementTransform,
  settingsDrop: boolean
): EyeGeometry {
  const socketScaleX = clamp(t.eyeSocketScaleX, 0.72, 1.35);
  const socketScaleY = clamp(t.eyeSocketScaleY, 0.72, 1.35);
  const socketWidth = anchorWidth * socketScaleX;
  const socketHeight = anchorHeight * socketScaleY;
  const width = socketWidth * 0.86;
  const height = socketHeight * 0.96;
  const gazeX = clamp(t.x, -socketWidth * 0.26, socketWidth * 0.26);
  const gazeY = clamp(
    t.y - (settingsDrop ? socketHeight * 0.2 : 0),
    -socketHeight * 0.2,
    socketHeight * 0.14
  );
  return {
    width,
    height,
    centerX: clamp(gazeX, -width * GAZE_TRAVEL_X, width * GAZE_TRAVEL_X),
    centerY: clamp(
      gazeY * 0.72,
      -height * GAZE_TRAVEL_Y,
      height * GAZE_TRAVEL_Y
    ),
    open: clamp(t.eyeOpen, 0, 1),
  };
}

export function drawMouthShape(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  curve: number,
  oAmount: number,
  dAmount: number,
  crescentOrColour: number | BlobColour = 0,
  maybeColour?: BlobColour
) {
  const o = clamp(oAmount, 0, 1);
  const d = clamp(dAmount, 0, 1);
  const c = typeof crescentOrColour === "number" ? clamp(crescentOrColour, 0, 1) : 0;
  const colour: BlobColour =
    typeof crescentOrColour === "string" ? crescentOrColour : maybeColour ?? "teal";

  // A D mouth gives the happy and angry beats a readable open shape without
  // introducing a separate emoji asset. The top is held nearly flat while
  // the lower edge rounds into the jaw of the D.
  if (d > 0.02) {
    const halfWidth = width * (0.48 - o * 0.06);
    const top = -height * (0.18 + curve * 0.035);
    const bottom = height * (0.16 + d * 0.62 + o * 0.08);
    const corner = height * (0.06 + d * 0.06);
    ctx.beginPath();
    ctx.moveTo(-halfWidth, top);
    ctx.quadraticCurveTo(0, top - height * 0.035, halfWidth, top);
    ctx.lineTo(halfWidth, bottom - corner);
    ctx.bezierCurveTo(
      halfWidth * 0.96,
      bottom + height * 0.03,
      halfWidth * 0.48,
      bottom + height * 0.075,
      0,
      bottom + height * 0.045
    );
    ctx.bezierCurveTo(
      -halfWidth * 0.48,
      bottom + height * 0.075,
      -halfWidth * 0.96,
      bottom + height * 0.03,
      -halfWidth,
      bottom - corner
    );
    ctx.closePath();
    const palette = mouthPalette(colour);
    const mouthSurface = ctx.createLinearGradient(0, -height, 0, height);
    mouthSurface.addColorStop(0, "#020203");
    mouthSurface.addColorStop(0.72, "#050506");
    mouthSurface.addColorStop(1, palette.shade);
    ctx.fillStyle = mouthSurface;
    ctx.fill();
    return;
  }

  // Sharp Half-Oval / Crescent Smile + Neutral Bar + O mouth continuous morph.
  // When c rises, the rounded end-caps smoothly taper into acute sharp corners,
  // the top edge stays relatively flat, and the bottom arcs into a compact, cute,
  // premium animated-film half-oval silhouette.
  const crescentWidth = width * (0.42 + c * 0.04);
  const neutralWidth = width * (0.5 - o * 0.08);
  const halfWidth = (1 - c) * neutralWidth + c * crescentWidth;

  const baseThickness = Math.max(1.8, height * (0.2 + o * 0.045));
  const loopDepth = height * 0.42 * o;
  const bend = curve * height * 0.5 * (1 - o);
  const endY = -curve * height * 0.08 * (1 - o);

  // Taper ends to sharp corners as crescent amount increases
  const cornerThickness = baseThickness * (1 - c);
  const cornerReach = Math.max(0, baseThickness * 1.35 * (1 - c));

  const topEnd = endY - cornerThickness;
  const bottomEnd = endY + cornerThickness;

  // Flatten the top edge as crescent increases; deepen the curved belly below
  const neutralTopCenter = endY + bend - baseThickness - loopDepth;
  const crescentTopCenter = endY + bend * 0.18 - cornerThickness * 0.4;
  const topCenter = (1 - c) * neutralTopCenter + c * crescentTopCenter;

  const neutralBottomCenter = endY + bend + baseThickness + loopDepth;
  const crescentBottomCenter = endY + bend * 0.28 + height * (0.46 + c * 0.28);
  const bottomCenter = (1 - c) * neutralBottomCenter + c * crescentBottomCenter;

  ctx.beginPath();
  // Start at left corner
  ctx.moveTo(-halfWidth, topEnd);
  // Top curve (flattens into cute anime upper lip as c -> 1)
  ctx.quadraticCurveTo(0, topCenter, halfWidth, topEnd);

  // Right corner: rounded cap when c=0, acute tapered tip when c=1
  if (c < 0.96) {
    ctx.bezierCurveTo(
      halfWidth + cornerReach,
      topEnd,
      halfWidth + cornerReach,
      bottomEnd,
      halfWidth,
      bottomEnd
    );
  } else {
    ctx.lineTo(halfWidth, bottomEnd);
  }

  // Bottom curve (arcs into round half-oval smile)
  ctx.quadraticCurveTo(0, bottomCenter, -halfWidth, bottomEnd);

  // Left corner: rounded cap when c=0, acute tapered tip when c=1
  if (c < 0.96) {
    ctx.bezierCurveTo(
      -halfWidth - cornerReach,
      bottomEnd,
      -halfWidth - cornerReach,
      topEnd,
      -halfWidth,
      topEnd
    );
  } else {
    ctx.closePath();
  }

  const palette = mouthPalette(colour);
  const mouthSurface = ctx.createLinearGradient(0, -height, 0, height);
  mouthSurface.addColorStop(0, "#020203");
  mouthSurface.addColorStop(0.7, "#050506");
  mouthSurface.addColorStop(1, palette.shade);
  ctx.fillStyle = mouthSurface;
  ctx.fill();
}

function mouthPalette(colour: BlobColour) {
  switch (colour) {
    case "teal":
      return {
        shade: "#06383e",
      };
    case "yellow":
      return {
        shade: "#3d2c0b",
      };
    case "green":
      return {
        shade: "#123e1d",
      };
    case "blue":
      return {
        shade: "#082b58",
      };
    case "red":
      return {
        shade: "#4b0d19",
      };
    default:
      return {
        shade: "#1b0c42",
      };
  }
}

/**
 * Eye mass plus both lids, from one shared geometry.
 *
 * The lids are not painted objects: they are the parts of the aperture the eye
 * is clipped out of, so the body surface already drawn underneath shows
 * through untouched. That removes every possible outline, halo or second oval,
 * and guarantees the lids can never be a different size to the eye.
 *
 * The open band is centred on the eye itself, so the top lid closes downward,
 * the bottom lid closes upward, and a squint moves both toward the centre.
 */

/**
 * Scratch buffer for the antialiased eye mask.
 *
 * Canvas `clip()` is a hard, unantialiased mask in every major engine, so the
 * eye's lid contours — the shallowest curves on the face — used to land as a
 * one-pixel staircase against the pale body. Compositing the same two shapes
 * in an offscreen buffer with `source-in` intersects two *antialiased fills*
 * instead, so the coverage is analytic: solid black centre, one clean alpha
 * step, then character material.
 *
 * The buffer is module-level and only grows, so a frame costs one clear, two
 * fills and one blit — no per-frame allocation, and no filter passes. On the
 * device the same result is a small precomputed alpha sprite blitted with a
 * coverage multiply, which is why this stays honest for the ESP32 target.
 */
let eyeScratch: HTMLCanvasElement | null = null;
let eyeScratchCtx: CanvasRenderingContext2D | null = null;

function acquireEyeScratch(width: number, height: number) {
  if (typeof document === "undefined") return null;
  if (!eyeScratch) {
    eyeScratch = document.createElement("canvas");
    eyeScratchCtx = eyeScratch.getContext("2d");
  }
  if (!eyeScratchCtx) return null;
  if (eyeScratch.width < width || eyeScratch.height < height) {
    eyeScratch.width = Math.max(eyeScratch.width, width);
    eyeScratch.height = Math.max(eyeScratch.height, height);
  }
  eyeScratchCtx.setTransform(1, 0, 0, 1, 0, 0);
  eyeScratchCtx.clearRect(0, 0, width, height);
  eyeScratchCtx.globalCompositeOperation = "source-over";
  return eyeScratchCtx;
}

/** Total scale the context is currently drawing at, for mask supersampling. */
function contextScale(ctx: CanvasRenderingContext2D) {
  const t = ctx.getTransform();
  return Math.max(1, Math.hypot(t.a, t.b));
}

export function drawProceduralEye(
  ctx: CanvasRenderingContext2D,
  eye: EyeGeometry,
  showPupil: boolean,
  pupilX: number,
  pupilY: number,
  pupilScale: number,
  lidBias: number
) {
  if (eye.open <= 0.004) return;
  const gap = eye.height * eye.open;
  const top = eye.centerY - gap / 2;
  const bottom = eye.centerY + gap / 2;
  // A small slope gives the upper and lower lids separate intent without
  // adding a second eye asset. Negative values lower the inner edge of the
  // left eye; positive values lower the inner edge of the right eye.
  const lidTilt = clamp(lidBias, -1, 1) * eye.height * 0.16;

  // Local bounding box of the aperture band, with a pixel of slack so the
  // alpha ramp is never clipped by the buffer itself.
  const pad = 2;
  const boxX = eye.centerX - eye.width - pad;
  const boxY = eye.centerY - eye.height - pad;
  const boxW = eye.width * 2 + pad * 2;
  const boxH = eye.height * 2 + pad * 2;

  // Rasterise the mask at the resolution it will actually be shown at, so the
  // blit resamples nothing and the eye stays as sharp as a direct fill.
  const ss = Math.min(4, Math.max(2, Math.ceil(contextScale(ctx) * 1.5)));
  const scratch = acquireEyeScratch(Math.ceil(boxW * ss), Math.ceil(boxH * ss));

  const paint = (target: CanvasRenderingContext2D) => {
    target.beginPath();
    target.moveTo(eye.centerX - eye.width, top + lidTilt);
    target.quadraticCurveTo(
      eye.centerX,
      top - lidTilt * 0.22,
      eye.centerX + eye.width,
      top - lidTilt
    );
    target.lineTo(eye.centerX + eye.width, bottom - lidTilt);
    target.quadraticCurveTo(
      eye.centerX,
      bottom + lidTilt * 0.18,
      eye.centerX - eye.width,
      bottom + lidTilt
    );
    target.closePath();
  };

  if (!scratch) {
    // No DOM (tests, workers): fall back to the hard clip rather than nothing.
    ctx.save();
    paint(ctx);
    ctx.clip();
    ctx.beginPath();
    ctx.ellipse(eye.centerX, eye.centerY, eye.width * 0.5, eye.height * 0.5, 0, 0, Math.PI * 2);
    ctx.fillStyle = "#010204";
    ctx.fill();
    ctx.restore();
    return;
  }

  scratch.save();
  scratch.scale(ss, ss);
  scratch.translate(-boxX, -boxY);

  // Aperture band first, then the eye mass intersected into it. Both are
  // ordinary fills, so both carry real edge coverage.
  paint(scratch);
  scratch.fillStyle = "#010204";
  scratch.fill();

  scratch.globalCompositeOperation = "source-in";
  scratch.beginPath();
  scratch.ellipse(
    eye.centerX,
    eye.centerY,
    eye.width * 0.5,
    eye.height * 0.5,
    0,
    0,
    Math.PI * 2
  );
  scratch.fillStyle = "#010204";
  scratch.fill();

  // The developer gaze glint rides inside the finished mask.
  if (showPupil) {
    scratch.globalCompositeOperation = "source-atop";
    scratch.beginPath();
    scratch.arc(
      eye.centerX + clamp(pupilX, -eye.width * 0.22, eye.width * 0.22),
      eye.centerY + clamp(pupilY, -eye.height * 0.16, eye.height * 0.16),
      Math.max(0.8, Math.min(1.7, eye.width * 0.06 * clamp(pupilScale, 0.55, 1.45))),
      0,
      Math.PI * 2
    );
    scratch.fillStyle = "rgba(255, 255, 255, 0.9)";
    scratch.fill();
  }
  scratch.restore();

  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(
    scratch.canvas,
    0,
    0,
    Math.ceil(boxW * ss),
    Math.ceil(boxH * ss),
    boxX,
    boxY,
    boxW,
    boxH
  );
  ctx.restore();
}

/**
 * A soft rounded bar above the eye.
 *
 * Position is derived from the same EyeGeometry as the eye, and a hard
 * geometric clearance rule keeps the brow's lowest rotated point above the
 * eye's top edge in every pose — squint, angry tilt, or downward gaze.
 */
export function drawEyebrow(
  ctx: CanvasRenderingContext2D,
  eye: EyeGeometry,
  browLift: number,
  browRotation: number,
  clearance: number
) {
  const halfWidth = eye.width * 0.46;
  const thickness = clamp(eye.width * 0.13, 1.6, 2.8);
  const halfThickness = thickness / 2;
  const arch = clamp((browLift + 0.05) * eye.height * 0.22, -1.2, 1.4);

  // Gaze leans the brow with the eye: right gaze tilts right, left tilts left,
  // and the pair shifts slightly in the direction Blob is looking.
  const look = clamp(eye.centerX / Math.max(eye.width * GAZE_TRAVEL_X, 0.001), -1, 1);
  const offsetX = eye.centerX * 0.18;
  // Directional lean stacks with an authored angry tilt, but the total stays
  // small enough that two brows can never read as crossed.
  const tilt = clamp(look * 4.5 + browRotation, -11, 11);
  const radians = (tilt * Math.PI) / 180;

  const eyeTop = eye.centerY - eye.height * 0.5;
  // Looking up raises the brow a little further than the eye alone does;
  // looking down lowers it, but only until the clearance rule takes over.
  let browY = eyeTop - eye.height * 0.2 - browLift * eye.height * 0.22 + eye.centerY * 0.1;
  // Lowest point of the rotated, arched bar measured from its own centre.
  const reach =
    halfThickness * Math.abs(Math.cos(radians)) +
    (halfWidth + halfThickness) * Math.abs(Math.sin(radians)) +
    Math.max(0, -arch);
  browY = Math.min(browY, eyeTop - clearance - reach);

  ctx.save();
  ctx.translate(offsetX, browY);
  ctx.rotate(radians);
  // Filled contour rather than a canvas stroke keeps the brow crisp when the
  // whole character is rasterised at true hardware pixels.
  const controlY = -arch;
  ctx.beginPath();
  ctx.moveTo(-halfWidth, -halfThickness);
  ctx.quadraticCurveTo(0, controlY - halfThickness, halfWidth, -halfThickness);
  ctx.quadraticCurveTo(
    halfWidth + halfThickness,
    -halfThickness,
    halfWidth + halfThickness,
    0
  );
  ctx.quadraticCurveTo(
    halfWidth + halfThickness,
    halfThickness,
    halfWidth,
    halfThickness
  );
  ctx.quadraticCurveTo(0, controlY + halfThickness, -halfWidth, halfThickness);
  ctx.quadraticCurveTo(
    -halfWidth - halfThickness,
    halfThickness,
    -halfWidth - halfThickness,
    0
  );
  ctx.quadraticCurveTo(
    -halfWidth - halfThickness,
    -halfThickness,
    -halfWidth,
    -halfThickness
  );
  ctx.closePath();
  ctx.fillStyle = "#010204";
  ctx.fill();
  ctx.restore();
}


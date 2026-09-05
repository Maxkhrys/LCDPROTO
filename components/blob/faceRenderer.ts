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
  colour: BlobColour
) {
  const o = clamp(oAmount, 0, 1);
  const d = clamp(dAmount, 0, 1);

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

  const halfWidth = width * (0.5 - o * 0.08);
  const thickness = Math.max(1.8, height * (0.2 + o * 0.045));
  const loopDepth = height * 0.42 * o;
  const bend = curve * height * 0.5 * (1 - o);
  const endY = -curve * height * 0.08 * (1 - o);
  const topEnd = endY - thickness;
  const bottomEnd = endY + thickness;
  const topCenter = endY + bend - thickness - loopDepth;
  const bottomCenter = endY + bend + thickness + loopDepth;
  const capReach = Math.max(1.2, thickness * 1.35);

  // One continuous filled contour. At zero O it is a soft, round-ended bar.
  // As O rises, that same contour opens vertically and closes into one oval.
  // There are no end dots, added blobs, asset swaps, or rotation tricks.
  ctx.beginPath();
  ctx.moveTo(-halfWidth, topEnd);
  ctx.quadraticCurveTo(0, topCenter, halfWidth, topEnd);
  ctx.bezierCurveTo(
    halfWidth + capReach,
    topEnd,
    halfWidth + capReach,
    bottomEnd,
    halfWidth,
    bottomEnd
  );
  ctx.quadraticCurveTo(0, bottomCenter, -halfWidth, bottomEnd);
  ctx.bezierCurveTo(
    -halfWidth - capReach,
    bottomEnd,
    -halfWidth - capReach,
    topEnd,
    -halfWidth,
    topEnd
  );
  ctx.closePath();
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
  ctx.save();
  // Only this curved band of the eye survives. The body surface already painted
  // underneath is the upper and lower lid, so no opaque lid rectangle can ever
  // expose a seam over the character.
  ctx.beginPath();
  ctx.moveTo(eye.centerX - eye.width, top + lidTilt);
  ctx.quadraticCurveTo(
    eye.centerX,
    top - lidTilt * 0.22,
    eye.centerX + eye.width,
    top - lidTilt
  );
  ctx.lineTo(eye.centerX + eye.width, bottom - lidTilt);
  ctx.quadraticCurveTo(
    eye.centerX,
    bottom + lidTilt * 0.18,
    eye.centerX - eye.width,
    bottom + lidTilt
  );
  ctx.closePath();
  ctx.clip();
  ctx.beginPath();
  ctx.ellipse(
    eye.centerX,
    eye.centerY,
    eye.width * 0.5,
    eye.height * 0.5,
    0,
    0,
    Math.PI * 2
  );
  ctx.fillStyle = "#010204";
  ctx.fill();

  // The normal face is the original solid black eye. The optional developer
  // preview only adds one tiny white glint so gaze can be inspected without
  // changing the shipped eye artwork or turning it into an iris.
  if (showPupil) {
    ctx.beginPath();
    ctx.arc(
      eye.centerX + clamp(pupilX, -eye.width * 0.22, eye.width * 0.22),
      eye.centerY + clamp(pupilY, -eye.height * 0.16, eye.height * 0.16),
      Math.max(0.8, Math.min(1.7, eye.width * 0.06 * clamp(pupilScale, 0.55, 1.45))),
      0,
      Math.PI * 2
    );
    ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
    ctx.fill();
  }
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


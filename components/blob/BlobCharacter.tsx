"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import type { BlobDragController } from "@/lib/blobDrag";
import {
  NEUTRAL_RIG,
  RIG_ASSETS,
  BODY_FRACTION,
  bodyScale,
  faceAnchor,
  FACE_STYLE,
  type BlobRig,
  type BlobColour,
  type ElementTransform,
  type FaceLayerId,
} from "@/lib/blobRig";
import { drawDownscaled } from "./downscale";

interface BlobCharacterProps {
  /** Native screen size in pixels (466). */
  size: number;
  /** Pixels rasterised per 466-space pixel. */
  renderScale: number;
  /** Visible CSS diameter; drawing coordinates remain in native space. */
  viewportSize?: number;
  /** Per-element transforms. Defaults to the neutral HOME pose. */
  rig?: BlobRig;
  /** Dev-only colour testing; geometry and motion are shared. */
  colour?: BlobColour;
  /** Opens the floating Blob tool orbs after a deliberate double tap. */
  onOpenTools?: () => void;
  /** Closes floating tools after a single tap while they are open. */
  onCloseTools?: () => void;
  /** Moves Blob under the tools and makes his gaze follow them. */
  settingsOpen?: boolean;
  /** Dev-only pupil preview. */
  showPupils?: boolean;
  /** Optional pointer grab. When absent the canvas stays tap-only. */
  drag?: BlobDragController;
}

/** Native-space pointer travel that turns a tap into a drag. */
const DRAG_THRESHOLD = 4;
/** Taps are ignored for this long after a real drag ends. */
const TAP_SUPPRESSION_MS = 350;

type LayerId = "body";
type Images = Record<LayerId, HTMLImageElement>;

/**
 * Facial features follow the body's complete surface transform. Only their
 * artwork scale is partially compensated, so the features stay crisp while
 * their attachment points still move like skin.
 */
const FACE_ART_SURFACE_INHERIT = 0.56;

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
const BROW_CLEARANCE_RATIO = 2.4 / 466;

function eyeGeometry(
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

function applyBodySurface(
  ctx: CanvasRenderingContext2D,
  center: number,
  bodyWidth: number,
  bodyHeight: number,
  transform: ElementTransform
) {
  const pivotX = transform.originX * (bodyWidth / 2);
  const pivotY = transform.originY * (bodyHeight / 2);
  ctx.translate(center + transform.x + pivotX, center + transform.y + pivotY);
  ctx.rotate((transform.rotation * Math.PI) / 180);
  ctx.transform(
    1,
    Math.tan((transform.skewY * Math.PI) / 180),
    Math.tan((transform.skewX * Math.PI) / 180),
    1,
    0,
    0
  );
  // Scale along an arbitrary local pair of axes. This lets a circular-edge
  // contact compress into top, bottom, side and diagonal walls without
  // rotating the artwork or relying on horizontal-only deformation.
  const deformAngle = (transform.deformAngle * Math.PI) / 180;
  ctx.rotate(deformAngle);
  ctx.scale(transform.scaleX, transform.scaleY);
  ctx.rotate(-deformAngle);
  ctx.translate(-pivotX, -pivotY);
}

function drawMouthShape(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  curve: number,
  oAmount: number,
  colour: BlobColour
) {
  const o = clamp(oAmount, 0, 1);
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
  const palette = eyePalette(colour);
  const mouthSurface = ctx.createLinearGradient(0, -height, 0, height);
  mouthSurface.addColorStop(0, "#020203");
  mouthSurface.addColorStop(0.7, "#050506");
  mouthSurface.addColorStop(1, palette.shade);
  ctx.fillStyle = mouthSurface;
  ctx.fill();
}

function eyePalette(colour: BlobColour) {
  switch (colour) {
    case "teal":
      return {
        shade: "#06383e",
        rim: "#147d83",
        wash: "rgba(26, 207, 205, 0.42)",
        washEdge: "rgba(26, 207, 205, 0)",
        iris: "#67e7df",
        irisDeep: "#0c5c68",
        accent: "#ff709d",
        sclera: "#fff8ef",
        lash: "#102b32",
      };
    case "yellow":
      return {
        shade: "#3d2c0b",
        rim: "#9b711b",
        wash: "rgba(242, 190, 55, 0.38)",
        washEdge: "rgba(242, 190, 55, 0)",
        iris: "#8ba7ff",
        irisDeep: "#39467e",
        accent: "#ff647e",
        sclera: "#fff9e8",
        lash: "#35250d",
      };
    case "green":
      return {
        shade: "#123e1d",
        rim: "#348b32",
        wash: "rgba(108, 217, 75, 0.38)",
        washEdge: "rgba(108, 217, 75, 0)",
        iris: "#a7ec73",
        irisDeep: "#2d7436",
        accent: "#ff7899",
        sclera: "#f8fff0",
        lash: "#142d1a",
      };
    case "blue":
      return {
        shade: "#082b58",
        rim: "#1c75c7",
        wash: "rgba(64, 170, 255, 0.38)",
        washEdge: "rgba(64, 170, 255, 0)",
        iris: "#8bc2ff",
        irisDeep: "#20519b",
        accent: "#ff80a8",
        sclera: "#f3f8ff",
        lash: "#0d2145",
      };
    case "red":
      return {
        shade: "#4b0d19",
        rim: "#c92b3d",
        wash: "rgba(255, 80, 76, 0.38)",
        washEdge: "rgba(255, 80, 76, 0)",
        iris: "#ffd878",
        irisDeep: "#843126",
        accent: "#ffd563",
        sclera: "#fff6e7",
        lash: "#35101b",
      };
    default:
      return {
        shade: "#1b0c42",
        rim: "#6529c5",
        wash: "rgba(127, 67, 235, 0.42)",
        washEdge: "rgba(127, 67, 235, 0)",
        iris: "#c09cff",
        irisDeep: "#4b2f9d",
        accent: "#ff78b5",
        sclera: "#fff7ff",
        lash: "#1c102d",
      };
  }
}

function drawHeart(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  colour: string
) {
  ctx.beginPath();
  ctx.moveTo(x, y + size * 0.92);
  ctx.bezierCurveTo(
    x - size * 1.3,
    y + size * 0.12,
    x - size * 0.78,
    y - size * 0.86,
    x,
    y - size * 0.24
  );
  ctx.bezierCurveTo(
    x + size * 0.78,
    y - size * 0.86,
    x + size * 1.3,
    y + size * 0.12,
    x,
    y + size * 0.92
  );
  ctx.closePath();
  ctx.fillStyle = colour;
  ctx.fill();
}

function drawSparkle(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  colour: string
) {
  ctx.beginPath();
  ctx.moveTo(x, y - size);
  ctx.lineTo(x + size * 0.24, y - size * 0.24);
  ctx.lineTo(x + size, y);
  ctx.lineTo(x + size * 0.24, y + size * 0.24);
  ctx.lineTo(x, y + size);
  ctx.lineTo(x - size * 0.24, y + size * 0.24);
  ctx.lineTo(x - size, y);
  ctx.lineTo(x - size * 0.24, y - size * 0.24);
  ctx.closePath();
  ctx.fillStyle = colour;
  ctx.fill();
}

function drawDrop(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  colour: string
) {
  ctx.beginPath();
  ctx.moveTo(x, y - size);
  ctx.bezierCurveTo(
    x + size * 0.78,
    y - size * 0.08,
    x + size * 0.7,
    y + size * 0.72,
    x,
    y + size * 0.72
  );
  ctx.bezierCurveTo(
    x - size * 0.7,
    y + size * 0.72,
    x - size * 0.78,
    y - size * 0.08,
    x,
    y - size
  );
  ctx.closePath();
  ctx.fillStyle = colour;
  ctx.fill();
}

function drawAngerMark(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  colour: string
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-0.18);
  ctx.strokeStyle = colour;
  ctx.lineWidth = Math.max(1.2, size * 0.16);
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-size, -size * 0.24);
  ctx.lineTo(-size * 0.2, -size * 0.24);
  ctx.moveTo(size * 0.2, -size * 0.24);
  ctx.lineTo(size, -size * 0.24);
  ctx.moveTo(-size * 0.24, -size);
  ctx.lineTo(-size * 0.24, -size * 0.2);
  ctx.moveTo(-size * 0.24, size * 0.2);
  ctx.lineTo(-size * 0.24, size);
  ctx.stroke();
  ctx.restore();
}

function drawFaceAccents(
  ctx: CanvasRenderingContext2D,
  center: number,
  bodyWidth: number,
  bodyHeight: number,
  body: ElementTransform,
  styleCode: number,
  amount: number,
  colour: BlobColour
) {
  const strength = clamp(amount, 0, 1);
  if (strength < 0.02) return;
  const palette = eyePalette(colour);
  const cheekY = bodyHeight * 0.13;
  const cheekX = bodyWidth * 0.27;
  const accent = palette.accent;

  ctx.save();
  applyBodySurface(ctx, center, bodyWidth, bodyHeight, body);
  ctx.globalAlpha *= strength * 0.88;
  ctx.lineCap = "round";
  if (styleCode === FACE_STYLE.HAPPY || styleCode === FACE_STYLE.SHY || styleCode === FACE_STYLE.LOVE) {
    ctx.fillStyle = "rgba(255, 93, 143, 0.72)";
    ctx.beginPath();
    ctx.ellipse(-cheekX, cheekY, bodyWidth * 0.045, bodyHeight * 0.018, -0.14, 0, Math.PI * 2);
    ctx.ellipse(cheekX, cheekY, bodyWidth * 0.045, bodyHeight * 0.018, 0.14, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(255, 174, 192, 0.9)";
    ctx.lineWidth = Math.max(0.8, bodyWidth * 0.008);
    ctx.beginPath();
    ctx.moveTo(-cheekX - bodyWidth * 0.05, cheekY + bodyHeight * 0.026);
    ctx.lineTo(-cheekX - bodyWidth * 0.015, cheekY - bodyHeight * 0.018);
    ctx.moveTo(cheekX + bodyWidth * 0.015, cheekY - bodyHeight * 0.018);
    ctx.lineTo(cheekX + bodyWidth * 0.05, cheekY + bodyHeight * 0.026);
    ctx.stroke();
  }
  if (styleCode === FACE_STYLE.EXCITED || styleCode === FACE_STYLE.SURPRISED) {
    drawSparkle(ctx, -bodyWidth * 0.34, -bodyHeight * 0.28, bodyWidth * 0.045, palette.sclera);
    if (styleCode === FACE_STYLE.EXCITED) {
      drawSparkle(ctx, bodyWidth * 0.34, -bodyHeight * 0.2, bodyWidth * 0.026, palette.accent);
    }
  } else if (styleCode === FACE_STYLE.ANGRY) {
    drawAngerMark(ctx, bodyWidth * 0.31, -bodyHeight * 0.31, bodyWidth * 0.058, accent);
  } else if (styleCode === FACE_STYLE.SAD) {
    drawDrop(ctx, -bodyWidth * 0.158, -bodyHeight * 0.03, bodyWidth * 0.026, "#76cfff");
    drawDrop(ctx, bodyWidth * 0.158, -bodyHeight * 0.03, bodyWidth * 0.026, "#76cfff");
  } else if (styleCode === FACE_STYLE.CONFUSED || styleCode === FACE_STYLE.PANIC) {
    drawDrop(ctx, bodyWidth * 0.34, -bodyHeight * 0.16, bodyWidth * 0.052, "#75d9ff");
    ctx.strokeStyle = "rgba(117, 217, 255, 0.8)";
    ctx.lineWidth = Math.max(0.9, bodyWidth * 0.009);
    ctx.beginPath();
    ctx.moveTo(bodyWidth * 0.39, -bodyHeight * 0.29);
    ctx.lineTo(bodyWidth * 0.43, -bodyHeight * 0.33);
    ctx.stroke();
  } else if (styleCode === FACE_STYLE.SLEEPY) {
    ctx.strokeStyle = "rgba(255, 255, 255, 0.7)";
    ctx.lineWidth = Math.max(1, bodyWidth * 0.011);
    ctx.beginPath();
    ctx.moveTo(bodyWidth * 0.3, -bodyHeight * 0.3);
    ctx.lineTo(bodyWidth * 0.38, -bodyHeight * 0.3);
    ctx.lineTo(bodyWidth * 0.3, -bodyHeight * 0.22);
    ctx.lineTo(bodyWidth * 0.38, -bodyHeight * 0.22);
    ctx.moveTo(bodyWidth * 0.4, -bodyHeight * 0.39);
    ctx.lineTo(bodyWidth * 0.47, -bodyHeight * 0.39);
    ctx.lineTo(bodyWidth * 0.4, -bodyHeight * 0.32);
    ctx.lineTo(bodyWidth * 0.47, -bodyHeight * 0.32);
    ctx.stroke();
  } else if (styleCode === FACE_STYLE.DEADPAN) {
    ctx.strokeStyle = "rgba(255, 255, 255, 0.48)";
    ctx.lineWidth = Math.max(0.9, bodyWidth * 0.009);
    ctx.beginPath();
    ctx.moveTo(bodyWidth * 0.31, -bodyHeight * 0.31);
    ctx.lineTo(bodyWidth * 0.39, -bodyHeight * 0.31);
    ctx.stroke();
  }
  if (styleCode === FACE_STYLE.LOVE) {
    drawHeart(ctx, bodyWidth * 0.35, -bodyHeight * 0.34, bodyWidth * 0.04, accent);
  }
  ctx.restore();
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
function drawProceduralEye(
  ctx: CanvasRenderingContext2D,
  eye: EyeGeometry,
  showPupil: boolean,
  styleCode: number,
  pupilX: number,
  pupilY: number,
  pupilScale: number,
  lidBias: number,
  colour: BlobColour
) {
  if (eye.open <= 0.004) return;
  const palette = eyePalette(colour);
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
  ctx.fillStyle = palette.sclera;
  ctx.fill();

  const style = styleCode >= 0 ? styleCode : FACE_STYLE.CONTENT;
  const surprised =
    style === FACE_STYLE.SURPRISED || style === FACE_STYLE.EXCITED || style === FACE_STYLE.PANIC;
  const angry = style === FACE_STYLE.ANGRY || style === FACE_STYLE.DEADPAN;
  const irisRadius =
    Math.min(eye.width, eye.height) * (surprised ? 0.27 : angry ? 0.205 : 0.235);
  const irisX = eye.centerX + clamp(pupilX, -eye.width * 0.24, eye.width * 0.24);
  const irisY = eye.centerY + clamp(pupilY, -eye.height * 0.17, eye.height * 0.17);
  ctx.beginPath();
  ctx.ellipse(
    irisX,
    irisY,
    irisRadius * 0.86,
    irisRadius,
    0,
    0,
    Math.PI * 2
  );
  ctx.fillStyle = palette.iris;
  ctx.fill();
  ctx.strokeStyle = palette.irisDeep;
  ctx.lineWidth = Math.max(0.8, irisRadius * 0.16);
  ctx.stroke();

  const pupilRadius =
    irisRadius * 0.47 * clamp(pupilScale, 0.55, 1.45);
  if (style === FACE_STYLE.LOVE) {
    drawHeart(ctx, irisX, irisY + irisRadius * 0.02, pupilRadius * 1.18, palette.accent);
  } else {
    ctx.beginPath();
    ctx.arc(
      irisX,
      irisY + irisRadius * 0.06,
      Math.max(1.1, pupilRadius),
      0,
      Math.PI * 2
    );
    ctx.fillStyle = palette.irisDeep;
    ctx.fill();
  }

  // Catchlights stay on the same upper-left vector for every Blob colour and
  // every expression. The little second glint is what keeps the eye alive at
  // true 466px rendering instead of reading as a flat black sticker.
  ctx.beginPath();
  ctx.arc(
    irisX - irisRadius * 0.31,
    irisY - irisRadius * 0.34,
    Math.max(1.1, irisRadius * 0.2),
    0,
    Math.PI * 2
  );
  ctx.fillStyle = "rgba(255, 255, 255, 0.96)";
  ctx.fill();
  ctx.beginPath();
  ctx.arc(
    irisX + irisRadius * 0.17,
    irisY - irisRadius * 0.07,
    Math.max(0.55, irisRadius * 0.085),
    0,
    Math.PI * 2
  );
  ctx.fillStyle = "rgba(255, 255, 255, 0.84)";
  ctx.fill();
  if (showPupil) {
    ctx.beginPath();
    ctx.arc(irisX, irisY, Math.max(0.55, irisRadius * 0.09), 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.32)";
    ctx.lineWidth = 0.7;
    ctx.stroke();
  }
  ctx.restore();

  // A single crisp upper-lid accent makes angry/deadpan states read at a glance
  // while still leaving the lower lid as the body surface underneath.
  if (style === FACE_STYLE.ANGRY || style === FACE_STYLE.SLEEPY || style === FACE_STYLE.DEADPAN) {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(eye.centerX - eye.width * 0.39, top + lidTilt * 0.72);
    ctx.quadraticCurveTo(
      eye.centerX,
      top - eye.height * 0.06 - lidTilt * 0.1,
      eye.centerX + eye.width * 0.39,
      top - lidTilt * 0.72
    );
    ctx.strokeStyle = palette.lash;
    ctx.lineWidth = Math.max(1, eye.width * 0.045);
    ctx.lineCap = "round";
    ctx.stroke();
    ctx.restore();
  }
}

/**
 * A soft rounded bar above the eye.
 *
 * Position is derived from the same EyeGeometry as the eye, and a hard
 * geometric clearance rule keeps the brow's lowest rotated point above the
 * eye's top edge in every pose — squint, angry tilt, or downward gaze.
 */
function drawEyebrow(
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

/**
 * Renders the Blob as a locked body surface plus independent procedural facial
 * features. Each feature can be moved and shaped on its own, while its socket
 * remains attached to the body's surface. The body is never touched by facial
 * transforms.
 *
 * Drawing order is body -> brows/eyes -> mouth -> subtle skin integration.
 */
export default function BlobCharacter({
  size,
  viewportSize,
  renderScale,
  rig = NEUTRAL_RIG,
  colour = "purple",
  onOpenTools,
  onCloseTools,
  settingsOpen = false,
  showPupils = false,
  drag,
}: BlobCharacterProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [images, setImages] = useState<Images | null>(null);
  // Pointer bookkeeping lives in refs: a grab must never re-render the loop.
  const pointerId = useRef<number | null>(null);
  const downX = useRef(0);
  const downY = useRef(0);
  const dragging = useRef(false);
  const tapBlockedUntil = useRef(0);
  const [grabbing, setGrabbing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const assets = RIG_ASSETS[colour];
    const entries: [LayerId, string][] = [["body", assets.body.src]];
    setImages(null);
    Promise.all(
      entries.map(
        ([id, src]) =>
          new Promise<[LayerId, HTMLImageElement]>((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve([id, img]);
            img.onerror = () => reject(new Error(`Failed to load ${src}`));
            img.src = src;
          })
      )
    )
      .then((loaded) => {
        if (!cancelled) setImages(Object.fromEntries(loaded) as Images);
      })
      .catch(() => {
        /* Nothing to draw; the screen stays black. */
      });
    return () => {
      cancelled = true;
    };
  }, [colour]);

  /**
   * Bake each layer once at render resolution. Per-frame transforms then work
   * on small buffers instead of rescaling the ~1300px sources every frame.
   */
  const layers = useMemo(() => {
    if (!images || typeof document === "undefined") return null;

    const buffer = (w: number, h: number) => {
      const c = document.createElement("canvas");
      c.width = Math.max(1, Math.ceil(w));
      c.height = Math.max(1, Math.ceil(h));
      return c;
    };

    // Body: exported as RGB on black, so key its alpha from luminance. Without
    // this it would paint an opaque black square over the screen instead of
    // letting its glow fall off into the background.
    // The body PNG carries real alpha from the extraction, so nothing is keyed
    // here — it is simply resampled once to its on-screen size.
    const assets = RIG_ASSETS[colour];
    const bs = bodyScale(size, colour) * renderScale;
    const bodyCanvas = buffer(assets.body.width * bs, assets.body.height * bs);
    const bctx = bodyCanvas.getContext("2d");
    if (bctx) {
      drawDownscaled(
        bctx,
        images.body,
        assets.body.width,
        assets.body.height,
        0,
        0,
        bodyCanvas.width,
        bodyCanvas.height
      );
    }

    // Eyes and mouth are procedural. Their metadata remains in blobRig so
    // their sockets stay calibrated to each colour-specific body.
    return { body: bodyCanvas };
  }, [images, size, renderScale, colour]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx || !layers) return;

    ctx.setTransform(renderScale, 0, 0, renderScale, 0, 0);
    ctx.clearRect(0, 0, size, size);

    const center = size / 2;
    const { blob } = rig;
    const bodyAsset = RIG_ASSETS[colour].body;
    const bs = bodyScale(size, colour);
    const bw = bodyAsset.width * bs;
    const bh = bodyAsset.height * bs;
    const bt = rig.body;

    ctx.save();
    ctx.globalAlpha = blob.opacity;
    // Whole-character transform: the surface and every facial layer move
    // together before any local expression is applied.
    const settingsDrop = settingsOpen ? size * 0.075 : 0;
    const depthScale = clamp(1 + blob.depth * 0.28, 0.84, 1.16);
    const yawRadians = (blob.yaw * Math.PI) / 180;
    // A raster character cannot be truly perspective-rendered on the ESP32,
    // but foreshortening the width and softly hiding the face at profile gives
    // the eye a convincing near/far turn with only scalar canvas transforms.
    const yawWidth = 0.34 + Math.abs(Math.cos(yawRadians)) * 0.66;
    // Small destination turns must keep face fully readable. Fade only once
    // Blob is genuinely near profile during a 3D turn.
    const profileAmount = Math.max(0, Math.abs(Math.sin(yawRadians)) - 0.42);
    const faceVisibility = clamp(1 - profileAmount * 1.55, 0.18, 1);
    ctx.translate(
      center + blob.x,
      center + blob.y + settingsDrop - blob.pitch * 0.18
    );
    ctx.rotate((blob.rotation * Math.PI) / 180);
    ctx.scale(
      blob.scale * depthScale * yawWidth * blob.scaleX,
      blob.scale * depthScale * blob.scaleY
    );
    ctx.translate(-center, -center);

    // 1. Body surface. This exact transform is reused for the facial anchors.
    ctx.save();
    ctx.globalAlpha = bt.opacity;
    applyBodySurface(ctx, center, bw, bh, bt);
    ctx.drawImage(layers.body, -bw / 2, -bh / 2, bw, bh);
    ctx.restore();

    // The surface carries the full body deformation. The face artwork gets a
    // smaller share of scale deformation so eyes and mouth remain legible.
    const faceSurfaceScaleX =
      1 + (bt.scaleX - 1) * FACE_ART_SURFACE_INHERIT;
    const faceSurfaceScaleY =
      1 + (bt.scaleY - 1) * FACE_ART_SURFACE_INHERIT;
    const faceCompensationX = faceSurfaceScaleX / Math.max(0.1, bt.scaleX);
    const faceCompensationY = faceSurfaceScaleY / Math.max(0.1, bt.scaleY);

    // Eyes are sockets in body space. Gaze offsets move the texture inside a
    // fixed aperture; blink and squint clip from the top while the lower edge
    // stays planted.
    const browClearance = size * BROW_CLEARANCE_RATIO;
    const drawEye = (id: FaceLayerId, t: ElementTransform) => {
      const a = faceAnchor(id, size, colour);
      const socketX = a.x - center + t.socketX;
      const socketY = a.y - center + t.socketY;
      // One geometry drives the eye, both lids and the brow. Nothing else may
      // compute an eye size, so they cannot drift apart again.
      const eye = eyeGeometry(a.width, a.height, t, settingsOpen);

      // Brows are part of the facial surface, not a separate floating asset.
      // They rise with curiosity, lean with gaze, and are held clear of the
      // eye by drawEyebrow's own geometric clearance rule.
      ctx.save();
      ctx.globalAlpha = t.opacity * faceVisibility * 0.88;
      applyBodySurface(ctx, center, bw, bh, bt);
      ctx.translate(socketX, socketY);
      drawEyebrow(ctx, eye, t.browLift, t.browRotation, browClearance);
      ctx.restore();

      ctx.save();
      ctx.globalAlpha = t.opacity * faceVisibility;
      applyBodySurface(ctx, center, bw, bh, bt);
      ctx.translate(socketX, socketY);
      ctx.rotate((t.rotation * Math.PI) / 180);
      drawProceduralEye(
        ctx,
        eye,
        showPupils,
        t.eyeStyle >= 0 ? t.eyeStyle : blob.faceStyle,
        t.pupilX,
        t.pupilY,
        t.pupilScale,
        t.lidBias,
        colour
      );
      ctx.restore();
    };

    const drawMouth = (t: ElementTransform) => {
      const a = faceAnchor("mouth", size, colour);
      ctx.save();
      ctx.globalAlpha = t.opacity * faceVisibility;
      applyBodySurface(ctx, center, bw, bh, bt);
      ctx.translate(a.x - center + t.x, a.y - center + t.y);
      // Mouth orientation stays upright. Smile, frown and O are all shape
      // changes on one path, so expression changes never spin the mouth.
      ctx.scale(faceCompensationX, faceCompensationY);
      drawMouthShape(
        ctx,
        a.width * 0.95 * clamp(t.scaleX, 0.62, 1.18),
        a.height * 1.08 * clamp(t.scaleY, 0.7, 1.24),
        clamp(t.mouthCurve, -1, 1),
        clamp(t.mouthO, 0, 1),
        colour
      );
      ctx.restore();
    };

    drawEye("leftEye", rig.leftEye);
    drawEye("rightEye", rig.rightEye);
    drawMouth(rig.mouth);
    drawFaceAccents(
      ctx,
      center,
      bw,
      bh,
      bt,
      blob.faceStyle,
      blob.faceAccent,
      colour
    );

    ctx.restore();
  }, [layers, size, renderScale, rig, colour, showPupils, settingsOpen]);

  const nativePoint = (
    element: HTMLCanvasElement,
    clientX: number,
    clientY: number
  ) => {
    // Map browser coordinates into 466-space, whatever the simulator's scale.
    const rect = element.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) / rect.width) * size,
      y: ((clientY - rect.top) / rect.height) * size,
    };
  };

  const hitTest = (x: number, y: number) => {
    const blobX = size / 2 + rig.blob.x;
    const blobY = size / 2 + rig.blob.y + (settingsOpen ? size * 0.075 : 0);
    return Math.hypot(x - blobX, y - blobY) <= size * BODY_FRACTION * 0.62;
  };

  const isBlobHit = (event: MouseEvent<HTMLCanvasElement>) => {
    const p = nativePoint(event.currentTarget, event.clientX, event.clientY);
    return hitTest(p.x, p.y);
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!drag) return;
    const p = nativePoint(event.currentTarget, event.clientX, event.clientY);
    if (!hitTest(p.x, p.y)) return;
    pointerId.current = event.pointerId;
    downX.current = p.x;
    downY.current = p.y;
    dragging.current = false;
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!drag || pointerId.current !== event.pointerId) return;
    const p = nativePoint(event.currentTarget, event.clientX, event.clientY);
    if (!dragging.current) {
      // Below the threshold this is still a tap, so nothing moves yet.
      if (Math.hypot(p.x - downX.current, p.y - downY.current) < DRAG_THRESHOLD)
        return;
      dragging.current = true;
      setGrabbing(true);
      drag.begin(downX.current, downY.current, event.timeStamp);
    }
    drag.move(p.x, p.y, event.timeStamp);
  };

  const endPointer = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (pointerId.current !== event.pointerId) return;
    pointerId.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (dragging.current) {
      dragging.current = false;
      setGrabbing(false);
      drag?.end();
      // A drag must never also count as the first half of a double tap.
      tapBlockedUntil.current = performance.now() + TAP_SUPPRESSION_MS;
    }
  };

  const tapAllowed = () => performance.now() >= tapBlockedUntil.current;
  const cssSize = viewportSize ?? size;

  return (
    <canvas
      ref={canvasRef}
      width={size * renderScale}
      height={size * renderScale}
      className="block"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endPointer}
      onPointerCancel={endPointer}
      onClick={(event) => {
        if (!tapAllowed()) return;
        if (settingsOpen && onCloseTools && isBlobHit(event)) onCloseTools();
      }}
      onDoubleClick={(event) => {
        if (!tapAllowed()) return;
        if (!settingsOpen && onOpenTools && isBlobHit(event)) onOpenTools();
      }}
      style={{
        width: cssSize,
        height: cssSize,
        imageRendering: "auto",
        touchAction: drag ? "none" : undefined,
        cursor: drag ? (grabbing ? "grabbing" : "grab") : undefined,
      }}
    />
  );
}

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
const SKIN_INTEGRATION_ALPHA = 0.055;

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
  /** Independent lid closure from each side, 0..1. */
  lidUpper: number;
  lidLower: number;
  /** Lid slant in degrees and lid curvature. */
  tilt: number;
  curve: number;
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
    lidUpper: clamp(t.lidUpper, 0, 1),
    lidLower: clamp(t.lidLower, 0, 1),
    tilt: clamp(t.lidTilt, -22, 22),
    curve: clamp(t.lidCurve, -1, 1),
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
  ctx.scale(transform.scaleX, transform.scaleY);
  ctx.translate(-pivotX, -pivotY);
}

function drawMouthShape(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  curve: number,
  oAmount: number,
  cornerLeft: number,
  cornerRight: number,
  colour: BlobColour
) {
  const o = clamp(oAmount, 0, 1);
  const halfWidth = width * (0.5 - o * 0.08);
  const thickness = Math.max(1.8, height * (0.2 + o * 0.045));
  const loopDepth = height * 0.42 * o;
  const bend = curve * height * 0.5 * (1 - o);
  const endY = -curve * height * 0.08 * (1 - o);
  // Independent corners. A single symmetric curve can only ever be a smile or
  // a frown; lifting one corner on its own is what reads as a smirk, and
  // lifting them unequally is what makes an uncertain mouth look uncertain.
  const liftLeft = -cornerLeft * height * 0.42 * (1 - o);
  const liftRight = -cornerRight * height * 0.42 * (1 - o);
  const topLeft = endY - thickness + liftLeft;
  const bottomLeft = endY + thickness + liftLeft;
  const topRight = endY - thickness + liftRight;
  const bottomRight = endY + thickness + liftRight;
  const topCenter = endY + bend - thickness - loopDepth;
  const bottomCenter = endY + bend + thickness + loopDepth;
  const capReach = Math.max(1.2, thickness * 1.35);

  // One continuous filled contour. At zero O it is a soft, round-ended bar.
  // As O rises, that same contour opens vertically and closes into one oval.
  // There are no end dots, added blobs, asset swaps, or rotation tricks.
  ctx.beginPath();
  ctx.moveTo(-halfWidth, topLeft);
  ctx.quadraticCurveTo(0, topCenter, halfWidth, topRight);
  ctx.bezierCurveTo(
    halfWidth + capReach,
    topRight,
    halfWidth + capReach,
    bottomRight,
    halfWidth,
    bottomRight
  );
  ctx.quadraticCurveTo(0, bottomCenter, -halfWidth, bottomLeft);
  ctx.bezierCurveTo(
    -halfWidth - capReach,
    bottomLeft,
    -halfWidth - capReach,
    topLeft,
    -halfWidth,
    topLeft
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
      };
    case "yellow":
      return {
        shade: "#3d2c0b",
        rim: "#9b711b",
        wash: "rgba(242, 190, 55, 0.38)",
        washEdge: "rgba(242, 190, 55, 0)",
      };
    case "green":
      return {
        shade: "#123e1d",
        rim: "#348b32",
        wash: "rgba(108, 217, 75, 0.38)",
        washEdge: "rgba(108, 217, 75, 0)",
      };
    case "blue":
      return {
        shade: "#082b58",
        rim: "#1c75c7",
        wash: "rgba(64, 170, 255, 0.38)",
        washEdge: "rgba(64, 170, 255, 0)",
      };
    case "red":
      return {
        shade: "#4b0d19",
        rim: "#c92b3d",
        wash: "rgba(255, 80, 76, 0.38)",
        washEdge: "rgba(255, 80, 76, 0)",
      };
    default:
      return {
        shade: "#1b0c42",
        rim: "#6529c5",
        wash: "rgba(127, 67, 235, 0.42)",
        washEdge: "rgba(127, 67, 235, 0)",
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
function drawProceduralEye(
  ctx: CanvasRenderingContext2D,
  eye: EyeGeometry,
  showPupil: boolean
) {
  // Blink multiplies both lids, so a blink still closes a squinting eye.
  const blink = 1 - eye.open;
  const upper = clamp(eye.lidUpper + blink * (1 - eye.lidUpper), 0, 1);
  const lower = clamp(eye.lidLower + blink * (1 - eye.lidLower), 0, 1);
  if (upper + lower >= 0.996) return;

  const halfHeight = eye.height * 0.5;
  const halfWidth = eye.width * 0.5;
  // Each lid edge, measured from the eye's own centre.
  const upperEdge = eye.centerY - halfHeight + eye.height * upper;
  const lowerEdge = eye.centerY + halfHeight - eye.height * lower;
  if (lowerEdge - upperEdge < 0.35) return;

  const slant = Math.tan((eye.tilt * Math.PI) / 180) * halfWidth;
  // Curvature is what turns a narrowed eye into a crescent rather than a slot.
  const bow = eye.curve * eye.height * 0.34;
  const reach = halfWidth * 1.4;

  ctx.save();
  // The visible eye is whatever survives between the two lid lines. Clipping
  // with curves rather than a rectangle is what lets the lids carry shape.
  ctx.beginPath();
  ctx.moveTo(-reach, upperEdge - slant);
  ctx.quadraticCurveTo(0, upperEdge - bow, reach, upperEdge + slant);
  ctx.lineTo(reach, lowerEdge + slant);
  ctx.quadraticCurveTo(0, lowerEdge - bow * 0.45, -reach, lowerEdge - slant);
  ctx.closePath();
  ctx.clip();

  ctx.beginPath();
  ctx.ellipse(
    eye.centerX,
    eye.centerY,
    halfWidth,
    halfHeight,
    0,
    0,
    Math.PI * 2
  );
  ctx.fillStyle = "#010204";
  ctx.fill();
  if (showPupil) {
    ctx.beginPath();
    ctx.arc(
      eye.centerX - eye.width * 0.18,
      eye.centerY - eye.height * 0.22,
      Math.max(0.75, Math.min(eye.width, eye.height) * 0.065),
      0,
      Math.PI * 2
    );
    ctx.fillStyle = "rgba(255, 255, 255, 0.92)";
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
 * Number of horizontal slices the body is drawn in when it is deforming.
 *
 * Enough that the stepped edges between slices stay sub-pixel at native size,
 * few enough that the device can afford one scaled blit each. The flat draw is
 * still used whenever nothing is squashing him, so idle costs nothing extra.
 */
const SOFT_SLICES = 40;
/** Below this contact pressure the cheap single drawImage is used instead. */
const SOFT_THRESHOLD = 0.012;

/**
 * The four ripple springs as a smooth curve down the body.
 *
 * They sit at the centres of the four bands; between them the value is
 * interpolated, so neighbouring slices never jump.
 */
function sampleWave(t: ElementTransform, v: number) {
  const points = [t.rippleTop, t.rippleUpper, t.rippleLower, t.rippleBottom];
  // Map v (-1..1) onto the control points at -0.75, -0.25, 0.25, 0.75.
  const position = clamp((v + 0.75) / 0.5, 0, points.length - 1);
  const index = Math.floor(position);
  const next = Math.min(points.length - 1, index + 1);
  const blend = position - index;
  // Smoothstep between control points keeps the first derivative gentle.
  const eased = blend * blend * (3 - 2 * blend);
  return points[index] + (points[next] - points[index]) * eased;
}

/**
 * Draws the body as a soft silhouette that genuinely changes shape.
 *
 * Scaling the whole sprite reads as Blob getting smaller, not squashed. A real
 * jelly pressed against something flattens on the contact side, bulges either
 * side of the contact, and keeps roughly its area. This slices the cached body
 * into horizontal bands and gives each its own width, x offset and height, so
 * the outline itself deforms.
 *
 * Each slice is one drawImage of the already-rasterised body — no mesh, no
 * filters, no new artwork — which is a scanline blit on the device.
 */
function drawSoftBody(
  ctx: CanvasRenderingContext2D,
  image: HTMLCanvasElement,
  width: number,
  height: number,
  t: ElementTransform
) {
  const pressure = clamp(t.contactPressure, 0, 1);
  const wobble =
    Math.abs(t.rippleTop) +
    Math.abs(t.rippleUpper) +
    Math.abs(t.rippleLower) +
    Math.abs(t.rippleBottom);

  if (pressure < SOFT_THRESHOLD && wobble < 0.25) {
    // Nothing is deforming him; keep the single crisp blit.
    ctx.drawImage(image, -width / 2, -height / 2, width, height);
    return;
  }

  const nx = t.contactX;
  const ny = t.contactY;
  const lateral = Math.abs(nx);
  const vertical = Math.abs(ny);
  const sliceHeight = height / SOFT_SLICES;
  const sourceSlice = image.height / SOFT_SLICES;
  const halfWidth = width / 2;

  for (let i = 0; i < SOFT_SLICES; i += 1) {
    const centre = (i + 0.5) / SOFT_SLICES;
    // -1 at the top of the body, +1 at the bottom.
    const v = centre * 2 - 1;

    // How much this slice is involved in the contact. A raised cosine across
    // the whole body: peaked at the contact latitude but with a gentle slope
    // everywhere, so neighbouring slices never differ by much. A narrow
    // triangular profile here swung the width 85% across twenty slices and
    // combed the silhouette into visible teeth.
    const reach = clamp((v - ny) * 0.85, -1, 1);
    const involvement = 0.5 * (1 + Math.cos(reach * Math.PI));

    // Side-on contact flattens the edge Blob is pressed against, and lets the
    // displaced volume out of the other side. Working per edge rather than on
    // the total width is what produces a flat face against the wall instead
    // of a symmetrically thinner Blob.
    const squashEdge = pressure * lateral * involvement * 0.34;
    const freeEdge = pressure * lateral * involvement * 0.13;
    const contactSide = nx >= 0 ? 1 : -1;
    const right = halfWidth * (contactSide > 0 ? 1 - squashEdge : 1 + freeEdge);
    const left = halfWidth * (contactSide > 0 ? 1 + freeEdge : 1 - squashEdge);

    // Top or bottom contact is the same effect a quarter turn round: slices
    // near the contact are compressed together and the body spreads sideways.
    const squeeze = pressure * vertical * involvement * 0.34;
    const spread = pressure * vertical * involvement * 0.2;

    const wave = sampleWave(t, v);
    const destLeft = -left * (1 + spread) + wave;
    const destRight = right * (1 + spread) + wave;
    // Compressed slices are pulled toward the contact surface, which is what
    // keeps the far side of the body from stretching away from it.
    const destY =
      -height / 2 +
      i * sliceHeight +
      ny * squeeze * height * 0.16 * (1 - involvement);

    ctx.drawImage(
      image,
      0,
      i * sourceSlice,
      image.width,
      sourceSlice,
      destLeft,
      destY,
      destRight - destLeft,
      // A hair of overlap hides the seam between neighbouring slices.
      sliceHeight * (1 - squeeze) + 0.7
    );
  }
}

function drawRippleBody(
  ctx: CanvasRenderingContext2D,
  image: HTMLCanvasElement,
  width: number,
  height: number,
  transform: ElementTransform
) {
  const bands = [
    { top: -height / 2, height: height * 0.25, shift: transform.rippleTop },
    { top: -height * 0.27, height: height * 0.27, shift: transform.rippleUpper },
    { top: height * 0.0, height: height * 0.28, shift: transform.rippleLower },
    { top: height * 0.25, height: height * 0.27, shift: transform.rippleBottom },
  ];
  const rippleEnergy = Math.max(
    Math.abs(transform.rippleTop),
    Math.abs(transform.rippleUpper),
    Math.abs(transform.rippleLower),
    Math.abs(transform.rippleBottom)
  );
  if (rippleEnergy < 0.06) return;

  // The normal draw remains the crisp silhouette. These overlapping bands
  // reuse the locked body pixels at low alpha to create a brief internal wave
  // without mesh deformation, blur, or any new artwork.
  ctx.save();
  ctx.globalAlpha *= Math.min(0.4, rippleEnergy * 0.24);
  ctx.globalCompositeOperation = "source-atop";
  for (const band of bands) {
    if (Math.abs(band.shift) < 0.06) continue;
    ctx.save();
    ctx.beginPath();
    ctx.rect(-width / 2 - 2, band.top - 2, width + 4, band.height + 4);
    ctx.clip();
    ctx.translate(band.shift, 0);
    ctx.drawImage(image, -width / 2, -height / 2, width, height);
    ctx.restore();
  }
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
    drawSoftBody(ctx, layers.body, bw, bh, bt);
    drawRippleBody(ctx, layers.body, bw, bh, bt);
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
      drawProceduralEye(ctx, eye, showPupils);
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
        a.width * 0.95 * clamp(t.scaleX, 0.62, 1.18) * clamp(t.mouthWidth, 0.7, 1.35),
        a.height * 1.08 * clamp(t.scaleY, 0.7, 1.24),
        clamp(t.mouthCurve, -1, 1),
        clamp(t.mouthO, 0, 1),
        clamp(t.mouthCornerLeft, -1, 1),
        clamp(t.mouthCornerRight, -1, 1),
        colour
      );
      ctx.restore();
    };

    drawEye("leftEye", rig.leftEye);
    drawEye("rightEye", rig.rightEye);
    drawMouth(rig.mouth);

    // A faint re-render of the same deformed body texture crosses the face.
    // It preserves crisp artwork but removes the cut-out/decal edge.
    ctx.save();
    applyBodySurface(ctx, center, bw, bh, bt);
    ctx.beginPath();
    ctx.ellipse(0, 5, bw * 0.255, bh * 0.235, 0, 0, Math.PI * 2);
    ctx.clip();
    ctx.globalAlpha = SKIN_INTEGRATION_ALPHA * bt.opacity * (0.86 + faceVisibility * 0.14);
    ctx.drawImage(layers.body, -bw / 2, -bh / 2, bw, bh);
    ctx.restore();

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

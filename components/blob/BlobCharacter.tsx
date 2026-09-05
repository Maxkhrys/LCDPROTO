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
// The antialiased eye mask is shared with the cloud so both characters get the
// same clean lid contours from one implementation.
import { drawProceduralEye } from "./faceRenderer";

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
  /** Optional canvas handle used by the isolated Emoji Maker export. */
  canvasRef?: { current: HTMLCanvasElement | null };
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
  dAmount: number,
  crescentAmount: number,
  colour: BlobColour
) {
  const o = clamp(oAmount, 0, 1);
  const d = clamp(dAmount, 0, 1);
  const c = clamp(crescentAmount, 0, 1);

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

  // Upward corner lift for cute anime/animated-film smile
  const cornerLift = -c * height * (0.08 + Math.max(0, curve) * 0.16);
  const leftY = endY + cornerLift;
  const rightY = endY + cornerLift;

  // Top edge: relatively flat with subtle bow
  const neutralTopCenter = endY + bend - baseThickness - loopDepth;
  const crescentTopCenter = endY + cornerLift + height * 0.04 - Math.max(0, curve) * height * 0.04;
  const topCenter = (1 - c) * neutralTopCenter + c * crescentTopCenter;

  // Bottom edge: arcs downward into a clean, sharp half-oval
  const neutralBottomCenter = endY + bend + baseThickness + loopDepth;
  const crescentBottomCenter = endY + cornerLift + height * (0.36 + c * 0.42);
  const bottomCenter = (1 - c) * neutralBottomCenter + c * crescentBottomCenter;

  const topEndLeft = leftY - cornerThickness;
  const topEndRight = rightY - cornerThickness;
  const bottomEndLeft = leftY + cornerThickness;
  const bottomEndRight = rightY + cornerThickness;

  ctx.beginPath();
  ctx.moveTo(-halfWidth, topEndLeft);
  ctx.quadraticCurveTo(0, topCenter, halfWidth, topEndRight);

  if (cornerReach > 0.05) {
    ctx.bezierCurveTo(
      halfWidth + cornerReach,
      topEndRight,
      halfWidth + cornerReach,
      bottomEndRight,
      halfWidth,
      bottomEndRight
    );
  } else {
    ctx.lineTo(halfWidth, bottomEndRight);
  }

  // Bottom half-oval arc with gentle shoulder curvature
  ctx.bezierCurveTo(
    halfWidth * 0.55,
    bottomCenter * 0.88 + rightY * 0.12,
    halfWidth * 0.28,
    bottomCenter,
    0,
    bottomCenter
  );
  ctx.bezierCurveTo(
    -halfWidth * 0.28,
    bottomCenter,
    -halfWidth * 0.55,
    bottomCenter * 0.88 + leftY * 0.12,
    -halfWidth,
    bottomEndLeft
  );

  if (cornerReach > 0.05) {
    ctx.bezierCurveTo(
      -halfWidth - cornerReach,
      bottomEndLeft,
      -halfWidth - cornerReach,
      topEndLeft,
      -halfWidth,
      topEndLeft
    );
  } else {
    ctx.lineTo(-halfWidth, topEndLeft);
  }

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

function drawEyebrow(
  ctx: CanvasRenderingContext2D,
  eye: EyeGeometry,
  browLift: number,
  browRotation: number,
  clearance: number
) {
  const halfWidth = eye.width * 0.44;
  const thickness = clamp(eye.width * 0.15, 2.2, 3.2);
  const halfThickness = thickness / 2;
  // Natural authored Pixar brow arch even at neutral rest
  const baseArch = Math.max(1.8, eye.height * 0.085);
  const arch = clamp(baseArch + browLift * eye.height * 0.24, -1.0, 3.2);

  // Gaze leans the brow with the eye: right gaze tilts right, left tilts left,
  // and the pair shifts slightly in the direction Blob is looking.
  const look = clamp(eye.centerX / Math.max(eye.width * GAZE_TRAVEL_X, 0.001), -1, 1);
  const offsetX = eye.centerX * 0.18;
  // Directional lean stacks with an authored angry tilt, but the total stays
  // small enough that two brows can never read as crossed.
  const tilt = clamp(look * 4.5 + browRotation, -11, 11);
  const radians = (tilt * Math.PI) / 180;

  const eyeTop = eye.centerY - eye.height * 0.5;
  // Position brow comfortably close to eye aperture (3-4px clearance at rest)
  let browY = eyeTop - eye.height * 0.14 - browLift * eye.height * 0.20 + eye.centerY * 0.08;
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

/**
 * Everything the face renderer needs, independent of what the body is.
 *
 * The body is whatever drew before it — Blob's cached artwork, or the cloud's
 * volumetric lobes. The face only needs the surface transform it should ride
 * on and the box that transform pivots about.
 */
export interface BlobFaceOptions {
  /** Native screen size in pixels (466). */
  size: number;
  centre: number;
  colour: BlobColour;
  rig: BlobRig;
  /** Surface transform the facial anchors are welded to. */
  body: ElementTransform;
  /** Box the surface transform pivots about, in 466-space pixels. */
  bodyWidth: number;
  bodyHeight: number;
  /** Fades the face out as the character turns toward profile. */
  faceVisibility: number;
  showPupils: boolean;
  settingsOpen: boolean;
}

/**
 * Draws the production face: brows, both eyes and the mouth.
 *
 * Exported so a second character body can wear the same face rather than
 * carrying a copy of it. A copy is exactly how the experimental cloud ended up
 * with eyes that predated the current lid and mouth work — one face renderer
 * means an expression improvement lands on every character at once.
 */
export function drawBlobFace(
  ctx: CanvasRenderingContext2D,
  {
    size,
    centre: center,
    colour,
    rig,
    body: bt,
    bodyWidth: bw,
    bodyHeight: bh,
    faceVisibility,
    showPupils,
    settingsOpen,
  }: BlobFaceOptions
) {
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
        t.pupilX,
        t.pupilY,
        t.pupilScale,
        t.lidBias
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
        clamp(t.mouthD, 0, 1),
        clamp(t.mouthCrescent ?? 0, 0, 1),
        colour
      );
      ctx.restore();
    };

    drawEye("leftEye", rig.leftEye);
    drawEye("rightEye", rig.rightEye);
    drawMouth(rig.mouth);
}

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
  canvasRef: exportCanvasRef,
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

    drawBlobFace(ctx, {
      size,
      centre: center,
      colour,
      rig,
      body: bt,
      bodyWidth: bw,
      bodyHeight: bh,
      faceVisibility,
      showPupils,
      settingsOpen,
    });

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
    const scale = rig.blob.scale || 1;
    return Math.hypot(x - blobX, y - blobY) <= size * BODY_FRACTION * 0.62 * scale;
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

  useEffect(() => {
    if (!exportCanvasRef) return;
    exportCanvasRef.current = canvasRef.current;
    return () => {
      exportCanvasRef.current = null;
    };
  }, [exportCanvasRef]);

  return (
    <canvas
      ref={(node) => {
        canvasRef.current = node;
        if (exportCanvasRef) exportCanvasRef.current = node;
      }}
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

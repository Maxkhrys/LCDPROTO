"use client";

import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import {
  NEUTRAL_RIG,
  RIG_ASSETS,
  BODY_FRACTION,
  bodyScale,
  faceAnchor,
  type BlobRig,
  type BlobColour,
  type BlobShape,
  type ElementTransform,
  type FaceLayerId,
} from "@/lib/blobRig";
import { drawDownscaled } from "./downscale";

interface BlobCharacterProps {
  /** Native screen size in pixels (466). */
  size: number;
  /** Pixels rasterised per 466-space pixel. */
  renderScale: number;
  /** Per-element transforms. Defaults to the neutral HOME pose. */
  rig?: BlobRig;
  /** Dev-only colour testing; geometry and motion are shared. */
  colour?: BlobColour;
  /** Body geometry target. Face layers remain procedural and shared. */
  shape?: BlobShape;
  /** Opens the floating Blob tool orbs after a deliberate double tap. */
  onOpenTools?: () => void;
  /** Closes floating tools after a single tap while they are open. */
  onCloseTools?: () => void;
  /** Moves Blob under the tools and makes his gaze follow them. */
  settingsOpen?: boolean;
  /** Dev-only pupil preview. */
  showPupils?: boolean;
}

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

const SHAPE_POINT_COUNT = 24;
const SHAPE_VALUES: Record<BlobShape, number> = {
  jelly: 0,
  "round-square": 1,
  "round-triangle": 2,
};

function shapeRadius(shape: BlobShape, angle: number) {
  const organic =
    0.94 +
    Math.sin(angle * 3 - 0.6) * 0.025 +
    Math.sin(angle * 5 + 1.4) * 0.018;
  if (shape === "jelly") return organic;
  if (shape === "round-square") {
    const squareRadius =
      1 / Math.max(Math.abs(Math.cos(angle)), Math.abs(Math.sin(angle)));
    return 0.88 + ((squareRadius - 1) / 0.4142) * 0.12;
  }
  const triangleWave = Math.max(0, Math.cos((angle + Math.PI / 2) * 3));
  return 0.78 + Math.pow(triangleWave, 8) * 0.18;
}

const SHAPE_NAMES: readonly BlobShape[] = [
  "jelly",
  "round-square",
  "round-triangle",
];
const SHAPE_GEOMETRIES = SHAPE_NAMES.map((shape) =>
  Array.from({ length: SHAPE_POINT_COUNT }, (_, index) => {
    const angle = -Math.PI / 2 + (index / SHAPE_POINT_COUNT) * Math.PI * 2;
    const radius = shapeRadius(shape, angle);
    return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
  })
);

function drawShapePath(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  shapeValue: number
) {
  const value = clamp(shapeValue, 0, 2);
  const from = Math.floor(value) as 0 | 1 | 2;
  const to = Math.min(2, from + 1) as 0 | 1 | 2;
  const blend = value - from;
  const fromPoints = SHAPE_GEOMETRIES[from];
  const toPoints = SHAPE_GEOMETRIES[to];
  const pointX = (index: number) =>
    (fromPoints[index].x * (1 - blend) + toPoints[index].x * blend) * (width / 2);
  const pointY = (index: number) =>
    (fromPoints[index].y * (1 - blend) + toPoints[index].y * blend) * (height / 2);
  const previous = SHAPE_POINT_COUNT - 1;
  const firstMidX = (pointX(previous) + pointX(0)) / 2;
  const firstMidY = (pointY(previous) + pointY(0)) / 2;
  ctx.beginPath();
  ctx.moveTo(firstMidX, firstMidY);
  for (let i = 0; i < SHAPE_POINT_COUNT; i += 1) {
    const next = (i + 1) % SHAPE_POINT_COUNT;
    ctx.quadraticCurveTo(
      pointX(i),
      pointY(i),
      (pointX(i) + pointX(next)) / 2,
      (pointY(i) + pointY(next)) / 2
    );
  }
  ctx.closePath();
}

function shapePalette(colour: BlobColour) {
  switch (colour) {
    case "teal":
      return { base: "#0a7375" };
    case "yellow":
      return { base: "#a47410" };
    case "green":
      return { base: "#287b36" };
    case "blue":
      return { base: "#145c9e" };
    case "red":
      return { base: "#982334" };
    default:
      return { base: "#52229a" };
  }
}

function drawShapeBody(
  ctx: CanvasRenderingContext2D,
  image: HTMLCanvasElement,
  width: number,
  height: number,
  shapeValue: number,
  colour: BlobColour
) {
  if (shapeValue < 0.04) {
    ctx.drawImage(image, -width / 2, -height / 2, width, height);
    return;
  }
  ctx.save();
  drawShapePath(ctx, width, height, shapeValue);
  ctx.clip();
  const palette = shapePalette(colour);
  ctx.fillStyle = palette.base;
  ctx.fillRect(-width / 2, -height / 2, width, height);
  // Overscan lets the original material texture cover newly formed corners.
  // The clipped silhouette controls the shape; no opacity crossfade occurs.
  ctx.globalAlpha *= 0.98;
  ctx.drawImage(image, -width * 0.59, -height * 0.59, width * 1.18, height * 1.18);
  ctx.restore();
}

function drawLidClosure(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  open: number,
  colour: BlobColour
) {
  const gap = height * (0.045 + clamp(open, 0, 1) * 0.955);
  if (gap >= height * 0.995) return;
  const palette = shapePalette(colour);
  ctx.save();
  eyeSocketPath(ctx, 0, 0, width, height);
  ctx.clip();
  ctx.fillStyle = palette.base;
  ctx.globalAlpha *= 0.96;
  ctx.fillRect(-width / 2, -height / 2, width, -height / 2 + gap / 2);
  ctx.fillRect(-width / 2, gap / 2, width, height / 2 - gap / 2);
  ctx.restore();
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

function eyeSocketPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number
) {
  ctx.beginPath();
  ctx.ellipse(x, y, width * 0.5, height * 0.5, 0, 0, Math.PI * 2);
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

function drawProceduralEye(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  gazeX: number,
  gazeY: number,
  showPupil: boolean
) {
  // Keep the eye as one clean black mass. It is deliberately inset from the
  // socket so a full left/right glance never kisses the aperture edge and
  // reads as a clipped oval. The old asset's generous black silhouette stays,
  // but the movement now has a safe internal margin.
  const eyeWidth = width * 0.86;
  const eyeHeight = height * 0.96;
  const eyeX = clamp(gazeX * 0.72, -width * 0.14, width * 0.14);
  const eyeY = clamp(gazeY * 0.58, -height * 0.14, height * 0.14);
  eyeSocketPath(ctx, eyeX, eyeY, eyeWidth, eyeHeight);
  ctx.fillStyle = "#010204";
  ctx.fill();
  if (showPupil) {
    ctx.beginPath();
    ctx.arc(
      eyeX - eyeWidth * 0.18,
      eyeY - eyeHeight * 0.22,
      Math.max(0.75, Math.min(width, height) * 0.065),
      0,
      Math.PI * 2
    );
    ctx.fillStyle = "rgba(255, 255, 255, 0.92)";
    ctx.fill();
  }
}

function drawEyebrow(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  browLift: number,
  gazeY: number
) {
  const browWidth = width * 0.78;
  const browY =
    -height * 0.64 - browLift * height * 0.28 - gazeY * 0.04;
  const arch = clamp((browLift + 0.04) * height * 0.3, -1.1, 1.1);
  const thickness = clamp(width * 0.11, 1.5, 2.6);
  const halfThickness = thickness / 2;
  const halfWidth = browWidth / 2;
  const controlY = browY - arch;
  ctx.beginPath();
  // Filled contour rather than a canvas stroke keeps the brow crisp when the
  // whole character is rasterised at true hardware pixels.
  ctx.moveTo(-halfWidth, browY - halfThickness);
  ctx.quadraticCurveTo(0, controlY - halfThickness, halfWidth, browY - halfThickness);
  ctx.quadraticCurveTo(
    halfWidth + halfThickness,
    browY - halfThickness,
    halfWidth + halfThickness,
    browY
  );
  ctx.quadraticCurveTo(
    halfWidth + halfThickness,
    browY + halfThickness,
    halfWidth,
    browY + halfThickness
  );
  ctx.quadraticCurveTo(0, controlY + halfThickness, -halfWidth, browY + halfThickness);
  ctx.quadraticCurveTo(
    -halfWidth - halfThickness,
    browY + halfThickness,
    -halfWidth - halfThickness,
    browY
  );
  ctx.quadraticCurveTo(
    -halfWidth - halfThickness,
    browY - halfThickness,
    -halfWidth,
    browY - halfThickness
  );
  ctx.closePath();
  ctx.fillStyle = "#010204";
  ctx.fill();
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
  renderScale,
  rig = NEUTRAL_RIG,
  colour = "purple",
  onOpenTools,
  onCloseTools,
  settingsOpen = false,
  showPupils = false,
  shape = "jelly",
}: BlobCharacterProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [images, setImages] = useState<Images | null>(null);
  const shapeSpring = useRef({ value: 0, velocity: 0, last: 0 });

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
    const shapeState = shapeSpring.current;
    const now = performance.now();
    const dt = shapeState.last > 0 ? Math.min(0.05, (now - shapeState.last) / 1000) : 1 / 60;
    shapeState.last = now;
    const shapeTarget = SHAPE_VALUES[shape];
    const omega = Math.PI * 2 * 3.4;
    shapeState.velocity +=
      ((shapeTarget - shapeState.value) * omega * omega -
        shapeState.velocity * 2 * 0.68 * omega) *
      dt;
    shapeState.value = clamp(shapeState.value + shapeState.velocity * dt, 0, 2);
    const shapeValue = shapeState.value;
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
    drawShapeBody(ctx, layers.body, bw, bh, shapeValue, colour);
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
    const drawEye = (id: FaceLayerId, t: ElementTransform) => {
      const a = faceAnchor(id, size, colour);
      const socketX = a.x - center + t.socketX;
      const socketY = a.y - center + t.socketY;
      const socketScaleX = clamp(t.eyeSocketScaleX, 0.72, 1.35);
      const socketScaleY = clamp(t.eyeSocketScaleY, 0.72, 1.35);
      const socketWidth = a.width * socketScaleX;
      const socketHeight = a.height * socketScaleY;
      // The aperture is a skin socket, not the exact silhouette of the
      // procedural eye. A small horizontal cushion prevents the left edge
      // from being shaved during a glance, especially at 1:1 rasterisation.
      const apertureWidth = socketWidth * 1.1;
      const apertureHeight = socketHeight * 1.04;
      const open = clamp(t.eyeOpen, 0, 1);
      const gazeX = clamp(t.x, -socketWidth * 0.2, socketWidth * 0.2);
      const gazeY = clamp(
        t.y - (settingsOpen ? socketHeight * 0.2 : 0),
        -socketHeight * 0.2,
        socketHeight * 0.12
      );

      // Brows are part of the facial surface, not a separate floating asset.
      // They rise with curiosity, lower with squinting, and inherit the same
      // body transform and tiny eye tilt as the socket beneath them.
      ctx.save();
      ctx.globalAlpha = t.opacity * faceVisibility * 0.88;
      applyBodySurface(ctx, center, bw, bh, bt);
      ctx.translate(socketX, socketY);
      ctx.rotate((t.browRotation * Math.PI) / 180);
      drawEyebrow(ctx, socketWidth, socketHeight, t.browLift, gazeY);
      ctx.restore();

      ctx.save();
      ctx.globalAlpha = t.opacity * faceVisibility;
      applyBodySurface(ctx, center, bw, bh, bt);

      // Keep aperture fixed in the face. Draw eye mass first, then paint both
      // lids over it. This gives a real coloured upper and lower closure
      // instead of cutting away only the top half of the eye.
      ctx.translate(socketX, socketY);
      if (open > 0.001) {
        ctx.save();
        eyeSocketPath(ctx, 0, 0, apertureWidth, apertureHeight);
        ctx.clip();
        ctx.rotate((t.rotation * Math.PI) / 180);
        drawProceduralEye(ctx, socketWidth, socketHeight, gazeX, gazeY, showPupils);
        ctx.restore();
      }
      drawLidClosure(ctx, apertureWidth, apertureHeight, open, colour);
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
  }, [layers, size, renderScale, rig, colour, showPupils, settingsOpen, shape]);

  const isBlobHit = (event: MouseEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const px = ((event.clientX - rect.left) / rect.width) * size;
    const py = ((event.clientY - rect.top) / rect.height) * size;
    const blobX = size / 2 + rig.blob.x;
    const blobY = size / 2 + rig.blob.y + (settingsOpen ? size * 0.075 : 0);
    return Math.hypot(px - blobX, py - blobY) <= size * BODY_FRACTION * 0.62;
  };

  return (
    <canvas
      ref={canvasRef}
      width={size * renderScale}
      height={size * renderScale}
      className="block"
      onClick={(event) => {
        if (settingsOpen && onCloseTools && isBlobHit(event)) onCloseTools();
      }}
      onDoubleClick={(event) => {
        if (!settingsOpen && onOpenTools && isBlobHit(event)) onOpenTools();
      }}
      style={{
        width: size,
        height: size,
        imageRendering: renderScale === 1 ? "pixelated" : "auto",
      }}
    />
  );
}

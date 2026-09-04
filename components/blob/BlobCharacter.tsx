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

function drawLidClosure(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  open: number,
  bodyImage: HTMLCanvasElement,
  bodyWidth: number,
  bodyHeight: number,
  socketX: number,
  socketY: number
) {
  const gap = height * (0.02 + clamp(open, 0, 1) * 0.98);
  if (gap >= height * 0.995) return;
  const lidHeight = Math.max(0, (height - gap) / 2);
  ctx.save();
  eyeSocketPath(ctx, 0, 0, width, height);
  ctx.clip();
  const paintLid = (top: boolean) => {
    ctx.save();
    ctx.beginPath();
    ctx.rect(
      -width / 2,
      top ? -height / 2 : gap / 2,
      width,
      lidHeight
    );
    ctx.clip();
    // Repaint the same body pixels that sit behind the eye. This makes the
    // closing lids inherit Blob's real colour, highlights and grain instead of
    // exposing a flat mask or leaving half an eye cut away.
    ctx.globalAlpha *= 0.98;
    ctx.drawImage(
      bodyImage,
      -socketX - bodyWidth / 2,
      -socketY - bodyHeight / 2,
      bodyWidth,
      bodyHeight
    );
    ctx.restore();
  };
  paintLid(true);
  paintLid(false);
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
  // The caller supplies the exact shared eye silhouette. Lids use these same
  // dimensions, so neither side of the eye is left exposed during a blink.
  const eyeWidth = width;
  const eyeHeight = height;
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
}: BlobCharacterProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [images, setImages] = useState<Images | null>(null);

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
      // The lid and eye share one exact silhouette. The socket has only a
      // tiny safety margin so a gaze never clips the black eye at its edge.
      const eyeWidth = socketWidth * 0.86;
      const eyeHeight = socketHeight * 0.96;
      const apertureWidth = eyeWidth * 1.025;
      const apertureHeight = eyeHeight * 1.025;
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
        drawProceduralEye(ctx, eyeWidth, eyeHeight, gazeX, gazeY, showPupils);
        ctx.restore();
      }
      drawLidClosure(
        ctx,
        eyeWidth,
        eyeHeight,
        open,
        layers.body,
        bw,
        bh,
        socketX,
        socketY
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

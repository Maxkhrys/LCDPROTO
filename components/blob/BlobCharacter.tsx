"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  NEUTRAL_RIG,
  RIG_ASSETS,
  bodyScale,
  faceAnchor,
  type BlobRig,
  type BlobColour,
  type ElementTransform,
  type FaceLayerId,
} from "@/lib/blobRig";
import { drawDownscaled } from "./downscale";

interface BlobCharacterProps {
  /** Native screen size in pixels (240). */
  size: number;
  /** Pixels rasterised per 240-space pixel. */
  renderScale: number;
  /** Per-element transforms. Defaults to the neutral HOME pose. */
  rig?: BlobRig;
  /** Dev-only colour testing; geometry and motion are shared. */
  colour?: BlobColour;
}

type LayerId = "body";
type Images = Record<LayerId, HTMLImageElement>;

/**
 * Facial features follow the body's complete surface transform. Only their
 * artwork scale is partially compensated, so the features stay crisp while
 * their attachment points still move like skin.
 */
const FACE_ART_SURFACE_INHERIT = 0.56;
const SKIN_INTEGRATION_ALPHA = 0.12;

const clamp = (value: number, min: number, max: number) =>
  value < min ? min : value > max ? max : value;

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

function ellipsePath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radiusX: number,
  radiusY: number
) {
  ctx.beginPath();
  ctx.ellipse(x, y, radiusX, radiusY, 0, 0, Math.PI * 2);
}

function eyeSocketPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number
) {
  // Slightly organic rather than perfectly geometric. This follows the old
  // glossy eye silhouette while keeping the aperture deterministic.
  ctx.beginPath();
  ctx.moveTo(x, y - height * 0.5);
  ctx.bezierCurveTo(
    x - width * 0.35,
    y - height * 0.52,
    x - width * 0.51,
    y - height * 0.2,
    x - width * 0.49,
    y + height * 0.16
  );
  ctx.bezierCurveTo(
    x - width * 0.47,
    y + height * 0.42,
    x - width * 0.22,
    y + height * 0.52,
    x,
    y + height * 0.5
  );
  ctx.bezierCurveTo(
    x + width * 0.28,
    y + height * 0.48,
    x + width * 0.5,
    y + height * 0.25,
    x + width * 0.47,
    y - height * 0.02
  );
  ctx.bezierCurveTo(
    x + width * 0.44,
    y - height * 0.35,
    x + width * 0.2,
    y - height * 0.5,
    x,
    y - height * 0.5
  );
  ctx.closePath();
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
  const halfWidth = width * (0.5 - o * 0.1);
  const thickness = Math.max(1.15, height * (0.16 + o * 0.025));
  const loopDepth = height * 0.38 * o;
  const bend = curve * height * 0.46 * (1 - o);
  const endY = -curve * height * 0.1 * (1 - o);
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

function eyeIrisColour(colour: BlobColour) {
  switch (colour) {
    case "teal":
      return "#54d9d4";
    case "yellow":
      return "#e4b94e";
    case "green":
      return "#79d96a";
    default:
      return "#8969e8";
  }
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
  colour: BlobColour,
  eyeBias: number
) {
  // The socket is the eye's stable dark mass. Everything else is drawn inside
  // it, so gaze moves the iris rather than dragging a glossy eye sticker.
  const palette = eyePalette(colour);
  eyeSocketPath(ctx, 0, 0, width, height);
  const surface = ctx.createLinearGradient(0, -height / 2, 0, height / 2);
  surface.addColorStop(0, "#07080a");
  surface.addColorStop(0.58, "#020304");
  surface.addColorStop(0.86, palette.shade);
  surface.addColorStop(1, palette.rim);
  ctx.fillStyle = surface;
  ctx.fill();

  const bottomWash = ctx.createRadialGradient(
    -width * 0.12,
    height * 0.32,
    0,
    -width * 0.02,
    height * 0.25,
    height * 0.75
  );
  bottomWash.addColorStop(0, palette.wash);
  bottomWash.addColorStop(0.58, palette.washEdge);
  eyeSocketPath(ctx, 0, 0, width, height);
  ctx.fillStyle = bottomWash;
  ctx.fill();

  const irisX = gazeX * 0.72 + eyeBias;
  const irisY = gazeY * 0.66;
  const irisWidth = width * 0.17;
  const irisHeight = height * 0.23;

  ellipsePath(ctx, irisX, irisY, irisWidth, irisHeight);
  const iris = ctx.createRadialGradient(
    irisX - width * 0.06,
    irisY - height * 0.1,
    width * 0.03,
    irisX,
    irisY,
    irisHeight * 1.2
  );
  iris.addColorStop(0, eyeIrisColour(colour));
  iris.addColorStop(0.55, palette.shade);
  iris.addColorStop(1, "#020304");
  ctx.fillStyle = iris;
  ctx.fill();

  ellipsePath(ctx, irisX, irisY + height * 0.012, width * 0.065, height * 0.12);
  ctx.fillStyle = "#010203";
  ctx.fill();

  // Solid highlights keep the eye alive at native size without filters.
  ctx.save();
  ctx.translate(irisX - width * 0.045, irisY - height * 0.115);
  ctx.rotate(-0.28);
  ellipsePath(
    ctx,
    0,
    0,
    width * 0.12,
    height * 0.17
  );
  ctx.fillStyle = "#f3ffff";
  ctx.fill();
  ctx.restore();

  ellipsePath(
    ctx,
    irisX + width * 0.08,
    irisY + height * 0.11,
    width * 0.04,
    height * 0.052
  );
  ctx.fillStyle = "#9edbdc";
  ctx.fill();

  ellipsePath(ctx, -width * 0.16, -height * 0.28, width * 0.018, height * 0.018);
  ctx.fillStyle = "#d8ffff";
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

  // The normal draw remains the crisp silhouette. These overlapping bands
  // reuse the locked body pixels at low alpha to create a brief internal wave
  // without mesh deformation, blur, or any new artwork.
  ctx.save();
  ctx.globalAlpha *= 0.32;
  for (const band of bands) {
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
 * Drawing order is body -> left eye -> right eye -> mouth.
 */
export default function BlobCharacter({
  size,
  renderScale,
  rig = NEUTRAL_RIG,
  colour = "purple",
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
    ctx.translate(center + blob.x, center + blob.y);
    ctx.rotate((blob.rotation * Math.PI) / 180);
    ctx.scale(blob.scale * blob.scaleX, blob.scale * blob.scaleY);
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
      const open = clamp(t.eyeOpen, 0, 1);
      // Blink closes from both lids. Keep a tiny upper-lid lead so it still
      // reads as a blink, while never leaving the lower half exposed.
      const visibleHeight = socketHeight * open;
      const visibleTop =
        -visibleHeight / 2 - socketHeight * 0.035 * (1 - open);
      const visibleBottom = visibleTop + visibleHeight;
      const gazeX = clamp(t.x, -socketWidth * 0.2, socketWidth * 0.2);
      const gazeY = clamp(t.y, -socketHeight * 0.14, socketHeight * 0.14);
      const eyeBias = id === "leftEye" ? -socketWidth * 0.012 : socketWidth * 0.012;

      if (open > 0.001) {
        ctx.save();
        ctx.globalAlpha = t.opacity;
        applyBodySurface(ctx, center, bw, bh, bt);

        // Clip is created before texture translation, so the socket does not
        // travel with a glance. The aperture follows the eye's oval silhouette.
        ctx.translate(socketX, socketY);
        eyeSocketPath(ctx, 0, 0, socketWidth, socketHeight);
        ctx.clip();
        ctx.beginPath();
        ctx.rect(-socketWidth / 2, visibleTop, socketWidth, visibleBottom - visibleTop);
        ctx.clip();

        ctx.rotate((t.rotation * Math.PI) / 180);
        drawProceduralEye(
          ctx,
          socketWidth,
          socketHeight,
          gazeX,
          gazeY,
          colour,
          eyeBias
        );
        ctx.restore();
      }

      // Do not leave a transparent half-eye during a blink. Repaint the
      // covered part with the exact body texture already underneath it. This
      // creates a coloured, surface-matched lid without inventing new art.
      const coverAmount = 1 - Math.min(1, open);
      if (coverAmount > 0.001) {
        ctx.save();
        ctx.globalAlpha = t.opacity;
        applyBodySurface(ctx, center, bw, bh, bt);
        // Keep body image and socket in the same body-space coordinate system.
        // Translating to socket before drawing made the lid sample pixels from
        // the eye centre instead of repainting the body underneath the eye.
        eyeSocketPath(ctx, socketX, socketY, socketWidth, socketHeight);
        ctx.clip();
        ctx.beginPath();
        const coverTop = -socketHeight / 2;
        const coverBottom = socketHeight / 2;
        const topBoundary = Math.max(coverTop, visibleTop);
        const bottomBoundary = Math.min(coverBottom, visibleBottom);
        ctx.rect(
          socketX - socketWidth / 2,
          socketY + coverTop,
          socketWidth,
          topBoundary - coverTop
        );
        ctx.rect(
          socketX - socketWidth / 2,
          socketY + bottomBoundary,
          socketWidth,
          coverBottom - bottomBoundary
        );
        ctx.clip();
        ctx.drawImage(layers.body, -bw / 2, -bh / 2, bw, bh);
        ctx.restore();
      }
    };

    const drawMouth = (t: ElementTransform) => {
      const a = faceAnchor("mouth", size, colour);
      ctx.save();
      ctx.globalAlpha = t.opacity;
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
    ctx.globalAlpha = SKIN_INTEGRATION_ALPHA * bt.opacity;
    ctx.drawImage(layers.body, -bw / 2, -bh / 2, bw, bh);
    ctx.restore();

    ctx.restore();
  }, [layers, size, renderScale, rig, colour]);

  return (
    <canvas
      ref={canvasRef}
      width={size * renderScale}
      height={size * renderScale}
      className="block"
      style={{
        width: size,
        height: size,
        imageRendering: renderScale === 1 ? "pixelated" : "auto",
      }}
    />
  );
}

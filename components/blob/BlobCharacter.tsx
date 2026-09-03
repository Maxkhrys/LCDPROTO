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
const SKIN_INTEGRATION_ALPHA = 0.09;

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

function drawMouthShape(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  curve: number,
  oAmount: number
) {
  const o = clamp(oAmount, 0, 1);
  const lineHalf = Math.max(0.85, height * 0.23) * (1 - o);
  const ovalHalf = Math.max(1.7, height * 0.48) * o;
  const mouthWidth = width * (1 - o * 0.2);
  const centerY = curve * height * 1.05 * (1 - o);
  const topEnd = -lineHalf;
  const bottomEnd = lineHalf;
  const topCenter = centerY - lineHalf - ovalHalf;
  const bottomCenter = centerY + lineHalf + ovalHalf;
  const halfWidth = mouthWidth / 2;
  const corner = Math.min(halfWidth * 0.2, Math.max(0.8, height * 0.18));

  // One filled path morphs between a curved mouth and a rounded O. No asset
  // swap, opacity trick, or rotation is used at any point in the transition.
  ctx.beginPath();
  ctx.moveTo(-halfWidth + corner, topEnd);
  ctx.bezierCurveTo(
    -halfWidth * 0.72,
    topCenter,
    halfWidth * 0.7,
    topCenter,
    halfWidth - corner,
    topEnd
  );
  ctx.quadraticCurveTo(halfWidth, topEnd, halfWidth, topEnd + corner);
  ctx.bezierCurveTo(
    halfWidth * 0.72,
    bottomCenter,
    -halfWidth * 0.72,
    bottomCenter,
    -halfWidth + corner,
    bottomEnd
  );
  ctx.quadraticCurveTo(-halfWidth, bottomEnd, -halfWidth, bottomEnd - corner);
  ctx.closePath();
  ctx.fillStyle = "#050506";
  ctx.fill();
}

function eyeIrisColour(colour: BlobColour) {
  switch (colour) {
    case "teal":
      return "#6ce9e4";
    case "yellow":
      return "#ffe08a";
    case "green":
      return "#a8f28f";
    default:
      return "#9b82ff";
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
  ellipsePath(ctx, 0, 0, width / 2, height / 2);
  ctx.fillStyle = "#030405";
  ctx.fill();

  const irisX = gazeX * 0.72 + eyeBias;
  const irisY = gazeY * 0.66;
  const irisWidth = width * 0.19;
  const irisHeight = height * 0.27;

  ellipsePath(ctx, irisX, irisY, irisWidth, irisHeight);
  ctx.fillStyle = eyeIrisColour(colour);
  ctx.fill();

  ellipsePath(ctx, irisX, irisY + height * 0.012, width * 0.085, height * 0.16);
  ctx.fillStyle = "#010203";
  ctx.fill();

  // Solid highlights keep the eye alive at native size without glow or blur.
  ellipsePath(
    ctx,
    irisX - width * 0.065,
    irisY - height * 0.105,
    width * 0.052,
    height * 0.075
  );
  ctx.fillStyle = "#f3ffff";
  ctx.fill();

  ellipsePath(
    ctx,
    irisX + width * 0.08,
    irisY + height * 0.11,
    width * 0.026,
    height * 0.04
  );
  ctx.fillStyle = "#9edbdc";
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
        ellipsePath(ctx, 0, 0, socketWidth / 2, socketHeight / 2);
        ctx.clip();
        ctx.beginPath();
        ctx.rect(-socketWidth / 2, visibleTop, socketWidth, visibleBottom - visibleTop);
        ctx.clip();

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
        ellipsePath(ctx, socketX, socketY, socketWidth / 2, socketHeight / 2);
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
      ctx.rotate((t.rotation * Math.PI) / 180);
      ctx.scale(faceCompensationX, faceCompensationY);
      drawMouthShape(
        ctx,
        a.width * 0.78 * clamp(t.scaleX, 0.62, 1.18),
        a.height * 0.9 * clamp(t.scaleY, 0.7, 1.24),
        clamp(t.mouthCurve, -1, 1),
        clamp(t.mouthO, 0, 1)
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

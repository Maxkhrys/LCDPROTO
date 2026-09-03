"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  FACE_ORDER,
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

type LayerId = "body" | FaceLayerId;
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
 * Renders the Blob as independent layers: the locked body, then each facial
 * element drawn separately so it can be moved, scaled, rotated and faded on
 * its own. The body is never touched by facial transforms.
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
    const entries: [LayerId, string][] = [
      ["body", assets.body.src],
      ["leftEye", assets.face.leftEye.src],
      ["rightEye", assets.face.rightEye.src],
      ["mouth", assets.face.mouth.src],
    ];
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

    // Facial layers already carry alpha; bake them at their neutral size.
    const face = {} as Record<FaceLayerId, HTMLCanvasElement>;
    for (const id of FACE_ORDER) {
      const asset = assets.face[id];
      const a = faceAnchor(id, size, colour);
      const c = buffer(a.width * renderScale, a.height * renderScale);
      const cctx = c.getContext("2d");
      if (cctx) {
        drawDownscaled(
          cctx,
          images[id],
          asset.width,
          asset.height,
          0,
          0,
          c.width,
          c.height
        );
      }
      face[id] = c;
    }

    return { body: bodyCanvas, face };
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
      const textureX = a.x - center + t.x;
      const textureY = a.y - center + t.y;
      const socketScaleX = clamp(t.eyeSocketScaleX, 0.72, 1.35);
      const socketScaleY = clamp(t.eyeSocketScaleY, 0.72, 1.35);
      const socketWidth = a.width * socketScaleX;
      const socketHeight = a.height * socketScaleY;
      const open = clamp(t.eyeOpen, 0, 1.12);
      const clipTop = socketHeight / 2 - socketHeight * open;
      const clipHeight = socketHeight * open + 1.5;
      const textureScaleX = Math.max(0.1, faceCompensationX * t.scaleX);
      const textureScaleY = Math.max(0.1, faceCompensationY * t.scaleY);

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
        ctx.rect(-socketWidth / 2, clipTop, socketWidth, clipHeight);
        ctx.clip();

        ctx.translate(textureX - socketX, textureY - socketY);
        ctx.rotate((t.rotation * Math.PI) / 180);
        ctx.scale(textureScaleX, textureScaleY);
        // Re-anchor texture bottom after an expressive vertical scale.
        ctx.translate(0, socketHeight / (2 * textureScaleY) - a.height / 2);
        ctx.drawImage(layers.face[id], -a.width / 2, -a.height / 2, a.width, a.height);
        ctx.restore();
      }

      // Do not leave a transparent half-eye during a blink. Repaint the
      // covered part with the exact body texture already underneath it. This
      // creates a coloured, surface-matched lid without inventing new art.
      const coverHeight = socketHeight * (1 - Math.min(1, open));
      if (coverHeight > 0.001) {
        ctx.save();
        ctx.globalAlpha = t.opacity;
        applyBodySurface(ctx, center, bw, bh, bt);
        ctx.translate(socketX, socketY);
        ellipsePath(ctx, 0, 0, socketWidth / 2, socketHeight / 2);
        ctx.clip();
        ctx.beginPath();
        ctx.rect(
          -socketWidth / 2,
          -socketHeight / 2,
          socketWidth,
          coverHeight
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
      ctx.scale(
        faceCompensationX * t.scaleX,
        faceCompensationY * t.scaleY
      );
      ctx.drawImage(layers.face.mouth, -a.width / 2, -a.height / 2, a.width, a.height);
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

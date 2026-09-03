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

    ctx.save();
    ctx.globalAlpha = blob.opacity;
    // Whole-character transform: the body and every facial layer move together.
    ctx.translate(center + blob.x, center + blob.y);
    ctx.rotate((blob.rotation * Math.PI) / 180);
    ctx.scale(blob.scale * blob.scaleX, blob.scale * blob.scaleY);
    ctx.translate(-center, -center);

    // 1. Body — has its own transform, but is never touched by facial controls.
    const bodyAsset = RIG_ASSETS[colour].body;
    const bs = bodyScale(size, colour);
    const bw = bodyAsset.width * bs;
    const bh = bodyAsset.height * bs;
    const bt = rig.body;
    const pivotX = bt.originX * (bw / 2);
    const pivotY = bt.originY * (bh / 2);
    ctx.save();
    ctx.globalAlpha = blob.opacity * bt.opacity;
    ctx.translate(center + bt.x + pivotX, center + bt.y + pivotY);
    ctx.rotate((bt.rotation * Math.PI) / 180);
    ctx.transform(
      1,
      Math.tan((bt.skewY * Math.PI) / 180),
      Math.tan((bt.skewX * Math.PI) / 180),
      1,
      0,
      0
    );
    ctx.scale(bt.scaleX, bt.scaleY);
    ctx.translate(-pivotX, -pivotY);
    ctx.drawImage(layers.body, -bw / 2, -bh / 2, bw, bh);
    ctx.restore();

    // 2-4. Facial layers, each independently transformable about its own centre.
    const drawFace = (id: FaceLayerId, t: ElementTransform) => {
      const a = faceAnchor(id, size, colour);
      ctx.save();
      ctx.globalAlpha = blob.opacity * t.opacity;
      ctx.translate(a.x + t.x, a.y + t.y);
      ctx.rotate((t.rotation * Math.PI) / 180);
      ctx.scale(t.scaleX, t.scaleY);
      ctx.drawImage(layers.face[id], -a.width / 2, -a.height / 2, a.width, a.height);
      ctx.restore();
    };

    for (const id of FACE_ORDER) drawFace(id, rig[id]);

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

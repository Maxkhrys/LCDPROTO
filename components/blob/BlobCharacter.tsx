"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  BODY_LAYER,
  FACE_LAYERS,
  FACE_ORDER,
  NEUTRAL_RIG,
  bodyScale,
  faceAnchor,
  type BlobRig,
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
}

type LayerId = "body" | FaceLayerId;
type Images = Record<LayerId, HTMLImageElement>;

const SOURCES: Record<LayerId, string> = {
  body: BODY_LAYER.src,
  leftEye: FACE_LAYERS.leftEye.src,
  rightEye: FACE_LAYERS.rightEye.src,
  mouth: FACE_LAYERS.mouth.src,
};

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
}: BlobCharacterProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [images, setImages] = useState<Images | null>(null);

  useEffect(() => {
    let cancelled = false;
    const entries = Object.entries(SOURCES) as [LayerId, string][];
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
  }, []);

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
    const bs = bodyScale(size) * renderScale;
    const bodyCanvas = buffer(BODY_LAYER.width * bs, BODY_LAYER.height * bs);
    const bctx = bodyCanvas.getContext("2d");
    if (bctx) {
      drawDownscaled(
        bctx,
        images.body,
        BODY_LAYER.width,
        BODY_LAYER.height,
        0,
        0,
        bodyCanvas.width,
        bodyCanvas.height
      );
      const data = bctx.getImageData(0, 0, bodyCanvas.width, bodyCanvas.height);
      const px = data.data;
      for (let i = 0; i < px.length; i += 4) {
        const lum = (px[i] + px[i + 1] + px[i + 2]) / 3;
        // Fully opaque above ~25 luminance, fading to clear at black.
        px[i + 3] = Math.max(0, Math.min(255, Math.round(((lum - 3) / 22) * 255)));
      }
      bctx.putImageData(data, 0, 0);
    }

    // Facial layers already carry alpha; bake them at their neutral size.
    const face = {} as Record<FaceLayerId, HTMLCanvasElement>;
    for (const id of FACE_ORDER) {
      const asset = FACE_LAYERS[id];
      const a = faceAnchor(id, size);
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
  }, [images, size, renderScale]);

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
    ctx.scale(blob.scale, blob.scale);
    ctx.translate(-center, -center);

    // 1. Body — never transformed by facial controls.
    const bs = bodyScale(size);
    ctx.drawImage(
      layers.body,
      center - BODY_LAYER.centerX * bs,
      center - BODY_LAYER.centerY * bs,
      BODY_LAYER.width * bs,
      BODY_LAYER.height * bs
    );

    // 2-4. Facial layers, each independently transformable about its own centre.
    const drawFace = (id: FaceLayerId, t: ElementTransform) => {
      const a = faceAnchor(id, size);
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
  }, [layers, size, renderScale, rig]);

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

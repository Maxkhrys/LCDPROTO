"use client";

import { useEffect, useRef } from "react";
import {
  type DeformationParams,
  DEFAULT_DEFORMATION,
  computeDeformedPoints,
  computeBezierSegments,
  traceBodyPath,
} from "./blobShape";
import { renderBlobBody, type MaterialOptions } from "./blobMaterial";

export interface BlobBodyDebugOptions {
  showControlPoints?: boolean;
  showSilhouetteGuide?: boolean;
  showBoundingBox?: boolean;
  showCenterPoint?: boolean;
  showFaceOverlay?: boolean;
}

export interface BlobBodyProps {
  size?: number; // Screen size in px, defaults to 240
  renderScale?: number; // Rasterization scale factor, defaults to 1
  params?: DeformationParams;
  materialOptions?: MaterialOptions;
  debug?: BlobBodyDebugOptions;
  className?: string;
}

export default function BlobBody({
  size = 240,
  renderScale = 1,
  params = DEFAULT_DEFORMATION,
  materialOptions,
  debug = {},
  className,
}: BlobBodyProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set pixel density
    const width = size * renderScale;
    const height = size * renderScale;
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }

    ctx.save();
    ctx.scale(renderScale, renderScale);
    ctx.clearRect(0, 0, size, size);

    const cx = size / 2;
    const cy = size / 2;

    // 1. Compute deformed anchor points and Bezier curve segments
    const deformedPoints = computeDeformedPoints(params);
    const segments = computeBezierSegments(deformedPoints);

    // 2. Render 7-layer cosmic jelly material
    renderBlobBody(ctx, cx, cy, deformedPoints, segments, params, materialOptions);

    // -------------------------------------------------------------------------
    // DEBUG OVERLAYS
    // -------------------------------------------------------------------------

    // A. Silhouette Guide (shows the neutral master silhouette in dashed cyan)
    if (debug.showSilhouetteGuide) {
      const neutralPoints = computeDeformedPoints(DEFAULT_DEFORMATION);
      const neutralSegments = computeBezierSegments(neutralPoints);
      ctx.save();
      ctx.setLineDash([3, 3]);
      traceBodyPath(ctx, neutralSegments, cx, cy);
      ctx.strokeStyle = "rgba(0, 240, 255, 0.75)";
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();
    }

    // B. Bounding Box
    if (debug.showBoundingBox) {
      let minX = Infinity;
      let maxX = -Infinity;
      let minY = Infinity;
      let maxY = -Infinity;
      for (const pt of deformedPoints) {
        if (pt.x < minX) minX = pt.x;
        if (pt.x > maxX) maxX = pt.x;
        if (pt.y < minY) minY = pt.y;
        if (pt.y > maxY) maxY = pt.y;
      }
      ctx.save();
      ctx.strokeStyle = "rgba(255, 200, 0, 0.65)";
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 2]);
      ctx.strokeRect(
        cx + minX - 4,
        cy + minY - 4,
        maxX - minX + 8,
        maxY - minY + 8
      );

      ctx.fillStyle = "rgba(255, 200, 0, 0.9)";
      ctx.font = "8px monospace";
      ctx.fillText(
        `${Math.round(maxX - minX)}x${Math.round(maxY - minY)}`,
        cx + minX,
        cy + minY - 7
      );
      ctx.restore();
    }

    // C. Center Point Crosshair
    if (debug.showCenterPoint) {
      ctx.save();
      ctx.strokeStyle = "rgba(255, 50, 50, 0.8)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx - 8, cy);
      ctx.lineTo(cx + 8, cy);
      ctx.moveTo(cx, cy - 8);
      ctx.lineTo(cx, cy + 8);
      ctx.stroke();

      ctx.fillStyle = "rgba(255, 50, 50, 0.85)";
      ctx.beginPath();
      ctx.arc(cx, cy, 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // D. Control Points & Handles
    if (debug.showControlPoints) {
      ctx.save();
      // Draw Bezier handles
      for (const seg of segments) {
        ctx.strokeStyle = "rgba(255, 255, 255, 0.25)";
        ctx.lineWidth = 0.75;
        ctx.beginPath();
        ctx.moveTo(cx + seg.p1.x, cy + seg.p1.y);
        ctx.lineTo(cx + seg.cp1.x, cy + seg.cp1.y);
        ctx.moveTo(cx + seg.p2.x, cy + seg.p2.y);
        ctx.lineTo(cx + seg.cp2.x, cy + seg.cp2.y);
        ctx.stroke();

        ctx.fillStyle = "rgba(255, 100, 200, 0.8)";
        ctx.fillRect(cx + seg.cp1.x - 1.5, cy + seg.cp1.y - 1.5, 3, 3);
        ctx.fillRect(cx + seg.cp2.x - 1.5, cy + seg.cp2.y - 1.5, 3, 3);
      }

      // Draw anchor points
      for (const pt of deformedPoints) {
        ctx.beginPath();
        ctx.arc(cx + pt.x, cy + pt.y, 3.5, 0, Math.PI * 2);
        ctx.fillStyle = "#ffffff";
        ctx.fill();
        ctx.strokeStyle = "#8b24d6";
        ctx.lineWidth = 1.2;
        ctx.stroke();

        // Label
        ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
        ctx.font = "8px monospace";
        ctx.fillText(
          `${pt.id}:${pt.name.split(" ")[0]}`,
          cx + pt.x + 5,
          cy + pt.y - 3
        );
      }
      ctx.restore();
    }

    // E. Optional Face Overlay (provides context without modifying production face)
    if (debug.showFaceOverlay) {
      ctx.save();
      // Approximate eye sockets anchored in deformed space
      const faceY = cy + params.centerShiftY + (params.squash ? params.squash * 3 : 0);
      const faceX = cx + params.centerShiftX + (params.lean ? params.lean * 0.15 : 0);

      const drawEyePreview = (eyeX: number, eyeY: number) => {
        ctx.save();
        ctx.beginPath();
        ctx.ellipse(eyeX, eyeY, 7.5, 11, 0, 0, Math.PI * 2);
        ctx.fillStyle = "#060312";
        ctx.fill();
        ctx.strokeStyle = "rgba(180, 100, 255, 0.4)";
        ctx.lineWidth = 0.8;
        ctx.stroke();

        // Iris
        ctx.beginPath();
        ctx.ellipse(eyeX, eyeY + 1, 3.5, 5, 0, 0, Math.PI * 2);
        ctx.fillStyle = "#8969e8";
        ctx.fill();

        // Specular dot
        ctx.beginPath();
        ctx.arc(eyeX - 1.5, eyeY - 2.5, 1.8, 0, Math.PI * 2);
        ctx.fillStyle = "#ffffff";
        ctx.fill();
        ctx.restore();
      };

      drawEyePreview(faceX - 22, faceY - 5);
      drawEyePreview(faceX + 22, faceY - 5);

      // Mouth
      ctx.beginPath();
      ctx.ellipse(faceX, faceY + 14, 4.5, 2.5, 0, 0, Math.PI * 2);
      ctx.fillStyle = "#060312";
      ctx.fill();
      ctx.strokeStyle = "rgba(180, 100, 255, 0.35)";
      ctx.lineWidth = 0.7;
      ctx.stroke();

      ctx.restore();
    }

    ctx.restore();
  }, [size, renderScale, params, materialOptions, debug]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        width: size,
        height: size,
      }}
      className={`block select-none ${className ?? ""}`}
    />
  );
}

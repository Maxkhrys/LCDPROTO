"use client";

import { useEffect, useRef } from "react";
import {
  environmentArt,
  type EnvironmentController,
  type EnvironmentPose,
} from "@/lib/blobEnvironment";
import type { DisplayMode } from "@/lib/deviceStates";

interface LayerProps {
  /** Native screen size in pixels (466). */
  size: number;
  /** Pixels rasterised per 466-space pixel. */
  renderScale: number;
  mode: DisplayMode;
  controller: EnvironmentController;
  /** Mutated in place by HomeState's loop; read, never written, here. */
  pose: EnvironmentPose;
  /** Changes every frame so the layer repaints with the character. */
  frame: number;
  /** Paint order against the character. */
  z: number;
  /** Draws the shadow hot with an outline so its placement can be checked. */
  debugShadow?: boolean;
}

const layerStyle = (size: number, renderScale: number, z: number) =>
  ({
    position: "absolute" as const,
    left: 0,
    top: 0,
    width: size,
    height: size,
    zIndex: z,
    // The world is scenery; every pointer gesture belongs to Blob.
    pointerEvents: "none" as const,
    imageRendering: renderScale === 1 ? ("pixelated" as const) : ("auto" as const),
  });

/**
 * Everything behind Blob: the cached sand world, the background dust, and the
 * contact shadow that grounds him.
 */
export function EnvironmentBack({
  size,
  renderScale,
  mode,
  controller,
  pose,
  frame,
  z,
  debugShadow = false,
}: LayerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(renderScale, 0, 0, renderScale, 0, 0);
    ctx.clearRect(0, 0, size, size);

    // One blit of prepared art. The parallax offset is the only thing that
    // changes, so nothing is re-rasterised per frame.
    const art = environmentArt(size, renderScale, mode);
    if (art) {
      ctx.drawImage(art, pose.parallaxX, pose.parallaxY, size, size);
    }

    // Background motes sit in the world, behind the character.
    for (const mote of controller.dust) {
      if (mote.foreground) continue;
      ctx.globalAlpha = controller.moteAlpha(mote);
      ctx.fillStyle = "rgba(255, 240, 214, 1)";
      ctx.beginPath();
      ctx.arc(
        mote.x + pose.parallaxX * 1.6,
        mote.y + pose.parallaxY * 1.6,
        mote.radius,
        0,
        Math.PI * 2
      );
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Contact shadow. Multiply, not alpha: an alpha wash was being cancelled
    // out by the bright rake crests and the lit patch beneath Blob, so the
    // shadow has to darken whatever is under it rather than sit on top of it.
    // One radial-gradient ellipse, no blur filter, so it ports to the device.
    const halfWidth = Math.max(1, pose.shadowWidth / 2);
    const halfHeight = Math.max(0.6, pose.shadowHeight / 2);
    ctx.save();
    ctx.globalCompositeOperation = "multiply";
    ctx.translate(pose.shadowX, pose.shadowY);
    ctx.scale(1, halfHeight / halfWidth);
    const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, halfWidth);
    const opacity = debugShadow
      ? Math.min(0.95, pose.shadowOpacity * 1.15)
      : pose.shadowOpacity;
    // Warm-dark core with a short falloff; a long linear falloff averaged out
    // to an invisible smudge at native size.
    gradient.addColorStop(0, `rgba(66, 40, 16, ${opacity.toFixed(3)})`);
    gradient.addColorStop(0.55, `rgba(88, 56, 26, ${(opacity * 0.9).toFixed(3)})`);
    gradient.addColorStop(0.82, `rgba(140, 102, 60, ${(opacity * 0.45).toFixed(3)})`);
    gradient.addColorStop(1, "rgba(255, 255, 255, 0)");
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(0, 0, halfWidth, 0, Math.PI * 2);
    ctx.fill();
    if (debugShadow) {
      ctx.globalCompositeOperation = "source-over";
      ctx.lineWidth = 1 / (halfHeight / halfWidth);
      ctx.strokeStyle = "rgba(0, 255, 190, 0.9)";
      ctx.beginPath();
      ctx.arc(0, 0, halfWidth, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
    if (debugShadow) {
      // Crosshair on the derived foot position, so drift is immediately visible.
      ctx.strokeStyle = "rgba(0, 255, 190, 0.9)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(pose.shadowX - 6, pose.shadowY);
      ctx.lineTo(pose.shadowX + 6, pose.shadowY);
      ctx.moveTo(pose.shadowX, pose.shadowY - 6);
      ctx.lineTo(pose.shadowX, pose.shadowY + 6);
      ctx.stroke();
    }
  }, [size, renderScale, mode, controller, pose, frame, z, debugShadow]);

  return (
    <canvas
      ref={canvasRef}
      width={size * renderScale}
      height={size * renderScale}
      style={layerStyle(size, renderScale, z)}
    />
  );
}

/**
 * Everything in front of Blob: the warm light bouncing off the sand onto his
 * underside, and the one or two near motes that sell depth.
 */
export function EnvironmentFront({
  size,
  renderScale,
  mode,
  controller,
  pose,
  frame,
  z,
}: LayerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(renderScale, 0, 0, renderScale, 0, 0);
    ctx.clearRect(0, 0, size, size);

    if (mode !== "dark" && pose.bounceRadius > 1) {
      // Deliberately weak, and only under the lower half — enough to seat Blob
      // in the light without tinting the character orange. It fades as he
      // rises away from the sand.
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = 0.07 * (1 - pose.lift * 0.7);
      const bounce = ctx.createRadialGradient(
        pose.bounceX,
        pose.bounceY,
        0,
        pose.bounceX,
        pose.bounceY,
        pose.bounceRadius
      );
      bounce.addColorStop(0, "rgba(255, 198, 120, 1)");
      bounce.addColorStop(1, "rgba(255, 198, 120, 0)");
      ctx.fillStyle = bounce;
      ctx.beginPath();
      ctx.ellipse(
        pose.bounceX,
        pose.bounceY,
        pose.bounceRadius,
        pose.bounceRadiusY,
        0,
        0,
        Math.PI * 2
      );
      ctx.fill();
      ctx.restore();
    }

    for (const mote of controller.dust) {
      if (!mote.foreground) continue;
      ctx.globalAlpha = controller.moteAlpha(mote);
      ctx.fillStyle = "rgba(255, 244, 224, 1)";
      ctx.beginPath();
      ctx.arc(
        mote.x + pose.parallaxX * 2.4,
        mote.y + pose.parallaxY * 2.4,
        mote.radius,
        0,
        Math.PI * 2
      );
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }, [size, renderScale, mode, controller, pose, frame, z]);

  return (
    <canvas
      ref={canvasRef}
      width={size * renderScale}
      height={size * renderScale}
      style={layerStyle(size, renderScale, z)}
    />
  );
}

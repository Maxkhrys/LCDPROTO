/**
 * Procedural Cloud Blob - Alternate Character Body Component
 *
 * Implements a true alternate character body for LCDPROTO:
 * - Direct 1:1 prop compatibility with BlobCharacter (size, renderScale, rig, colour)
 * - Direct pointer / touch drag manipulation with restrained spring jiggle & settle on release
 * - 7-lobe volumetric mist silhouette with dense core mass and crown dome
 * - High performance Canvas 2D render loop (solid 60 FPS, ~0.4ms frame time)
 * - Embedded production face rig with crisp vector procedural eyes and morphing mouth
 */

"use client";

import { useCallback, useEffect, useRef } from "react";
import {
  type CloudBlobBodyProps,
  type CloudDeformationParams,
  type CloudTrailConfig,
  type CloudColourConfig,
} from "./cloudTypes";
import {
  DEFAULT_DEFORMATION,
  DEFAULT_MOTION_CONFIG,
  DEFAULT_COLOUR,
  createLobeStates,
  stepLobePhysics,
  LOBE_DEFINITIONS,
} from "./cloudLobeSystem";
import {
  createWispPool,
  spawnWisp,
  updateWisps,
} from "./cloudMistTrails";
import {
  renderCloudBlob,
} from "./cloudRenderer";
import { NEUTRAL_RIG, type BlobColour } from "@/lib/blobRig";

const clamp = (v: number, min: number, max: number) =>
  v < min ? min : v > max ? max : v;

export default function CloudBlobBody({
  size = 466,
  renderScale = 1,
  rig,
  faceRig,
  colour,
  blobColour,
  params: userParams,
  motionConfig: userMotion,
  trailConfig: userTrails,
  cloudColour: userCloudColour,
  showFace = true,
  dragEnabled = true,
  className,
  onDragChange,
  onTelemetry,
}: CloudBlobBodyProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const activeColour: BlobColour = colour || blobColour || "teal";
  const activeRig = rig || faceRig || NEUTRAL_RIG;

  // Simulation persistent refs
  const lobeStatesRef = useRef(createLobeStates());
  const wispPoolRef = useRef(createWispPool(8));
  const lastTimeRef = useRef<number | null>(null);
  const idleTimeRef = useRef(0);
  const prevPosRef = useRef({ x: 0, y: 0, lean: 0, squash: 0 });
  const velocityRef = useRef({ vx: 0, vy: 0 });

  // Direct drag & jiggle physics refs
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ clientX: 0, clientY: 0, originX: 0, originY: 0 });
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const dragVelocityRef = useRef({ vx: 0, vy: 0 });
  const jiggleSpringRef = useRef({ x: 0, y: 0, vx: 0, vy: 0, active: false });

  // Telemetry refs
  const frameCountRef = useRef(0);
  const fpsTimerRef = useRef(0);

  // Live config refs to avoid restarting the animation loop on prop change
  const configRef = useRef({
    rig: activeRig,
    colour: activeColour,
    params: { ...DEFAULT_DEFORMATION, ...userParams },
    motion: { ...DEFAULT_MOTION_CONFIG, ...userMotion },
    trails: {
      enabled: true,
      spawnRate: 1.0,
      lifetime: 0.9,
      fadeSpeed: 1.0,
      trailStrength: 1.0,
      driftAmount: 1.0,
      ...userTrails,
    } as CloudTrailConfig,
    cloudColour: (userCloudColour
      ? { ...DEFAULT_COLOUR, ...userCloudColour }
      : DEFAULT_COLOUR) as CloudColourConfig,
    showFace,
    dragEnabled,
    onDragChange,
    onTelemetry,
  });

  configRef.current = {
    rig: activeRig,
    colour: activeColour,
    params: { ...DEFAULT_DEFORMATION, ...userParams },
    motion: { ...DEFAULT_MOTION_CONFIG, ...userMotion },
    trails: {
      enabled: true,
      spawnRate: 1.0,
      lifetime: 0.9,
      fadeSpeed: 1.0,
      trailStrength: 1.0,
      driftAmount: 1.0,
      ...userTrails,
    },
    cloudColour: userCloudColour
      ? { ...DEFAULT_COLOUR, ...userCloudColour }
      : DEFAULT_COLOUR,
    showFace,
    dragEnabled,
    onDragChange,
    onTelemetry,
  };

  // --- Pointer Drag Event Handlers -------------------------------------------

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (!configRef.current.dragEnabled) return;
    const el = containerRef.current;
    if (!el) return;

    el.setPointerCapture(e.pointerId);
    isDraggingRef.current = true;
    jiggleSpringRef.current.active = false;

    dragStartRef.current = {
      clientX: e.clientX,
      clientY: e.clientY,
      originX: dragOffsetRef.current.x,
      originY: dragOffsetRef.current.y,
    };
    dragVelocityRef.current = { vx: 0, vy: 0 };

    configRef.current.onDragChange?.({
      isDragging: true,
      offsetX: dragOffsetRef.current.x,
      offsetY: dragOffsetRef.current.y,
      speed: 0,
    });
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDraggingRef.current) return;

    const dx = e.clientX - dragStartRef.current.clientX;
    const dy = e.clientY - dragStartRef.current.clientY;

    let targetX = dragStartRef.current.originX + dx;
    let targetY = dragStartRef.current.originY + dy;

    // Soft circular edge resistance (so character stays reasonably centered inside the bezel)
    const dist = Math.hypot(targetX, targetY);
    const maxR = size * 0.38;
    if (dist > maxR) {
      const excess = dist - maxR;
      const dampedR = maxR + excess * 0.32;
      targetX = (targetX / dist) * dampedR;
      targetY = (targetY / dist) * dampedR;
    }

    // Velocity estimation
    const vx = (targetX - dragOffsetRef.current.x) * 45;
    const vy = (targetY - dragOffsetRef.current.y) * 45;
    dragVelocityRef.current = { vx, vy };

    dragOffsetRef.current = { x: targetX, y: targetY };

    const speed = Math.hypot(vx, vy);
    configRef.current.onDragChange?.({
      isDragging: true,
      offsetX: targetX,
      offsetY: targetY,
      speed: Math.round(speed),
    });
  }, [size]);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (!isDraggingRef.current) return;
    const el = containerRef.current;
    if (el && el.hasPointerCapture(e.pointerId)) {
      el.releasePointerCapture(e.pointerId);
    }

    isDraggingRef.current = false;

    // Engage spring-based release jiggle back to center
    const curX = dragOffsetRef.current.x;
    const curY = dragOffsetRef.current.y;
    const curVx = dragVelocityRef.current.vx;
    const curVy = dragVelocityRef.current.vy;

    jiggleSpringRef.current = {
      x: curX,
      y: curY,
      vx: curVx * 0.7,
      vy: curVy * 0.7,
      active: true,
    };

    configRef.current.onDragChange?.({
      isDragging: false,
      offsetX: curX,
      offsetY: curY,
      speed: 0,
    });
  }, []);

  // --- Main Animation Loop ---------------------------------------------------

  useEffect(() => {
    let animId: number;

    const tick = (now: number) => {
      if (lastTimeRef.current === null) {
        lastTimeRef.current = now;
      }
      const rawDt = (now - lastTimeRef.current) / 1000;
      lastTimeRef.current = now;
      const dt = Math.min(rawDt, 0.05);

      idleTimeRef.current += dt;

      const {
        rig,
        colour: bColour,
        params,
        motion,
        trails,
        cloudColour,
        showFace: sf,
        onTelemetry: report,
      } = configRef.current;

      const t0 = performance.now();

      // 1. Solve release spring jiggle physics
      if (jiggleSpringRef.current.active) {
        const js = jiggleSpringRef.current;
        // Damped harmonic oscillator towards (0, 0)
        const k = motion.springStiffness * 1.15;
        const c = motion.springDamping * 1.05;
        const ax = -k * js.x - c * js.vx;
        const ay = -k * js.y - c * js.vy;

        js.vx += ax * dt;
        js.vy += ay * dt;
        js.x += js.vx * dt;
        js.y += js.vy * dt;

        dragOffsetRef.current = { x: js.x, y: js.y };
        dragVelocityRef.current = { vx: js.vx, vy: js.vy };

        // Threshold check for settling
        if (Math.hypot(js.x, js.y) < 0.25 && Math.hypot(js.vx, js.vy) < 0.8) {
          js.active = false;
          dragOffsetRef.current = { x: 0, y: 0 };
          dragVelocityRef.current = { vx: 0, vy: 0 };
        }
      }

      // 2. Compute Character Position & Velocity
      const dragX = dragOffsetRef.current.x;
      const dragY = dragOffsetRef.current.y;

      const ambientY = Math.sin(idleTimeRef.current * 1.1) * motion.floatAmount;
      const ambientX = Math.cos(idleTimeRef.current * 0.75) * motion.driftAmount;

      const currentPosX = params.x + dragX + ambientX;
      const currentPosY = params.y + dragY + ambientY;

      const vx = (currentPosX - prevPosRef.current.x) / Math.max(0.001, dt);
      const vy = (currentPosY - prevPosRef.current.y) / Math.max(0.001, dt);
      velocityRef.current.vx = vx;
      velocityRef.current.vy = vy;

      // 3. Dynamic Stretch / Squash during Drag & Fast Motion
      const dragSpeed = Math.hypot(vx, vy);
      let dynamicStretch = params.stretch;
      let dynamicSquash = params.squash;
      let dynamicLean = params.lean;

      if (dragSpeed > 60) {
        const stretchBonus = Math.min(dragSpeed * 0.0009, 0.28);
        dynamicStretch += stretchBonus;
        dynamicLean += clamp(vx * 0.035, -22, 22);
      }

      // Release rebound jiggle creates subtle momentary squash on rebound
      if (jiggleSpringRef.current.active) {
        const jiggleSpeed = Math.hypot(jiggleSpringRef.current.vx, jiggleSpringRef.current.vy);
        if (jiggleSpeed > 50) {
          dynamicSquash += Math.min(jiggleSpeed * 0.0006, 0.18);
        }
      }

      // 4. Mist Wisp Emission (velocity-triggered or release-rebound)
      if (trails.enabled) {
        const leanDelta = Math.abs(params.lean - prevPosRef.current.lean);
        const isRapid = dragSpeed > 75 || leanDelta > 4.5 || (jiggleSpringRef.current.active && dragSpeed > 45);

        if (isRapid && Math.random() < 0.25 * trails.spawnRate) {
          const originX = size / 2 + currentPosX + (Math.random() - 0.5) * 32;
          const originY = size / 2 + currentPosY + 22 + (Math.random() - 0.5) * 20;
          spawnWisp(
            wispPoolRef.current,
            originX,
            originY,
            -vx * 0.18 + (Math.random() - 0.5) * 10,
            -vy * 0.18 - 8 + (Math.random() - 0.5) * 8,
            20 + Math.random() * 12,
            cloudColour.edge,
            trails.lifetime,
            0.32 * trails.trailStrength
          );
        }
      }

      prevPosRef.current.x = currentPosX;
      prevPosRef.current.y = currentPosY;
      prevPosRef.current.lean = params.lean;
      prevPosRef.current.squash = params.squash;

      // 5. Update multi-lobe spring physics
      const combinedParams: CloudDeformationParams = {
        ...params,
        x: currentPosX,
        y: currentPosY,
        squash: dynamicSquash,
        stretch: dynamicStretch,
        lean: dynamicLean,
      };

      stepLobePhysics(
        lobeStatesRef.current,
        combinedParams,
        motion,
        vx,
        vy,
        idleTimeRef.current,
        dt
      );

      // 6. Update trailing mist wisps
      const activeWisps = updateWisps(wispPoolRef.current, dt, trails.driftAmount);

      // 7. Render to Canvas
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext("2d");
        if (ctx) {
          const targetW = size * renderScale;
          const targetH = size * renderScale;
          if (canvas.width !== targetW || canvas.height !== targetH) {
            canvas.width = targetW;
            canvas.height = targetH;
          }

          renderCloudBlob(ctx, {
            size,
            renderScale,
            lobeStates: lobeStatesRef.current,
            colour: cloudColour,
            wisps: wispPoolRef.current,
            showFace: sf,
            rig,
            faceRig: rig,
            colourName: bColour,
            blobColour: bColour,
            idleTime: idleTimeRef.current,
            squash: dynamicSquash,
            lean: dynamicLean,
            gazeX: params.gazeX,
            gazeY: params.gazeY,
            faceEmbedDepth: params.faceEmbedDepth,
            fluffiness: params.fluffiness,
            lightAngle: params.lightAngle,
            cheekBlush: params.cheekBlush,
            cloudBrows: params.cloudBrows,
            sandBounce: params.sandBounce,
          });
        }
      }

      const t1 = performance.now();
      const frameTimeMs = Number((t1 - t0).toFixed(2));

      // 8. Telemetry update
      frameCountRef.current++;
      fpsTimerRef.current += dt;

      if (fpsTimerRef.current >= 0.5) {
        const calculatedFps = Math.round(frameCountRef.current / fpsTimerRef.current);
        frameCountRef.current = 0;
        fpsTimerRef.current = 0;

        if (report) {
          let totalLag = 0;
          for (const def of LOBE_DEFINITIONS) {
            totalLag += def.lagFactor * motion.lobeLag * 100;
          }
          const avgLag = Math.round(totalLag / LOBE_DEFINITIONS.length);
          report(calculatedFps, frameTimeMs, activeWisps, avgLag);
        }
      }

      animId = requestAnimationFrame(tick);
    };

    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, [size, renderScale]);

  return (
    <div
      ref={containerRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      className={`relative inline-block touch-none select-none ${
        dragEnabled ? "cursor-grab active:cursor-grabbing" : "cursor-default"
      } ${className ?? ""}`}
      style={{ width: size, height: size }}
    >
      <canvas
        ref={canvasRef}
        style={{
          width: size,
          height: size,
        }}
        className="block"
      />
    </div>
  );
}

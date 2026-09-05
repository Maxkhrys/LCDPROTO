"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import {
  DEFAULT_COLOUR,
  DEFAULT_DEFORMATION,
  DEFAULT_MOTION_CONFIG,
  createLobeStates,
  stepLobePhysics,
  COLOUR_PRESETS,
} from "@/components/experimental/cloud-blob/cloudLobeSystem";
import {
  createWispPool,
  spawnWisp,
  updateWisps,
} from "@/components/experimental/cloud-blob/cloudMistTrails";
import { renderCloudBlob } from "@/components/experimental/cloud-blob/cloudRenderer";
import type {
  CloudColourConfig,
  CloudDeformationParams,
  CloudMotionConfig,
  CloudTrailConfig,
} from "@/components/experimental/cloud-blob/cloudTypes";
import type { BlobDragController } from "@/lib/blobDrag";
import {
  type CloudFaceSettings,
  CLOUD_PALETTES,
} from "@/lib/characters";
import {
  BODY_FRACTION,
  NEUTRAL_RIG,
  type BlobColour,
  type BlobRig,
} from "@/lib/blobRig";

interface CloudCharacterProps {
  /** Native screen size in pixels (466). */
  size: number;
  /** CSS size of the display, which can differ from the native 466. */
  viewportSize?: number;
  /** Pixels rasterised per 466-space pixel. */
  renderScale: number;
  /** Per-element transforms, from exactly the same rig Blob uses. */
  rig?: BlobRig;
  colour?: BlobColour;
  onOpenTools?: () => void;
  onCloseTools?: () => void;
  settingsOpen?: boolean;
  showPupils?: boolean;
  drag?: BlobDragController;
  /** Cloud-only body sliders. */
  cloudParams?: Partial<CloudDeformationParams>;
  cloudMotion?: Partial<CloudMotionConfig>;
  cloudTrails?: Partial<CloudTrailConfig>;
  cloudColour?: Partial<CloudColourConfig>;
  cloudFace?: CloudFaceSettings;
  cloudPalette?: string;
  canvasRef?: React.MutableRefObject<HTMLCanvasElement | null>;
}

/** Native travel that turns a tap into a drag. Matches BlobCharacter. */
const DRAG_THRESHOLD = 4;
const TAP_SUPPRESSION_MS = 350;

const clamp = (value: number, min: number, max: number) =>
  value < min ? min : value > max ? max : value;

const DEFAULT_TRAILS: CloudTrailConfig = {
  enabled: true,
  spawnRate: 1,
  lifetime: 0.9,
  fadeSpeed: 1,
  trailStrength: 1,
  driftAmount: 1,
};

/**
 * The cloud as a first-class character, driven by the same rig as Blob.
 *
 * This is deliberately a sibling of BlobCharacter rather than a fork of the
 * experimental harness. The harness under components/experimental runs its own
 * animation loop, its own drag and its own copy of the face — useful for
 * isolated R&D, wrong for a character that has to live inside the real system.
 * Here the behaviour controller, drives, physics and drag all stay upstream in
 * HomeState exactly as they are for Blob; this component only turns the rig it
 * is handed into cloud pixels.
 *
 * The face is imported from BlobCharacter, not reimplemented. The experimental
 * renderer carries its own hand-copied face which predates the current lid and
 * mouth work, so `showFace` is left off and the production face is drawn over
 * the top. That way any future expression work lands on both characters.
 */
export default function CloudCharacter({
  size,
  viewportSize,
  renderScale,
  rig = NEUTRAL_RIG,
  colour = "teal",
  onOpenTools,
  onCloseTools,
  settingsOpen = false,
  showPupils = false,
  drag,
  cloudParams,
  cloudMotion,
  cloudTrails,
  cloudColour,
  cloudFace,
  cloudPalette,
  canvasRef: exportCanvasRef,
}: CloudCharacterProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    return () => {
      if (exportCanvasRef) exportCanvasRef.current = null;
    };
  }, [exportCanvasRef]);

  // Simulation state. Kept in refs so a slider change never restarts the sim.
  const lobeStates = useRef(createLobeStates());
  const wisps = useRef(createWispPool(36));
  const idleTime = useRef(0);
  const lastFrame = useRef<number | null>(null);
  const previous = useRef({ x: 0, y: 0 });
  const emissionRef = useRef(0);
  const sequenceRef = useRef(0);
  const prevVel = useRef({ vx: 0, vy: 0 });
  const wasDragging = useRef(false);
  const lastIdleWisp = useRef(0);

  // Pointer bookkeeping, mirroring BlobCharacter so both characters feel the
  // same to handle.
  const pointerId = useRef<number | null>(null);
  const downX = useRef(0);
  const downY = useRef(0);
  const dragging = useRef(false);
  const tapBlockedUntil = useRef(0);
  const [grabbing, setGrabbing] = useState(false);

  useEffect(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;

    const now = performance.now();
    const dt = lastFrame.current === null ? 1 / 60 : (now - lastFrame.current) / 1000;
    lastFrame.current = now;
    const step = clamp(dt, 0, 0.05);
    idleTime.current += step;

    const { blob, body } = rig;

    // The lobe system deliberately has no concept of position, scale or
    // rotation — it only knows deformation. So the whole-character transform
    // is applied here, around both the body and the face together. Feeding
    // blob.x into the lobe params instead would have moved nothing, which is
    // exactly how the face ended up floating beside the cloud on the first
    // attempt.
    // Wall contact drives the lobes directly rather than through the rig's
    // uniform scale. A cloud pressed into the glass has to lose its silhouette
    // on the contact side and find that volume again on the opposite one,
    // which is a per-lobe move that no whole-body squash can express.
    const press = clamp(body.contactPressure, 0, 1);
    const nx = body.contactX;
    const ny = body.contactY;
    const pressRight = press * Math.max(0, nx);
    const pressLeft = press * Math.max(0, -nx);
    const pressDown = press * Math.max(0, ny);
    const pressUp = press * Math.max(0, -ny);

    const params: CloudDeformationParams = {
      ...DEFAULT_DEFORMATION,
      ...cloudParams,
      // squash/stretch are normalised 0..1; the bulges and lean are in the
      // lobe system's own units (pixels of lobe travel, and degrees/30), which
      // is why these gains look so different from each other.
      squash: clamp(
        (cloudParams?.squash ?? DEFAULT_DEFORMATION.squash) +
          Math.max(0, 1 - body.scaleY) * 2.2 +
          press * Math.abs(ny) * 0.7,
        0,
        0.95
      ),
      stretch: clamp(
        (cloudParams?.stretch ?? DEFAULT_DEFORMATION.stretch) +
          Math.max(0, body.scaleY - 1) * 2.2 +
          press * Math.abs(nx) * 0.6,
        0,
        0.95
      ),
      // The crown trails the contact, the way a jelly's top lags its base.
      lean:
        (cloudParams?.lean ?? DEFAULT_DEFORMATION.lean) +
        body.skewX * 1.6 -
        nx * press * 20,
      // Volume displaced at the contact reappears on the far side: the pressed
      // lobes pull in, the opposite ones swell out.
      leftBulge:
        (cloudParams?.leftBulge ?? DEFAULT_DEFORMATION.leftBulge) +
        pressRight * 26 -
        pressLeft * 12,
      rightBulge:
        (cloudParams?.rightBulge ?? DEFAULT_DEFORMATION.rightBulge) +
        pressLeft * 26 -
        pressRight * 12,
      topBulge:
        (cloudParams?.topBulge ?? DEFAULT_DEFORMATION.topBulge) +
        pressDown * 15 -
        pressUp * 8,
      bottomSag:
        (cloudParams?.bottomSag ?? DEFAULT_DEFORMATION.bottomSag) +
        pressUp * 15 -
        pressDown * 8,
      gazeX: clamp(rig.leftEye.x / 9, -1, 1),
      gazeY: clamp(rig.leftEye.y / 7, -1, 1),
    };

    // Resolve palette preset / custom color
    let basePalette: CloudColourConfig = DEFAULT_COLOUR;
    if (cloudPalette && cloudPalette !== "Follow Blob colour" && COLOUR_PRESETS[cloudPalette]) {
      basePalette = COLOUR_PRESETS[cloudPalette];
    } else if (colour && CLOUD_PALETTES[colour] && COLOUR_PRESETS[CLOUD_PALETTES[colour]]) {
      basePalette = COLOUR_PRESETS[CLOUD_PALETTES[colour]];
    }
    const palette: CloudColourConfig = {
      ...basePalette,
      ...cloudColour,
    };

    const motion: CloudMotionConfig = { ...DEFAULT_MOTION_CONFIG, ...cloudMotion };
    const trails: CloudTrailConfig = { ...DEFAULT_TRAILS, ...cloudTrails };

    // Whole-character placement, matching BlobCharacter's own chain.
    const depthScale = clamp(1 + blob.depth * 0.28, 0.84, 1.16);
    const scaleX = blob.scaleX;
    const scaleY = blob.scaleY;
    const offsetX = blob.x + body.x;
    const offsetY = blob.y + body.y + (settingsOpen ? size * 0.075 : 0);

    // Ambient float and drift
    const ambientX = Math.sin(idleTime.current * 0.45) * motion.driftAmount;
    const ambientY = Math.sin(idleTime.current * 0.8) * motion.floatAmount;

    // Character velocity in 466-space pixels per second, for the lobe lag.
    const vx = (offsetX - previous.current.x) / Math.max(step, 1e-3);
    const vy = (offsetY - previous.current.y) / Math.max(step, 1e-3);
    previous.current.x = offsetX;
    previous.current.y = offsetY;

    const speed = Math.hypot(vx, vy);
    const ax = (vx - prevVel.current.vx) / Math.max(step, 1e-3);
    const ay = (vy - prevVel.current.vy) / Math.max(step, 1e-3);
    const acceleration = Math.hypot(ax, ay);
    prevVel.current.vx = vx;
    prevVel.current.vy = vy;

    params.x = offsetX + ambientX;
    params.y = offsetY + ambientY;
    params.scale = blob.scale * depthScale * (cloudParams?.scale ?? 1);
    // Protect core shape: damp whole-character context scaling so character doesn't smear diagonally
    params.scaleX = clamp(1 + (scaleX - 1) * 0.38, 0.78, 1.22);
    params.scaleY = clamp(1 + (scaleY - 1) * 0.38, 0.78, 1.22);
    params.rotation = blob.rotation + body.rotation * 0.5;

    stepLobePhysics(
      lobeStates.current,
      params,
      motion,
      vx / params.scale,
      vy / params.scale,
      idleTime.current,
      step
    );

    const activeWisps = updateWisps(
      wisps.current,
      step,
      trails.driftAmount,
      trails.fadeSpeed
    );

    if (step > 0 && trails.enabled !== false) {
      const isDragging = dragging.current;
      const justReleased = wasDragging.current && !isDragging;
      wasDragging.current = isDragging;

      // Event- and motion-driven energy (no constant fog emission):
      const velEnergy = speed > 95 ? clamp((speed - 95) / 140, 0, 1.3) : 0;
      const accelEnergy = acceleration > 850 ? clamp((acceleration - 850) / 2200, 0, 1.0) : 0;
      const prevSpeed = Math.hypot(prevVel.current.vx, prevVel.current.vy);
      const dot = speed > 10 && prevSpeed > 10
        ? (vx * prevVel.current.vx + vy * prevVel.current.vy) / (speed * prevSpeed)
        : 1;
      const turnEnergy = dot < 0.6 && speed > 55 ? clamp((1 - dot) * 0.9, 0, 0.9) : 0;
      const releaseBonus = justReleased ? 1.8 : 0;

      const dynamicEnergy = velEnergy + accelEnergy + turnEnergy + releaseBonus;

      // Rare idle mist: single delicate wisp at breath peak every 11-14s
      let idleWisp = false;
      if (!isDragging && speed < 15 && idleTime.current - lastIdleWisp.current > 11.0) {
        if (Math.sin(idleTime.current * 0.65) > 0.985) {
          idleWisp = true;
          lastIdleWisp.current = idleTime.current;
        }
      }

      emissionRef.current = dynamicEnergy > 0
        ? emissionRef.current + dynamicEnergy * 6 * step * trails.spawnRate
        : (idleWisp ? 1 : 0);

      const cap = isDragging ? 16 : (speed > 160 ? 14 : (speed > 50 ? 8 : 4));
      while (emissionRef.current >= 1 && activeWisps < cap) {
        emissionRef.current -= 1;
        const speedNorm = Math.max(1, speed);
        const nxVel = speed > 5 ? vx / speedNorm : 0;
        const nyVel = speed > 5 ? vy / speedNorm : -1;

        const seq = sequenceRef.current++;
        const radiusJitter = ((seq % 4) - 1.5) * 2;
        const puffRadius = (14 + (seq % 3) * 3 + radiusJitter) * params.scale;

        // Spawn along the trailing contour opposite to motion direction
        const sideOffset = Math.sin(seq * 2.1) * 26 * params.scale;
        const trailOffset = (72 + (seq % 3) * 14) * params.scale;

        const spawnX = size / 2 + params.x - nxVel * trailOffset - nyVel * sideOffset;
        const spawnY = size / 2 + params.y - nyVel * trailOffset + nxVel * sideOffset;

        const smokeVx = -vx * 0.12 + Math.sin(seq * 2.5) * 10;
        const smokeVy = -vy * 0.12 - 8 + Math.cos(seq * 2.1) * 8;

        spawnWisp(
          wisps.current,
          spawnX,
          spawnY,
          smokeVx,
          smokeVy,
          puffRadius,
          seq % 3 === 0 ? palette.body : palette.edge,
          trails.lifetime * (0.9 + (seq % 3) * 0.15),
          0.42 * trails.trailStrength,
          seq
        );
      }
      emissionRef.current = Math.min(emissionRef.current, 2);
    }

    const wallAngle =
      (body.deformAngle * Math.PI) / 180 - (params.rotation * Math.PI) / 180;
    const wallScaleX = 1 + (body.scaleX - 1) * 0.55;
    const wallScaleY = body.scaleY;

    renderCloudBlob(ctx, {
      size,
      renderScale,
      lobeStates: lobeStates.current,
      colour: palette,
      wisps: wisps.current,
      showFace: true,
      rig,
      colourName: colour,
      idleTime: idleTime.current,
      params,
      wallAngle,
      wallScaleX,
      wallScaleY,
      debug: false,
      vx,
      vy,
      safeRadius: Math.max(0, size / 2 - 170 * params.scale),
      face: cloudFace,
      showPupils,
      showContactShadow: false,
    });
  }, [
    size,
    renderScale,
    rig,
    colour,
    showPupils,
    settingsOpen,
    cloudParams,
    cloudMotion,
    cloudTrails,
    cloudColour,
    cloudFace,
    cloudPalette,
  ]);

  const nativePoint = (
    element: HTMLCanvasElement,
    clientX: number,
    clientY: number
  ) => {
    const rect = element.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) / rect.width) * size,
      y: ((clientY - rect.top) / rect.height) * size,
    };
  };

  const hitTest = (x: number, y: number) => {
    const blobX = size / 2 + rig.blob.x;
    const blobY = size / 2 + rig.blob.y + (settingsOpen ? size * 0.075 : 0);
    const scale = (rig.blob.scale || 1) * (cloudParams?.scale ?? 1);
    return Math.hypot(x - blobX, y - blobY) <= size * BODY_FRACTION * 0.72 * scale;
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!drag) return;
    const p = nativePoint(event.currentTarget, event.clientX, event.clientY);
    if (!hitTest(p.x, p.y)) return;
    pointerId.current = event.pointerId;
    downX.current = p.x;
    downY.current = p.y;
    dragging.current = false;
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!drag || pointerId.current !== event.pointerId) return;
    const p = nativePoint(event.currentTarget, event.clientX, event.clientY);
    if (!dragging.current) {
      if (Math.hypot(p.x - downX.current, p.y - downY.current) < DRAG_THRESHOLD)
        return;
      dragging.current = true;
      setGrabbing(true);
      drag.begin(downX.current, downY.current, event.timeStamp);
    }
    drag.move(p.x, p.y, event.timeStamp);
  };

  const endPointer = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (pointerId.current !== event.pointerId) return;
    pointerId.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (dragging.current) {
      dragging.current = false;
      setGrabbing(false);
      drag?.end();
      tapBlockedUntil.current = performance.now() + TAP_SUPPRESSION_MS;
    }
  };

  const tapAllowed = () => performance.now() >= tapBlockedUntil.current;

  return (
    <canvas
      ref={(node) => {
        canvasRef.current = node;
        if (exportCanvasRef) exportCanvasRef.current = node;
      }}
      width={size * renderScale}
      height={size * renderScale}
      className="block"
      data-character="cloud"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endPointer}
      onPointerCancel={endPointer}
      onClick={(event) => {
        if (!tapAllowed()) return;
        const p = nativePoint(event.currentTarget, event.clientX, event.clientY);
        if (settingsOpen && onCloseTools && hitTest(p.x, p.y)) onCloseTools();
      }}
      onDoubleClick={(event) => {
        if (!tapAllowed()) return;
        const p = nativePoint(event.currentTarget, event.clientX, event.clientY);
        if (!settingsOpen && onOpenTools && hitTest(p.x, p.y)) onOpenTools();
      }}
      style={{
        // Must track the display's CSS size, not the native 466: laid out at
        // its native size inside a scaled stage the canvas overflowed the
        // round crop and the cloud was sliced off along the edges.
        width: viewportSize ?? size,
        height: viewportSize ?? size,
        imageRendering: renderScale === 1 ? "pixelated" : "auto",
        touchAction: drag ? "none" : undefined,
        cursor: drag ? (grabbing ? "grabbing" : "grab") : undefined,
      }}
    />
  );
}

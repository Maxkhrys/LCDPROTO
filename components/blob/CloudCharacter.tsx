"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { drawBlobFace } from "@/components/blob/BlobCharacter";
import {
  DEFAULT_COLOUR,
  DEFAULT_DEFORMATION,
  DEFAULT_MOTION_CONFIG,
  createLobeStates,
  stepLobePhysics,
  LOBE_DEFINITIONS,
} from "@/components/experimental/cloud-blob/cloudLobeSystem";
import {
  createWispPool,
  spawnRandomIdleWisp,
  spawnDirectionalTrailWisp,
  spawnOvershootMistWisp,
  spawnImpactMistWisp,
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
import type { CloudFaceSettings } from "@/lib/characters";
import {
  BODY_FRACTION,
  NEUTRAL_RIG,
  type BlobColour,
  type BlobRig,
} from "@/lib/blobRig";

/** How much of the rig's body deformation the face inherits on the cloud. */
const FACE_DEFORM_INHERIT = 0.3;

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
  canvasRef?: React.MutableRefObject<HTMLCanvasElement | null>;
}

/** Native travel that turns a tap into a drag. Matches BlobCharacter. */
const DRAG_THRESHOLD = 4;
const TAP_SUPPRESSION_MS = 350;

const clamp = (value: number, min: number, max: number) =>
  value < min ? min : value > max ? max : value;

const DEFAULT_TRAILS: CloudTrailConfig = {
  enabled: true,
  spawnRate: 0.5,
  lifetime: 0.9,
  fadeSpeed: 1,
  trailStrength: 0.6,
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
  const wisps = useRef(createWispPool(24));
  const idleTime = useRef(0);
  const idleWispTimer = useRef(0);
  const nextIdleInterval = useRef(4.5 + Math.random() * 3.0);
  const lastFrame = useRef<number | null>(null);
  const previous = useRef({ x: 0, y: 0 });
  const prevVel = useRef({ vx: 0, vy: 0 });
  const prevPress = useRef(0);

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

    const centre = size / 2;
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

    const motion: CloudMotionConfig = { ...DEFAULT_MOTION_CONFIG, ...cloudMotion };
    const trails: CloudTrailConfig = { ...DEFAULT_TRAILS, ...cloudTrails };
    const palette: CloudColourConfig = { ...DEFAULT_COLOUR, ...cloudColour };

    // Whole-character placement, matching BlobCharacter's own chain.
    const depthScale = clamp(1 + blob.depth * 0.28, 0.84, 1.16);
    const scaleX = blob.scale * depthScale * blob.scaleX;
    const scaleY = blob.scale * depthScale * blob.scaleY;
    const offsetX = blob.x + body.x;
    const offsetY = blob.y + body.y + (settingsOpen ? size * 0.075 : 0);

    // Character velocity in 466-space pixels per second, for the lobe lag.
    const vx = (offsetX - previous.current.x) / Math.max(step, 1e-3);
    const vy = (offsetY - previous.current.y) / Math.max(step, 1e-3);
    previous.current.x = offsetX;
    previous.current.y = offsetY;

    stepLobePhysics(
      lobeStates.current,
      params,
      motion,
      vx,
      vy,
      idleTime.current,
      step,
      offsetX,
      offsetY
    );

    if (trails.enabled) {
      const speed = Math.hypot(vx, vy);
      const ax = (vx - prevVel.current.vx) / Math.max(step, 1e-3);
      const ay = (vy - prevVel.current.vy) / Math.max(step, 1e-3);
      const decelDot = vx * ax + vy * ay;

      if (speed >= 55) {
        spawnDirectionalTrailWisp(
          wisps.current,
          centre + offsetX,
          centre + offsetY,
          vx,
          vy,
          palette.edge,
          trails.trailStrength,
          trails.lifetime,
          params.squash,
          params.stretch
        );
      }

      // Overshoot mist puff on rapid stop / sharp reversal
      if (decelDot < -3000 && speed > 45) {
        spawnOvershootMistWisp(
          wisps.current,
          centre + offsetX,
          centre + offsetY,
          vx,
          vy,
          palette.edge,
          trails.trailStrength
        );
      }

      // Wall contact mist puff
      if (press > 0.15 && press - prevPress.current > 0.08) {
        spawnImpactMistWisp(
          wisps.current,
          centre + offsetX,
          centre + offsetY,
          nx,
          ny,
          palette.edge,
          trails.trailStrength * press
        );
      }
      prevPress.current = press;
      prevVel.current.vx = vx;
      prevVel.current.vy = vy;

      // Multi-directional spontaneous idle billow shedding (rare 4.5-7.5s)
      idleWispTimer.current += step;
      if (idleWispTimer.current > nextIdleInterval.current) {
        idleWispTimer.current = 0;
        nextIdleInterval.current = 4.5 + Math.random() * 3.0;
        spawnRandomIdleWisp(
          wisps.current,
          centre + offsetX,
          centre + offsetY,
          palette.edge,
          trails.trailStrength
        );
      }

      updateWisps(wisps.current, step, trails.driftAmount);
    }

    ctx.setTransform(renderScale, 0, 0, renderScale, 0, 0);
    ctx.clearRect(0, 0, size, size);

    // Circular AMOLED screen clipping (466x466 round screen, R=233):
    // Eliminates any rectangular bounding box clipping so mist and lobes
    // contour naturally against the bezel without straight cutoffs.
    ctx.save();
    ctx.beginPath();
    ctx.arc(centre, centre, centre, 0, Math.PI * 2);
    ctx.clip();

    ctx.save();
    ctx.translate(centre + offsetX, centre + offsetY);
    ctx.rotate(((blob.rotation + body.rotation) * Math.PI) / 180);
    ctx.scale(scaleX, scaleY);
    ctx.translate(-centre, -centre);
    ctx.globalAlpha = blob.opacity;

    // Render cloud body directly onto the primary canvas: zero intermediate buffers,
    // zero drawImage copies, full hardware framerate.
    renderCloudBlob(ctx, {
      size,
      renderScale,
      lobeStates: lobeStates.current,
      colour: palette,
      wisps: wisps.current,
      showFace: false,
      colourName: colour,
      idleTime: idleTime.current,
      squash: params.squash,
      lean: params.lean,
      vx,
      vy,
      gazeX: params.gazeX,
      gazeY: params.gazeY,
      faceEmbedDepth: params.faceEmbedDepth,
      fluffiness: params.fluffiness,
      lightAngle: params.lightAngle,
      cheekBlush: params.cheekBlush,
      sandBounce: params.sandBounce,
      clear: false,
      skipTransform: true,
    });

    // The production face rides the visible mass, not the core alone. The
    // lobes lag by design, so during a fast drag the core leads the cheeks and
    // crown by enough that a face pinned to it slides off the leading edge.
    // Averaging the front lobes keeps it seated on what you can actually see.
    const faceLobes = ["core", "leftCheek", "rightCheek", "topCrown"] as const;
    let massX = 0;
    let massY = 0;
    let counted = 0;
    for (const id of faceLobes) {
      const lobe = lobeStates.current[id];
      const def = LOBE_DEFINITIONS.find((entry) => entry.id === id);
      if (!lobe || !def) continue;
      // Each lobe's displacement from where it rests, so the average is a
      // drift rather than the lobe layout itself.
      massX += lobe.x - def.baseX;
      massY += lobe.y - def.baseY;
      counted += 1;
    }
    if (counted > 0) {
      massX /= counted;
      massY /= counted;
    }
    const face = cloudFace ?? { offsetX: 0, offsetY: 10, scale: 1.04 };
    drawBlobFace(ctx, {
      size,
      centre,
      colour,
      rig,
      body: {
        ...body,
        x: massX + face.offsetX,
        y: massY + face.offsetY,
        // The face must NOT inherit the rig's body deformation here. On Blob
        // that scale is the body, so the face rides it; on the cloud the body
        // is the lobes, which already carry the contact, so passing it through
        // sheared the eyes and mouth into diagonal slivers on top of a shape
        // that had not deformed that way. A small share keeps it attached.
        rotation: body.rotation * FACE_DEFORM_INHERIT,
        // Skew is dropped outright rather than damped. It is what turned the
        // eyes into slanted parallelograms: a shear of the body reads as
        // material stretching on Blob, but the cloud's mist has no surface for
        // the face to be painted on, so the shear only distorted the features.
        skewX: 0,
        skewY: 0,
        deformAngle: 0,
        scaleX: (1 + (body.scaleX - 1) * FACE_DEFORM_INHERIT) * face.scale,
        scaleY: (1 + (body.scaleY - 1) * FACE_DEFORM_INHERIT) * face.scale,
      },
      bodyWidth: size * BODY_FRACTION,
      bodyHeight: size * BODY_FRACTION,
      faceVisibility: 1,
      showPupils,
      settingsOpen,
    });
    ctx.restore(); // Restore character transform
    ctx.restore(); // Restore circular AMOLED clip
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
    return Math.hypot(x - blobX, y - blobY) <= size * BODY_FRACTION * 0.72;
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

/** Seven authored masses, six secondary billows, cached alpha stamps. No blur. */
import {
  LOBE_DEFINITIONS,
  LOBE_SUB_PUFFS,
  SUSPENDED_DROPLETS,
} from "./cloudLobeSystem";
import type {
  CloudColourConfig,
  CloudDeformationParams,
  CloudWisp,
  LobeState,
} from "./cloudTypes";
import { faceAnchor, type BlobColour, type BlobRig } from "@/lib/blobRig";
import {
  eyeGeometry,
  drawEyebrow,
  drawProceduralEye,
  drawMouthShape,
  BROW_CLEARANCE_RATIO,
} from "@/components/blob/faceRenderer";

import type { CloudFaceSettings } from "@/lib/characters";

export interface RenderOptions {
  size: number;
  renderScale: number;
  lobeStates: Record<string, LobeState>;
  colour: CloudColourConfig;
  wisps: CloudWisp[];
  showFace: boolean;
  rig: BlobRig;
  colourName: BlobColour;
  idleTime: number;
  params: CloudDeformationParams;
  wallAngle: number;
  wallScaleX: number;
  wallScaleY: number;
  debug: boolean;
  vx: number;
  vy: number;
  safeRadius: number;
  face?: CloudFaceSettings;
  showPupils?: boolean;
  showContactShadow?: boolean;
}
const TAU = Math.PI * 2;
/** 466-space distance between authored depth tiers, for the 2.5D rotation. */
const DEPTH_UNIT = 34;
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
export function parseHexColor(hex: string) {
  const clean = hex.replace("#", "");
  const full =
    clean.length === 3
      ? clean
          .split("")
          .map((c) => c + c)
          .join("")
      : clean;
  const value = /^[\da-f]{6}$/i.test(full) ? parseInt(full, 16) : 0xd8e6ff;
  return { r: value >> 16, g: (value >> 8) & 255, b: value & 255 };
}
const rgba = (c: ReturnType<typeof parseHexColor>, a: number) =>
  `rgba(${c.r},${c.g},${c.b},${a})`;
interface Stamps {
  key: string;
  mass: HTMLCanvasElement;
  rearMass: HTMLCanvasElement;
  crevice: HTMLCanvasElement;
  crestRim: HTMLCanvasElement;
  underside: HTMLCanvasElement;
  core: HTMLCanvasElement;
  mist: HTMLCanvasElement;
  smoke: HTMLCanvasElement;
  glow: HTMLCanvasElement;
  shadow: HTMLCanvasElement;
  builds: number;
}
const caches = new WeakMap<CanvasRenderingContext2D, Stamps>();
function sprite(paint: (ctx: CanvasRenderingContext2D) => void, size = 128) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  ctx.translate(size / 2, size / 2);
  ctx.scale(size / 2, size / 2);
  paint(ctx);
  return canvas;
}
function getStamps(
  ctx: CanvasRenderingContext2D,
  c: CloudColourConfig,
  p: CloudDeformationParams,
) {
  const key = `${c.body}|${c.edge}|${c.coreTint}|${c.innerGlow}|${p.lightAngle}|${p.lightStrength}|${c.translucency}|v2`;
  const old = caches.get(ctx);
  if (old?.key === key) return old;
  const body = parseHexColor(c.body),
    edge = parseHexColor(c.edge),
    core = parseHexColor(c.coreTint);
  const rad = (p.lightAngle * Math.PI) / 180;
  const lx = Math.cos(rad),
    ly = Math.sin(rad);

  // Front & Mid Volumetric Lobe: Selective crisp edge, forward scattering, and terminator form shadow
  const makeMass = (dense: boolean) =>
    sprite((s) => {
      const volume = s.createRadialGradient(
        lx * 0.28,
        ly * 0.28,
        0.02,
        0,
        0,
        1,
      );
      volume.addColorStop(0, rgba(edge, 1));
      volume.addColorStop(0.48, rgba(body, dense ? 1 : 0.98));
      volume.addColorStop(0.78, rgba(body, dense ? 0.96 : 0.9));
      volume.addColorStop(0.92, rgba(body, 0.42 * c.translucency));
      volume.addColorStop(1, rgba(body, 0));
      s.fillStyle = volume;
      s.fillRect(-1, -1, 2, 2);

      s.globalCompositeOperation = "source-atop";
      // Rich spherical form shadow on the unlit side
      const shade = s.createLinearGradient(lx, ly, -lx, -ly);
      shade.addColorStop(0, "rgba(255,255,255,0)");
      shade.addColorStop(0.35, "rgba(255,255,255,0)");
      shade.addColorStop(0.58, rgba(core, p.lightStrength * 0.22));
      shade.addColorStop(0.84, rgba(core, p.lightStrength * 0.62));
      shade.addColorStop(1.0, rgba(core, p.lightStrength * 0.82));
      s.fillStyle = shade;
      s.fillRect(-1, -1, 2, 2);
    });

  // Rear Grounded Masses: Softer atmospheric tone that recedes gracefully behind the core
  const makeRearMass = () =>
    sprite((s) => {
      const volume = s.createRadialGradient(
        lx * 0.22,
        ly * 0.22,
        0.04,
        0,
        0,
        1,
      );
      volume.addColorStop(0, rgba(edge, 0.92));
      volume.addColorStop(0.35, rgba(body, 0.92));
      volume.addColorStop(0.68, rgba(body, 0.82));
      volume.addColorStop(0.88, rgba(body, 0.38 * c.translucency));
      volume.addColorStop(1, rgba(body, 0));
      s.fillStyle = volume;
      s.fillRect(-1, -1, 2, 2);

      s.globalCompositeOperation = "source-atop";
      const shade = s.createLinearGradient(lx, ly, -lx, -ly);
      shade.addColorStop(0, "rgba(255,255,255,0.15)");
      shade.addColorStop(0.45, "rgba(255,255,255,0)");
      shade.addColorStop(0.8, rgba(core, p.lightStrength * 0.45));
      shade.addColorStop(1.0, rgba(core, p.lightStrength * 0.65));
      s.fillStyle = shade;
      s.fillRect(-1, -1, 2, 2);
    });

  // Crevice Ambient Occlusion: Defined darkening between overlapping billows
  const makeCrevice = () =>
    sprite((s) => {
      const g = s.createRadialGradient(0, 0, 0, 0, 0, 1);
      g.addColorStop(0, rgba(core, clamp(p.lightStrength * 0.42, 0.22, 0.52)));
      g.addColorStop(0.42, rgba(core, clamp(p.lightStrength * 0.24, 0.1, 0.32)));
      g.addColorStop(0.78, rgba(core, 0.03));
      g.addColorStop(1, rgba(core, 0));
      s.fillStyle = g;
      s.fillRect(-1, -1, 2, 2);
    }, 64);

  // Top Crest Rim Light: Radiant rim accent catching directional light on crown/shoulders
  const makeCrestRim = () =>
    sprite((s) => {
      const g = s.createRadialGradient(lx * 0.5, ly * 0.5, 0.05, 0, 0, 1);
      g.addColorStop(0, rgba(edge, 0.5));
      g.addColorStop(0.35, rgba(edge, 0.2));
      g.addColorStop(0.7, rgba(edge, 0.04));
      g.addColorStop(1, rgba(edge, 0));
      s.fillStyle = g;
      s.fillRect(-1, -1, 2, 2);
    }, 64);

  // Global Underside Ambient Shadow: Anchors the bottom mass
  const makeUnderside = () =>
    sprite((s) => {
      const g = s.createRadialGradient(0, 0.2, 0.1, 0, 0, 1);
      g.addColorStop(0, rgba(core, 0.32));
      g.addColorStop(0.55, rgba(core, 0.12));
      g.addColorStop(1, rgba(core, 0));
      s.fillStyle = g;
      s.fillRect(-1, -1, 2, 2);
    }, 128);

  const soft = (color: string, middle: number) =>
    sprite((s) => {
      const rgb = parseHexColor(color);
      const g = s.createRadialGradient(0, 0, 0, 0, 0, 1);
      g.addColorStop(0, rgba(rgb, 1));
      g.addColorStop(0.4, rgba(rgb, middle));
      g.addColorStop(1, rgba(rgb, 0));
      s.fillStyle = g;
      s.fillRect(-1, -1, 2, 2);
    }, 64);

  const stamps: Stamps = {
    key,
    mass: makeMass(false),
    rearMass: makeRearMass(),
    crevice: makeCrevice(),
    crestRim: makeCrestRim(),
    underside: makeUnderside(),
    core: sprite((s) => {
      const g = s.createRadialGradient(lx * 0.28, ly * 0.28, 0.02, 0, 0, 1);
      g.addColorStop(0, rgba(edge, 1));
      g.addColorStop(0.5, rgba(body, 0.96));
      g.addColorStop(0.78, rgba(body, 0.56));
      g.addColorStop(1, rgba(body, 0));
      s.fillStyle = g;
      s.fillRect(-1, -1, 2, 2);
      s.globalCompositeOperation = "source-atop";
      const shade = s.createLinearGradient(lx, ly, -lx, -ly);
      shade.addColorStop(0, "rgba(255,255,255,0)");
      shade.addColorStop(0.45, "rgba(255,255,255,0)");
      shade.addColorStop(0.72, rgba(core, p.lightStrength * 0.35));
      shade.addColorStop(1.0, rgba(core, p.lightStrength * 0.58));
      s.fillStyle = shade;
      s.fillRect(-1, -1, 2, 2);
    }),
    mist: soft(c.edge, 0.42),
    smoke: sprite((s) => {
      const g = s.createRadialGradient(0, 0, 0, 0, 0, 1);
      g.addColorStop(0, rgba(edge, 0.92));
      g.addColorStop(0.28, rgba(body, 0.76));
      g.addColorStop(0.6, rgba(body, 0.38));
      g.addColorStop(0.85, rgba(edge, 0.1));
      g.addColorStop(1, rgba(body, 0));
      s.fillStyle = g;
      s.fillRect(-1, -1, 2, 2);
    }, 64),
    glow: soft(c.innerGlow, 0.3),
    shadow: soft("#080b10", 0.42),
    builds: (old?.builds ?? 0) + 1,
  };
  caches.set(ctx, stamps);
  return stamps;
}
function stamp(
  ctx: CanvasRenderingContext2D,
  image: HTMLCanvasElement,
  x: number,
  y: number,
  rx: number,
  ry: number,
  alpha: number,
  rotation = 0,
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  ctx.globalAlpha *= clamp(alpha, 0, 1);
  ctx.drawImage(image, -rx, -ry, rx * 2, ry * 2);
  ctx.restore();
}

/**
 * Projects a face feature onto the front of a rounded volume.
 *
 * The face is not one flat layer that gets squashed: each anchor sits at its
 * own angle on a sphere of radius FACE_RADIUS, and yaw rotates that angle.
 * Spacing compression, the near/far relationship and how far the whole group
 * travels all fall out of the projection rather than being faked with scaleX.
 *
 * Returns the projected offset plus `facing`, which is 1 when the feature
 * points straight at the viewer and falls off as it curves away.
 */
const FACE_RADIUS = 96;

function projectFeature(ox: number, oy: number, yawRad: number, pitchRad: number) {
  const theta = Math.asin(clamp(ox / FACE_RADIUS, -1, 1));
  const turned = theta + yawRad;
  const x = FACE_RADIUS * Math.sin(turned);
  const facing = Math.cos(turned);

  const phi = Math.asin(clamp(oy / FACE_RADIUS, -1, 1));
  const turnedY = phi + pitchRad;
  const y = FACE_RADIUS * Math.sin(turnedY);

  return { x, y, facing: clamp(facing, -1, 1) };
}

function drawFace(ctx: CanvasRenderingContext2D, o: RenderOptions) {
  const { size, rig, colourName, params: p } = o;
  const core = o.lobeStates.core;
  const face = o.face ?? { offsetX: 0, offsetY: 0, scale: 1 };
  const faceScale = face.scale ?? 1;

  // Dynamic turning yaw & pitch from combined rig and motion heading
  const yaw = clamp(p.turnYaw ?? (rig.blob.yaw ?? 0), -45, 45);
  const pitch = clamp(p.turnPitch ?? (rig.blob.pitch ?? 0), -30, 30);
  const yawRad = (yaw * Math.PI) / 180;
  const pitchRad = (pitch * Math.PI) / 180;
  const yawSin = Math.sin(yawRad);
  const pitchSin = Math.sin(pitchRad);

  // The face group rides around the surface of the core.
  const faceTurnX = yawSin * 30;
  const faceTurnY = pitchSin * 20 - Math.abs(yawSin) * 5;

  // The group as a whole is only lightly foreshortened. Perspective is carried
  // by the per-feature projection below; crushing the whole plane on top of it
  // is what used to turn the eyes into slits.
  const faceYawWidth = clamp(0.82 + Math.cos(yawRad) * 0.18, 0.72, 1);
  const facePitchHeight = clamp(0.88 + Math.abs(Math.cos(pitchRad)) * 0.12, 0.86, 1);

  // Smooth profile fade only at extreme angles.
  const profileAmount = Math.max(0, Math.abs(yawSin) - 0.78);
  const faceVisibility = clamp(1 - profileAmount * 2.0, 0.35, 1);

  ctx.save();
  ctx.translate(
    core.x + (face.offsetX ?? 0) + faceTurnX,
    core.y + (face.offsetY ?? 0) + faceTurnY
  );
  ctx.rotate(core.rotation * 0.65 + yawSin * 0.08);
  ctx.scale(
    (1 + (core.scaleX - 1) * 0.56) * faceScale * faceYawWidth,
    (1 + (core.scaleY - 1) * 0.56) * faceScale * facePitchHeight
  );
  ctx.globalAlpha *= faceVisibility;

  for (const id of ["leftEye", "rightEye"] as const) {
    const a = faceAnchor(id, size, colourName),
      t = { ...rig[id] };
    const isLeft = id === "leftEye";

    // Where this eye ends up once the face plane has turned. Everything about
    // the eye's position and prominence comes from this one projection.
    const baseX = a.x - size / 2;
    const baseY = a.y - size / 2;
    const projected = projectFeature(baseX, baseY, yawRad, pitchRad);

    // How square-on this eye now is, relative to facing the viewer.
    const facing = clamp(projected.facing, 0.2, 1);
    const restFacing = Math.cos(Math.asin(clamp(baseX / FACE_RADIUS, -1, 1)));
    const prominence = clamp(facing / Math.max(restFacing, 0.2), 0.6, 1.25);

    // Readability floors. The far eye narrows and dims, but it never collapses
    // into a bar: at full yaw it is still four fifths of its width and nearly
    // its full height, which stays clearly legible at 466.
    const eyeScaleX = clamp(0.82 + (prominence - 1) * 0.55, 0.82, 1.1);
    const eyeScaleY = clamp(0.95 + (prominence - 1) * 0.18, 0.95, 1.06);
    const eyeOpenMod = clamp(0.92 + (prominence - 1) * 0.3, 0.9, 1.12);
    const eyeAlphaMod = clamp(0.84 + (prominence - 1) * 0.5, 0.84, 1);
    const browAngleMod = (isLeft ? 1 : -1) * yawSin * 4;

    t.eyeOpen *= eyeOpenMod;

    const eye = eyeGeometry(a.width * eyeScaleX, a.height * eyeScaleY, t, false);

    // Directional gaze. This is the loudest part of the turn on purpose: the
    // pupil mass travels up to a third of the aperture, which reads instantly
    // at native size, and still leaves the black inside the lid band.
    const gazeTravelX = eye.width * 0.33;
    const gazeTravelY = eye.height * 0.16;
    eye.centerX = clamp(
      eye.centerX + p.gazeX * gazeTravelX,
      -gazeTravelX,
      gazeTravelX
    );
    eye.centerY = clamp(
      eye.centerY + p.gazeY * gazeTravelY,
      -gazeTravelY,
      gazeTravelY
    );

    ctx.save();
    ctx.translate(projected.x + t.socketX, projected.y + t.socketY);
    ctx.globalAlpha *= t.opacity * eyeAlphaMod;

    // Optional mist accent behind brows
    if (p.cloudBrows) {
      ctx.save();
      ctx.globalAlpha *= 0.18;
      ctx.fillStyle = "#f1f4ff";
      ctx.beginPath();
      ctx.ellipse(0, -eye.height * 0.74, eye.width * 0.6, 3, 0, 0, TAU);
      ctx.fill();
      ctx.restore();
    }

    // The brow is drawn in the eye's own projected space, so it travels with
    // its socket around the curve without any separate bookkeeping.
    ctx.save();
    ctx.globalAlpha *= 0.88;
    drawEyebrow(
      ctx,
      eye,
      t.browLift,
      t.browRotation + browAngleMod,
      size * BROW_CLEARANCE_RATIO,
    );
    ctx.restore();

    ctx.rotate((t.rotation * Math.PI) / 180);
    drawProceduralEye(
      ctx,
      eye,
      o.showPupils ?? false,
      t.pupilX,
      t.pupilY,
      t.pupilScale,
      t.lidBias,
    );
    ctx.restore();
  }

  // The mouth rides the same curved surface, and leans a little further into
  // the turn than the eyes so the whole head reads as pointing that way.
  const a = faceAnchor("mouth", size, colourName),
    t = rig.mouth;
  const mouthProjected = projectFeature(
    a.x - size / 2,
    a.y - size / 2,
    yawRad,
    pitchRad
  );
  const mouthPerspX = clamp(0.86 + Math.cos(yawRad) * 0.14, 0.82, 1);
  ctx.save();
  ctx.translate(
    mouthProjected.x + t.x + yawSin * 5,
    mouthProjected.y + t.y
  );
  ctx.globalAlpha *= t.opacity;
  drawMouthShape(
    ctx,
    a.width * 0.95 * clamp(t.scaleX * mouthPerspX, 0.55, 1.18),
    a.height * 1.08 * clamp(t.scaleY, 0.7, 1.24),
    clamp(t.mouthCurve, -1, 1),
    t.mouthO,
    t.mouthD,
    t.mouthCrescent ?? 0,
    colourName
  );
  ctx.restore();
  ctx.restore();
}

export function renderCloudBlob(
  ctx: CanvasRenderingContext2D,
  o: RenderOptions,
): void {
  const { size, renderScale, params: p, lobeStates, colour, idleTime: t } = o;
  const s = getStamps(ctx, colour, p);
  ctx.setTransform(renderScale, 0, 0, renderScale, 0, 0);
  ctx.clearRect(0, 0, size, size);
  ctx.save();
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2, 0, TAU);
  ctx.clip();

  // Wisps stay in world space and behind the character.
  for (const w of o.wisps) {
    if (!w.active) continue;
    const elongation = w.shape === 2 ? 1.1 : 1.45;
    // Volumetric billowing smoke puff
    stamp(
      ctx,
      s.smoke,
      w.x,
      w.y,
      w.radius * elongation,
      w.radius * 0.78,
      w.opacity,
      w.angle,
    );
    // Ethereal outer vapor halo
    if (w.shape !== 0) {
      stamp(
        ctx,
        s.mist,
        w.x + Math.cos(w.angle + w.curl) * w.radius * 0.45,
        w.y + Math.sin(w.angle + w.curl) * w.radius * 0.45,
        w.radius * 1.1,
        w.radius * 0.55,
        w.opacity * 0.65,
        w.angle + w.curl,
      );
    }
  }

  // Contact shadow on the floor (only rendered if explicitly requested, as EnvironmentLayer handles the official grounded shadow)
  if (o.showContactShadow) {
    const altitude = Math.max(0, -p.y);
    const shadowFade = clamp(1 - altitude / 130, 0, 1);
    if (shadowFade > 0.01) {
      const height = clamp(1 - p.y / 160, 0.45, 1.35);
      stamp(
        ctx,
        s.shadow,
        size / 2 + p.x * 0.4,
        size / 2 + 130 * p.scale + Math.max(0, p.y) * 0.4,
        95 * p.scale * height,
        13 * p.scale,
        (0.22 / height) * shadowFade,
      );
    }
  }

  const yaw = clamp(p.turnYaw ?? (o.rig.blob.yaw ?? 0), -45, 45);
  const pitch = clamp(p.turnPitch ?? (o.rig.blob.pitch ?? 0), -30, 30);
  const yawRad = (yaw * Math.PI) / 180;
  const pitchRad = (pitch * Math.PI) / 180;
  const yawSin = Math.sin(yawRad);
  const yawCos = Math.cos(yawRad);
  const pitchSin = Math.sin(pitchRad);
  const pitchCos = Math.cos(pitchRad);

  // 3D Horizontal body foreshortening:
  // Kept subtle (0.94-1.0) so the cloud stays volumetric and never squashes into a flat paper cutout.
  // 3D depth illusion is generated by internal 2.5D lobe rotation, face dome curve, and cheek volume swells.
  const bodyYawWidth = clamp(0.94 + Math.abs(yawCos) * 0.06, 0.94, 1);
  const bodyPitchHeight = clamp(0.96 + Math.abs(pitchCos) * 0.04, 0.96, 1);

  ctx.save();
  ctx.translate(size / 2 + p.x, size / 2 + p.y);
  ctx.rotate((p.rotation * Math.PI) / 180);
  ctx.scale(p.scale * p.scaleX * bodyYawWidth, p.scale * p.scaleY * bodyPitchHeight);
  ctx.rotate(o.wallAngle);
  ctx.scale(o.wallScaleX, o.wallScaleY);
  ctx.rotate(-o.wallAngle);
  ctx.globalAlpha = o.rig.blob.opacity;

  // Directional Light Follow:
  // As Cloud moves across the 466 AMOLED screen, the incident directional light follows him
  // with physical angle parallax and compensates for whole-character rotation/lean so the light stays world-anchored.
  const lightParallaxX = clamp((p.x / (size / 2)) * 0.22, -0.25, 0.25);
  const worldRotRad = (p.rotation * Math.PI) / 180;
  const lightFollowRotation = -worldRotRad * 0.65 + lightParallaxX;

  // Lobe 3D pose calculator with depth parallax & cohesive pull lag
  const getLobePose = (def: (typeof LOBE_DEFINITIONS)[number]) => {
    const l = lobeStates[def.id] ?? { x: def.baseX, y: def.baseY, scaleX: 1, scaleY: 1, opacity: 1, rotation: 0 };
    const depth = def.depth ?? 0;
    // 3D Parallax offset: front lobes rotate with yaw, rear lobes shift opposite
    const parallaxY = depth * pitchSin * 18 - (depth > 0 ? Math.abs(yawSin) * 5 : 0);

    // Whole-body inertial trailing lag (all lobes stay together, NO differential depth tearing)
    const pullLagX = clamp(-o.vx * 0.02, -14, 14);
    const pullLagY = clamp(-o.vy * 0.02, -14, 14);

    // 2.5D projection. Each lobe carries a cheap z taken from its authored
    // depth tier, and yaw rotates the (x, z) pair about the body axis. That
    // single rotation gives three things the old parallax offset could not:
    // real horizontal foreshortening, a near/far scale that follows the
    // rotated z rather than the authored one, and a projected z the draw order
    // can sort on — so a cheek genuinely swings in front of or behind the core
    // instead of staying pinned to its tier.
    const bz = depth * DEPTH_UNIT;
    const bx = def.baseX;
    const rotatedX = bx * yawCos + bz * yawSin;
    const rotatedZ = -bx * yawSin + bz * yawCos;
    const projectionShift = rotatedX - bx;

    const x = l.x + projectionShift + pullLagX;
    const y = l.y + parallaxY + pullLagY;

    // Near lobes read slightly larger and clearer, far ones slightly smaller
    // and denser. Kept gentle: this is depth cueing, not a zoom.
    const zNorm = clamp(rotatedZ / (DEPTH_UNIT * 2.4), -1, 1);
    const depthScale = clamp(1 + zNorm * 0.11, 0.86, 1.14);

    const softness = clamp(p.lobeSoftness, 0.75, 1.3);
    const rx = def.radiusX * l.scaleX * softness * depthScale;
    const ry = def.radiusY * l.scaleY * softness * depthScale;

    return {
      x,
      y,
      rx,
      ry,
      opacity: l.opacity,
      rotation: l.rotation,
      scaleX: l.scaleX,
      scaleY: l.scaleY,
      depth,
      z: rotatedZ,
      zNorm,
    };
  };

  /**
   * Every shell lobe posed once, back to front on projected z. Six poses and
   * one sort per frame — nothing next to the stamps they feed.
   */
  const shellLobes = LOBE_DEFINITIONS.filter(
    (def) => def.id !== "frontVeil" && def.id !== "core"
  )
    .map((def) => ({ def, pose: getLobePose(def) }))
    .sort((a, b) => a.pose.z - b.pose.z);

  /** Membership is the projected z, so a lobe can change sides mid-turn. */
  const orderedLobes = (predicate: (z: number) => boolean) =>
    shellLobes.filter((entry) => predicate(entry.pose.z));

  const coreDef = LOBE_DEFINITIONS.find((d) => d.id === "core")!;
  const corePose = getLobePose(coreDef);
  const bottomBellyDef = LOBE_DEFINITIONS.find((d) => d.id === "bottomBelly");
  const bottomBellyPose = bottomBellyDef ? getLobePose(bottomBellyDef) : null;
  const leftCheekDef = LOBE_DEFINITIONS.find((d) => d.id === "leftCheek");
  const rightCheekDef = LOBE_DEFINITIONS.find((d) => d.id === "rightCheek");
  const crownDef = LOBE_DEFINITIONS.find((d) => d.id === "topCrown");
  const leftCheekPose = leftCheekDef ? getLobePose(leftCheekDef) : null;
  const rightCheekPose = rightCheekDef ? getLobePose(rightCheekDef) : null;
  const crownPose = crownDef ? getLobePose(crownDef) : null;

  // 1. LOBES BEHIND THE CORE, back to front on projected z. Membership is no
  // longer the authored tier: during a turn a cheek can cross into this group.
  for (const { def, pose } of orderedLobes((z) => z < 0)) {
    const l = lobeStates[def.id];
    const subs = LOBE_SUB_PUFFS[def.id];
    if (subs && p.fluffiness > 0.05) {
      for (const sub of subs) {
        const breathe = Math.sin(t * 1.1 + (sub.phaseOffset ?? 0)) * 0.7;
        stamp(
          ctx,
          s.rearMass,
          pose.x + sub.offsetX * p.fluffiness * l.scaleX,
          pose.y + (sub.offsetY * p.fluffiness + breathe) * l.scaleY,
          pose.rx * sub.radiusRatio,
          pose.ry * sub.radiusRatio,
          l.opacity * 0.85,
          pose.rotation + lightFollowRotation,
        );
      }
    }
    stamp(
      ctx,
      s.rearMass,
      pose.x,
      pose.y,
      pose.rx,
      pose.ry,
      Math.min(1, l.opacity * colour.density * 1.05 * (1 - pose.zNorm * 0.06)),
      pose.rotation + lightFollowRotation,
    );
  }

  // 2. CONNECTIVE CORE BRIDGE (fuses core and bottom belly/base lobes into one continuous solid volume)
  if (bottomBellyPose) {
    const bridgeX = (corePose.x + bottomBellyPose.x) * 0.5;
    const bridgeY = (corePose.y + bottomBellyPose.y) * 0.5;
    stamp(
      ctx,
      s.mass,
      bridgeX,
      bridgeY,
      118 * corePose.scaleX,
      72 * corePose.scaleY,
      0.94,
      lightFollowRotation,
    );
  }

  // 3. DYNAMIC UNDERSIDE AMBIENT OCCLUSION SHADOW (anchored inside lower volume, cleanly contained)
  const trueBottomY = bottomBellyPose
    ? corePose.y * 0.35 + bottomBellyPose.y * 0.65
    : corePose.y + 24;
  stamp(ctx, s.underside, corePose.x, trueBottomY, 116 * corePose.scaleX, 34 * corePose.scaleY, 0.38);

  // 4. CENTRAL CLOUD CORE
  stamp(
    ctx,
    s.core,
    corePose.x,
    corePose.y + 10,
    126 * corePose.scaleX,
    100 * corePose.scaleY,
    clamp(p.coreDensity * colour.density, 0, 1),
    lightFollowRotation,
  );
  stamp(ctx, s.glow, corePose.x, corePose.y + 12, 80, 70, colour.glowIntensity * 0.16, lightFollowRotation);

  // 5. PROXIMITY-BASED BILLOW CREVICE SHADOWS (soft, only between closely overlapping lobes)
  if (leftCheekPose && Math.hypot(leftCheekPose.x - corePose.x, leftCheekPose.y - corePose.y) < 95) {
    stamp(ctx, s.crevice, leftCheekPose.x * 0.5 + corePose.x * 0.5, leftCheekPose.y * 0.5 + corePose.y * 0.5 + 4, 38, 34, 0.35);
  }
  if (rightCheekPose && Math.hypot(rightCheekPose.x - corePose.x, rightCheekPose.y - corePose.y) < 95) {
    stamp(ctx, s.crevice, rightCheekPose.x * 0.5 + corePose.x * 0.5, rightCheekPose.y * 0.5 + corePose.y * 0.5 + 4, 38, 34, 0.35);
  }
  if (crownPose && Math.hypot(crownPose.x - corePose.x, crownPose.y - corePose.y) < 90) {
    stamp(ctx, s.crevice, crownPose.x * 0.5 + corePose.x * 0.5, crownPose.y * 0.5 + corePose.y * 0.5 + 8, 44, 30, 0.35);
  }

  // 6. LOBES IN FRONT OF THE CORE, back to front on projected z.
  for (const { def, pose } of orderedLobes((z) => z >= 0)) {
    const l = lobeStates[def.id];
    const subs = LOBE_SUB_PUFFS[def.id];
    if (subs && p.fluffiness > 0.05) {
      for (const sub of subs) {
        const breathe = Math.sin(t * 1.1 + (sub.phaseOffset ?? 0)) * 0.7;
        stamp(
          ctx,
          s.mass,
          pose.x + sub.offsetX * p.fluffiness * l.scaleX,
          pose.y + (sub.offsetY * p.fluffiness + breathe) * l.scaleY,
          pose.rx * sub.radiusRatio,
          pose.ry * sub.radiusRatio,
          l.opacity * 0.88,
          pose.rotation + lightFollowRotation,
        );
      }
    }
    stamp(
      ctx,
      s.mass,
      pose.x,
      pose.y,
      pose.rx,
      pose.ry,
      Math.min(1, l.opacity * colour.density * 1.08 * (1 + pose.zNorm * 0.05)),
      pose.rotation + lightFollowRotation,
    );
  }

  // 7. TOP CREST & CHEEK RIM LIGHT ACCENTS - Disabled to ensure completely smooth, mark-free cloud surface

  // 8. RESTRAINED INTERNAL LIFE MOTES (Gentle, slow breathing shimmer deep inside volume)
  for (const d of SUSPENDED_DROPLETS) {
    // Smooth, gentle continuous breathing cycle (no abrupt on/off glitter pop)
    const shimmer = 0.5 + 0.5 * Math.sin(t * d.driftSpeed + d.driftPhase);
    if (shimmer < 0.05) continue;
    const dropDepth = d.radius > 2.0 ? 0.8 : -0.6;
    const dropParallaxX = dropDepth * yawSin * 14;
    const dropParallaxY = dropDepth * pitchSin * 10;
    const x = corePose.x + d.x * 1.35 + dropParallaxX;
    const y = corePose.y + d.y * 1.1 + dropParallaxY;
    // Soft ambient mist halo around the mote
    stamp(
      ctx,
      s.mist,
      x,
      y,
      d.radius * 7,
      d.radius * 7,
      shimmer * d.brightness * 0.16,
    );
    // Faint, soft inner glint harmonized with cloud edge tint
    ctx.save();
    ctx.globalAlpha *= shimmer * d.brightness * 0.22;
    ctx.fillStyle = colour.edge;
    ctx.beginPath();
    ctx.arc(x, y, d.radius * 0.55, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  // 9. CHEEK BLUSH
  if (p.cheekBlush > 0 && leftCheekPose && rightCheekPose) {
    ctx.save();
    ctx.fillStyle = "#e8999f";
    ctx.globalAlpha *= p.cheekBlush * 0.15;
    ctx.beginPath();
    ctx.ellipse(leftCheekPose.x + 18, leftCheekPose.y + 16, 17, 8, 0, 0, TAU);
    ctx.ellipse(rightCheekPose.x - 18, rightCheekPose.y + 16, 17, 8, 0, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  // 10. LOCAL FACIAL DEPTH EMBEDDING (Dense core bed beneath features)
  stamp(ctx, s.core, corePose.x, corePose.y + 8, 96 * corePose.scaleX, 74 * corePose.scaleY, 0.42);
  stamp(ctx, s.mist, corePose.x, corePose.y + 26, 88, 44, Math.max(0.08, p.faceEmbedDepth * 0.2));
  // A slightly denser bed directly under the features so they sit in the
  // volume rather than on it. Nothing is drawn over the black itself.
  stamp(ctx, s.core, corePose.x, corePose.y - 4, 74 * corePose.scaleX, 54 * corePose.scaleY, 0.2 + p.faceEmbedDepth * 0.35);

  // 11. CRISP PRODUCTION FACE (3D Spherical placement, foreshortening, and differential eye scale)
  if (o.showFace) drawFace(ctx, o);
  // Two very light veils across the outer face field: a wide one that ties the
  // whole feature group into the body, and a tighter one that softens the
  // material immediately around the features. Both stay far below the level
  // that would grey the black itself — they only stop the outline reading as
  // a decal laid over the volume.
  if (o.showFace) {
    stamp(ctx, s.mist, corePose.x, corePose.y + 2, 108 * corePose.scaleX, 76 * corePose.scaleY, 0.06 + p.faceEmbedDepth * 0.12);
    stamp(ctx, s.mist, corePose.x, corePose.y + 10, 76 * corePose.scaleX, 50 * corePose.scaleY, 0.04 + p.faceEmbedDepth * 0.08);
  }

  if (o.debug) {
    ctx.strokeStyle = "#f0bb65";
    ctx.fillStyle = "#f0bb65";
    ctx.lineWidth = 0.7;
    for (const def of LOBE_DEFINITIONS) {
      const pose = getLobePose(def);
      ctx.beginPath();
      ctx.ellipse(
        pose.x,
        pose.y,
        pose.rx,
        pose.ry,
        pose.rotation,
        0,
        TAU,
      );
      ctx.stroke();
      ctx.fillRect(pose.x - 1.5, pose.y - 1.5, 3, 3);
    }
    ctx.strokeStyle = "#ed768e";
    ctx.strokeRect(corePose.x - 5, corePose.y - 5, 10, 10);
  }
  ctx.restore();

  if (o.debug) {
    ctx.strokeStyle = "#80d8b5";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, o.safeRadius, 0, TAU);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(size / 2 + p.x, size / 2 + p.y);
    ctx.lineTo(size / 2 + p.x + o.vx * 0.1, size / 2 + p.y + o.vy * 0.1);
    ctx.stroke();
  }
  ctx.restore();

  // The panel crop is re-applied as an antialiased alpha mask. `clip()` alone
  // is a hard 1-bit edge, which left the outermost ring of the round display
  // as a stair-stepped line against the bezel — read as a pale halo.
  ctx.save();
  ctx.globalCompositeOperation = "destination-in";
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2, 0, TAU);
  ctx.fillStyle = "#000";
  ctx.fill();
  ctx.restore();
}

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

  // Front & Mid Volumetric Lobe: Strong directional spherical lighting with terminator form shadow
  const makeMass = (dense: boolean) =>
    sprite((s) => {
      const volume = s.createRadialGradient(
        lx * 0.32,
        ly * 0.32,
        0.04,
        0,
        0,
        1,
      );
      volume.addColorStop(0, "rgba(255,255,255,0.96)");
      volume.addColorStop(0.18, rgba(edge, 1));
      volume.addColorStop(0.48, rgba(body, dense ? 1 : 0.98));
      volume.addColorStop(0.74, rgba(body, dense ? 0.94 : 0.86));
      volume.addColorStop(0.88, rgba(body, 0.45 * c.translucency));
      volume.addColorStop(1, rgba(body, 0));
      s.fillStyle = volume;
      s.fillRect(-1, -1, 2, 2);

      s.globalCompositeOperation = "source-atop";
      // Rich spherical form shadow on the unlit side
      const shade = s.createLinearGradient(lx, ly, -lx, -ly);
      shade.addColorStop(0, "rgba(255,252,242,0.34)");
      shade.addColorStop(0.32, "rgba(255,255,255,0)");
      shade.addColorStop(0.58, rgba(core, p.lightStrength * 0.25));
      shade.addColorStop(0.86, rgba(core, p.lightStrength * 0.65));
      shade.addColorStop(1.0, rgba(core, p.lightStrength * 0.82));
      s.fillStyle = shade;
      s.fillRect(-1, -1, 2, 2);
    });

  // Rear Grounded Masses: Soft atmospheric tone that recedes gracefully behind the core
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
      volume.addColorStop(0, rgba(edge, 0.96));
      volume.addColorStop(0.35, rgba(body, 0.98));
      volume.addColorStop(0.72, rgba(body, 0.88));
      volume.addColorStop(0.9, rgba(core, 0.35 * c.translucency));
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

  // Crevice Ambient Occlusion: Soft darkening between overlapping billows
  const makeCrevice = () =>
    sprite((s) => {
      const g = s.createRadialGradient(0, 0, 0, 0, 0, 1);
      g.addColorStop(0, rgba(core, clamp(p.lightStrength * 0.35, 0.15, 0.45)));
      g.addColorStop(0.45, rgba(core, clamp(p.lightStrength * 0.18, 0.06, 0.25)));
      g.addColorStop(0.8, rgba(core, 0.02));
      g.addColorStop(1, rgba(core, 0));
      s.fillStyle = g;
      s.fillRect(-1, -1, 2, 2);
    }, 64);

  // Top Crest Rim Light: Radiant rim accent catching directional light on crown/shoulders
  const makeCrestRim = () =>
    sprite((s) => {
      const g = s.createRadialGradient(lx * 0.5, ly * 0.5, 0.05, 0, 0, 1);
      g.addColorStop(0, "rgba(255,255,255,0.85)");
      g.addColorStop(0.25, rgba(edge, 0.65));
      g.addColorStop(0.65, rgba(edge, 0.12));
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
      const g = s.createRadialGradient(lx * 0.32, ly * 0.32, 0.04, 0, 0, 1);
      g.addColorStop(0, "rgba(255,255,255,0.85)");
      g.addColorStop(0.2, rgba(edge, 1));
      g.addColorStop(0.5, rgba(body, 0.96));
      g.addColorStop(0.78, rgba(body, 0.56));
      g.addColorStop(1, rgba(body, 0));
      s.fillStyle = g;
      s.fillRect(-1, -1, 2, 2);
      s.globalCompositeOperation = "source-atop";
      const shade = s.createLinearGradient(lx, ly, -lx, -ly);
      shade.addColorStop(0, "rgba(255,252,242,0.22)");
      shade.addColorStop(0.4, "rgba(255,255,255,0)");
      shade.addColorStop(0.75, rgba(core, p.lightStrength * 0.38));
      shade.addColorStop(1.0, rgba(core, p.lightStrength * 0.6));
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

function drawFace(ctx: CanvasRenderingContext2D, o: RenderOptions) {
  const { size, rig, colourName, params: p } = o;
  const core = o.lobeStates.core;
  const face = o.face ?? { offsetX: 0, offsetY: 0, scale: 1 };
  const faceScale = face.scale ?? 1;

  const yaw = rig.blob.yaw ?? 0;
  const pitch = rig.blob.pitch ?? 0;
  const yawRad = (yaw * Math.PI) / 180;
  const pitchRad = (pitch * Math.PI) / 180;
  const yawSin = Math.sin(yawRad);
  const yawCos = Math.cos(yawRad);
  const pitchSin = Math.sin(pitchRad);

  // 3D face travel across the spherical surface of the core
  const faceTurnX = yawSin * 38;
  const faceTurnY = pitchSin * 24 - Math.abs(yawSin) * 6;

  // Horizontal perspective foreshortening of the face
  const faceYawWidth = clamp(0.35 + Math.abs(yawCos) * 0.65, 0.35, 1);
  const facePitchHeight = clamp(0.72 + Math.abs(Math.cos(pitchRad)) * 0.28, 0.72, 1);

  // Smooth profile fade when turning beyond 55 degrees
  const profileAmount = Math.max(0, Math.abs(yawSin) - 0.45);
  const faceVisibility = clamp(1 - profileAmount * 1.5, 0.15, 1);

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
      t = rig[id];
    const isLeft = id === "leftEye";
    // Near vs far eye perspective:
    const isReceding = isLeft ? yawSin < -0.05 : yawSin > 0.05;
    const recedingAmount = Math.abs(yawSin);
    const eyePerspX = isReceding
      ? clamp(1 - recedingAmount * 0.28, 0.72, 1)
      : clamp(1 + recedingAmount * 0.1, 1, 1.12);
    const eyePerspAlpha = isReceding ? clamp(1 - recedingAmount * 0.25, 0.7, 1) : 1;

    const eye = eyeGeometry(a.width * eyePerspX, a.height, t, false);
    eye.centerX += p.gazeX * 4;
    eye.centerY += p.gazeY * 3;
    ctx.save();
    ctx.translate(a.x - size / 2 + t.socketX, a.y - size / 2 + t.socketY);
    ctx.globalAlpha *= t.opacity * eyePerspAlpha;
    // Optional mist accent sits behind canonical black brows, never replaces them.
    if (p.cloudBrows) {
      ctx.save();
      ctx.globalAlpha *= 0.18;
      ctx.fillStyle = "#f1f4ff";
      ctx.beginPath();
      ctx.ellipse(0, -eye.height * 0.74, eye.width * 0.6, 3, 0, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
    ctx.save();
    ctx.globalAlpha *= 0.88;
    drawEyebrow(
      ctx,
      eye,
      t.browLift,
      t.browRotation,
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

  const a = faceAnchor("mouth", size, colourName),
    t = rig.mouth;
  ctx.translate(a.x - size / 2 + t.x, a.y - size / 2 + t.y);
  ctx.globalAlpha *= t.opacity;
  drawMouthShape(
    ctx,
    a.width * 0.95 * clamp(t.scaleX, 0.62, 1.18),
    a.height * 1.08 * clamp(t.scaleY, 0.7, 1.24),
    clamp(t.mouthCurve, -1, 1),
    t.mouthO,
    t.mouthD,
    t.mouthCrescent ?? 0,
    colourName
  );
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

  const yaw = o.rig.blob.yaw ?? 0;
  const pitch = o.rig.blob.pitch ?? 0;
  const yawRad = (yaw * Math.PI) / 180;
  const pitchRad = (pitch * Math.PI) / 180;
  const yawSin = Math.sin(yawRad);
  const yawCos = Math.cos(yawRad);
  const pitchSin = Math.sin(pitchRad);
  const pitchCos = Math.cos(pitchRad);

  // 3D Horizontal body foreshortening
  const bodyYawWidth = clamp(0.38 + Math.abs(yawCos) * 0.62, 0.38, 1);
  const bodyPitchHeight = clamp(0.74 + Math.abs(pitchCos) * 0.26, 0.74, 1);

  ctx.save();
  ctx.translate(size / 2 + p.x, size / 2 + p.y);
  ctx.rotate((p.rotation * Math.PI) / 180);
  ctx.scale(p.scale * p.scaleX * bodyYawWidth, p.scale * p.scaleY * bodyPitchHeight);
  ctx.rotate(o.wallAngle);
  ctx.scale(o.wallScaleX, o.wallScaleY);
  ctx.rotate(-o.wallAngle);
  ctx.globalAlpha = o.rig.blob.opacity;

  // Lobe 3D pose calculator with depth parallax & cohesive pull lag
  const getLobePose = (def: (typeof LOBE_DEFINITIONS)[number]) => {
    const l = lobeStates[def.id] ?? { x: def.baseX, y: def.baseY, scaleX: 1, scaleY: 1, opacity: 1, rotation: 0 };
    const depth = def.depth ?? 0;
    // 3D Parallax offset: front lobes rotate with yaw, rear lobes shift opposite
    const parallaxX = depth * yawSin * 26;
    const parallaxY = depth * pitchSin * 18 - (depth > 0 ? Math.abs(yawSin) * 5 : 0);

    // Whole-body inertial trailing lag (all lobes stay together, NO differential depth tearing)
    const pullLagX = clamp(-o.vx * 0.02, -14, 14);
    const pullLagY = clamp(-o.vy * 0.02, -14, 14);

    const x = l.x + parallaxX + pullLagX;
    const y = l.y + parallaxY + pullLagY;

    // Perspective size modulation based on depth and viewing angle
    const sideFactor = def.baseX > 0 ? 1 : def.baseX < 0 ? -1 : 0;
    const cheekPerspective = sideFactor !== 0 && sideFactor * yawSin < 0
      ? clamp(1 - Math.abs(yawSin) * 0.32, 0.68, 1)
      : clamp(1 + Math.abs(yawSin) * 0.12, 1, 1.15);
    const depthScale = (1.0 + depth * yawCos * 0.06) * cheekPerspective;

    const softness = clamp(p.lobeSoftness, 0.75, 1.3);
    const rx = def.radiusX * l.scaleX * softness * depthScale;
    const ry = def.radiusY * l.scaleY * softness * depthScale;

    return { x, y, rx, ry, opacity: l.opacity, rotation: l.rotation, scaleX: l.scaleX, scaleY: l.scaleY, depth };
  };

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

  // 1. REAR GROUNDED LOBES (depth < 0: bottomBelly, baseLeft, baseRight)
  for (const def of LOBE_DEFINITIONS) {
    if (def.depth >= 0 || def.id === "frontVeil") continue;
    const pose = getLobePose(def);
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
          pose.rotation,
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
      Math.min(1, l.opacity * colour.density * 1.05),
      pose.rotation,
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
      0,
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
  );
  stamp(ctx, s.glow, corePose.x, corePose.y + 12, 80, 70, colour.glowIntensity * 0.16);

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

  // 6. FRONT & MID LOBES (depth > 0: leftCheek, rightCheek, trailingTuft, topCrown)
  for (const def of LOBE_DEFINITIONS) {
    if (def.depth <= 0 || def.id === "frontVeil" || def.id === "core") continue;
    const pose = getLobePose(def);
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
          pose.rotation,
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
      Math.min(1, l.opacity * colour.density * 1.08),
      pose.rotation,
    );
  }

  // 7. TOP CREST RIM LIGHT ACCENT
  if (crownPose) {
    stamp(ctx, s.crestRim, crownPose.x, crownPose.y - crownPose.ry * 0.42, crownPose.rx * 0.95, crownPose.ry * 0.55, 0.8);
  }

  // 8. FOURTEEN INTERNAL LIGHTS / TWINKLING DROPLETS (with 3D depth parallax)
  for (const d of SUSPENDED_DROPLETS) {
    const twinkle = Math.pow(
      Math.max(0, Math.sin(t * d.driftSpeed + d.driftPhase)),
      10,
    );
    if (twinkle < 0.025) continue;
    const dropDepth = d.radius > 1.3 ? 1 : -0.8;
    const dropParallaxX = dropDepth * yawSin * 18;
    const dropParallaxY = dropDepth * pitchSin * 12;
    const x = corePose.x + d.x * 1.65 + dropParallaxX;
    const y = corePose.y + d.y * 1.25 + dropParallaxY;
    stamp(
      ctx,
      s.mist,
      x,
      y,
      d.radius * 4,
      d.radius * 4,
      twinkle * d.brightness * 0.16,
    );
    ctx.save();
    ctx.globalAlpha *= twinkle * d.brightness * 0.65;
    ctx.fillStyle = "#fffbed";
    ctx.beginPath();
    ctx.arc(x, y, d.radius * 0.45, 0, TAU);
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

  // 10. FAINT VEIL BELOW FACE
  stamp(ctx, s.mist, corePose.x, corePose.y + 30, 82, 46, p.faceEmbedDepth * 0.16);

  // 11. CRISP PRODUCTION FACE (3D Spherical placement, foreshortening, and differential eye scale)
  if (o.showFace) drawFace(ctx, o);

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
}

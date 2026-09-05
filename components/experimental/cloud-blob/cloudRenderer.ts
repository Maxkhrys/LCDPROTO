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
  core: HTMLCanvasElement;
  mist: HTMLCanvasElement;
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
  const key = `${c.body}|${c.edge}|${c.coreTint}|${c.innerGlow}|${p.lightAngle}|${p.lightStrength}|${c.translucency}`;
  const old = caches.get(ctx);
  if (old?.key === key) return old;
  const body = parseHexColor(c.body),
    edge = parseHexColor(c.edge),
    core = parseHexColor(c.coreTint);
  const rad = (p.lightAngle * Math.PI) / 180;
  const lx = Math.cos(rad),
    ly = Math.sin(rad);
  const makeMass = (dense: boolean) =>
    sprite((s) => {
      // Broad opaque interior, short feathered perimeter. Light describes one side.
      const volume = s.createRadialGradient(
        lx * 0.26,
        ly * 0.26,
        0.02,
        0,
        0,
        1,
      );
      volume.addColorStop(0, rgba(edge, 1));
      volume.addColorStop(0.48, rgba(body, dense ? 1 : 0.98));
      volume.addColorStop(0.75, rgba(body, dense ? 0.96 : 0.88));
      volume.addColorStop(0.89, rgba(body, 0.5 * c.translucency));
      volume.addColorStop(1, rgba(body, 0));
      s.fillStyle = volume;
      s.fillRect(-1, -1, 2, 2);
      s.globalCompositeOperation = "source-atop";
      const shade = s.createLinearGradient(lx, ly, -lx, -ly);
      shade.addColorStop(0, "rgba(255,248,231,0.18)");
      shade.addColorStop(0.48, "rgba(255,255,255,0)");
      shade.addColorStop(1, rgba(core, p.lightStrength * 0.5));
      s.fillStyle = shade;
      s.fillRect(-1, -1, 2, 2);
    });
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
  const stamps = {
    key,
    mass: makeMass(false),
    core: sprite((s) => {
      const g = s.createRadialGradient(lx * 0.32, ly * 0.32, 0.04, 0, 0, 1);
      g.addColorStop(0, rgba(edge, 1));
      g.addColorStop(0.5, rgba(body, 0.96));
      g.addColorStop(0.78, rgba(body, 0.56));
      g.addColorStop(1, rgba(body, 0));
      s.fillStyle = g;
      s.fillRect(-1, -1, 2, 2);
      s.globalCompositeOperation = "source-atop";
      const shade = s.createLinearGradient(lx, ly, -lx, -ly);
      shade.addColorStop(0, "rgba(255,248,235,0)");
      shade.addColorStop(0.45, "rgba(255,248,235,0)");
      shade.addColorStop(1, rgba(core, p.lightStrength * 0.45));
      s.fillStyle = shade;
      s.fillRect(-1, -1, 2, 2);
    }),
    mist: soft(c.edge, 0.42),
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
  ctx.save();
  ctx.translate(core.x, core.y);
  ctx.rotate(core.rotation * 0.65);
  // Core carries anchors; artwork inherits only part of its expansion.
  ctx.scale(1 + (core.scaleX - 1) * 0.56, 1 + (core.scaleY - 1) * 0.56);
  for (const id of ["leftEye", "rightEye"] as const) {
    const a = faceAnchor(id, size, colourName),
      t = rig[id];
    const eye = eyeGeometry(a.width, a.height, t, false);
    eye.centerX += p.gazeX * 4;
    eye.centerY += p.gazeY * 3;
    ctx.save();
    ctx.translate(a.x - size / 2 + t.socketX, a.y - size / 2 + t.socketY);
    ctx.globalAlpha *= t.opacity;
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
      false,
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
    colourName,
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
    const elongation = w.shape === 2 ? 1 : 1.65;
    stamp(
      ctx,
      s.mist,
      w.x,
      w.y,
      w.radius * elongation,
      w.radius * 0.56,
      w.opacity,
      w.angle,
    );
    if (w.shape === 1)
      stamp(
        ctx,
        s.mist,
        w.x + Math.cos(w.angle + w.curl) * w.radius,
        w.y + Math.sin(w.angle + w.curl) * w.radius,
        w.radius * 0.9,
        w.radius * 0.33,
        w.opacity * 0.6,
        w.angle + w.curl,
      );
  }
  const height = clamp(1 - p.y / 160, 0.45, 1.35);
  stamp(
    ctx,
    s.shadow,
    size / 2 + p.x,
    size / 2 + 130 * p.scale + Math.max(0, p.y) * 0.4,
    95 * p.scale * height,
    13 * p.scale,
    0.2 / height,
  );
  ctx.save();
  ctx.translate(size / 2 + p.x, size / 2 + p.y);
  ctx.rotate((p.rotation * Math.PI) / 180);
  ctx.scale(p.scale * p.scaleX, p.scale * p.scaleY);
  ctx.rotate(o.wallAngle);
  ctx.scale(o.wallScaleX, o.wallScaleY);
  ctx.rotate(-o.wallAngle);
  ctx.globalAlpha = o.rig.blob.opacity;
  // Keep seven major masses. Secondary billows have lower amplitude and phase lag.
  for (const def of LOBE_DEFINITIONS) {
    if (def.id === "frontVeil" || def.id === "core") continue;
    const l = lobeStates[def.id];
    const softness = clamp(p.lobeSoftness, 0.75, 1.3);
    const rx = def.radiusX * l.scaleX * softness,
      ry = def.radiusY * l.scaleY * softness;
    const subs = LOBE_SUB_PUFFS[def.id];
    if (subs && p.fluffiness > 0.05)
      for (const sub of subs) {
        const breathe = Math.sin(t * 1.1 + (sub.phaseOffset ?? 0)) * 0.7;
        stamp(
          ctx,
          s.mass,
          l.x + sub.offsetX * p.fluffiness * l.scaleX,
          l.y + (sub.offsetY * p.fluffiness + breathe) * l.scaleY,
          rx * sub.radiusRatio,
          ry * sub.radiusRatio,
          l.opacity * 0.85,
          l.rotation,
        );
      }
    stamp(
      ctx,
      s.mass,
      l.x,
      l.y,
      rx,
      ry,
      Math.min(1, l.opacity * colour.density * 1.08),
      l.rotation,
    );
  }
  const core = lobeStates.core;
  // Continuous front mass joins the overlapping shoulders without outlining every lobe.
  stamp(
    ctx,
    s.core,
    core.x,
    core.y + 12,
    123 * core.scaleX,
    98 * core.scaleY,
    clamp(p.coreDensity * colour.density, 0, 1),
  );
  stamp(ctx, s.glow, core.x, core.y + 15, 76, 66, colour.glowIntensity * 0.13);
  // Fourteen tiny lights, independently twinkling. Dim intervals create quiet.
  for (const d of SUSPENDED_DROPLETS) {
    const twinkle = Math.pow(
      Math.max(0, Math.sin(t * d.driftSpeed + d.driftPhase)),
      10,
    );
    if (twinkle < 0.025) continue;
    const x = core.x + d.x * 1.65,
      y = core.y + d.y * 1.25;
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
  if (p.cheekBlush > 0) {
    ctx.save();
    ctx.fillStyle = "#e8999f";
    ctx.globalAlpha *= p.cheekBlush * 0.12;
    ctx.beginPath();
    ctx.ellipse(-52, 16, 17, 8, 0, 0, TAU);
    ctx.ellipse(52, 16, 17, 8, 0, 0, TAU);
    ctx.fill();
    ctx.restore();
  }
  // Faint veil below face; never paints opaque lids or obscures black features.
  stamp(ctx, s.mist, core.x, core.y + 30, 82, 46, p.faceEmbedDepth * 0.16);
  if (o.showFace) drawFace(ctx, o);
  if (o.debug) {
    ctx.strokeStyle = "#f0bb65";
    ctx.fillStyle = "#f0bb65";
    ctx.lineWidth = 0.7;
    for (const d of LOBE_DEFINITIONS) {
      const l = lobeStates[d.id];
      ctx.beginPath();
      ctx.ellipse(
        l.x,
        l.y,
        d.radiusX * l.scaleX,
        d.radiusY * l.scaleY,
        l.rotation,
        0,
        TAU,
      );
      ctx.stroke();
      ctx.fillRect(l.x - 1.5, l.y - 1.5, 3, 3);
    }
    ctx.strokeStyle = "#ed768e";
    ctx.strokeRect(core.x - 5, core.y - 5, 10, 10);
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

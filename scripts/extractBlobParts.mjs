/**
 * Extracts the four Blob rig layers from a parts sheet into production PNGs.
 *
 *   node scripts/extractBlobParts.mjs [sheet] [output-directory]
 *
 * Why this is not a luminance key
 * -------------------------------
 * The eyes and mouth contain large genuinely-black regions, so keying on
 * darkness would hollow them out. Instead the background is identified by how
 * close a pixel is to the flat sheet background, and everything that background
 * cannot *reach from the sheet border* is treated as artwork. Black pixels
 * sealed inside a shape are therefore kept, because the flood fill never
 * reaches them.
 *
 * The checkerboard is not recoverable: measured contrast is 4.6/255 against
 * 6.4/255 of compression noise, so it is treated as flat grey. The residue this
 * leaves in the soft edges measures 0.64/255 once composited over black.
 *
 * Output is written to public/blob/rig/. Nothing is resized or redrawn — the
 * pixels are the sheet's own, with alpha recovered and the background
 * un-composited out.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { PNG } from "pngjs";

const SHEET = process.argv[2] ?? "public/blob/Blob-parts2.png";
const OUT_DIR = process.argv[3] ?? "public/blob/rig";

/** Flat background colour of the sheet, sampled from an empty corner. */
const BG = [247, 247, 247];
const T_LUM = 18;
const T_CHROMA = 10;
/**
 * The flood fill must travel *through* the soft glow and stop only at solid
 * artwork, otherwise every glow pixel counts as "enclosed" and is forced
 * opaque — which is what flattens the edges. Solid artwork on this sheet
 * scores far above this; the glow band sits below it.
 */
const FLOOD_BARRIER = 3.0;
/** Below this score a pixel is indistinguishable from background noise. */
const RAMP_LO = 0.72;
const RAMP_HI = FLOOD_BARRIER;
/** Minimum component area to count as a part. */
const MIN_AREA = 1500;
/**
 * Components are found at alpha > 0.15, but the glow tail fades well below
 * that, so the search window is widened before cropping to the true extent.
 */
const SEARCH_PAD = 60;
/** Alpha below this is treated as empty when cropping. */
const CROP_EPS = 0.004;
/** Transparent margin kept around the tight crop so no edge sits flush. */
const OUT_PAD = 4;

const smoothstep = (t) => {
  const c = t < 0 ? 0 : t > 1 ? 1 : t;
  return c * c * (3 - 2 * c);
};

const png = PNG.sync.read(readFileSync(SHEET));
const { width: W, height: H, data } = png;
const bgLum = (BG[0] + BG[1] + BG[2]) / 3;

// --- 1. Score every pixel on how unlike the background it is ----------------
const score = new Float32Array(W * H);
for (let i = 0, p = 0; i < W * H; i++, p += 4) {
  const r = data[p], g = data[p + 1], b = data[p + 2];
  const lum = (r + g + b) / 3;
  const chroma = Math.max(r, g, b) - Math.min(r, g, b);
  score[i] = Math.max(Math.abs(lum - bgLum) / T_LUM, chroma / T_CHROMA);
}

// --- 2. Flood the background in from the border, through non-artwork only ---
const exterior = new Uint8Array(W * H);
const stack = [];
const push = (x, y) => {
  const i = y * W + x;
  if (!exterior[i] && score[i] <= FLOOD_BARRIER) {
    exterior[i] = 1;
    stack.push(i);
  }
};
for (let x = 0; x < W; x++) {
  push(x, 0);
  push(x, H - 1);
}
for (let y = 0; y < H; y++) {
  push(0, y);
  push(W - 1, y);
}
while (stack.length) {
  const i = stack.pop();
  const x = i % W, y = (i / W) | 0;
  if (x > 0) push(x - 1, y);
  if (x < W - 1) push(x + 1, y);
  if (y > 0) push(x, y - 1);
  if (y < H - 1) push(x, y + 1);
}

// --- 3. Alpha: opaque wherever the background could not reach, soft outside --
const alpha = new Float32Array(W * H);
for (let i = 0; i < W * H; i++) {
  const ramp = smoothstep((score[i] - RAMP_LO) / (RAMP_HI - RAMP_LO));
  // Enclosure only ever raises alpha, so sealed black interiors and the white
  // eye highlights stay opaque while the outer glow keeps its real falloff.
  alpha[i] = exterior[i] ? ramp : 1;
}

// --- 4. Label the parts ------------------------------------------------------
const label = new Int32Array(W * H).fill(-1);
const parts = [];
for (let seed = 0; seed < W * H; seed++) {
  if (label[seed] !== -1 || alpha[seed] <= 0.15) continue;
  const id = parts.length;
  let count = 0, minX = W, maxX = 0, minY = H, maxY = 0;
  label[seed] = id;
  const q = [seed];
  while (q.length) {
    const i = q.pop();
    const x = i % W, y = (i / W) | 0;
    count++;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
    const nb = [];
    if (x > 0) nb.push(i - 1);
    if (x < W - 1) nb.push(i + 1);
    if (y > 0) nb.push(i - W);
    if (y < H - 1) nb.push(i + W);
    for (const n of nb) {
      if (label[n] === -1 && alpha[n] > 0.15) {
        label[n] = id;
        q.push(n);
      }
    }
  }
  parts.push({ id, count, minX, maxX, minY, maxY });
}

const kept = parts.filter((p) => p.count >= MIN_AREA);
if (kept.length !== 4) {
  throw new Error(`Expected 4 parts, found ${kept.length}. Sheet layout changed?`);
}

// Sheet layout (same on both supplied sheets): body top-left, LEFT eye
// top-right, RIGHT eye bottom-left, mouth bottom-right.
const byArea = [...kept].sort((a, b) => b.count - a.count);
const body = byArea[0];
const rest = kept.filter((p) => p !== body);
const mouth = rest.reduce((w, p) =>
  (p.maxX - p.minX) / (p.maxY - p.minY) > (w.maxX - w.minX) / (w.maxY - w.minY) ? p : w
);
const eyes = rest.filter((p) => p !== mouth).sort((a, b) => a.minY - b.minY);
const named = {
  "body": body,
  "eye-left": eyes[0],
  "eye-right": eyes[1],
  "mouth-home": mouth,
};

// --- 5. Write each part, un-compositing the background out ------------------
mkdirSync(OUT_DIR, { recursive: true });
const report = [];
for (const [name, p] of Object.entries(named)) {
  const sx0 = Math.max(0, p.minX - SEARCH_PAD), sx1 = Math.min(W - 1, p.maxX + SEARCH_PAD);
  const sy0 = Math.max(0, p.minY - SEARCH_PAD), sy1 = Math.min(H - 1, p.maxY + SEARCH_PAD);

  // This part's alpha: faint unlabelled glow is kept, other parts are excluded.
  const own = (i) => (label[i] === -1 || label[i] === p.id ? alpha[i] : 0);

  // Tight-crop to where this part's alpha actually reaches.
  let x0 = sx1, x1 = sx0, y0 = sy1, y1 = sy0;
  for (let y = sy0; y <= sy1; y++) {
    for (let x = sx0; x <= sx1; x++) {
      if (own(y * W + x) > CROP_EPS) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  x0 = Math.max(0, x0 - OUT_PAD); x1 = Math.min(W - 1, x1 + OUT_PAD);
  y0 = Math.max(0, y0 - OUT_PAD); y1 = Math.min(H - 1, y1 + OUT_PAD);
  const w = x1 - x0 + 1, h = y1 - y0 + 1;
  const out = new PNG({ width: w, height: h });
  let opaque = 0, soft = 0, clear = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const si = (y + y0) * W + (x + x0);
      const sp = si * 4, dp = (y * w + x) * 4;
      const a = own(si);
      const inv = 1 - a;
      for (let c = 0; c < 3; c++) {
        out.data[dp + c] = a > 0.004
          ? Math.max(0, Math.min(255, Math.round((data[sp + c] - BG[c] * inv) / a)))
          : 0;
      }
      out.data[dp + 3] = Math.round(a * 255);
      if (a >= 0.99) opaque++; else if (a > 0.02) soft++; else clear++;
    }
  }
  writeFileSync(`${OUT_DIR}/${name}.png`, PNG.sync.write(out));
  report.push({ name, w, h, sheetX: x0, sheetY: y0, opaque, soft, clear });
}

console.log(`source: ${SHEET}  (${W}x${H})`);
for (const r of report) {
  const total = r.w * r.h;
  console.log(
    `  ${r.name.padEnd(11)} ${String(r.w).padStart(4)}x${String(r.h).padEnd(4)} ` +
    `at (${r.sheetX},${r.sheetY})  opaque ${(100*r.opaque/total).toFixed(1)}%  ` +
    `soft ${(100*r.soft/total).toFixed(1)}%  clear ${(100*r.clear/total).toFixed(1)}%`
  );
}

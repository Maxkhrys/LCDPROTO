/**
 * Extract body-only colour sheets into transparent production PNGs.
 *
 * Usage:
 *   node scripts/extractBlobColourBodies.mjs [sheet] [output-directory]
 *
 * Sheets are 2x2 grids. Background is removed by flood-filling from each
 * cell's edges, so dark jelly interiors stay sealed inside the bright rim.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { PNG } from "pngjs";

const SHEET = process.argv[2] ?? "public/blob/Blob-parts-colours.png";
const OUT_DIR = process.argv[3] ?? "public/blob/rig";

const sourceName = SHEET.split("/").at(-1) ?? "";
const darkBackground = sourceName.includes("ChatGPT Image");
const BG = darkBackground ? [0, 0, 0] : [247, 247, 247];
const BG_LUM = (BG[0] + BG[1] + BG[2]) / 3;
const T_LUM = 18;
const T_CHROMA = 10;
const FLOOD_BARRIER = 3;
const RAMP_LO = 0.72;
const RAMP_HI = FLOOD_BARRIER;
const OUT_PAD = 4;
const CELL_PAD = 24;

const sheets = {
  "Blob-parts-colours.png": [
    ["blue", 0, 0],
    ["red", 1, 0],
  ],
  "ChatGPT Image Sep 3, 2026, 06_52_25 PM.png": [
    ["pink", 1, 0],
    ["orange", 0, 1],
    ["galaxy", 1, 1],
  ],
};

const layout = sheets[sourceName];
if (!layout) throw new Error(`Unknown body sheet: ${sourceName}`);

const png = PNG.sync.read(readFileSync(SHEET));
const { width: W, height: H, data } = png;
if (W % 2 !== 0 || H % 2 !== 0) throw new Error("Body sheet must have even dimensions");

const smoothstep = (t) => {
  const c = t < 0 ? 0 : t > 1 ? 1 : t;
  return c * c * (3 - 2 * c);
};

mkdirSync(OUT_DIR, { recursive: true });
const report = [];
for (const [name, cellX, cellY] of layout) {
  // Leave a guard band around each cell. Some source sheets let adjacent
  // glow halos overlap the nominal quadrant boundary.
  const x0 = cellX * (W / 2) + CELL_PAD;
  const y0 = cellY * (H / 2) + CELL_PAD;
  const w = W / 2 - CELL_PAD * 2;
  const h = H / 2 - CELL_PAD * 2;
  const score = new Float32Array(w * h);
  const exterior = new Uint8Array(w * h);
  const stack = [];
  const push = (x, y) => {
    const i = y * w + x;
    if (!exterior[i] && score[i] <= FLOOD_BARRIER) {
      exterior[i] = 1;
      stack.push(i);
    }
  };

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const p = ((y + y0) * W + x + x0) * 4;
      const r = data[p];
      const g = data[p + 1];
      const b = data[p + 2];
      const lum = (r + g + b) / 3;
      const chroma = Math.max(r, g, b) - Math.min(r, g, b);
      score[y * w + x] = Math.max(
        Math.abs(lum - BG_LUM) / T_LUM,
        chroma / T_CHROMA
      );
    }
  }

  for (let x = 0; x < w; x++) {
    push(x, 0);
    push(x, h - 1);
  }
  for (let y = 0; y < h; y++) {
    push(0, y);
    push(w - 1, y);
  }
  while (stack.length) {
    const i = stack.pop();
    const x = i % w;
    const y = (i / w) | 0;
    if (x > 0) push(x - 1, y);
    if (x < w - 1) push(x + 1, y);
    if (y > 0) push(x, y - 1);
    if (y < h - 1) push(x, y + 1);
  }

  const alphaAt = (i) => {
    const ramp = smoothstep((score[i] - RAMP_LO) / (RAMP_HI - RAMP_LO));
    return exterior[i] ? ramp : 1;
  };

  // Adjacent bodies can touch the edge of a cell through their glow. Keep
  // only the largest connected opaque component so that glow fragments from a
  // neighbouring colour never become part of this rig.
  const labels = new Int32Array(w * h).fill(-1);
  let nextLabel = 0;
  let mainLabel = -1;
  let mainCount = 0;
  for (let seed = 0; seed < w * h; seed++) {
    if (labels[seed] !== -1 || alphaAt(seed) <= 0.15) continue;
    const label = nextLabel++;
    const queue = [seed];
    labels[seed] = label;
    let count = 0;
    while (queue.length) {
      const i = queue.pop();
      count++;
      const x = i % w;
      const y = (i / w) | 0;
      if (x > 0) {
        const n = i - 1;
        if (labels[n] === -1 && alphaAt(n) > 0.15) {
          labels[n] = label;
          queue.push(n);
        }
      }
      if (x < w - 1) {
        const n = i + 1;
        if (labels[n] === -1 && alphaAt(n) > 0.15) {
          labels[n] = label;
          queue.push(n);
        }
      }
      if (y > 0) {
        const n = i - w;
        if (labels[n] === -1 && alphaAt(n) > 0.15) {
          labels[n] = label;
          queue.push(n);
        }
      }
      if (y < h - 1) {
        const n = i + w;
        if (labels[n] === -1 && alphaAt(n) > 0.15) {
          labels[n] = label;
          queue.push(n);
        }
      }
    }
    if (count > mainCount) {
      mainLabel = label;
      mainCount = count;
    }
  }
  const ownAlphaAt = (i) =>
    labels[i] === mainLabel && alphaAt(i) > 0.004 ? alphaAt(i) : 0;

  let cropX0 = w;
  let cropY0 = h;
  let cropX1 = 0;
  let cropY1 = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (ownAlphaAt(y * w + x) > 0.004) {
        cropX0 = Math.min(cropX0, x);
        cropY0 = Math.min(cropY0, y);
        cropX1 = Math.max(cropX1, x);
        cropY1 = Math.max(cropY1, y);
      }
    }
  }
  cropX0 = Math.max(0, cropX0 - OUT_PAD);
  cropY0 = Math.max(0, cropY0 - OUT_PAD);
  cropX1 = Math.min(w - 1, cropX1 + OUT_PAD);
  cropY1 = Math.min(h - 1, cropY1 + OUT_PAD);

  const outW = cropX1 - cropX0 + 1;
  const outH = cropY1 - cropY0 + 1;
  const out = new PNG({ width: outW, height: outH });
  let opaque = 0;
  let soft = 0;
  for (let y = 0; y < outH; y++) {
    for (let x = 0; x < outW; x++) {
      const sourceIndex = (y + cropY0) * w + x + cropX0;
      const sourcePixel = ((y + cropY0 + y0) * W + x + cropX0 + x0) * 4;
      const destinationPixel = (y * outW + x) * 4;
      const alpha = ownAlphaAt(sourceIndex);
      const inverse = 1 - alpha;
      for (let channel = 0; channel < 3; channel++) {
        out.data[destinationPixel + channel] =
          alpha > 0.004
            ? Math.max(
                0,
                Math.min(
                  255,
                  Math.round((data[sourcePixel + channel] - BG[channel] * inverse) / alpha)
                )
              )
            : 0;
      }
      out.data[destinationPixel + 3] = Math.round(alpha * 255);
      if (alpha >= 0.99) opaque++;
      else if (alpha > 0.02) soft++;
    }
  }
  const destination = `${OUT_DIR}/${name}/body.png`;
  mkdirSync(`${OUT_DIR}/${name}`, { recursive: true });
  writeFileSync(destination, PNG.sync.write(out));
  report.push({ name, width: outW, height: outH, opaque, soft });
}

console.log(`source: ${SHEET} (${W}x${H})`);
for (const item of report) {
  console.log(
    `  ${item.name.padEnd(14)} ${String(item.width).padStart(4)}x${String(item.height).padEnd(4)} ` +
      `opaque ${item.opaque} soft ${item.soft}`
  );
}

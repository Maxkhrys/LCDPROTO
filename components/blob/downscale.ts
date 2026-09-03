/**
 * Draws a large source image down to a target size without the softness a
 * single big drawImage step produces.
 *
 * Canvas has no mipmaps: one drawImage that shrinks by more than ~2x samples
 * far too sparsely and throws away detail. Halving repeatedly until we are
 * within one step of the target approximates a proper mip chain and keeps the
 * artwork crisp.
 */
export function drawDownscaled(
  ctx: CanvasRenderingContext2D,
  img: CanvasImageSource,
  sw: number,
  sh: number,
  dx: number,
  dy: number,
  dw: number,
  dh: number
) {
  let cw = sw;
  let ch = sh;
  let current: CanvasImageSource = img;

  // Halve while we are still more than 2x above the target.
  while (cw > dw * 2 && ch > dh * 2) {
    const nw = Math.max(1, Math.round(cw / 2));
    const nh = Math.max(1, Math.round(ch / 2));
    const step = document.createElement("canvas");
    step.width = nw;
    step.height = nh;
    const sctx = step.getContext("2d");
    if (!sctx) break;
    sctx.imageSmoothingEnabled = true;
    sctx.imageSmoothingQuality = "high";
    sctx.drawImage(current, 0, 0, cw, ch, 0, 0, nw, nh);
    current = step;
    cw = nw;
    ch = nh;
  }

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(current, 0, 0, cw, ch, dx, dy, dw, dh);
}

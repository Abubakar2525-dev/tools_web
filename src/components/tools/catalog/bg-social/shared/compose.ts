/** Mask refinement and compositing for the background remover (canvas, no React). */

import { fitRect } from "../lib/geometry";
import { levelsAlpha } from "../lib/misc";
import { drawBlurred } from "./scene";

export type BgMode = "transparent" | "color" | "blur" | "image";

export interface ComposeOptions {
  bg: BgMode;
  color: string;
  /** Background blur strength 1..100 (relative to image size). */
  blur: number;
  bgImage: ImageBitmap | null;
  /** Edge feather in output pixels at full resolution. */
  feather: number;
  /** Edge cleanup 0..100: pushes faint alpha to 0 and near-solid alpha to 255. */
  cleanup: number;
}

export interface Mask {
  alpha: Uint8ClampedArray;
  w: number;
  h: number;
}

function maskCanvas(mask: Mask, cleanup: number) {
  const lo = Math.round(cleanup * 1.2);
  const hi = 255 - Math.round(cleanup * 1.2);
  const a = cleanup > 0 ? levelsAlpha(mask.alpha, lo, hi) : mask.alpha;
  const c = document.createElement("canvas");
  c.width = mask.w;
  c.height = mask.h;
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("Canvas is not available in this browser.");
  const img = ctx.createImageData(mask.w, mask.h);
  for (let i = 0; i < a.length; i++) img.data[i * 4 + 3] = a[i];
  ctx.putImageData(img, 0, 0);
  return c;
}

/**
 * Composites `src` over the chosen background using the (upscaled, smoothed,
 * optionally feathered) mask. `scale` < 1 renders a smaller preview.
 */
export function compose(
  src: HTMLCanvasElement,
  mask: Mask,
  opts: ComposeOptions,
  scale = 1,
): HTMLCanvasElement {
  const W = Math.max(1, Math.round(src.width * scale));
  const H = Math.max(1, Math.round(src.height * scale));
  const mc = maskCanvas(mask, opts.cleanup);

  const cut = document.createElement("canvas");
  cut.width = W;
  cut.height = H;
  const cctx = cut.getContext("2d");
  if (!cctx) throw new Error("Canvas is not available in this browser.");
  cctx.imageSmoothingQuality = "high";
  cctx.drawImage(src, 0, 0, W, H);
  cctx.globalCompositeOperation = "destination-in";
  const feather = opts.feather * scale;
  if (feather > 0.2 && typeof cctx.filter === "string")
    cctx.filter = `blur(${feather}px)`;
  // the mask is upscaled with bilinear smoothing, which also softens its stair-steps
  cctx.drawImage(mc, 0, 0, W, H);
  cctx.filter = "none";
  cctx.globalCompositeOperation = "source-over";
  mc.width = mc.height = 0;

  if (opts.bg === "transparent") return cut;

  const out = document.createElement("canvas");
  out.width = W;
  out.height = H;
  const ctx = out.getContext("2d");
  if (!ctx) throw new Error("Canvas is not available in this browser.");
  ctx.imageSmoothingQuality = "high";
  if (opts.bg === "color") {
    ctx.fillStyle = opts.color;
    ctx.fillRect(0, 0, W, H);
  } else if (opts.bg === "blur") {
    const px = (Math.max(W, H) / 1000) * opts.blur * 0.6;
    drawBlurred(
      ctx,
      src,
      src.width,
      src.height,
      { x: 0, y: 0, w: W, h: H },
      px,
    );
  } else if (opts.bg === "image") {
    ctx.fillStyle = opts.color;
    ctx.fillRect(0, 0, W, H);
    if (opts.bgImage) {
      const r = fitRect(opts.bgImage.width, opts.bgImage.height, W, H, "cover");
      ctx.drawImage(opts.bgImage, r.x, r.y, r.w, r.h);
    }
  }
  ctx.drawImage(cut, 0, 0);
  cut.width = cut.height = 0;
  return out;
}

/**
 * Draws an image onto a canvas without resampling unless it exceeds a safe
 * side or pixel limit. Keeping the source canvas at native resolution lets
 * the low-resolution AI mask be applied without softening the actual photo.
 */
export function toWorkingCanvas(
  bmp: ImageBitmap,
  max: number,
  maxPixels = Number.POSITIVE_INFINITY,
) {
  const sideScale = max / Math.max(bmp.width, bmp.height);
  const areaScale = Math.sqrt(maxPixels / Math.max(1, bmp.width * bmp.height));
  const s = Math.min(1, sideScale, areaScale);
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(bmp.width * s));
  c.height = Math.max(1, Math.round(bmp.height * s));
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("Canvas is not available in this browser.");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bmp, 0, 0, c.width, c.height);
  return { canvas: c, downscaled: s < 1 };
}

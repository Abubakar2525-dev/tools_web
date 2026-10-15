/**
 * Browser image pipeline shared by the image tools: decode (including HEIC via
 * heic2any on demand), draw to canvas with good downscaling, and encode to
 * JPG/PNG/WebP/AVIF (when the browser supports it) or BMP (our own encoder).
 * DOM-only (no React). Pure byte/pixel logic lives in the sibling modules.
 */
import { canEncode, canvasToBlob, loadImage } from "@/components/tools/engines/files";
import { detectImageType } from "./bytes";
import { encodeBmp, parseHex } from "./encoders";
import type { Img } from "./filters";
import { MAX_SIDE } from "./geometry";

export type OutputFormat = "jpeg" | "png" | "webp" | "avif" | "bmp";

export const FORMAT_INFO: Record<OutputFormat, { mime: string; ext: string; label: string; lossy: boolean; alpha: boolean }> = {
  jpeg: { mime: "image/jpeg", ext: "jpg", label: "JPG", lossy: true, alpha: false },
  png: { mime: "image/png", ext: "png", label: "PNG", lossy: false, alpha: true },
  webp: { mime: "image/webp", ext: "webp", label: "WebP", lossy: true, alpha: true },
  avif: { mime: "image/avif", ext: "avif", label: "AVIF", lossy: true, alpha: true },
  bmp: { mime: "image/bmp", ext: "bmp", label: "BMP", lossy: false, alpha: false },
};

export type Encodable = Record<OutputFormat, boolean>;
export const SERVER_ENCODABLE: Encodable = { jpeg: true, png: true, webp: false, avif: false, bmp: true };
let encodableCache: Encodable | null = null;

/** Which formats this browser can write. Cached; safe to call during render on the client. */
export function encodableFormats(): Encodable {
  if (typeof document === "undefined") return SERVER_ENCODABLE;
  if (!encodableCache) encodableCache = { jpeg: true, png: true, bmp: true, webp: canEncode("image/webp"), avif: canEncode("image/avif") };
  return encodableCache;
}

export function formatFromMime(mime: string): OutputFormat | null {
  const m = mime.toLowerCase();
  if (m === "image/jpeg" || m === "image/jpg") return "jpeg";
  if (m === "image/png") return "png";
  if (m === "image/webp") return "webp";
  if (m === "image/avif") return "avif";
  if (m === "image/bmp") return "bmp";
  return null;
}

/* ------------------------------------------------------------------ */
/* Decoding                                                            */
/* ------------------------------------------------------------------ */

export const MAX_PIXELS = 100_000_000;

export async function isHeic(file: Blob & { name?: string }) {
  if (/hei[cf]/i.test(file.type) || /\.(heic|heif)$/i.test(file.name ?? "")) return true;
  const head = new Uint8Array(await file.slice(0, 64).arrayBuffer());
  return detectImageType(head)?.ext === "heic";
}

async function viaImageElement(file: Blob): Promise<ImageBitmap> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    await img.decode();
    const w = img.naturalWidth || 300;
    const h = img.naturalHeight || 150;
    return await createImageBitmap(img, { resizeWidth: w, resizeHeight: h });
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Converts HEIC/HEIF to a PNG blob with heic2any (first image of the file). */
export async function heicToPng(file: Blob): Promise<Blob> {
  const { default: heic2any } = await import("heic2any");
  try {
    const out = await heic2any({ blob: file, toType: "image/png" });
    return Array.isArray(out) ? out[0] : out;
  } catch (e) {
    const msg = (e as { message?: string })?.message ?? "";
    throw new Error(`This HEIC file could not be decoded${msg ? ` (${msg})` : ""}.`);
  }
}

/** Decodes any supported image. HEIC falls back to heic2any; SVG to an <img> element. */
export async function decodeImage(file: Blob & { name?: string }): Promise<ImageBitmap> {
  let bmp: ImageBitmap;
  try {
    bmp = await loadImage(file);
  } catch (first) {
    if (await isHeic(file)) bmp = await loadImage(await heicToPng(file));
    else {
      try {
        bmp = await viaImageElement(file);
      } catch {
        throw first;
      }
    }
  }
  if (bmp.width * bmp.height > MAX_PIXELS) {
    bmp.close();
    throw new Error("This image is larger than 100 megapixels, which is more than a browser canvas can reliably handle.");
  }
  return bmp;
}

/* ------------------------------------------------------------------ */
/* Canvas                                                              */
/* ------------------------------------------------------------------ */

export function makeCanvas(width: number, height: number) {
  const w = Math.max(1, Math.round(width));
  const h = Math.max(1, Math.round(height));
  if (w > MAX_SIDE || h > MAX_SIDE) throw new Error(`The output would be ${w} × ${h} px, beyond the ${MAX_SIDE} px canvas limit.`);
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("Your browser could not create a canvas this large. Try a smaller image.");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  return { canvas: c, ctx };
}

/**
 * Draws `src` scaled to w×h. Large reductions are done in halving steps,
 * which avoids the aliasing a single big downscale produces in some browsers.
 */
export function drawScaled(src: CanvasImageSource & { width: number; height: number }, w: number, h: number, background?: string) {
  let cur: CanvasImageSource = src;
  let cw = src.width;
  let ch = src.height;
  while (cw / 2 >= w && ch / 2 >= h && cw > 2 && ch > 2) {
    const nw = Math.ceil(cw / 2);
    const nh = Math.ceil(ch / 2);
    const { canvas, ctx } = makeCanvas(nw, nh);
    ctx.drawImage(cur, 0, 0, nw, nh);
    cur = canvas;
    cw = nw;
    ch = nh;
  }
  const out = makeCanvas(w, h);
  if (background) {
    out.ctx.fillStyle = background;
    out.ctx.fillRect(0, 0, w, h);
  }
  out.ctx.drawImage(cur, 0, 0, w, h);
  return out.canvas;
}

export function bitmapToCanvas(bmp: ImageBitmap, maxSide?: number) {
  let w = bmp.width;
  let h = bmp.height;
  if (maxSide && Math.max(w, h) > maxSide) {
    const s = maxSide / Math.max(w, h);
    w = Math.max(1, Math.round(w * s));
    h = Math.max(1, Math.round(h * s));
  }
  return drawScaled(bmp, w, h);
}

export function canvasToImg(c: HTMLCanvasElement): Img {
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable.");
  const d = ctx.getImageData(0, 0, c.width, c.height);
  return { width: d.width, height: d.height, data: d.data };
}

export function imgToCanvas(img: Img, target?: HTMLCanvasElement) {
  const c = target ?? document.createElement("canvas");
  c.width = img.width;
  c.height = img.height;
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable.");
  const data = new ImageData(img.width, img.height);
  data.data.set(img.data);
  ctx.putImageData(data, 0, 0);
  return c;
}

export function hasTransparency(c: HTMLCanvasElement) {
  const ctx = c.getContext("2d");
  if (!ctx) return false;
  const d = ctx.getImageData(0, 0, c.width, c.height).data;
  for (let i = 3; i < d.length; i += 4) if (d[i] < 255) return true;
  return false;
}

/* ------------------------------------------------------------------ */
/* Encoding                                                            */
/* ------------------------------------------------------------------ */

export type EncodeOptions = {
  /** 0..1 for lossy formats. */
  quality?: number;
  /** Fill color used where the format has no alpha (JPG, 24-bit BMP). */
  background?: string;
  /** Keep transparency in BMP by writing 32-bit pixels. */
  bmpAlpha?: boolean;
};

/** Encodes a canvas; throws if the browser silently fell back to another format. */
export async function encodeCanvas(c: HTMLCanvasElement, format: OutputFormat, opts: EncodeOptions = {}): Promise<Blob> {
  const info = FORMAT_INFO[format];
  const bg = opts.background ?? "#ffffff";
  if (format === "bmp") {
    const ctx = c.getContext("2d");
    if (!ctx) throw new Error("Canvas unavailable.");
    const d = ctx.getImageData(0, 0, c.width, c.height);
    const bytes = encodeBmp(c.width, c.height, d.data, { alpha: !!opts.bmpAlpha, background: parseHex(bg) ?? undefined });
    return new Blob([bytes as BlobPart], { type: "image/bmp" });
  }
  let source = c;
  if (format === "jpeg") {
    const flat = makeCanvas(c.width, c.height);
    flat.ctx.fillStyle = bg;
    flat.ctx.fillRect(0, 0, c.width, c.height);
    flat.ctx.drawImage(c, 0, 0);
    source = flat.canvas;
  }
  const blob = await canvasToBlob(source, info.mime, info.lossy ? opts.quality ?? 0.9 : undefined);
  if (blob.type !== info.mime) throw new Error(`This browser cannot encode ${info.label}. Choose another format.`);
  return blob;
}

export const fileBytes = async (f: Blob) => new Uint8Array(await f.arrayBuffer());

/** Image types the decoders here accept (for FileDrop `accept`). */
export const IMAGE_ACCEPT = "image/*,.heic,.heif,.avif,.bmp,.gif,.webp,.jpg,.jpeg,.png";

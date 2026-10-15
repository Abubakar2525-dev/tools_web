/**
 * Small binary encoders the browser does not provide: BMP (24-bit or 32-bit
 * with alpha) and ICO (PNG-compressed entries). Pure TypeScript.
 */
import { u16le, u32le, w16le, w32le } from "./bytes";

export type Rgb = { r: number; g: number; b: number };

/** Parses "#rgb" or "#rrggbb" (with or without #). Returns null when invalid. */
export function parseHex(hex: string): Rgb | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = parseInt(h, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

/**
 * Encodes RGBA pixels as a Windows bitmap.
 * - alpha=false: 24-bit BI_RGB; transparent pixels are blended onto `background`.
 * - alpha=true: 32-bit BI_BITFIELDS with a BITMAPV4HEADER so alpha is kept.
 * Rows are stored bottom-up and padded to 4 bytes, as the format requires.
 */
export function encodeBmp(
  width: number,
  height: number,
  rgba: Uint8ClampedArray | Uint8Array,
  opts: { alpha?: boolean; background?: Rgb; dpi?: number } = {},
) {
  const alpha = !!opts.alpha;
  const bg = opts.background ?? { r: 255, g: 255, b: 255 };
  const ppm = Math.round((opts.dpi ?? 72) / 0.0254);
  const bpp = alpha ? 4 : 3;
  const stride = Math.ceil((width * bpp) / 4) * 4;
  const infoSize = alpha ? 108 : 40;
  const offset = 14 + infoSize;
  const imageSize = stride * height;
  const out = new Uint8Array(offset + imageSize);
  out[0] = 0x42;
  out[1] = 0x4d;
  w32le(out, 2, out.length);
  w32le(out, 10, offset);
  w32le(out, 14, infoSize);
  w32le(out, 18, width);
  w32le(out, 22, height);
  w16le(out, 26, 1);
  w16le(out, 28, bpp * 8);
  w32le(out, 30, alpha ? 3 : 0);
  w32le(out, 34, imageSize);
  w32le(out, 38, ppm);
  w32le(out, 42, ppm);
  if (alpha) {
    w32le(out, 54, 0x00ff0000); // red mask
    w32le(out, 58, 0x0000ff00); // green
    w32le(out, 62, 0x000000ff); // blue
    w32le(out, 66, 0xff000000); // alpha
    w32le(out, 70, 0x73524742); // 'sRGB'
  }
  for (let y = 0; y < height; y++) {
    const row = offset + (height - 1 - y) * stride;
    for (let x = 0; x < width; x++) {
      const s = (y * width + x) * 4;
      const d = row + x * bpp;
      const a = rgba[s + 3];
      if (alpha) {
        out[d] = rgba[s + 2];
        out[d + 1] = rgba[s + 1];
        out[d + 2] = rgba[s];
        out[d + 3] = a;
      } else {
        const k = a / 255;
        out[d] = Math.round(rgba[s + 2] * k + bg.b * (1 - k));
        out[d + 1] = Math.round(rgba[s + 1] * k + bg.g * (1 - k));
        out[d + 2] = Math.round(rgba[s] * k + bg.r * (1 - k));
      }
    }
  }
  return out;
}

/** Reads the basic header of a BMP (used by tests). */
export function readBmpHeader(b: Uint8Array) {
  return {
    signature: String.fromCharCode(b[0], b[1]),
    fileSize: u32le(b, 2),
    offset: u32le(b, 10),
    width: u32le(b, 18),
    height: u32le(b, 22),
    bpp: u16le(b, 28),
  };
}

/**
 * Builds an .ico container whose images are PNG files (supported by all
 * current browsers and Windows Vista+). Sizes up to 256 px.
 */
export function encodeIco(entries: { size: number; png: Uint8Array }[]) {
  const sorted = [...entries].sort((a, b) => a.size - b.size);
  const headerSize = 6 + 16 * sorted.length;
  const total = headerSize + sorted.reduce((n, e) => n + e.png.length, 0);
  const out = new Uint8Array(total);
  w16le(out, 0, 0);
  w16le(out, 2, 1); // type 1 = icon
  w16le(out, 4, sorted.length);
  let offset = headerSize;
  sorted.forEach((e, i) => {
    if (e.size < 1 || e.size > 256) throw new Error("ICO entries must be 1 to 256 pixels.");
    const d = 6 + i * 16;
    out[d] = e.size >= 256 ? 0 : e.size; // width (0 means 256)
    out[d + 1] = e.size >= 256 ? 0 : e.size; // height
    out[d + 2] = 0; // palette colors
    out[d + 3] = 0; // reserved
    w16le(out, d + 4, 1); // color planes
    w16le(out, d + 6, 32); // bits per pixel
    w32le(out, d + 8, e.png.length);
    w32le(out, d + 12, offset);
    out.set(e.png, offset);
    offset += e.png.length;
  });
  return out;
}

/** Parses an .ico directory (used by tests and as a sanity check). */
export function readIcoDirectory(b: Uint8Array) {
  const count = u16le(b, 4);
  const items: { width: number; height: number; bpp: number; size: number; offset: number }[] = [];
  for (let i = 0; i < count; i++) {
    const d = 6 + i * 16;
    items.push({ width: b[d] || 256, height: b[d + 1] || 256, bpp: u16le(b, d + 6), size: u32le(b, d + 8), offset: u32le(b, d + 12) });
  }
  return { type: u16le(b, 2), count, items };
}

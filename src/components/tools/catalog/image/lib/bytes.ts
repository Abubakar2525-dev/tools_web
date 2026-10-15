/**
 * Byte-level helpers shared by the image tools: CRC-32, big/little endian
 * access, magic-byte type detection and strict Base64 parsing.
 * Pure TypeScript (no DOM, no React) so it can be unit-tested in Node.
 */

export type Bytes = Uint8Array;

/* ------------------------------------------------------------------ */
/* CRC-32 (PNG / zlib polynomial 0xEDB88320)                           */
/* ------------------------------------------------------------------ */

let crcTable: Uint32Array | null = null;

function table() {
  if (crcTable) return crcTable;
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  crcTable = t;
  return t;
}

export function crc32(bytes: Bytes, start = 0, end = bytes.length) {
  const t = table();
  let c = 0xffffffff;
  for (let i = start; i < end; i++) c = t[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/* ------------------------------------------------------------------ */
/* Endian helpers                                                      */
/* ------------------------------------------------------------------ */

export const u16be = (b: Bytes, o: number) => (b[o] << 8) | b[o + 1];
export const u16le = (b: Bytes, o: number) => b[o] | (b[o + 1] << 8);
export const u32be = (b: Bytes, o: number) => ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0;
export const u32le = (b: Bytes, o: number) => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;

export function w16be(b: Bytes, o: number, v: number) {
  b[o] = (v >>> 8) & 0xff;
  b[o + 1] = v & 0xff;
}
export function w16le(b: Bytes, o: number, v: number) {
  b[o] = v & 0xff;
  b[o + 1] = (v >>> 8) & 0xff;
}
export function w32be(b: Bytes, o: number, v: number) {
  b[o] = (v >>> 24) & 0xff;
  b[o + 1] = (v >>> 16) & 0xff;
  b[o + 2] = (v >>> 8) & 0xff;
  b[o + 3] = v & 0xff;
}
export function w32le(b: Bytes, o: number, v: number) {
  b[o] = v & 0xff;
  b[o + 1] = (v >>> 8) & 0xff;
  b[o + 2] = (v >>> 16) & 0xff;
  b[o + 3] = (v >>> 24) & 0xff;
}

export const ascii = (b: Bytes, o: number, n: number) => {
  let s = "";
  for (let i = 0; i < n && o + i < b.length; i++) s += String.fromCharCode(b[o + i]);
  return s;
};

export function concatBytes(parts: Bytes[]) {
  let n = 0;
  for (const p of parts) n += p.length;
  const out = new Uint8Array(n);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Magic-byte detection                                                */
/* ------------------------------------------------------------------ */

export type DetectedType = { mime: string; ext: string; label: string };

const T = {
  png: { mime: "image/png", ext: "png", label: "PNG" },
  jpg: { mime: "image/jpeg", ext: "jpg", label: "JPEG" },
  gif: { mime: "image/gif", ext: "gif", label: "GIF" },
  webp: { mime: "image/webp", ext: "webp", label: "WebP" },
  bmp: { mime: "image/bmp", ext: "bmp", label: "BMP" },
  ico: { mime: "image/x-icon", ext: "ico", label: "ICO" },
  cur: { mime: "image/x-icon", ext: "cur", label: "Cursor (CUR)" },
  tiff: { mime: "image/tiff", ext: "tif", label: "TIFF" },
  avif: { mime: "image/avif", ext: "avif", label: "AVIF" },
  heic: { mime: "image/heic", ext: "heic", label: "HEIC/HEIF" },
  jxl: { mime: "image/jxl", ext: "jxl", label: "JPEG XL" },
  svg: { mime: "image/svg+xml", ext: "svg", label: "SVG" },
} satisfies Record<string, DetectedType>;

const startsWith = (b: Bytes, sig: number[], at = 0) => sig.every((v, i) => b[at + i] === v);

/** Identifies an image from its first bytes. Returns null when unknown. */
export function detectImageType(b: Bytes): DetectedType | null {
  if (b.length < 4) return null;
  if (startsWith(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return T.png;
  if (startsWith(b, [0xff, 0xd8, 0xff])) return T.jpg;
  if (ascii(b, 0, 6) === "GIF87a" || ascii(b, 0, 6) === "GIF89a") return T.gif;
  if (ascii(b, 0, 4) === "RIFF" && ascii(b, 8, 4) === "WEBP") return T.webp;
  if (startsWith(b, [0x00, 0x00, 0x01, 0x00])) return T.ico;
  if (startsWith(b, [0x00, 0x00, 0x02, 0x00])) return T.cur;
  if (startsWith(b, [0x49, 0x49, 0x2a, 0x00]) || startsWith(b, [0x4d, 0x4d, 0x00, 0x2a])) return T.tiff;
  if (startsWith(b, [0xff, 0x0a]) || startsWith(b, [0, 0, 0, 0x0c, 0x4a, 0x58, 0x4c, 0x20])) return T.jxl;
  if (ascii(b, 4, 4) === "ftyp") {
    const boxSize = u32be(b, 0);
    const end = Math.min(b.length, boxSize >= 16 ? boxSize : 32);
    const brands: string[] = [ascii(b, 8, 4)];
    for (let o = 16; o + 4 <= end; o += 4) brands.push(ascii(b, o, 4));
    if (brands.some((x) => x === "avif" || x === "avis")) return T.avif;
    if (brands.some((x) => ["heic", "heix", "hevc", "hevx", "heim", "heis", "hevm", "hevs", "mif1", "msf1"].includes(x))) return T.heic;
  }
  if (b[0] === 0x42 && b[1] === 0x4d && b.length > 14) return T.bmp;
  // SVG is text: look for an <svg element near the start (after an optional XML prolog/comments).
  const head = new TextDecoder("utf-8", { fatal: false }).decode(b.subarray(0, Math.min(b.length, 2048))).replace(/^﻿/, "").trimStart();
  if (head.startsWith("<") && /<svg[\s>]/i.test(head)) return T.svg;
  return null;
}

export const extForMime = (mime: string) =>
  ({
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/gif": "gif",
    "image/webp": "webp",
    "image/bmp": "bmp",
    "image/x-icon": "ico",
    "image/vnd.microsoft.icon": "ico",
    "image/tiff": "tif",
    "image/avif": "avif",
    "image/heic": "heic",
    "image/heif": "heif",
    "image/jxl": "jxl",
    "image/svg+xml": "svg",
  })[mime.toLowerCase()] ?? "bin";

/* ------------------------------------------------------------------ */
/* Base64                                                              */
/* ------------------------------------------------------------------ */

export type Base64Parse =
  | { ok: true; bytes: Uint8Array; declaredMime: string | null; urlSafe: boolean }
  | { ok: false; error: string };

/**
 * Parses raw Base64 or a `data:` URI. Accepts whitespace/line breaks and the
 * URL-safe alphabet; rejects anything else with a specific message.
 */
export function parseBase64Input(input: string): Base64Parse {
  let s = input.trim();
  if (!s) return { ok: false, error: "Paste a Base64 string or a data URI." };
  let declaredMime: string | null = null;
  if (/^data:/i.test(s)) {
    const comma = s.indexOf(",");
    if (comma < 0) return { ok: false, error: "This data URI has no comma separating the header from the data." };
    const header = s.slice(5, comma);
    const parts = header.split(";").map((p) => p.trim());
    if (!parts.some((p) => p.toLowerCase() === "base64"))
      return { ok: false, error: "This data URI is not Base64-encoded (it has no ;base64 marker)." };
    declaredMime = parts[0] ? parts[0].toLowerCase() : null;
    s = s.slice(comma + 1);
    try {
      // Data URIs copied from CSS/HTML are sometimes percent-encoded.
      if (/%[0-9a-f]{2}/i.test(s)) s = decodeURIComponent(s);
    } catch {
      return { ok: false, error: "The data part contains broken percent-encoding." };
    }
  }
  s = s.replace(/\s+/g, "");
  if (!s) return { ok: false, error: "The Base64 data is empty." };
  const urlSafe = /[-_]/.test(s);
  if (urlSafe && /[+/]/.test(s)) return { ok: false, error: "The string mixes standard (+ /) and URL-safe (- _) Base64 characters." };
  const bad = s.replace(/=+$/, "").search(/[^A-Za-z0-9+/\-_]/);
  if (bad >= 0) {
    const ch = s.replace(/=+$/, "")[bad];
    return { ok: false, error: `Invalid character "${ch === "=" ? "=" : ch}" at position ${bad + 1}. Padding (=) is only allowed at the end.` };
  }
  const pad = (s.match(/=+$/) ?? [""])[0].length;
  if (pad > 2) return { ok: false, error: "Too much padding: Base64 ends with at most two = signs." };
  const body = s.slice(0, s.length - pad);
  if (body.length % 4 === 1) return { ok: false, error: "The length is invalid for Base64; the string looks truncated." };
  if (pad && (body.length + pad) % 4 !== 0) return { ok: false, error: "The padding does not match the length; the string looks truncated." };
  const std = body.replace(/-/g, "+").replace(/_/g, "/");
  const padded = std + "===".slice(0, (4 - (std.length % 4)) % 4);
  let bin: string;
  try {
    bin = atob(padded);
  } catch {
    return { ok: false, error: "This is not valid Base64." };
  }
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return { ok: true, bytes, declaredMime, urlSafe };
}

export function bytesToBase64(bytes: Bytes) {
  let out = "";
  const CH = 0x8000;
  for (let i = 0; i < bytes.length; i += CH) out += String.fromCharCode(...bytes.subarray(i, i + CH));
  return btoa(out);
}

/* ------------------------------------------------------------------ */
/* Misc                                                                */
/* ------------------------------------------------------------------ */

/** Greatest common divisor, for aspect ratios. */
export function gcd(a: number, b: number): number {
  a = Math.abs(Math.round(a));
  b = Math.abs(Math.round(b));
  while (b) [a, b] = [b, a % b];
  return a || 1;
}

/** "1920 × 1080" → "16:9"; uses common names when the reduced ratio is awkward. */
export function aspectLabel(w: number, h: number) {
  const g = gcd(w, h);
  const a = w / g;
  const b = h / g;
  if (a <= 50 && b <= 50) return `${a}:${b}`;
  const r = w / h;
  const common: [number, string][] = [
    [1, "1:1"], [4 / 3, "4:3"], [3 / 2, "3:2"], [16 / 9, "16:9"], [16 / 10, "16:10"], [21 / 9, "21:9"], [5 / 4, "5:4"],
    [3 / 4, "3:4"], [2 / 3, "2:3"], [9 / 16, "9:16"], [10 / 16, "10:16"], [4 / 5, "4:5"],
  ];
  const near = common.find(([v]) => Math.abs(v - r) / v < 0.01);
  return near ? `≈ ${near[1]}` : `${r.toFixed(3)}:1`;
}

/** Strips characters that are invalid in file names on common systems. */
export function safeFileName(name: string, fallback: string) {
  const s = name.replace(/[\u0000-\u001f\u007f<>:"/\\|?*]+/g, "-").replace(/\s+/g, " ").replace(/^[\s.-]+|[\s.]+$/g, "").slice(0, 80);
  return s || fallback;
}

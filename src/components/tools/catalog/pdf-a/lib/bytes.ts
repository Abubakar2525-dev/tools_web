/** Pure byte-level inspection helpers for PDFs and JPEGs. */

function latin1(bytes: Uint8Array, start = 0, end = bytes.length) {
  let s = "";
  const chunk = 0x8000;
  for (let i = start; i < end; i += chunk) s += String.fromCharCode(...bytes.subarray(i, Math.min(end, i + chunk)));
  return s;
}

/** True when the bytes start (within the first KB) with a %PDF- header. */
export function looksLikePdf(bytes: Uint8Array) {
  return /%PDF-/.test(latin1(bytes, 0, Math.min(bytes.length, 1024)));
}

/** Header version, e.g. "1.7", from "%PDF-x.y" in the first 1024 bytes. */
export function pdfHeaderVersion(bytes: Uint8Array): string | null {
  const m = /%PDF-(\d+\.\d+)/.exec(latin1(bytes, 0, Math.min(bytes.length, 1024)));
  return m ? m[1] : null;
}

/**
 * Detects an /Encrypt entry in a trailer or cross-reference stream dictionary.
 * Trailers sit at the end (or, for linearized files, near the start), so only
 * the first 64 KB and last 512 KB are scanned.
 */
export function hasEncryptEntry(bytes: Uint8Array): boolean {
  const re = /\/Encrypt\s*(?:\d+\s+\d+\s+R|<<)/;
  const head = 64 * 1024;
  const tail = 512 * 1024;
  if (bytes.length <= head + tail) return re.test(latin1(bytes));
  return re.test(latin1(bytes, 0, head)) || re.test(latin1(bytes, bytes.length - tail));
}

/** Linearized ("fast web view") files declare /Linearized in the first object. */
export function isLinearized(bytes: Uint8Array): boolean {
  return /\/Linearized\s/.test(latin1(bytes, 0, Math.min(bytes.length, 2048)));
}

/** Counts incremental updates: one %%EOF per saved revision. */
export function countRevisions(bytes: Uint8Array): number {
  return (latin1(bytes).match(/%%EOF/g) ?? []).length;
}

/**
 * Reads the EXIF orientation (1-8) from a JPEG, or 1 when absent.
 * Walks markers to APP1 "Exif", then IFD0 tag 0x0112.
 */
export function jpegOrientation(bytes: Uint8Array): number {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return 1;
  let i = 2;
  while (i + 4 < bytes.length) {
    if (bytes[i] !== 0xff) return 1;
    const marker = bytes[i + 1];
    const len = (bytes[i + 2] << 8) | bytes[i + 3];
    if (marker === 0xda || marker === 0xd9) return 1;
    if (marker === 0xe1 && latin1(bytes, i + 4, i + 10) === "Exif\0\0") {
      const t = i + 10;
      const le = bytes[t] === 0x49;
      const u16 = (o: number) => (le ? bytes[o] | (bytes[o + 1] << 8) : (bytes[o] << 8) | bytes[o + 1]);
      const u32 = (o: number) => (le ? (bytes[o] | (bytes[o + 1] << 8) | (bytes[o + 2] << 16) | (bytes[o + 3] << 24)) >>> 0 : ((bytes[o] << 24) | (bytes[o + 1] << 16) | (bytes[o + 2] << 8) | bytes[o + 3]) >>> 0);
      const ifd = t + u32(t + 4);
      if (ifd + 2 > bytes.length) return 1;
      const n = u16(ifd);
      for (let k = 0; k < n; k++) {
        const e = ifd + 2 + k * 12;
        if (e + 12 > bytes.length) return 1;
        if (u16(e) === 0x0112) {
          const v = u16(e + 8);
          return v >= 1 && v <= 8 ? v : 1;
        }
      }
      return 1;
    }
    i += 2 + len;
  }
  return 1;
}

/** Sniffs common image formats from magic bytes. */
export function sniffImage(bytes: Uint8Array): "jpeg" | "png" | "webp" | "gif" | "bmp" | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return "jpeg";
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "png";
  if (latin1(bytes, 0, 4) === "RIFF" && latin1(bytes, 8, 12) === "WEBP") return "webp";
  if (latin1(bytes, 0, 3) === "GIF") return "gif";
  if (bytes[0] === 0x42 && bytes[1] === 0x4d) return "bmp";
  return null;
}

/**
 * Lossless container surgery for JPEG, PNG and WebP: list segments/chunks,
 * strip metadata, and read/write resolution (DPI) without re-encoding pixels.
 * Pure TypeScript; every function returns a new array and never mutates input.
 */
import { ascii, concatBytes, crc32, u16be, u16le, u32be, u32le, w16be, w16le, w32be, w32le, type Bytes } from "./bytes";

export type Container = "jpeg" | "png" | "webp";

export function containerOf(b: Bytes): Container | null {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "jpeg";
  if (b.length >= 8 && b[0] === 0x89 && ascii(b, 1, 3) === "PNG") return "png";
  if (b.length >= 12 && ascii(b, 0, 4) === "RIFF" && ascii(b, 8, 4) === "WEBP") return "webp";
  return null;
}

/* ------------------------------------------------------------------ */
/* JPEG                                                                */
/* ------------------------------------------------------------------ */

export type JpegSegment = { marker: number; start: number; end: number; dataStart: number };

/**
 * Splits a JPEG into header segments up to the first SOS marker. Everything
 * from SOS on (entropy-coded data, later scans, EOI) is returned as `tail`.
 */
export function parseJpeg(b: Bytes): { segments: JpegSegment[]; tailStart: number } {
  if (containerOf(b) !== "jpeg") throw new Error("Not a JPEG file.");
  const segments: JpegSegment[] = [];
  let i = 2;
  while (i < b.length) {
    if (b[i] !== 0xff) throw new Error("The JPEG structure is damaged (expected a marker).");
    while (b[i] === 0xff && i < b.length) i++; // fill bytes
    const marker = b[i];
    const start = i - 1;
    i++;
    if (marker === 0xd9) return { segments, tailStart: start }; // EOI before any scan
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      segments.push({ marker, start, end: i, dataStart: i });
      continue;
    }
    if (i + 2 > b.length) throw new Error("The JPEG ends unexpectedly.");
    const len = u16be(b, i);
    if (len < 2 || i + len > b.length) throw new Error("A JPEG segment has an invalid length.");
    if (marker === 0xda) return { segments, tailStart: start };
    segments.push({ marker, start, end: i + len, dataStart: i + 2 });
    i += len;
  }
  throw new Error("The JPEG has no image data.");
}

const segAscii = (b: Bytes, s: JpegSegment, n: number) => ascii(b, s.dataStart, Math.min(n, s.end - s.dataStart));

export function describeJpegSegment(b: Bytes, s: JpegSegment) {
  const m = s.marker;
  if (m === 0xe0) return segAscii(b, s, 5) === "JFIF\0" ? "JFIF header (APP0)" : segAscii(b, s, 5) === "JFXX\0" ? "JFIF thumbnail (APP0)" : "APP0";
  if (m === 0xe1) return segAscii(b, s, 6) === "Exif\0\0" ? "Exif (APP1)" : segAscii(b, s, 28).startsWith("http://ns.adobe.com/xap") ? "XMP (APP1)" : "APP1";
  if (m === 0xe2) return segAscii(b, s, 12) === "ICC_PROFILE\0" ? "ICC color profile (APP2)" : "APP2";
  if (m === 0xed) return "Photoshop / IPTC (APP13)";
  if (m === 0xee) return segAscii(b, s, 5) === "Adobe" ? "Adobe color transform (APP14)" : "APP14";
  if (m >= 0xe0 && m <= 0xef) return `APP${m - 0xe0}`;
  if (m === 0xfe) return "Comment (COM)";
  return `Marker 0x${m.toString(16).toUpperCase()}`;
}

/** Minimal APP1 Exif segment holding only an Orientation tag. */
export function exifOrientationSegment(orientation: number) {
  const tiff = new Uint8Array(26);
  tiff.set([0x4d, 0x4d, 0x00, 0x2a], 0);
  w32be(tiff, 4, 8);
  w16be(tiff, 8, 1);
  w16be(tiff, 10, 0x0112);
  w16be(tiff, 12, 3);
  w32be(tiff, 14, 1);
  w16be(tiff, 18, orientation);
  w32be(tiff, 22, 0);
  const data = concatBytes([new Uint8Array([0x45, 0x78, 0x69, 0x66, 0, 0]), tiff]);
  const seg = new Uint8Array(4 + data.length);
  seg[0] = 0xff;
  seg[1] = 0xe1;
  w16be(seg, 2, data.length + 2);
  seg.set(data, 4);
  return seg;
}

/* --- Minimal TIFF/Exif IFD0 reader ---------------------------------- */

type IfdEntry = { tag: number; type: number; count: number; valueAt: number };
const TYPE_SIZE: Record<number, number> = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 6: 1, 7: 1, 8: 2, 9: 4, 10: 8, 11: 4, 12: 8 };

/** Reads IFD0 of a TIFF block (`t` starts at the byte-order mark). */
export function readIfd0(t: Bytes) {
  const tag = ascii(t, 0, 2);
  if (tag !== "II" && tag !== "MM") return null;
  const le = tag === "II";
  const r16 = (o: number) => (le ? u16le(t, o) : u16be(t, o));
  const r32 = (o: number) => (le ? u32le(t, o) : u32be(t, o));
  if (r16(2) !== 42) return null;
  const ifd = r32(4);
  if (ifd + 2 > t.length) return null;
  const n = r16(ifd);
  const entries = new Map<number, IfdEntry>();
  for (let k = 0; k < n; k++) {
    const e = ifd + 2 + k * 12;
    if (e + 12 > t.length) break;
    const type = r16(e + 2);
    const count = r32(e + 4);
    const size = (TYPE_SIZE[type] ?? 1) * count;
    const valueAt = size <= 4 ? e + 8 : r32(e + 8);
    entries.set(r16(e), { tag: r16(e), type, count, valueAt });
  }
  const short = (id: number) => {
    const en = entries.get(id);
    return en && en.type === 3 && en.valueAt + 2 <= t.length ? r16(en.valueAt) : null;
  };
  const rational = (id: number) => {
    const en = entries.get(id);
    if (!en || en.type !== 5 || en.valueAt + 8 > t.length) return null;
    const d = r32(en.valueAt + 4);
    return d ? r32(en.valueAt) / d : null;
  };
  return { le, entries, short, rational };
}

function exifTiffOffset(b: Bytes, segs: JpegSegment[]) {
  const s = segs.find((x) => x.marker === 0xe1 && segAscii(b, x, 6) === "Exif\0\0");
  return s ? { seg: s, tiff: s.dataStart + 6 } : null;
}

export function jpegOrientation(b: Bytes): number | null {
  const { segments } = parseJpeg(b);
  const ex = exifTiffOffset(b, segments);
  if (!ex) return null;
  const ifd = readIfd0(b.subarray(ex.tiff, ex.seg.end));
  return ifd?.short(0x0112) ?? null;
}

export type StripReport = { output: Uint8Array<ArrayBuffer>; removed: string[]; kept: string[] };

/**
 * Removes APP1-APP15 and COM segments from a JPEG. Keeps the JFIF APP0 header,
 * the ICC profile (optional) and the Adobe APP14 marker (it is a decoding
 * parameter for CMYK files, not personal data). Optionally re-adds a minimal
 * Exif block holding only the Orientation tag so photos keep displaying upright.
 */
export function stripJpeg(b: Bytes, opts: { keepIcc?: boolean; keepOrientation?: boolean } = {}): StripReport {
  const { segments, tailStart } = parseJpeg(b);
  const orientation = opts.keepOrientation ? jpegOrientation(b) : null;
  const parts: Bytes[] = [b.subarray(0, 2)];
  const removed: string[] = [];
  const kept: string[] = [];
  let insertedOrientation = false;
  const addOrientation = () => {
    if (!insertedOrientation && orientation && orientation >= 2 && orientation <= 8) {
      parts.push(exifOrientationSegment(orientation));
      kept.push(`Orientation tag only (value ${orientation})`);
    }
    insertedOrientation = true;
  };
  segments.forEach((s, idx) => {
    const m = s.marker;
    const name = describeJpegSegment(b, s);
    const isJfif = m === 0xe0 && segAscii(b, s, 5) === "JFIF\0";
    const isIcc = m === 0xe2 && segAscii(b, s, 12) === "ICC_PROFILE\0";
    const isAdobe = m === 0xee && segAscii(b, s, 5) === "Adobe";
    const isApp = m >= 0xe0 && m <= 0xef;
    let keep = true;
    if (m === 0xfe) keep = false;
    else if (isApp) keep = isJfif || isAdobe || (isIcc && !!opts.keepIcc);
    if (idx === 0 && !isJfif) addOrientation();
    if (keep) {
      parts.push(b.subarray(s.start, s.end));
      if (isApp && !kept.includes(name)) kept.push(name);
      if (isJfif) addOrientation();
    } else removed.push(`${name}, ${s.end - s.start} bytes`);
  });
  addOrientation();
  parts.push(b.subarray(tailStart));
  return { output: concatBytes(parts), removed, kept };
}

/* ------------------------------------------------------------------ */
/* PNG                                                                 */
/* ------------------------------------------------------------------ */

export type PngChunk = { type: string; start: number; end: number; dataStart: number; length: number };

export function parsePng(b: Bytes): PngChunk[] {
  if (containerOf(b) !== "png") throw new Error("Not a PNG file.");
  const chunks: PngChunk[] = [];
  let i = 8;
  while (i + 12 <= b.length) {
    const length = u32be(b, i);
    const type = ascii(b, i + 4, 4);
    const end = i + 12 + length;
    if (end > b.length) throw new Error("A PNG chunk runs past the end of the file.");
    chunks.push({ type, start: i, end, dataStart: i + 8, length });
    i = end;
    if (type === "IEND") break;
  }
  if (!chunks.length || chunks[0].type !== "IHDR") throw new Error("The PNG has no IHDR header.");
  if (!chunks.some((c) => c.type === "IEND")) throw new Error("The PNG is truncated (no IEND chunk).");
  return chunks;
}

const PNG_META = new Set(["tEXt", "iTXt", "zTXt", "eXIf", "tIME"]);

export function stripPng(b: Bytes): StripReport {
  const chunks = parsePng(b);
  const parts: Bytes[] = [b.subarray(0, 8)];
  const removed: string[] = [];
  const kept: string[] = [];
  for (const c of chunks) {
    if (PNG_META.has(c.type)) {
      let label = c.type;
      if (c.type === "tEXt" || c.type === "zTXt" || c.type === "iTXt") {
        let k = "";
        for (let j = c.dataStart; j < c.dataStart + Math.min(c.length, 79) && b[j] !== 0; j++) k += String.fromCharCode(b[j]);
        if (k) label += ` "${k}"`;
      }
      removed.push(`${label}, ${c.length} bytes`);
    } else {
      parts.push(b.subarray(c.start, c.end));
      if (!kept.includes(c.type)) kept.push(c.type);
    }
  }
  return { output: concatBytes(parts), removed, kept };
}

export function pngChunk(type: string, data: Bytes) {
  const out = new Uint8Array(12 + data.length);
  w32be(out, 0, data.length);
  for (let k = 0; k < 4; k++) out[4 + k] = type.charCodeAt(k);
  out.set(data, 8);
  w32be(out, 8 + data.length, crc32(out, 4, 8 + data.length));
  return out;
}

/* ------------------------------------------------------------------ */
/* WebP                                                                */
/* ------------------------------------------------------------------ */

export type RiffChunk = { fourcc: string; start: number; end: number; dataStart: number; size: number };

export function parseWebp(b: Bytes): RiffChunk[] {
  if (containerOf(b) !== "webp") throw new Error("Not a WebP file.");
  const chunks: RiffChunk[] = [];
  const limit = Math.min(b.length, u32le(b, 4) + 8);
  let i = 12;
  while (i + 8 <= limit) {
    const fourcc = ascii(b, i, 4);
    const size = u32le(b, i + 4);
    const end = i + 8 + size + (size & 1);
    if (i + 8 + size > b.length) throw new Error("A WebP chunk runs past the end of the file.");
    chunks.push({ fourcc, start: i, end: Math.min(end, b.length), dataStart: i + 8, size });
    i = end;
  }
  if (!chunks.length) throw new Error("The WebP file has no chunks.");
  return chunks;
}

export function stripWebp(b: Bytes): StripReport {
  const chunks = parseWebp(b);
  const parts: Bytes[] = [];
  const removed: string[] = [];
  const kept: string[] = [];
  for (const c of chunks) {
    if (c.fourcc === "EXIF" || c.fourcc === "XMP ") {
      removed.push(`${c.fourcc.trim()}, ${c.size} bytes`);
      continue;
    }
    let piece: Bytes = b.subarray(c.start, c.end);
    if (c.fourcc === "VP8X") {
      const copy = piece.slice();
      copy[8] &= ~(0x08 | 0x04); // clear EXIF and XMP flags
      piece = copy;
    }
    parts.push(piece);
    kept.push(c.fourcc.trim());
  }
  const body = concatBytes(parts);
  const out = new Uint8Array(12 + body.length);
  out.set(b.subarray(0, 12), 0);
  w32le(out, 4, 4 + body.length);
  out.set(body, 12);
  return { output: out, removed, kept };
}

/** Strips metadata from any supported container. */
export function stripMetadata(b: Bytes, opts: { keepIcc?: boolean; keepOrientation?: boolean } = {}): StripReport & { container: Container } {
  const c = containerOf(b);
  if (c === "jpeg") return { ...stripJpeg(b, opts), container: c };
  if (c === "png") return { ...stripPng(b), container: c };
  if (c === "webp") return { ...stripWebp(b), container: c };
  throw new Error("Metadata removal supports JPEG, PNG and WebP files.");
}

/* ------------------------------------------------------------------ */
/* Resolution (DPI)                                                    */
/* ------------------------------------------------------------------ */

export type Density = { source: string; x: number; y: number; unit: "dpi" | "aspect" };

/** Reads every resolution record found in the file (there can be several). */
export function readDensity(b: Bytes): Density[] {
  const c = containerOf(b);
  const out: Density[] = [];
  if (c === "jpeg") {
    const { segments } = parseJpeg(b);
    const jfif = segments.find((s) => s.marker === 0xe0 && segAscii(b, s, 5) === "JFIF\0" && s.end - s.dataStart >= 12);
    if (jfif) {
      const units = b[jfif.dataStart + 7];
      const x = u16be(b, jfif.dataStart + 8);
      const y = u16be(b, jfif.dataStart + 10);
      if (units === 1) out.push({ source: "JFIF header", x, y, unit: "dpi" });
      else if (units === 2) out.push({ source: "JFIF header (dots per cm)", x: x * 2.54, y: y * 2.54, unit: "dpi" });
      else out.push({ source: "JFIF header (no unit, pixel aspect only)", x, y, unit: "aspect" });
    }
    const ex = exifTiffOffset(b, segments);
    if (ex) {
      const ifd = readIfd0(b.subarray(ex.tiff, ex.seg.end));
      const x = ifd?.rational(0x011a);
      const y = ifd?.rational(0x011b);
      if (ifd && x && y) {
        const unit = ifd.short(0x0128) ?? 2;
        if (unit === 3) out.push({ source: "Exif (per cm)", x: x * 2.54, y: y * 2.54, unit: "dpi" });
        else if (unit === 2) out.push({ source: "Exif", x, y, unit: "dpi" });
        else out.push({ source: "Exif (no unit)", x, y, unit: "aspect" });
      }
    }
  } else if (c === "png") {
    const p = parsePng(b).find((ch) => ch.type === "pHYs" && ch.length === 9);
    if (p) {
      const x = u32be(b, p.dataStart);
      const y = u32be(b, p.dataStart + 4);
      if (b[p.dataStart + 8] === 1) out.push({ source: "PNG pHYs chunk", x: x * 0.0254, y: y * 0.0254, unit: "dpi" });
      else out.push({ source: "PNG pHYs chunk (no unit, aspect only)", x, y, unit: "aspect" });
    }
  }
  return out;
}

function jfifSegment(dpiX: number, dpiY: number) {
  const s = new Uint8Array(18);
  s.set([0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x01]);
  w16be(s, 12, dpiX);
  w16be(s, 14, dpiY);
  return s;
}

/**
 * Sets the resolution of a JPEG or PNG without touching the pixel data.
 * JPEG: rewrites (or inserts) the JFIF APP0 density and updates existing Exif
 * X/YResolution values in place. PNG: replaces (or inserts) the pHYs chunk.
 */
export function writeDensity(b: Bytes, dpiX: number, dpiY = dpiX): Uint8Array<ArrayBuffer> {
  const c = containerOf(b);
  if (!(dpiX > 0 && dpiY > 0)) throw new Error("DPI must be greater than zero.");
  if (c === "jpeg") {
    const ix = Math.round(dpiX);
    const iy = Math.round(dpiY);
    if (ix > 65535 || iy > 65535) throw new Error("JPEG density is limited to 65535 DPI.");
    const { segments } = parseJpeg(b);
    const out = b.slice();
    const ex = exifTiffOffset(out, segments);
    if (ex) {
      const ifd = readIfd0(out.subarray(ex.tiff, ex.seg.end));
      if (ifd) {
        const put32 = (o: number, v: number) => (ifd.le ? w32le(out, ex.tiff + o, v) : w32be(out, ex.tiff + o, v));
        const put16 = (o: number, v: number) => (ifd.le ? w16le(out, ex.tiff + o, v) : w16be(out, ex.tiff + o, v));
        const xr = ifd.entries.get(0x011a);
        const yr = ifd.entries.get(0x011b);
        const ru = ifd.entries.get(0x0128);
        const len = ex.seg.end - ex.tiff;
        if (xr && xr.type === 5 && xr.valueAt + 8 <= len) {
          put32(xr.valueAt, ix);
          put32(xr.valueAt + 4, 1);
        }
        if (yr && yr.type === 5 && yr.valueAt + 8 <= len) {
          put32(yr.valueAt, iy);
          put32(yr.valueAt + 4, 1);
        }
        if (ru && ru.type === 3 && (xr || yr)) put16(ru.valueAt, 2);
      }
    }
    const jfif = segments.find((s) => s.marker === 0xe0 && segAscii(out, s, 5) === "JFIF\0" && s.end - s.dataStart >= 12);
    if (jfif) {
      out[jfif.dataStart + 7] = 1;
      w16be(out, jfif.dataStart + 8, ix);
      w16be(out, jfif.dataStart + 10, iy);
      return out;
    }
    return concatBytes([out.subarray(0, 2), jfifSegment(ix, iy), out.subarray(2)]);
  }
  if (c === "png") {
    const chunks = parsePng(b);
    const data = new Uint8Array(9);
    w32be(data, 0, Math.round(dpiX / 0.0254));
    w32be(data, 4, Math.round(dpiY / 0.0254));
    data[8] = 1;
    const phys = pngChunk("pHYs", data);
    const existing = chunks.find((ch) => ch.type === "pHYs");
    if (existing) return concatBytes([b.subarray(0, existing.start), phys, b.subarray(existing.end)]);
    const ihdr = chunks[0];
    return concatBytes([b.subarray(0, ihdr.end), phys, b.subarray(ihdr.end)]);
  }
  throw new Error("DPI can be written to JPEG and PNG files only.");
}

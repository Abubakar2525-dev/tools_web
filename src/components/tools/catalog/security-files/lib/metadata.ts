/**
 * Metadata inspection and lossless removal by rewriting container structure.
 * Image pixels and audio frames are copied byte for byte, never re-encoded.
 *
 * JPEG: APPn/COM segments (JPEG ITU-T T.81 + JFIF/Exif). PNG: ancillary text,
 * time and Exif chunks (PNG spec, 3rd ed.). WebP: RIFF EXIF/XMP chunks.
 * MP3: ID3v2 (start), ID3v1 / Enhanced TAG and APEv2 (end).
 * Office (DOCX/XLSX/PPTX): docProps/core.xml, app.xml, custom.xml.
 */

export interface MetaItem {
  label: string;
  value: string;
}

export interface MetaReport {
  format: string;
  /** Human-readable list of metadata blocks found. */
  blocks: { name: string; bytes: number; removable: boolean; detail?: string }[];
  fields: MetaItem[];
}

const latin1 = (b: Uint8Array) => {
  let s = "";
  for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
  return s;
};
const utf8 = (b: Uint8Array) => new TextDecoder().decode(b);
const asciiAt = (b: Uint8Array, off: number, s: string) => {
  if (off + s.length > b.length) return false;
  for (let i = 0; i < s.length; i++) if (b[off + i] !== s.charCodeAt(i)) return false;
  return true;
};

function concat(parts: Uint8Array[]) {
  const len = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(len);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

export type MetaFormat = "jpeg" | "png" | "webp" | "mp3" | "pdf" | "ooxml" | null;

export function sniffMetaFormat(b: Uint8Array, name: string): MetaFormat {
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "jpeg";
  if (asciiAt(b, 0, "\x89PNG\r\n\x1a\n")) return "png";
  if (asciiAt(b, 0, "RIFF") && asciiAt(b, 8, "WEBP")) return "webp";
  if (asciiAt(b, 0, "%PDF-")) return "pdf";
  if (asciiAt(b, 0, "PK\x03\x04") && /\.(docx|xlsx|pptx|docm|xlsm|pptm)$/i.test(name)) return "ooxml";
  if (asciiAt(b, 0, "ID3") || (b[0] === 0xff && (b[1] & 0xe0) === 0xe0) || /\.mp3$/i.test(name)) return "mp3";
  return null;
}

/* ------------------------------------------------------------------ */
/* JPEG                                                                */
/* ------------------------------------------------------------------ */

interface JpegSegment {
  marker: number;
  start: number; // offset of 0xFF
  end: number; // exclusive
  label: string;
}

function jpegLabel(marker: number, data: Uint8Array): string {
  if (marker === 0xe0) return asciiAt(data, 0, "JFIF") ? "JFIF header" : asciiAt(data, 0, "JFXX") ? "JFIF thumbnail" : "APP0";
  if (marker === 0xe1) {
    if (asciiAt(data, 0, "Exif\0")) return "Exif";
    if (asciiAt(data, 0, "http://ns.adobe.com/xap/1.0/")) return "XMP";
    if (asciiAt(data, 0, "http://ns.adobe.com/xmp/extension/")) return "Extended XMP";
    return "APP1";
  }
  if (marker === 0xe2) return asciiAt(data, 0, "ICC_PROFILE") ? "ICC color profile" : asciiAt(data, 0, "MPF") ? "Multi-picture index" : "APP2";
  if (marker === 0xed) return "Photoshop / IPTC";
  if (marker === 0xee) return "Adobe color transform";
  if (marker === 0xec) return "Ducky (picture info)";
  if (marker === 0xfe) return "Comment";
  if (marker >= 0xe0 && marker <= 0xef) return `APP${marker - 0xe0}`;
  return `Marker 0x${marker.toString(16).toUpperCase()}`;
}

/** Walks a JPEG. Returns segments and the offset right after EOI. */
export function parseJpeg(b: Uint8Array): { segments: JpegSegment[]; eoi: number } {
  if (!(b[0] === 0xff && b[1] === 0xd8)) throw new Error("Not a JPEG file.");
  const segments: JpegSegment[] = [];
  let off = 2;
  while (off < b.length) {
    if (b[off] !== 0xff) throw new Error(`Corrupt JPEG: expected a marker at byte ${off}.`);
    while (b[off] === 0xff && off < b.length) off++;
    const marker = b[off];
    const start = off - 1;
    off++;
    if (marker === 0xd9) return { segments, eoi: off };
    if ((marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) continue;
    if (off + 2 > b.length) break;
    const len = (b[off] << 8) | b[off + 1];
    const dataStart = off + 2;
    let end = off + len;
    if (end > b.length) throw new Error("Corrupt JPEG: a segment runs past the end of the file.");
    segments.push({ marker, start, end, label: jpegLabel(marker, b.subarray(dataStart, Math.min(end, dataStart + 40))) });
    if (marker === 0xda) {
      // Entropy-coded data: scan to the next real marker.
      let p = end;
      while (p + 1 < b.length) {
        if (b[p] === 0xff && b[p + 1] !== 0x00 && !(b[p + 1] >= 0xd0 && b[p + 1] <= 0xd7) && b[p + 1] !== 0xff) break;
        p++;
      }
      end = p;
      segments[segments.length - 1].end = end;
    }
    off = end;
  }
  return { segments, eoi: b.length };
}

/** Reads the Exif Orientation tag (0x0112) from an Exif APP1 payload, if present. */
export function exifOrientation(app1: Uint8Array): number | null {
  // app1 starts with "Exif\0\0"
  const t = app1.subarray(6);
  if (t.length < 8) return null;
  const le = t[0] === 0x49;
  const dv = new DataView(t.buffer, t.byteOffset, t.byteLength);
  const u16 = (o: number) => dv.getUint16(o, le);
  const u32 = (o: number) => dv.getUint32(o, le);
  const ifd = u32(4);
  if (ifd + 2 > t.length) return null;
  const n = u16(ifd);
  for (let i = 0; i < n; i++) {
    const e = ifd + 2 + i * 12;
    if (e + 12 > t.length) return null;
    if (u16(e) === 0x0112) return u16(e + 8);
  }
  return null;
}

/** A minimal Exif block that holds only the Orientation tag. */
export function minimalExif(orientation: number): Uint8Array {
  const payload = [
    ..."Exif\0\0".split("").map((c) => c.charCodeAt(0)),
    0x49, 0x49, 0x2a, 0x00, 0x08, 0x00, 0x00, 0x00, // TIFF header, IFD0 at 8
    0x01, 0x00, // one entry
    0x12, 0x01, 0x03, 0x00, 0x01, 0x00, 0x00, 0x00, orientation & 0xff, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, // no next IFD
  ];
  const len = payload.length + 2;
  return new Uint8Array([0xff, 0xe1, len >> 8, len & 0xff, ...payload]);
}

const JPEG_KEEP_ALWAYS = new Set(["JFIF header", "Adobe color transform"]);

export function inspectJpeg(b: Uint8Array): MetaReport {
  const { segments, eoi } = parseJpeg(b);
  const blocks: MetaReport["blocks"] = segments
    .filter((s) => (s.marker >= 0xe0 && s.marker <= 0xef) || s.marker === 0xfe)
    .map((s) => ({
      name: s.label,
      bytes: s.end - s.start,
      removable: !JPEG_KEEP_ALWAYS.has(s.label),
      detail: s.label === "Comment" ? latin1(b.subarray(s.start + 4, Math.min(s.end, s.start + 204))) : undefined,
    }));
  if (eoi < b.length) blocks.push({ name: "Data after end of image", bytes: b.length - eoi, removable: true, detail: "Often an embedded preview or a second image." });
  return { format: "JPEG image", blocks, fields: [] };
}

export function stripJpeg(b: Uint8Array, opts: { keepIcc: boolean; keepOrientation: boolean }): Uint8Array {
  const { segments } = parseJpeg(b);
  const parts: Uint8Array[] = [b.subarray(0, 2)];
  let orientation: number | null = null;
  for (const s of segments) {
    if (s.label === "Exif" && orientation === null) orientation = exifOrientation(b.subarray(s.start + 4, s.end));
  }
  let insertedOrientation = false;
  for (const s of segments) {
    const isApp = (s.marker >= 0xe0 && s.marker <= 0xef) || s.marker === 0xfe;
    let keep = !isApp || JPEG_KEEP_ALWAYS.has(s.label) || (opts.keepIcc && s.label === "ICC color profile");
    if (keep && s.label === "JFIF thumbnail") keep = false;
    if (!keep) continue;
    // Put the orientation-only Exif right after JFIF (or first) when needed.
    if (!insertedOrientation && opts.keepOrientation && orientation && orientation !== 1 && s.label !== "JFIF header") {
      parts.push(minimalExif(orientation));
      insertedOrientation = true;
    }
    parts.push(b.subarray(s.start, s.end));
  }
  parts.push(new Uint8Array([0xff, 0xd9]));
  return concat(parts);
}

/* ------------------------------------------------------------------ */
/* PNG                                                                 */
/* ------------------------------------------------------------------ */

const PNG_META = new Set(["tEXt", "zTXt", "iTXt", "eXIf", "tIME"]);

interface PngChunk {
  type: string;
  start: number;
  end: number;
  data: Uint8Array;
}

export function parsePng(b: Uint8Array): PngChunk[] {
  if (!asciiAt(b, 0, "\x89PNG\r\n\x1a\n")) throw new Error("Not a PNG file.");
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const chunks: PngChunk[] = [];
  let off = 8;
  while (off + 12 <= b.length) {
    const len = dv.getUint32(off, false);
    const type = latin1(b.subarray(off + 4, off + 8));
    const end = off + 12 + len;
    if (end > b.length) throw new Error("Corrupt PNG: a chunk runs past the end of the file.");
    chunks.push({ type, start: off, end, data: b.subarray(off + 8, off + 8 + len) });
    off = end;
    if (type === "IEND") break;
  }
  return chunks;
}

export function pngText(c: PngChunk, inflate?: (d: Uint8Array) => Uint8Array): MetaItem | null {
  const z = c.data.indexOf(0);
  if (z < 0) return null;
  const key = latin1(c.data.subarray(0, z));
  try {
    if (c.type === "tEXt") return { label: key, value: latin1(c.data.subarray(z + 1)) };
    if (c.type === "zTXt") return { label: key, value: inflate ? latin1(inflate(c.data.subarray(z + 2))) : "(compressed)" };
    if (c.type === "iTXt") {
      const compressed = c.data[z + 1] === 1;
      let p = z + 3;
      const langEnd = c.data.indexOf(0, p);
      p = langEnd + 1;
      const transEnd = c.data.indexOf(0, p);
      const text = c.data.subarray(transEnd + 1);
      return { label: key, value: compressed ? (inflate ? utf8(inflate(text)) : "(compressed)") : utf8(text) };
    }
  } catch {
    return { label: key, value: "(could not decode)" };
  }
  return null;
}

export function inspectPng(b: Uint8Array, inflate?: (d: Uint8Array) => Uint8Array): MetaReport {
  const chunks = parsePng(b);
  const blocks: MetaReport["blocks"] = [];
  const fields: MetaItem[] = [];
  for (const c of chunks) {
    if (PNG_META.has(c.type) || c.type === "iCCP") {
      blocks.push({ name: c.type === "iCCP" ? "iCCP (color profile)" : c.type, bytes: c.end - c.start, removable: true });
      if (c.type === "tEXt" || c.type === "zTXt" || c.type === "iTXt") {
        const t = pngText(c, inflate);
        if (t) fields.push({ label: t.label, value: t.value.length > 400 ? `${t.value.slice(0, 400)}…` : t.value });
      }
      if (c.type === "tIME" && c.data.length === 7) {
        const d = c.data;
        fields.push({ label: "Last modified (tIME)", value: `${(d[0] << 8) | d[1]}-${String(d[2]).padStart(2, "0")}-${String(d[3]).padStart(2, "0")} ${String(d[4]).padStart(2, "0")}:${String(d[5]).padStart(2, "0")}:${String(d[6]).padStart(2, "0")} UTC` });
      }
    }
  }
  return { format: "PNG image", blocks, fields };
}

export function stripPng(b: Uint8Array, opts: { keepIcc: boolean }): Uint8Array {
  const chunks = parsePng(b);
  const parts = [b.subarray(0, 8)];
  for (const c of chunks) {
    if (PNG_META.has(c.type)) continue;
    if (c.type === "iCCP" && !opts.keepIcc) continue;
    parts.push(b.subarray(c.start, c.end));
  }
  return concat(parts);
}

/* ------------------------------------------------------------------ */
/* WebP                                                                */
/* ------------------------------------------------------------------ */

interface RiffChunk {
  fourcc: string;
  start: number;
  end: number; // including pad byte
  size: number;
}

export function parseWebp(b: Uint8Array): RiffChunk[] {
  if (!(asciiAt(b, 0, "RIFF") && asciiAt(b, 8, "WEBP"))) throw new Error("Not a WebP file.");
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const total = Math.min(b.length, dv.getUint32(4, true) + 8);
  const chunks: RiffChunk[] = [];
  let off = 12;
  while (off + 8 <= total) {
    const fourcc = latin1(b.subarray(off, off + 4));
    const size = dv.getUint32(off + 4, true);
    const end = off + 8 + size + (size & 1);
    if (off + 8 + size > b.length) throw new Error("Corrupt WebP: a chunk runs past the end of the file.");
    chunks.push({ fourcc, start: off, end: Math.min(end, b.length), size });
    off = end;
  }
  return chunks;
}

export function inspectWebp(b: Uint8Array): MetaReport {
  const chunks = parseWebp(b);
  const blocks = chunks
    .filter((c) => c.fourcc === "EXIF" || c.fourcc === "XMP " || c.fourcc === "ICCP")
    .map((c) => ({ name: c.fourcc === "ICCP" ? "ICC color profile" : c.fourcc.trim(), bytes: c.end - c.start, removable: true }));
  return { format: "WebP image", blocks, fields: [] };
}

export function stripWebp(b: Uint8Array, opts: { keepIcc: boolean }): Uint8Array {
  const chunks = parseWebp(b);
  const kept = chunks.filter((c) => !(c.fourcc === "EXIF" || c.fourcc === "XMP " || (c.fourcc === "ICCP" && !opts.keepIcc)));
  const body = concat(kept.map((c) => b.slice(c.start, c.end)));
  // Clear the EXIF (0x08), XMP (0x04) and maybe ICC (0x20) flags in VP8X.
  const vdv = new DataView(body.buffer);
  let off = 0;
  while (off + 8 <= body.length) {
    const fourcc = latin1(body.subarray(off, off + 4));
    const size = vdv.getUint32(off + 4, true);
    if (fourcc === "VP8X" && size >= 1) {
      let flags = body[off + 8] & ~0x0c;
      if (!opts.keepIcc) flags &= ~0x20;
      body[off + 8] = flags;
    }
    off += 8 + size + (size & 1);
  }
  const out = new Uint8Array(12 + body.length);
  out.set(b.subarray(0, 12));
  new DataView(out.buffer).setUint32(4, 4 + body.length, true);
  out.set(body, 12);
  return out;
}

/* ------------------------------------------------------------------ */
/* MP3 (ID3)                                                           */
/* ------------------------------------------------------------------ */

const ID3_NAMES: Record<string, string> = {
  TIT2: "Title", TPE1: "Artist", TPE2: "Album artist", TALB: "Album", TYER: "Year", TDRC: "Recording date", TRCK: "Track",
  TPOS: "Disc", TCON: "Genre", COMM: "Comment", TCOM: "Composer", TENC: "Encoded by", TSSE: "Encoder settings",
  TCOP: "Copyright", TPUB: "Publisher", USLT: "Lyrics", APIC: "Cover picture", TXXX: "Custom text", WXXX: "Custom URL",
  PRIV: "Private data", GEOB: "Embedded object", TBPM: "BPM", TKEY: "Key", TLEN: "Length (ms)", TOAL: "Original album",
  TOPE: "Original artist", TDAT: "Date", TIME: "Time", PCNT: "Play counter", POPM: "Rating", UFID: "Unique file ID",
};

const synchsafe = (b: Uint8Array, o: number) => ((b[o] & 0x7f) << 21) | ((b[o + 1] & 0x7f) << 14) | ((b[o + 2] & 0x7f) << 7) | (b[o + 3] & 0x7f);

function id3Text(d: Uint8Array): string {
  const enc = d[0];
  const body = d.subarray(1);
  let s: string;
  if (enc === 1 || enc === 2) {
    let le = enc === 1;
    let p = 0;
    if (enc === 1 && body[0] === 0xfe && body[1] === 0xff) {
      le = false;
      p = 2;
    } else if (enc === 1 && body[0] === 0xff && body[1] === 0xfe) p = 2;
    s = "";
    for (; p + 1 < body.length; p += 2) s += String.fromCharCode(le ? body[p] | (body[p + 1] << 8) : (body[p] << 8) | body[p + 1]);
  } else if (enc === 3) s = utf8(body);
  else s = latin1(body);
  return s.replace(/\0+$/, "").replace(/\0/g, " / ");
}

export interface Id3Ranges {
  /** Bytes to drop at the start (ID3v2 tags, possibly several). */
  head: number;
  /** Bytes to drop at the end (ID3v1, Enhanced TAG, APEv2). */
  tail: number;
}

export function id3Ranges(b: Uint8Array): Id3Ranges {
  let head = 0;
  while (asciiAt(b, head, "ID3") && head + 10 <= b.length) {
    const size = synchsafe(b, head + 6);
    const footer = b[head + 5] & 0x10 ? 10 : 0;
    head += 10 + size + footer;
  }
  let end = b.length;
  for (let guard = 0; guard < 4; guard++) {
    if (end - 128 >= head && asciiAt(b, end - 128, "TAG")) {
      end -= 128;
      if (end - 227 >= head && asciiAt(b, end - 227, "TAG+")) end -= 227;
      continue;
    }
    if (end - 32 >= head && asciiAt(b, end - 32, "APETAGEX")) {
      const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
      const size = dv.getUint32(end - 32 + 12, true); // includes footer, excludes header
      const flags = dv.getUint32(end - 32 + 20, true);
      const hasHeader = (flags & 0x80000000) !== 0;
      end -= size + (hasHeader ? 32 : 0);
      continue;
    }
    break;
  }
  return { head: Math.min(head, b.length), tail: b.length - Math.max(end, head) };
}

export function inspectMp3(b: Uint8Array): MetaReport {
  const blocks: MetaReport["blocks"] = [];
  const fields: MetaItem[] = [];
  const r = id3Ranges(b);
  let off = 0;
  while (asciiAt(b, off, "ID3") && off + 10 <= b.length) {
    const ver = b[off + 3];
    const flags = b[off + 5];
    const size = synchsafe(b, off + 6);
    const tagEnd = off + 10 + size;
    blocks.push({ name: `ID3v2.${ver} tag`, bytes: 10 + size + (flags & 0x10 ? 10 : 0), removable: true });
    let p = off + 10;
    if (flags & 0x40 && ver >= 3) p += ver === 4 ? synchsafe(b, p) : new DataView(b.buffer, b.byteOffset).getUint32(p, false) + 4;
    const unsync = (flags & 0x80) !== 0 && ver < 4;
    while (!unsync && ver >= 3 && p + 10 <= tagEnd) {
      const id = latin1(b.subarray(p, p + 4));
      if (!/^[A-Z0-9]{4}$/.test(id)) break;
      const fsize = ver === 4 ? synchsafe(b, p + 4) : new DataView(b.buffer, b.byteOffset).getUint32(p + 4, false);
      const data = b.subarray(p + 10, Math.min(tagEnd, p + 10 + fsize));
      const label = ID3_NAMES[id] ?? id;
      let value: string;
      if (id === "APIC") value = `${data.length.toLocaleString("en-US")} bytes of image data`;
      else if (id[0] === "T") value = id3Text(data);
      else if (id === "COMM" || id === "USLT") value = id3Text(new Uint8Array([data[0], ...data.subarray(4)])).replace(/^\s*\/\s*/, "");
      else if (id[0] === "W") value = latin1(data).replace(/\0/g, "");
      else value = `${data.length.toLocaleString("en-US")} bytes`;
      fields.push({ label, value: value.length > 300 ? `${value.slice(0, 300)}…` : value });
      p += 10 + fsize;
    }
    if (unsync || ver < 3) fields.push({ label: `ID3v2.${ver}`, value: "Frames not listed (older or unsynchronised tag), but the tag will be removed." });
    off = tagEnd + (flags & 0x10 ? 10 : 0);
  }
  if (r.tail > 0) {
    const t = b.length - r.tail;
    for (let p = t; p < b.length; ) {
      if (asciiAt(b, p, "TAG+")) {
        blocks.push({ name: "Enhanced ID3v1 tag", bytes: 227, removable: true });
        p += 227;
      } else if (asciiAt(b, p, "TAG") && b.length - p >= 128) {
        blocks.push({ name: "ID3v1 tag", bytes: 128, removable: true });
        const s = (a: number, l: number) => latin1(b.subarray(p + a, p + a + l)).replace(/[\0 ]+$/, "");
        for (const [label, v] of [["Title (v1)", s(3, 30)], ["Artist (v1)", s(33, 30)], ["Album (v1)", s(63, 30)], ["Year (v1)", s(93, 4)]] as const) if (v) fields.push({ label, value: v });
        p += 128;
      } else {
        blocks.push({ name: "APEv2 tag", bytes: b.length - p, removable: true });
        break;
      }
    }
  }
  return { format: "MP3 audio", blocks, fields };
}

export function stripMp3(b: Uint8Array): Uint8Array {
  const r = id3Ranges(b);
  return b.slice(r.head, b.length - r.tail);
}

/* ------------------------------------------------------------------ */
/* Office Open XML                                                     */
/* ------------------------------------------------------------------ */

const XML_ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
const decodeXml = (s: string) =>
  s.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, e: string) =>
    e[0] === "#" ? String.fromCodePoint(e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)) : (XML_ENTITIES[e] ?? m),
  );

const CORE_LABELS: Record<string, string> = {
  title: "Title", subject: "Subject", creator: "Author", keywords: "Keywords", description: "Comments",
  lastModifiedBy: "Last modified by", revision: "Revision", created: "Created", modified: "Modified",
  category: "Category", contentStatus: "Status", lastPrinted: "Last printed", identifier: "Identifier", language: "Language", version: "Version",
};
const APP_PERSONAL = ["Company", "Manager", "Template", "TotalTime", "HyperlinkBase"];

/** Extracts simple <prefix:name>text</prefix:name> elements. */
export function xmlFields(xml: string): MetaItem[] {
  const out: MetaItem[] = [];
  const re = /<(?:[\w-]+:)?([\w-]+)(?:\s[^>]*)?>([^<]+)<\/(?:[\w-]+:)?\1>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) {
    const v = decodeXml(m[2]).trim();
    if (v) out.push({ label: CORE_LABELS[m[1]] ?? m[1], value: v });
  }
  return out;
}

export const EMPTY_CORE =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"></cp:coreProperties>';

export const EMPTY_CUSTOM =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/custom-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"></Properties>';

export function cleanAppXml(xml: string): string {
  let s = xml;
  for (const tag of APP_PERSONAL) s = s.replace(new RegExp(`<${tag}(\\s[^>]*)?(/>|>[\\s\\S]*?</${tag}>)`, "g"), "");
  return s;
}

export interface OfficeParts {
  core?: string;
  app?: string;
  custom?: string;
}

export function inspectOffice(p: OfficeParts, sizes: Record<string, number>): MetaReport {
  const blocks: MetaReport["blocks"] = [];
  const fields: MetaItem[] = [];
  if (p.core !== undefined) {
    blocks.push({ name: "docProps/core.xml (document properties)", bytes: sizes["docProps/core.xml"] ?? p.core.length, removable: true });
    fields.push(...xmlFields(p.core));
  }
  if (p.app !== undefined) {
    blocks.push({ name: "docProps/app.xml (application properties)", bytes: sizes["docProps/app.xml"] ?? p.app.length, removable: true });
    const appFields = xmlFields(p.app).filter((f) => ["Company", "Manager", "Template", "TotalTime", "Application", "AppVersion", "HyperlinkBase"].includes(f.label));
    fields.push(...appFields.map((f) => ({ label: f.label === "TotalTime" ? "Total editing time (min)" : f.label, value: f.value })));
  }
  if (p.custom !== undefined) {
    blocks.push({ name: "docProps/custom.xml (custom properties)", bytes: sizes["docProps/custom.xml"] ?? p.custom.length, removable: true });
    const re = /<property\b[^>]*\bname="([^"]*)"[^>]*>([\s\S]*?)<\/property>/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(p.custom))) fields.push({ label: `Custom: ${decodeXml(m[1])}`, value: decodeXml(m[2].replace(/<[^>]+>/g, "")).trim() });
  }
  return { format: "Office document", blocks, fields };
}

export function cleanOffice(p: OfficeParts): OfficeParts {
  return {
    core: p.core !== undefined ? EMPTY_CORE : undefined,
    app: p.app !== undefined ? cleanAppXml(p.app) : undefined,
    custom: p.custom !== undefined ? EMPTY_CUSTOM : undefined,
  };
}

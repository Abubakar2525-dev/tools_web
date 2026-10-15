/**
 * File type detection from content ("magic numbers"). Our own table built
 * from the public format specifications. Order matters: more specific
 * signatures come first. ZIP containers are refined by their entry names.
 */

export interface FileKind {
  name: string;
  mime: string;
  /** Typical extensions, first is preferred. */
  exts: string[];
  group: "image" | "audio" | "video" | "document" | "archive" | "font" | "executable" | "data" | "text";
  /** Extra detail, e.g. "OpenDocument container". */
  note?: string;
}

type Matcher = (b: Uint8Array) => boolean;

const ascii = (b: Uint8Array, off: number, s: string) => {
  if (off + s.length > b.length) return false;
  for (let i = 0; i < s.length; i++) if (b[off + i] !== s.charCodeAt(i)) return false;
  return true;
};

const bytes = (b: Uint8Array, off: number, sig: number[]) => {
  if (off + sig.length > b.length) return false;
  for (let i = 0; i < sig.length; i++) if (b[off + i] !== sig[i]) return false;
  return true;
};

const textStart = (b: Uint8Array, n = 512) => {
  let s = "";
  const start = bytes(b, 0, [0xef, 0xbb, 0xbf]) ? 3 : 0;
  for (let i = start; i < Math.min(b.length, n); i++) s += String.fromCharCode(b[i]);
  return s.replace(/^\s+/, "");
};

const ftyp = (b: Uint8Array, brands: string[]) =>
  ascii(b, 4, "ftyp") && brands.some((br) => ascii(b, 8, br) || compatibleBrand(b, br));

function compatibleBrand(b: Uint8Array, br: string) {
  if (!ascii(b, 4, "ftyp") || b.length < 16) return false;
  const size = ((b[0] << 24) | (b[1] << 16) | (b[2] << 8) | b[3]) >>> 0;
  for (let off = 16; off + 4 <= Math.min(size, b.length, 64); off += 4) if (ascii(b, off, br)) return true;
  return false;
}

const K = (name: string, mime: string, exts: string[], group: FileKind["group"], note?: string): FileKind => ({ name, mime, exts, group, note });

const TABLE: [Matcher, FileKind][] = [
  // Images
  [(b) => bytes(b, 0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), K("PNG image", "image/png", ["png"], "image")],
  [(b) => bytes(b, 0, [0xff, 0xd8, 0xff]), K("JPEG image", "image/jpeg", ["jpg", "jpeg", "jfif"], "image")],
  [(b) => ascii(b, 0, "GIF87a") || ascii(b, 0, "GIF89a"), K("GIF image", "image/gif", ["gif"], "image")],
  [(b) => ascii(b, 0, "RIFF") && ascii(b, 8, "WEBP"), K("WebP image", "image/webp", ["webp"], "image")],
  [(b) => ftyp(b, ["avif", "avis"]), K("AVIF image", "image/avif", ["avif"], "image")],
  [(b) => ftyp(b, ["heic", "heix", "hevc", "heim", "heis"]), K("HEIC image", "image/heic", ["heic"], "image")],
  [(b) => ftyp(b, ["mif1", "msf1"]), K("HEIF image", "image/heif", ["heif", "heic"], "image")],
  [(b) => bytes(b, 0, [0x00, 0x00, 0x00, 0x0c, 0x6a, 0x50, 0x20, 0x20]) || bytes(b, 0, [0xff, 0x4f, 0xff, 0x51]), K("JPEG 2000 image", "image/jp2", ["jp2", "j2k"], "image")],
  [(b) => bytes(b, 0, [0xff, 0x0a]) || bytes(b, 0, [0x00, 0x00, 0x00, 0x0c, 0x4a, 0x58, 0x4c, 0x20]), K("JPEG XL image", "image/jxl", ["jxl"], "image")],
  [(b) => bytes(b, 0, [0x49, 0x49, 0x2a, 0x00]) || bytes(b, 0, [0x4d, 0x4d, 0x00, 0x2a]), K("TIFF image", "image/tiff", ["tif", "tiff", "dng", "nef", "cr2", "arw"], "image", "Many camera RAW formats are TIFF-based.")],
  [(b) => ascii(b, 0, "BM") && b.length > 18 && [12, 40, 52, 56, 64, 108, 124].includes(b[14] | (b[15] << 8)), K("BMP image", "image/bmp", ["bmp", "dib"], "image")],
  [(b) => bytes(b, 0, [0, 0, 1, 0]) && b.length > 6 && (b[4] | (b[5] << 8)) > 0 && b[4] < 255, K("Windows icon", "image/vnd.microsoft.icon", ["ico"], "image")],
  [(b) => bytes(b, 0, [0, 0, 2, 0]) && b.length > 6 && (b[4] | (b[5] << 8)) > 0, K("Windows cursor", "image/x-win-bitmap", ["cur"], "image")],
  [(b) => ascii(b, 0, "icns"), K("Apple icon", "image/x-icns", ["icns"], "image")],
  [(b) => ascii(b, 0, "8BPS"), K("Photoshop document", "image/vnd.adobe.photoshop", ["psd", "psb"], "image")],
  [(b) => ascii(b, 0, "AT&TFORM"), K("DjVu document", "image/vnd.djvu", ["djvu", "djv"], "document")],
  [(b) => ascii(b, 128, "DICM"), K("DICOM medical image", "application/dicom", ["dcm"], "image")],
  // Documents
  [(b) => ascii(b, 0, "%PDF-"), K("PDF document", "application/pdf", ["pdf"], "document")],
  [(b) => bytes(b, 0, [0xc5, 0xd0, 0xd3, 0xc6]) || ascii(b, 0, "%!PS-Adobe-3.0 EPSF"), K("Encapsulated PostScript", "application/postscript", ["eps"], "document")],
  [(b) => ascii(b, 0, "%!PS"), K("PostScript document", "application/postscript", ["ps"], "document")],
  [(b) => ascii(b, 0, "{\\rtf"), K("Rich Text Format", "application/rtf", ["rtf"], "document")],
  [(b) => bytes(b, 0, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]), K("Microsoft Compound File", "application/x-ole-storage", ["doc", "xls", "ppt", "msg", "msi"], "document", "Legacy Office (97-2003), Outlook .msg and .msi files share this container.")],
  // Archives
  [(b) => ascii(b, 0, "Rar!\x1a\x07"), K("RAR archive", "application/vnd.rar", ["rar"], "archive")],
  [(b) => bytes(b, 0, [0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c]), K("7-Zip archive", "application/x-7z-compressed", ["7z"], "archive")],
  [(b) => bytes(b, 0, [0x1f, 0x8b, 0x08]), K("Gzip compressed data", "application/gzip", ["gz", "tgz"], "archive")],
  [(b) => ascii(b, 0, "BZh") && b[3] >= 0x31 && b[3] <= 0x39, K("Bzip2 compressed data", "application/x-bzip2", ["bz2", "tbz2"], "archive")],
  [(b) => bytes(b, 0, [0xfd, 0x37, 0x7a, 0x58, 0x5a, 0x00]), K("XZ compressed data", "application/x-xz", ["xz", "txz"], "archive")],
  [(b) => bytes(b, 0, [0x28, 0xb5, 0x2f, 0xfd]), K("Zstandard compressed data", "application/zstd", ["zst"], "archive")],
  [(b) => bytes(b, 0, [0x04, 0x22, 0x4d, 0x18]), K("LZ4 compressed data", "application/x-lz4", ["lz4"], "archive")],
  [(b) => ascii(b, 0, "LZIP"), K("Lzip compressed data", "application/x-lzip", ["lz"], "archive")],
  [(b) => bytes(b, 0, [0x1f, 0x9d]), K("Unix compress data", "application/x-compress", ["z"], "archive")],
  [(b) => ascii(b, 257, "ustar"), K("TAR archive", "application/x-tar", ["tar"], "archive")],
  [(b) => ascii(b, 0, "MSCF"), K("Microsoft Cabinet", "application/vnd.ms-cab-compressed", ["cab"], "archive")],
  [(b) => ascii(b, 0, "!<arch>\ndebian"), K("Debian package", "application/vnd.debian.binary-package", ["deb"], "archive")],
  [(b) => ascii(b, 0, "!<arch>"), K("Unix ar archive", "application/x-archive", ["a", "ar"], "archive")],
  [(b) => bytes(b, 0, [0xed, 0xab, 0xee, 0xdb]), K("RPM package", "application/x-rpm", ["rpm"], "archive")],
  [(b) => ascii(b, 0, "070701") || ascii(b, 0, "070707"), K("CPIO archive", "application/x-cpio", ["cpio"], "archive")],
  [(b) => ascii(b, 32769, "CD001"), K("ISO 9660 disc image", "application/x-iso9660-image", ["iso"], "archive")],
  // Audio
  [(b) => ascii(b, 0, "fLaC"), K("FLAC audio", "audio/flac", ["flac"], "audio")],
  [(b) => ascii(b, 0, "OggS") && ascii(b, 28, "OpusHead"), K("Opus audio (Ogg)", "audio/ogg; codecs=opus", ["opus", "ogg"], "audio")],
  [(b) => ascii(b, 0, "OggS") && ascii(b, 29, "theora"), K("Ogg Theora video", "video/ogg", ["ogv"], "video")],
  [(b) => ascii(b, 0, "OggS"), K("Ogg audio", "audio/ogg", ["ogg", "oga"], "audio")],
  [(b) => ascii(b, 0, "RIFF") && ascii(b, 8, "WAVE"), K("WAV audio", "audio/wav", ["wav"], "audio")],
  [(b) => ascii(b, 0, "FORM") && (ascii(b, 8, "AIFF") || ascii(b, 8, "AIFC")), K("AIFF audio", "audio/aiff", ["aiff", "aif"], "audio")],
  [(b) => ascii(b, 0, "MThd"), K("MIDI", "audio/midi", ["mid", "midi"], "audio")],
  [(b) => ascii(b, 0, "#!AMR"), K("AMR audio", "audio/amr", ["amr"], "audio")],
  [(b) => ftyp(b, ["M4A ", "M4B "]), K("MPEG-4 audio", "audio/mp4", ["m4a", "m4b"], "audio")],
  [(b) => ascii(b, 0, "ID3"), K("MP3 audio (ID3 tagged)", "audio/mpeg", ["mp3"], "audio")],
  [(b) => b[0] === 0xff && (b[1] & 0xf6) === 0xf0, K("AAC audio (ADTS)", "audio/aac", ["aac"], "audio")],
  [(b) => b[0] === 0xff && (b[1] & 0xe0) === 0xe0 && (b[1] & 0x06) !== 0 && (b[2] & 0xf0) !== 0xf0, K("MP3 audio", "audio/mpeg", ["mp3"], "audio")],
  // Video
  [(b) => ascii(b, 0, "RIFF") && ascii(b, 8, "AVI "), K("AVI video", "video/x-msvideo", ["avi"], "video")],
  [(b) => bytes(b, 0, [0x1a, 0x45, 0xdf, 0xa3]) && textStart(b, 64).includes("webm"), K("WebM video", "video/webm", ["webm"], "video")],
  [(b) => bytes(b, 0, [0x1a, 0x45, 0xdf, 0xa3]), K("Matroska video", "video/x-matroska", ["mkv", "mka"], "video")],
  [(b) => ascii(b, 0, "FLV"), K("Flash video", "video/x-flv", ["flv"], "video")],
  [(b) => ftyp(b, ["qt  "]), K("QuickTime video", "video/quicktime", ["mov"], "video")],
  [(b) => ftyp(b, ["3gp", "3g2"]), K("3GPP video", "video/3gpp", ["3gp", "3g2"], "video")],
  [(b) => ascii(b, 4, "ftyp"), K("MPEG-4 video", "video/mp4", ["mp4", "m4v"], "video")],
  [(b) => bytes(b, 0, [0x00, 0x00, 0x01, 0xba]), K("MPEG program stream", "video/mpeg", ["mpg", "mpeg"], "video")],
  // Fonts
  [(b) => ascii(b, 0, "wOFF"), K("WOFF font", "font/woff", ["woff"], "font")],
  [(b) => ascii(b, 0, "wOF2"), K("WOFF2 font", "font/woff2", ["woff2"], "font")],
  [(b) => ascii(b, 0, "OTTO"), K("OpenType font", "font/otf", ["otf"], "font")],
  [(b) => ascii(b, 0, "ttcf"), K("TrueType collection", "font/collection", ["ttc"], "font")],
  [(b) => bytes(b, 0, [0x00, 0x01, 0x00, 0x00, 0x00]), K("TrueType font", "font/ttf", ["ttf"], "font")],
  // Executables and binaries
  [(b) => bytes(b, 0, [0x7f, 0x45, 0x4c, 0x46]), K("ELF executable", "application/x-elf", ["", "so", "o"], "executable", "Linux and Unix programs and libraries.")],
  [(b) => ascii(b, 0, "MZ"), K("Windows executable", "application/vnd.microsoft.portable-executable", ["exe", "dll", "sys", "scr"], "executable")],
  [(b) => bytes(b, 0, [0xca, 0xfe, 0xba, 0xbe]) && b.length > 8 && ((b[6] << 8) | b[7]) >= 45 && ((b[6] << 8) | b[7]) < 100, K("Java class file", "application/java-vm", ["class"], "executable")],
  [(b) => bytes(b, 0, [0xfe, 0xed, 0xfa, 0xce]) || bytes(b, 0, [0xfe, 0xed, 0xfa, 0xcf]) || bytes(b, 0, [0xce, 0xfa, 0xed, 0xfe]) || bytes(b, 0, [0xcf, 0xfa, 0xed, 0xfe]) || bytes(b, 0, [0xca, 0xfe, 0xba, 0xbe]), K("Mach-O executable", "application/x-mach-binary", ["", "dylib"], "executable", "macOS and iOS programs and libraries.")],
  [(b) => bytes(b, 0, [0x00, 0x61, 0x73, 0x6d]), K("WebAssembly module", "application/wasm", ["wasm"], "executable")],
  [(b) => ascii(b, 0, "dex\n"), K("Android DEX bytecode", "application/vnd.android.dex", ["dex"], "executable")],
  [(b) => bytes(b, 0, [0x4c, 0x00, 0x00, 0x00, 0x01, 0x14, 0x02, 0x00]), K("Windows shortcut", "application/x-ms-shortcut", ["lnk"], "data")],
  // Data
  [(b) => ascii(b, 0, "SQLite format 3\0"), K("SQLite database", "application/vnd.sqlite3", ["sqlite", "db", "sqlite3"], "data")],
  [(b) => ascii(b, 0, "PAR1"), K("Apache Parquet", "application/vnd.apache.parquet", ["parquet"], "data")],
  [(b) => ascii(b, 0, "ARROW1"), K("Apache Arrow", "application/vnd.apache.arrow.file", ["arrow"], "data")],
  [(b) => bytes(b, 0, [0xd4, 0xc3, 0xb2, 0xa1]) || bytes(b, 0, [0xa1, 0xb2, 0xc3, 0xd4]) || bytes(b, 0, [0x0a, 0x0d, 0x0d, 0x0a]), K("Packet capture", "application/vnd.tcpdump.pcap", ["pcap", "pcapng"], "data")],
  [(b) => ascii(b, 0, "BLENDER"), K("Blender scene", "application/x-blender", ["blend"], "data")],
  [(b) => ascii(b, 0, "d8:announce") || ascii(b, 0, "d13:announce-list"), K("BitTorrent file", "application/x-bittorrent", ["torrent"], "data")],
];

/** Text-based formats, checked after binary signatures. */
function detectText(b: Uint8Array): FileKind | null {
  if (b.length === 0) return null;
  if (bytes(b, 0, [0xff, 0xfe]) || bytes(b, 0, [0xfe, 0xff])) return K("UTF-16 text", "text/plain; charset=utf-16", ["txt"], "text");
  // Binary if NUL bytes or many control characters appear in the first 4 KB.
  const n = Math.min(b.length, 4096);
  let ctrl = 0;
  for (let i = 0; i < n; i++) {
    const c = b[i];
    if (c === 0) return null;
    if (c < 9 || (c > 13 && c < 32)) ctrl++;
  }
  if (ctrl / n > 0.02) return null;
  const t = textStart(b, 2048);
  const lower = t.toLowerCase();
  if (lower.startsWith("<?xml") && lower.includes("<svg")) return K("SVG image", "image/svg+xml", ["svg"], "image");
  if (lower.startsWith("<svg")) return K("SVG image", "image/svg+xml", ["svg"], "image");
  if (lower.startsWith("<!doctype html") || lower.startsWith("<html") || /^<(head|body|meta|div)\b/.test(lower)) return K("HTML document", "text/html", ["html", "htm"], "text");
  if (lower.startsWith("<?xml")) return K("XML document", "application/xml", ["xml"], "text");
  if (t.startsWith("-----BEGIN PGP")) return K("OpenPGP armored data", "application/pgp-encrypted", ["asc", "pgp"], "text");
  if (t.startsWith("-----BEGIN ")) return K("PEM certificate or key", "application/x-pem-file", ["pem", "crt", "key", "cer"], "text");
  if (t.startsWith("BEGIN:VCARD")) return K("vCard contact", "text/vcard", ["vcf"], "text");
  if (t.startsWith("BEGIN:VCALENDAR")) return K("iCalendar file", "text/calendar", ["ics"], "text");
  if (t.startsWith("#!")) return K("Script (shebang)", "text/x-script", ["sh", "py", "pl", ""], "text");
  if (/^[{[]/.test(t)) {
    try {
      JSON.parse(new TextDecoder().decode(b));
      return K("JSON data", "application/json", ["json"], "text");
    } catch {
      /* not complete JSON, fall through */
    }
  }
  return K("Plain text", "text/plain", ["txt", "csv", "md", "log", "tsv", "ini", "yaml", "yml"], "text", "Text has no signature, so the exact format is a guess.");
}

/* ------------------------------------------------------------------ */
/* ZIP-based containers                                                */
/* ------------------------------------------------------------------ */

const latin1 = (b: Uint8Array) => {
  let s = "";
  for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
  return s;
};

/** Collects entry names from local headers (head) and the central directory (tail). */
export function zipEntryNames(head: Uint8Array, tail: Uint8Array): { names: string[]; mimetype: string | null } {
  const names = new Set<string>();
  let mimetype: string | null = null;
  const dv = new DataView(head.buffer, head.byteOffset, head.byteLength);
  let off = 0;
  while (off + 30 <= head.length && dv.getUint32(off, true) === 0x04034b50) {
    const flags = dv.getUint16(off + 6, true);
    const method = dv.getUint16(off + 8, true);
    const csize = dv.getUint32(off + 18, true);
    const nlen = dv.getUint16(off + 26, true);
    const xlen = dv.getUint16(off + 28, true);
    if (off + 30 + nlen > head.length) break;
    const name = latin1(head.subarray(off + 30, off + 30 + nlen));
    names.add(name);
    const dataStart = off + 30 + nlen + xlen;
    if (name === "mimetype" && method === 0 && csize < 200) mimetype = latin1(head.subarray(dataStart, dataStart + csize)).trim();
    if (flags & 0x08) break; // sizes are after the data; stop scanning local headers
    off = dataStart + csize;
  }
  // Central directory entries anywhere in the tail.
  const tv = new DataView(tail.buffer, tail.byteOffset, tail.byteLength);
  for (let i = 0; i + 46 <= tail.length; i++) {
    if (tail[i] !== 0x50 || tv.getUint32(i, true) !== 0x02014b50) continue;
    const nlen = tv.getUint16(i + 28, true);
    if (i + 46 + nlen > tail.length) break;
    names.add(latin1(tail.subarray(i + 46, i + 46 + nlen)));
    i += 45 + nlen;
  }
  return { names: [...names], mimetype };
}

const ODF: Record<string, [string, string]> = {
  "application/vnd.oasis.opendocument.text": ["OpenDocument text", "odt"],
  "application/vnd.oasis.opendocument.spreadsheet": ["OpenDocument spreadsheet", "ods"],
  "application/vnd.oasis.opendocument.presentation": ["OpenDocument presentation", "odp"],
  "application/vnd.oasis.opendocument.graphics": ["OpenDocument drawing", "odg"],
};

export function refineZip(names: string[], mimetype: string | null): FileKind {
  const has = (p: string) => names.some((n) => n === p || n.startsWith(p));
  if (mimetype === "application/epub+zip") return K("EPUB e-book", "application/epub+zip", ["epub"], "document", "ZIP container with an EPUB mimetype entry.");
  if (mimetype && ODF[mimetype]) return K(ODF[mimetype][0], mimetype, [ODF[mimetype][1]], "document", "OpenDocument ZIP container.");
  if (has("[Content_Types].xml") || has("_rels/")) {
    if (has("word/")) return K("Word document (DOCX)", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", ["docx", "docm", "dotx"], "document", "Office Open XML (ZIP container).");
    if (has("xl/")) return K("Excel workbook (XLSX)", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", ["xlsx", "xlsm", "xltx"], "document", "Office Open XML (ZIP container).");
    if (has("ppt/")) return K("PowerPoint presentation (PPTX)", "application/vnd.openxmlformats-officedocument.presentationml.presentation", ["pptx", "pptm", "potx"], "document", "Office Open XML (ZIP container).");
    if (has("visio/")) return K("Visio drawing (VSDX)", "application/vnd.ms-visio.drawing", ["vsdx"], "document", "Office Open XML (ZIP container).");
    if (has("3D/")) return K("3D Manufacturing Format", "model/3mf", ["3mf"], "data");
    return K("Office Open XML package", "application/vnd.openxmlformats-package", ["zip"], "document");
  }
  if (has("AndroidManifest.xml") && has("classes")) return K("Android package (APK)", "application/vnd.android.package-archive", ["apk"], "executable", "ZIP container with an Android manifest.");
  if (has("META-INF/MANIFEST.MF") || names.some((n) => n.endsWith(".class"))) return K("Java archive (JAR)", "application/java-archive", ["jar", "war", "ear"], "executable", "ZIP container with a Java manifest or classes.");
  if (has("Payload/") && names.some((n) => n.endsWith(".app/"))) return K("iOS app (IPA)", "application/octet-stream", ["ipa"], "executable");
  if (has("manifest.json") && names.some((n) => n.endsWith(".js"))) return K("Browser extension or web app package", "application/zip", ["zip", "xpi", "crx"], "archive");
  if (has("doc.kml")) return K("Google Earth KMZ", "application/vnd.google-earth.kmz", ["kmz"], "data");
  return K("ZIP archive", "application/zip", ["zip"], "archive");
}

export interface Detection {
  kind: FileKind | null;
  /** Hex of the first bytes, for display. */
  headHex: string;
}

export const HEAD_BYTES = 64 * 1024;
export const ISO_BYTES = 32774;

/** Detects from the first bytes (≥ 64 KB recommended) and, for ZIP, the last 64 KB. */
export function detect(head: Uint8Array, tail?: Uint8Array): FileKind | null {
  if (bytes(head, 0, [0x50, 0x4b, 0x03, 0x04]) || bytes(head, 0, [0x50, 0x4b, 0x05, 0x06]) || bytes(head, 0, [0x50, 0x4b, 0x07, 0x08])) {
    const { names, mimetype } = zipEntryNames(head, tail ?? head);
    return refineZip(names, mimetype);
  }
  for (const [m, k] of TABLE) if (m(head)) return k;
  return detectText(head);
}

export function extensionMatches(filename: string, kind: FileKind) {
  const m = /\.([^./\\]+)$/.exec(filename);
  const ext = m ? m[1].toLowerCase() : "";
  return kind.exts.includes(ext);
}

export const SIGNATURE_COUNT = TABLE.length;

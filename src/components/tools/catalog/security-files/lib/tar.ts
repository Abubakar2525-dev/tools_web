/**
 * Minimal POSIX ustar writer/reader (IEEE Std 1003.1-1988 + pax extended headers).
 * Each entry: 512-byte header, file data, zero padding to a 512-byte boundary.
 * The archive ends with two zero blocks. Paths that do not fit the 100-byte
 * name + 155-byte prefix fields, or contain non-ASCII characters, get a pax
 * "x" header with a UTF-8 `path=` record in front of the ustar header.
 */

export interface TarInput {
  /** Path inside the archive, "/" separated. Directories end with "/". */
  path: string;
  data?: Blob | Uint8Array;
  size?: number;
  mtime?: number; // ms since epoch
  directory?: boolean;
}

const BLOCK = 512;
const enc = new TextEncoder();

function writeStr(h: Uint8Array, off: number, len: number, s: string) {
  const b = enc.encode(s);
  h.set(b.subarray(0, len), off);
}

function writeOctal(h: Uint8Array, off: number, len: number, n: number) {
  // len-1 octal digits followed by NUL
  const s = Math.floor(n).toString(8).padStart(len - 1, "0");
  if (s.length > len - 1) throw new Error("Value too large for a tar header field.");
  writeStr(h, off, len - 1, s);
  h[off + len - 1] = 0;
}

function isAscii(s: string) {
  return /^[\x20-\x7e]*$/.test(s);
}

/** Splits a path into ustar prefix + name, or returns null if it cannot fit. */
export function splitUstarPath(path: string): { prefix: string; name: string } | null {
  if (!isAscii(path)) return null;
  if (path.length <= 100) return { prefix: "", name: path };
  // Find a "/" so that prefix ≤ 155 and name ≤ 100.
  for (let i = path.length - 1; i > 0; i--) {
    if (path[i] !== "/") continue;
    const prefix = path.slice(0, i);
    const name = path.slice(i + 1);
    if (prefix.length <= 155 && name.length <= 100 && name.length > 0) return { prefix, name };
    if (path.length - i - 1 > 100) break;
  }
  return null;
}

/** One pax record "<len> key=value\n" where len counts the whole record in bytes. */
export function paxRecord(key: string, value: string) {
  const body = ` ${key}=${value}\n`;
  const bodyLen = enc.encode(body).length;
  const digits = String(bodyLen).length;
  let len = bodyLen + digits;
  if (String(len).length !== digits) len = bodyLen + String(len).length;
  return `${len}${body}`;
}

function header(opts: { name: string; prefix: string; size: number; mtime: number; type: string; mode: number }) {
  const h = new Uint8Array(BLOCK);
  writeStr(h, 0, 100, opts.name);
  writeOctal(h, 100, 8, opts.mode);
  writeOctal(h, 108, 8, 0);
  writeOctal(h, 116, 8, 0);
  writeOctal(h, 124, 12, opts.size);
  writeOctal(h, 136, 12, Math.max(0, Math.floor(opts.mtime / 1000)));
  h.fill(0x20, 148, 156); // checksum placeholder: spaces
  h[156] = opts.type.charCodeAt(0);
  writeStr(h, 257, 6, "ustar");
  h[262] = 0;
  writeStr(h, 263, 2, "00");
  writeStr(h, 345, 155, opts.prefix);
  let sum = 0;
  for (let i = 0; i < BLOCK; i++) sum += h[i];
  writeStr(h, 148, 6, sum.toString(8).padStart(6, "0"));
  h[154] = 0;
  h[155] = 0x20;
  return h;
}

const padding = (size: number) => new Uint8Array((BLOCK - (size % BLOCK)) % BLOCK);

/** Builds a tar archive as Blob parts (file data stays as Blob references, no copy). */
export function buildTar(entries: TarInput[]): (Uint8Array | Blob)[] {
  const parts: (Uint8Array | Blob)[] = [];
  for (const e of entries) {
    const dir = !!e.directory;
    let path = e.path.replace(/\\/g, "/").replace(/^\/+/, "");
    if (dir && !path.endsWith("/")) path += "/";
    const size = dir ? 0 : (e.size ?? (e.data instanceof Blob ? e.data.size : (e.data?.length ?? 0)));
    if (size > 0o77777777777) throw new Error(`${path} is larger than 8 GB, which ustar cannot store.`);
    const mtime = e.mtime ?? Date.now();
    let split = splitUstarPath(path);
    if (!split) {
      const pax = enc.encode(paxRecord("path", path));
      const ascii = path.replace(/[^\x20-\x7e]/g, "_");
      const short = ascii.length > 100 ? ascii.slice(ascii.length - 100).replace(/^\/+/, "") : ascii;
      parts.push(header({ name: `PaxHeaders/${short}`.slice(0, 100), prefix: "", size: pax.length, mtime, type: "x", mode: 0o644 }));
      parts.push(pax, padding(pax.length));
      split = { prefix: "", name: short };
    }
    parts.push(header({ ...split, size, mtime, type: dir ? "5" : "0", mode: dir ? 0o755 : 0o644 }));
    if (!dir && e.data) {
      parts.push(e.data);
      parts.push(padding(size));
    }
  }
  parts.push(new Uint8Array(BLOCK * 2));
  return parts;
}

/* ------------------------------------------------------------------ */
/* Reader (used for verification and previews)                         */
/* ------------------------------------------------------------------ */

export interface TarEntry {
  path: string;
  size: number;
  type: string;
  mtime: number;
  data: Uint8Array;
}

const dec = new TextDecoder();
const cstr = (b: Uint8Array) => {
  const z = b.indexOf(0);
  return dec.decode(z < 0 ? b : b.subarray(0, z));
};
const octal = (b: Uint8Array) => parseInt(cstr(b).trim() || "0", 8);

export function verifyChecksum(h: Uint8Array) {
  let sum = 0;
  for (let i = 0; i < BLOCK; i++) sum += i >= 148 && i < 156 ? 0x20 : h[i];
  return sum === octal(h.subarray(148, 156));
}

export function readTar(bytes: Uint8Array): TarEntry[] {
  const out: TarEntry[] = [];
  let off = 0;
  let paxPath: string | null = null;
  while (off + BLOCK <= bytes.length) {
    const h = bytes.subarray(off, off + BLOCK);
    if (h.every((x) => x === 0)) break;
    if (!verifyChecksum(h)) throw new Error(`Bad header checksum at offset ${off}.`);
    const size = octal(h.subarray(124, 136));
    const type = String.fromCharCode(h[156] || 0x30);
    const data = bytes.subarray(off + BLOCK, off + BLOCK + size);
    off += BLOCK + Math.ceil(size / BLOCK) * BLOCK;
    if (type === "x") {
      const text = dec.decode(data);
      const m = /(?:^|\n)\d+ path=([^\n]*)\n/.exec(text);
      paxPath = m ? m[1] : null;
      continue;
    }
    const prefix = cstr(h.subarray(345, 500));
    const name = cstr(h.subarray(0, 100));
    out.push({
      path: paxPath ?? (prefix ? `${prefix}/${name}` : name),
      size,
      type,
      mtime: octal(h.subarray(136, 148)) * 1000,
      data,
    });
    paxPath = null;
  }
  return out;
}

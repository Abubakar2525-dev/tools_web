/**
 * Password-based encryption with WebCrypto.
 *
 * Key derivation (both formats):
 *   master = PBKDF2-HMAC-SHA-256(password UTF-8, salt 16 B, iterations) -> 32 bytes
 *   aesKey = HKDF-SHA-256(master, info "stratum enc key")   -> AES-256-GCM key
 *   check  = HKDF-SHA-256(master, info "stratum enc check") -> 16 bytes stored in the header
 * The check value lets decryption report "wrong password" separately from
 * "file damaged". Guessing passwords against it costs the same PBKDF2 work.
 *
 * Text envelope v1 (Base64 of):
 *   "STXT" | version=1 | iterations u32 BE | salt 16 | iv 12 | check 16 | ciphertext+tag
 *   The header bytes are the GCM additional data.
 *
 * File stream v1:
 *   header (58 B): "STRF" | version=1 | flags=0 | iterations u32 BE | salt 16 | baseIv 12 | chunkSize u32 BE | check 16
 *   then N chunks, each AES-256-GCM(plain chunk) = chunk ciphertext + 16-byte tag.
 *   Chunk i uses IV = baseIv with its last 4 bytes XORed with i (u32 BE).
 *   AAD = header | i (u32 BE) | final flag (1 byte), so chunks cannot be
 *   reordered, dropped or truncated without detection.
 *   Every chunk holds chunkSize plaintext bytes except the final one (0..chunkSize).
 */

export const PBKDF2_ITERATIONS = 600_000;
const MIN_ITERATIONS = 100_000;
const MAX_ITERATIONS = 10_000_000;
export const FILE_CHUNK_SIZE = 1024 * 1024;
export const FILE_HEADER_LEN = 58;
const TEXT_HEADER_LEN = 4 + 1 + 4 + 16 + 12 + 16;
const TAG = 16;

const TEXT_MAGIC = [0x53, 0x54, 0x58, 0x54]; // STXT
const FILE_MAGIC = [0x53, 0x54, 0x52, 0x46]; // STRF

export class DecryptError extends Error {
  kind: "format" | "password" | "corrupt";
  constructor(kind: "format" | "password" | "corrupt", message: string) {
    super(message);
    this.kind = kind;
    this.name = "DecryptError";
  }
}

const enc = new TextEncoder();
const subtle = () => globalThis.crypto.subtle;

function rand(n: number) {
  return globalThis.crypto.getRandomValues(new Uint8Array(n));
}

/** Copies into a fresh ArrayBuffer-backed view (WebCrypto typings reject SharedArrayBuffer views). */
const ab = (u: Uint8Array): Uint8Array<ArrayBuffer> => {
  const out = new Uint8Array(u.length);
  out.set(u);
  return out;
};

export async function deriveKeys(password: string, salt: Uint8Array, iterations: number) {
  const base = await subtle().importKey("raw", ab(enc.encode(password)), "PBKDF2", false, ["deriveBits"]);
  const master = await subtle().deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: ab(salt), iterations }, base, 256);
  const hk = await subtle().importKey("raw", master, "HKDF", false, ["deriveBits", "deriveKey"]);
  const key = await subtle().deriveKey(
    { name: "HKDF", hash: "SHA-256", salt: new Uint8Array(0), info: ab(enc.encode("stratum enc key")) },
    hk,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
  const check = new Uint8Array(
    await subtle().deriveBits({ name: "HKDF", hash: "SHA-256", salt: new Uint8Array(0), info: ab(enc.encode("stratum enc check")) }, hk, 128),
  );
  return { key, check };
}

function equalBytes(a: Uint8Array, b: Uint8Array) {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a[i] ^ b[i];
  return d === 0;
}

function checkIterations(n: number) {
  if (n < MIN_ITERATIONS || n > MAX_ITERATIONS) throw new DecryptError("format", "The key-derivation settings in this data are outside the supported range.");
}

/* ------------------------------------------------------------------ */
/* Text                                                                */
/* ------------------------------------------------------------------ */

export async function encryptBytes(plain: Uint8Array, password: string, iterations = PBKDF2_ITERATIONS): Promise<Uint8Array> {
  const salt = rand(16);
  const iv = rand(12);
  const { key, check } = await deriveKeys(password, salt, iterations);
  const header = new Uint8Array(TEXT_HEADER_LEN);
  header.set(TEXT_MAGIC, 0);
  header[4] = 1;
  new DataView(header.buffer).setUint32(5, iterations, false);
  header.set(salt, 9);
  header.set(iv, 25);
  header.set(check, 37);
  const ct = new Uint8Array(await subtle().encrypt({ name: "AES-GCM", iv, additionalData: header }, key, ab(plain)));
  const out = new Uint8Array(header.length + ct.length);
  out.set(header);
  out.set(ct, header.length);
  return out;
}

export async function decryptBytes(data: Uint8Array, password: string): Promise<Uint8Array> {
  if (data.length < TEXT_HEADER_LEN + TAG || !TEXT_MAGIC.every((b, i) => data[i] === b))
    throw new DecryptError("format", "This is not text encrypted by this tool (the header is missing or incomplete).");
  if (data[4] !== 1) throw new DecryptError("format", `Unsupported format version ${data[4]}.`);
  const header = data.slice(0, TEXT_HEADER_LEN);
  const iterations = new DataView(header.buffer).getUint32(5, false);
  checkIterations(iterations);
  const { key, check } = await deriveKeys(password, header.slice(9, 25), iterations);
  if (!equalBytes(check, header.slice(37, 53))) throw new DecryptError("password", "Wrong password.");
  try {
    return new Uint8Array(
      await subtle().decrypt({ name: "AES-GCM", iv: header.slice(25, 37), additionalData: header }, key, ab(data.subarray(TEXT_HEADER_LEN))),
    );
  } catch {
    throw new DecryptError("corrupt", "The password is right, but the encrypted text was changed or truncated, so it failed the integrity check.");
  }
}

/* ------------------------------------------------------------------ */
/* Files (chunked stream)                                              */
/* ------------------------------------------------------------------ */

function chunkIv(baseIv: Uint8Array, i: number) {
  const iv = baseIv.slice();
  const dv = new DataView(iv.buffer);
  dv.setUint32(8, (dv.getUint32(8, false) ^ i) >>> 0, false);
  return iv;
}

function chunkAad(header: Uint8Array, i: number, final: boolean) {
  const aad = new Uint8Array(header.length + 5);
  aad.set(header);
  new DataView(aad.buffer).setUint32(header.length, i, false);
  aad[header.length + 4] = final ? 1 : 0;
  return aad;
}

type Progress = { onProgress?: (done: number, total: number) => void; signal?: AbortSignal };

function aborted(signal?: AbortSignal) {
  if (signal?.aborted) throw new DOMException("Cancelled", "AbortError");
}

/** Encrypts a Blob into an array of parts (header + chunks) suitable for `new Blob(parts)`. */
export async function encryptBlob(
  blob: Blob,
  password: string,
  opts: Progress & { chunkSize?: number; iterations?: number } = {},
): Promise<Uint8Array[]> {
  const chunkSize = opts.chunkSize ?? FILE_CHUNK_SIZE;
  const iterations = opts.iterations ?? PBKDF2_ITERATIONS;
  const salt = rand(16);
  const baseIv = rand(12);
  const { key, check } = await deriveKeys(password, salt, iterations);
  const header = new Uint8Array(FILE_HEADER_LEN);
  const dv = new DataView(header.buffer);
  header.set(FILE_MAGIC, 0);
  header[4] = 1;
  header[5] = 0;
  dv.setUint32(6, iterations, false);
  header.set(salt, 10);
  header.set(baseIv, 26);
  dv.setUint32(38, chunkSize, false);
  header.set(check, 42);
  const parts: Uint8Array[] = [header];
  const n = Math.max(1, Math.ceil(blob.size / chunkSize));
  if (n > 0xffffffff) throw new Error("File too large for this format.");
  for (let i = 0; i < n; i++) {
    aborted(opts.signal);
    const start = i * chunkSize;
    const plain = new Uint8Array(await blob.slice(start, Math.min(blob.size, start + chunkSize)).arrayBuffer());
    const final = i === n - 1;
    const ct = await subtle().encrypt({ name: "AES-GCM", iv: chunkIv(baseIv, i), additionalData: chunkAad(header, i, final) }, key, plain);
    parts.push(new Uint8Array(ct));
    opts.onProgress?.(Math.min(blob.size, start + chunkSize), blob.size);
  }
  return parts;
}

export async function readFileHeader(blob: Blob) {
  if (blob.size < FILE_HEADER_LEN + TAG) throw new DecryptError("format", "This file is too small to be encrypted by this tool.");
  const header = new Uint8Array(await blob.slice(0, FILE_HEADER_LEN).arrayBuffer());
  if (!FILE_MAGIC.every((b, i) => header[i] === b)) throw new DecryptError("format", "This file was not encrypted by this tool (its header does not match).");
  if (header[4] !== 1) throw new DecryptError("format", `Unsupported format version ${header[4]}.`);
  const dv = new DataView(header.buffer);
  const iterations = dv.getUint32(6, false);
  const chunkSize = dv.getUint32(38, false);
  checkIterations(iterations);
  if (chunkSize < 1024 || chunkSize > 64 * 1024 * 1024) throw new DecryptError("format", "The chunk size in the header is invalid.");
  return { header, iterations, chunkSize, salt: header.slice(10, 26), baseIv: header.slice(26, 38), check: header.slice(42, 58) };
}

export async function decryptBlob(blob: Blob, password: string, opts: Progress = {}): Promise<Uint8Array[]> {
  const h = await readFileHeader(blob);
  const { key, check } = await deriveKeys(password, h.salt, h.iterations);
  if (!equalBytes(check, h.check)) throw new DecryptError("password", "Wrong password.");
  const body = blob.size - FILE_HEADER_LEN;
  const full = h.chunkSize + TAG;
  const n = Math.max(1, Math.ceil(body / full));
  const lastLen = body - (n - 1) * full;
  if (lastLen < TAG) throw new DecryptError("corrupt", "The file is truncated or damaged.");
  const parts: Uint8Array[] = [];
  for (let i = 0; i < n; i++) {
    aborted(opts.signal);
    const start = FILE_HEADER_LEN + i * full;
    const end = Math.min(blob.size, start + full);
    const ct = new Uint8Array(await blob.slice(start, end).arrayBuffer());
    const final = i === n - 1;
    try {
      const pt = await subtle().decrypt({ name: "AES-GCM", iv: chunkIv(h.baseIv, i), additionalData: chunkAad(h.header, i, final) }, key, ct);
      parts.push(new Uint8Array(pt));
    } catch {
      throw new DecryptError(
        "corrupt",
        `The password is right, but part ${i + 1} of ${n} failed the integrity check. The file was changed, truncated or damaged.`,
      );
    }
    opts.onProgress?.(end - FILE_HEADER_LEN, body);
  }
  return parts;
}

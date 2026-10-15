/**
 * Incremental hash functions in plain TypeScript so very large files can be
 * hashed chunk by chunk (WebCrypto's digest() needs the whole input at once).
 *
 * - MD5 (RFC 1321): broken for security, still used for download checksums.
 * - SHA-1 (FIPS 180-4): collision attacks are practical; avoid for security.
 * - SHA-256, SHA-384, SHA-512 (FIPS 180-4).
 *
 * Results are verified against WebCrypto and published test vectors.
 */

export interface Hasher {
  update(data: Uint8Array): this;
  digest(): Uint8Array;
  readonly blockSize: number;
}

export type HashAlgo = "MD5" | "SHA-1" | "SHA-256" | "SHA-384" | "SHA-512";

export const HASH_ALGOS: readonly HashAlgo[] = ["MD5", "SHA-1", "SHA-256", "SHA-384", "SHA-512"];

export const HASH_HEX_LENGTH: Record<HashAlgo, number> = { MD5: 32, "SHA-1": 40, "SHA-256": 64, "SHA-384": 96, "SHA-512": 128 };

/** Shared buffering for 64-byte or 128-byte block hashes. */
abstract class BlockHasher implements Hasher {
  abstract readonly blockSize: number;
  protected buf: Uint8Array;
  protected bufLen = 0;
  protected total = 0; // bytes processed (safe up to 2^53)
  private done = false;

  constructor(blockSize: number) {
    this.buf = new Uint8Array(blockSize);
  }

  protected abstract block(b: Uint8Array, off: number): void;
  protected abstract finish(): Uint8Array;

  update(data: Uint8Array): this {
    if (this.done) throw new Error("Hasher already finalised.");
    const bs = this.blockSize;
    let i = 0;
    this.total += data.length;
    if (this.bufLen > 0) {
      const take = Math.min(bs - this.bufLen, data.length);
      this.buf.set(data.subarray(0, take), this.bufLen);
      this.bufLen += take;
      i = take;
      if (this.bufLen === bs) {
        this.block(this.buf, 0);
        this.bufLen = 0;
      }
    }
    for (; i + bs <= data.length; i += bs) this.block(data, i);
    if (i < data.length) {
      this.buf.set(data.subarray(i), 0);
      this.bufLen = data.length - i;
    }
    return this;
  }

  /** Appends the Merkle-Damgard padding. lengthBytes = 8 (MD5/SHA-1/256) or 16 (SHA-512). */
  protected pad(lengthBytes: number, littleEndian: boolean) {
    const bs = this.blockSize;
    const bitLenHi = Math.floor(this.total / 0x20000000); // total*8 / 2^32
    const bitLenLo = (this.total * 8) >>> 0;
    const padLen = (this.bufLen < bs - lengthBytes ? bs - lengthBytes : 2 * bs - lengthBytes) - this.bufLen;
    const tail = new Uint8Array(padLen + lengthBytes);
    tail[0] = 0x80;
    const dv = new DataView(tail.buffer);
    const end = tail.length;
    if (littleEndian) {
      dv.setUint32(end - 8, bitLenLo, true);
      dv.setUint32(end - 4, bitLenHi, true);
    } else {
      dv.setUint32(end - 8, bitLenHi, false);
      dv.setUint32(end - 4, bitLenLo, false);
    }
    const savedTotal = this.total;
    this.update(tail);
    this.total = savedTotal;
    this.done = true;
  }

  digest(): Uint8Array {
    return this.finish();
  }
}

/* ------------------------------------------------------------------ */
/* MD5                                                                 */
/* ------------------------------------------------------------------ */

const MD5_S = [7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21];
const MD5_K = Array.from({ length: 64 }, (_, i) => Math.floor(Math.abs(Math.sin(i + 1)) * 2 ** 32) >>> 0);

export class Md5 extends BlockHasher {
  readonly blockSize = 64;
  private h = new Int32Array([0x67452301, 0xefcdab89 | 0, 0x98badcfe | 0, 0x10325476]);
  private m = new Int32Array(16);
  constructor() {
    super(64);
  }
  protected block(b: Uint8Array, off: number) {
    const m = this.m;
    for (let i = 0; i < 16; i++) {
      const j = off + i * 4;
      m[i] = b[j] | (b[j + 1] << 8) | (b[j + 2] << 16) | (b[j + 3] << 24);
    }
    let a = this.h[0], bb = this.h[1], c = this.h[2], d = this.h[3];
    for (let i = 0; i < 64; i++) {
      let f: number, g: number;
      if (i < 16) {
        f = (bb & c) | (~bb & d);
        g = i;
      } else if (i < 32) {
        f = (d & bb) | (~d & c);
        g = (5 * i + 1) % 16;
      } else if (i < 48) {
        f = bb ^ c ^ d;
        g = (3 * i + 5) % 16;
      } else {
        f = c ^ (bb | ~d);
        g = (7 * i) % 16;
      }
      const tmp = d;
      d = c;
      c = bb;
      const x = (a + f + MD5_K[i] + m[g]) | 0;
      bb = (bb + ((x << MD5_S[i]) | (x >>> (32 - MD5_S[i])))) | 0;
      a = tmp;
    }
    this.h[0] = (this.h[0] + a) | 0;
    this.h[1] = (this.h[1] + bb) | 0;
    this.h[2] = (this.h[2] + c) | 0;
    this.h[3] = (this.h[3] + d) | 0;
  }
  protected finish() {
    this.pad(8, true);
    const out = new Uint8Array(16);
    const dv = new DataView(out.buffer);
    for (let i = 0; i < 4; i++) dv.setInt32(i * 4, this.h[i], true);
    return out;
  }
}

/* ------------------------------------------------------------------ */
/* SHA-1                                                               */
/* ------------------------------------------------------------------ */

export class Sha1 extends BlockHasher {
  readonly blockSize = 64;
  private h = new Int32Array([0x67452301, 0xefcdab89 | 0, 0x98badcfe | 0, 0x10325476, 0xc3d2e1f0 | 0]);
  private w = new Int32Array(80);
  constructor() {
    super(64);
  }
  protected block(b: Uint8Array, off: number) {
    const w = this.w;
    for (let i = 0; i < 16; i++) {
      const j = off + i * 4;
      w[i] = (b[j] << 24) | (b[j + 1] << 16) | (b[j + 2] << 8) | b[j + 3];
    }
    for (let i = 16; i < 80; i++) {
      const x = w[i - 3] ^ w[i - 8] ^ w[i - 14] ^ w[i - 16];
      w[i] = (x << 1) | (x >>> 31);
    }
    let [a, bb, c, d, e] = this.h;
    for (let i = 0; i < 80; i++) {
      let f: number, k: number;
      if (i < 20) {
        f = (bb & c) | (~bb & d);
        k = 0x5a827999;
      } else if (i < 40) {
        f = bb ^ c ^ d;
        k = 0x6ed9eba1;
      } else if (i < 60) {
        f = (bb & c) | (bb & d) | (c & d);
        k = 0x8f1bbcdc | 0;
      } else {
        f = bb ^ c ^ d;
        k = 0xca62c1d6 | 0;
      }
      const t = (((a << 5) | (a >>> 27)) + f + e + k + w[i]) | 0;
      e = d;
      d = c;
      c = (bb << 30) | (bb >>> 2);
      bb = a;
      a = t;
    }
    this.h[0] = (this.h[0] + a) | 0;
    this.h[1] = (this.h[1] + bb) | 0;
    this.h[2] = (this.h[2] + c) | 0;
    this.h[3] = (this.h[3] + d) | 0;
    this.h[4] = (this.h[4] + e) | 0;
  }
  protected finish() {
    this.pad(8, false);
    const out = new Uint8Array(20);
    const dv = new DataView(out.buffer);
    for (let i = 0; i < 5; i++) dv.setInt32(i * 4, this.h[i], false);
    return out;
  }
}

/* ------------------------------------------------------------------ */
/* SHA-256                                                             */
/* ------------------------------------------------------------------ */

const K256 = new Int32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01,
  0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc,
  0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147,
  0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08,
  0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
  0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

export class Sha256 extends BlockHasher {
  readonly blockSize = 64;
  private h = new Int32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);
  private w = new Int32Array(64);
  constructor() {
    super(64);
  }
  protected block(b: Uint8Array, off: number) {
    const w = this.w;
    for (let i = 0; i < 16; i++) {
      const j = off + i * 4;
      w[i] = (b[j] << 24) | (b[j + 1] << 16) | (b[j + 2] << 8) | b[j + 3];
    }
    for (let i = 16; i < 64; i++) {
      const x = w[i - 15];
      const y = w[i - 2];
      const s0 = ((x >>> 7) | (x << 25)) ^ ((x >>> 18) | (x << 14)) ^ (x >>> 3);
      const s1 = ((y >>> 17) | (y << 15)) ^ ((y >>> 19) | (y << 13)) ^ (y >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
    }
    let a = this.h[0], bb = this.h[1], c = this.h[2], d = this.h[3], e = this.h[4], f = this.h[5], g = this.h[6], h = this.h[7];
    for (let i = 0; i < 64; i++) {
      const S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
      const ch = (e & f) ^ (~e & g);
      const t1 = (h + S1 + ch + K256[i] + w[i]) | 0;
      const S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
      const maj = (a & bb) ^ (a & c) ^ (bb & c);
      const t2 = (S0 + maj) | 0;
      h = g;
      g = f;
      f = e;
      e = (d + t1) | 0;
      d = c;
      c = bb;
      bb = a;
      a = (t1 + t2) | 0;
    }
    const H = this.h;
    H[0] = (H[0] + a) | 0;
    H[1] = (H[1] + bb) | 0;
    H[2] = (H[2] + c) | 0;
    H[3] = (H[3] + d) | 0;
    H[4] = (H[4] + e) | 0;
    H[5] = (H[5] + f) | 0;
    H[6] = (H[6] + g) | 0;
    H[7] = (H[7] + h) | 0;
  }
  protected finish() {
    this.pad(8, false);
    const out = new Uint8Array(32);
    const dv = new DataView(out.buffer);
    for (let i = 0; i < 8; i++) dv.setInt32(i * 4, this.h[i], false);
    return out;
  }
}

/* ------------------------------------------------------------------ */
/* SHA-512 / SHA-384 (64-bit words as hi/lo 32-bit pairs)             */
/* ------------------------------------------------------------------ */

const K512 = [
  "428a2f98d728ae22", "7137449123ef65cd", "b5c0fbcfec4d3b2f", "e9b5dba58189dbbc", "3956c25bf348b538", "59f111f1b605d019",
  "923f82a4af194f9b", "ab1c5ed5da6d8118", "d807aa98a3030242", "12835b0145706fbe", "243185be4ee4b28c", "550c7dc3d5ffb4e2",
  "72be5d74f27b896f", "80deb1fe3b1696b1", "9bdc06a725c71235", "c19bf174cf692694", "e49b69c19ef14ad2", "efbe4786384f25e3",
  "0fc19dc68b8cd5b5", "240ca1cc77ac9c65", "2de92c6f592b0275", "4a7484aa6ea6e483", "5cb0a9dcbd41fbd4", "76f988da831153b5",
  "983e5152ee66dfab", "a831c66d2db43210", "b00327c898fb213f", "bf597fc7beef0ee4", "c6e00bf33da88fc2", "d5a79147930aa725",
  "06ca6351e003826f", "142929670a0e6e70", "27b70a8546d22ffc", "2e1b21385c26c926", "4d2c6dfc5ac42aed", "53380d139d95b3df",
  "650a73548baf63de", "766a0abb3c77b2a8", "81c2c92e47edaee6", "92722c851482353b", "a2bfe8a14cf10364", "a81a664bbc423001",
  "c24b8b70d0f89791", "c76c51a30654be30", "d192e819d6ef5218", "d69906245565a910", "f40e35855771202a", "106aa07032bbd1b8",
  "19a4c116b8d2d0c8", "1e376c085141ab53", "2748774cdf8eeb99", "34b0bcb5e19b48a8", "391c0cb3c5c95a63", "4ed8aa4ae3418acb",
  "5b9cca4f7763e373", "682e6ff3d6b2b8a3", "748f82ee5defb2fc", "78a5636f43172f60", "84c87814a1f0ab72", "8cc702081a6439ec",
  "90befffa23631e28", "a4506cebde82bde9", "bef9a3f7b2c67915", "c67178f2e372532b", "ca273eceea26619c", "d186b8c721c0c207",
  "eada7dd6cde0eb1e", "f57d4f7fee6ed178", "06f067aa72176fba", "0a637dc5a2c898a6", "113f9804bef90dae", "1b710b35131c471b",
  "28db77f523047d84", "32caab7b40c72493", "3c9ebe0a15c9bebc", "431d67c49c100d4c", "4cc5d4becb3e42b6", "597f299cfc657e2a",
  "5fcb6fab3ad6faec", "6c44198c4a475817",
];
const K512_HI = new Int32Array(K512.map((h) => parseInt(h.slice(0, 8), 16) | 0));
const K512_LO = new Int32Array(K512.map((h) => parseInt(h.slice(8), 16) | 0));

const IV512 = ["6a09e667f3bcc908", "bb67ae8584caa73b", "3c6ef372fe94f82b", "a54ff53a5f1d36f1", "510e527fade682d1", "9b05688c2b3e6c1f", "1f83d9abfb41bd6b", "5be0cd19137e2179"];
const IV384 = ["cbbb9d5dc1059ed8", "629a292a367cd507", "9159015a3070dd17", "152fecd8f70e5939", "67332667ffc00b31", "8eb44a8768581511", "db0c2e0d64f98fa7", "47b5481dbefa4fa4"];

export class Sha512 extends BlockHasher {
  readonly blockSize = 128;
  private hh: Int32Array;
  private hl: Int32Array;
  private wh = new Int32Array(80);
  private wl = new Int32Array(80);
  private outLen: number;
  constructor(variant: 384 | 512 = 512) {
    super(128);
    const iv = variant === 384 ? IV384 : IV512;
    this.hh = new Int32Array(iv.map((h) => parseInt(h.slice(0, 8), 16) | 0));
    this.hl = new Int32Array(iv.map((h) => parseInt(h.slice(8), 16) | 0));
    this.outLen = variant / 8;
  }
  protected block(b: Uint8Array, off: number) {
    const wh = this.wh, wl = this.wl;
    for (let i = 0; i < 16; i++) {
      const j = off + i * 8;
      wh[i] = (b[j] << 24) | (b[j + 1] << 16) | (b[j + 2] << 8) | b[j + 3];
      wl[i] = (b[j + 4] << 24) | (b[j + 5] << 16) | (b[j + 6] << 8) | b[j + 7];
    }
    for (let i = 16; i < 80; i++) {
      // sigma0 = rotr1 ^ rotr8 ^ shr7 of w[i-15]
      let xh = wh[i - 15], xl = wl[i - 15];
      const s0h = ((xh >>> 1) | (xl << 31)) ^ ((xh >>> 8) | (xl << 24)) ^ (xh >>> 7);
      const s0l = ((xl >>> 1) | (xh << 31)) ^ ((xl >>> 8) | (xh << 24)) ^ ((xl >>> 7) | (xh << 25));
      // sigma1 = rotr19 ^ rotr61 ^ shr6 of w[i-2]
      xh = wh[i - 2];
      xl = wl[i - 2];
      const s1h = ((xh >>> 19) | (xl << 13)) ^ ((xl >>> 29) | (xh << 3)) ^ (xh >>> 6);
      const s1l = ((xl >>> 19) | (xh << 13)) ^ ((xh >>> 29) | (xl << 3)) ^ ((xl >>> 6) | (xh << 26));
      let lo = (wl[i - 16] >>> 0) + (s0l >>> 0) + (wl[i - 7] >>> 0) + (s1l >>> 0);
      const hi = wh[i - 16] + s0h + wh[i - 7] + s1h + Math.floor(lo / 0x100000000);
      lo = lo >>> 0;
      wh[i] = hi | 0;
      wl[i] = lo | 0;
    }
    let ah = this.hh[0], al = this.hl[0], bh = this.hh[1], bl = this.hl[1], ch = this.hh[2], cl = this.hl[2], dh = this.hh[3], dl = this.hl[3];
    let eh = this.hh[4], el = this.hl[4], fh = this.hh[5], fl = this.hl[5], gh = this.hh[6], gl = this.hl[6], hh = this.hh[7], hl = this.hl[7];
    for (let i = 0; i < 80; i++) {
      // Sigma1(e) = rotr14 ^ rotr18 ^ rotr41
      const S1h = ((eh >>> 14) | (el << 18)) ^ ((eh >>> 18) | (el << 14)) ^ ((el >>> 9) | (eh << 23));
      const S1l = ((el >>> 14) | (eh << 18)) ^ ((el >>> 18) | (eh << 14)) ^ ((eh >>> 9) | (el << 23));
      const chh = (eh & fh) ^ (~eh & gh);
      const chl = (el & fl) ^ (~el & gl);
      let t1l = (hl >>> 0) + (S1l >>> 0) + (chl >>> 0) + (K512_LO[i] >>> 0) + (this.wl[i] >>> 0);
      const t1h = (hh + S1h + chh + K512_HI[i] + this.wh[i] + Math.floor(t1l / 0x100000000)) | 0;
      t1l = t1l >>> 0;
      // Sigma0(a) = rotr28 ^ rotr34 ^ rotr39
      const S0h = ((ah >>> 28) | (al << 4)) ^ ((al >>> 2) | (ah << 30)) ^ ((al >>> 7) | (ah << 25));
      const S0l = ((al >>> 28) | (ah << 4)) ^ ((ah >>> 2) | (al << 30)) ^ ((ah >>> 7) | (al << 25));
      const majh = (ah & bh) ^ (ah & ch) ^ (bh & ch);
      const majl = (al & bl) ^ (al & cl) ^ (bl & cl);
      let t2l = (S0l >>> 0) + (majl >>> 0);
      const t2h = (S0h + majh + Math.floor(t2l / 0x100000000)) | 0;
      t2l = t2l >>> 0;
      hh = gh; hl = gl;
      gh = fh; gl = fl;
      fh = eh; fl = el;
      let nl = (dl >>> 0) + t1l;
      eh = (dh + t1h + Math.floor(nl / 0x100000000)) | 0;
      el = nl | 0;
      dh = ch; dl = cl;
      ch = bh; cl = bl;
      bh = ah; bl = al;
      nl = t1l + t2l;
      ah = (t1h + t2h + Math.floor(nl / 0x100000000)) | 0;
      al = nl | 0;
    }
    const add = (i: number, h: number, l: number) => {
      const s = (this.hl[i] >>> 0) + (l >>> 0);
      this.hh[i] = (this.hh[i] + h + Math.floor(s / 0x100000000)) | 0;
      this.hl[i] = s | 0;
    };
    add(0, ah, al);
    add(1, bh, bl);
    add(2, ch, cl);
    add(3, dh, dl);
    add(4, eh, el);
    add(5, fh, fl);
    add(6, gh, gl);
    add(7, hh, hl);
  }
  protected finish() {
    this.pad(16, false);
    const full = new Uint8Array(64);
    const dv = new DataView(full.buffer);
    for (let i = 0; i < 8; i++) {
      dv.setInt32(i * 8, this.hh[i], false);
      dv.setInt32(i * 8 + 4, this.hl[i], false);
    }
    return full.slice(0, this.outLen);
  }
}

export function createHasher(algo: HashAlgo): Hasher {
  switch (algo) {
    case "MD5":
      return new Md5();
    case "SHA-1":
      return new Sha1();
    case "SHA-256":
      return new Sha256();
    case "SHA-384":
      return new Sha512(384);
    case "SHA-512":
      return new Sha512(512);
  }
}

export function hashBytes(algo: HashAlgo, data: Uint8Array): Uint8Array {
  return createHasher(algo).update(data).digest();
}

/** HMAC (RFC 2104) over any of the hashers above. */
export function hmac(algo: HashAlgo, key: Uint8Array, data: Uint8Array): Uint8Array {
  const bs = createHasher(algo).blockSize;
  let k = key.length > bs ? hashBytes(algo, key) : key;
  const padded = new Uint8Array(bs);
  padded.set(k);
  k = padded;
  const ipad = k.map((x) => x ^ 0x36);
  const opad = k.map((x) => x ^ 0x5c);
  const inner = createHasher(algo).update(ipad).update(data).digest();
  return createHasher(algo).update(opad).update(inner).digest();
}

/**
 * Hashes a Blob in chunks with several algorithms at once, reporting progress
 * and yielding to the event loop between chunks. Abort with the signal.
 */
export async function hashBlob(
  blob: Blob,
  algos: readonly HashAlgo[],
  opts: { chunkSize?: number; onProgress?: (done: number, total: number) => void; signal?: AbortSignal } = {},
): Promise<Record<HashAlgo, Uint8Array>> {
  const chunk = opts.chunkSize ?? 4 * 1024 * 1024;
  const hashers = algos.map((a) => [a, createHasher(a)] as const);
  for (let off = 0; off < blob.size; off += chunk) {
    if (opts.signal?.aborted) throw new DOMException("Cancelled", "AbortError");
    const bytes = new Uint8Array(await blob.slice(off, Math.min(blob.size, off + chunk)).arrayBuffer());
    for (const [, h] of hashers) h.update(bytes);
    opts.onProgress?.(Math.min(blob.size, off + chunk), blob.size);
  }
  if (opts.signal?.aborted) throw new DOMException("Cancelled", "AbortError");
  const out = {} as Record<HashAlgo, Uint8Array>;
  for (const [a, h] of hashers) out[a] = h.digest();
  return out;
}

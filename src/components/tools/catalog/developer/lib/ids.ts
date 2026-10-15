/**
 * UUID v4 / v7 (RFC 9562) and ULID generation plus inspection.
 * Uses Web Crypto (available in browsers and Node 19+). No BigInt literals
 * so the code compiles for the project's ES2017 target.
 */

type RandomFill = (buf: Uint8Array) => Uint8Array;

const defaultRandom: RandomFill = (buf) => {
  crypto.getRandomValues(buf);
  return buf;
};

const HEX: string[] = Array.from({ length: 256 }, (_, i) => i.toString(16).padStart(2, "0"));

export function bytesToUuid(b: Uint8Array): string {
  let s = "";
  for (let i = 0; i < 16; i++) {
    s += HEX[b[i]];
    if (i === 3 || i === 5 || i === 7 || i === 9) s += "-";
  }
  return s;
}

export function uuidV4(random: RandomFill = defaultRandom): string {
  if (random === defaultRandom && typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  const b = random(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  return bytesToUuid(b);
}

/**
 * UUID v7 generator. 48-bit Unix ms timestamp, 4-bit version, 12-bit rand_a,
 * 2-bit variant, 62-bit rand_b. With `monotonic`, values created in the same
 * millisecond reuse the timestamp and increment the 74 random bits by one
 * (RFC 9562 section 6.2, method 2), so they sort in creation order.
 */
export class UuidV7Generator {
  private lastMs = -1;
  private last: Uint8Array | null = null;
  private random: RandomFill;
  constructor(random: RandomFill = defaultRandom) {
    this.random = random;
  }

  next(now: number = Date.now(), monotonic = true): string {
    let ms = Math.floor(now);
    let b: Uint8Array;
    if (monotonic && this.last && ms <= this.lastMs) {
      ms = this.lastMs;
      b = this.last.slice();
      // increment the 74 random bits (byte 6 low nibble .. byte 15, skipping variant bits of byte 8)
      if (!incrementV7(b)) {
        ms = this.lastMs + 1;
        b = this.fresh(ms);
      }
    } else {
      b = this.fresh(ms);
    }
    this.lastMs = ms;
    this.last = b;
    return bytesToUuid(b);
  }

  private fresh(ms: number): Uint8Array {
    const b = this.random(new Uint8Array(16));
    writeMs48(b, ms);
    b[6] = (b[6] & 0x0f) | 0x70;
    b[8] = (b[8] & 0x3f) | 0x80;
    // leave headroom for increments: clear the top random bit of rand_a
    b[6] &= 0x77;
    return b;
  }
}

function writeMs48(b: Uint8Array, ms: number) {
  const hi = Math.floor(ms / 0x100000000);
  const lo = ms >>> 0;
  b[0] = (hi >>> 8) & 0xff;
  b[1] = hi & 0xff;
  b[2] = (lo >>> 24) & 0xff;
  b[3] = (lo >>> 16) & 0xff;
  b[4] = (lo >>> 8) & 0xff;
  b[5] = lo & 0xff;
}

function readMs48(b: Uint8Array): number {
  return (b[0] * 256 + b[1]) * 0x100000000 + ((b[2] << 24) >>> 0) + (b[3] << 16) + (b[4] << 8) + b[5];
}

/** Adds 1 to the 74-bit random field of a v7 UUID in place. Returns false on overflow. */
function incrementV7(b: Uint8Array): boolean {
  for (let i = 15; i >= 9; i--) {
    if (b[i] < 0xff) {
      b[i]++;
      return true;
    }
    b[i] = 0;
  }
  // byte 8: 6 random bits below the variant
  if ((b[8] & 0x3f) < 0x3f) {
    b[8]++;
    return true;
  }
  b[8] &= 0xc0;
  if (b[7] < 0xff) {
    b[7]++;
    return true;
  }
  b[7] = 0;
  if ((b[6] & 0x0f) < 0x0f) {
    b[6]++;
    return true;
  }
  return false;
}

/* ------------------------------------------------------------------ */
/* ULID                                                                */
/* ------------------------------------------------------------------ */

export const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

function encodeTime(ms: number): string {
  let s = "";
  let t = ms;
  for (let i = 0; i < 10; i++) {
    const mod = t % 32;
    s = CROCKFORD[mod] + s;
    t = (t - mod) / 32;
  }
  return s;
}

/** 80 random bits as 16 base32 digits (each digit holds 5 bits). */
function randomDigits(random: RandomFill): number[] {
  const bytes = random(new Uint8Array(16));
  return Array.from({ length: 16 }, (_, i) => bytes[i] & 31);
}

export class UlidGenerator {
  private lastMs = -1;
  private lastRand: number[] | null = null;
  private random: RandomFill;
  constructor(random: RandomFill = defaultRandom) {
    this.random = random;
  }

  next(now: number = Date.now(), monotonic = true): string {
    let ms = Math.floor(now);
    if (ms < 0 || ms > 281474976710655) throw new Error("Timestamp is outside the ULID range.");
    let rand: number[];
    if (monotonic && this.lastRand && ms <= this.lastMs) {
      ms = this.lastMs;
      rand = this.lastRand.slice();
      let i = 15;
      while (i >= 0 && rand[i] === 31) {
        rand[i] = 0;
        i--;
      }
      if (i < 0) throw new Error("ULID random component overflowed within one millisecond.");
      rand[i]++;
    } else {
      rand = randomDigits(this.random);
    }
    this.lastMs = ms;
    this.lastRand = rand;
    return encodeTime(ms) + rand.map((d) => CROCKFORD[d]).join("");
  }
}

/* ------------------------------------------------------------------ */
/* Inspection                                                          */
/* ------------------------------------------------------------------ */

export interface IdInfo {
  kind: "uuid" | "ulid";
  valid: boolean;
  normalized?: string;
  version?: number;
  variant?: string;
  timestamp?: Date;
  notes: string[];
  error?: string;
}

const RE_UUID = /^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i;

export function inspectId(raw: string): IdInfo {
  let s = raw.trim();
  if (/^\{.*\}$/.test(s)) s = s.slice(1, -1);
  if (/^urn:uuid:/i.test(s)) s = s.slice(9);
  if (RE_UUID.test(s)) return inspectUuid(s);
  if (/^[0-9A-HJKMNP-TV-Z]{26}$/i.test(s)) return inspectUlid(s);
  if (s.length === 26) {
    return { kind: "ulid", valid: false, notes: [], error: "26 characters, but it contains letters outside Crockford base32 (I, L, O and U are not used)." };
  }
  return {
    kind: "uuid",
    valid: false,
    notes: [],
    error: "Not a UUID (32 hex digits, usually as 8-4-4-4-12) or a ULID (26 Crockford base32 characters).",
  };
}

function inspectUuid(s: string): IdInfo {
  const hex = s.replace(/-/g, "").toLowerCase();
  const b = new Uint8Array(16);
  for (let i = 0; i < 16; i++) b[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  const normalized = bytesToUuid(b);
  const notes: string[] = [];
  if (hex === "0".repeat(32)) return { kind: "uuid", valid: true, normalized, notes: ["Nil UUID (all zeros)."] };
  if (hex === "f".repeat(32)) return { kind: "uuid", valid: true, normalized, notes: ["Max UUID (all ones), defined in RFC 9562."] };
  const version = b[6] >> 4;
  const v = b[8] >> 4;
  const variant = v < 8 ? "NCS (reserved)" : v < 12 ? "RFC 9562 / RFC 4122" : v < 14 ? "Microsoft (reserved)" : "Future (reserved)";
  let timestamp: Date | undefined;
  if (variant.startsWith("RFC")) {
    if (version === 7) {
      timestamp = new Date(readMs48(b));
      notes.push("Version 7: the first 48 bits are a Unix timestamp in milliseconds, so these sort by creation time.");
    } else if (version === 1 || version === 6) {
      // 60-bit count of 100 ns intervals since 1582-10-15
      let ticks: number;
      if (version === 1) {
        const th = ((b[6] & 0x0f) << 8) | b[7];
        const low = ((b[0] << 24) >>> 0) + (b[1] << 16) + (b[2] << 8) + b[3];
        const mid = (b[4] << 8) | b[5];
        ticks = th * 2 ** 48 + mid * 2 ** 32 + low;
      } else {
        const high = ((b[0] << 24) >>> 0) + (b[1] << 16) + (b[2] << 8) + b[3];
        const mid = (b[4] << 8) | b[5];
        const low = ((b[6] & 0x0f) << 8) | b[7];
        ticks = high * 2 ** 28 + mid * 2 ** 12 + low;
      }
      const GREGORIAN_OFFSET_MS = 12219292800000;
      timestamp = new Date(ticks / 10000 - GREGORIAN_OFFSET_MS);
      notes.push(`Version ${version}: a 60-bit timestamp in 100 ns steps since 1582-10-15. Precision is shown to the millisecond.`);
      if (version === 1) notes.push("Version 1 may embed a MAC address in the node field.");
    } else if (version === 4) notes.push("Version 4: 122 random bits. It carries no timestamp.");
    else if (version === 3 || version === 5) notes.push(`Version ${version}: a name-based hash (${version === 3 ? "MD5" : "SHA-1"}). It carries no timestamp.`);
    else if (version === 8) notes.push("Version 8: custom, vendor-specific layout.");
    else if (version === 2) notes.push("Version 2: DCE security UUID, rarely used.");
    else notes.push(`Version nibble ${version} is not defined by RFC 9562.`);
  }
  return { kind: "uuid", valid: true, normalized, version, variant, timestamp, notes };
}

function inspectUlid(s: string): IdInfo {
  const up = s.toUpperCase();
  if (CROCKFORD.indexOf(up[0]) > 7) {
    return { kind: "ulid", valid: false, notes: [], error: "The first character must be 0 to 7. Larger values overflow the 48-bit timestamp." };
  }
  let ms = 0;
  for (let i = 0; i < 10; i++) ms = ms * 32 + CROCKFORD.indexOf(up[i]);
  return {
    kind: "ulid",
    valid: true,
    normalized: up,
    timestamp: new Date(ms),
    notes: ["ULID: 48-bit millisecond timestamp (first 10 characters) and 80 random bits (last 16)."],
  };
}

export function formatUuid(u: string, o: { upper: boolean; hyphens: boolean; braces: boolean }) {
  let s = o.hyphens ? u : u.replace(/-/g, "");
  if (o.upper) s = s.toUpperCase();
  if (o.braces) s = `{${s}}`;
  return s;
}

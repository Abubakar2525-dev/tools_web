/** Byte encodings used across the security tools. Pure functions, no DOM. */

export const utf8 = (s: string) => new TextEncoder().encode(s);
export const fromUtf8 = (b: Uint8Array) => new TextDecoder("utf-8", { fatal: true }).decode(b);

export function toHex(b: Uint8Array): string {
  let s = "";
  for (let i = 0; i < b.length; i++) s += b[i].toString(16).padStart(2, "0");
  return s;
}

export function fromHex(hex: string): Uint8Array {
  const h = hex.replace(/\s+/g, "");
  if (h.length % 2 !== 0 || /[^0-9a-f]/i.test(h)) throw new Error("Not valid hexadecimal.");
  const out = new Uint8Array(h.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(h.slice(i * 2, i * 2 + 2), 16);
  return out;
}

const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

export function toBase64(b: Uint8Array): string {
  let s = "";
  let i = 0;
  for (; i + 2 < b.length; i += 3) {
    const n = (b[i] << 16) | (b[i + 1] << 8) | b[i + 2];
    s += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + B64[(n >> 6) & 63] + B64[n & 63];
  }
  const rem = b.length - i;
  if (rem === 1) {
    const n = b[i] << 16;
    s += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + "==";
  } else if (rem === 2) {
    const n = (b[i] << 16) | (b[i + 1] << 8);
    s += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + B64[(n >> 6) & 63] + "=";
  }
  return s;
}

export const toBase64Url = (b: Uint8Array) => toBase64(b).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

/** Decodes standard or URL-safe Base64; whitespace and missing padding are tolerated. */
export function fromBase64(input: string): Uint8Array {
  const s = input.replace(/\s+/g, "").replace(/-/g, "+").replace(/_/g, "/").replace(/=+$/, "");
  if (/[^A-Za-z0-9+/]/.test(s) || s.length % 4 === 1) throw new Error("Not valid Base64.");
  const out = new Uint8Array(Math.floor((s.length * 3) / 4));
  let o = 0;
  for (let i = 0; i < s.length; i += 4) {
    const c = [0, 1, 2, 3].map((k) => (i + k < s.length ? B64.indexOf(s[i + k]) : -1));
    const n = (c[0] << 18) | (c[1] << 12) | (Math.max(c[2], 0) << 6) | Math.max(c[3], 0);
    out[o++] = (n >> 16) & 255;
    if (c[2] >= 0) out[o++] = (n >> 8) & 255;
    if (c[3] >= 0) out[o++] = n & 255;
  }
  return out.subarray(0, o);
}

/* ------------------------------------------------------------------ */
/* Base32 (RFC 4648), used by TOTP secrets                             */
/* ------------------------------------------------------------------ */

const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

/** Normalises user input: uppercase, no spaces/dashes, no padding. */
export const normalizeBase32 = (s: string) => s.toUpperCase().replace(/[\s-]/g, "").replace(/=+$/, "");

export function base32Error(input: string): string | null {
  const s = normalizeBase32(input);
  if (!s) return "Enter a Base32 secret.";
  const bad = s.match(/[^A-Z2-7]/);
  if (bad) return `"${bad[0]}" is not a Base32 character. Only A to Z and 2 to 7 are allowed.`;
  if ([1, 3, 6].includes(s.length % 8)) return "This secret has an impossible length for Base32. Check for a missing or extra character.";
  if (s.length < 16) return "This secret is shorter than 80 bits (16 characters). Some services reject short secrets.";
  return null;
}

export function toBase32(b: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of b) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

export function fromBase32(input: string): Uint8Array {
  const s = normalizeBase32(input);
  const out: number[] = [];
  let bits = 0;
  let value = 0;
  for (const ch of s) {
    const v = B32.indexOf(ch);
    if (v < 0) throw new Error("Not valid Base32.");
    value = (value << 5) | v;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return new Uint8Array(out);
}

/* ------------------------------------------------------------------ */
/* Comparison                                                          */
/* ------------------------------------------------------------------ */

/**
 * Compares two strings without returning early on the first mismatch, so
 * the time taken does not reveal how many leading characters matched.
 */
export function constantTimeEqual(a: string, b: string): boolean {
  const len = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < len; i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}

/** Normalises a pasted hash for comparison: trims, removes spaces/colons, lowercases hex. */
export function normalizeHash(s: string): string {
  const t = s.trim().replace(/^[a-z0-9-]+[:=]\s*/i, (m) => (/^(md5|sha-?\d+)[:=]/i.test(m) ? "" : m));
  // Accept "hash  filename" lines produced by sha256sum.
  const first = t.split(/\s+/)[0] ?? "";
  const hexish = first.replace(/:/g, "");
  return /^[0-9a-f]+$/i.test(hexish) ? hexish.toLowerCase() : first;
}

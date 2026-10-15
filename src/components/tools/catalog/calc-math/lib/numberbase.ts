/** Arbitrary-precision integers in bases 2-36, two's complement and bitwise operations. */

import { B0, B1 } from "./rational";

const DIGITS = "0123456789abcdefghijklmnopqrstuvwxyz";

/** Parses a signed integer in `base` (2-36). Accepts 0x/0b/0o prefixes matching the base, spaces and underscores. */
export function parseInBase(raw: string, base: number): bigint {
  let s = raw.trim().toLowerCase().replace(/[\s_]/g, "").replace(/−/g, "-");
  let negative = false;
  if (s.startsWith("-") || s.startsWith("+")) {
    negative = s[0] === "-";
    s = s.slice(1);
  }
  const prefix: Record<number, string> = { 16: "0x", 2: "0b", 8: "0o" };
  if (prefix[base] && s.startsWith(prefix[base])) s = s.slice(2);
  if (!s) throw new Error("Enter a number.");
  const B = BigInt(base);
  let v = B0;
  for (const ch of s) {
    const d = DIGITS.indexOf(ch);
    if (d < 0 || d >= base) throw new Error(`"${ch}" is not a valid digit in base ${base}.`);
    v = v * B + BigInt(d);
  }
  return negative ? -v : v;
}

export function toBase(v: bigint, base: number, upper = true): string {
  const s = v.toString(base);
  return upper ? s.toUpperCase() : s;
}

/** Inclusive range for a signed two's complement integer of `bits` width. */
export function signedRange(bits: number): [bigint, bigint] {
  const half = B1 << BigInt(bits - 1);
  return [-half, half - B1];
}

export function mask(bits: number): bigint {
  return (B1 << BigInt(bits)) - B1;
}

/** Wraps any integer to `bits` (unsigned pattern), like hardware registers. */
export function wrap(v: bigint, bits: number): bigint {
  return v & mask(bits);
}

/** Interprets an unsigned bit pattern as a signed two's complement value. */
export function toSigned(pattern: bigint, bits: number): bigint {
  const p = wrap(pattern, bits);
  return p & (B1 << BigInt(bits - 1)) ? p - (B1 << BigInt(bits)) : p;
}

/** Two's complement bit string of v at `bits` width, grouped in nibbles. Throws if out of range. */
export function twosComplement(v: bigint, bits: number): string {
  const [lo] = signedRange(bits);
  if (v < lo || v > mask(bits)) throw new Error(`Out of range for ${bits} bits.`);
  return groupBits(wrap(v, bits).toString(2).padStart(bits, "0"));
}

export function groupBits(s: string, size = 4): string {
  const out: string[] = [];
  for (let i = s.length; i > 0; i -= size) out.unshift(s.slice(Math.max(0, i - size), i));
  return out.join(" ");
}

export type BitOp = "and" | "or" | "xor" | "not" | "shl" | "shr" | "ushr" | "add" | "sub" | "mul" | "div" | "mod";

/**
 * Applies an operation. Arithmetic is exact (unbounded) unless `bits` is set, in which case
 * results wrap to the width and are shown signed. NOT and logical right shift need a width.
 */
export function applyOp(op: BitOp, a: bigint, b: bigint, bits: number | null): { value: bigint; note?: string } {
  let v: bigint;
  switch (op) {
    case "add":
      v = a + b;
      break;
    case "sub":
      v = a - b;
      break;
    case "mul":
      v = a * b;
      break;
    case "div":
      if (b === B0) throw new Error("Division by zero.");
      v = a / b; // truncates toward zero
      break;
    case "mod":
      if (b === B0) throw new Error("Division by zero.");
      v = a % b; // sign follows the dividend
      break;
    case "and":
      v = a & b;
      break;
    case "or":
      v = a | b;
      break;
    case "xor":
      v = a ^ b;
      break;
    case "not":
      v = ~a;
      break;
    case "shl":
    case "shr":
    case "ushr": {
      if (b < B0) throw new Error("Shift amount must be 0 or more.");
      if (b > BigInt(4096)) throw new Error("Shift amount is limited to 4096.");
      if (op === "shl") v = a << b;
      else if (op === "shr") v = a >> b;
      else {
        if (bits === null) throw new Error("Logical right shift needs a bit width.");
        v = wrap(a, bits) >> b;
      }
      break;
    }
  }
  if (bits !== null) {
    const wrapped = toSigned(v, bits);
    return { value: wrapped, note: wrapped !== v ? `Result wrapped to ${bits} bits.` : undefined };
  }
  return { value: v };
}

/**
 * Exact number utilities for the converter batch: base conversion (BigInt,
 * fractional parts with repeat detection), Roman numerals, decimal to
 * fraction, and significant-figure aware scientific notation.
 * Pure TypeScript, no React. BigInt literals are avoided (target ES2017).
 */

const B0 = BigInt(0);
const B1 = BigInt(1);
const B10 = BigInt(10);

export const DIGITS = "0123456789abcdefghijklmnopqrstuvwxyz";

export function gcd(a: bigint, b: bigint): bigint {
  a = a < B0 ? -a : a;
  b = b < B0 ? -b : b;
  while (b !== B0) [a, b] = [b, a % b];
  return a;
}

/* ------------------------------------------------------------------ */
/* Base conversion                                                     */
/* ------------------------------------------------------------------ */

export type BaseResult =
  | { ok: true; text: string; repeating: boolean; truncated: boolean; num: bigint; den: bigint; negative: boolean }
  | { ok: false; error: string };

/** Parses "-1a.8" in `base` into an exact rational num/den (den = base^k). */
export function parseInBase(input: string, base: number): { num: bigint; den: bigint; negative: boolean } | string {
  if (!Number.isInteger(base) || base < 2 || base > 36) return "Base must be a whole number from 2 to 36.";
  let s = input.trim().toLowerCase().replace(/[\s_]/g, "");
  if (!s) return "Enter a number.";
  let negative = false;
  if (s[0] === "-" || s[0] === "+") {
    negative = s[0] === "-";
    s = s.slice(1);
  }
  // Common prefixes when they match the chosen base.
  if (base === 16 && s.startsWith("0x")) s = s.slice(2);
  else if (base === 2 && s.startsWith("0b")) s = s.slice(2);
  else if (base === 8 && s.startsWith("0o")) s = s.slice(2);
  const parts = s.split(".");
  if (parts.length > 2) return "Use at most one radix point.";
  const [intPart, fracPart = ""] = parts;
  if (intPart === "" && fracPart === "") return "Enter at least one digit.";
  const B = BigInt(base);
  let num = B0;
  let den = B1;
  for (const ch of intPart + fracPart) {
    const d = DIGITS.indexOf(ch);
    if (d < 0 || d >= base) return `"${ch}" is not a valid digit in base ${base}.`;
    num = num * B + BigInt(d);
  }
  for (let i = 0; i < fracPart.length; i++) den *= B;
  return { num, den, negative };
}

/** Writes num/den in `base`, marking a repeating fraction with parentheses. */
export function rationalToBase(num: bigint, den: bigint, base: number, negative = false, maxFrac = 64): BaseResult {
  if (base < 2 || base > 36) return { ok: false, error: "Base must be from 2 to 36." };
  const B = BigInt(base);
  const intPart = num / den;
  let rem = num % den;
  const intStr = intPart.toString(base);
  if (rem === B0) {
    const zero = intPart === B0;
    return { ok: true, text: (negative && !zero ? "-" : "") + intStr, repeating: false, truncated: false, num, den, negative };
  }
  const seen = new Map<string, number>();
  const digits: string[] = [];
  let repeatAt = -1;
  let truncated = false;
  while (rem !== B0) {
    const key = rem.toString();
    const at = seen.get(key);
    if (at !== undefined) {
      repeatAt = at;
      break;
    }
    if (digits.length >= maxFrac) {
      truncated = true;
      break;
    }
    seen.set(key, digits.length);
    rem *= B;
    digits.push(DIGITS[Number(rem / den)]);
    rem %= den;
  }
  let frac = digits.join("");
  if (repeatAt >= 0) frac = `${frac.slice(0, repeatAt)}(${frac.slice(repeatAt)})`;
  else if (truncated) frac += "…";
  return { ok: true, text: `${negative ? "-" : ""}${intStr}.${frac}`, repeating: repeatAt >= 0, truncated, num, den, negative };
}

export function convertBase(input: string, from: number, to: number, maxFrac = 64): BaseResult {
  const p = parseInBase(input, from);
  if (typeof p === "string") return { ok: false, error: p };
  const g = gcd(p.num, p.den) || B1;
  return rationalToBase(p.num / g, p.den / g, to, p.negative, maxFrac);
}

/* ------------------------------------------------------------------ */
/* Roman numerals                                                      */
/* ------------------------------------------------------------------ */

const ROMAN: [number, string][] = [
  [1000, "M"], [900, "CM"], [500, "D"], [400, "CD"], [100, "C"], [90, "XC"],
  [50, "L"], [40, "XL"], [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"],
];

export function toRoman(n: number): string | null {
  if (!Number.isInteger(n) || n < 1 || n > 3999) return null;
  let out = "";
  for (const [v, s] of ROMAN) {
    while (n >= v) {
      out += s;
      n -= v;
    }
  }
  return out;
}

const CANONICAL = /^M{0,3}(CM|CD|D?C{0,3})(XC|XL|L?X{0,3})(IX|IV|V?I{0,3})$/;
const SYMBOL: Record<string, number> = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };

export type RomanParse =
  | { ok: true; value: number }
  | { ok: false; error: string; lenientValue?: number; suggestion?: string };

/** Strict parser: only canonical standard form (1 to 3999) is accepted. */
export function fromRoman(raw: string): RomanParse {
  const s = raw.trim().toUpperCase();
  if (!s) return { ok: false, error: "Enter a Roman numeral." };
  const bad = s.match(/[^IVXLCDM]/);
  if (bad) return { ok: false, error: `"${bad[0]}" is not a Roman numeral symbol. Use I, V, X, L, C, D and M.` };
  if (CANONICAL.test(s)) {
    let v = 0;
    for (let i = 0; i < s.length; i++) {
      const cur = SYMBOL[s[i]];
      const next = SYMBOL[s[i + 1]] ?? 0;
      v += cur < next ? -cur : cur;
    }
    return { ok: true, value: v };
  }
  // Lenient read so we can explain what the writer probably meant.
  let v = 0;
  for (let i = 0; i < s.length; i++) {
    const cur = SYMBOL[s[i]];
    const next = SYMBOL[s[i + 1]] ?? 0;
    v += cur < next ? -cur : cur;
  }
  const suggestion = toRoman(v) ?? undefined;
  let error = "This is not in standard (canonical) form.";
  if (/(IIII|XXXX|CCCC|MMMM)/.test(s)) error = s.includes("MMMM") ? "Standard form stops at 3999 (MMMCMXCIX). Four M symbols need a vinculum, which is not supported." : "A symbol is repeated four times. Standard form uses subtraction instead (IV, XL, CD).";
  else if (/(VV|LL|DD)/.test(s) || /V.*V|L.*L|D.*D/.test(s)) error = "V, L and D can appear at most once.";
  else if (/I[LCDM]|X[DM]|V[XLCDM]|L[CDM]|DM/.test(s)) error = "Invalid subtraction. Only IV, IX, XL, XC, CD and CM are allowed.";
  else error = "Symbols are out of order for standard form.";
  return { ok: false, error, lenientValue: v > 0 ? v : undefined, suggestion: suggestion && suggestion !== s ? suggestion : undefined };
}

/* ------------------------------------------------------------------ */
/* Decimal to fraction                                                 */
/* ------------------------------------------------------------------ */

export type Fraction = { num: bigint; den: bigint };

export type DecimalParse =
  | { ok: true; frac: Fraction; repeating: string; nonRepeating: string; intPart: string; negative: boolean; inferred: boolean }
  | { ok: false; error: string };

/**
 * Parses "0.75", "-2.125", "0.1(6)", "0.1666…" or "0.1666...". With an
 * ellipsis the shortest trailing block that appears at least twice repeats.
 */
export function parseDecimal(raw: string): DecimalParse {
  let s = raw.trim().replace(/,/g, "").replace(/\s/g, "");
  if (!s) return { ok: false, error: "Enter a decimal number." };
  let negative = false;
  if (s[0] === "-" || s[0] === "+") {
    negative = s[0] === "-";
    s = s.slice(1);
  }
  let ellipsis = false;
  if (s.endsWith("...") || s.endsWith("…")) {
    ellipsis = true;
    s = s.replace(/(\.\.\.|…)$/, "");
  }
  let m = s.match(/^(\d*)(?:\.(\d*)(?:\((\d+)\))?)?$/);
  if (!m || (m[1] === "" && !m[2] && !m[3])) {
    m = null;
  }
  if (!m) return { ok: false, error: 'Use a decimal like 0.375, a repeating block like 0.1(6), or an ellipsis like 0.333….' };
  const intPart = m[1] || "0";
  let nonRepeating = m[2] ?? "";
  let repeating = m[3] ?? "";
  let inferred = false;
  if (ellipsis && !repeating && nonRepeating) {
    const d = nonRepeating;
    for (let p = 1; p <= Math.floor(d.length / 2); p++) {
      const block = d.slice(-p);
      if (d.slice(-2 * p, -p) === block) {
        // Extend left while the block keeps repeating.
        let start = d.length - 2 * p;
        while (start - p >= 0 && d.slice(start - p, start) === block) start -= p;
        nonRepeating = d.slice(0, start);
        repeating = block;
        inferred = true;
        break;
      }
    }
  }
  const n = nonRepeating.length;
  const r = repeating.length;
  let num: bigint;
  let den: bigint;
  if (r === 0) {
    num = BigInt(intPart + nonRepeating);
    den = B10 ** BigInt(n);
  } else {
    const all = BigInt(intPart + nonRepeating + repeating);
    const head = BigInt(intPart + nonRepeating);
    num = all - head;
    den = B10 ** BigInt(n) * (B10 ** BigInt(r) - B1);
  }
  const g = gcd(num, den) || B1;
  num /= g;
  den /= g;
  if (negative) num = -num;
  return { ok: true, frac: { num, den }, repeating, nonRepeating, intPart, negative, inferred };
}

/** Closest fraction with denominator ≤ maxDen (same algorithm as Python's limit_denominator). */
export function limitDenominator(f: Fraction, maxDen: bigint): Fraction {
  if (maxDen < B1) throw new Error("maxDen must be at least 1");
  const neg = f.num < B0;
  const N = neg ? -f.num : f.num;
  const D = f.den;
  if (D <= maxDen) return { num: f.num, den: D };
  let p0 = B0, q0 = B1, p1 = B1, q1 = B0;
  let n = N, d = D;
  for (;;) {
    const a = n / d;
    const q2 = q0 + a * q1;
    if (q2 > maxDen) break;
    [p0, q0, p1, q1] = [p1, q1, p0 + a * p1, q2];
    [n, d] = [d, n - a * d];
    if (d === B0) break;
  }
  const k = (maxDen - q0) / q1;
  const b1n = p0 + k * p1, b1d = q0 + k * q1;
  const b2n = p1, b2d = q1;
  // Compare |b2 - x| <= |b1 - x| exactly.
  const diff = (pn: bigint, pd: bigint) => {
    const v = pn * D - N * pd;
    return { n: v < B0 ? -v : v, d: pd * D };
  };
  const e1 = diff(b1n, b1d);
  const e2 = diff(b2n, b2d);
  const pick = e2.n * e1.d <= e1.n * e2.d ? { num: b2n, den: b2d } : { num: b1n, den: b1d };
  return neg ? { num: -pick.num, den: pick.den } : pick;
}

/** Nearest multiple of 1/den (den = 16, 32, 64...), reduced. */
export function rulerFraction(value: number, den: number): { num: number; den: number; error: number } {
  const n = Math.round(value * den);
  const g = Number(gcd(BigInt(n), BigInt(den))) || 1;
  return { num: n / g, den: den / g, error: n / den - value };
}

export function fractionToNumber(f: Fraction): number {
  return Number(f.num) / Number(f.den);
}

/** "1 3/8" style mixed number (or whole/proper fraction). */
export function mixed(f: { num: bigint | number; den: bigint | number }): string {
  const num = BigInt(f.num);
  const den = BigInt(f.den);
  const neg = num < B0;
  const a = neg ? -num : num;
  const whole = a / den;
  const rem = a % den;
  const sign = neg ? "-" : "";
  if (rem === B0) return `${sign}${whole}`;
  if (whole === B0) return `${sign}${rem}/${den}`;
  return `${sign}${whole} ${rem}/${den}`;
}

/* ------------------------------------------------------------------ */
/* Significant figures and scientific notation                         */
/* ------------------------------------------------------------------ */

/** value = (negative ? -1 : 1) × digits × 10^exp, digits has no leading zeros ("0" for zero). */
export type Dec = { negative: boolean; digits: string; exp: number };

export type SigInfo = {
  dec: Dec;
  /** Count of significant figures by the standard rules. */
  sig: number;
  /** For integers with trailing zeros and no decimal point: the upper bound. */
  sigMax: number;
  ambiguous: boolean;
};

/** Parses "0.004560", "1,200", "1200.", "6.02e23", "-3.0E-4". */
export function parseSig(raw: string): SigInfo | string {
  const s = raw
    .trim()
    .replace(/[,\s_]/g, "")
    .replace(/[×x*·]10\^/i, "e")
    .replace(/[−–]/g, "-");
  const m = s.match(/^([-+]?)(\d*)(\.?)(\d*)(?:[eE]([-+]?\d+))?$/);
  if (!m || (m[2] === "" && m[4] === "")) return "Enter a number such as 0.004560, 1200, or 6.02e23.";
  const negative = m[1] === "-";
  const intStr = m[2];
  const hasPoint = m[3] === ".";
  const fracStr = m[4];
  const e = m[5] ? parseInt(m[5], 10) : 0;
  if (Math.abs(e) > 100000) return "Exponent is too large.";
  const all = intStr + fracStr;
  const stripped = all.replace(/^0+/, "");
  if (stripped === "") {
    // Zero: significant figures are the zeros after the decimal point, at least 1.
    const zs = hasPoint ? Math.max(1, fracStr.length) : 1;
    return { dec: { negative: false, digits: "0", exp: 0 }, sig: zs, sigMax: zs, ambiguous: false };
  }
  const digits = stripped;
  const exp = e - fracStr.length;
  let sig = digits.length;
  let sigMax = sig;
  let ambiguous = false;
  if (!hasPoint && /0$/.test(digits)) {
    // Trailing zeros in a whole number without a decimal point (1200, 1200e3) are ambiguous.
    const trailing = (digits.match(/0+$/) as RegExpMatchArray)[0].length;
    sigMax = sig;
    sig = digits.length - trailing;
    ambiguous = true;
  }
  return { dec: { negative, digits, exp }, sig, sigMax, ambiguous };
}

/** Rounds to n significant figures (round half away from zero), keeping trailing zeros. */
export function roundSig(d: Dec, n: number): Dec {
  if (d.digits === "0") return { negative: false, digits: "0".repeat(Math.max(1, n)), exp: -(Math.max(1, n) - 1) };
  if (d.digits.length <= n) {
    const pad = n - d.digits.length;
    return { negative: d.negative, digits: d.digits + "0".repeat(pad), exp: d.exp - pad };
  }
  const keep = d.digits.slice(0, n);
  const next = d.digits.charCodeAt(n) - 48;
  let exp = d.exp + (d.digits.length - n);
  let digits = keep;
  if (next >= 5) {
    const bumped = (BigInt(keep) + B1).toString();
    if (bumped.length > keep.length) {
      digits = bumped.slice(0, n);
      exp += 1;
    } else digits = bumped;
  }
  return { negative: d.negative, digits, exp };
}

/** Exponent of the leading digit: value = d.ddd × 10^order. */
export function order(d: Dec): number {
  return d.exp + d.digits.length - 1;
}

export function toScientific(d: Dec, times = "×"): string {
  const o = d.digits === "0" || /^0+$/.test(d.digits) ? d.exp + d.digits.length - 1 : order(d);
  const mant = d.digits.length > 1 ? `${d.digits[0]}.${d.digits.slice(1)}` : d.digits;
  return `${d.negative ? "-" : ""}${mant} ${times} 10^${o}`;
}

export function toENotation(d: Dec): string {
  const o = order(d);
  const mant = d.digits.length > 1 ? `${d.digits[0]}.${d.digits.slice(1)}` : d.digits;
  return `${d.negative ? "-" : ""}${mant}e${o >= 0 ? "+" : ""}${o}`;
}

const PREFIX: Record<number, string> = {
  [-30]: "q", [-27]: "r", [-24]: "y", [-21]: "z", [-18]: "a", [-15]: "f", [-12]: "p", [-9]: "n", [-6]: "µ", [-3]: "m",
  0: "", 3: "k", 6: "M", 9: "G", 12: "T", 15: "P", 18: "E", 21: "Z", 24: "Y", 27: "R", 30: "Q",
};

/** Engineering notation: exponent a multiple of 3, mantissa 1 to 999. */
export function toEngineering(d: Dec): { text: string; exponent: number; mantissa: string; prefix?: string } {
  const o = order(d);
  const e3 = Math.floor(o / 3) * 3;
  const intDigits = o - e3 + 1; // 1..3
  let ds = d.digits;
  if (ds.length < intDigits) ds = ds + "0".repeat(intDigits - ds.length);
  const mantissa = ds.length > intDigits ? `${ds.slice(0, intDigits)}.${ds.slice(intDigits)}` : ds;
  const sign = d.negative ? "-" : "";
  return { text: `${sign}${mantissa} × 10^${e3}`, exponent: e3, mantissa: sign + mantissa, prefix: PREFIX[e3] };
}

/** Plain decimal string (no exponent). */
export function toPlain(d: Dec): string {
  const sign = d.negative ? "-" : "";
  if (d.exp >= 0) return sign + d.digits + "0".repeat(d.exp);
  const k = -d.exp;
  if (d.digits.length > k) return `${sign}${d.digits.slice(0, d.digits.length - k)}.${d.digits.slice(d.digits.length - k)}`;
  return `${sign}0.${"0".repeat(k - d.digits.length)}${d.digits}`;
}

/** Plain decimal with thousands separators on the integer part. */
export function groupPlain(s: string): string {
  const [i, f] = s.split(".");
  const neg = i.startsWith("-");
  const body = (neg ? i.slice(1) : i).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${neg ? "-" : ""}${body}${f !== undefined ? `.${f}` : ""}`;
}

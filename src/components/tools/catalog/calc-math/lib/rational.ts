/**
 * Exact rational numbers on BigInt. Always normalized: gcd(n, d) = 1, d > 0.
 * (BigInt literals are avoided because the project targets ES2017.)
 */

export const B0 = BigInt(0);
export const B1 = BigInt(1);
export const B2 = BigInt(2);
export const B10 = BigInt(10);

export const babs = (a: bigint) => (a < B0 ? -a : a);

export function bgcd(a: bigint, b: bigint): bigint {
  a = babs(a);
  b = babs(b);
  while (b !== B0) {
    const t = a % b;
    a = b;
    b = t;
  }
  return a;
}

export class Q {
  readonly n: bigint;
  readonly d: bigint;

  constructor(n: bigint, d: bigint = B1) {
    if (d === B0) throw new Error("Division by zero.");
    if (d < B0) {
      n = -n;
      d = -d;
    }
    const g = bgcd(n, d);
    this.n = g > B1 ? n / g : n;
    this.d = g > B1 ? d / g : d;
  }

  static int(v: number | bigint) {
    return new Q(typeof v === "bigint" ? v : BigInt(v));
  }

  static readonly ZERO = new Q(B0);
  static readonly ONE = new Q(B1);

  /**
   * Parses "3", "-2.5", "1.2e-3", ".5", "3/4", "-1 1/2" (mixed number), "2.5/0.5".
   * Returns null for anything else.
   */
  static parse(raw: string): Q | null {
    const s = raw.trim().replace(/,/g, "").replace(/−/g, "-");
    if (!s) return null;
    const mixed = /^([-+]?)(\d+)\s+(\d+)\s*\/\s*(\d+)$/.exec(s);
    if (mixed) {
      const den = BigInt(mixed[4]);
      if (den === B0) return null;
      const v = new Q(BigInt(mixed[2]) * den + BigInt(mixed[3]), den);
      return mixed[1] === "-" ? v.neg() : v;
    }
    const frac = /^(.+?)\s*\/\s*(.+)$/.exec(s);
    if (frac) {
      const a = Q.parseDecimal(frac[1]);
      const b = Q.parseDecimal(frac[2]);
      if (!a || !b || b.isZero()) return null;
      return a.div(b);
    }
    return Q.parseDecimal(s);
  }

  /** Exact parse of a decimal / scientific literal. */
  static parseDecimal(raw: string): Q | null {
    const m = /^([-+]?)(\d*)(?:\.(\d*))?(?:[eE]([-+]?\d+))?$/.exec(raw.trim());
    if (!m || (m[2] === "" && (m[3] === undefined || m[3] === ""))) return null;
    const intPart = m[2] || "0";
    const fracPart = m[3] ?? "";
    let exp = m[4] ? Number(m[4]) : 0;
    if (Math.abs(exp) > 5000) return null;
    let n = BigInt(intPart + fracPart);
    exp -= fracPart.length;
    let d = B1;
    if (exp >= 0) n *= B10 ** BigInt(exp);
    else d = B10 ** BigInt(-exp);
    if (m[1] === "-") n = -n;
    return new Q(n, d);
  }

  /** Converts a finite JS number exactly (binary value); prefer parse() for typed input. */
  static fromNumber(x: number): Q {
    if (!Number.isFinite(x)) throw new Error("Not a finite number.");
    const p = Q.parseDecimal(String(x));
    if (!p) throw new Error("Could not convert number.");
    return p;
  }

  add(o: Q) {
    return new Q(this.n * o.d + o.n * this.d, this.d * o.d);
  }
  sub(o: Q) {
    return new Q(this.n * o.d - o.n * this.d, this.d * o.d);
  }
  mul(o: Q) {
    return new Q(this.n * o.n, this.d * o.d);
  }
  div(o: Q) {
    if (o.n === B0) throw new Error("Division by zero.");
    return new Q(this.n * o.d, this.d * o.n);
  }
  neg() {
    return new Q(-this.n, this.d);
  }
  abs() {
    return this.n < B0 ? this.neg() : this;
  }
  inv() {
    return new Q(this.d, this.n);
  }
  pow(e: number): Q {
    if (!Number.isInteger(e)) throw new Error("Integer exponent required.");
    if (e < 0) return this.inv().pow(-e);
    const k = BigInt(e);
    return new Q(this.n ** k, this.d ** k);
  }
  cmp(o: Q) {
    const l = this.n * o.d;
    const r = o.n * this.d;
    return l < r ? -1 : l > r ? 1 : 0;
  }
  eq(o: Q) {
    return this.n === o.n && this.d === o.d;
  }
  isZero() {
    return this.n === B0;
  }
  isInt() {
    return this.d === B1;
  }
  sign() {
    return this.n < B0 ? -1 : this.n > B0 ? 1 : 0;
  }

  toNumber(): number {
    const nl = babs(this.n).toString().length;
    const dl = this.d.toString().length;
    if (nl < 300 && dl < 300) return Number(this.n) / Number(this.d);
    // Scale so the integer quotient has ~20 significant digits, then shift the exponent.
    const k = 20 - (nl - dl);
    const q = k >= 0 ? (this.n * B10 ** BigInt(k)) / this.d : this.n / (this.d * B10 ** BigInt(-k));
    return parseFloat(`${q}e${-k}`);
  }

  /** "n" or "n/d" with a real minus sign. */
  toString(): string {
    const s = this.d === B1 ? this.n.toString() : `${this.n}/${this.d}`;
    return s.replace(/^-/, "−");
  }

  /** Plain ASCII form, for copy/paste into other tools. */
  toAscii(): string {
    return this.d === B1 ? this.n.toString() : `${this.n}/${this.d}`;
  }

  /** Mixed number, e.g. "−2 1/3". Integers and proper fractions unchanged. */
  toMixed(): string {
    if (this.d === B1 || babs(this.n) < this.d) return this.toString();
    const neg = this.n < B0;
    const a = babs(this.n);
    const whole = a / this.d;
    const rem = a % this.d;
    return `${neg ? "−" : ""}${whole} ${rem}/${this.d}`;
  }

  /**
   * Decimal expansion with repeating part in parentheses, e.g. 1/6 → "0.1(6)".
   * Falls back to rounded digits ending in "…" when the period exceeds `maxDigits`.
   */
  toRepeating(maxDigits = 60): { text: string; exact: boolean } {
    const neg = this.n < B0;
    const a = babs(this.n);
    const intPart = a / this.d;
    let rem = a % this.d;
    if (rem === B0) return { text: `${neg ? "−" : ""}${intPart}`, exact: true };
    const seen = new Map<string, number>();
    let digits = "";
    while (rem !== B0 && digits.length < maxDigits) {
      const key = rem.toString();
      const at = seen.get(key);
      if (at !== undefined) {
        const t = `${intPart}.${digits.slice(0, at)}(${digits.slice(at)})`;
        return { text: `${neg ? "−" : ""}${t}`, exact: true };
      }
      seen.set(key, digits.length);
      rem *= B10;
      digits += (rem / this.d).toString();
      rem %= this.d;
    }
    if (rem === B0) return { text: `${neg ? "−" : ""}${intPart}.${digits}`, exact: true };
    return { text: `${neg ? "−" : ""}${intPart}.${digits}…`, exact: false };
  }

  /** Decimal rounded half away from zero to `places` decimals, trailing zeros trimmed. */
  toFixed(places = 10): string {
    const neg = this.n < B0;
    const scale = B10 ** BigInt(places);
    const a = babs(this.n) * scale;
    let q = a / this.d;
    if ((a % this.d) * B2 >= this.d) q += B1;
    let s = q.toString().padStart(places + 1, "0");
    if (places > 0) s = `${s.slice(0, -places)}.${s.slice(-places)}`.replace(/\.?0+$/, "");
    if (s === "0" || s === "") return "0";
    return `${neg ? "−" : ""}${s}`;
  }
}

/** Least common multiple of BigInts (positive). */
export function blcm(a: bigint, b: bigint): bigint {
  if (a === B0 || b === B0) return B0;
  return babs((a / bgcd(a, b)) * b);
}

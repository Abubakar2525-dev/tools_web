/** Exact integer math on BigInt: number theory and combinatorics. */

import { B0, B1, B2, B10, babs, bgcd } from "./rational";

const B3 = BigInt(3);
const B5 = BigInt(5);

/** Parses an integer string (allows spaces, commas, underscores, leading sign). */
export function parseBigInt(raw: string): bigint | null {
  const s = raw.trim().replace(/[\s,_]/g, "").replace(/−/g, "-");
  if (!/^[-+]?\d+$/.test(s)) return null;
  return BigInt(s);
}

export function digitCount(n: bigint): number {
  return babs(n).toString().length;
}

/** Scientific form of a big integer, e.g. "4.0238726 × 10^2567". Exact digits when short. */
export function sciBig(n: bigint, sig = 8): string {
  const neg = n < B0;
  const s = babs(n).toString();
  if (s.length <= 15) return `${neg ? "−" : ""}${Number(s).toLocaleString("en-US")}`;
  let mant = BigInt(s.slice(0, sig));
  let exp = s.length - 1;
  if (Number(s[sig] ?? "0") >= 5) mant += B1;
  let ms = mant.toString();
  if (ms.length > sig) {
    ms = ms.slice(0, sig);
    exp += 1;
  }
  const frac = ms.slice(1).replace(/0+$/, "");
  return `${neg ? "−" : ""}${ms[0]}${frac ? `.${frac}` : ""} × 10^${exp}`;
}

/** Groups digits with commas. */
export function groupDigits(n: bigint): string {
  const neg = n < B0;
  const s = babs(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return neg ? `−${s}` : s;
}

export function isqrt(n: bigint): bigint {
  if (n < B0) throw new Error("Square root of a negative number.");
  if (n < B2) return n;
  // Newton from an overestimate decreases monotonically to floor(√n).
  let x = B1 << BigInt(Math.ceil(n.toString(2).length / 2));
  for (;;) {
    const y = (x + n / x) >> B1;
    if (y >= x) return x;
    x = y;
  }
}

/** Integer k-th root (floor). */
export function iroot(n: bigint, k: number): bigint {
  if (n < B0) throw new Error("Root of a negative number.");
  if (n < B2 || k === 1) return n;
  const K = BigInt(k);
  const bits = n.toString(2).length;
  let x = B1 << BigInt(Math.ceil(bits / k)); // overestimate
  for (;;) {
    const y = ((K - B1) * x + n / x ** (K - B1)) / K;
    if (y >= x) break;
    x = y;
  }
  while (x ** K > n) x -= B1;
  while ((x + B1) ** K <= n) x += B1;
  return x;
}

export function powMod(base: bigint, exp: bigint, mod: bigint): bigint {
  let r = B1;
  let b = ((base % mod) + mod) % mod;
  let e = exp;
  while (e > B0) {
    if (e & B1) r = (r * b) % mod;
    b = (b * b) % mod;
    e >>= B1;
  }
  return r;
}

const SMALL_PRIMES = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61, 67, 71, 73, 79, 83, 89, 97];
/** Deterministic Miller-Rabin bases for n < 3.317 × 10^24 (Sorenson & Webster 2015). */
const MR_LIMIT = BigInt("3317044064679887385961981");

/**
 * Miller-Rabin primality. Deterministic (proven) below 3.3 × 10^24; above that,
 * 25 bases are used and the answer is "probable prime" (error < 4^-25).
 */
export function isPrime(n: bigint): { prime: boolean; certain: boolean } {
  if (n < B2) return { prime: false, certain: true };
  for (const p of SMALL_PRIMES) {
    const P = BigInt(p);
    if (n === P) return { prime: true, certain: true };
    if (n % P === B0) return { prime: false, certain: true };
  }
  let d = n - B1;
  let s = 0;
  while ((d & B1) === B0) {
    d >>= B1;
    s++;
  }
  const certain = n < MR_LIMIT;
  const bases = certain ? SMALL_PRIMES.slice(0, 13) : SMALL_PRIMES;
  outer: for (const a of bases) {
    const A = BigInt(a);
    let x = powMod(A, d, n);
    if (x === B1 || x === n - B1) continue;
    for (let r = 1; r < s; r++) {
      x = (x * x) % n;
      if (x === n - B1) continue outer;
    }
    return { prime: false, certain: true };
  }
  return { prime: true, certain };
}

export function nextPrime(n: bigint): bigint {
  let c = n < B2 ? B2 : n + B1;
  if (c > B2 && (c & B1) === B0) c += B1;
  while (!isPrime(c).prime) c += c === B2 ? B1 : B2;
  return c;
}

export function prevPrime(n: bigint): bigint | null {
  if (n <= B2) return null;
  if (n === B3) return B2;
  let c = n - B1;
  if ((c & B1) === B0) c -= B1;
  while (c > B2 && !isPrime(c).prime) c -= B2;
  return c >= B2 ? c : null;
}

/** Primes in [lo, hi] via segmented sieve. Caller should cap hi − lo (≤ 10^6) and hi (≤ 10^12). */
export function primesInRange(lo: number, hi: number): number[] {
  if (hi < 2 || hi < lo) return [];
  lo = Math.max(2, lo);
  const root = Math.floor(Math.sqrt(hi));
  const base = new Uint8Array(root + 1);
  const small: number[] = [];
  for (let i = 2; i <= root; i++) {
    if (!base[i]) {
      small.push(i);
      for (let j = i * i; j <= root; j += i) base[j] = 1;
    }
  }
  const size = hi - lo + 1;
  const mark = new Uint8Array(size);
  for (const p of small) {
    let start = Math.max(p * p, Math.ceil(lo / p) * p);
    for (; start <= hi; start += p) mark[start - lo] = 1;
  }
  const out: number[] = [];
  for (let i = 0; i < size; i++) if (!mark[i]) out.push(lo + i);
  return out;
}

function pollardBrent(n: bigint): bigint {
  if ((n & B1) === B0) return B2;
  let seed = 1;
  for (;;) {
    const c = BigInt(seed++);
    let y = B2;
    let m = BigInt(128);
    let g = B1;
    let r = B1;
    let q = B1;
    let x = y;
    let ys = y;
    const f = (v: bigint) => (v * v + c) % n;
    while (g === B1) {
      x = y;
      for (let i = B0; i < r; i++) y = f(y);
      let k = B0;
      while (k < r && g === B1) {
        ys = y;
        const lim = m < r - k ? m : r - k;
        for (let i = B0; i < lim; i++) {
          y = f(y);
          q = (q * babs(x - y)) % n;
        }
        g = bgcd(q, n);
        k += m;
      }
      r *= B2;
      if (r > BigInt(1) << BigInt(40)) break;
    }
    if (g === n) {
      do {
        ys = f(ys);
        g = bgcd(babs(x - ys), n);
      } while (g === B1);
    }
    if (g !== n && g !== B1) return g;
    m = BigInt(128);
  }
}

/**
 * Prime factorization as sorted [prime, exponent] pairs. Trial division to 10^4,
 * then Pollard-Brent rho. Throws if `deadline` (ms timestamp) passes.
 */
export function factorize(n: bigint, deadline = Infinity): [bigint, number][] {
  if (n < B0) n = -n;
  const map = new Map<string, [bigint, number]>();
  const add = (p: bigint) => {
    const k = p.toString();
    const e = map.get(k);
    if (e) e[1]++;
    else map.set(k, [p, 1]);
  };
  if (n < B2) return [];
  for (let p = 2; p <= 10000; p += p === 2 ? 1 : 2) {
    const P = BigInt(p);
    if (P * P > n) break;
    while (n % P === B0) {
      add(P);
      n /= P;
    }
  }
  const stack = n > B1 ? [n] : [];
  while (stack.length) {
    if (Date.now() > deadline) throw new Error("Factoring took too long. Try a smaller number.");
    const m = stack.pop() as bigint;
    if (m === B1) continue;
    if (isPrime(m).prime) {
      add(m);
      continue;
    }
    const r = isqrt(m);
    if (r * r === m) {
      stack.push(r, r);
      continue;
    }
    const d = pollardBrent(m);
    stack.push(d, m / d);
  }
  return [...map.values()].sort((a, b) => (a[0] < b[0] ? -1 : 1));
}

/** All divisors from a factorization, sorted. */
export function divisorsFrom(f: [bigint, number][]): bigint[] {
  let divs = [B1];
  for (const [p, e] of f) {
    const next: bigint[] = [];
    for (const d of divs) {
      let pk = B1;
      for (let i = 0; i <= e; i++) {
        next.push(d * pk);
        pk *= p;
      }
    }
    divs = next;
  }
  return divs.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

export function divisorCount(f: [bigint, number][]): bigint {
  return f.reduce((acc, [, e]) => acc * BigInt(e + 1), B1);
}

export function divisorSum(f: [bigint, number][]): bigint {
  return f.reduce((acc, [p, e]) => acc * ((p ** BigInt(e + 1) - B1) / (p - B1)), B1);
}

/** Product of integers in [a, b] by binary splitting (fast for big ranges). */
function rangeProduct(a: bigint, b: bigint): bigint {
  if (a > b) return B1;
  if (a === b) return a;
  if (b - a < BigInt(8)) {
    let r = a;
    for (let i = a + B1; i <= b; i++) r *= i;
    return r;
  }
  const mid = (a + b) / B2;
  return rangeProduct(a, mid) * rangeProduct(mid + B1, b);
}

export function factorial(n: number): bigint {
  if (!Number.isInteger(n) || n < 0) throw new Error("Factorial needs a whole number ≥ 0.");
  return n < 2 ? B1 : rangeProduct(B2, BigInt(n));
}

/** n!! = n(n−2)(n−4)… down to 1 or 2. */
export function doubleFactorial(n: number): bigint {
  if (!Number.isInteger(n) || n < 0) throw new Error("Double factorial needs a whole number ≥ 0.");
  // Split into product over k of (start + 2k) using odd/even trick: n!! = 2^m m! for even n.
  if (n % 2 === 0) {
    const m = n / 2;
    return (B1 << BigInt(m)) * factorial(m);
  }
  // odd: n!! = n! / (n−1)!!  = n! / (2^m m!) with m = (n−1)/2
  const m = (n - 1) / 2;
  return factorial(n) / ((B1 << BigInt(m)) * factorial(m));
}

/** Trailing zeros of n! (Legendre's formula with p = 5). */
export function factorialTrailingZeros(n: number): number {
  let z = 0;
  for (let p = 5; p <= n; p *= 5) z += Math.floor(n / p);
  return z;
}

export function trailingZeros(n: bigint): number {
  if (n === B0) return 1;
  const s = babs(n).toString();
  return s.length - s.replace(/0+$/, "").length;
}

/** F(n) and F(n+1) by fast doubling, F(0)=0, F(1)=1. Negative n via F(−n) = (−1)^(n+1) F(n). */
export function fibPair(n: number): [bigint, bigint] {
  if (n === 0) return [B0, B1];
  const [a, b] = fibPair(Math.floor(n / 2));
  const c = a * (B2 * b - a);
  const d = a * a + b * b;
  return n % 2 === 0 ? [c, d] : [d, c + d];
}

export function fib(n: number): bigint {
  if (!Number.isInteger(n)) throw new Error("Index must be a whole number.");
  if (n < 0) {
    const f = fibPair(-n)[0];
    return -n % 2 === 0 ? -f : f;
  }
  return fibPair(n)[0];
}

/** n ≥ 0 is Fibonacci iff 5n²+4 or 5n²−4 is a perfect square. Returns the index if so. */
export function fibIndex(n: bigint): number | null {
  if (n < B0) return null;
  const t = B5 * n * n;
  const sq = (x: bigint) => {
    const r = isqrt(x);
    return r * r === x;
  };
  if (!sq(t + BigInt(4)) && !sq(t - BigInt(4))) return null;
  if (n === B0) return 0;
  if (n === B1) return 1; // also F(2)
  // Locate the index by estimate then walk.
  const digits = n.toString().length;
  let i = Math.max(0, Math.floor((digits - 1) * 4.785) - 2);
  let [a, b] = fibPair(i);
  while (a < n) {
    [a, b] = [b, a + b];
    i++;
  }
  return a === n ? i : null;
}

/** nPr = n!/(n−r)!. */
export function nPr(n: number, r: number): bigint {
  if (r < 0 || n < 0 || r > n) return B0;
  if (r === 0) return B1;
  return rangeProduct(BigInt(n - r + 1), BigInt(n));
}

/** nCr = n!/(r!(n−r)!). */
export function nCr(n: number, r: number): bigint {
  if (r < 0 || n < 0 || r > n) return B0;
  r = Math.min(r, n - r);
  if (r === 0) return B1;
  return rangeProduct(BigInt(n - r + 1), BigInt(n)) / factorial(r);
}

/** Euclid's algorithm steps for gcd(a, b): lines "a = q × b + r". */
export function euclidSteps(a: bigint, b: bigint): { gcd: bigint; steps: string[] } {
  a = babs(a);
  b = babs(b);
  const steps: string[] = [];
  if (a < b) [a, b] = [b, a];
  while (b !== B0) {
    const q = a / b;
    const r = a % b;
    steps.push(`${a} = ${q} × ${b} + ${r}`);
    a = b;
    b = r;
  }
  return { gcd: a, steps };
}

export { bgcd, B10 };

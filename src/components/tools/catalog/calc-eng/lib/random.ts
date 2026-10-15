/**
 * Unbiased random helpers on top of a 32-bit random source
 * (crypto.getRandomValues in the browser). Range mapping uses rejection
 * sampling so no value is more likely than another.
 */

export type U32Source = () => number;

/** Cryptographically secure 32-bit source (browser or Node with Web Crypto). */
export function cryptoSource(): U32Source {
  const buf = new Uint32Array(64);
  let i = buf.length;
  return () => {
    if (i >= buf.length) {
      crypto.getRandomValues(buf);
      i = 0;
    }
    return buf[i++];
  };
}

const TWO32 = 2 ** 32;
const TWO53 = 2 ** 53;

/** Uniform integer in [0, n), n ≤ 2^53. */
export function below(n: number, src: U32Source): number {
  if (!Number.isSafeInteger(n) && n !== TWO53) throw new Error("Range too large.");
  if (n <= 0) throw new Error("Empty range.");
  if (n === 1) return 0;
  if (n <= TWO32) {
    const limit = TWO32 - (TWO32 % n);
    for (;;) {
      const x = src();
      if (x < limit) return x % n;
    }
  }
  const limit = TWO53 - (TWO53 % n);
  for (;;) {
    const x = (src() >>> 11) * TWO32 + src();
    if (x < limit) return x % n;
  }
}

/** Uniform integer in [min, max] inclusive. */
export function intBetween(min: number, max: number, src: U32Source): number {
  return min + below(max - min + 1, src);
}

/** Uniform float in [0, 1) with 53 bits of randomness. */
export function unitFloat(src: U32Source): number {
  return ((src() >>> 5) * 67108864 + (src() >>> 6)) / 9007199254740992;
}

export type GenOptions = {
  min: number;
  max: number;
  count: number;
  decimals: number;
  unique: boolean;
  sort: "none" | "asc" | "desc";
};

/** Generates numbers; decimals are uniform on the grid of 10^-decimals steps. */
export function generate(o: GenOptions, src: U32Source): number[] | string {
  if (!Number.isFinite(o.min) || !Number.isFinite(o.max)) return "Enter a minimum and a maximum.";
  if (o.max < o.min) return "The maximum must be greater than or equal to the minimum.";
  if (!Number.isInteger(o.count) || o.count < 1) return "Count must be a whole number of at least 1.";
  if (o.count > 10000) return "Generate at most 10,000 numbers at a time.";
  const scale = 10 ** o.decimals;
  const lo = Math.ceil(o.min * scale - 1e-9);
  const hi = Math.floor(o.max * scale + 1e-9);
  if (hi < lo) return "No values with that many decimals fit in the range.";
  const n = hi - lo + 1;
  if (!Number.isSafeInteger(n)) return "The range is too large. Narrow it or use fewer decimals.";
  if (o.unique && o.count > n) return `Only ${n.toLocaleString("en-US")} distinct values exist in this range, so ${o.count.toLocaleString("en-US")} unique numbers are impossible.`;
  let ints: number[];
  if (o.unique) {
    if (n <= 200000 && o.count > n / 4) {
      // Partial Fisher-Yates over the whole range.
      const arr = Array.from({ length: n }, (_, i) => lo + i);
      for (let i = 0; i < o.count; i++) {
        const j = i + below(n - i, src);
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      ints = arr.slice(0, o.count);
    } else {
      const seen = new Set<number>();
      ints = [];
      while (ints.length < o.count) {
        const v = lo + below(n, src);
        if (!seen.has(v)) {
          seen.add(v);
          ints.push(v);
        }
      }
    }
  } else ints = Array.from({ length: o.count }, () => lo + below(n, src));
  if (o.sort === "asc") ints.sort((a, b) => a - b);
  if (o.sort === "desc") ints.sort((a, b) => b - a);
  return ints.map((v) => Number((v / scale).toFixed(o.decimals)));
}

/** Fisher-Yates shuffle (returns a new array). */
export function shuffle<T>(items: readonly T[], src: U32Source): T[] {
  const a = items.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = below(i + 1, src);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Picks `k` items without replacement. */
export function pick<T>(items: readonly T[], k: number, src: U32Source): T[] {
  return shuffle(items, src).slice(0, k);
}

/**
 * Weighted picks without replacement: each draw is proportional to the
 * remaining weights.
 */
export function weightedPick<T>(items: readonly { item: T; weight: number }[], k: number, src: U32Source): T[] {
  const pool = items.filter((x) => x.weight > 0).slice();
  const out: T[] = [];
  while (out.length < k && pool.length) {
    const total = pool.reduce((s, x) => s + x.weight, 0);
    let r = unitFloat(src) * total;
    let idx = pool.length - 1;
    for (let i = 0; i < pool.length; i++) {
      r -= pool[i].weight;
      if (r < 0) {
        idx = i;
        break;
      }
    }
    out.push(pool[idx].item);
    pool.splice(idx, 1);
  }
  return out;
}

/** Shuffles then deals round-robin into `teams` groups (sizes differ by at most one). */
export function splitTeams<T>(items: readonly T[], teams: number, src: U32Source): T[][] {
  const s = shuffle(items, src);
  const out: T[][] = Array.from({ length: teams }, () => []);
  s.forEach((x, i) => out[i % teams].push(x));
  return out;
}

/** Parses "Alice, 3" / "Alice x3" / "Alice" lines into weighted items. */
export function parseWeighted(line: string): { name: string; weight: number } {
  const m = /^(.*?)(?:\s*[,;:|\t]\s*|\s+[x×*]\s*)(\d+(?:\.\d+)?)\s*$/.exec(line.trim());
  if (m && m[1].trim()) return { name: m[1].trim(), weight: Number(m[2]) };
  return { name: line.trim(), weight: 1 };
}

/** Descriptive statistics and simple linear regression. */

import { tSf } from "./distributions";

/** Splits on commas, semicolons, whitespace and new lines. Reports tokens that are not numbers. */
export function parseNumbers(text: string): { values: number[]; invalid: string[] } {
  const values: number[] = [];
  const invalid: string[] = [];
  // A comma followed by a digit with no space could be a thousands separator, but data lists
  // are far more common, so commas always separate values.
  for (const tok of text.split(/[\s,;]+/)) {
    if (!tok) continue;
    const t = tok.replace(/−/g, "-");
    if (/^[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/.test(t)) values.push(Number(t));
    else invalid.push(tok);
  }
  return { values, invalid };
}

/** Kahan-compensated sum for accuracy on long lists. */
export function sum(xs: number[]): number {
  let s = 0;
  let c = 0;
  for (const x of xs) {
    const y = x - c;
    const t = s + y;
    c = t - s - y;
    s = t;
  }
  return s;
}

export function mean(xs: number[]): number {
  return sum(xs) / xs.length;
}

export function sortedCopy(xs: number[]): number[] {
  return [...xs].sort((a, b) => a - b);
}

export function medianSorted(s: number[]): number {
  const n = s.length;
  if (!n) return NaN;
  const m = Math.floor(n / 2);
  return n % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** All values tied for the highest count; empty when every value occurs equally often. */
export function modes(xs: number[]): { values: number[]; count: number } {
  const counts = new Map<number, number>();
  for (const x of xs) counts.set(x, (counts.get(x) ?? 0) + 1);
  let max = 0;
  for (const c of counts.values()) max = Math.max(max, c);
  const vals = [...counts.entries()].filter(([, c]) => c === max).map(([v]) => v).sort((a, b) => a - b);
  if (vals.length === counts.size && counts.size > 1) return { values: [], count: max };
  return { values: vals, count: max };
}

export type QuartileMethod = "inclusive" | "exclusive" | "tukey" | "halves";

export const QUARTILE_METHODS: { value: QuartileMethod; label: string; note: string }[] = [
  { value: "inclusive", label: "Inclusive (Excel QUARTILE.INC, R type 7)", note: "Position 1 + (n − 1)p, linear interpolation." },
  { value: "exclusive", label: "Exclusive (Excel QUARTILE.EXC, R type 6)", note: "Position (n + 1)p, linear interpolation." },
  { value: "halves", label: "Median of halves, median excluded (TI-84)", note: "Q1 and Q3 are medians of the lower and upper halves, leaving out the middle value when n is odd." },
  { value: "tukey", label: "Tukey hinges, median included", note: "Like the halves method, but the middle value is included in both halves when n is odd." },
];

function interp(s: number[], pos: number): number {
  // pos is 1-based
  const n = s.length;
  if (pos <= 1) return s[0];
  if (pos >= n) return s[n - 1];
  const lo = Math.floor(pos);
  const f = pos - lo;
  return s[lo - 1] + f * (s[lo] - s[lo - 1]);
}

/** Q1, Q2, Q3 for sorted data. Exclusive needs n ≥ 3 to be meaningful (clamped otherwise). */
export function quartiles(s: number[], method: QuartileMethod): [number, number, number] {
  const n = s.length;
  const med = medianSorted(s);
  if (n === 1) return [s[0], s[0], s[0]];
  switch (method) {
    case "inclusive":
      return [interp(s, 1 + (n - 1) * 0.25), med, interp(s, 1 + (n - 1) * 0.75)];
    case "exclusive":
      return [interp(s, (n + 1) * 0.25), med, interp(s, (n + 1) * 0.75)];
    case "halves": {
      const h = Math.floor(n / 2);
      return [medianSorted(s.slice(0, h)), med, medianSorted(s.slice(n - h))];
    }
    case "tukey": {
      const h = Math.ceil(n / 2);
      return [medianSorted(s.slice(0, h)), med, medianSorted(s.slice(n - h))];
    }
  }
}

/** Two-pass variance (numerically stable). */
export function variance(xs: number[], sample: boolean): number {
  const n = xs.length;
  if (n < (sample ? 2 : 1)) return NaN;
  const m = mean(xs);
  const ss = sum(xs.map((x) => (x - m) * (x - m)));
  return ss / (sample ? n - 1 : n);
}

/**
 * Skewness. Population g1 = m3 / m2^1.5. Sample G1 (adjusted Fisher-Pearson,
 * same as Excel SKEW) = g1 · √(n(n−1)) / (n − 2).
 */
export function skewness(xs: number[]): { g1: number; G1: number } {
  const n = xs.length;
  const m = mean(xs);
  const m2 = sum(xs.map((x) => (x - m) ** 2)) / n;
  const m3 = sum(xs.map((x) => (x - m) ** 3)) / n;
  const g1 = m2 === 0 ? NaN : m3 / m2 ** 1.5;
  const G1 = n > 2 ? (g1 * Math.sqrt(n * (n - 1))) / (n - 2) : NaN;
  return { g1, G1 };
}

/** Excess kurtosis, sample-adjusted G2 (same as Excel KURT). */
export function kurtosis(xs: number[]): number {
  const n = xs.length;
  if (n < 4) return NaN;
  const m = mean(xs);
  const m2 = sum(xs.map((x) => (x - m) ** 2)) / n;
  const m4 = sum(xs.map((x) => (x - m) ** 4)) / n;
  if (m2 === 0) return NaN;
  const g2 = m4 / (m2 * m2) - 3;
  return ((n - 1) / ((n - 2) * (n - 3))) * ((n + 1) * g2 + 6);
}

export type Regression = {
  n: number;
  slope: number;
  intercept: number;
  r: number;
  r2: number;
  /** Residual standard error √(SSE / (n − 2)). */
  se: number;
  seSlope: number;
  seIntercept: number;
  tSlope: number;
  pSlope: number;
  df: number;
  sxx: number;
  sxy: number;
  syy: number;
  meanX: number;
  meanY: number;
  sse: number;
  residuals: { x: number; y: number; fit: number; res: number }[];
};

/** Ordinary least squares y = a + b·x. Needs n ≥ 3 and some variation in x. */
export function linearRegression(xs: number[], ys: number[]): Regression {
  const n = xs.length;
  if (n !== ys.length) throw new Error("x and y need the same number of values.");
  if (n < 3) throw new Error("Enter at least 3 points.");
  const mx = mean(xs);
  const my = mean(ys);
  const sxx = sum(xs.map((x) => (x - mx) ** 2));
  const syy = sum(ys.map((y) => (y - my) ** 2));
  const sxy = sum(xs.map((x, i) => (x - mx) * (ys[i] - my)));
  if (sxx === 0) throw new Error("All x values are equal, so a line cannot be fitted.");
  const slope = sxy / sxx;
  const intercept = my - slope * mx;
  const residuals = xs.map((x, i) => {
    const fit = intercept + slope * x;
    return { x, y: ys[i], fit, res: ys[i] - fit };
  });
  const sse = sum(residuals.map((r) => r.res * r.res));
  const df = n - 2;
  const se = Math.sqrt(sse / df);
  const seSlope = se / Math.sqrt(sxx);
  const seIntercept = se * Math.sqrt(1 / n + (mx * mx) / sxx);
  const r = syy === 0 ? NaN : sxy / Math.sqrt(sxx * syy);
  const r2 = syy === 0 ? NaN : 1 - sse / syy;
  const tSlope = seSlope === 0 ? (slope === 0 ? 0 : Infinity) : slope / seSlope;
  const pSlope = Number.isFinite(tSlope) ? 2 * tSf(Math.abs(tSlope), df) : 0;
  return { n, slope, intercept, r, r2: Math.max(0, Math.min(1, r2)), se, seSlope, seIntercept, tSlope, pSlope, df, sxx, sxy, syy, meanX: mx, meanY: my, sse, residuals };
}

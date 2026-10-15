/** Confidence intervals, sample size and effect sizes. */

import { lnGamma, normalInv, tInv } from "./distributions";

export const zFor = (conf: number) => normalInv(1 - (1 - conf) / 2);

export type Interval = { lower: number; upper: number; margin: number; crit: number; se: number };

export function ciMeanT(mean: number, sd: number, n: number, conf: number): Interval {
  const se = sd / Math.sqrt(n);
  const crit = tInv(1 - (1 - conf) / 2, n - 1);
  const margin = crit * se;
  return { lower: mean - margin, upper: mean + margin, margin, crit, se };
}

export function ciMeanZ(mean: number, sigma: number, n: number, conf: number): Interval {
  const se = sigma / Math.sqrt(n);
  const crit = zFor(conf);
  const margin = crit * se;
  return { lower: mean - margin, upper: mean + margin, margin, crit, se };
}

export function ciPropWald(x: number, n: number, conf: number): Interval {
  const p = x / n;
  const se = Math.sqrt((p * (1 - p)) / n);
  const crit = zFor(conf);
  const margin = crit * se;
  return { lower: Math.max(0, p - margin), upper: Math.min(1, p + margin), margin, crit, se };
}

export function ciPropWilson(x: number, n: number, conf: number): Interval & { center: number } {
  const p = x / n;
  const z = zFor(conf);
  const z2 = z * z;
  const denom = 1 + z2 / n;
  const center = (p + z2 / (2 * n)) / denom;
  const half = (z / denom) * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n));
  return { lower: Math.max(0, center - half), upper: Math.min(1, center + half), margin: half, crit: z, se: Math.sqrt((p * (1 - p)) / n), center };
}

/** Survey sample size for a proportion; optional finite population correction. */
export function sampleSizeProportion(conf: number, margin: number, p: number, N?: number | null) {
  const z = zFor(conf);
  const n0 = (z * z * p * (1 - p)) / (margin * margin);
  const n = N ? n0 / (1 + (n0 - 1) / N) : n0;
  return { z, n0, n, required: Math.ceil(n - 1e-9) };
}

/** Sample size to estimate a mean within ±margin given σ. */
export function sampleSizeMean(conf: number, sigma: number, margin: number, N?: number | null) {
  const z = zFor(conf);
  const n0 = ((z * sigma) / margin) ** 2;
  const n = N ? n0 / (1 + (n0 - 1) / N) : n0;
  return { z, n0, n, required: Math.ceil(n - 1e-9) };
}

/**
 * Per-group n for a two-sided two-sample t-test with equal groups:
 * n = 2(z₁₋α/₂ + z₁₋β)² / d² + z₁₋α/₂² / 4 (normal approximation with Guenther's t correction).
 */
export function sampleSizeTwoGroups(alpha: number, power: number, d: number) {
  const za = normalInv(1 - alpha / 2);
  const zb = normalInv(power);
  const base = (2 * (za + zb) ** 2) / (d * d);
  const n = base + (za * za) / 4;
  return { za, zb, base, n, perGroup: Math.ceil(n - 1e-9) };
}

/** Exact small-sample correction J(df) = Γ(df/2) / (√(df/2) Γ((df−1)/2)). */
export function hedgesJ(df: number): number {
  return Math.exp(lnGamma(df / 2) - 0.5 * Math.log(df / 2) - lnGamma((df - 1) / 2));
}

export function effectSizes(m1: number, s1: number, n1: number, m2: number, s2: number, n2: number) {
  const df = n1 + n2 - 2;
  const pooled = Math.sqrt(((n1 - 1) * s1 * s1 + (n2 - 1) * s2 * s2) / df);
  const diff = m1 - m2;
  const d = diff / pooled;
  const J = hedgesJ(df);
  const g = d * J;
  const glass = diff / s2;
  const seD = Math.sqrt((n1 + n2) / (n1 * n2) + (d * d) / (2 * (n1 + n2)));
  return { df, pooled, diff, d, J, g, glass, seD, ciD: [d - 1.959963984540054 * seD, d + 1.959963984540054 * seD] as [number, number] };
}

export function cohenLabel(d: number): string {
  const a = Math.abs(d);
  if (a < 0.2) return "negligible";
  if (a < 0.5) return "small";
  if (a < 0.8) return "medium";
  return "large";
}

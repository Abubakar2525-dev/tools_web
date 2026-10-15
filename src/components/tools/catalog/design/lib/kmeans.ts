/** Dominant colors by k-means clustering in OKLab (pure, deterministic). */

import { formatHex, fromOklab, toGamut, toOklab, type Color } from "./color";

export type Cluster = { color: Color; hex: string; count: number; share: number; lab: [number, number, number] };

/** Small seeded PRNG (mulberry32) so the same image always gives the same palette. */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Converts RGBA bytes to OKLab triples, skipping mostly transparent pixels. */
export function pixelsToLab(data: Uint8ClampedArray | Uint8Array, minAlpha = 128) {
  const out: number[] = [];
  const cache = new Map<number, [number, number, number]>();
  for (let i = 0; i + 3 < data.length; i += 4) {
    if (data[i + 3] < minAlpha) continue;
    const key = (data[i] << 16) | (data[i + 1] << 8) | data[i + 2];
    let lab = cache.get(key);
    if (!lab) {
      lab = toOklab({ r: data[i] / 255, g: data[i + 1] / 255, b: data[i + 2] / 255, alpha: 1 });
      cache.set(key, lab);
    }
    out.push(lab[0], lab[1], lab[2]);
  }
  return new Float64Array(out);
}

/**
 * k-means with k-means++ seeding. `points` is a flat [L,a,b,L,a,b,...] array.
 * Returns clusters sorted by size (largest first).
 */
export function kmeans(points: Float64Array, k: number, maxIter = 30, seed = 7): Cluster[] {
  const n = points.length / 3;
  if (n === 0) return [];
  const K = Math.max(1, Math.min(k, n));
  const rand = rng(seed);
  const cent = new Float64Array(K * 3);
  const d2 = new Float64Array(n).fill(Infinity);
  const dist = (i: number, c: number) => {
    const x = points[i * 3] - cent[c * 3];
    const y = points[i * 3 + 1] - cent[c * 3 + 1];
    const z = points[i * 3 + 2] - cent[c * 3 + 2];
    return x * x + y * y + z * z;
  };
  // k-means++ seeding
  let first = Math.floor(rand() * n);
  cent.set(points.subarray(first * 3, first * 3 + 3), 0);
  for (let c = 1; c < K; c++) {
    let sum = 0;
    for (let i = 0; i < n; i++) {
      const d = dist(i, c - 1);
      if (d < d2[i]) d2[i] = d;
      sum += d2[i];
    }
    let pick = 0;
    if (sum > 0) {
      let r = rand() * sum;
      for (let i = 0; i < n; i++) {
        r -= d2[i];
        if (r <= 0) {
          pick = i;
          break;
        }
      }
    } else pick = Math.floor(rand() * n);
    first = pick;
    cent.set(points.subarray(pick * 3, pick * 3 + 3), c * 3);
  }

  const assign = new Int32Array(n).fill(-1);
  const counts = new Float64Array(K);
  for (let iter = 0; iter < maxIter; iter++) {
    let changed = 0;
    for (let i = 0; i < n; i++) {
      let best = 0;
      let bd = Infinity;
      for (let c = 0; c < K; c++) {
        const d = dist(i, c);
        if (d < bd) {
          bd = d;
          best = c;
        }
      }
      if (assign[i] !== best) {
        assign[i] = best;
        changed++;
      }
    }
    const sums = new Float64Array(K * 3);
    counts.fill(0);
    for (let i = 0; i < n; i++) {
      const c = assign[i];
      counts[c]++;
      sums[c * 3] += points[i * 3];
      sums[c * 3 + 1] += points[i * 3 + 1];
      sums[c * 3 + 2] += points[i * 3 + 2];
    }
    for (let c = 0; c < K; c++) {
      if (counts[c] > 0) {
        cent[c * 3] = sums[c * 3] / counts[c];
        cent[c * 3 + 1] = sums[c * 3 + 1] / counts[c];
        cent[c * 3 + 2] = sums[c * 3 + 2] / counts[c];
      } else {
        // Re-seed an empty cluster at the point farthest from its centroid.
        let far = 0;
        let fd = -1;
        for (let i = 0; i < n; i++) {
          const d = dist(i, assign[i]);
          if (d > fd) {
            fd = d;
            far = i;
          }
        }
        cent.set(points.subarray(far * 3, far * 3 + 3), c * 3);
        changed++;
      }
    }
    if (changed === 0) break;
  }

  const out: Cluster[] = [];
  for (let c = 0; c < K; c++) {
    if (!counts[c]) continue;
    const lab: [number, number, number] = [cent[c * 3], cent[c * 3 + 1], cent[c * 3 + 2]];
    const color = toGamut(fromOklab(lab));
    out.push({ color, hex: formatHex(color), count: counts[c], share: counts[c] / n, lab });
  }
  return mergeDuplicates(out).sort((a, b) => b.count - a.count);
}

/** Merges clusters whose hex codes end up identical. */
function mergeDuplicates(cs: Cluster[]) {
  const map = new Map<string, Cluster>();
  for (const c of cs) {
    const e = map.get(c.hex);
    if (e) {
      e.count += c.count;
      e.share += c.share;
    } else map.set(c.hex, { ...c });
  }
  return [...map.values()];
}

/** Target sample size: scale so width × height ≤ maxPixels. */
export function sampleSize(w: number, h: number, maxPixels = 40000) {
  const s = Math.min(1, Math.sqrt(maxPixels / (w * h)));
  return { w: Math.max(1, Math.round(w * s)), h: Math.max(1, Math.round(h * s)) };
}

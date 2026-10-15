/**
 * Perceptual difference hash (dHash) and grouping helpers for the duplicate
 * image finder. Pure TypeScript.
 */

/**
 * dHash from a 9×8 grayscale thumbnail (row-major, 72 values): for each row,
 * bit = left pixel brighter than its right neighbour. Returns 8 bytes (64 bits).
 */
export function dHash(gray9x8: ArrayLike<number>) {
  if (gray9x8.length !== 72) throw new Error("dHash needs a 9×8 grayscale image.");
  const out = new Uint8Array(8);
  for (let y = 0; y < 8; y++) {
    let byte = 0;
    for (let x = 0; x < 8; x++) {
      const l = gray9x8[y * 9 + x];
      const r = gray9x8[y * 9 + x + 1];
      byte = (byte << 1) | (l > r ? 1 : 0);
    }
    out[y] = byte;
  }
  return out;
}

const POP = new Uint8Array(256).map((_, i) => {
  let n = 0;
  for (let v = i; v; v >>= 1) n += v & 1;
  return n;
});

export function hamming(a: Uint8Array, b: Uint8Array) {
  let d = 0;
  for (let i = 0; i < a.length; i++) d += POP[a[i] ^ b[i]];
  return d;
}

export const toHex = (b: Uint8Array) => Array.from(b, (v) => v.toString(16).padStart(2, "0")).join("");

/** Disjoint-set grouping: items i, j share a group when `linked(i, j)`. Returns groups of size ≥ 2. */
export function groupPairs(n: number, linked: (i: number, j: number) => boolean) {
  const parent = Array.from({ length: n }, (_, i) => i);
  const find = (x: number): number => {
    while (parent[x] !== x) {
      parent[x] = parent[parent[x]];
      x = parent[x];
    }
    return x;
  };
  for (let i = 0; i < n; i++)
    for (let j = i + 1; j < n; j++)
      if (linked(i, j)) {
        const a = find(i);
        const b = find(j);
        if (a !== b) parent[b] = a;
      }
  const groups = new Map<number, number[]>();
  for (let i = 0; i < n; i++) {
    const r = find(i);
    const g = groups.get(r);
    if (g) g.push(i);
    else groups.set(r, [i]);
  }
  return [...groups.values()].filter((g) => g.length > 1);
}

/** Similarity percentage for a Hamming distance on a 64-bit hash. */
export const similarity = (distance: number) => Math.round((1 - distance / 64) * 100);

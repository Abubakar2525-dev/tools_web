/** Byte-level file comparison helpers. */

export interface CompareState {
  diffCount: number;
  firstDiff: number | null;
  /** Differing regions [start, end) in the common range; nearby regions (gap ≤ mergeGap) are merged. */
  regions: { start: number; end: number }[];
  regionCount: number;
  lastEnd: number | null;
  tracking: boolean;
}

export const MAX_REGIONS = 500;

export function newCompareState(): CompareState {
  return { diffCount: 0, firstDiff: null, regions: [], regionCount: 0, lastEnd: null, tracking: false };
}

/** Compares two equal-length chunks starting at absolute offset `base`. Mutates and returns state. */
export function compareChunk(a: Uint8Array, b: Uint8Array, base: number, s: CompareState, mergeGap = 8): CompareState {
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    if (a[i] === b[i]) continue;
    const off = base + i;
    s.diffCount++;
    if (s.firstDiff === null) s.firstDiff = off;
    if (s.lastEnd !== null && off - s.lastEnd <= mergeGap) {
      s.lastEnd = off + 1;
      if (s.tracking) s.regions[s.regions.length - 1].end = off + 1;
    } else {
      s.regionCount++;
      s.lastEnd = off + 1;
      s.tracking = s.regions.length < MAX_REGIONS;
      if (s.tracking) s.regions.push({ start: off, end: off + 1 });
    }
  }
  return s;
}

export const hex2 = (n: number) => n.toString(16).toUpperCase().padStart(2, "0");
export const hexOffset = (n: number) => n.toString(16).toUpperCase().padStart(8, "0");

export const printable = (c: number) => (c >= 0x20 && c < 0x7f ? String.fromCharCode(c) : ".");

/**
 * Silence detection (RMS in short windows compared with a dB threshold) and
 * removal / shortening, plus split-point helpers used by the splitter.
 */
import { concat, durationOf, frames, sliceSeconds, type Pcm } from "./pcm";

export type Region = { start: number; end: number };

/**
 * Finds regions where the windowed RMS (loudest channel) stays below
 * `thresholdDb` dBFS for at least `minDuration` seconds.
 */
export function detectSilence(a: Pcm, thresholdDb: number, minDuration: number, windowMs = 10): Region[] {
  const sr = a.sampleRate;
  const n = frames(a);
  const win = Math.max(1, Math.round((windowMs / 1000) * sr));
  const thr = Math.pow(10, thresholdDb / 20);
  const thrSq = thr * thr;
  const regions: Region[] = [];
  let runStart = -1;
  const windows = Math.ceil(n / win);
  for (let w = 0; w < windows; w++) {
    const s = w * win;
    const e = Math.min(n, s + win);
    let quiet = true;
    for (const c of a.channels) {
      let ss = 0;
      for (let i = s; i < e; i++) ss += c[i] * c[i];
      if (ss / (e - s) > thrSq) {
        quiet = false;
        break;
      }
    }
    if (quiet && runStart < 0) runStart = s;
    if ((!quiet || w === windows - 1) && runStart >= 0) {
      const end = quiet ? e : s;
      if ((end - runStart) / sr >= minDuration) regions.push({ start: runStart / sr, end: end / sr });
      runStart = -1;
    }
  }
  return regions;
}

/**
 * Removes or shortens silent regions. `keep` is the total silence (seconds)
 * left in place of each region (0 removes it entirely); half of it stays on
 * each side so the transition remains natural. Joins use a short crossfade.
 */
export function shortenSilences(a: Pcm, regions: Region[], keep: number, fadeMs = 5): Pcm {
  if (!regions.length) return a;
  const total = durationOf(a);
  const parts: Pcm[] = [];
  let cursor = 0;
  for (const r of regions) {
    const len = r.end - r.start;
    if (len <= keep) continue;
    // Leading silence keeps its tail, trailing silence keeps its head, inner silence keeps both halves.
    const atStart = r.start <= 1e-9;
    const atEnd = r.end >= total - 1e-9;
    let cs: number, cutEnd: number;
    if (atEnd) {
      cs = r.start + keep;
      cutEnd = r.end;
    } else if (atStart) {
      cs = r.start;
      cutEnd = r.end - keep;
    } else {
      cs = r.start + keep / 2;
      cutEnd = r.end - keep / 2;
    }
    if (cutEnd - cs <= 0 || cs < cursor) continue;
    parts.push(sliceSeconds(a, cursor, cs));
    cursor = cutEnd;
  }
  parts.push(sliceSeconds(a, cursor, total));
  return concat(parts, { crossfade: fadeMs / 1000 });
}

/** Cut points (seconds, ascending, excluding 0 and the end) for N equal parts. */
export function equalSplitPoints(duration: number, parts: number): number[] {
  const p = Math.max(1, Math.floor(parts));
  return Array.from({ length: p - 1 }, (_, i) => ((i + 1) * duration) / p);
}

/** Cut points every `interval` seconds. */
export function intervalSplitPoints(duration: number, interval: number): number[] {
  if (!(interval > 0)) return [];
  const pts: number[] = [];
  for (let t = interval; t < duration - 1e-6; t += interval) pts.push(Math.round(t * 1e6) / 1e6);
  return pts;
}

/** Converts sorted cut points into [start, end] segments covering 0..duration. */
export function pointsToSegments(points: number[], duration: number): Region[] {
  const pts = [...new Set(points.filter((p) => p > 0 && p < duration))].sort((x, y) => x - y);
  const edges = [0, ...pts, duration];
  const out: Region[] = [];
  for (let i = 0; i < edges.length - 1; i++) if (edges[i + 1] - edges[i] > 1e-6) out.push({ start: edges[i], end: edges[i + 1] });
  return out;
}

/**
 * Segments between silences: each sound region becomes one segment. When
 * `dropSilence` is false, segments are cut at the middle of each silence so
 * nothing is lost.
 */
export function silenceSegments(duration: number, silences: Region[], dropSilence: boolean): Region[] {
  if (!dropSilence) {
    const mids = silences.filter((r) => r.start > 0 && r.end < duration).map((r) => (r.start + r.end) / 2);
    return pointsToSegments(mids, duration);
  }
  const out: Region[] = [];
  let cursor = 0;
  for (const r of silences) {
    if (r.start - cursor > 1e-6) out.push({ start: cursor, end: r.start });
    cursor = Math.max(cursor, r.end);
  }
  if (duration - cursor > 1e-6) out.push({ start: cursor, end: duration });
  return out;
}

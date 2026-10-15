/**
 * Time stretching with WSOLA (waveform-similarity overlap-add) and pitch
 * shifting built on top of it (stretch, then resample back to the original
 * length). Pure TypeScript; long jobs yield to the event loop periodically.
 */
import { changeSpeedTape, frames, type Pcm, type ProgressOpts } from "./pcm";

const yieldNow = () => new Promise<void>((r) => setTimeout(r, 0));

function hann(n: number) {
  const w = new Float32Array(n);
  // Periodic Hann: overlapping copies at hop n/2 sum exactly to 1.
  for (let i = 0; i < n; i++) w[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / n);
  return w;
}

export type StretchParams = {
  /** Frame length in seconds (default 0.05). */
  frame?: number;
  /** Search tolerance in seconds either side (default 0.012). */
  tolerance?: number;
};

/**
 * Changes playback speed while keeping pitch. speed > 1 shortens.
 * Output length ≈ input length / speed.
 */
export async function timeStretch(a: Pcm, speed: number, opts: ProgressOpts & StretchParams = {}): Promise<Pcm> {
  const n = frames(a);
  const sr = a.sampleRate;
  if (Math.abs(speed - 1) < 1e-9 || n === 0) return { sampleRate: sr, channels: a.channels.map((c) => c.slice()) };
  let N = Math.round((opts.frame ?? 0.05) * sr);
  N += N % 2; // even
  const Hs = N / 2; // synthesis hop
  const Ha = Hs * speed; // analysis hop
  const tol = Math.max(1, Math.round((opts.tolerance ?? 0.012) * sr));
  const outLen = Math.floor(n / speed);
  const win = hann(N);
  const chs = a.channels.length;

  // Mono guide signal for the similarity search.
  const guide = new Float32Array(n);
  for (const c of a.channels) for (let i = 0; i < n; i++) guide[i] += c[i];

  const out = Array.from({ length: chs }, () => new Float32Array(outLen + N));
  const norm = new Float32Array(outLen + N);
  const frameCount = Math.ceil(outLen / Hs) + 1;

  // Overlap region used for comparison: the first half of the new frame
  // against the natural continuation of the previously copied frame.
  const L = Hs;
  const coarse = 4;
  let prevStart = 0; // input start of the previously copied frame
  for (let k = 0; k < frameCount; k++) {
    if (k % 256 === 0 && k > 0) {
      if (opts.signal?.aborted) throw new DOMException("Cancelled", "AbortError");
      opts.onProgress?.(k / frameCount);
      await yieldNow();
    }
    const nominal = Math.round(k * Ha);
    let best = nominal;
    if (k > 0) {
      const target = prevStart + Hs; // natural continuation
      const lo = Math.max(0, nominal - tol);
      const hi = Math.min(n - L - 1, nominal + tol);
      if (hi > lo && target + L < n) {
        const score = (s: number, step: number) => {
          let acc = 0;
          for (let i = 0; i < L; i += step) acc += guide[s + i] * guide[target + i];
          return acc;
        };
        let bestScore = -Infinity;
        for (let s = lo; s <= hi; s += coarse) {
          const v = score(s, coarse);
          if (v > bestScore) {
            bestScore = v;
            best = s;
          }
        }
        const c0 = best;
        bestScore = -Infinity;
        for (let s = Math.max(lo, c0 - coarse); s <= Math.min(hi, c0 + coarse); s++) {
          const v = score(s, 1);
          if (v > bestScore) {
            bestScore = v;
            best = s;
          }
        }
      } else best = Math.max(0, Math.min(n - 1, nominal));
    }
    prevStart = best;
    const o = k * Hs;
    for (let i = 0; i < N; i++) {
      const src = best + i;
      const dst = o + i;
      if (dst >= out[0].length) break;
      const w = win[i];
      norm[dst] += w;
      if (src >= n) continue;
      for (let c = 0; c < chs; c++) out[c][dst] += a.channels[c][src] * w;
    }
  }
  const result = out.map((c) => {
    const r = new Float32Array(outLen);
    for (let i = 0; i < outLen; i++) r[i] = norm[i] > 1e-3 ? c[i] / norm[i] : c[i];
    return r;
  });
  opts.onProgress?.(1);
  return { sampleRate: sr, channels: result };
}

/** Frequency ratio for a shift in semitones and cents. */
export const pitchRatio = (semitones: number, cents = 0) => Math.pow(2, (semitones + cents / 100) / 12);

/**
 * Pitch shift that keeps duration: stretch the audio to `ratio` × its length,
 * then resample by `ratio` so it plays back in the original time at the new pitch.
 */
export async function pitchShift(a: Pcm, ratio: number, opts: ProgressOpts = {}): Promise<Pcm> {
  if (Math.abs(ratio - 1) < 1e-9) return { sampleRate: a.sampleRate, channels: a.channels.map((c) => c.slice()) };
  const stretched = await timeStretch(a, 1 / ratio, {
    signal: opts.signal,
    onProgress: (p) => opts.onProgress?.(p * 0.6),
  });
  const shifted = await changeSpeedTape(stretched, ratio, {
    signal: opts.signal,
    onProgress: (p) => opts.onProgress?.(0.6 + p * 0.4),
  });
  // Match the original length exactly (rounding can differ by a few samples).
  const n = frames(a);
  return {
    sampleRate: a.sampleRate,
    channels: shifted.channels.map((c) => {
      if (c.length === n) return c;
      const r = new Float32Array(n);
      r.set(c.subarray(0, Math.min(n, c.length)));
      return r;
    }),
  };
}

/**
 * Planar PCM audio helpers. Pure TypeScript, no DOM, so they can be unit-tested
 * in Node. Samples are 32-bit float in the nominal range [-1, 1].
 */

export type Pcm = {
  sampleRate: number;
  /** One Float32Array per channel, all the same length. */
  channels: Float32Array[];
};

export const frames = (a: Pcm) => (a.channels[0]?.length ?? 0);
export const durationOf = (a: Pcm) => (a.sampleRate > 0 ? frames(a) / a.sampleRate : 0);

export const dbToGain = (db: number) => Math.pow(10, db / 20);
export const gainToDb = (g: number) => (g > 0 ? 20 * Math.log10(g) : -Infinity);

export function emptyLike(a: Pcm, length: number): Pcm {
  return { sampleRate: a.sampleRate, channels: a.channels.map(() => new Float32Array(Math.max(0, Math.round(length)))) };
}

export function clonePcm(a: Pcm): Pcm {
  return { sampleRate: a.sampleRate, channels: a.channels.map((c) => c.slice()) };
}

/** Copies frames [start, end) (seconds), clamped to the signal. */
export function sliceSeconds(a: Pcm, start: number, end: number): Pcm {
  const n = frames(a);
  const s = Math.max(0, Math.min(n, Math.round(start * a.sampleRate)));
  const e = Math.max(s, Math.min(n, Math.round(end * a.sampleRate)));
  return { sampleRate: a.sampleRate, channels: a.channels.map((c) => c.slice(s, e)) };
}

/** Removes frames [start, end) (seconds) and joins the remaining parts with a short crossfade. */
export function cutSeconds(a: Pcm, start: number, end: number, fadeMs = 5): Pcm {
  const head = sliceSeconds(a, 0, start);
  const tail = sliceSeconds(a, end, durationOf(a));
  return concat([head, tail], { crossfade: Math.min(fadeMs / 1000, durationOf(head) / 2, durationOf(tail) / 2) });
}

/** Mixes/expands channels to `count` (1 or 2 typical). Downmix averages; upmix duplicates mono. */
export function toChannelCount(a: Pcm, count: number): Pcm {
  const src = a.channels;
  if (src.length === count) return a;
  const n = frames(a);
  if (count === 1) {
    const out = new Float32Array(n);
    for (const c of src) for (let i = 0; i < n; i++) out[i] += c[i];
    const k = 1 / src.length;
    for (let i = 0; i < n; i++) out[i] *= k;
    return { sampleRate: a.sampleRate, channels: [out] };
  }
  if (src.length === 1) return { sampleRate: a.sampleRate, channels: Array.from({ length: count }, () => src[0].slice()) };
  if (src.length > count) {
    // Simple fold-down: keep the first `count` channels and average the rest into them evenly.
    const out = Array.from({ length: count }, (_, i) => src[i].slice());
    for (let j = count; j < src.length; j++) {
      const target = out[j % count];
      for (let i = 0; i < n; i++) target[i] += src[j][i];
    }
    const per = src.length / count;
    for (const o of out) for (let i = 0; i < n; i++) o[i] /= per;
    return { sampleRate: a.sampleRate, channels: out };
  }
  // 2 -> more: pad with silence copies of existing pattern
  return { sampleRate: a.sampleRate, channels: Array.from({ length: count }, (_, i) => src[i % src.length].slice()) };
}

export function mixToMono(a: Pcm): Float32Array {
  return toChannelCount(a, 1).channels[0];
}

export function applyGain(a: Pcm, gain: number): Pcm {
  return {
    sampleRate: a.sampleRate,
    channels: a.channels.map((c) => {
      const o = new Float32Array(c.length);
      for (let i = 0; i < c.length; i++) o[i] = c[i] * gain;
      return o;
    }),
  };
}

export function reversePcm(a: Pcm): Pcm {
  return { sampleRate: a.sampleRate, channels: a.channels.map((c) => c.slice().reverse()) };
}

/** Highest absolute sample value across channels (linear). */
export function peakOf(a: Pcm): number {
  let p = 0;
  for (const c of a.channels)
    for (let i = 0; i < c.length; i++) {
      const v = Math.abs(c[i]);
      if (v > p) p = v;
    }
  return p;
}

/** RMS over all channels and frames (linear). */
export function rmsOf(a: Pcm): number {
  let s = 0;
  let n = 0;
  for (const c of a.channels) {
    for (let i = 0; i < c.length; i++) s += c[i] * c[i];
    n += c.length;
  }
  return n ? Math.sqrt(s / n) : 0;
}

/** Number of samples whose absolute value is at or above 1.0 (would clip in fixed-point formats). */
export function clippedSamples(a: Pcm): number {
  let k = 0;
  for (const c of a.channels) for (let i = 0; i < c.length; i++) if (Math.abs(c[i]) >= 1) k++;
  return k;
}

/* ------------------------------------------------------------------ */
/* Fades                                                               */
/* ------------------------------------------------------------------ */

export type FadeShape = "linear" | "exponential" | "logarithmic" | "s-curve";

/**
 * Fade-in gain for position x in [0, 1] (fade-outs use curve(1 - x)).
 * exponential: slow start, fast finish (cubic, x^3).
 * logarithmic: fast start, slow finish (1 - (1 - x)^3).
 * s-curve: raised cosine (0.5 - 0.5 cos πx).
 */
export function fadeCurve(shape: FadeShape, x: number): number {
  const t = Math.max(0, Math.min(1, x));
  switch (shape) {
    case "linear":
      return t;
    case "exponential":
      return t * t * t;
    case "logarithmic":
      return 1 - (1 - t) * (1 - t) * (1 - t);
    case "s-curve":
      return 0.5 - 0.5 * Math.cos(Math.PI * t);
  }
}

export function applyFades(
  a: Pcm,
  opts: { fadeIn: number; fadeOut: number; inShape: FadeShape; outShape: FadeShape },
): Pcm {
  const n = frames(a);
  const fi = Math.min(n, Math.max(0, Math.round(opts.fadeIn * a.sampleRate)));
  const fo = Math.min(n, Math.max(0, Math.round(opts.fadeOut * a.sampleRate)));
  return {
    sampleRate: a.sampleRate,
    channels: a.channels.map((c) => {
      const o = c.slice();
      for (let i = 0; i < fi; i++) o[i] *= fadeCurve(opts.inShape, i / fi);
      for (let i = 0; i < fo; i++) {
        const idx = n - fo + i;
        // i = 0 → gain 1, last sample → near 0
        o[idx] *= fadeCurve(opts.outShape, 1 - (i + 1) / fo);
      }
      return o;
    }),
  };
}

/* ------------------------------------------------------------------ */
/* Concatenation                                                       */
/* ------------------------------------------------------------------ */

/**
 * Joins clips that already share sample rate and channel count.
 * `gap` inserts silence (seconds) between clips; `crossfade` overlaps
 * neighbouring clips with an equal-power crossfade (seconds). Only one of the
 * two is applied: crossfade wins when both are > 0.
 */
export function concat(parts: Pcm[], opts: { gap?: number; crossfade?: number } = {}): Pcm {
  const list = parts.filter((p) => frames(p) > 0);
  if (list.length === 0) return parts[0] ? emptyLike(parts[0], 0) : { sampleRate: 44100, channels: [new Float32Array(0)] };
  const sr = list[0].sampleRate;
  const chs = list[0].channels.length;
  const gap = Math.max(0, Math.round((opts.gap ?? 0) * sr));
  const xfReq = Math.max(0, Math.round((opts.crossfade ?? 0) * sr));
  // Crossfade per boundary is limited by the shorter neighbour.
  const xf: number[] = [];
  for (let i = 0; i < list.length - 1; i++) xf.push(Math.min(xfReq, frames(list[i]), frames(list[i + 1])));
  let total = 0;
  list.forEach((p, i) => {
    total += frames(p);
    if (i < list.length - 1) total += xfReq > 0 ? -xf[i] : gap;
  });
  const out: Float32Array[] = Array.from({ length: chs }, () => new Float32Array(total));
  let pos = 0;
  list.forEach((p, i) => {
    const n = frames(p);
    const fadeHead = i > 0 && xfReq > 0 ? xf[i - 1] : 0;
    const fadeTail = i < list.length - 1 && xfReq > 0 ? xf[i] : 0;
    for (let c = 0; c < chs; c++) {
      const src = p.channels[c];
      const dst = out[c];
      for (let k = 0; k < n; k++) {
        let g = 1;
        if (k < fadeHead) g *= Math.sin((0.5 * Math.PI * (k + 0.5)) / fadeHead);
        if (k >= n - fadeTail) g *= Math.cos((0.5 * Math.PI * (k - (n - fadeTail) + 0.5)) / fadeTail);
        dst[pos + k] += src[k] * g;
      }
    }
    pos += n;
    if (i < list.length - 1) pos += xfReq > 0 ? -xf[i] : gap;
  });
  return { sampleRate: sr, channels: out };
}

/* ------------------------------------------------------------------ */
/* Resampling (windowed sinc)                                          */
/* ------------------------------------------------------------------ */

const yieldNow = () => new Promise<void>((r) => setTimeout(r, 0));

export type ProgressOpts = { onProgress?: (p: number) => void; signal?: AbortSignal };

function checkAbort(signal?: AbortSignal) {
  if (signal?.aborted) throw new DOMException("Cancelled", "AbortError");
}

/**
 * Reads the input at a fractional step: output[i] = input(i * step).
 * step > 1 shortens (and raises pitch if played at the same rate), step < 1
 * lengthens. A Blackman-windowed sinc with cutoff min(1, 1/step) prevents
 * aliasing when shortening.
 */
export async function resampleChannel(
  input: Float32Array,
  step: number,
  outLength: number,
  opts: ProgressOpts & { halfTaps?: number; progressBase?: number; progressSpan?: number } = {},
): Promise<Float32Array> {
  const out = new Float32Array(outLength);
  const n = input.length;
  if (n === 0 || outLength === 0) return out;
  if (Math.abs(step - 1) < 1e-12) {
    out.set(input.subarray(0, Math.min(n, outLength)));
    return out;
  }
  const cutoff = Math.min(1, 1 / step);
  const zc = opts.halfTaps ?? 12; // zero crossings each side
  const half = Math.ceil(zc / cutoff);
  // Tabulated kernel: sinc(d * cutoff) * Blackman(d / half), RES points per input sample.
  const RES = 512;
  const tableLen = half * RES + 2;
  const table = new Float32Array(tableLen);
  for (let i = 0; i < tableLen; i++) {
    const d = i / RES;
    const u = d / half;
    if (u >= 1) continue;
    const t = d * cutoff;
    const sinc = t === 0 ? 1 : Math.sin(Math.PI * t) / (Math.PI * t);
    table[i] = sinc * (0.42 + 0.5 * Math.cos(Math.PI * u) + 0.08 * Math.cos(2 * Math.PI * u));
  }
  const base = opts.progressBase ?? 0;
  const span = opts.progressSpan ?? 1;
  const chunk = 1 << 16;
  for (let i = 0; i < outLength; i++) {
    if ((i & (chunk - 1)) === 0 && i > 0) {
      checkAbort(opts.signal);
      opts.onProgress?.(base + (span * i) / outLength);
      await yieldNow();
    }
    const x = i * step;
    const xi = Math.floor(x);
    let acc = 0;
    let wsum = 0;
    const lo = Math.max(0, xi - half + 1);
    const hi = Math.min(n - 1, xi + half);
    for (let j = lo; j <= hi; j++) {
      const pos = Math.abs(x - j) * RES;
      const ti = pos | 0;
      if (ti >= tableLen - 1) continue;
      const fr = pos - ti;
      const k = table[ti] + (table[ti + 1] - table[ti]) * fr;
      acc += input[j] * k;
      wsum += k;
    }
    // Normalising by the kernel sum keeps DC gain at exactly 1 near edges.
    out[i] = wsum !== 0 ? acc / wsum : 0;
  }
  return out;
}

/** Converts to a new sample rate (same duration). */
export async function resample(a: Pcm, targetRate: number, opts: ProgressOpts = {}): Promise<Pcm> {
  if (a.sampleRate === targetRate) return a;
  const step = a.sampleRate / targetRate;
  const outLen = Math.round(frames(a) / step);
  const chs: Float32Array[] = [];
  for (let c = 0; c < a.channels.length; c++) {
    chs.push(
      await resampleChannel(a.channels[c], step, outLen, {
        ...opts,
        progressBase: c / a.channels.length,
        progressSpan: 1 / a.channels.length,
      }),
    );
  }
  opts.onProgress?.(1);
  return { sampleRate: targetRate, channels: chs };
}

/** Tape-style speed change: plays `speed` times faster, pitch moves with it. */
export async function changeSpeedTape(a: Pcm, speed: number, opts: ProgressOpts = {}): Promise<Pcm> {
  const outLen = Math.floor(frames(a) / speed);
  const chs: Float32Array[] = [];
  for (let c = 0; c < a.channels.length; c++) {
    chs.push(
      await resampleChannel(a.channels[c], speed, outLen, {
        ...opts,
        progressBase: c / a.channels.length,
        progressSpan: 1 / a.channels.length,
      }),
    );
  }
  opts.onProgress?.(1);
  return { sampleRate: a.sampleRate, channels: chs };
}

/* ------------------------------------------------------------------ */
/* Time formatting                                                     */
/* ------------------------------------------------------------------ */

/** 75.5 → "1:15.500"; hours shown when needed. */
export function formatTime(sec: number, decimals = 3): string {
  if (!Number.isFinite(sec) || sec < 0) sec = 0;
  const factor = 10 ** decimals;
  const total = Math.round(sec * factor) / factor;
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total - h * 3600 - m * 60;
  const sStr = decimals > 0 ? s.toFixed(decimals).padStart(decimals + 3, "0") : String(Math.round(s)).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${sStr}` : `${m}:${sStr}`;
}

/** Parses "75.5", "1:15.5", "0:01:15.5" into seconds, or null. */
export function parseTime(raw: string): number | null {
  const s = raw.trim();
  if (!s) return null;
  if (!/^\d+(:\d+){0,2}(\.\d+)?$/.test(s) && !/^\d*\.\d+$/.test(s)) return null;
  const parts = s.split(":");
  let total = 0;
  for (let i = 0; i < parts.length; i++) {
    const v = Number(parts[i]);
    if (!Number.isFinite(v)) return null;
    if (i > 0 && v >= 60) return null;
    total = total * 60 + v;
  }
  return total;
}

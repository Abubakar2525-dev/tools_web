/**
 * ITU-R BS.1770-4 loudness measurement (K-weighting, 400 ms gated blocks,
 * absolute -70 LUFS and relative -10 LU gates), 4x oversampled true-peak
 * estimation and a look-ahead peak limiter.
 */
import { frames, type Pcm } from "./pcm";

export type Biquad = { b0: number; b1: number; b2: number; a1: number; a2: number };

/**
 * K-weighting filter pair for any sample rate. Coefficients are derived from
 * the analog prototypes behind the 48 kHz values printed in BS.1770 (same
 * derivation as libebur128), so at 48 kHz they reproduce the published table.
 */
export function kWeighting(fs: number): [Biquad, Biquad] {
  // Stage 1: high-shelf (+4 dB above ~1.5 kHz, models the head).
  let f0 = 1681.974450955533;
  const G = 3.999843853973347;
  let Q = 0.7071752369554196;
  let K = Math.tan((Math.PI * f0) / fs);
  const Vh = Math.pow(10, G / 20);
  const Vb = Math.pow(Vh, 0.4996667741545416);
  let a0 = 1 + K / Q + K * K;
  const shelf: Biquad = {
    b0: (Vh + (Vb * K) / Q + K * K) / a0,
    b1: (2 * (K * K - Vh)) / a0,
    b2: (Vh - (Vb * K) / Q + K * K) / a0,
    a1: (2 * (K * K - 1)) / a0,
    a2: (1 - K / Q + K * K) / a0,
  };
  // Stage 2: RLB high-pass (~38 Hz).
  f0 = 38.13547087602444;
  Q = 0.5003270373238773;
  K = Math.tan((Math.PI * f0) / fs);
  a0 = 1 + K / Q + K * K;
  const hp: Biquad = { b0: 1, b1: -2, b2: 1, a1: (2 * (K * K - 1)) / a0, a2: (1 - K / Q + K * K) / a0 };
  return [shelf, hp];
}

function filter(x: Float32Array, f: Biquad): Float64Array {
  const y = new Float64Array(x.length);
  let x1 = 0,
    x2 = 0,
    y1 = 0,
    y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const xi = x[i];
    const yi = f.b0 * xi + f.b1 * x1 + f.b2 * x2 - f.a1 * y1 - f.a2 * y2;
    x2 = x1;
    x1 = xi;
    y2 = y1;
    y1 = yi;
    y[i] = yi;
  }
  return y;
}

function filter64(x: Float64Array, f: Biquad): Float64Array {
  const y = new Float64Array(x.length);
  let x1 = 0,
    x2 = 0,
    y1 = 0,
    y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const xi = x[i];
    const yi = f.b0 * xi + f.b1 * x1 + f.b2 * x2 - f.a1 * y1 - f.a2 * y2;
    x2 = x1;
    x1 = xi;
    y2 = y1;
    y1 = yi;
    y[i] = yi;
  }
  return y;
}

/** Channel weights for BS.1770: L, R, C = 1.0; LFE excluded; surrounds 1.41 (5.1 order L R C LFE Ls Rs). */
export function channelWeights(count: number): number[] {
  if (count === 6) return [1, 1, 1, 0, 1.41, 1.41];
  if (count === 5) return [1, 1, 1, 1.41, 1.41];
  return Array.from({ length: count }, () => 1);
}

export type LoudnessResult = {
  /** Integrated loudness in LUFS (-Infinity when everything is gated out). */
  integrated: number;
  /** Highest momentary (400 ms) loudness in LUFS. */
  maxMomentary: number;
  /** Number of 400 ms blocks that passed both gates. */
  gatedBlocks: number;
};

const lufs = (ms: number) => (ms > 0 ? -0.691 + 10 * Math.log10(ms) : -Infinity);

export function integratedLoudness(a: Pcm): LoudnessResult {
  const sr = a.sampleRate;
  const n = frames(a);
  const [s1, s2] = kWeighting(sr);
  const w = channelWeights(a.channels.length);
  const block = Math.round(0.4 * sr);
  const step = Math.round(0.1 * sr); // 75% overlap
  if (n < block) {
    // Shorter than one gating block: measure the whole clip as a single block.
    let sum = 0;
    a.channels.forEach((c, ci) => {
      if (!w[ci]) return;
      const y = filter64(filter(c, s1), s2);
      let ss = 0;
      for (let i = 0; i < y.length; i++) ss += y[i] * y[i];
      sum += w[ci] * (n ? ss / n : 0);
    });
    const l = lufs(sum);
    return { integrated: l, maxMomentary: l, gatedBlocks: n ? 1 : 0 };
  }
  // Prefix sums of squared K-weighted samples per channel for fast block energy.
  const blocks = Math.floor((n - block) / step) + 1;
  const energy = new Float64Array(blocks);
  a.channels.forEach((c, ci) => {
    if (!w[ci]) return;
    const y = filter64(filter(c, s1), s2);
    const pre = new Float64Array(n + 1);
    for (let i = 0; i < n; i++) pre[i + 1] = pre[i] + y[i] * y[i];
    for (let j = 0; j < blocks; j++) {
      const s = j * step;
      energy[j] += (w[ci] * (pre[s + block] - pre[s])) / block;
    }
  });
  let maxM = -Infinity;
  let absSum = 0;
  let absCount = 0;
  for (let j = 0; j < blocks; j++) {
    const l = lufs(energy[j]);
    if (l > maxM) maxM = l;
    if (l > -70) {
      absSum += energy[j];
      absCount++;
    }
  }
  if (!absCount) return { integrated: -Infinity, maxMomentary: maxM, gatedBlocks: 0 };
  const rel = lufs(absSum / absCount) - 10;
  let sum = 0;
  let count = 0;
  for (let j = 0; j < blocks; j++) {
    const l = lufs(energy[j]);
    if (l > -70 && l > rel) {
      sum += energy[j];
      count++;
    }
  }
  return { integrated: count ? lufs(sum / count) : -Infinity, maxMomentary: maxM, gatedBlocks: count };
}

/* ------------------------------------------------------------------ */
/* True peak                                                           */
/* ------------------------------------------------------------------ */

const OS = 4;
const TP_TAPS = 12; // taps per phase (48-tap interpolator overall)

/** Polyphase windowed-sinc 4x interpolation filter, phase p = 1..3 (phase 0 is the sample itself). */
function tpPhases(): Float64Array[] {
  const phases: Float64Array[] = [];
  const half = TP_TAPS / 2;
  for (let p = 1; p < OS; p++) {
    const frac = p / OS;
    const h = new Float64Array(TP_TAPS);
    let sum = 0;
    for (let k = 0; k < TP_TAPS; k++) {
      const d = k - (half - 1) - frac; // distance from interpolation point (taps at -5..6 relative)
      const t = Math.PI * d;
      const sinc = d === 0 ? 1 : Math.sin(t) / t;
      const u = d / (half + 1);
      const win = Math.abs(u) >= 1 ? 0 : 0.5 + 0.5 * Math.cos(Math.PI * u);
      h[k] = sinc * win;
      sum += h[k];
    }
    for (let k = 0; k < TP_TAPS; k++) h[k] /= sum;
    phases.push(h);
  }
  return phases;
}

let cachedPhases: Float64Array[] | null = null;

/**
 * Per-sample absolute peak including interpolated points between this sample
 * and the next (max over channels). Used for true-peak detection and limiting.
 */
export function truePeakEnvelope(a: Pcm): Float32Array {
  const phases = (cachedPhases ??= tpPhases());
  const n = frames(a);
  const env = new Float32Array(n);
  const half = TP_TAPS / 2;
  for (const c of a.channels) {
    for (let i = 0; i < n; i++) {
      let m = Math.abs(c[i]);
      // interpolated points between i and i+1, using taps around i
      for (const h of phases) {
        let acc = 0;
        for (let k = 0; k < TP_TAPS; k++) {
          const idx = i - (half - 1) + k;
          if (idx >= 0 && idx < n) acc += c[idx] * h[k];
        }
        const v = Math.abs(acc);
        if (v > m) m = v;
      }
      if (m > env[i]) env[i] = m;
    }
  }
  return env;
}

export function truePeak(a: Pcm): number {
  const env = truePeakEnvelope(a);
  let m = 0;
  for (let i = 0; i < env.length; i++) if (env[i] > m) m = env[i];
  return m;
}

/* ------------------------------------------------------------------ */
/* Limiter                                                             */
/* ------------------------------------------------------------------ */

/**
 * Look-ahead brickwall limiter. Gain is computed so that no sample (or
 * interpolated true-peak point when `truePeakMode`) exceeds `ceiling`
 * (linear). The gain reduction ramps in over the look-ahead window and
 * recovers with an exponential release, so it never overshoots.
 */
export function limit(
  a: Pcm,
  ceiling: number,
  opts: { lookaheadMs?: number; releaseMs?: number; truePeakMode?: boolean } = {},
): { audio: Pcm; maxReductionDb: number } {
  const n = frames(a);
  const sr = a.sampleRate;
  const L = Math.max(1, Math.round(((opts.lookaheadMs ?? 5) / 1000) * sr));
  const rel = 1 - Math.exp(-1 / (((opts.releaseMs ?? 80) / 1000) * sr));
  let env: Float32Array;
  if (opts.truePeakMode) env = truePeakEnvelope(a);
  else {
    env = new Float32Array(n);
    for (const c of a.channels) for (let i = 0; i < n; i++) env[i] = Math.max(env[i], Math.abs(c[i]));
  }
  // Required gain per sample.
  const g = new Float32Array(n);
  for (let i = 0; i < n; i++) g[i] = env[i] > ceiling ? ceiling / env[i] : 1;
  // Forward-looking minimum over [i, i + L] (monotonic deque).
  const minF = new Float32Array(n);
  const dq = new Int32Array(n + L + 1);
  let head = 0,
    tail = 0;
  let next = 0;
  for (let i = 0; i < n; i++) {
    const until = Math.min(n - 1, i + L);
    while (next <= until) {
      while (tail > head && g[dq[tail - 1]] >= g[next]) tail--;
      dq[tail++] = next++;
    }
    while (dq[head] < i) head++;
    minF[i] = g[dq[head]];
  }
  // Moving average over [i - L, i] keeps every value ≤ the minimum needed at i.
  const smooth = new Float32Array(n);
  let acc = 0;
  for (let i = 0; i < n; i++) {
    acc += minF[i];
    if (i - L - 1 >= 0) acc -= minF[i - L - 1];
    const cnt = Math.min(i + 1, L + 1);
    // Before the start, pad with minF[0] (it already covers samples 0..L).
    smooth[i] = (acc + (L + 1 - cnt) * (n ? minF[0] : 1)) / (L + 1);
  }
  // Release smoothing on top; taking the min keeps the guarantee.
  const out = a.channels.map(() => new Float32Array(n));
  let cur = 1;
  let minGain = 1;
  for (let i = 0; i < n; i++) {
    const target = smooth[i];
    cur = target < cur ? target : cur + (target - cur) * rel;
    if (cur > target) cur = target;
    if (cur < minGain) minGain = cur;
    for (let c = 0; c < out.length; c++) out[c][i] = a.channels[c][i] * cur;
  }
  return { audio: { sampleRate: sr, channels: out }, maxReductionDb: minGain < 1 ? -20 * Math.log10(minGain) : 0 };
}

/**
 * Radix-2 FFT, short-time Fourier transform helpers, colour maps and
 * frequency-axis mapping for the spectrogram.
 */

/** In-place iterative radix-2 Cooley-Tukey FFT. Length must be a power of two. */
export function fft(re: Float64Array, im: Float64Array) {
  const n = re.length;
  if (n & (n - 1)) throw new Error("FFT size must be a power of two");
  // Bit reversal
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      let t = re[i];
      re[i] = re[j];
      re[j] = t;
      t = im[i];
      im[i] = im[j];
      im[j] = t;
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wr = Math.cos(ang);
    const wi = Math.sin(ang);
    const half = len >> 1;
    for (let i = 0; i < n; i += len) {
      let cr = 1,
        ci = 0;
      for (let k = 0; k < half; k++) {
        const ar = re[i + k + half];
        const ai = im[i + k + half];
        const tr = ar * cr - ai * ci;
        const ti = ar * ci + ai * cr;
        re[i + k + half] = re[i + k] - tr;
        im[i + k + half] = im[i + k] - ti;
        re[i + k] += tr;
        im[i + k] += ti;
        const ncr = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = ncr;
      }
    }
  }
}

export function hannWindow(n: number): Float64Array {
  const w = new Float64Array(n);
  for (let i = 0; i < n; i++) w[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1));
  return w;
}

/**
 * Magnitude spectrum in dBFS of one frame starting at `start` (zero padded
 * past the end). A full-scale sine reads about 0 dB thanks to the window-gain
 * correction. Returns size/2 + 1 bins.
 */
export function frameSpectrumDb(x: Float32Array, start: number, size: number, win: Float64Array, out?: Float32Array): Float32Array {
  const re = new Float64Array(size);
  const im = new Float64Array(size);
  let wsum = 0;
  for (let i = 0; i < size; i++) {
    const idx = start + i;
    re[i] = idx >= 0 && idx < x.length ? x[idx] * win[i] : 0;
    wsum += win[i];
  }
  fft(re, im);
  const bins = size / 2 + 1;
  const o = out ?? new Float32Array(bins);
  const scale = 2 / wsum;
  for (let k = 0; k < bins; k++) {
    const mag = Math.hypot(re[k], im[k]) * scale;
    o[k] = mag > 1e-12 ? 20 * Math.log10(mag) : -240;
  }
  return o;
}

/* ------------------------------------------------------------------ */
/* Colour maps                                                         */
/* ------------------------------------------------------------------ */

export type ColorMapName = "viridis" | "magma" | "inferno" | "grayscale" | "heat";

// Anchor colours sampled at even steps; intermediate values are interpolated.
const anchors: Record<ColorMapName, [number, number, number][]> = {
  viridis: [
    [68, 1, 84],
    [72, 40, 120],
    [62, 74, 137],
    [49, 104, 142],
    [38, 130, 142],
    [31, 158, 137],
    [53, 183, 121],
    [109, 205, 89],
    [180, 222, 44],
    [253, 231, 37],
  ],
  magma: [
    [0, 0, 4],
    [28, 16, 68],
    [79, 18, 123],
    [129, 37, 129],
    [181, 54, 122],
    [229, 80, 100],
    [251, 135, 97],
    [254, 194, 135],
    [252, 253, 191],
  ],
  inferno: [
    [0, 0, 4],
    [31, 12, 72],
    [85, 15, 109],
    [136, 34, 106],
    [186, 54, 85],
    [227, 89, 51],
    [249, 140, 10],
    [249, 201, 50],
    [252, 255, 164],
  ],
  grayscale: [
    [0, 0, 0],
    [255, 255, 255],
  ],
  heat: [
    [0, 0, 0],
    [90, 0, 0],
    [200, 30, 0],
    [255, 140, 0],
    [255, 230, 80],
    [255, 255, 255],
  ],
};

/** 256-entry RGB lookup table. */
export function colorLut(name: ColorMapName): Uint8ClampedArray {
  const a = anchors[name];
  const lut = new Uint8ClampedArray(256 * 3);
  for (let i = 0; i < 256; i++) {
    const t = (i / 255) * (a.length - 1);
    const k = Math.min(a.length - 2, Math.floor(t));
    const f = t - k;
    for (let c = 0; c < 3; c++) lut[i * 3 + c] = Math.round(a[k][c] + (a[k + 1][c] - a[k][c]) * f);
  }
  return lut;
}

/* ------------------------------------------------------------------ */
/* Frequency axis                                                      */
/* ------------------------------------------------------------------ */

/**
 * Frequency (Hz) shown at fractional height y (0 = bottom, 1 = top).
 * Log scale spans minHz..maxHz.
 */
export function yToFreq(y: number, scale: "linear" | "log", maxHz: number, minHz = 20): number {
  if (scale === "linear") return y * maxHz;
  return minHz * Math.pow(maxHz / minHz, y);
}

export function freqToY(f: number, scale: "linear" | "log", maxHz: number, minHz = 20): number {
  if (scale === "linear") return f / maxHz;
  if (f <= minHz) return 0;
  return Math.log(f / minHz) / Math.log(maxHz / minHz);
}

/** Tick frequencies for an axis. */
export function freqTicks(scale: "linear" | "log", maxHz: number): number[] {
  if (scale === "log") return [50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000].filter((f) => f < maxHz);
  const step = maxHz > 16000 ? 4000 : maxHz > 8000 ? 2000 : maxHz > 4000 ? 1000 : 500;
  const out: number[] = [];
  for (let f = 0; f <= maxHz; f += step) out.push(f);
  return out;
}

export const formatHz = (f: number) => (f >= 1000 ? `${Math.round(f / 100) / 10} kHz` : `${Math.round(f)} Hz`);

/** Maps a dB value into 0..255 for the colour LUT. */
export function dbToIndex(db: number, floorDb: number, ceilDb = 0): number {
  const t = (db - floorDb) / (ceilDb - floorDb);
  return Math.max(0, Math.min(255, Math.round(t * 255)));
}

/**
 * Pixel operations on RGBA buffers (same layout as canvas ImageData).
 * Everything works on row or column ranges so callers can split large images
 * into chunks and keep the page responsive (see `runChunked`).
 */

export type Img = { width: number; height: number; data: Uint8ClampedArray };

const clamp255 = (v: number) => (v < 0 ? 0 : v > 255 ? 255 : v);

/* ------------------------------------------------------------------ */
/* Chunk runner                                                        */
/* ------------------------------------------------------------------ */

export class CancelledError extends Error {
  constructor() {
    super("Cancelled.");
    this.name = "CancelledError";
  }
}

/**
 * Calls `work(from, to)` over [0, total) in steps of `step`, yielding to the
 * event loop between steps. Throws CancelledError when `signal` aborts.
 */
export async function runChunked(
  total: number,
  step: number,
  work: (from: number, to: number) => void,
  opts: { signal?: AbortSignal; onProgress?: (done: number) => void } = {},
) {
  for (let i = 0; i < total; i += step) {
    if (opts.signal?.aborted) throw new CancelledError();
    work(i, Math.min(total, i + step));
    opts.onProgress?.(Math.min(total, i + step) / total);
    await new Promise<void>((r) => setTimeout(r, 0));
  }
}

/** Picks a row-chunk size that keeps each step around `budget` pixels. */
export const rowsPerChunk = (width: number, budget = 400_000) => Math.max(1, Math.floor(budget / Math.max(1, width)));

/* ------------------------------------------------------------------ */
/* Color adjustments                                                   */
/* ------------------------------------------------------------------ */

export type Adjustments = {
  /** Stops, -2..2 (applied in linear light). */
  exposure: number;
  /** -100..100, additive. */
  brightness: number;
  /** -100..100. */
  contrast: number;
  /** -100..100 (−100 = grayscale). */
  saturation: number;
  /** Degrees, -180..180. */
  hue: number;
  /** -100 (cooler, bluer) .. 100 (warmer, more amber). */
  temperature: number;
  /** -100 (greener) .. 100 (more magenta). */
  tint: number;
};

export const NEUTRAL_ADJUSTMENTS: Adjustments = { exposure: 0, brightness: 0, contrast: 0, saturation: 0, hue: 0, temperature: 0, tint: 0 };

const srgbToLinear = (v: number) => {
  const c = v / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
};
const linearToSrgb = (l: number) => {
  const c = l <= 0.0031308 ? l * 12.92 : 1.055 * Math.pow(l, 1 / 2.4) - 0.055;
  return clamp255(c * 255);
};

/** Contrast factor from the common 259-based formula; c in -100..100. */
export function contrastFactor(c: number) {
  const C = c * 2.55;
  return (259 * (C + 255)) / (255 * (259 - C));
}

type Mat3 = [number, number, number, number, number, number, number, number, number];

const mul3 = (a: Mat3, b: Mat3): Mat3 => [
  a[0] * b[0] + a[1] * b[3] + a[2] * b[6], a[0] * b[1] + a[1] * b[4] + a[2] * b[7], a[0] * b[2] + a[1] * b[5] + a[2] * b[8],
  a[3] * b[0] + a[4] * b[3] + a[5] * b[6], a[3] * b[1] + a[4] * b[4] + a[5] * b[7], a[3] * b[2] + a[4] * b[5] + a[5] * b[8],
  a[6] * b[0] + a[7] * b[3] + a[8] * b[6], a[6] * b[1] + a[7] * b[4] + a[8] * b[7], a[6] * b[2] + a[7] * b[5] + a[8] * b[8],
];

/** Saturation matrix (same luminance weights as the CSS/SVG saturate filter). */
export function saturationMatrix(s: number): Mat3 {
  return [
    0.213 + 0.787 * s, 0.715 - 0.715 * s, 0.072 - 0.072 * s,
    0.213 - 0.213 * s, 0.715 + 0.285 * s, 0.072 - 0.072 * s,
    0.213 - 0.213 * s, 0.715 - 0.715 * s, 0.072 + 0.928 * s,
  ];
}

/** Hue rotation matrix (as in the SVG feColorMatrix hueRotate definition). */
export function hueMatrix(deg: number): Mat3 {
  const a = (deg * Math.PI) / 180;
  const c = Math.cos(a);
  const s = Math.sin(a);
  return [
    0.213 + c * 0.787 - s * 0.213, 0.715 - c * 0.715 - s * 0.715, 0.072 - c * 0.072 + s * 0.928,
    0.213 - c * 0.213 + s * 0.143, 0.715 + c * 0.285 + s * 0.14, 0.072 - c * 0.072 - s * 0.283,
    0.213 - c * 0.213 - s * 0.787, 0.715 - c * 0.715 + s * 0.715, 0.072 + c * 0.928 + s * 0.072,
  ];
}

export type PreparedAdjust = { lut: Uint8ClampedArray; m: Mat3; dr: number; dg: number; db: number; identityMatrix: boolean };

export function prepareAdjustments(p: Adjustments): PreparedAdjust {
  const lut = new Uint8ClampedArray(256);
  const ev = Math.pow(2, p.exposure);
  const cf = contrastFactor(p.contrast);
  const shift = (p.brightness / 100) * 128;
  for (let v = 0; v < 256; v++) {
    let x = p.exposure ? linearToSrgb(srgbToLinear(v) * ev) : v;
    x += shift;
    x = cf * (x - 128) + 128;
    lut[v] = clamp255(Math.round(x));
  }
  const m = mul3(hueMatrix(p.hue), saturationMatrix(1 + p.saturation / 100));
  const identityMatrix = p.hue === 0 && p.saturation === 0;
  // Temperature: shift red/blue in opposite directions; tint: green against magenta.
  const t = p.temperature * 0.3;
  const g = p.tint * 0.3;
  return { lut, m, dr: t + g * 0.5, dg: -g, db: -t + g * 0.5, identityMatrix };
}

export function adjustRows(img: Img, y0: number, y1: number, pa: PreparedAdjust) {
  const d = img.data;
  const { lut, m, dr, dg, db, identityMatrix } = pa;
  const end = y1 * img.width * 4;
  for (let i = y0 * img.width * 4; i < end; i += 4) {
    let r = lut[d[i]] + dr;
    let g = lut[d[i + 1]] + dg;
    let b = lut[d[i + 2]] + db;
    if (!identityMatrix) {
      const nr = m[0] * r + m[1] * g + m[2] * b;
      const ng = m[3] * r + m[4] * g + m[5] * b;
      const nb = m[6] * r + m[7] * g + m[8] * b;
      r = nr;
      g = ng;
      b = nb;
    }
    d[i] = r;
    d[i + 1] = g;
    d[i + 2] = b;
  }
}

/* ------------------------------------------------------------------ */
/* Point effects                                                       */
/* ------------------------------------------------------------------ */

export type PointEffects = {
  /** 0..1 */
  grayscale: number;
  /** 0..1 */
  sepia: number;
  invert: boolean;
  /** 0..1 darkening at the corners. */
  vignette: number;
  /** 0..1, radius (relative) where darkening starts. */
  vignetteSize: number;
};

export function pointEffectRows(img: Img, y0: number, y1: number, e: PointEffects) {
  const { width: w, height: h, data: d } = img;
  const cx = (w - 1) / 2;
  const cy = (h - 1) / 2;
  const maxD = Math.sqrt(cx * cx + cy * cy) || 1;
  const inner = Math.min(0.95, Math.max(0, e.vignetteSize));
  for (let y = y0; y < y1; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      let r = d[i];
      let g = d[i + 1];
      let b = d[i + 2];
      if (e.grayscale > 0) {
        const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        r += (l - r) * e.grayscale;
        g += (l - g) * e.grayscale;
        b += (l - b) * e.grayscale;
      }
      if (e.sepia > 0) {
        const sr = 0.393 * r + 0.769 * g + 0.189 * b;
        const sg = 0.349 * r + 0.686 * g + 0.168 * b;
        const sb = 0.272 * r + 0.534 * g + 0.131 * b;
        r += (sr - r) * e.sepia;
        g += (sg - g) * e.sepia;
        b += (sb - b) * e.sepia;
      }
      if (e.invert) {
        r = 255 - r;
        g = 255 - g;
        b = 255 - b;
      }
      if (e.vignette > 0) {
        const dx = x - cx;
        const dy = y - cy;
        const dist = Math.sqrt(dx * dx + dy * dy) / maxD;
        let t = (dist - inner) / (1 - inner);
        t = t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t);
        const f = 1 - e.vignette * t;
        r *= f;
        g *= f;
        b *= f;
      }
      d[i] = r;
      d[i + 1] = g;
      d[i + 2] = b;
    }
  }
}

/** Replaces each block with its average color (in place). Process whole block rows. */
export function pixelateRows(img: Img, blockRow0: number, blockRow1: number, block: number) {
  const { width: w, height: h, data: d } = img;
  const n = Math.max(1, Math.round(block));
  for (let by = blockRow0 * n; by < Math.min(h, blockRow1 * n); by += n) {
    const yEnd = Math.min(h, by + n);
    for (let bx = 0; bx < w; bx += n) {
      const xEnd = Math.min(w, bx + n);
      let r = 0, g = 0, b = 0, a = 0, c = 0;
      for (let y = by; y < yEnd; y++)
        for (let x = bx; x < xEnd; x++) {
          const i = (y * w + x) * 4;
          r += d[i]; g += d[i + 1]; b += d[i + 2]; a += d[i + 3]; c++;
        }
      r /= c; g /= c; b /= c; a /= c;
      for (let y = by; y < yEnd; y++)
        for (let x = bx; x < xEnd; x++) {
          const i = (y * w + x) * 4;
          d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = a;
        }
    }
  }
}

export function pixelate(img: Img, block: number) {
  const n = Math.max(1, Math.round(block));
  pixelateRows(img, 0, Math.ceil(img.height / n), n);
}

/* ------------------------------------------------------------------ */
/* Box blur (separable, edge-clamped)                                  */
/* ------------------------------------------------------------------ */

export function boxBlurH(src: Uint8ClampedArray, dst: Uint8ClampedArray, w: number, r: number, y0: number, y1: number) {
  const win = 2 * r + 1;
  for (let y = y0; y < y1; y++) {
    const row = y * w * 4;
    for (let c = 0; c < 4; c++) {
      let sum = 0;
      for (let k = -r; k <= r; k++) sum += src[row + Math.min(w - 1, Math.max(0, k)) * 4 + c];
      for (let x = 0; x < w; x++) {
        dst[row + x * 4 + c] = sum / win;
        const add = Math.min(w - 1, x + r + 1);
        const rem = Math.max(0, x - r);
        sum += src[row + add * 4 + c] - src[row + rem * 4 + c];
      }
    }
  }
}

export function boxBlurV(src: Uint8ClampedArray, dst: Uint8ClampedArray, w: number, h: number, r: number, x0: number, x1: number) {
  const win = 2 * r + 1;
  for (let x = x0; x < x1; x++) {
    for (let c = 0; c < 4; c++) {
      let sum = 0;
      for (let k = -r; k <= r; k++) sum += src[(Math.min(h - 1, Math.max(0, k)) * w + x) * 4 + c];
      for (let y = 0; y < h; y++) {
        dst[(y * w + x) * 4 + c] = sum / win;
        const add = Math.min(h - 1, y + r + 1);
        const rem = Math.max(0, y - r);
        sum += src[(add * w + x) * 4 + c] - src[(rem * w + x) * 4 + c];
      }
    }
  }
}

type RunOpts = { signal?: AbortSignal; onProgress?: (p: number) => void };

/** Three box-blur passes (close to a Gaussian). Returns a new buffer. */
export async function blur(img: Img, radius: number, opts: RunOpts = {}, passes = 3): Promise<Uint8ClampedArray> {
  const { width: w, height: h } = img;
  const r = Math.max(0, Math.round(radius));
  let a = new Uint8ClampedArray(img.data);
  if (r === 0) return a;
  let b = new Uint8ClampedArray(a.length);
  const stepsTotal = passes * 2;
  let step = 0;
  const prog = (p: number) => opts.onProgress?.((step + p) / stepsTotal);
  for (let p = 0; p < passes; p++) {
    await runChunked(h, rowsPerChunk(w), (y0, y1) => boxBlurH(a, b, w, r, y0, y1), { signal: opts.signal, onProgress: prog });
    step++;
    [a, b] = [b, a];
    await runChunked(w, rowsPerChunk(h), (x0, x1) => boxBlurV(a, b, w, h, r, x0, x1), { signal: opts.signal, onProgress: prog });
    step++;
    [a, b] = [b, a];
  }
  return a;
}

/** Synchronous blur for small regions (e.g. redaction boxes). */
export function blurSync(img: Img, radius: number, passes = 3) {
  const { width: w, height: h } = img;
  const r = Math.max(0, Math.round(radius));
  let a = new Uint8ClampedArray(img.data);
  if (r === 0) return a;
  let b = new Uint8ClampedArray(a.length);
  for (let p = 0; p < passes; p++) {
    boxBlurH(a, b, w, r, 0, h);
    [a, b] = [b, a];
    boxBlurV(a, b, w, h, r, 0, w);
    [a, b] = [b, a];
  }
  return a;
}

/** Unsharp mask: out = orig + amount × (orig − blurred). Alpha untouched. */
export function unsharpRows(orig: Uint8ClampedArray, blurred: Uint8ClampedArray, out: Uint8ClampedArray, w: number, amount: number, y0: number, y1: number) {
  for (let i = y0 * w * 4; i < y1 * w * 4; i += 4) {
    out[i] = orig[i] + amount * (orig[i] - blurred[i]);
    out[i + 1] = orig[i + 1] + amount * (orig[i + 1] - blurred[i + 1]);
    out[i + 2] = orig[i + 2] + amount * (orig[i + 2] - blurred[i + 2]);
    out[i + 3] = orig[i + 3];
  }
}

/* ------------------------------------------------------------------ */
/* Median filter (Huang's sliding histogram)                           */
/* ------------------------------------------------------------------ */

/**
 * Median filter over a (2r+1)² window with edge clamping, for rows [y0, y1).
 * With `threshold` > 0 a pixel is replaced only when it differs from the local
 * median by more than the threshold in some channel (impulse/speck removal).
 * Alpha is copied unchanged.
 */
export function medianRows(src: Uint8ClampedArray, dst: Uint8ClampedArray, w: number, h: number, r: number, threshold: number, y0: number, y1: number) {
  const n = (2 * r + 1) * (2 * r + 1);
  const k = n >> 1; // index of the median in sorted order
  const hist = [new Int32Array(256), new Int32Array(256), new Int32Array(256)];
  const cx = (x: number) => (x < 0 ? 0 : x >= w ? w - 1 : x);
  const cy = (y: number) => (y < 0 ? 0 : y >= h ? h - 1 : y);
  const med = [0, 0, 0];
  const lt = [0, 0, 0];
  for (let y = y0; y < y1; y++) {
    for (let c = 0; c < 3; c++) hist[c].fill(0);
    for (let dy = -r; dy <= r; dy++) {
      const row = cy(y + dy) * w;
      for (let dx = -r; dx <= r; dx++) {
        const i = (row + cx(dx)) * 4;
        hist[0][src[i]]++;
        hist[1][src[i + 1]]++;
        hist[2][src[i + 2]]++;
      }
    }
    for (let c = 0; c < 3; c++) {
      let acc = 0;
      let v = 0;
      while (acc + hist[c][v] <= k) acc += hist[c][v++];
      med[c] = v;
      lt[c] = acc;
    }
    for (let x = 0; x < w; x++) {
      if (x > 0) {
        const remX = cx(x - r - 1);
        const addX = cx(x + r);
        for (let dy = -r; dy <= r; dy++) {
          const row = cy(y + dy) * w;
          const ir = (row + remX) * 4;
          const ia = (row + addX) * 4;
          for (let c = 0; c < 3; c++) {
            const vr = src[ir + c];
            hist[c][vr]--;
            if (vr < med[c]) lt[c]--;
            const va = src[ia + c];
            hist[c][va]++;
            if (va < med[c]) lt[c]++;
          }
        }
        for (let c = 0; c < 3; c++) {
          const H = hist[c];
          let m = med[c];
          let l = lt[c];
          while (l > k) {
            m--;
            l -= H[m];
          }
          while (l + H[m] <= k) {
            l += H[m];
            m++;
          }
          med[c] = m;
          lt[c] = l;
        }
      }
      const o = (y * w + x) * 4;
      if (threshold > 0) {
        const diff = Math.max(Math.abs(src[o] - med[0]), Math.abs(src[o + 1] - med[1]), Math.abs(src[o + 2] - med[2]));
        if (diff > threshold) {
          dst[o] = med[0]; dst[o + 1] = med[1]; dst[o + 2] = med[2];
        } else {
          dst[o] = src[o]; dst[o + 1] = src[o + 1]; dst[o + 2] = src[o + 2];
        }
      } else {
        dst[o] = med[0]; dst[o + 1] = med[1]; dst[o + 2] = med[2];
      }
      dst[o + 3] = src[o + 3];
    }
  }
}

/* ------------------------------------------------------------------ */
/* Shared helpers                                                      */
/* ------------------------------------------------------------------ */

/** Luma (Rec. 709) of an RGBA buffer, one byte per pixel. */
export function toGray(rgba: Uint8ClampedArray | Uint8Array) {
  const out = new Uint8Array(rgba.length / 4);
  for (let i = 0, j = 0; i < rgba.length; i += 4, j++) out[j] = Math.round(0.2126 * rgba[i] + 0.7152 * rgba[i + 1] + 0.0722 * rgba[i + 2]);
  return out;
}

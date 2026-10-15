/**
 * Document-scanner image math: projective homography (solved as an 8×8 linear
 * system), inverse-mapped perspective warp with bilinear sampling, and cleanup
 * filters (grayscale with level stretch, adaptive threshold). Pure TS.
 */

export type Pt = { x: number; y: number };
/** Corners in order: top-left, top-right, bottom-right, bottom-left. */
export type Quad = [Pt, Pt, Pt, Pt];
export type RGBA = { data: Uint8ClampedArray; width: number; height: number };

/** Solves A·x = b with Gaussian elimination and partial pivoting. Returns null if singular. */
export function solveLinear(A: number[][], b: number[]): number[] | null {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let col = 0; col < n; col++) {
    let piv = col;
    for (let r = col + 1; r < n; r++) if (Math.abs(M[r][col]) > Math.abs(M[piv][col])) piv = r;
    if (Math.abs(M[piv][col]) < 1e-12) return null;
    [M[col], M[piv]] = [M[piv], M[col]];
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const f = M[r][col] / M[col][col];
      if (f === 0) continue;
      for (let c = col; c <= n; c++) M[r][c] -= f * M[col][c];
    }
  }
  return M.map((row, i) => row[n] / row[i]);
}

/**
 * Homography H (row-major 3×3, h22 = 1) mapping each src point to its dst point:
 * u = (h0 x + h1 y + h2) / (h6 x + h7 y + 1), v = (h3 x + h4 y + h5) / (h6 x + h7 y + 1).
 */
export function solveHomography(src: readonly Pt[], dst: readonly Pt[]): number[] | null {
  const A: number[][] = [];
  const b: number[] = [];
  for (let i = 0; i < 4; i++) {
    const { x, y } = src[i];
    const { x: u, y: v } = dst[i];
    A.push([x, y, 1, 0, 0, 0, -x * u, -y * u]);
    b.push(u);
    A.push([0, 0, 0, x, y, 1, -x * v, -y * v]);
    b.push(v);
  }
  const h = solveLinear(A, b);
  return h ? [...h, 1] : null;
}

export function applyHomography(H: readonly number[], p: Pt): Pt {
  const w = H[6] * p.x + H[7] * p.y + H[8];
  return { x: (H[0] * p.x + H[1] * p.y + H[2]) / w, y: (H[3] * p.x + H[4] * p.y + H[5]) / w };
}

const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);

/** Output size for a quad: the longer of each pair of opposite edges, capped at maxSide. */
export function quadOutputSize(q: Quad, maxSide = 2400) {
  let w = Math.max(dist(q[0], q[1]), dist(q[3], q[2]));
  let h = Math.max(dist(q[0], q[3]), dist(q[1], q[2]));
  const s = Math.min(1, maxSide / Math.max(w, h, 1));
  w = Math.max(1, Math.round(w * s));
  h = Math.max(1, Math.round(h * s));
  return { width: w, height: h };
}

/** True when the four corners form a convex, non-degenerate quadrilateral in order. */
export function isConvexQuad(q: Quad): boolean {
  let sign = 0;
  for (let i = 0; i < 4; i++) {
    const a = q[i];
    const b = q[(i + 1) % 4];
    const c = q[(i + 2) % 4];
    const cross = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
    if (Math.abs(cross) < 1e-6) return false;
    const s = Math.sign(cross);
    if (sign === 0) sign = s;
    else if (s !== sign) return false;
  }
  return true;
}

/**
 * Warps the quad region of `src` to an outW × outH rectangle. Each output pixel
 * is inverse-mapped into the source with the homography and bilinearly sampled.
 */
export function warpPerspective(src: RGBA, quad: Quad, outW: number, outH: number): RGBA {
  const rect: Pt[] = [
    { x: 0, y: 0 },
    { x: outW, y: 0 },
    { x: outW, y: outH },
    { x: 0, y: outH },
  ];
  const H = solveHomography(rect, quad);
  if (!H) throw new Error("These corners do not form a valid shape. Move them apart and try again.");
  const out = new Uint8ClampedArray(outW * outH * 4);
  const { data, width: sw, height: sh } = src;
  const maxX = sw - 1;
  const maxY = sh - 1;
  for (let y = 0; y < outH; y++) {
    const cy = y + 0.5;
    for (let x = 0; x < outW; x++) {
      const cx = x + 0.5;
      const w = H[6] * cx + H[7] * cy + H[8];
      let sx = (H[0] * cx + H[1] * cy + H[2]) / w - 0.5;
      let sy = (H[3] * cx + H[4] * cy + H[5]) / w - 0.5;
      sx = sx < 0 ? 0 : sx > maxX ? maxX : sx;
      sy = sy < 0 ? 0 : sy > maxY ? maxY : sy;
      const x0 = Math.floor(sx);
      const y0 = Math.floor(sy);
      const x1 = x0 < maxX ? x0 + 1 : x0;
      const y1 = y0 < maxY ? y0 + 1 : y0;
      const fx = sx - x0;
      const fy = sy - y0;
      const i00 = (y0 * sw + x0) * 4;
      const i10 = (y0 * sw + x1) * 4;
      const i01 = (y1 * sw + x0) * 4;
      const i11 = (y1 * sw + x1) * 4;
      const o = (y * outW + x) * 4;
      for (let c = 0; c < 4; c++) {
        const top = data[i00 + c] + (data[i10 + c] - data[i00 + c]) * fx;
        const bot = data[i01 + c] + (data[i11 + c] - data[i01 + c]) * fx;
        out[o + c] = top + (bot - top) * fy;
      }
    }
  }
  return { data: out, width: outW, height: outH };
}

/** Rec. 601 luma for each pixel. */
export function toGray(img: RGBA): Float32Array {
  const n = img.width * img.height;
  const g = new Float32Array(n);
  const d = img.data;
  for (let i = 0; i < n; i++) g[i] = 0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2];
  return g;
}

/** Grayscale with a 1%–99% level stretch, written back into the RGBA buffer. */
export function grayscaleFilter(img: RGBA): RGBA {
  const g = toGray(img);
  const hist = new Uint32Array(256);
  for (let i = 0; i < g.length; i++) hist[Math.round(g[i])]++;
  const lowCut = g.length * 0.01;
  const highCut = g.length * 0.99;
  let lo = 0;
  let hi = 255;
  let acc = 0;
  for (let v = 0; v < 256; v++) {
    acc += hist[v];
    if (acc >= lowCut) {
      lo = v;
      break;
    }
  }
  acc = 0;
  for (let v = 0; v < 256; v++) {
    acc += hist[v];
    if (acc >= highCut) {
      hi = v;
      break;
    }
  }
  const range = Math.max(1, hi - lo);
  const out = new Uint8ClampedArray(img.data.length);
  for (let i = 0; i < g.length; i++) {
    const v = ((g[i] - lo) / range) * 255;
    out[i * 4] = out[i * 4 + 1] = out[i * 4 + 2] = v;
    out[i * 4 + 3] = 255;
  }
  return { data: out, width: img.width, height: img.height };
}

/**
 * Adaptive (local mean) threshold: a pixel turns black when it is darker than the
 * mean of its window by more than `offset`. Uses an integral image, so cost is O(n).
 */
export function adaptiveThreshold(img: RGBA, windowSize?: number, offset = 12): RGBA {
  const { width: w, height: h } = img;
  const g = toGray(img);
  const W = w + 1;
  const integral = new Float64Array(W * (h + 1));
  for (let y = 0; y < h; y++) {
    let row = 0;
    for (let x = 0; x < w; x++) {
      row += g[y * w + x];
      integral[(y + 1) * W + (x + 1)] = integral[y * W + (x + 1)] + row;
    }
  }
  const r = Math.max(4, Math.round((windowSize ?? Math.max(15, Math.min(w, h) / 12)) / 2));
  const out = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - r);
    const y1 = Math.min(h, y + r + 1);
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - r);
      const x1 = Math.min(w, x + r + 1);
      const sum = integral[y1 * W + x1] - integral[y0 * W + x1] - integral[y1 * W + x0] + integral[y0 * W + x0];
      const mean = sum / ((x1 - x0) * (y1 - y0));
      const v = g[y * w + x] < mean - offset ? 0 : 255;
      const o = (y * w + x) * 4;
      out[o] = out[o + 1] = out[o + 2] = v;
      out[o + 3] = 255;
    }
  }
  return { data: out, width: w, height: h };
}

/** Default corners inset by `inset` (fraction) from the image edges. */
export function defaultQuad(w: number, h: number, inset = 0.06): Quad {
  const dx = w * inset;
  const dy = h * inset;
  return [
    { x: dx, y: dy },
    { x: w - dx, y: dy },
    { x: w - dx, y: h - dy },
    { x: dx, y: h - dy },
  ];
}

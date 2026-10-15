/**
 * Size math for resizing, straightening, compression search, passport photo
 * presets and print-sheet tiling. Pure TypeScript.
 */

export const MAX_SIDE = 16384;

export type ResizeSpec =
  | { mode: "pixels"; width: number | null; height: number | null; keepAspect: boolean }
  | { mode: "percent"; percent: number }
  | { mode: "fit"; maxWidth: number; maxHeight: number; upscale: boolean };

/** Target size for one image. Throws a readable error when the spec is incomplete. */
export function computeResize(srcW: number, srcH: number, spec: ResizeSpec): { width: number; height: number } {
  let w: number;
  let h: number;
  if (spec.mode === "percent") {
    if (!(spec.percent > 0)) throw new Error("Enter a percentage above 0.");
    w = (srcW * spec.percent) / 100;
    h = (srcH * spec.percent) / 100;
  } else if (spec.mode === "fit") {
    if (!(spec.maxWidth > 0 && spec.maxHeight > 0)) throw new Error("Enter a maximum width and height.");
    let s = Math.min(spec.maxWidth / srcW, spec.maxHeight / srcH);
    if (!spec.upscale) s = Math.min(1, s);
    w = srcW * s;
    h = srcH * s;
  } else {
    const { width, height, keepAspect } = spec;
    if (!width && !height) throw new Error("Enter a width, a height, or both.");
    if (keepAspect) {
      if (width && height) {
        const s = Math.min(width / srcW, height / srcH);
        w = srcW * s;
        h = srcH * s;
      } else if (width) {
        w = width;
        h = (width * srcH) / srcW;
      } else {
        h = height as number;
        w = (h * srcW) / srcH;
      }
    } else {
      w = width ?? srcW;
      h = height ?? srcH;
    }
  }
  const out = { width: Math.max(1, Math.round(w)), height: Math.max(1, Math.round(h)) };
  if (out.width > MAX_SIDE || out.height > MAX_SIDE) throw new Error(`The result would be ${out.width} × ${out.height} px; browsers cap canvases at about ${MAX_SIDE} px per side.`);
  return out;
}

/**
 * Largest axis-aligned rectangle inside a w×h rectangle rotated by `deg`.
 * Used to crop away the empty corners after straightening.
 */
export function largestInnerRect(w: number, h: number, deg: number) {
  const a = (Math.abs(deg) * Math.PI) / 180;
  if (w <= 0 || h <= 0) return { width: 0, height: 0 };
  const sin = Math.abs(Math.sin(a));
  const cos = Math.abs(Math.cos(a));
  if (sin < 1e-10) return { width: w, height: h };
  const widthLonger = w >= h;
  const long = widthLonger ? w : h;
  const short = widthLonger ? h : w;
  let wr: number;
  let hr: number;
  if (short <= 2 * sin * cos * long || Math.abs(sin - cos) < 1e-10) {
    const x = 0.5 * short;
    [wr, hr] = widthLonger ? [x / sin, x / cos] : [x / cos, x / sin];
  } else {
    const cos2 = cos * cos - sin * sin;
    wr = (w * cos - h * sin) / cos2;
    hr = (h * cos - w * sin) / cos2;
  }
  return { width: Math.floor(wr), height: Math.floor(hr) };
}

/** Bounding box of a w×h rectangle rotated by `deg`. */
export function rotatedBounds(w: number, h: number, deg: number) {
  const a = (deg * Math.PI) / 180;
  const c = Math.abs(Math.cos(a));
  const s = Math.abs(Math.sin(a));
  return { width: Math.round(w * c + h * s), height: Math.round(w * s + h * c) };
}

/**
 * Binary search over encoder quality for the highest quality whose output is
 * at most `target` bytes. `encode` is injected so this stays testable.
 */
export async function searchQuality<T extends { size: number }>(
  encode: (q: number) => Promise<T>,
  target: number,
  opts: { lo?: number; hi?: number; iterations?: number } = {},
): Promise<{ quality: number; result: T; reached: boolean; tries: number }> {
  const lo0 = opts.lo ?? 0.05;
  const hi0 = opts.hi ?? 0.95;
  let tries = 0;
  const run = async (q: number) => {
    tries++;
    return encode(Math.round(q * 1000) / 1000);
  };
  const top = await run(hi0);
  if (top.size <= target) return { quality: hi0, result: top, reached: true, tries };
  const bottom = await run(lo0);
  if (bottom.size > target) return { quality: lo0, result: bottom, reached: false, tries };
  let lo = lo0;
  let hi = hi0;
  let best = { quality: lo0, result: bottom };
  for (let i = 0; i < (opts.iterations ?? 7); i++) {
    const mid = (lo + hi) / 2;
    const r = await run(mid);
    if (r.size <= target) {
      best = { quality: mid, result: r };
      lo = mid;
    } else hi = mid;
    if (hi - lo < 0.01) break;
  }
  return { ...best, quality: Math.round(best.quality * 100) / 100, reached: true, tries };
}

/* ------------------------------------------------------------------ */
/* Passport and ID photos                                              */
/* ------------------------------------------------------------------ */

export type PhotoPreset = {
  id: string;
  label: string;
  widthMm: number;
  heightMm: number;
  /** Chin to top of head, millimetres. */
  headMinMm: number;
  headMaxMm: number;
  note: string;
};

export const PHOTO_PRESETS: PhotoPreset[] = [
  { id: "us", label: "United States passport or visa, 2 × 2 in", widthMm: 50.8, heightMm: 50.8, headMinMm: 25.4, headMaxMm: 34.9, note: "2 × 2 in (51 × 51 mm); head 1 to 1⅜ in from chin to top of hair. Digital uploads: 600 to 1200 px square." },
  { id: "uk", label: "United Kingdom passport, 35 × 45 mm", widthMm: 35, heightMm: 45, headMinMm: 29, headMaxMm: 34, note: "35 × 45 mm; head 29 to 34 mm from chin to crown." },
  { id: "schengen", label: "Schengen visa / EU passports, 35 × 45 mm", widthMm: 35, heightMm: 45, headMinMm: 32, headMaxMm: 36, note: "35 × 45 mm (ICAO format); face 32 to 36 mm from chin to crown, about 70 to 80% of the height." },
  { id: "india", label: "India passport, 2 × 2 in", widthMm: 50.8, heightMm: 50.8, headMinMm: 25.4, headMaxMm: 34.9, note: "2 × 2 in (51 × 51 mm); head about 1 to 1⅜ in from chin to crown. Some Indian visa and ID forms use 35 × 45 mm instead." },
  { id: "canada", label: "Canada passport, 50 × 70 mm", widthMm: 50, heightMm: 70, headMinMm: 31, headMaxMm: 36, note: "50 × 70 mm; face 31 to 36 mm from chin to crown." },
  { id: "china", label: "China passport or visa, 33 × 48 mm", widthMm: 33, heightMm: 48, headMinMm: 28, headMaxMm: 33, note: "33 × 48 mm; head 28 to 33 mm from chin to crown, 15 to 22 mm wide." },
  { id: "australia", label: "Australia passport, 35 × 45 mm", widthMm: 35, heightMm: 45, headMinMm: 32, headMaxMm: 36, note: "35 to 40 mm wide by 45 to 50 mm high (35 × 45 mm used here); face 32 to 36 mm from chin to crown." },
  { id: "japan", label: "Japan passport, 35 × 45 mm", widthMm: 35, heightMm: 45, headMinMm: 32, headMaxMm: 36, note: "35 × 45 mm; head about 34 mm (±2 mm) from chin to crown." },
];

export const mmToPx = (mm: number, dpi = 300) => Math.round((mm / 25.4) * dpi);

/** Vertical guide positions (fractions of photo height) for the head-size overlay. */
export function headGuide(p: { heightMm: number; headMinMm: number; headMaxMm: number }) {
  // Put the crown a little below the top edge, centred so the largest allowed head still leaves a margin.
  const crownMm = Math.max(2, (p.heightMm - p.headMaxMm) * 0.4);
  return {
    crown: crownMm / p.heightMm,
    chinMin: (crownMm + p.headMinMm) / p.heightMm,
    chinMax: (crownMm + p.headMaxMm) / p.heightMm,
  };
}

/** Lays out as many photos as fit on a sheet (both orientations, with and without gaps). */
export function tileSheet(sheetW: number, sheetH: number, photoW: number, photoH: number, gap: number) {
  let best = { cols: 0, rows: 0, sheetW, sheetH, gap };
  for (const [W, H] of [[sheetW, sheetH], [sheetH, sheetW]]) {
    for (const g of [gap, Math.round(gap / 2), 0]) {
      const cols = Math.floor((W + g) / (photoW + g));
      const rows = Math.floor((H + g) / (photoH + g));
      if (cols * rows > best.cols * best.rows) best = { cols, rows, sheetW: W, sheetH: H, gap: g };
    }
  }
  const usedW = best.cols * photoW + (best.cols - 1) * best.gap;
  const usedH = best.rows * photoH + (best.rows - 1) * best.gap;
  const x0 = Math.floor((best.sheetW - usedW) / 2);
  const y0 = Math.floor((best.sheetH - usedH) / 2);
  const cells: { x: number; y: number }[] = [];
  for (let r = 0; r < best.rows; r++) for (let c = 0; c < best.cols; c++) cells.push({ x: x0 + c * (photoW + best.gap), y: y0 + r * (photoH + best.gap) });
  return { width: best.sheetW, height: best.sheetH, cells, gap: best.gap };
}

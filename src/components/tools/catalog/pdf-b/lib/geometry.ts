/**
 * Page geometry shared by the pdf-b tools.
 *
 * "View space" is what the user sees: the page as displayed after /Rotate,
 * origin at the top-left corner of the visible box (CropBox ∩ MediaBox),
 * y pointing down, 1 unit = 1 PDF user-space unit (72 per inch when
 * UserUnit is 1). "User space" is the PDF's own coordinate system that
 * content streams and annotations use (origin bottom-left, y up, unrotated).
 *
 * The transform replicates pdf.js `PageViewport` at scale 1, so a click on a
 * pdf.js-rendered preview maps to exactly the same spot in the file.
 */

export type ViewBox = [number, number, number, number];
export type Matrix = [number, number, number, number, number, number];

export interface PageGeom {
  /** Visible box in user space: [x0, y0, x1, y1]. */
  view: ViewBox;
  /** /Rotate normalised to 0, 90, 180 or 270 (clockwise, as displayed). */
  rotate: number;
}

export interface Pt {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function normRotation(deg: number) {
  const r = (((Math.round(deg / 90) * 90) % 360) + 360) % 360;
  return r;
}

/** Displayed size (width, height) of a page in view units. */
export function viewSize(g: PageGeom) {
  const w = g.view[2] - g.view[0];
  const h = g.view[3] - g.view[1];
  return normRotation(g.rotate) % 180 === 0 ? { w, h } : { w: h, h: w };
}

/** User space → view space matrix (pdf.js PageViewport, scale 1, no offset). */
export function userToViewMatrix(g: PageGeom): Matrix {
  const [x0, y0, x1, y1] = g.view;
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  let a: number, b: number, c: number, d: number;
  switch (normRotation(g.rotate)) {
    case 90:
      [a, b, c, d] = [0, 1, 1, 0];
      break;
    case 180:
      [a, b, c, d] = [-1, 0, 0, 1];
      break;
    case 270:
      [a, b, c, d] = [0, -1, -1, 0];
      break;
    default:
      [a, b, c, d] = [1, 0, 0, -1];
  }
  let ox: number, oy: number;
  if (a === 0) {
    ox = Math.abs(cy - y0);
    oy = Math.abs(cx - x0);
  } else {
    ox = Math.abs(cx - x0);
    oy = Math.abs(cy - y0);
  }
  return [a, b, c, d, ox - a * cx - c * cy, oy - b * cx - d * cy];
}

export function applyMatrix(m: Matrix, p: Pt): Pt {
  return { x: m[0] * p.x + m[2] * p.y + m[4], y: m[1] * p.x + m[3] * p.y + m[5] };
}

export function invertMatrix(m: Matrix): Matrix {
  const [a, b, c, d, e, f] = m;
  const det = a * d - b * c;
  if (det === 0) throw new Error("Matrix is not invertible.");
  return [d / det, -b / det, -c / det, a / det, (c * f - d * e) / det, (b * e - a * f) / det];
}

/** Matrix product: result applies `first`, then `second`. */
export function multiply(first: Matrix, second: Matrix): Matrix {
  const [a1, b1, c1, d1, e1, f1] = first;
  const [a2, b2, c2, d2, e2, f2] = second;
  return [
    a1 * a2 + b1 * c2,
    a1 * b2 + b1 * d2,
    c1 * a2 + d1 * c2,
    c1 * b2 + d1 * d2,
    e1 * a2 + f1 * c2 + e2,
    e1 * b2 + f1 * d2 + f2,
  ];
}

export function viewToUser(g: PageGeom, p: Pt): Pt {
  return applyMatrix(invertMatrix(userToViewMatrix(g)), p);
}

export function userToView(g: PageGeom, p: Pt): Pt {
  return applyMatrix(userToViewMatrix(g), p);
}

/** Converts a view-space rectangle to a normalised user-space rectangle (x,y = bottom-left). */
export function viewRectToUser(g: PageGeom, r: Rect): Rect {
  const a = viewToUser(g, { x: r.x, y: r.y });
  const b = viewToUser(g, { x: r.x + r.w, y: r.y + r.h });
  return { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(a.x - b.x), h: Math.abs(a.y - b.y) };
}

/**
 * Angle (degrees, counter-clockwise, user space) of the view-space "rightwards"
 * direction. Text drawn at this angle reads left-to-right for the viewer.
 */
export function uprightAngle(g: PageGeom) {
  const o = viewToUser(g, { x: 0, y: 0 });
  const r = viewToUser(g, { x: 1, y: 0 });
  const deg = (Math.atan2(r.y - o.y, r.x - o.x) * 180) / Math.PI;
  return Math.round(((deg % 360) + 360) % 360);
}

/** Rectangle normalised from two arbitrary corner points. */
export function rectFromPoints(a: Pt, b: Pt): Rect {
  return { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(a.x - b.x), h: Math.abs(a.y - b.y) };
}

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/* ------------------------------------------------------------------ */
/* Paper sizes and fitting                                             */
/* ------------------------------------------------------------------ */

/** ISO 216 and ANSI sizes in points (1 pt = 1/72 in), portrait. */
export const PAPER = {
  A3: { w: 841.89, h: 1190.55, label: "A3 (297 × 420 mm)" },
  A4: { w: 595.28, h: 841.89, label: "A4 (210 × 297 mm)" },
  A5: { w: 419.53, h: 595.28, label: "A5 (148 × 210 mm)" },
  Letter: { w: 612, h: 792, label: "US Letter (8.5 × 11 in)" },
  Legal: { w: 612, h: 1008, label: "US Legal (8.5 × 14 in)" },
} as const;

export type PaperName = keyof typeof PAPER;

export function mmToPt(mm: number) {
  return (mm * 72) / 25.4;
}
export function ptToMm(pt: number) {
  return (pt * 25.4) / 72;
}

/** Uniform scale + centred offset that fits a w×h box inside a target box. */
export function fitInside(w: number, h: number, box: Rect, allowUpscale = true) {
  let s = Math.min(box.w / w, box.h / h);
  if (!allowUpscale) s = Math.min(1, s);
  const dw = w * s;
  const dh = h * s;
  return { scale: s, x: box.x + (box.w - dw) / 2, y: box.y + (box.h - dh) / 2, w: dw, h: dh };
}

/**
 * Matrix that draws a source page's user-space content (as an XObject whose
 * own matrix is identity) so that its *displayed* view lands in `target`, a
 * rectangle in the view space of an unrotated target page of height `targetH`.
 * Result is suitable for a `cm` operator on the target page.
 */
export function placeSourceMatrix(src: PageGeom, target: Rect, targetH: number): Matrix {
  const { w, h } = viewSize(src);
  const sx = target.w / w;
  const sy = target.h / h;
  const toView = userToViewMatrix(src);
  const place: Matrix = [sx, 0, 0, sy, target.x, target.y];
  const flip: Matrix = [1, 0, 0, -1, 0, targetH];
  return multiply(multiply(toView, place), flip);
}

/* ------------------------------------------------------------------ */
/* Crop and margins                                                    */
/* ------------------------------------------------------------------ */

export interface Sides {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/**
 * Converts per-side trims (as seen by the viewer) into a new view-space
 * rectangle. Units: "pt" or "%" (percent of the displayed width/height).
 * Returns an error string if nothing would remain.
 */
export function cropRect(g: PageGeom, sides: Sides, unit: "pt" | "%"): Rect | string {
  const { w, h } = viewSize(g);
  const conv = (v: number, dim: number) => (unit === "%" ? (v / 100) * dim : v);
  const l = conv(sides.left, w);
  const r = conv(sides.right, w);
  const t = conv(sides.top, h);
  const b = conv(sides.bottom, h);
  if ([l, r, t, b].some((v) => v < 0)) return "Trim amounts cannot be negative.";
  const rw = w - l - r;
  const rh = h - t - b;
  if (rw < 1 || rh < 1) return "The trims remove the whole page. Use smaller values.";
  return { x: l, y: t, w: rw, h: rh };
}

/** Content rectangle (view space) inside a page of w×h after adding margins, keeping aspect ratio. */
export function marginContentRect(w: number, h: number, m: Sides): Rect | string {
  const box = { x: m.left, y: m.top, w: w - m.left - m.right, h: h - m.top - m.bottom };
  if (box.w < 10 || box.h < 10) return "The margins leave no room for the page content.";
  const f = fitInside(w, h, box, false);
  return { x: f.x, y: f.y, w: f.w, h: f.h };
}

/* ------------------------------------------------------------------ */
/* Arrowheads                                                          */
/* ------------------------------------------------------------------ */

/** Two barb end-points for an arrowhead at `to`, pointing from `from`. */
export function arrowHead(from: Pt, to: Pt, size: number): [Pt, Pt] {
  const ang = Math.atan2(to.y - from.y, to.x - from.x);
  const spread = Math.PI / 7;
  return [
    { x: to.x - size * Math.cos(ang - spread), y: to.y - size * Math.sin(ang - spread) },
    { x: to.x - size * Math.cos(ang + spread), y: to.y - size * Math.sin(ang + spread) },
  ];
}

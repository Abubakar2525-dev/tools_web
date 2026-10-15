/**
 * Plane and solid geometry formulas. All inputs share one length unit; areas
 * come out in unit², volumes in unit³.
 */

export interface AreaResult {
  area: number;
  perimeter: number;
  /** Extra named values (e.g. arc length, apothem). */
  extra?: { label: string; value: number; kind: "len" | "area" | "angle" }[];
  formula: string[];
}

/** Ellipse perimeter, Ramanujan's second approximation (relative error below 5e-5 even for very flat ellipses, far smaller for typical ones). */
export function ellipsePerimeter(a: number, b: number): number {
  const h = ((a - b) / (a + b)) ** 2;
  return Math.PI * (a + b) * (1 + (3 * h) / (10 + Math.sqrt(4 - 3 * h)));
}

export const regularPolygonArea = (n: number, s: number) => (n * s * s) / (4 * Math.tan(Math.PI / n));
export const apothem = (n: number, s: number) => s / (2 * Math.tan(Math.PI / n));
export const circumradiusPolygon = (n: number, s: number) => s / (2 * Math.sin(Math.PI / n));

export function heron(a: number, b: number, c: number): number {
  // Numerically stable form (Kahan): sort a ≥ b ≥ c.
  const [x, y, z] = [a, b, c].sort((p, q) => q - p);
  const v = (x + (y + z)) * (z - (x - y)) * (z + (x - y)) * (x + (y - z));
  return v <= 0 ? 0 : Math.sqrt(v) / 4;
}

export interface SolidResult {
  volume: number;
  surface: number;
  lateral?: number;
  extra?: { label: string; value: number; kind: "len" | "area" }[];
  formula: string[];
}

export function cone(r: number, h: number): SolidResult {
  const s = Math.hypot(r, h);
  return {
    volume: (Math.PI * r * r * h) / 3,
    surface: Math.PI * r * (r + s),
    lateral: Math.PI * r * s,
    extra: [{ label: "Slant height", value: s, kind: "len" }],
    formula: ["V = πr²h / 3", "s = √(r² + h²)", "A = πr(r + s)"],
  };
}

export function rectPyramid(l: number, w: number, h: number): SolidResult {
  const sl = Math.hypot(w / 2, h); // slant height of the faces on the l edges
  const sw = Math.hypot(l / 2, h); // slant height of the faces on the w edges
  const lateral = l * sl + w * sw;
  return {
    volume: (l * w * h) / 3,
    surface: l * w + lateral,
    lateral,
    extra: [
      { label: "Slant height (faces on length)", value: sl, kind: "len" },
      { label: "Slant height (faces on width)", value: sw, kind: "len" },
    ],
    formula: ["V = l·w·h / 3", "A = l·w + l·√((w/2)² + h²) + w·√((l/2)² + h²)"],
  };
}

export function torus(R: number, r: number): SolidResult {
  return {
    volume: 2 * Math.PI * Math.PI * R * r * r,
    surface: 4 * Math.PI * Math.PI * R * r,
    formula: ["V = 2π²Rr²", "A = 4π²Rr"],
  };
}

/** Simplifies √n for a non-negative integer n: returns [k, m] with √n = k√m. */
export function simplifySqrt(n: number): [number, number] {
  let k = 1;
  let m = n;
  for (let d = 2; d * d <= m; d++) {
    while (m % (d * d) === 0) {
      k *= d;
      m /= d * d;
    }
  }
  return [k, m];
}

/**
 * Triangle solver. Sides a, b, c are opposite angles A, B, C (radians).
 * Uses the law of cosines / law of sines; area by Heron's formula.
 */

export interface Triangle {
  a: number;
  b: number;
  c: number;
  A: number;
  B: number;
  C: number;
}

export interface TriangleInfo extends Triangle {
  area: number;
  perimeter: number;
  /** Altitudes to sides a, b, c. */
  ha: number;
  hb: number;
  hc: number;
  inradius: number;
  circumradius: number;
  bySides: "equilateral" | "isosceles" | "scalene";
  byAngles: "acute" | "right" | "obtuse";
}

export type SolveResult = { ok: true; solutions: Triangle[] } | { ok: false; reason: string };

const EPS = 1e-9;
const clamp = (x: number) => Math.max(-1, Math.min(1, x));

function fromThreeSides(a: number, b: number, c: number): Triangle {
  const A = Math.acos(clamp((b * b + c * c - a * a) / (2 * b * c)));
  const B = Math.acos(clamp((a * a + c * c - b * b) / (2 * a * c)));
  const C = Math.PI - A - B;
  return { a, b, c, A, B, C };
}

export function solveSSS(a: number, b: number, c: number): SolveResult {
  if (!(a > 0 && b > 0 && c > 0)) return { ok: false, reason: "All sides must be greater than 0." };
  const [x, y, z] = [a, b, c].sort((p, q) => p - q);
  if (x + y <= z * (1 + 1e-12)) {
    return { ok: false, reason: `Triangle inequality fails: ${fmt(x)} + ${fmt(y)} is not greater than ${fmt(z)}, so these sides cannot close into a triangle.` };
  }
  return { ok: true, solutions: [fromThreeSides(a, b, c)] };
}

/** Two sides b, c and the included angle A. */
export function solveSAS(b: number, A: number, c: number): SolveResult {
  if (!(b > 0 && c > 0)) return { ok: false, reason: "Sides must be greater than 0." };
  if (!(A > 0 && A < Math.PI)) return { ok: false, reason: "The included angle must be between 0° and 180°." };
  const a = Math.sqrt(b * b + c * c - 2 * b * c * Math.cos(A));
  const t = fromThreeSides(a, b, c);
  return { ok: true, solutions: [{ ...t, A }] };
}

/** Two angles and a side. `side` says which side is known: the one opposite A, B or C. */
export function solveTwoAngles(A: number, B: number, known: number, opposite: "A" | "B" | "C"): SolveResult {
  if (!(A > 0 && B > 0)) return { ok: false, reason: "Angles must be greater than 0." };
  if (A + B >= Math.PI - EPS) return { ok: false, reason: "The two angles must add up to less than 180°." };
  if (!(known > 0)) return { ok: false, reason: "The side must be greater than 0." };
  const C = Math.PI - A - B;
  const sinOf = { A: Math.sin(A), B: Math.sin(B), C: Math.sin(C) };
  const k = known / sinOf[opposite];
  return { ok: true, solutions: [{ a: k * sinOf.A, b: k * sinOf.B, c: k * sinOf.C, A, B, C }] };
}

/** ASA: angles A and B with the included side c. */
export const solveASA = (A: number, c: number, B: number) => solveTwoAngles(A, B, c, "C");
/** AAS: angles A and B with side a (opposite A). */
export const solveAAS = (A: number, B: number, a: number) => solveTwoAngles(A, B, a, "A");

/**
 * SSA: sides a and b with angle A (opposite a). Handles the ambiguous case:
 * zero, one (incl. right-angle case) or two triangles.
 */
export function solveSSA(a: number, b: number, A: number): SolveResult {
  if (!(a > 0 && b > 0)) return { ok: false, reason: "Sides must be greater than 0." };
  if (!(A > 0 && A < Math.PI)) return { ok: false, reason: "The angle must be between 0° and 180°." };
  const h = b * Math.sin(A);
  const sinB = h / a;
  if (sinB > 1 + 1e-12) {
    return { ok: false, reason: `No triangle: side a (${fmt(a)}) is shorter than the height b·sin A (${fmt(h)}), so it cannot reach the base line.` };
  }
  const build = (B: number): Triangle | null => {
    const C = Math.PI - A - B;
    if (C <= EPS) return null;
    const c = (a * Math.sin(C)) / Math.sin(A);
    return { a, b, c, A, B, C };
  };
  if (Math.abs(sinB - 1) <= 1e-12) {
    const t = build(Math.PI / 2);
    return t ? { ok: true, solutions: [t] } : { ok: false, reason: "No triangle exists with these values." };
  }
  const B1 = Math.asin(sinB);
  const B2 = Math.PI - B1;
  const sols = [build(B1)];
  // Second solution only when a < b (and A acute): then B2 also leaves room for C.
  if (a < b - EPS * b) sols.push(build(B2));
  const solutions = sols.filter((t): t is Triangle => t !== null);
  if (!solutions.length) return { ok: false, reason: "No triangle: with this angle the other two angles would exceed 180°." };
  return { ok: true, solutions };
}

export function describe(t: Triangle): TriangleInfo {
  const { a, b, c } = t;
  const s = (a + b + c) / 2;
  const area = Math.sqrt(Math.max(0, s * (s - a) * (s - b) * (s - c)));
  const tol = 1e-9 * Math.max(a, b, c);
  const eq = (x: number, y: number) => Math.abs(x - y) <= tol;
  const bySides = eq(a, b) && eq(b, c) ? "equilateral" : eq(a, b) || eq(b, c) || eq(a, c) ? "isosceles" : "scalene";
  const maxAngle = Math.max(t.A, t.B, t.C);
  const byAngles = Math.abs(maxAngle - Math.PI / 2) < 1e-9 ? "right" : maxAngle > Math.PI / 2 ? "obtuse" : "acute";
  return {
    ...t,
    area,
    perimeter: a + b + c,
    ha: (2 * area) / a,
    hb: (2 * area) / b,
    hc: (2 * area) / c,
    inradius: area / s,
    circumradius: (a * b * c) / (4 * area),
    bySides,
    byAngles,
  };
}

/**
 * Vertex coordinates for drawing: side c on the x-axis from A(0,0) to B(c,0),
 * C above it. Returns points in triangle units (y up).
 */
export function vertices(t: Triangle): { A: [number, number]; B: [number, number]; C: [number, number] } {
  return { A: [0, 0], B: [t.c, 0], C: [t.b * Math.cos(t.A), t.b * Math.sin(t.A)] };
}

function fmt(n: number) {
  return Number(n.toPrecision(6)).toString();
}

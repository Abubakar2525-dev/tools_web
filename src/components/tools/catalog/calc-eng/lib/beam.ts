/**
 * Statically determinate beam solver (simply supported or cantilever) for
 * point loads and full/partial uniformly distributed loads.
 *
 * Units: consistent SI internally (m, N, N/m, Pa, m^4).
 * Sign convention: loads positive downward. Reactions positive upward.
 * Shear V(x) is the sum of forces to the left of the section (upward positive).
 * Bending moment M(x) is positive when sagging (tension at the bottom).
 * Deflection y(x) is positive upward; EI·y'' = M is integrated numerically.
 */

export type Support = "simple" | "cantilever";
export type PointLoad = { kind: "point"; P: number; a: number };
export type Udl = { kind: "udl"; w: number; start: number; end: number };
export type Load = PointLoad | Udl;

export type BeamInput = { L: number; support: Support; E: number; I: number; loads: Load[] };

export type BeamResult = {
  /** Simple: reactions at x=0 (A) and x=L (B). Cantilever (fixed at x=0): R and fixed-end moment. */
  RA: number;
  RB: number;
  /** Cantilever fixed-end moment (sagging-positive convention, so usually negative). */
  MA: number;
  xs: number[];
  V: number[];
  M: number[];
  slope: number[];
  y: number[];
  maxMoment: { value: number; x: number };
  minMoment: { value: number; x: number };
  maxShear: { value: number; x: number };
  maxDeflection: { value: number; x: number };
  totalLoad: number;
};

export function validateBeam(b: BeamInput): string | null {
  if (!(b.L > 0)) return "Beam length must be greater than zero.";
  if (!(b.E > 0)) return "Elastic modulus E must be greater than zero.";
  if (!(b.I > 0)) return "Second moment of area I must be greater than zero.";
  if (!b.loads.length) return "Add at least one load.";
  for (const [i, l] of b.loads.entries()) {
    if (l.kind === "point") {
      if (!Number.isFinite(l.P)) return `Load ${i + 1}: enter a force.`;
      if (!(l.a >= 0 && l.a <= b.L)) return `Load ${i + 1}: position must be between 0 and the beam length.`;
    } else {
      if (!Number.isFinite(l.w)) return `Load ${i + 1}: enter an intensity.`;
      if (!(l.start >= 0 && l.end <= b.L && l.end > l.start)) return `Load ${i + 1}: the UDL must start before it ends and stay on the beam.`;
    }
  }
  return null;
}

/** Shear and moment from a free body to the left of x (point loads exactly at x are excluded from V, i.e. V(x⁻)). */
function sectionForces(b: BeamInput, RA: number, MA: number, x: number, includeAtX: boolean) {
  let V = RA;
  let M = RA * x + MA;
  for (const l of b.loads) {
    if (l.kind === "point") {
      if (l.a < x || (includeAtX && l.a === x)) {
        V -= l.P;
        M -= l.P * (x - l.a);
      }
    } else if (x > l.start) {
      const e = Math.min(x, l.end);
      const W = l.w * (e - l.start);
      V -= W;
      M -= W * (x - (l.start + e) / 2);
    }
  }
  return { V, M };
}

export function solveBeam(b: BeamInput, segments = 4000): BeamResult {
  let total = 0;
  let momentAboutA = 0;
  for (const l of b.loads) {
    if (l.kind === "point") {
      total += l.P;
      momentAboutA += l.P * l.a;
    } else {
      const W = l.w * (l.end - l.start);
      total += W;
      momentAboutA += W * (l.start + l.end) / 2;
    }
  }
  let RA: number, RB: number, MA: number;
  if (b.support === "simple") {
    RB = momentAboutA / b.L;
    RA = total - RB;
    MA = 0;
  } else {
    RA = total;
    RB = 0;
    MA = -momentAboutA;
  }

  // Grid: uniform plus every load position, so discontinuities sit on nodes.
  const set = new Set<number>();
  for (let i = 0; i <= segments; i++) set.add((b.L * i) / segments);
  for (const l of b.loads) {
    if (l.kind === "point") set.add(l.a);
    else {
      set.add(l.start);
      set.add(l.end);
    }
  }
  const base = [...set].sort((p, q) => p - q);
  // Duplicate point-load positions so the shear jump is drawn vertically.
  const xs: number[] = [];
  const V: number[] = [];
  const M: number[] = [];
  for (const x of base) {
    const left = sectionForces(b, RA, MA, x, false);
    const right = sectionForces(b, RA, MA, x, true);
    if (Math.abs(left.V - right.V) > 1e-12 && x > 0 && x < b.L) {
      xs.push(x, x);
      V.push(left.V, right.V);
      M.push(left.M, right.M);
    } else {
      xs.push(x);
      V.push(x === 0 ? right.V : x === b.L ? left.V : right.V);
      M.push(right.M);
    }
  }
  // At x = 0 shear just right of the support (point loads at 0 are taken by the support for display).
  const EI = b.E * b.I;
  const slope: number[] = new Array(xs.length).fill(0);
  const y: number[] = new Array(xs.length).fill(0);
  for (let i = 1; i < xs.length; i++) {
    const h = xs[i] - xs[i - 1];
    slope[i] = slope[i - 1] + (h * (M[i] + M[i - 1])) / (2 * EI);
    // Exact for linear M within the step: y += h*θ0 + h²(2M0 + M1)/(6EI)
    y[i] = y[i - 1] + h * slope[i - 1] + (h * h * (2 * M[i - 1] + M[i])) / (6 * EI);
  }
  if (b.support === "simple") {
    const c = -y[y.length - 1] / b.L;
    for (let i = 0; i < xs.length; i++) {
      y[i] += c * xs[i];
      slope[i] += c;
    }
  }

  const ext = (arr: number[], pick: (a: number, b: number) => boolean) => {
    let k = 0;
    for (let i = 1; i < arr.length; i++) if (pick(arr[i], arr[k])) k = i;
    return { value: arr[k], x: xs[k] };
  };
  const absMaxV = ext(V, (p, q) => Math.abs(p) > Math.abs(q) + 1e-12);
  const maxDefl = ext(y, (p, q) => Math.abs(p) > Math.abs(q));
  return {
    RA,
    RB,
    MA,
    xs,
    V,
    M,
    slope,
    y,
    maxMoment: ext(M, (p, q) => p > q),
    minMoment: ext(M, (p, q) => p < q),
    maxShear: absMaxV,
    maxDeflection: maxDefl,
    totalLoad: total,
  };
}

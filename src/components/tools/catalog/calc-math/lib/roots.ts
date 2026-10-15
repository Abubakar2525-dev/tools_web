/**
 * Root finding: polynomial roots (Durand-Kerner with cluster averaging and Newton polish),
 * Brent's method, range scanning for f(x) = 0, and exact quadratic roots in surd form.
 */

import { B0, B1, B2, Q, babs, bgcd, blcm } from "./rational";
import { factorize, isqrt } from "./bigint";

export type Complex = { re: number; im: number };

const cadd = (a: Complex, b: Complex): Complex => ({ re: a.re + b.re, im: a.im + b.im });
const csub = (a: Complex, b: Complex): Complex => ({ re: a.re - b.re, im: a.im - b.im });
const cmul = (a: Complex, b: Complex): Complex => ({ re: a.re * b.re - a.im * b.im, im: a.re * b.im + a.im * b.re });
const cdiv = (a: Complex, b: Complex): Complex => {
  const d = b.re * b.re + b.im * b.im;
  return { re: (a.re * b.re + a.im * b.im) / d, im: (a.im * b.re - a.re * b.im) / d };
};
const cabs = (a: Complex) => Math.hypot(a.re, a.im);

/** Evaluates a polynomial with coefficients in ascending order (c0 + c1 x + …) at complex z. */
export function polyEval(c: number[], z: Complex): Complex {
  let r: Complex = { re: 0, im: 0 };
  for (let i = c.length - 1; i >= 0; i--) r = cadd(cmul(r, z), { re: c[i], im: 0 });
  return r;
}

export function polyDeriv(c: number[]): number[] {
  return c.slice(1).map((v, i) => v * (i + 1));
}

/**
 * All complex roots of c0 + c1 x + … + cn x^n (ascending coefficients, cn ≠ 0).
 * Exact zero roots are factored out first; repeated roots are detected as clusters,
 * averaged, and polished on the matching derivative.
 */
export function polyRoots(coeffs: number[]): Complex[] {
  const c = [...coeffs];
  while (c.length > 1 && c[c.length - 1] === 0) c.pop();
  const n0 = c.length - 1;
  if (n0 < 1) return [];
  const roots: Complex[] = [];
  // Zero roots.
  let z = 0;
  while (z < c.length - 1 && c[z] === 0) z++;
  for (let i = 0; i < z; i++) roots.push({ re: 0, im: 0 });
  const p = c.slice(z);
  const n = p.length - 1;
  if (n === 0) return roots;
  const lead = p[n];
  const monic = p.map((v) => v / lead);
  if (n === 1) {
    roots.push({ re: -monic[0], im: 0 });
    return roots;
  }
  // Cauchy bound radius for initial guesses.
  let R = 0;
  for (let i = 0; i < n; i++) R = Math.max(R, Math.abs(monic[i]));
  R = 1 + R;
  const start = Math.min(R, 2);
  let xs: Complex[] = Array.from({ length: n }, (_, k) => {
    const ang = (2 * Math.PI * k) / n + 0.4;
    return { re: start * Math.cos(ang), im: start * Math.sin(ang) };
  });
  for (let iter = 0; iter < 2000; iter++) {
    let maxDelta = 0;
    const next = xs.map((xi, i) => {
      let den: Complex = { re: 1, im: 0 };
      for (let j = 0; j < n; j++) if (j !== i) den = cmul(den, csub(xi, xs[j]));
      if (cabs(den) === 0) den = { re: 1e-12, im: 1e-12 };
      const delta = cdiv(polyEval(monic, xi), den);
      maxDelta = Math.max(maxDelta, cabs(delta) / Math.max(1, cabs(xi)));
      return csub(xi, delta);
    });
    xs = next;
    if (maxDelta < 1e-15) break;
  }
  // Cluster near-equal roots (repeated roots converge slowly and scatter).
  const used = new Array(n).fill(false);
  const out: Complex[] = [];
  for (let i = 0; i < n; i++) {
    if (used[i]) continue;
    const group = [i];
    used[i] = true;
    for (let j = i + 1; j < n; j++) {
      if (!used[j] && cabs(csub(xs[i], xs[j])) < 1e-4 * Math.max(1, cabs(xs[i]))) {
        group.push(j);
        used[j] = true;
      }
    }
    let avg: Complex = { re: 0, im: 0 };
    for (const g of group) avg = cadd(avg, xs[g]);
    avg = { re: avg.re / group.length, im: avg.im / group.length };
    // Polish on the (m−1)th derivative, where a root of multiplicity m is simple.
    let q = monic;
    for (let k = 1; k < group.length; k++) q = polyDeriv(q);
    const dq = polyDeriv(q);
    let x = avg;
    for (let k = 0; k < 50; k++) {
      const fx = polyEval(q, x);
      const dfx = polyEval(dq, x);
      if (cabs(dfx) === 0) break;
      const step = cdiv(fx, dfx);
      const nx = csub(x, step);
      if (!Number.isFinite(nx.re) || !Number.isFinite(nx.im)) break;
      // Only accept polishing that does not drift away from the cluster.
      if (cabs(csub(nx, avg)) > 1e-3 * Math.max(1, cabs(avg))) break;
      x = nx;
      if (cabs(step) <= 1e-16 * Math.max(1, cabs(x))) break;
    }
    for (let g = 0; g < group.length; g++) out.push(x);
  }
  // Clean tiny parts.
  for (const r of out) {
    const scale = Math.max(1, cabs(r));
    if (Math.abs(r.im) < 1e-10 * scale) r.im = 0;
    if (Math.abs(r.re) < 1e-12 * scale) r.re = 0;
  }
  return roots.concat(out).sort((a, b) => (Math.abs(a.re - b.re) > 1e-9 * Math.max(1, Math.abs(a.re)) ? a.re - b.re : a.im - b.im));
}

/** Brent's method on [a, b] with f(a)·f(b) ≤ 0. */
export function brent(f: (x: number) => number, a: number, b: number, tol = 1e-15, maxIter = 200): number {
  let fa = f(a);
  let fb = f(b);
  if (fa === 0) return a;
  if (fb === 0) return b;
  if (fa * fb > 0) throw new Error("Root is not bracketed.");
  let c = a;
  let fc = fa;
  let d = b - a;
  let e = d;
  for (let i = 0; i < maxIter; i++) {
    if (fb * fc > 0) {
      c = a;
      fc = fa;
      d = b - a;
      e = d;
    }
    if (Math.abs(fc) < Math.abs(fb)) {
      a = b;
      b = c;
      c = a;
      fa = fb;
      fb = fc;
      fc = fa;
    }
    const tol1 = 2 * Number.EPSILON * Math.abs(b) + 0.5 * tol;
    const xm = 0.5 * (c - b);
    if (Math.abs(xm) <= tol1 || fb === 0) return b;
    if (Math.abs(e) >= tol1 && Math.abs(fa) > Math.abs(fb)) {
      const s = fb / fa;
      let p: number;
      let q: number;
      if (a === c) {
        p = 2 * xm * s;
        q = 1 - s;
      } else {
        const qq = fa / fc;
        const r = fb / fc;
        p = s * (2 * xm * qq * (qq - r) - (b - a) * (r - 1));
        q = (qq - 1) * (r - 1) * (s - 1);
      }
      if (p > 0) q = -q;
      p = Math.abs(p);
      if (2 * p < Math.min(3 * xm * q - Math.abs(tol1 * q), Math.abs(e * q))) {
        e = d;
        d = p / q;
      } else {
        d = xm;
        e = d;
      }
    } else {
      d = xm;
      e = d;
    }
    a = b;
    fa = fb;
    b += Math.abs(d) > tol1 ? d : xm > 0 ? tol1 : -tol1;
    fb = f(b);
  }
  return b;
}

/**
 * Real roots of f on [lo, hi]: scans `samples` subintervals for sign changes (refined with Brent)
 * and for touching zeros (local minima of |f| that reach ~0). Sign changes across poles are rejected.
 */
export function scanRoots(f: (x: number) => number, lo: number, hi: number, samples = 4000): { roots: number[]; poles: number } {
  const xs: number[] = [];
  const fs: number[] = [];
  for (let i = 0; i <= samples; i++) {
    const x = lo + ((hi - lo) * i) / samples;
    xs.push(x);
    const y = f(x);
    fs.push(Number.isFinite(y) ? y : NaN);
  }
  const roots: number[] = [];
  let poles = 0;
  const scale = Math.max(1e-300, ...fs.filter((v) => Number.isFinite(v)).map(Math.abs));
  for (let i = 0; i < samples; i++) {
    const a = fs[i];
    const b = fs[i + 1];
    if (Number.isNaN(a) || Number.isNaN(b)) continue;
    if (a === 0) {
      roots.push(xs[i]);
      continue;
    }
    if (a * b < 0) {
      const r = brent(f, xs[i], xs[i + 1]);
      const fr = Math.abs(f(r));
      // A pole flips sign with |f| growing; a root has |f| near 0.
      if (fr <= 1e-8 * Math.max(1, Math.min(Math.abs(a), Math.abs(b))) || fr < 1e-12 * scale) roots.push(r);
      else poles++;
    }
  }
  if (fs[samples] === 0) roots.push(xs[samples]);
  // Touching roots: |f| local minimum without a sign change.
  for (let i = 1; i < samples; i++) {
    const a = fs[i - 1];
    const m = fs[i];
    const b = fs[i + 1];
    if ([a, m, b].some(Number.isNaN) || m === 0) continue;
    if (Math.sign(a) !== Math.sign(m) || Math.sign(b) !== Math.sign(m)) continue;
    if (!(Math.abs(m) <= Math.abs(a) && Math.abs(m) <= Math.abs(b))) continue;
    // Golden-section minimize |f| on [x_{i-1}, x_{i+1}].
    let l = xs[i - 1];
    let r = xs[i + 1];
    const g = (Math.sqrt(5) - 1) / 2;
    for (let k = 0; k < 120; k++) {
      const c1 = r - g * (r - l);
      const c2 = l + g * (r - l);
      if (Math.abs(f(c1)) < Math.abs(f(c2))) r = c2;
      else l = c1;
    }
    const x = (l + r) / 2;
    if (Math.abs(f(x)) < 1e-10 * Math.max(1, scale * 1e-6) && Math.abs(f(x)) < 1e-9) roots.push(x);
  }
  roots.sort((p, q) => p - q);
  const dedup: number[] = [];
  for (const r of roots) {
    if (!dedup.length || Math.abs(r - dedup[dedup.length - 1]) > 1e-9 * Math.max(1, Math.abs(r))) dedup.push(r);
  }
  return { roots: dedup, poles };
}

/* ------------------------- Exact quadratic ------------------------- */

/** Splits n ≥ 0 into k²·m with m square-free (trial factorization; fine for typical inputs). */
export function squareSplit(n: bigint): { k: bigint; m: bigint } {
  if (n === B0) return { k: B0, m: B1 };
  const r = isqrt(n);
  if (r * r === n) return { k: r, m: B1 };
  let k = B1;
  let m = B1;
  for (const [p, e] of factorize(n, Date.now() + 500)) {
    k *= p ** BigInt(Math.floor(e / 2));
    if (e % 2) m *= p;
  }
  return { k, m };
}

const MINUS = "−";
const neg = (s: string) => (s.startsWith(MINUS) ? s.slice(1) : `${MINUS}${s}`);

function surd(k: bigint, m: bigint): string {
  if (m === B1) return k.toString();
  return `${k === B1 ? "" : k.toString()}√${m}`;
}

export type QuadraticExact = {
  /** Integer-scaled coefficients A x² + B x + C (same roots). */
  A: bigint;
  B: bigint;
  C: bigint;
  disc: bigint;
  kind: "two-rational" | "double" | "two-irrational" | "complex";
  /** Display strings for each root (exact). */
  exact: [string, string];
  /** Combined "±" form. */
  combined: string;
  rational?: [Q, Q];
  numeric: [Complex, Complex];
  vertex: [Q, Q];
};

/** Exact roots of a x² + b x + c with rational coefficients (a ≠ 0). */
export function quadraticExact(a: Q, b: Q, c: Q): QuadraticExact {
  if (a.isZero()) throw new Error("a must not be 0 for a quadratic.");
  const L = blcm(blcm(a.d, b.d), c.d);
  let A = (a.n * L) / a.d;
  let B = (b.n * L) / b.d;
  let C = (c.n * L) / c.d;
  const g0 = bgcd(bgcd(A, B), C);
  if (g0 > B1) {
    A /= g0;
    B /= g0;
    C /= g0;
  }
  if (A < B0) {
    A = -A;
    B = -B;
    C = -C;
  }
  const disc = B * B - BigInt(4) * A * C;
  const twoA = B2 * A;
  const vertexX = new Q(-B, twoA);
  const vertexY = c.sub(b.mul(b).div(a.mul(Q.int(4))));
  const an = a.toNumber();
  const bn = b.toNumber();
  const dnum = bn * bn - 4 * an * c.toNumber();
  const sq = Math.sqrt(Math.abs(dnum));
  let numeric: [Complex, Complex];
  if (dnum >= 0) {
    // Stable form avoids cancellation.
    const qv = -0.5 * (bn + (bn >= 0 ? sq : -sq));
    const r1 = qv !== 0 ? qv / an : 0;
    const r2 = qv !== 0 ? c.toNumber() / qv : 0;
    numeric = [{ re: Math.min(r1, r2), im: 0 }, { re: Math.max(r1, r2), im: 0 }];
  } else {
    numeric = [
      { re: -bn / (2 * an), im: -sq / (2 * Math.abs(an)) },
      { re: -bn / (2 * an), im: sq / (2 * Math.abs(an)) },
    ];
  }
  const base = { A, B, C, disc, numeric, vertex: [vertexX, vertexY] as [Q, Q] };

  if (disc === B0) {
    const r = new Q(-B, twoA);
    return { ...base, kind: "double", exact: [r.toString(), r.toString()], combined: r.toString(), rational: [r, r] };
  }
  const { k, m } = squareSplit(babs(disc));
  if (disc > B0 && m === B1) {
    const r1 = new Q(-B - k, twoA);
    const r2 = new Q(-B + k, twoA);
    return { ...base, kind: "two-rational", exact: [r1.toString(), r2.toString()], combined: `${r1}, ${r2}`, rational: [r1, r2] };
  }
  // Irrational or complex: (−B ± k√m [i]) / 2A, reduced by the common factor.
  const g = bgcd(bgcd(B, k), twoA);
  const nb = -B / g;
  const nk = k / g;
  const den = twoA / g;
  const kS = nk === B1 ? "" : nk.toString();
  const radStr = disc < B0 ? (m === B1 ? `${kS}i` : `${kS}i√${m}`) : surd(nk, m);
  const fmt = (sign: "+" | "−") => {
    const nbS = nb === B0 ? "" : nb.toString().replace(/^-/, MINUS);
    const top = nbS ? `${nbS} ${sign} ${radStr}` : sign === "−" ? neg(radStr) : radStr;
    if (den === B1) return top;
    return nbS ? `(${top})/${den}` : `${top}/${den}`;
  };
  const combinedTop = nb === B0 ? `±${radStr}` : `${nb.toString().replace(/^-/, MINUS)} ± ${radStr}`;
  const combined = den === B1 ? combinedTop : nb === B0 ? `${combinedTop}/${den}` : `(${combinedTop})/${den}`;
  return { ...base, kind: disc < B0 ? "complex" : "two-irrational", exact: [fmt("−"), fmt("+")], combined };
}

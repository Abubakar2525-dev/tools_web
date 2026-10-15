/** Sequence identification from a few terms (exact rationals). */

import { Q } from "./rational";

export type SequenceGuess =
  | { kind: "arithmetic"; a1: Q; d: Q; next: Q[]; formula: string }
  | { kind: "geometric"; a1: Q; r: Q; next: Q[]; formula: string }
  | { kind: "polynomial"; degree: number; next: Q[]; formula: string; diffs: Q[][] }
  | { kind: "fibonacci-like"; next: Q[]; formula: string }
  | { kind: "unknown"; diffs: Q[][] };

function diffTable(t: Q[]): Q[][] {
  const rows: Q[][] = [t];
  while (rows[rows.length - 1].length > 1) {
    const prev = rows[rows.length - 1];
    rows.push(prev.slice(1).map((v, i) => v.sub(prev[i])));
  }
  return rows;
}

const allEqual = (xs: Q[]) => xs.every((x) => x.eq(xs[0]));

/** Lagrange-free polynomial fit via Newton forward differences: returns coefficients c0..cd in n (1-based). */
function polyFromDiffs(t: Q[], degree: number): Q[] {
  // Solve Vandermonde with n = 1..degree+1 exactly using Gaussian elimination.
  const k = degree + 1;
  const rows = Array.from({ length: k }, (_, i) => {
    const n = Q.int(i + 1);
    const row: Q[] = [];
    let p = Q.ONE;
    for (let j = 0; j < k; j++) {
      row.push(p);
      p = p.mul(n);
    }
    row.push(t[i]);
    return row;
  });
  for (let c = 0; c < k; c++) {
    const piv = rows.findIndex((r, i) => i >= c && !r[c].isZero());
    [rows[c], rows[piv]] = [rows[piv], rows[c]];
    const pv = rows[c][c];
    rows[c] = rows[c].map((v) => v.div(pv));
    for (let i = 0; i < k; i++) {
      if (i === c) continue;
      const f = rows[i][c];
      rows[i] = rows[i].map((v, j) => v.sub(f.mul(rows[c][j])));
    }
  }
  return rows.map((r) => r[k]);
}

function polyString(c: Q[]): string {
  const parts: string[] = [];
  for (let j = c.length - 1; j >= 0; j--) {
    const v = c[j];
    if (v.isZero()) continue;
    const abs = v.abs();
    const coef = j > 0 && abs.eq(Q.ONE) ? "" : abs.isInt() ? abs.toString() : `(${abs})`;
    const term = j === 0 ? abs.toString() : j === 1 ? `${coef}n` : `${coef}n^${j}`;
    parts.push(`${v.sign() < 0 ? "−" : "+"} ${term}`);
  }
  if (!parts.length) return "0";
  return parts.join(" ").replace(/^\+ /, "").replace(/^− /, "−");
}

export function identifySequence(t: Q[], extra = 5): SequenceGuess {
  const diffs = diffTable(t);
  if (t.length < 3) return { kind: "unknown", diffs };
  const d = t[1].sub(t[0]);
  if (allEqual(diffs[1])) {
    const next = Array.from({ length: extra }, (_, i) => t[t.length - 1].add(d.mul(Q.int(i + 1))));
    return { kind: "arithmetic", a1: t[0], d, next, formula: `aₙ = ${t[0]} + (n − 1) × ${d}` };
  }
  if (t.every((x) => !x.isZero())) {
    const r = t[1].div(t[0]);
    if (t.every((x, i) => i === 0 || x.eq(t[i - 1].mul(r)))) {
      const next: Q[] = [];
      let last = t[t.length - 1];
      for (let i = 0; i < extra; i++) {
        last = last.mul(r);
        next.push(last);
      }
      return { kind: "geometric", a1: t[0], r, next, formula: `aₙ = ${t[0]} × (${r})^(n − 1)` };
    }
  }
  if (t.length >= 4 && t.every((x, i) => i < 2 || x.eq(t[i - 1].add(t[i - 2])))) {
    const next: Q[] = [];
    let [a, b] = [t[t.length - 2], t[t.length - 1]];
    for (let i = 0; i < extra; i++) {
      [a, b] = [b, a.add(b)];
      next.push(b);
    }
    return { kind: "fibonacci-like", next, formula: "aₙ = aₙ₋₁ + aₙ₋₂" };
  }
  // Polynomial: some difference row (needs ≥ 2 entries to be meaningful) is constant.
  for (let k = 2; k < diffs.length - 1; k++) {
    if (diffs[k].length >= 2 && allEqual(diffs[k])) {
      const coeffs = polyFromDiffs(t, k);
      const next = Array.from({ length: extra }, (_, i) => {
        const n = Q.int(t.length + i + 1);
        let s = Q.ZERO;
        let p = Q.ONE;
        for (const c of coeffs) {
          s = s.add(c.mul(p));
          p = p.mul(n);
        }
        return s;
      });
      return { kind: "polynomial", degree: k, next, formula: `aₙ = ${polyString(coeffs)}`, diffs };
    }
  }
  return { kind: "unknown", diffs };
}

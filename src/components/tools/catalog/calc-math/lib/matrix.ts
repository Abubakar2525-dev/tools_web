/** Exact rational matrix arithmetic (Gauss-Jordan elimination on Q). */

import { Q } from "./rational";

export type Mat = Q[][];

export const dims = (m: Mat) => [m.length, m[0]?.length ?? 0] as const;

export function zeros(r: number, c: number): Mat {
  return Array.from({ length: r }, () => Array.from({ length: c }, () => Q.ZERO));
}

export function identity(n: number): Mat {
  return Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? Q.ONE : Q.ZERO)));
}

export function add(a: Mat, b: Mat): Mat {
  if (a.length !== b.length || a[0].length !== b[0].length) throw new Error("A and B must have the same size to add.");
  return a.map((row, i) => row.map((v, j) => v.add(b[i][j])));
}

export function sub(a: Mat, b: Mat): Mat {
  if (a.length !== b.length || a[0].length !== b[0].length) throw new Error("A and B must have the same size to subtract.");
  return a.map((row, i) => row.map((v, j) => v.sub(b[i][j])));
}

export function mul(a: Mat, b: Mat): Mat {
  const [, ac] = dims(a);
  const [br, bc] = dims(b);
  if (ac !== br) throw new Error(`Columns of A (${ac}) must equal rows of B (${br}) to multiply.`);
  return a.map((row) =>
    Array.from({ length: bc }, (_, j) => row.reduce((s, v, k) => s.add(v.mul(b[k][j])), Q.ZERO)),
  );
}

export function scale(a: Mat, k: Q): Mat {
  return a.map((row) => row.map((v) => v.mul(k)));
}

export function transpose(a: Mat): Mat {
  const [r, c] = dims(a);
  return Array.from({ length: c }, (_, j) => Array.from({ length: r }, (_, i) => a[i][j]));
}

export function trace(a: Mat): Q {
  if (a.length !== a[0].length) throw new Error("Trace needs a square matrix.");
  return a.reduce((s, row, i) => s.add(row[i]), Q.ZERO);
}

export function power(a: Mat, e: number): Mat {
  if (a.length !== a[0].length) throw new Error("Powers need a square matrix.");
  if (e < 0) return power(inverse(a).inverse, -e);
  let result = identity(a.length);
  let base = a;
  while (e > 0) {
    if (e & 1) result = mul(result, base);
    base = mul(base, base);
    e >>= 1;
  }
  return result;
}

const sub1 = (n: number) => n + 1;

/**
 * Reduced row echelon form with a log of row operations.
 * `augCols` marks how many columns at the right are an augmented part (not pivoted).
 */
export function rref(a: Mat, augCols = 0): { m: Mat; rank: number; pivots: number[]; ops: string[]; swaps: number; det: Q } {
  const m = a.map((row) => [...row]);
  const [rows, cols] = dims(m);
  const pivotCols = cols - augCols;
  const ops: string[] = [];
  const pivots: number[] = [];
  let r = 0;
  let swaps = 0;
  let det = Q.ONE;
  for (let c = 0; c < pivotCols && r < rows; c++) {
    let p = -1;
    for (let i = r; i < rows; i++) {
      if (!m[i][c].isZero()) {
        p = i;
        break;
      }
    }
    if (p < 0) continue;
    if (p !== r) {
      [m[p], m[r]] = [m[r], m[p]];
      swaps++;
      ops.push(`R${sub1(r)} ↔ R${sub1(p)}`);
    }
    const pv = m[r][c];
    det = det.mul(pv);
    if (!pv.eq(Q.ONE)) {
      m[r] = m[r].map((v) => v.div(pv));
      ops.push(`R${sub1(r)} → R${sub1(r)} ÷ ${pv}`);
    }
    for (let i = 0; i < rows; i++) {
      if (i === r || m[i][c].isZero()) continue;
      const f = m[i][c];
      m[i] = m[i].map((v, j) => v.sub(f.mul(m[r][j])));
      const fs = f.sign() < 0 ? `+ ${f.neg()}` : `− ${f}`;
      ops.push(`R${sub1(i)} → R${sub1(i)} ${fs} × R${sub1(r)}`);
    }
    pivots.push(c);
    r++;
  }
  const square = rows === pivotCols;
  const detFinal = square && r === rows ? (swaps % 2 ? det.neg() : det) : Q.ZERO;
  return { m, rank: r, pivots, ops, swaps, det: detFinal };
}

export function determinant(a: Mat): Q {
  if (a.length !== a[0].length) throw new Error("The determinant needs a square matrix.");
  return rref(a).det;
}

export function rank(a: Mat): number {
  return rref(a).rank;
}

export function inverse(a: Mat): { inverse: Mat; ops: string[] } {
  const n = a.length;
  if (n !== a[0].length) throw new Error("Only square matrices have an inverse.");
  const aug = a.map((row, i) => [...row, ...identity(n)[i]]);
  const res = rref(aug, n);
  if (res.rank < n) throw new Error("The matrix is singular (determinant 0), so it has no inverse.");
  return { inverse: res.m.map((row) => row.slice(n)), ops: res.ops };
}

/** Parses a grid of strings into a matrix; returns the first bad cell on failure. */
export function parseGrid(cells: string[][]): { m: Mat } | { error: string; row: number; col: number } {
  const out: Mat = [];
  for (let i = 0; i < cells.length; i++) {
    const row: Q[] = [];
    for (let j = 0; j < cells[i].length; j++) {
      const raw = cells[i][j].trim();
      const v = raw === "" ? Q.ZERO : Q.parse(raw);
      if (!v) return { error: `Row ${i + 1}, column ${j + 1}: "${raw}" is not a number or fraction.`, row: i, col: j };
      row.push(v);
    }
    out.push(row);
  }
  return { m: out };
}

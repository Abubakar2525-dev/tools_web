/**
 * Chemical equation parsing and balancing.
 *
 * Balancing builds a composition matrix (one row per element, plus one row
 * for net charge when ions or electrons are present; one column per species,
 * products negated) and finds its nullspace with exact rational Gaussian
 * elimination on BigInt fractions, so there is no floating-point rounding.
 * A one-dimensional nullspace gives a unique set of smallest whole-number
 * coefficients.
 */

import { FormulaError, parseFormula, prettyFormula, type ParsedFormula } from "./formula";

/* ------------------------------------------------------------------ */
/* Exact rationals                                                     */
/* ------------------------------------------------------------------ */

const Z = BigInt(0);
const ONE = BigInt(1);

export type Q = { n: bigint; d: bigint };

const babs = (a: bigint) => (a < Z ? -a : a);
export function bgcd(a: bigint, b: bigint): bigint {
  a = babs(a);
  b = babs(b);
  while (b !== Z) [a, b] = [b, a % b];
  return a;
}
const blcm = (a: bigint, b: bigint) => (a === Z || b === Z ? Z : babs(a * b) / bgcd(a, b));

export function q(n: bigint | number, d: bigint | number = 1): Q {
  let nn = typeof n === "bigint" ? n : BigInt(n);
  let dd = typeof d === "bigint" ? d : BigInt(d);
  if (dd === Z) throw new Error("Division by zero");
  if (dd < Z) {
    nn = -nn;
    dd = -dd;
  }
  const g = bgcd(nn, dd);
  return g > ONE ? { n: nn / g, d: dd / g } : { n: nn, d: dd };
}
export const qsub = (a: Q, b: Q) => q(a.n * b.d - b.n * a.d, a.d * b.d);
export const qmul = (a: Q, b: Q) => q(a.n * b.n, a.d * b.d);
export const qdiv = (a: Q, b: Q) => q(a.n * b.d, a.d * b.n);
export const qzero = (a: Q) => a.n === Z;

/** Nullspace basis of an integer matrix, exact. Each basis vector is scaled to coprime integers. */
export function nullspace(matrix: number[][], cols: number): { basis: bigint[][]; rank: number } {
  const m: Q[][] = matrix.map((row) => row.map((x) => q(x)));
  const rows = m.length;
  const pivots: number[] = [];
  let r = 0;
  for (let c = 0; c < cols && r < rows; c++) {
    let p = -1;
    for (let i = r; i < rows; i++) if (!qzero(m[i][c])) {
      p = i;
      break;
    }
    if (p < 0) continue;
    [m[r], m[p]] = [m[p], m[r]];
    const pv = m[r][c];
    m[r] = m[r].map((x) => qdiv(x, pv));
    for (let i = 0; i < rows; i++) {
      if (i === r || qzero(m[i][c])) continue;
      const f = m[i][c];
      m[i] = m[i].map((x, j) => qsub(x, qmul(f, m[r][j])));
    }
    pivots.push(c);
    r++;
  }
  const free = [...Array(cols).keys()].filter((c) => !pivots.includes(c));
  const basis = free.map((fc) => {
    const v: Q[] = Array.from({ length: cols }, () => q(0));
    v[fc] = q(1);
    pivots.forEach((pc, i) => {
      v[pc] = q(-m[i][fc].n, m[i][fc].d);
    });
    return toIntegers(v);
  });
  return { basis, rank: pivots.length };
}

function toIntegers(v: Q[]): bigint[] {
  let l = ONE;
  for (const x of v) l = blcm(l, x.d);
  const ints = v.map((x) => (x.n * l) / x.d);
  let g = Z;
  for (const x of ints) g = bgcd(g, x);
  return g > ONE ? ints.map((x) => x / g) : ints;
}

/* ------------------------------------------------------------------ */
/* Equation parsing                                                    */
/* ------------------------------------------------------------------ */

export interface Species extends ParsedFormula {
  /** Text as typed (trimmed, without coefficient). */
  text: string;
  side: "reactant" | "product";
  /** Coefficient typed by the user, or null if none. */
  given: number | null;
}

export interface ParsedEquation {
  reactants: Species[];
  products: Species[];
}

const ARROW = /\s*(<=+>|<-+>|⇌|⇄|↔|⟶|→|-+>|=+>|=)\s*/;

/** Splits one side of an equation on "+" signs that separate species (not charges). */
export function splitSpecies(side: string): string[] {
  const out: string[] = [];
  let cur = "";
  for (let i = 0; i < side.length; i++) {
    const ch = side[i];
    if (ch === "+") {
      let j = i + 1;
      while (j < side.length && side[j] === " ") j++;
      const next = side[j] ?? "";
      let k = i - 1;
      while (k >= 0 && side[k] === " ") k--;
      const prev = side[k] ?? "";
      const startsSpecies = /[A-Z(\[{\d]/.test(next) || (next === "e" && !/[a-z]/.test(side[j + 1] ?? ""));
      const spaced = side[i - 1] === " " && side[i + 1] === " ";
      if (prev !== "^" && prev !== "{" && cur.trim() !== "" && (startsSpecies || spaced)) {
        out.push(cur.trim());
        cur = "";
        continue;
      }
    }
    cur += ch;
  }
  if (cur.trim() !== "") out.push(cur.trim());
  return out;
}

export function parseEquation(input: string): ParsedEquation {
  const text = input.replace(/[−–—]/g, "-").trim();
  if (text === "") throw new FormulaError("Enter a chemical equation, for example H2 + O2 = H2O.");
  const parts = text.split(ARROW).filter((_, i) => i % 2 === 0);
  if (parts.length < 2) throw new FormulaError('Separate reactants and products with an arrow, for example "->" or "=".');
  if (parts.length > 2) throw new FormulaError("Use only one arrow between reactants and products.");
  const make = (side: string, which: Species["side"]): Species[] => {
    const items = splitSpecies(side);
    if (items.length === 0) throw new FormulaError(`The ${which} side is empty.`);
    return items.map((raw) => {
      let p: ParsedFormula;
      try {
        p = parseFormula(raw);
      } catch (e) {
        throw new FormulaError(`In "${raw}": ${e instanceof Error ? e.message : String(e)}`);
      }
      const hasCoef = /^\d/.test(raw.trim());
      return { ...p, text: p.formula, side: which, given: hasCoef ? p.coefficient : null };
    });
  };
  return { reactants: make(parts[0], "reactant"), products: make(parts[1], "product") };
}

/* ------------------------------------------------------------------ */
/* Balancing                                                           */
/* ------------------------------------------------------------------ */

export interface AtomCheckRow {
  label: string;
  left: number;
  right: number;
}

export type BalanceResult =
  | {
      ok: true;
      species: Species[];
      coefficients: number[];
      equation: string;
      check: AtomCheckRow[];
      /** True when the user's own coefficients were already correct. */
      givenWasBalanced: boolean;
    }
  | { ok: false; reason: string; species: Species[] };

export function balance(eq: ParsedEquation): BalanceResult {
  const species = [...eq.reactants, ...eq.products];
  const elements: string[] = [];
  for (const s of species) for (const k of s.counts.keys()) if (!elements.includes(k)) elements.push(k);
  const charged = species.some((s) => s.charge !== 0);

  for (const el of elements) {
    const l = eq.reactants.some((s) => s.counts.has(el));
    const r = eq.products.some((s) => s.counts.has(el));
    if (l !== r) {
      return { ok: false, species, reason: `${el} appears only on the ${l ? "reactant" : "product"} side, so the equation cannot be balanced. Check the formulas.` };
    }
  }

  const sign = (s: Species) => (s.side === "reactant" ? 1 : -1);
  const matrix = elements.map((el) => species.map((s) => sign(s) * (s.counts.get(el) ?? 0)));
  if (charged) matrix.push(species.map((s) => sign(s) * s.charge));

  const { basis } = nullspace(matrix, species.length);
  if (basis.length === 0) {
    return { ok: false, species, reason: charged ? "No set of coefficients balances both atoms and charge. Check the formulas and charges." : "No set of coefficients balances every element. Check the formulas." };
  }
  if (basis.length > 1) {
    return {
      ok: false,
      species,
      reason: `This equation has ${basis.length} independent ways to balance it (it mixes more than one reaction), so there is no single answer. Remove a species or split it into separate reactions.`,
    };
  }
  let v = basis[0];
  if (v.every((x) => x <= Z)) v = v.map((x) => -x);
  const zeroIdx = v.findIndex((x) => x === Z);
  if (zeroIdx >= 0) {
    return { ok: false, species, reason: `${prettyFormula(species[zeroIdx].text)} would need a coefficient of 0, so it does not take part in this reaction. Remove it or check the formulas.` };
  }
  if (v.some((x) => x < Z)) {
    const bad = species.filter((_, i) => v[i] < Z).map((s) => prettyFormula(s.text));
    return { ok: false, species, reason: `A balance exists only if ${bad.join(", ")} switch${bad.length === 1 ? "es" : ""} sides. Check which side each species belongs on.` };
  }
  const coefficients = v.map((x) => Number(x));
  const check = checkRows(species, coefficients, elements, charged);
  const givenWasBalanced =
    species.every((s) => s.given !== null) && isBalanced(species, species.map((s) => s.given as number), elements, charged);
  return { ok: true, species, coefficients, equation: formatEquation(species, coefficients), check, givenWasBalanced };
}

function checkRows(species: Species[], coef: number[], elements: string[], charged: boolean): AtomCheckRow[] {
  const rows = elements.map((el) => {
    let left = 0;
    let right = 0;
    species.forEach((s, i) => {
      const n = (s.counts.get(el) ?? 0) * coef[i];
      if (s.side === "reactant") left += n;
      else right += n;
    });
    return { label: el, left, right };
  });
  if (charged) {
    let left = 0;
    let right = 0;
    species.forEach((s, i) => {
      if (s.side === "reactant") left += s.charge * coef[i];
      else right += s.charge * coef[i];
    });
    rows.push({ label: "Charge", left, right });
  }
  return rows;
}

function isBalanced(species: Species[], coef: number[], elements: string[], charged: boolean) {
  return checkRows(species, coef, elements, charged).every((r) => r.left === r.right);
}

export function formatEquation(species: Species[], coef: number[], pretty = true): string {
  const side = (which: Species["side"]) =>
    species
      .map((s, i) => ({ s, c: coef[i] }))
      .filter(({ s }) => s.side === which)
      .map(({ s, c }) => (c === 1 ? "" : `${c} `) + (pretty ? prettyFormula(s.text) : s.text))
      .join(" + ");
  return `${side("reactant")} → ${side("product")}`;
}

/** Parse and balance in one step. Throws FormulaError on parse errors. */
export function balanceEquation(input: string): BalanceResult {
  return balance(parseEquation(input));
}

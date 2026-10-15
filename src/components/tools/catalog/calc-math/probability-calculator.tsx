"use client";

import { FormulaTool, num, type FormulaSpec } from "@/components/tools/engines/FormulaTool";
import { binomCdf, binomPmf } from "./lib/distributions";

const pct = (p: number) => `${num(p * 100, 8)}%`;
const both = (p: number) => `${num(p, 10)} (${pct(p)})`;

const spec: FormulaSpec = {
  modes: [
    { id: "two", label: "Two events", fields: ["pa", "pb", "rel", "pab"] },
    { id: "repeat", label: "At least once", fields: ["p", "n", "target"] },
    { id: "binom", label: "Binomial", fields: ["bn", "bk", "bp"] },
  ],
  fields: [
    { id: "pa", label: "P(A)", type: "number", min: 0, max: 1, placeholder: "0.5", hint: "Probability from 0 to 1." },
    { id: "pb", label: "P(B)", type: "number", min: 0, max: 1, placeholder: "0.3" },
    {
      id: "rel",
      label: "How A and B relate",
      type: "select",
      options: [
        { value: "indep", label: "Independent" },
        { value: "excl", label: "Mutually exclusive" },
        { value: "given", label: "I know P(A and B)" },
      ],
    },
    { id: "pab", label: "P(A and B)", type: "number", min: 0, max: 1, optional: true, placeholder: "0.1", hint: "Only used with “I know P(A and B)”." },
    { id: "p", label: "Probability per trial (p)", type: "number", min: 0, max: 1, placeholder: "0.05" },
    { id: "n", label: "Number of trials (n)", type: "number", integer: true, min: 1, max: 1e9, placeholder: "20" },
    { id: "target", label: "Target chance of at least once", type: "number", gt: 0, max: 0.999999, optional: true, placeholder: "0.9", hint: "Optional: how many trials until this chance is reached." },
    { id: "bn", label: "Trials (n)", type: "number", integer: true, min: 1, max: 1e6, placeholder: "10" },
    { id: "bk", label: "Successes (k)", type: "number", integer: true, min: 0, max: 1e6, placeholder: "3" },
    { id: "bp", label: "Success probability (p)", type: "number", min: 0, max: 1, placeholder: "0.5" },
  ],
  example: { pa: "0.5", pb: "0.3", rel: "indep", p: "0.05", n: "20", target: "0.9", bn: "10", bk: "3", bp: "0.5" },
  compute: (v) => {
    if (v.mode === "two") {
      const a = v.num("pa");
      const b = v.num("pb");
      if (a === null || b === null) return null;
      const rel = v.str("rel");
      let ab: number;
      let how: string;
      if (rel === "indep") {
        ab = a * b;
        how = `Independent: P(A and B) = P(A) × P(B) = ${num(a)} × ${num(b)} = ${num(ab, 10)}`;
      } else if (rel === "excl") {
        if (a + b > 1 + 1e-12) return "Mutually exclusive events need P(A) + P(B) ≤ 1.";
        ab = 0;
        how = "Mutually exclusive: P(A and B) = 0";
      } else {
        const given = v.num("pab");
        if (given === null) return "Enter P(A and B).";
        if (given > Math.min(a, b) + 1e-12) return "P(A and B) cannot exceed P(A) or P(B).";
        if (given < a + b - 1 - 1e-12) return "P(A and B) is too small: P(A or B) would exceed 1.";
        ab = given;
        how = `Given: P(A and B) = ${num(ab)}`;
      }
      const or = a + b - ab;
      return {
        outputs: [
          { label: "P(A and B)", value: both(ab), primary: true },
          { label: "P(A or B)", value: both(or) },
          { label: "P(not A)", value: both(1 - a) },
          { label: "P(neither)", value: both(1 - or) },
          { label: "P(exactly one)", value: both(or - ab) },
          { label: "P(A given B)", value: b > 0 ? both(ab / b) : "undefined" },
        ],
        steps: [
          how,
          `P(A or B) = P(A) + P(B) − P(A and B) = ${num(a)} + ${num(b)} − ${num(ab, 10)} = ${num(or, 10)}`,
          `P(neither) = 1 − P(A or B) = ${num(1 - or, 10)}`,
          `P(exactly one) = P(A or B) − P(A and B) = ${num(or - ab, 10)}`,
          ...(b > 0 ? [`P(A | B) = P(A and B) / P(B) = ${num(ab, 10)} / ${num(b)} = ${num(ab / b, 10)}`] : []),
        ],
      };
    }
    if (v.mode === "repeat") {
      const p = v.num("p");
      const n = v.num("n");
      if (p === null || n === null) return null;
      const none = Math.exp(n * Math.log1p(-p));
      const atLeast = p === 1 ? 1 : -Math.expm1(n * Math.log1p(-p));
      const exactlyOne = p === 0 ? 0 : p === 1 ? (n === 1 ? 1 : 0) : n * p * Math.exp((n - 1) * Math.log1p(-p));
      const target = v.num("target");
      let needed: number | null = null;
      if (target !== null && p > 0 && p < 1) needed = Math.ceil(Math.log1p(-target) / Math.log1p(-p) - 1e-12);
      return {
        outputs: [
          { label: "P(at least once)", value: both(atLeast), primary: true },
          { label: "P(never)", value: both(p === 1 ? 0 : none) },
          { label: "P(exactly once)", value: both(exactlyOne) },
          { label: "Expected successes", value: num(n * p, 10) },
          ...(needed !== null && target !== null ? [{ label: `Trials for ${pct(target)}`, value: needed.toLocaleString("en-US") }] : []),
        ],
        steps: [
          `P(never) = (1 − p)^n = (1 − ${num(p)})^${n} = ${num(none, 10)}`,
          `P(at least once) = 1 − (1 − p)^n = ${num(atLeast, 10)}`,
          `P(exactly once) = n × p × (1 − p)^(n−1) = ${num(exactlyOne, 10)}`,
          ...(needed !== null && target !== null ? [`Trials needed: n ≥ ln(1 − ${num(target)}) / ln(1 − ${num(p)}) → ${needed}`] : []),
        ],
        notes: ["Assumes independent trials with the same probability each time."],
      };
    }
    const n = v.num("bn");
    const k = v.num("bk");
    const p = v.num("bp");
    if (n === null || k === null || p === null) return null;
    if (k > n) return "k cannot be greater than n.";
    const eq = binomPmf(k, n, p);
    const le = binomCdf(k, n, p);
    const lt = k > 0 ? binomCdf(k - 1, n, p) : 0;
    const ge = 1 - lt;
    const gt = 1 - le;
    const rows: (string | number)[][] = [];
    if (n <= 60) for (let i = 0; i <= n; i++) rows.push([i, num(binomPmf(i, n, p), 8), num(binomCdf(i, n, p), 8)]);
    return {
      outputs: [
        { label: `P(X = ${k})`, value: both(eq), primary: true },
        { label: `P(X ≤ ${k})`, value: both(le) },
        { label: `P(X < ${k})`, value: both(lt) },
        { label: `P(X ≥ ${k})`, value: both(ge) },
        { label: `P(X > ${k})`, value: both(gt) },
        { label: "Mean, SD", value: `${num(n * p, 8)}, ${num(Math.sqrt(n * p * (1 - p)), 8)}` },
      ],
      steps: [
        `P(X = k) = C(n, k) × p^k × (1 − p)^(n − k)`,
        `= C(${n}, ${k}) × ${num(p)}^${k} × ${num(1 - p)}^${n - k} = ${num(eq, 12)}`,
        `P(X ≤ k) is the sum of P(X = i) for i = 0 to ${k}, computed with the regularized incomplete beta function: ${num(le, 12)}`,
        `Mean = np = ${num(n * p, 10)}; SD = √(np(1 − p)) = ${num(Math.sqrt(n * p * (1 - p)), 10)}`,
      ],
      table: rows.length ? { caption: "Distribution", columns: ["k", "P(X = k)", "P(X ≤ k)"], rows } : undefined,
    };
  },
};

export default function Tool() {
  return <FormulaTool spec={spec} />;
}

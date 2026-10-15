"use client";

import { FormulaTool, num, type FormulaSpec } from "@/components/tools/engines/FormulaTool";
import { Q } from "./lib/rational";
import { identifySequence } from "./lib/sequence";

const MAX_N = 100000;

/** Exact when short, otherwise a decimal approximation. */
const show = (q: Q) => {
  const s = q.toString();
  return s.length <= 30 ? s : num(q.toNumber(), 12);
};

const spec: FormulaSpec = {
  modes: [
    { id: "arith", label: "Arithmetic", fields: ["a1", "d", "n"] },
    { id: "geo", label: "Geometric", fields: ["a1", "r", "n"] },
    { id: "identify", label: "Identify from terms", fields: ["terms"] },
  ],
  fields: [
    { id: "a1", label: "First term (a₁)", type: "text", placeholder: "3" },
    { id: "d", label: "Common difference (d)", type: "text", placeholder: "4" },
    { id: "r", label: "Common ratio (r)", type: "text", placeholder: "2 or 1/2" },
    { id: "n", label: "Term number (n)", type: "number", integer: true, min: 1, max: MAX_N, placeholder: "10" },
    { id: "terms", label: "Known terms", type: "text", multiline: true, placeholder: "2, 6, 12, 20, 30", hint: "At least 3 terms (4 or more for reliable detection), separated by commas or spaces." },
  ],
  example: { a1: "3", d: "4", r: "2", n: "10", terms: "2, 6, 12, 20, 30" },
  compute: (v) => {
    if (v.mode === "identify") {
      const toks = v.str("terms").split(/[\s,;]+/).filter(Boolean);
      const terms: Q[] = [];
      for (const t of toks) {
        const q = Q.parse(t);
        if (!q) return `"${t}" is not a number.`;
        terms.push(q);
      }
      if (terms.length < 3) return "Enter at least 3 terms.";
      if (terms.length > 50) return "Enter at most 50 terms.";
      const g = identifySequence(terms, 5);
      const kindLabel = {
        arithmetic: "Arithmetic",
        geometric: "Geometric",
        polynomial: "Polynomial",
        "fibonacci-like": "Fibonacci-like",
        unknown: "Not recognized",
      }[g.kind];
      const diffs = "diffs" in g ? g.diffs : [];
      return {
        outputs: [
          { label: "Sequence type", value: g.kind === "polynomial" ? `${kindLabel} (degree ${g.degree})` : kindLabel, primary: true },
          ...("formula" in g ? [{ label: "General term", value: g.formula }] : []),
          ...("next" in g ? [{ label: "Next 5 terms", value: g.next.map(show).join(", ") }] : []),
          ...(g.kind === "arithmetic" ? [{ label: "Common difference", value: g.d.toString() }] : []),
          ...(g.kind === "geometric" ? [{ label: "Common ratio", value: g.r.toString() }] : []),
        ],
        steps: [
          "Checked in order: constant difference (arithmetic), constant ratio (geometric), each term = sum of the previous two, then constant k-th differences (polynomial of degree k)",
          ...diffs.slice(1, 5).map((row, i) => `Differences level ${i + 1}: ${row.map(show).join(", ")}`),
        ],
        notes: [
          g.kind === "unknown"
            ? "No simple rule fits. Any finite list fits many formulas, so try adding more terms."
            : "A pattern found from a few terms is the simplest fit, not a proof. More terms make the match more convincing.",
        ],
      };
    }
    const a1 = Q.parse(v.str("a1"));
    const n = v.num("n");
    if (!a1) return "The first term is not a valid number.";
    if (n === null) return null;
    const N = Q.int(n);
    if (v.mode === "arith") {
      const d = Q.parse(v.str("d"));
      if (!d) return "The common difference is not a valid number.";
      const an = a1.add(d.mul(Q.int(n - 1)));
      const sn = N.mul(a1.add(an)).div(Q.int(2));
      const rows = Array.from({ length: Math.min(n, 12) }, (_, i) => [i + 1, show(a1.add(d.mul(Q.int(i))))]);
      return {
        outputs: [
          { label: `Term ${n}`, value: show(an), primary: true },
          { label: `Sum of first ${n} terms`, value: show(sn) },
          { label: "General term", value: `aₙ = ${a1} + (n − 1) × ${d}` },
        ],
        table: { caption: n > 12 ? "First 12 terms" : "Terms", columns: ["n", "aₙ"], rows },
        steps: [`aₙ = a₁ + (n − 1)d = ${a1} + (${n} − 1) × ${d} = ${show(an)}`, `Sₙ = n(a₁ + aₙ) / 2 = ${n} × (${a1} + ${show(an)}) / 2 = ${show(sn)}`],
      };
    }
    const r = Q.parse(v.str("r"));
    if (!r) return "The common ratio is not a valid number.";
    const big = (n - 1) * Math.log10(Math.max(Math.abs(r.toNumber()), 1e-300))
    const exact = n <= 2000 && (r.n.toString().length + r.d.toString().length) * n < 400000;
    let anText: string;
    let snText: string;
    if (exact) {
      const an = a1.mul(r.pow(n - 1));
      const sn = r.eq(Q.ONE) ? a1.mul(N) : a1.mul(Q.ONE.sub(r.pow(n))).div(Q.ONE.sub(r));
      anText = show(an);
      snText = show(sn);
    } else {
      const rf = r.toNumber();
      const af = a1.toNumber();
      anText = num(af * Math.pow(rf, n - 1), 12);
      snText = rf === 1 ? num(af * n, 12) : num((af * (1 - Math.pow(rf, n))) / (1 - rf), 12);
    }
    const rows = Array.from({ length: Math.min(n, 12) }, (_, i) => [i + 1, show(a1.mul(r.pow(i)))]);
    return {
      outputs: [
        { label: `Term ${n}`, value: anText, primary: true },
        { label: `Sum of first ${n} terms`, value: snText },
        { label: "General term", value: `aₙ = ${a1} × (${r})^(n − 1)` },
      ],
      table: { caption: n > 12 ? "First 12 terms" : "Terms", columns: ["n", "aₙ"], rows },
      steps: [
        `aₙ = a₁ × r^(n − 1) = ${a1} × (${r})^${n - 1} = ${anText}`,
        r.eq(Q.ONE) ? `r = 1, so Sₙ = n × a₁ = ${snText}` : `Sₙ = a₁(1 − rⁿ) / (1 − r) = ${snText}`,
      ],
      notes: exact ? undefined : [`Shown as a decimal because the exact value is very long (about ${Math.abs(Math.round(big))} digits).`],
    };
  },
};

export default function Tool() {
  return <FormulaTool spec={spec} />;
}

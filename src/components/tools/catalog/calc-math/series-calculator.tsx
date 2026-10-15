"use client";

import { all, create, type EvalFunction } from "mathjs";
import { FormulaTool, num, type FormulaSpec } from "@/components/tools/engines/FormulaTool";
import { Q } from "./lib/rational";

const math = create(all);
const MAX_TERMS = 1_000_000;

const show = (q: Q) => {
  const s = q.toString();
  return s.length <= 30 ? s : num(q.toNumber(), 12);
};

const spec: FormulaSpec = {
  modes: [
    { id: "sum", label: "Σ of an expression", fields: ["expr", "from", "to"] },
    { id: "arith", label: "Arithmetic series", fields: ["a1", "d", "n"] },
    { id: "geo", label: "Geometric series", fields: ["a1", "r", "n", "infinite"] },
  ],
  fields: [
    { id: "expr", label: "Term f(k)", type: "text", mono: true, placeholder: "1/k^2", hint: "Use k as the index. Example: k^2, 1/2^k, (-1)^k/(2k+1)." },
    { id: "from", label: "k from", type: "number", integer: true, placeholder: "1" },
    { id: "to", label: "k to", type: "number", integer: true, placeholder: "100" },
    { id: "a1", label: "First term (a₁)", type: "text", placeholder: "1" },
    { id: "d", label: "Common difference (d)", type: "text", placeholder: "2" },
    { id: "r", label: "Common ratio (r)", type: "text", placeholder: "1/2" },
    { id: "n", label: "Number of terms (n)", type: "number", integer: true, min: 1, max: 100000, placeholder: "10", optional: true },
    { id: "infinite", label: "Sum to infinity", type: "checkbox", hint: "Only converges when |r| < 1." },
  ],
  defaults: { from: "1", to: "100" },
  example: { expr: "1/k^2", from: "1", to: "1000", a1: "1", d: "2", r: "1/2", n: "10" },
  compute: (v) => {
    if (v.mode === "sum") {
      const from = v.num("from");
      const to = v.num("to");
      if (from === null || to === null) return null;
      if (to < from) return "The upper limit must be at least the lower limit.";
      if (to - from + 1 > MAX_TERMS) return `At most ${MAX_TERMS.toLocaleString("en-US")} terms.`;
      let code: EvalFunction;
      let parsed: string;
      try {
        const node = math.parse(v.str("expr").replace(/−/g, "-"));
        parsed = node.toString();
        code = node.compile();
      } catch {
        return "Could not read the expression. Use k as the variable, for example 1/k^2.";
      }
      let s = 0;
      let c = 0;
      const first: (string | number)[][] = [];
      let last: (string | number)[] | null = null;
      for (let k = from; k <= to; k++) {
        let t: unknown;
        try {
          t = code.evaluate({ k });
        } catch (e) {
          return `Error at k = ${k}: ${e instanceof Error ? e.message : "could not evaluate"}.`;
        }
        if (typeof t !== "number" || !Number.isFinite(t)) return `The term is not a finite real number at k = ${k}.`;
        const y = t - c;
        const tt = s + y;
        c = tt - s - y;
        s = tt;
        if (first.length < 8) first.push([k, num(t, 10), num(s, 12)]);
        else last = [k, num(t, 10), num(s, 12)];
      }
      const rows = last ? [...first, ["…", "…", "…"], last] : first;
      return {
        outputs: [
          { label: `Σ from k = ${from} to ${to}`, value: num(s, 14), primary: true },
          { label: "Terms added", value: (to - from + 1).toLocaleString("en-US") },
          { label: "Average term", value: num(s / (to - from + 1), 12) },
        ],
        table: { caption: "Terms and running total", columns: ["k", "f(k)", "Partial sum"], rows },
        steps: [`f(k) = ${parsed}`, `Evaluated f(k) for each k and added with compensated (Kahan) summation to limit rounding error`],
        notes: ["A finite sum of many terms says nothing certain about convergence of the infinite series."],
      };
    }
    const a1 = Q.parse(v.str("a1"));
    if (!a1) return "The first term is not a valid number.";
    const n = v.num("n");
    if (v.mode === "arith") {
      const d = Q.parse(v.str("d"));
      if (!d) return "The common difference is not a valid number.";
      if (n === null) return null;
      const an = a1.add(d.mul(Q.int(n - 1)));
      const s = Q.int(n).mul(a1.add(an)).div(Q.int(2));
      return {
        outputs: [
          { label: `Sum of ${n} terms`, value: show(s), primary: true, note: s.isInt() ? undefined : `≈ ${num(s.toNumber(), 12)}` },
          { label: "Last term", value: show(an) },
        ],
        steps: [`Last term aₙ = a₁ + (n − 1)d = ${show(an)}`, `Sₙ = n(a₁ + aₙ) / 2 = ${n} × (${a1} + ${show(an)}) / 2 = ${show(s)}`],
      };
    }
    const r = Q.parse(v.str("r"));
    if (!r) return "The common ratio is not a valid number.";
    if (v.bool("infinite")) {
      const rf = Math.abs(r.toNumber());
      if (rf >= 1) {
        return {
          outputs: [{ label: "Sum to infinity", value: "Diverges", primary: true, note: `|r| = ${num(rf)} ≥ 1, so the terms do not shrink to 0.` }],
          steps: ["A geometric series converges only when |r| < 1"],
        };
      }
      const s = a1.div(Q.ONE.sub(r));
      return {
        outputs: [{ label: "Sum to infinity", value: show(s), primary: true, note: s.isInt() ? undefined : `≈ ${num(s.toNumber(), 12)}` }],
        steps: [`|r| = ${num(rf)} < 1, so the series converges`, `S∞ = a₁ / (1 − r) = ${a1} / (1 − ${r}) = ${show(s)}`],
      };
    }
    if (n === null) return "Enter the number of terms, or tick “Sum to infinity”.";
    const s = r.eq(Q.ONE) ? a1.mul(Q.int(n)) : n <= 2000 ? a1.mul(Q.ONE.sub(r.pow(n))).div(Q.ONE.sub(r)) : null;
    const sf = r.eq(Q.ONE) ? a1.toNumber() * n : (a1.toNumber() * (1 - Math.pow(r.toNumber(), n))) / (1 - r.toNumber());
    return {
      outputs: [
        { label: `Sum of ${n} terms`, value: s ? show(s) : num(sf, 12), primary: true },
        { label: "Last term", value: n <= 2000 ? show(a1.mul(r.pow(n - 1))) : num(a1.toNumber() * Math.pow(r.toNumber(), n - 1), 12) },
        ...(Math.abs(r.toNumber()) < 1 ? [{ label: "Sum to infinity", value: show(a1.div(Q.ONE.sub(r))) }] : []),
      ],
      steps: [r.eq(Q.ONE) ? `r = 1, so Sₙ = n × a₁` : `Sₙ = a₁(1 − rⁿ) / (1 − r) = ${a1} × (1 − (${r})^${n}) / (1 − ${r})`, `= ${s ? show(s) : num(sf, 12)}`],
    };
  },
};

export default function Tool() {
  return <FormulaTool spec={spec} />;
}

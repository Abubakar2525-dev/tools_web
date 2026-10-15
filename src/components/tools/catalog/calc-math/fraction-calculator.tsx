"use client";

import { FormulaTool, type FormulaSpec } from "@/components/tools/engines/FormulaTool";
import { B1, Q, blcm } from "./lib/rational";

const OPS = [
  { value: "add", label: "+ add" },
  { value: "sub", label: "− subtract" },
  { value: "mul", label: "× multiply" },
  { value: "div", label: "÷ divide" },
];

const sym: Record<string, string> = { add: "+", sub: "−", mul: "×", div: "÷" };
const paren = (q: Q) => (q.sign() < 0 ? `(${q})` : q.toString());

const spec: FormulaSpec = {
  fields: [
    { id: "a", label: "First fraction", type: "text", placeholder: "3/4, 1 1/2 or 0.25", hint: "Fraction, mixed number (space between), integer or decimal." },
    { id: "op", label: "Operation", type: "select", options: OPS },
    { id: "b", label: "Second fraction", type: "text", placeholder: "2/3" },
  ],
  defaults: { a: "", op: "add", b: "" },
  example: { a: "1 1/2", op: "add", b: "2/3" },
  compute: (v) => {
    const a = Q.parse(v.str("a"));
    const b = Q.parse(v.str("b"));
    if (!a) return "The first value is not a valid fraction (try 3/4 or 1 1/2).";
    if (!b) return "The second value is not a valid fraction (try 2/3).";
    const op = v.str("op");
    if (op === "div" && b.isZero()) return "You cannot divide by zero.";
    const steps: string[] = [`${paren(a)} ${sym[op]} ${paren(b)}`];
    let r: Q;
    if (op === "add" || op === "sub") {
      const L = blcm(a.d, b.d);
      const an = (a.n * L) / a.d;
      const bn = (b.n * L) / b.d;
      if (L !== B1) steps.push(`Common denominator: lcm(${a.d}, ${b.d}) = ${L}`, `${an}/${L} ${sym[op]} ${bn}/${L}`);
      const top = op === "add" ? an + bn : an - bn;
      steps.push(`= ${top}/${L}`.replace("-", "−"));
      r = op === "add" ? a.add(b) : a.sub(b);
    } else if (op === "mul") {
      steps.push(`Multiply tops and bottoms: (${a.n} × ${b.n}) / (${a.d} × ${b.d}) = ${a.n * b.n}/${a.d * b.d}`.replace(/-/g, "−"));
      r = a.mul(b);
    } else {
      steps.push(`Dividing is multiplying by the reciprocal: ${paren(a)} × ${paren(b.inv())}`, `= ${a.n * b.d}/${a.d * b.n}`.replace(/-/g, "−"));
      r = a.div(b);
    }
    steps.push(`Simplify: ${r}`);
    const dec = r.toRepeating(40);
    return {
      outputs: [
        { label: "Result", value: r.toString(), primary: true, note: r.isInt() ? undefined : `Mixed number: ${r.toMixed()}` },
        { label: "Mixed number", value: r.toMixed() },
        { label: "Decimal", value: dec.text, note: dec.exact ? undefined : "rounded" },
        { label: "Percent", value: `${r.mul(Q.int(100)).toFixed(6)}%` },
      ],
      steps,
      notes: dec.exact && dec.text.includes("(") ? ["Digits in brackets repeat forever, e.g. 0.1(6) = 0.16666…"] : undefined,
    };
  },
};

export default function Tool() {
  return <FormulaTool spec={spec} />;
}

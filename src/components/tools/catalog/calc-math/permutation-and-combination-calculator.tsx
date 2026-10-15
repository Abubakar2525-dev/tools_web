"use client";

import { FormulaTool, type FormulaSpec } from "@/components/tools/engines/FormulaTool";
import { digitCount, groupDigits, nCr, nPr, sciBig } from "./lib/bigint";
import { BigDigits } from "./ui";

const MAX_N = 10000;
const show = (x: bigint) => (digitCount(x) > 15 ? sciBig(x) : groupDigits(x));

const KINDS = [
  { value: "ncr", label: "Combinations nCr (order ignored)" },
  { value: "npr", label: "Permutations nPr (order matters)" },
  { value: "rep-p", label: "Permutations with repetition nʳ" },
  { value: "rep-c", label: "Combinations with repetition" },
];

const spec: FormulaSpec = {
  fields: [
    { id: "n", label: "n (items to choose from)", type: "number", integer: true, min: 0, max: MAX_N, placeholder: "52" },
    { id: "r", label: "r (items chosen)", type: "number", integer: true, min: 0, max: MAX_N, placeholder: "5" },
    { id: "kind", label: "Main result", type: "select", options: KINDS },
  ],
  example: { n: "52", r: "5", kind: "ncr" },
  compute: (v) => {
    const n = v.num("n");
    const r = v.num("r");
    if (n === null || r === null) return null;
    const kind = v.str("kind");
    const noRep = r <= n;
    const P = nPr(n, r);
    const C = nCr(n, r);
    const repP = r * Math.log10(Math.max(n, 1)) > 100000 ? null : BigInt(n) ** BigInt(r);
    const repC = n + r - 1 >= 0 ? nCr(n + r - 1, r) : BigInt(r === 0 ? 1 : 0);
    const values: Record<string, { label: string; value: bigint | null; formula: string[] }> = {
      ncr: {
        label: `C(${n}, ${r})`,
        value: C,
        formula: [`nCr = n! / (r! × (n − r)!)`, `= ${n}! / (${r}! × ${n - r}!)`, `= ${show(P)} / ${r}! = ${show(C)}`],
      },
      npr: { label: `P(${n}, ${r})`, value: P, formula: [`nPr = n! / (n − r)!`, `= ${n}! / ${n - r}!`, `= ${n} × ${n - 1} × … × ${n - r + 1} = ${show(P)}`] },
      "rep-p": { label: `${n}^${r}`, value: repP, formula: [`Each of the ${r} positions can be any of ${n} items: n^r`, `= ${n}^${r} = ${repP === null ? "too large" : show(repP)}`] },
      "rep-c": {
        label: `C(${n + r - 1}, ${r})`,
        value: repC,
        formula: [`Stars and bars: C(n + r − 1, r)`, `= C(${n + r - 1}, ${r}) = ${show(repC)}`],
      },
    };
    if (!noRep && (kind === "ncr" || kind === "npr")) {
      return `Without repetition r cannot exceed n (you cannot choose ${r} different items from ${n}). Pick a "with repetition" option instead.`;
    }
    const main = values[kind];
    if (main.value === null) return "The result is too large to compute exactly (over 100,000 digits).";
    const long = digitCount(main.value) > 15;
    return {
      outputs: [
        { label: main.label, value: show(main.value), primary: true, note: long ? "Full digits below." : undefined },
        { label: "nCr", value: noRep ? show(C) : "n/a (r > n)" },
        { label: "nPr", value: noRep ? show(P) : "n/a (r > n)" },
        { label: "nʳ (repetition, ordered)", value: repP === null ? "too large" : show(repP) },
        { label: "With repetition, unordered", value: show(repC) },
      ],
      visual: long ? <BigDigits label={`${main.label} exactly`} value={main.value.toString()} /> : undefined,
      steps: [...main.formula, "All values are exact integers (BigInt)."],
      notes: [`n and r are limited to ${MAX_N.toLocaleString("en-US")}.`],
    };
  },
};

export default function Tool() {
  return <FormulaTool spec={spec} />;
}

"use client";

import { FormulaTool, num, type FormulaSpec } from "@/components/tools/engines/FormulaTool";
import { chi2Cdf, chi2Sf, normalCdf, tCdf } from "./lib/distributions";

const fmtP = (p: number) => (p < 1e-6 ? p.toExponential(3) : num(p, 6));

const TAILS = [
  { value: "two", label: "Two-tailed" },
  { value: "right", label: "Right-tailed (upper)" },
  { value: "left", label: "Left-tailed (lower)" },
];

const spec: FormulaSpec = {
  modes: [
    { id: "z", label: "z statistic", fields: ["stat", "tail"] },
    { id: "t", label: "t statistic", fields: ["stat", "df", "tail"] },
    { id: "chi", label: "Chi-square", fields: ["chi", "df", "chitail"] },
  ],
  fields: [
    { id: "stat", label: "Test statistic", type: "number", placeholder: "2.1" },
    { id: "chi", label: "Chi-square statistic", type: "number", min: 0, placeholder: "7.81" },
    { id: "df", label: "Degrees of freedom", type: "number", gt: 0, max: 1e7, placeholder: "10" },
    { id: "tail", label: "Test type", type: "select", options: TAILS },
    {
      id: "chitail",
      label: "Test type",
      type: "select",
      options: [
        { value: "right", label: "Right-tailed (goodness of fit, independence)" },
        { value: "left", label: "Left-tailed" },
      ],
    },
  ],
  example: { stat: "2.1", df: "10", chi: "7.81", tail: "two", chitail: "right" },
  compute: (v) => {
    let p: number;
    let dist: string;
    let steps: string[];
    if (v.mode === "chi") {
      const x = v.num("chi");
      const df = v.num("df");
      if (x === null || df === null) return null;
      const right = v.str("chitail") === "right";
      p = right ? chi2Sf(x, df) : chi2Cdf(x, df);
      dist = `χ²(${num(df)})`;
      steps = [`P = ${right ? "P(χ² ≥ x) = Q(df/2, x/2)" : "P(χ² ≤ x) = P(df/2, x/2)"} using the regularized incomplete gamma function`, `= ${right ? "Q" : "P"}(${num(df / 2)}, ${num(x / 2, 10)}) = ${fmtP(p)}`];
    } else {
      const s = v.num("stat");
      if (s === null) return null;
      const tail = v.str("tail");
      let cdf: (x: number) => number;
      if (v.mode === "t") {
        const df = v.num("df");
        if (df === null) return null;
        cdf = (x) => tCdf(x, df);
        dist = `t(${num(df)})`;
      } else {
        cdf = normalCdf;
        dist = "standard normal";
      }
      const lower = cdf(s);
      const upper = cdf(-s);
      p = tail === "two" ? Math.min(1, 2 * cdf(-Math.abs(s))) : tail === "right" ? upper : lower;
      steps = [
        `Distribution: ${dist}${v.mode === "t" ? " (CDF via the regularized incomplete beta function)" : ""}`,
        `P(X ≤ ${num(s)}) = ${fmtP(lower)}, P(X ≥ ${num(s)}) = ${fmtP(upper)}`,
        tail === "two" ? `Two-tailed p = 2 × P(X ≥ |${num(s)}|) = ${fmtP(p)}` : `${tail === "right" ? "Right" : "Left"}-tailed p = ${fmtP(p)}`,
      ];
    }
    const verdict = (a: number) => (p < a ? "Significant" : "Not significant");
    return {
      outputs: [
        { label: "p-value", value: fmtP(p), primary: true, note: `Distribution: ${dist}` },
        { label: "At α = 0.10", value: verdict(0.1) },
        { label: "At α = 0.05", value: verdict(0.05) },
        { label: "At α = 0.01", value: verdict(0.01) },
      ],
      steps,
      notes: ["The p-value is the probability of a result at least this extreme if the null hypothesis were true. It is not the probability that the null hypothesis is true."],
    };
  },
};

export default function Tool() {
  return <FormulaTool spec={spec} />;
}

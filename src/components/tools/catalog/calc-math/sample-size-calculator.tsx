"use client";

import { FormulaTool, num, type FormulaSpec } from "@/components/tools/engines/FormulaTool";
import { sampleSizeMean, sampleSizeProportion, sampleSizeTwoGroups } from "./lib/inference";

const spec: FormulaSpec = {
  modes: [
    { id: "prop", label: "Survey (proportion)", fields: ["conf", "margin", "p", "pop"] },
    { id: "mean", label: "Estimate a mean", fields: ["conf", "sigma", "emean", "pop"] },
    { id: "power", label: "Compare two groups", fields: ["alpha", "power", "d"] },
  ],
  fields: [
    { id: "conf", label: "Confidence level", type: "number", gt: 0, max: 99.99, suffix: "%", placeholder: "95" },
    { id: "margin", label: "Margin of error", type: "number", gt: 0, max: 50, suffix: "%", placeholder: "5" },
    { id: "p", label: "Expected proportion", type: "number", gt: 0, max: 99.99, suffix: "%", placeholder: "50", hint: "Use 50% if unsure: it gives the largest, safest sample." },
    { id: "pop", label: "Population size", type: "number", integer: true, min: 1, optional: true, placeholder: "e.g. 2000", hint: "Leave empty for a very large population." },
    { id: "sigma", label: "Estimated standard deviation (σ)", type: "number", gt: 0, placeholder: "15" },
    { id: "emean", label: "Margin of error (same units)", type: "number", gt: 0, placeholder: "2" },
    { id: "alpha", label: "Significance level (α)", type: "number", gt: 0, max: 0.5, placeholder: "0.05" },
    { id: "power", label: "Power (1 − β)", type: "number", gt: 0.5, max: 0.9999, placeholder: "0.8" },
    { id: "d", label: "Effect size (Cohen's d)", type: "number", gt: 0, placeholder: "0.5", hint: "0.2 small, 0.5 medium, 0.8 large." },
  ],
  defaults: { conf: "95", margin: "5", p: "50", alpha: "0.05", power: "0.8", d: "0.5" },
  example: { conf: "95", margin: "5", p: "50", pop: "2000", sigma: "15", emean: "2", alpha: "0.05", power: "0.8", d: "0.5" },
  compute: (v) => {
    if (v.mode === "power") {
      const a = v.num("alpha");
      const pw = v.num("power");
      const d = v.num("d");
      if (a === null || pw === null || d === null) return null;
      const r = sampleSizeTwoGroups(a, pw, d);
      return {
        outputs: [
          { label: "Per group", value: r.perGroup.toLocaleString("en-US"), primary: true, note: `Total ${(2 * r.perGroup).toLocaleString("en-US")} participants` },
          { label: "z₁₋α/₂", value: num(r.za, 8) },
          { label: "z₁₋β", value: num(r.zb, 8) },
          { label: "Unrounded n", value: num(r.n, 8) },
        ],
        steps: [
          `Two-sided test, α = ${num(a)}: z = ${num(r.za, 8)}; power ${num(pw)}: z = ${num(r.zb, 8)}`,
          `Normal approximation: n = 2(z₁₋α/₂ + z₁₋β)² / d² = 2 × (${num(r.za + r.zb, 8)})² / ${num(d)}² = ${num(r.base, 8)}`,
          `Small-sample t correction: + z₁₋α/₂² / 4 = + ${num((r.za * r.za) / 4, 6)} → ${num(r.n, 8)}`,
          `Round up: ${r.perGroup} per group`,
        ],
        notes: ["For an independent two-sample t-test with equal group sizes and equal variances. The correction makes the result agree closely with exact t-test power tables."],
      };
    }
    const confPct = v.num("conf");
    if (confPct === null) return null;
    const conf = confPct / 100;
    const N = v.num("pop");
    if (v.mode === "prop") {
      const e = v.num("margin");
      const p = v.num("p");
      if (e === null || p === null) return null;
      const r = sampleSizeProportion(conf, e / 100, p / 100, N);
      return {
        outputs: [
          { label: "Required sample size", value: r.required.toLocaleString("en-US"), primary: true, note: N ? `With finite population correction for ${N.toLocaleString("en-US")}` : "Large-population formula" },
          { label: "z", value: num(r.z, 8) },
          { label: "Before correction (n₀)", value: num(r.n0, 8) },
          ...(N ? [{ label: "After correction", value: num(r.n, 8) }] : []),
        ],
        steps: [
          `z for ${num(confPct)}% confidence = ${num(r.z, 8)}`,
          `n₀ = z² × p(1 − p) / e² = ${num(r.z, 6)}² × ${num(p / 100)} × ${num(1 - p / 100)} / ${num(e / 100)}² = ${num(r.n0, 8)}`,
          ...(N ? [`Finite population correction: n = n₀ / (1 + (n₀ − 1)/N) = ${num(r.n0, 8)} / (1 + ${num(r.n0 - 1, 8)}/${N}) = ${num(r.n, 8)}`] : []),
          `Round up: ${r.required}`,
        ],
        notes: ["This is the number of completed responses. Divide by your expected response rate to know how many people to invite."],
      };
    }
    const sigma = v.num("sigma");
    const e = v.num("emean");
    if (sigma === null || e === null) return null;
    const r = sampleSizeMean(conf, sigma, e, N);
    return {
      outputs: [
        { label: "Required sample size", value: r.required.toLocaleString("en-US"), primary: true },
        { label: "z", value: num(r.z, 8) },
        { label: "Before correction (n₀)", value: num(r.n0, 8) },
        ...(N ? [{ label: "After correction", value: num(r.n, 8) }] : []),
      ],
      steps: [
        `n₀ = (z × σ / E)² = (${num(r.z, 6)} × ${num(sigma)} / ${num(e)})² = ${num(r.n0, 8)}`,
        ...(N ? [`Finite population correction: n = n₀ / (1 + (n₀ − 1)/N) = ${num(r.n, 8)}`] : []),
        `Round up: ${r.required}`,
      ],
      notes: ["σ is usually estimated from a pilot study or earlier research."],
    };
  },
};

export default function Tool() {
  return <FormulaTool spec={spec} />;
}

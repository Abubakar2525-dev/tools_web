"use client";

import { FormulaTool, num, type FormulaSpec } from "@/components/tools/engines/FormulaTool";
import { ciMeanT, ciMeanZ, ciPropWald, ciPropWilson } from "./lib/inference";

const pct = (p: number) => `${num(p * 100, 6)}%`;

const spec: FormulaSpec = {
  modes: [
    { id: "t", label: "Mean (sample SD)", fields: ["mean", "sd", "n", "conf"] },
    { id: "z", label: "Mean (known σ)", fields: ["mean", "sigma", "n", "conf"] },
    { id: "prop", label: "Proportion", fields: ["x", "pn", "conf"] },
  ],
  fields: [
    { id: "mean", label: "Sample mean (x̄)", type: "number", placeholder: "50" },
    { id: "sd", label: "Sample standard deviation (s)", type: "number", gt: 0, placeholder: "10" },
    { id: "sigma", label: "Population σ", type: "number", gt: 0, placeholder: "10" },
    { id: "n", label: "Sample size (n)", type: "number", integer: true, min: 2, placeholder: "25" },
    { id: "x", label: "Successes (x)", type: "number", integer: true, min: 0, placeholder: "40" },
    { id: "pn", label: "Sample size (n)", type: "number", integer: true, min: 1, placeholder: "100" },
    { id: "conf", label: "Confidence level", type: "number", gt: 0, max: 99.9999, suffix: "%", placeholder: "95" },
  ],
  defaults: { conf: "95" },
  example: { mean: "50", sd: "10", sigma: "10", n: "25", x: "40", pn: "100", conf: "95" },
  compute: (v) => {
    const confPct = v.num("conf");
    if (confPct === null) return null;
    if (confPct >= 100) return "The confidence level must be below 100%.";
    const conf = confPct / 100;
    if (v.mode === "prop") {
      const x = v.num("x");
      const n = v.num("pn");
      if (x === null || n === null) return null;
      if (x > n) return "Successes cannot exceed the sample size.";
      const p = x / n;
      const wald = ciPropWald(x, n, conf);
      const wil = ciPropWilson(x, n, conf);
      const smallCounts = x < 10 || n - x < 10;
      return {
        outputs: [
          { label: `Wilson ${num(confPct)}% interval`, value: `${pct(wil.lower)} to ${pct(wil.upper)}`, primary: true, note: `Sample proportion ${pct(p)}` },
          { label: "Wald interval", value: `${pct(wald.lower)} to ${pct(wald.upper)}` },
          { label: "Wald margin of error", value: `± ${pct(wald.margin)}` },
          { label: "Critical z", value: num(wil.crit, 8) },
          { label: "Standard error", value: num(wald.se, 8) },
        ],
        steps: [
          `p̂ = x / n = ${x} / ${n} = ${num(p, 10)}`,
          `z for ${num(confPct)}% = ${num(wil.crit, 8)}`,
          `Wald: p̂ ± z√(p̂(1 − p̂)/n) = ${num(p, 8)} ± ${num(wald.margin, 8)}`,
          `Wilson: center = (p̂ + z²/2n) / (1 + z²/n) = ${num(wil.center, 8)}, half-width = ${num(wil.margin, 8)}`,
        ],
        notes: [
          smallCounts
            ? "Fewer than 10 successes or failures: the Wald interval is unreliable here. Use the Wilson interval."
            : "Wilson is recommended in general; Wald is the textbook formula and is close when counts are large.",
        ],
      };
    }
    const mean = v.num("mean");
    const n = v.num("n");
    if (mean === null || n === null) return null;
    const isT = v.mode === "t";
    const s = isT ? v.num("sd") : v.num("sigma");
    if (s === null) return null;
    const ci = isT ? ciMeanT(mean, s, n, conf) : ciMeanZ(mean, s, n, conf);
    return {
      outputs: [
        { label: `${num(confPct)}% confidence interval`, value: `${num(ci.lower, 10)} to ${num(ci.upper, 10)}`, primary: true },
        { label: "Margin of error", value: `± ${num(ci.margin, 10)}` },
        { label: isT ? `Critical t (df = ${n - 1})` : "Critical z", value: num(ci.crit, 8) },
        { label: "Standard error", value: num(ci.se, 10) },
      ],
      steps: [
        `Standard error = ${isT ? "s" : "σ"} / √n = ${num(s)} / √${n} = ${num(ci.se, 10)}`,
        isT ? `t critical value for ${num(confPct)}% with ${n - 1} degrees of freedom = ${num(ci.crit, 8)}` : `z critical value for ${num(confPct)}% = ${num(ci.crit, 8)}`,
        `Margin = ${num(ci.crit, 8)} × ${num(ci.se, 10)} = ${num(ci.margin, 10)}`,
        `Interval = ${num(mean)} ± ${num(ci.margin, 10)}`,
      ],
      notes: [
        isT
          ? "The t interval assumes a random sample from a roughly normal population, or a large enough n for the central limit theorem."
          : "Use the z interval only when the population standard deviation is truly known.",
      ],
    };
  },
};

export default function Tool() {
  return <FormulaTool spec={spec} />;
}

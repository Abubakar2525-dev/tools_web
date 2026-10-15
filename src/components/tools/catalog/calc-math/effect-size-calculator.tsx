"use client";

import { FormulaTool, num, type FormulaSpec } from "@/components/tools/engines/FormulaTool";
import { cohenLabel, effectSizes } from "./lib/inference";

const spec: FormulaSpec = {
  lead: "Group 2 is treated as the control group for Glass's Δ.",
  fields: [
    { id: "m1", label: "Group 1 mean", type: "number", placeholder: "105" },
    { id: "m2", label: "Group 2 mean", type: "number", placeholder: "100" },
    { id: "s1", label: "Group 1 SD", type: "number", gt: 0, placeholder: "15" },
    { id: "s2", label: "Group 2 SD", type: "number", gt: 0, placeholder: "15" },
    { id: "n1", label: "Group 1 size", type: "number", integer: true, min: 2, placeholder: "30" },
    { id: "n2", label: "Group 2 size", type: "number", integer: true, min: 2, placeholder: "30" },
  ],
  example: { m1: "105", m2: "100", s1: "15", s2: "15", n1: "30", n2: "30" },
  compute: (v) => {
    const [m1, m2, s1, s2, n1, n2] = ["m1", "m2", "s1", "s2", "n1", "n2"].map((id) => v.num(id));
    if (m1 === null || m2 === null || s1 === null || s2 === null || n1 === null || n2 === null) return null;
    const e = effectSizes(m1, s1, n1, m2, s2, n2);
    return {
      outputs: [
        { label: "Cohen's d", value: num(e.d, 6), primary: true, note: `${cohenLabel(e.d)} effect by Cohen's rough benchmarks (0.2 small, 0.5 medium, 0.8 large)` },
        { label: "Hedges' g", value: num(e.g, 6) },
        { label: "Glass's Δ", value: num(e.glass, 6) },
        { label: "Pooled SD", value: num(e.pooled, 8) },
        { label: "Mean difference", value: num(e.diff, 8) },
        { label: "95% CI for d (approx.)", value: `${num(e.ciD[0], 4)} to ${num(e.ciD[1], 4)}` },
      ],
      steps: [
        `Pooled SD = √(((n₁ − 1)s₁² + (n₂ − 1)s₂²) / (n₁ + n₂ − 2)) = √(((${n1} − 1)·${num(s1)}² + (${n2} − 1)·${num(s2)}²) / ${e.df}) = ${num(e.pooled, 8)}`,
        `d = (M₁ − M₂) / pooled SD = ${num(e.diff, 8)} / ${num(e.pooled, 8)} = ${num(e.d, 6)}`,
        `Hedges' correction J = Γ(df/2) / (√(df/2) · Γ((df − 1)/2)) = ${num(e.J, 8)} with df = ${e.df}`,
        `g = d × J = ${num(e.g, 6)}`,
        `Glass's Δ = (M₁ − M₂) / SD₂ = ${num(e.diff, 8)} / ${num(s2)} = ${num(e.glass, 6)}`,
        `SE(d) ≈ √((n₁ + n₂)/(n₁n₂) + d²/(2(n₁ + n₂))) = ${num(e.seD, 6)}; CI = d ± 1.96 × SE`,
      ],
      notes: ["Hedges' g removes the small-sample bias in d and is preferred for small groups. Benchmarks are context-dependent conventions, not rules."],
    };
  },
};

export default function Tool() {
  return <FormulaTool spec={spec} />;
}

"use client";

import { FormulaTool, num, type FormulaSpec } from "@/components/tools/engines/FormulaTool";
import { U } from "./lib/units";

const MPA = 1e6;
const PSI = 6894.757293168;

function stressOutputs(sigma: number, label: string) {
  return [
    { label, value: `${num(sigma / MPA, 5)} MPa`, primary: true, note: sigma < 0 ? "Negative means compression." : undefined },
    { label: "In N/mm²", value: num(sigma / MPA, 5) },
    { label: "In psi", value: num(sigma / PSI, 5) },
    { label: "In ksi", value: num(sigma / PSI / 1000, 5) },
    { label: "In pascals", value: `${num(sigma, 5)} Pa` },
  ];
}

const spec: FormulaSpec = {
  lead: <>Average (nominal) stress over a cross-section. Use a negative force for compression.</>,
  modes: [
    { id: "normal", label: "Normal σ = F/A", fields: ["F", "A"] },
    { id: "rod", label: "Round bar", fields: ["F", "d"] },
    { id: "shear", label: "Shear τ = V/A", fields: ["V", "A", "planes"] },
    { id: "hooke", label: "σ = E·ε", fields: ["E", "eps"] },
  ],
  fields: [
    { id: "F", label: "Axial force F", type: "number", units: U.force },
    { id: "V", label: "Shear force V", type: "number", units: U.force },
    { id: "A", label: "Cross-section area A", type: "number", units: U.area, gt: 0 },
    { id: "d", label: "Bar diameter d", type: "number", units: U.length, gt: 0 },
    {
      id: "planes",
      label: "Shear planes",
      type: "select",
      options: [
        { value: "1", label: "Single shear (1 plane)" },
        { value: "2", label: "Double shear (2 planes)" },
      ],
    },
    { id: "E", label: "Elastic modulus E", type: "number", units: U.pressure, gt: 0 },
    { id: "eps", label: "Strain ε", type: "number", hint: "Dimensionless, e.g. 0.001 (= 1000 µε)." },
  ],
  defaults: { "F:unit": "kN", "V:unit": "kN", "A:unit": "mm2", "d:unit": "mm", "E:unit": "GPa" },
  example: { __mode: "rod", F: "50", "F:unit": "kN", d: "20", "d:unit": "mm" },
  compute: (v) => {
    if (v.mode === "normal") {
      const F = v.num("F") as number;
      const A = v.num("A") as number;
      const s = F / A;
      return { outputs: stressOutputs(s, "Normal stress σ"), steps: [`σ = F ÷ A = ${num(F)} N ÷ ${num(A, 6)} m² = ${num(s, 6)} Pa = ${num(s / MPA, 5)} MPa`] };
    }
    if (v.mode === "rod") {
      const F = v.num("F") as number;
      const d = v.num("d") as number;
      const A = (Math.PI * d * d) / 4;
      const s = F / A;
      return {
        outputs: [...stressOutputs(s, "Normal stress σ"), { label: "Area", value: `${num(A * 1e6, 5)} mm²` }],
        steps: [`A = π d² ÷ 4 = π × ${num(d * 1000, 5)}² ÷ 4 = ${num(A * 1e6, 5)} mm²`, `σ = F ÷ A = ${num(F)} N ÷ ${num(A * 1e6, 5)} mm² = ${num(s / MPA, 5)} MPa`],
      };
    }
    if (v.mode === "shear") {
      const V = v.num("V") as number;
      const A = v.num("A") as number;
      const n = Number(v.str("planes"));
      const t = V / (n * A);
      return {
        outputs: stressOutputs(t, "Average shear stress τ"),
        steps: [`τ = V ÷ (n × A) = ${num(V)} N ÷ (${n} × ${num(A, 6)} m²) = ${num(t / MPA, 5)} MPa`],
        notes: ["This is the average shear stress. In a rectangular beam section the peak shear stress is 1.5 times the average; in a solid round section it is 4/3 times."],
      };
    }
    const E = v.num("E") as number;
    const eps = v.num("eps") as number;
    const s = E * eps;
    return {
      outputs: stressOutputs(s, "Stress σ"),
      steps: [`σ = E × ε = ${num(E / 1e9, 5)} GPa × ${num(eps)} = ${num(s / MPA, 5)} MPa`],
      notes: ["Hooke's law holds only in the linear elastic range, below the proportional limit of the material."],
    };
  },
};

export default function Tool() {
  return <FormulaTool spec={spec} />;
}

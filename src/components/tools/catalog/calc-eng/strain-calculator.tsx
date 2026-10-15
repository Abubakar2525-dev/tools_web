"use client";

import { FormulaTool, num, type FormulaSpec } from "@/components/tools/engines/FormulaTool";
import { U } from "./lib/units";

const strainOut = (eps: number, label: string) => [
  { label, value: num(eps, 6), primary: true, note: eps < 0 ? "Negative means shortening (compression)." : undefined },
  { label: "Percent", value: `${num(eps * 100, 5)}%` },
  { label: "Microstrain", value: `${num(eps * 1e6, 6)} µε` },
];

const spec: FormulaSpec = {
  lead: <>Engineering strain: change in length divided by the original length. It has no unit.</>,
  modes: [
    { id: "dl", label: "ε = ΔL / L", fields: ["dL", "L"] },
    { id: "lengths", label: "From two lengths", fields: ["L", "L2"] },
    { id: "stress", label: "ε = σ / E", fields: ["sigma", "E", "Lopt"] },
    { id: "poisson", label: "Lateral strain", fields: ["eps", "nu", "dopt"] },
  ],
  fields: [
    { id: "dL", label: "Change in length ΔL", type: "number", units: U.length },
    { id: "L", label: "Original length L", type: "number", units: U.length, gt: 0 },
    { id: "L2", label: "Final length", type: "number", units: U.length, gt: 0 },
    { id: "sigma", label: "Stress σ", type: "number", units: U.pressure },
    { id: "E", label: "Elastic modulus E", type: "number", units: U.pressure, gt: 0 },
    { id: "Lopt", label: "Member length", type: "number", units: U.length, optional: true, gt: 0, hint: "Optional: gives the elongation ΔL." },
    { id: "eps", label: "Axial strain ε", type: "number", hint: "Dimensionless, e.g. 0.0012." },
    { id: "nu", label: "Poisson's ratio ν", type: "number", min: -1, max: 0.5, placeholder: "0.3", hint: "Steel ≈ 0.3, aluminum ≈ 0.33, rubber ≈ 0.5." },
    { id: "dopt", label: "Original width or diameter", type: "number", units: U.length, optional: true, gt: 0, hint: "Optional: gives the change in width." },
  ],
  defaults: { "dL:unit": "mm", "L:unit": "m", "L2:unit": "m", "sigma:unit": "MPa", "E:unit": "GPa", "Lopt:unit": "m", "dopt:unit": "mm" },
  example: { __mode: "stress", sigma: "150", "sigma:unit": "MPa", E: "200", "E:unit": "GPa", Lopt: "2", "Lopt:unit": "m" },
  compute: (v) => {
    if (v.mode === "dl") {
      const dL = v.num("dL") as number;
      const L = v.num("L") as number;
      const e = dL / L;
      return { outputs: strainOut(e, "Strain ε"), steps: [`ε = ΔL ÷ L = ${num(dL, 6)} m ÷ ${num(L, 6)} m = ${num(e, 6)}`] };
    }
    if (v.mode === "lengths") {
      const L = v.num("L") as number;
      const L2 = v.num("L2") as number;
      const e = (L2 - L) / L;
      return {
        outputs: [...strainOut(e, "Strain ε"), { label: "ΔL", value: `${num((L2 - L) * 1000, 6)} mm` }, { label: "True strain ln(L₂/L)", value: num(Math.log(L2 / L), 6) }],
        steps: [`ΔL = ${num(L2, 6)} − ${num(L, 6)} = ${num(L2 - L, 6)} m`, `ε = ΔL ÷ L = ${num(e, 6)}`],
      };
    }
    if (v.mode === "stress") {
      const s = v.num("sigma") as number;
      const E = v.num("E") as number;
      const e = s / E;
      const L = v.num("Lopt");
      const outputs = strainOut(e, "Strain ε");
      const steps = [`ε = σ ÷ E = ${num(s / 1e6, 6)} MPa ÷ ${num(E / 1e9, 6)} GPa = ${num(e, 6)}`];
      if (L !== null) {
        outputs.push({ label: "Elongation ΔL", value: `${num(e * L * 1000, 6)} mm`, note: undefined, primary: false });
        steps.push(`ΔL = ε × L = ${num(e, 6)} × ${num(L, 6)} m = ${num(e * L * 1000, 6)} mm`);
      }
      return { outputs, steps, notes: ["Valid only while the material stays linear elastic."] };
    }
    const eps = v.num("eps") as number;
    const nu = v.num("nu") as number;
    const lat = -nu * eps;
    const d = v.num("dopt");
    const outputs = strainOut(lat, "Lateral strain");
    const steps = [`ε_lateral = −ν × ε_axial = −${num(nu)} × ${num(eps, 6)} = ${num(lat, 6)}`];
    if (d !== null) {
      outputs.push({ label: "Change in width", value: `${num(lat * d * 1000, 6)} mm`, note: undefined, primary: false });
      steps.push(`Δd = ε_lateral × d = ${num(lat, 6)} × ${num(d * 1000, 6)} mm = ${num(lat * d * 1000, 6)} mm`);
    }
    const vol = eps * (1 - 2 * nu);
    outputs.push({ label: "Volumetric strain (uniaxial)", value: num(vol, 6), note: undefined, primary: false });
    steps.push(`ε_v ≈ ε (1 − 2ν) = ${num(vol, 6)}`);
    return { outputs, steps };
  },
};

export default function Tool() {
  return <FormulaTool spec={spec} />;
}

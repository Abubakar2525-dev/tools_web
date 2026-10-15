"use client";

import { FormulaTool, num, type FormulaSpec } from "@/components/tools/engines/FormulaTool";
import { distanceAstro, force, massAstro } from "./lib/units";
import { G, G0 } from "./lib/constants";
import { unitOutputs } from "./shared";

const spec: FormulaSpec = {
  modes: [
    { id: "F", label: "Force between two masses", fields: ["m1", "m2", "r"] },
    { id: "g", label: "Field strength g", fields: ["M", "r"] },
    { id: "r", label: "Distance from force", fields: ["m1", "m2", "F"] },
  ],
  fields: [
    { id: "m1", label: "Mass 1 (m₁)", type: "number", gt: 0, units: massAstro },
    { id: "m2", label: "Mass 2 (m₂)", type: "number", gt: 0, units: massAstro },
    { id: "M", label: "Mass of the body (M)", type: "number", gt: 0, units: massAstro },
    { id: "r", label: "Center-to-center distance (r)", type: "number", gt: 0, units: distanceAstro, hint: "For a planet's surface, use its radius." },
    { id: "F", label: "Force (F)", type: "number", gt: 0, units: force },
  ],
  example: { m1: "1", "m1:unit": "me", m2: "7.342e22", "m2:unit": "kg", M: "1", "M:unit": "me", r: "384400", "r:unit": "km", F: "1.98e20" },
  lead: <p>Newton&apos;s law of gravitation: F = G m₁ m₂ / r², with G = 6.67430 × 10⁻¹¹ m³ kg⁻¹ s⁻².</p>,
  compute: (v) => {
    if (v.mode === "F") {
      const m1 = v.num("m1")!;
      const m2 = v.num("m2")!;
      const r = v.num("r")!;
      const F = (G * m1 * m2) / (r * r);
      return {
        outputs: [{ label: "Gravitational force", value: `${num(F, 6)} N`, primary: true }, ...unitOutputs("Force", F, force, ["kN", "lbf"]), { label: "Acceleration of m₂ toward m₁", value: `${num((G * m1) / (r * r), 6)} m/s²` }],
        steps: [`F = G m₁ m₂ / r² = 6.6743e-11 × ${num(m1, 6)} × ${num(m2, 6)} / (${num(r, 6)})² = ${num(F, 6)} N`],
        notes: ["Treats both bodies as point masses or uniform spheres; r is measured between their centers."],
      };
    }
    if (v.mode === "g") {
      const M = v.num("M")!;
      const r = v.num("r")!;
      const g = (G * M) / (r * r);
      return {
        outputs: [{ label: "Field strength g", value: `${num(g, 6)} m/s²`, primary: true }, { label: "Relative to standard Earth gravity", value: `${num(g / G0, 6)} g` }, { label: "Escape velocity at r", value: `${num(Math.sqrt((2 * G * M) / r), 6)} m/s` }],
        steps: [`g = G M / r² = 6.6743e-11 × ${num(M, 6)} / (${num(r, 6)})² = ${num(g, 6)} m/s²`, `v_esc = √(2GM / r) = ${num(Math.sqrt((2 * G * M) / r), 6)} m/s`],
      };
    }
    const m1 = v.num("m1")!;
    const m2 = v.num("m2")!;
    const F = v.num("F")!;
    const r = Math.sqrt((G * m1 * m2) / F);
    return {
      outputs: [{ label: "Distance", value: `${num(r, 6)} m`, primary: true }, ...unitOutputs("Distance", r, distanceAstro, ["km", "au"])],
      steps: [`r = √(G m₁ m₂ / F) = ${num(r, 6)} m`],
    };
  },
};

export default function Tool() {
  return <FormulaTool spec={spec} />;
}

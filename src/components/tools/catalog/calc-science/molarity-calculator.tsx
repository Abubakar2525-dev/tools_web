"use client";

import { FormulaTool, num, type FormulaSpec } from "@/components/tools/engines/FormulaTool";
import { amount, massG, molarity, volumeL } from "./lib/units";
import { resolveMolarMass } from "./chem-shared";
import { inUnit } from "./shared";

const spec: FormulaSpec = {
  modes: [
    { id: "nV", label: "Molarity from moles", fields: ["n", "V"] },
    { id: "mV", label: "Molarity from mass", fields: ["formula", "mm", "mass", "V"] },
    { id: "need", label: "Mass needed", fields: ["formula", "mm", "c", "V"] },
    { id: "dil", label: "Dilution (find V₁)", fields: ["c1", "c2", "V2"] },
    { id: "dil2", label: "Dilution (find c₂)", fields: ["c1", "V1", "V2"] },
  ],
  fields: [
    { id: "formula", label: "Solute formula", type: "text", mono: true, optional: true, placeholder: "e.g. NaCl", hint: "Leave empty to type the molar mass." },
    { id: "mm", label: "Molar mass", type: "number", gt: 0, optional: true, suffix: "g/mol" },
    { id: "n", label: "Amount of solute", type: "number", gt: 0, units: amount },
    { id: "mass", label: "Mass of solute", type: "number", gt: 0, units: massG },
    { id: "V", label: "Volume of solution", type: "number", gt: 0, units: volumeL, defaultUnit: "mL" },
    { id: "c", label: "Target concentration", type: "number", gt: 0, units: molarity },
    { id: "c1", label: "Stock concentration (c₁)", type: "number", gt: 0, units: molarity },
    { id: "V1", label: "Stock volume used (V₁)", type: "number", gt: 0, units: volumeL, defaultUnit: "mL" },
    { id: "c2", label: "Final concentration (c₂)", type: "number", gt: 0, units: molarity },
    { id: "V2", label: "Final volume (V₂)", type: "number", gt: 0, units: volumeL, defaultUnit: "mL" },
  ],
  example: { formula: "NaCl", n: "0.25", mass: "5.844", V: "500", c: "0.15", c1: "2", c2: "0.1", V1: "25", V2: "500" },
  lead: <p>Molarity c = n / V (mol per liter of solution). Dilution keeps moles constant: c₁V₁ = c₂V₂.</p>,
  compute: (v) => {
    if (v.mode === "nV") {
      const n = v.num("n")!;
      const V = v.num("V")!;
      const c = n / V;
      return { outputs: [{ label: "Molarity", value: `${num(c)} M`, primary: true }, { label: "In mM", value: num(c * 1000) }], steps: [`c = n / V = ${num(n)} mol / ${num(V)} L = ${num(c)} mol/L`] };
    }
    if (v.mode === "dil") {
      const c1 = v.num("c1")!;
      const c2 = v.num("c2")!;
      const V2 = v.num("V2")!;
      if (c2 > c1) return "The final concentration cannot be higher than the stock when diluting.";
      const V1 = (c2 * V2) / c1;
      return {
        outputs: [{ label: "Stock volume needed (V₁)", value: inUnit(V1, volumeL, v.unit("V2")), primary: true }, { label: "Solvent to add", value: inUnit(V2 - V1, volumeL, v.unit("V2")) }, { label: "Dilution factor", value: `${num(c1 / c2)}×` }],
        steps: [`V₁ = c₂V₂ / c₁ = ${num(c2)} × ${num(V2)} L / ${num(c1)} = ${num(V1)} L`, `Solvent = V₂ − V₁ = ${num(V2 - V1)} L`],
        notes: ["Add the stock to part of the solvent, then top up to the final volume; volumes are not always perfectly additive."],
      };
    }
    if (v.mode === "dil2") {
      const c1 = v.num("c1")!;
      const V1 = v.num("V1")!;
      const V2 = v.num("V2")!;
      if (V2 < V1) return "The final volume must be at least the stock volume.";
      const c2 = (c1 * V1) / V2;
      return { outputs: [{ label: "Final concentration (c₂)", value: `${num(c2)} M`, primary: true }, { label: "In mM", value: num(c2 * 1000) }, { label: "Dilution factor", value: `${num(V2 / V1)}×` }], steps: [`c₂ = c₁V₁ / V₂ = ${num(c1)} × ${num(V1)} / ${num(V2)} = ${num(c2)} M`] };
    }
    const m = resolveMolarMass(v.str("formula"), v.num("mm"));
    if (m === null) return null;
    if ("error" in m) return m.error;
    const V = v.num("V")!;
    if (v.mode === "mV") {
      const g = v.num("mass")!;
      const n = g / m.mm;
      const c = n / V;
      return {
        outputs: [{ label: "Molarity", value: `${num(c)} M`, primary: true }, { label: "Amount", value: `${num(n)} mol` }, { label: "Mass concentration", value: `${num(g / V)} g/L` }],
        steps: [m.step, `n = m / M = ${num(g)} / ${num(m.mm, 7)} = ${num(n)} mol`, `c = n / V = ${num(n)} / ${num(V)} L = ${num(c)} M`],
      };
    }
    const c = v.num("c")!;
    const n = c * V;
    const g = n * m.mm;
    return {
      outputs: [{ label: `Mass of ${m.label} to weigh`, value: g < 1 ? `${num(g * 1000)} mg` : `${num(g)} g`, primary: true }, { label: "Amount", value: `${num(n)} mol` }],
      steps: [m.step, `n = c × V = ${num(c)} M × ${num(V)} L = ${num(n)} mol`, `m = n × M = ${num(n)} × ${num(m.mm, 7)} = ${num(g)} g`],
      notes: ["Dissolve in less solvent first, then fill to the final volume in a volumetric flask. For hydrated salts, include the water in the formula (e.g. CuSO4·5H2O)."],
    };
  },
};

export default function Tool() {
  return <FormulaTool spec={spec} />;
}

"use client";

import { FormulaTool, num, type FormulaSpec } from "@/components/tools/engines/FormulaTool";
import { amount, massG } from "./lib/units";
import { NA } from "./lib/constants";
import { resolveMolarMass } from "./chem-shared";

const spec: FormulaSpec = {
  modes: [
    { id: "g2n", label: "Grams to moles", fields: ["formula", "mm", "mass"] },
    { id: "n2g", label: "Moles to grams", fields: ["formula", "mm", "n"] },
    { id: "n2N", label: "Moles to particles", fields: ["n"] },
    { id: "N2n", label: "Particles to moles", fields: ["N"] },
    { id: "g2N", label: "Grams to particles", fields: ["formula", "mm", "mass"] },
  ],
  fields: [
    { id: "formula", label: "Formula", type: "text", mono: true, optional: true, placeholder: "e.g. H2O", hint: "Used to compute the molar mass. Leave empty to type the molar mass yourself." },
    { id: "mm", label: "Molar mass", type: "number", gt: 0, optional: true, suffix: "g/mol", hint: "Only used when the formula is empty." },
    { id: "mass", label: "Mass", type: "number", gt: 0, units: massG },
    { id: "n", label: "Amount of substance", type: "number", gt: 0, units: amount },
    { id: "N", label: "Number of particles", type: "number", gt: 0, hint: "Atoms, molecules or ions. Scientific notation works, e.g. 3.01e23." },
  ],
  example: { formula: "H2O", mass: "36", n: "2", N: "1.2044e24" },
  lead: <p>n = m / M and N = n × Nₐ, with the Avogadro constant Nₐ = 6.02214076 × 10²³ mol⁻¹ (exact).</p>,
  compute: (v) => {
    if (v.mode === "n2N") {
      const n = v.num("n")!;
      const N = n * NA;
      return { outputs: [{ label: "Particles", value: num(N, 8), primary: true }], steps: [`N = n × Nₐ = ${num(n)} mol × 6.02214076e23 = ${num(N, 8)}`] };
    }
    if (v.mode === "N2n") {
      const N = v.num("N")!;
      const n = N / NA;
      return { outputs: [{ label: "Amount", value: `${num(n, 8)} mol`, primary: true }, { label: "In mmol", value: num(n * 1000, 8) }], steps: [`n = N / Nₐ = ${num(N, 8)} / 6.02214076e23 = ${num(n, 8)} mol`] };
    }
    const m = resolveMolarMass(v.str("formula"), v.num("mm"));
    if (m === null) return null;
    if ("error" in m) return m.error;
    const notes = m.approximate ? ["Uses a mass number for an element with no stable isotopes, so the molar mass is approximate."] : [];
    if (v.mode === "n2g") {
      const n = v.num("n")!;
      const g = n * m.mm;
      return { outputs: [{ label: "Mass", value: `${num(g)} g`, primary: true }, { label: "Molar mass", value: `${num(m.mm, 7)} g/mol` }, { label: "Particles", value: num(n * NA, 8) }], steps: [m.step, `m = n × M = ${num(n)} mol × ${num(m.mm, 7)} g/mol = ${num(g)} g`], notes };
    }
    const g = v.num("mass")!;
    const n = g / m.mm;
    const N = n * NA;
    return {
      outputs: v.mode === "g2N"
        ? [{ label: "Particles", value: num(N, 8), primary: true }, { label: "Amount", value: `${num(n)} mol` }, { label: "Molar mass", value: `${num(m.mm, 7)} g/mol` }]
        : [{ label: "Amount", value: `${num(n)} mol`, primary: true }, { label: "Molar mass", value: `${num(m.mm, 7)} g/mol` }, { label: "Particles", value: num(N, 8) }],
      steps: [m.step, `n = m / M = ${num(g)} g / ${num(m.mm, 7)} g/mol = ${num(n)} mol`, `N = n × Nₐ = ${num(N, 8)}`],
      notes,
    };
  },
};

export default function Tool() {
  return <FormulaTool spec={spec} />;
}

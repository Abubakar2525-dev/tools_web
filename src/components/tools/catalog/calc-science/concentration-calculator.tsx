"use client";

import { FormulaTool, num, type FormulaSpec } from "@/components/tools/engines/FormulaTool";
import { CONC_UNITS, fromGL, needs, toGL, type ConcUnit } from "./lib/concentration";
import { resolveMolarMass } from "./chem-shared";

const spec: FormulaSpec = {
  fields: [
    { id: "value", label: "Concentration", type: "number", gt: 0 },
    { id: "from", label: "Given as", type: "select", options: CONC_UNITS },
    { id: "rho", label: "Solution density", type: "number", gt: 0, optional: true, suffix: "g/mL", hint: "Needed for % w/w, ppm and ppb. Dilute water solutions are about 1.00." },
    { id: "formula", label: "Solute formula", type: "text", mono: true, optional: true, placeholder: "e.g. NaCl", hint: "Needed for mol/L. Or type the molar mass below." },
    { id: "mm", label: "Molar mass", type: "number", gt: 0, optional: true, suffix: "g/mol" },
    { id: "srho", label: "Pure solute density", type: "number", gt: 0, optional: true, suffix: "g/mL", hint: "Needed for % v/v (ethanol 0.789)." },
  ],
  defaults: { rho: "1", from: "wv" },
  example: { value: "0.9", from: "wv", rho: "1.005", formula: "NaCl" },
  compute: (v) => {
    const x = v.num("value")!;
    const from = v.str("from") as ConcUnit;
    const mmIn = resolveMolarMass(v.str("formula"), v.num("mm"));
    if (mmIn && "error" in mmIn) return mmIn.error;
    const p = { solutionDensity: v.num("rho"), soluteDensity: v.num("srho"), molarMass: mmIn ? mmIn.mm : null };
    const missing = needs(from, p);
    if (missing) return `Converting from this unit needs the ${missing}.`;
    const gl = toGL(x, from, p)!;
    const rows = CONC_UNITS.map((u) => {
      const val = fromGL(gl, u.value, p);
      return [u.label, val === null ? `needs ${needs(u.value, p)}` : num(val, 7)];
    });
    const molar = fromGL(gl, "M", p);
    const ww = fromGL(gl, "ww", p);
    if (ww !== null && ww > 100) return "These inputs give more than 100% w/w, which is impossible. Check the density.";
    return {
      outputs: [
        { label: "Mass concentration", value: `${num(gl, 7)} g/L`, primary: true },
        ...(molar !== null ? [{ label: "Molarity", value: `${num(molar, 7)} M` }] : []),
        ...(ww !== null ? [{ label: "% w/w", value: `${num(ww, 6)}%` }] : []),
      ],
      table: { caption: "Equivalent concentrations", columns: ["Unit", "Value"], rows },
      steps: [mmIn && !("error" in mmIn) ? mmIn.step : "", `Pivot: ${num(x)} ${CONC_UNITS.find((u) => u.value === from)!.label} = ${num(gl, 7)} g of solute per liter of solution`].filter(Boolean),
      notes: ["ppm and ppb here are by mass (mg/kg, µg/kg). For dilute water solutions they equal mg/L and µg/L. % v/v assumes volumes add, which is only approximate for mixtures like ethanol and water."],
    };
  },
};

export default function Tool() {
  return <FormulaTool spec={spec} />;
}

"use client";

import { FormulaTool, num, type FormulaOutput, type FormulaSpec } from "@/components/tools/engines/FormulaTool";
import { accel, area, density, force, length, pressure } from "./lib/units";
import { ATM, G0 } from "./lib/constants";
import { unitOutputs } from "./shared";

const pOut = (label: string, P: number): FormulaOutput[] => [
  { label, value: `${num(P)} Pa`, primary: true },
  ...unitOutputs(label, P, pressure, ["kPa", "bar", "atm", "psi", "mmHg"]),
];

const spec: FormulaSpec = {
  modes: [
    { id: "fa", label: "P = F / A", fields: ["F", "A"] },
    { id: "f", label: "Force from P and A", fields: ["P", "A"] },
    { id: "a", label: "Area from F and P", fields: ["F", "P"] },
    { id: "hydro", label: "Fluid depth (ρgh)", fields: ["rho", "h", "g", "abs"] },
  ],
  fields: [
    { id: "F", label: "Force (F)", type: "number", min: 0, units: force },
    { id: "A", label: "Area (A)", type: "number", gt: 0, units: area, defaultUnit: "cm2" },
    { id: "P", label: "Pressure (P)", type: "number", gt: 0, units: pressure, defaultUnit: "kPa" },
    { id: "rho", label: "Fluid density (ρ)", type: "number", gt: 0, units: density, hint: "Fresh water ≈ 1000 kg/m³, seawater ≈ 1025 kg/m³." },
    { id: "h", label: "Depth (h)", type: "number", min: 0, units: length },
    { id: "g", label: "Gravity (g)", type: "number", gt: 0, units: accel },
    { id: "abs", label: "Add standard atmospheric pressure at the surface (absolute pressure)", type: "checkbox" },
  ],
  defaults: { g: String(G0), rho: "1000" },
  example: { F: "500", A: "25", "A:unit": "cm2", P: "200", rho: "1025", h: "10", g: String(G0), abs: true },
  compute: (v) => {
    switch (v.mode) {
      case "fa": {
        const F = v.num("F")!;
        const A = v.num("A")!;
        return { outputs: pOut("Pressure", F / A), steps: [`P = F / A = ${num(F)} N / ${num(A)} m² = ${num(F / A)} Pa`] };
      }
      case "f": {
        const P = v.num("P")!;
        const A = v.num("A")!;
        const F = P * A;
        return { outputs: [{ label: "Force", value: `${num(F)} N`, primary: true }, ...unitOutputs("Force", F, force, ["kN", "lbf", "kgf"])], steps: [`F = P × A = ${num(P)} Pa × ${num(A)} m² = ${num(F)} N`] };
      }
      case "a": {
        const F = v.num("F")!;
        const P = v.num("P")!;
        const A = F / P;
        return { outputs: [{ label: "Area", value: `${num(A)} m²`, primary: true }, ...unitOutputs("Area", A, area, ["cm2", "in2", "ft2"])], steps: [`A = F / P = ${num(F)} N / ${num(P)} Pa = ${num(A)} m²`] };
      }
      default: {
        const rho = v.num("rho")!;
        const h = v.num("h")!;
        const g = v.num("g")!;
        const gauge = rho * g * h;
        const abs = v.bool("abs");
        const P = abs ? gauge + ATM : gauge;
        const steps = [`P_gauge = ρgh = ${num(rho)} kg/m³ × ${num(g)} m/s² × ${num(h)} m = ${num(gauge)} Pa`];
        if (abs) steps.push(`P_abs = P_gauge + 101325 Pa = ${num(P)} Pa`);
        return {
          outputs: [...pOut(abs ? "Absolute pressure" : "Gauge pressure", P), ...(abs ? [{ label: "Gauge pressure (kPa)", value: num(gauge / 1000) }] : [])],
          steps,
          notes: ["Assumes an incompressible fluid at rest with uniform density."],
        };
      }
    }
  },
};

export default function Tool() {
  return <FormulaTool spec={spec} />;
}

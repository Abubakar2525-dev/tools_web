"use client";

import { FormulaTool, num, type FormulaOutput, type FormulaSpec } from "@/components/tools/engines/FormulaTool";
import { accel, energy, length, mass, speed } from "./lib/units";
import { G0 } from "./lib/constants";
import { unitOutputs } from "./shared";

const energyOut = (label: string, E: number): FormulaOutput[] => [
  { label, value: `${num(E)} J`, primary: true },
  ...unitOutputs(label.replace(/ energy$/, ""), E, energy, ["kJ", "cal", "kcal", "kWh", "eV"]),
];

const spec: FormulaSpec = {
  modes: [
    { id: "ke", label: "Kinetic energy", fields: ["m", "v"] },
    { id: "pe", label: "Potential energy", fields: ["m", "h", "g"] },
    { id: "v", label: "Speed from KE", fields: ["m", "E"] },
    { id: "h", label: "Height from PE", fields: ["m", "E", "g"] },
  ],
  fields: [
    { id: "m", label: "Mass (m)", type: "number", gt: 0, units: mass },
    { id: "v", label: "Speed (v)", type: "number", min: 0, units: speed },
    { id: "h", label: "Height (h)", type: "number", units: length, hint: "Above your chosen reference level." },
    { id: "g", label: "Gravity (g)", type: "number", gt: 0, units: accel },
    { id: "E", label: "Energy (E)", type: "number", min: 0, units: energy },
  ],
  defaults: { g: String(G0) },
  example: { m: "1200", "v:unit": "kmh", v: "90", h: "10", g: String(G0), E: "375000" },
  compute: (v) => {
    const m = v.num("m")!;
    switch (v.mode) {
      case "ke": {
        const s = v.num("v")!;
        const E = 0.5 * m * s * s;
        return { outputs: energyOut("Kinetic energy", E), steps: [`KE = ½mv² = 0.5 × ${num(m)} kg × (${num(s)} m/s)² = ${num(E)} J`] };
      }
      case "pe": {
        const h = v.num("h")!;
        const g = v.num("g")!;
        const E = m * g * h;
        return {
          outputs: energyOut("Potential energy", E),
          steps: [`PE = mgh = ${num(m)} kg × ${num(g)} m/s² × ${num(h)} m = ${num(E)} J`],
          notes: ["Valid near a planet's surface where g is roughly constant. For large heights use the gravitational force calculator."],
        };
      }
      case "v": {
        const E = v.num("E")!;
        const s = Math.sqrt((2 * E) / m);
        return {
          outputs: [{ label: "Speed", value: `${num(s)} m/s`, primary: true }, ...unitOutputs("Speed", s, speed, ["kmh", "mph"])],
          steps: [`v = √(2E / m) = √(2 × ${num(E)} / ${num(m)}) = ${num(s)} m/s`],
        };
      }
      default: {
        const E = v.num("E")!;
        const g = v.num("g")!;
        const h = E / (m * g);
        return {
          outputs: [{ label: "Height", value: `${num(h)} m`, primary: true }, ...unitOutputs("Height", h, length, ["ft", "km"])],
          steps: [`h = E / (mg) = ${num(E)} / (${num(m)} × ${num(g)}) = ${num(h)} m`],
        };
      }
    }
  },
};

export default function Tool() {
  return <FormulaTool spec={spec} />;
}

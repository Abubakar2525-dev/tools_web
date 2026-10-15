"use client";

import { FormulaTool, num, type FormulaOutput, type FormulaSpec } from "@/components/tools/engines/FormulaTool";
import { energy, force, power, speed, time } from "./lib/units";
import { unitOutputs } from "./shared";

const powerOut = (P: number): FormulaOutput[] => [
  { label: "Power", value: `${num(P)} W`, primary: true },
  ...unitOutputs("Power", P, power, ["kW", "hp", "PS", "BTUh"]),
];

const spec: FormulaSpec = {
  modes: [
    { id: "wt", label: "P = W / t", fields: ["W", "t"] },
    { id: "fv", label: "P = F × v", fields: ["F", "v"] },
    { id: "vi", label: "P = V × I", fields: ["V", "I"] },
    { id: "w", label: "Energy from P and t", fields: ["P", "t"] },
  ],
  fields: [
    { id: "W", label: "Work or energy (W)", type: "number", min: 0, units: energy },
    { id: "t", label: "Time (t)", type: "number", gt: 0, units: time },
    { id: "F", label: "Force (F)", type: "number", units: force, hint: "Component of force along the direction of motion." },
    { id: "v", label: "Speed (v)", type: "number", units: speed },
    { id: "V", label: "Voltage (V)", type: "number", suffix: "V" },
    { id: "I", label: "Current (I)", type: "number", suffix: "A" },
    { id: "P", label: "Power (P)", type: "number", min: 0, units: power },
  ],
  example: { W: "36", "W:unit": "kJ", t: "1", "t:unit": "min", F: "500", v: "3", V: "230", I: "10", P: "2", "P:unit": "kW" },
  compute: (v) => {
    switch (v.mode) {
      case "wt": {
        const W = v.num("W")!;
        const t = v.num("t")!;
        return { outputs: powerOut(W / t), steps: [`P = W / t = ${num(W)} J / ${num(t)} s = ${num(W / t)} W`] };
      }
      case "fv": {
        const F = v.num("F")!;
        const s = v.num("v")!;
        return { outputs: powerOut(F * s), steps: [`P = F × v = ${num(F)} N × ${num(s)} m/s = ${num(F * s)} W`] };
      }
      case "vi": {
        const V = v.num("V")!;
        const I = v.num("I")!;
        const P = V * I;
        const out = powerOut(P);
        if (I !== 0) out.push({ label: "Resistance (V / I)", value: `${num(V / I)} Ω` });
        return {
          outputs: out,
          steps: [`P = V × I = ${num(V)} V × ${num(I)} A = ${num(P)} W`],
          notes: ["For AC circuits this is apparent power (VA) unless the load is purely resistive; real power also needs the power factor."],
        };
      }
      default: {
        const P = v.num("P")!;
        const t = v.num("t")!;
        const E = P * t;
        return {
          outputs: [{ label: "Energy", value: `${num(E)} J`, primary: true }, ...unitOutputs("Energy", E, energy, ["kJ", "kWh", "kcal"])],
          steps: [`W = P × t = ${num(P)} W × ${num(t)} s = ${num(E)} J`],
        };
      }
    }
  },
};

export default function Tool() {
  return <FormulaTool spec={spec} />;
}

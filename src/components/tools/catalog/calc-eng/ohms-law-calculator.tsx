"use client";

import { FormulaTool, type FormulaSpec } from "@/components/tools/engines/FormulaTool";
import { U, si } from "./lib/units";

const pairs = [
  { id: "VI", label: "V and I", fields: ["V", "I"] },
  { id: "VR", label: "V and R", fields: ["V", "R"] },
  { id: "IR", label: "I and R", fields: ["I", "R"] },
  { id: "PV", label: "P and V", fields: ["P", "V"] },
  { id: "PI", label: "P and I", fields: ["P", "I"] },
  { id: "PR", label: "P and R", fields: ["P", "R"] },
];

const spec: FormulaSpec = {
  lead: (
    <>
      Pick the two quantities you know. The others follow from <strong>V = I × R</strong> and <strong>P = V × I</strong> (DC or resistive AC with RMS values).
    </>
  ),
  modes: pairs,
  fields: [
    { id: "V", label: "Voltage (V)", type: "number", units: U.volt, min: 0 },
    { id: "I", label: "Current (I)", type: "number", units: U.amp, min: 0 },
    { id: "R", label: "Resistance (R)", type: "number", units: U.ohm, gt: 0 },
    { id: "P", label: "Power (P)", type: "number", units: U.watt, min: 0 },
  ],
  defaults: { "I:unit": "mA", "R:unit": "ohm" },
  example: { __mode: "VR", V: "12", R: "220", "R:unit": "ohm" },
  compute: (v) => {
    let V = 0,
      I = 0,
      R = 0,
      P = 0;
    const steps: string[] = [];
    const g = (id: string) => v.num(id) as number;
    switch (v.mode) {
      case "VI":
        V = g("V");
        I = g("I");
        if (I === 0) return "Current must be greater than zero to find the resistance.";
        R = V / I;
        P = V * I;
        steps.push(`R = V ÷ I = ${si(V, "V")} ÷ ${si(I, "A")} = ${si(R, "Ω")}`, `P = V × I = ${si(V, "V")} × ${si(I, "A")} = ${si(P, "W")}`);
        break;
      case "VR":
        V = g("V");
        R = g("R");
        I = V / R;
        P = (V * V) / R;
        steps.push(`I = V ÷ R = ${si(V, "V")} ÷ ${si(R, "Ω")} = ${si(I, "A")}`, `P = V² ÷ R = ${si(V, "V")}² ÷ ${si(R, "Ω")} = ${si(P, "W")}`);
        break;
      case "IR":
        I = g("I");
        R = g("R");
        V = I * R;
        P = I * I * R;
        steps.push(`V = I × R = ${si(I, "A")} × ${si(R, "Ω")} = ${si(V, "V")}`, `P = I² × R = ${si(I, "A")}² × ${si(R, "Ω")} = ${si(P, "W")}`);
        break;
      case "PV":
        P = g("P");
        V = g("V");
        if (V === 0) return "Voltage must be greater than zero.";
        I = P / V;
        if (I === 0) return "Power must be greater than zero to find the resistance.";
        R = (V * V) / P;
        steps.push(`I = P ÷ V = ${si(P, "W")} ÷ ${si(V, "V")} = ${si(I, "A")}`, `R = V² ÷ P = ${si(V, "V")}² ÷ ${si(P, "W")} = ${si(R, "Ω")}`);
        break;
      case "PI":
        P = g("P");
        I = g("I");
        if (I === 0) return "Current must be greater than zero.";
        V = P / I;
        R = P / (I * I);
        if (R === 0) return "Power must be greater than zero to find the resistance.";
        steps.push(`V = P ÷ I = ${si(P, "W")} ÷ ${si(I, "A")} = ${si(V, "V")}`, `R = P ÷ I² = ${si(P, "W")} ÷ ${si(I, "A")}² = ${si(R, "Ω")}`);
        break;
      case "PR":
        P = g("P");
        R = g("R");
        V = Math.sqrt(P * R);
        I = Math.sqrt(P / R);
        steps.push(`V = √(P × R) = √(${si(P, "W")} × ${si(R, "Ω")}) = ${si(V, "V")}`, `I = √(P ÷ R) = √(${si(P, "W")} ÷ ${si(R, "Ω")}) = ${si(I, "A")}`);
        break;
    }
    const known = pairs.find((p) => p.id === v.mode)?.fields ?? [];
    const all = [
      { k: "V", label: "Voltage", value: si(V, "V") },
      { k: "I", label: "Current", value: si(I, "A") },
      { k: "R", label: "Resistance", value: si(R, "Ω") },
      { k: "P", label: "Power", value: si(P, "W") },
    ];
    const unknown = all.filter((x) => !known.includes(x.k));
    return {
      outputs: [
        ...unknown.map((x, i) => ({ label: x.label, value: x.value, primary: i === 0 })),
        ...all.filter((x) => known.includes(x.k)).map((x) => ({ label: `${x.label} (given)`, value: x.value })),
      ],
      steps,
      notes: P > 0 ? [`A common rule of thumb is to pick a resistor rated for at least twice the power it dissipates, here ${si(P * 2, "W")} or more.`] : undefined,
    };
  },
};

export default function Tool() {
  return <FormulaTool spec={spec} />;
}

"use client";

import { FormulaTool, num, type FormulaSpec } from "@/components/tools/engines/FormulaTool";
import { frequency, length, speed, time } from "./lib/units";
import { unitOutputs } from "./shared";

const spec: FormulaSpec = {
  modes: [
    { id: "T", label: "From period", fields: ["T"] },
    { id: "w", label: "From angular frequency", fields: ["w"] },
    { id: "vl", label: "From speed and wavelength", fields: ["v", "lambda"] },
    { id: "f", label: "From frequency", fields: ["f"] },
  ],
  fields: [
    { id: "T", label: "Period (T)", type: "number", gt: 0, units: time, defaultUnit: "ms" },
    { id: "w", label: "Angular frequency (ω)", type: "number", gt: 0, suffix: "rad/s" },
    { id: "v", label: "Wave speed (v)", type: "number", gt: 0, units: speed },
    { id: "lambda", label: "Wavelength (λ)", type: "number", gt: 0, units: length },
    { id: "f", label: "Frequency (f)", type: "number", gt: 0, units: frequency },
  ],
  example: { T: "2.5", "T:unit": "ms", w: "314.159", v: "343", lambda: "0.78", f: "440" },
  lead: <p>f = 1 / T, ω = 2πf, and for a wave f = v / λ.</p>,
  compute: (v) => {
    let f: number;
    const steps: string[] = [];
    if (v.mode === "T") {
      const T = v.num("T")!;
      f = 1 / T;
      steps.push(`f = 1 / T = 1 / ${num(T)} s = ${num(f)} Hz`);
    } else if (v.mode === "w") {
      const w = v.num("w")!;
      f = w / (2 * Math.PI);
      steps.push(`f = ω / 2π = ${num(w)} / ${num(2 * Math.PI)} = ${num(f)} Hz`);
    } else if (v.mode === "vl") {
      const s = v.num("v")!;
      const l = v.num("lambda")!;
      f = s / l;
      steps.push(`f = v / λ = ${num(s)} / ${num(l)} = ${num(f)} Hz`);
    } else {
      f = v.num("f")!;
    }
    if (v.mode !== "T") steps.push(`T = 1 / f = ${num(1 / f)} s`);
    if (v.mode !== "w") steps.push(`ω = 2πf = ${num(2 * Math.PI * f)} rad/s`);
    return {
      outputs: [
        { label: "Frequency", value: `${num(f)} Hz`, primary: true },
        ...unitOutputs("Frequency", f, frequency, ["kHz", "MHz", "rpm"]),
        { label: "Period", value: `${num(1 / f)} s` },
        { label: "Angular frequency", value: `${num(2 * Math.PI * f)} rad/s` },
      ],
      steps,
    };
  },
};

export default function Tool() {
  return <FormulaTool spec={spec} />;
}

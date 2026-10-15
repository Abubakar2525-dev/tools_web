"use client";

import { FormulaTool, num, type FormulaSpec } from "@/components/tools/engines/FormulaTool";
import { force, length, mass, speed, time } from "./lib/units";
import { G0 } from "./lib/constants";

const spec: FormulaSpec = {
  modes: [
    { id: "dv", label: "From Δv and time", fields: ["v0", "v1", "t"] },
    { id: "fm", label: "From force and mass", fields: ["F", "m"] },
    { id: "dist", label: "From Δv and distance", fields: ["v0", "v1", "d"] },
  ],
  fields: [
    { id: "v0", label: "Initial velocity (v₀)", type: "number", units: speed, defaultUnit: "ms" },
    { id: "v1", label: "Final velocity (v)", type: "number", units: speed, defaultUnit: "ms" },
    { id: "t", label: "Time (t)", type: "number", gt: 0, units: time },
    { id: "d", label: "Distance (d)", type: "number", gt: 0, units: length, hint: "Distance covered while accelerating, in a straight line." },
    { id: "F", label: "Net force (F)", type: "number", units: force },
    { id: "m", label: "Mass (m)", type: "number", gt: 0, units: mass },
  ],
  example: { v0: "0", "v0:unit": "kmh", v1: "100", "v1:unit": "kmh", t: "8", d: "111", F: "1500", m: "1200" },
  compute: (v) => {
    let a: number;
    const steps: string[] = [];
    const extra: { label: string; value: string }[] = [];
    if (v.mode === "dv") {
      const v0 = v.num("v0")!;
      const v1 = v.num("v1")!;
      const t = v.num("t")!;
      a = (v1 - v0) / t;
      steps.push(`a = (v − v₀) / t = (${num(v1)} − ${num(v0)}) / ${num(t)} = ${num(a)} m/s²`);
      extra.push({ label: "Distance covered", value: `${num(((v0 + v1) / 2) * t)} m` });
    } else if (v.mode === "fm") {
      const F = v.num("F")!;
      const m = v.num("m")!;
      a = F / m;
      steps.push(`a = F / m = ${num(F)} N / ${num(m)} kg = ${num(a)} m/s²`);
    } else {
      const v0 = v.num("v0")!;
      const v1 = v.num("v1")!;
      const d = v.num("d")!;
      a = (v1 * v1 - v0 * v0) / (2 * d);
      steps.push(`v² = v₀² + 2ad, so a = (v² − v₀²) / 2d`, `a = (${num(v1)}² − ${num(v0)}²) / (2 × ${num(d)}) = ${num(a)} m/s²`);
      if (v0 + v1 !== 0) extra.push({ label: "Time taken", value: `${num((2 * d) / (v0 + v1))} s` });
    }
    return {
      outputs: [
        { label: "Acceleration", value: `${num(a)} m/s²`, primary: true, note: a < 0 ? "Negative: the object is slowing down (deceleration)." : undefined },
        { label: "In ft/s²", value: num(a / 0.3048) },
        { label: "In g (9.80665 m/s²)", value: num(a / G0) },
        ...extra,
      ],
      steps,
      notes: ["Assumes constant acceleration in a straight line."],
    };
  },
};


export default function Tool() {
  return <FormulaTool spec={spec} />;
}

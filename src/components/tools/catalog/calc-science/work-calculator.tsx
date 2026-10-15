"use client";

import { FormulaTool, num, type FormulaSpec } from "@/components/tools/engines/FormulaTool";
import { angle, energy, force, length } from "./lib/units";
import { unitOutputs } from "./shared";

const spec: FormulaSpec = {
  modes: [
    { id: "W", label: "Find work", fields: ["F", "d", "theta"] },
    { id: "F", label: "Find force", fields: ["W", "d", "theta"] },
    { id: "d", label: "Find distance", fields: ["W", "F", "theta"] },
  ],
  fields: [
    { id: "F", label: "Force (F)", type: "number", gt: 0, units: force },
    { id: "d", label: "Displacement (d)", type: "number", gt: 0, units: length },
    { id: "theta", label: "Angle between force and motion (θ)", type: "number", min: 0, units: angle, hint: "0 when you push straight along the direction of motion." },
    { id: "W", label: "Work (W)", type: "number", units: energy },
  ],
  defaults: { theta: "0" },
  example: { F: "50", d: "10", theta: "30", W: "433" },
  lead: <p>W = F × d × cos θ. Only the part of the force along the motion does work.</p>,
  compute: (v) => {
    const th = v.num("theta")!;
    if (th > Math.PI + 1e-12) return "Use an angle between 0° and 180°.";
    let cos = Math.cos(th);
    if (Math.abs(cos) < 1e-12) cos = 0;
    const thDeg = (th * 180) / Math.PI;
    if (v.mode === "W") {
      const F = v.num("F")!;
      const d = v.num("d")!;
      const W = F * d * cos;
      return {
        outputs: [
          { label: "Work", value: `${num(W)} J`, primary: true, note: W < 0 ? "Negative work: the force opposes the motion (for example friction)." : W === 0 ? "A force at 90° to the motion does no work." : undefined },
          ...unitOutputs("Work", W, energy, ["kJ", "ftlbf", "cal", "kWh"]),
          { label: "Force along motion", value: `${num(F * cos)} N` },
        ],
        steps: [`cos(${num(thDeg, 6)}°) = ${num(cos)}`, `W = F × d × cos θ = ${num(F)} N × ${num(d)} m × ${num(cos)} = ${num(W)} J`],
      };
    }
    if (cos === 0) return "At 90° the force does no work, so it cannot be solved for force or distance.";
    const W = v.num("W")!;
    if (v.mode === "F") {
      const d = v.num("d")!;
      const F = W / (d * cos);
      if (F <= 0) return "Work and cos θ must have the same sign (negative work needs an angle above 90°).";
      return { outputs: [{ label: "Force", value: `${num(F)} N`, primary: true }, ...unitOutputs("Force", F, force, ["kN", "lbf"])], steps: [`F = W / (d cos θ) = ${num(W)} / (${num(d)} × ${num(cos)}) = ${num(F)} N`] };
    }
    const F = v.num("F")!;
    const d = W / (F * cos);
    if (d <= 0) return "Work and cos θ must have the same sign (negative work needs an angle above 90°).";
    return { outputs: [{ label: "Distance", value: `${num(d)} m`, primary: true }, ...unitOutputs("Distance", d, length, ["ft", "km"])], steps: [`d = W / (F cos θ) = ${num(W)} / (${num(F)} × ${num(cos)}) = ${num(d)} m`] };
  },
};

export default function Tool() {
  return <FormulaTool spec={spec} />;
}

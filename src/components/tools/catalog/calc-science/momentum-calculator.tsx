"use client";

import { FormulaTool, num, type FormulaSpec } from "@/components/tools/engines/FormulaTool";
import { force, mass, momentum, speed, time } from "./lib/units";
import { unitOutputs } from "./shared";

const spec: FormulaSpec = {
  modes: [
    { id: "p", label: "Find momentum", fields: ["m", "v"] },
    { id: "m", label: "Find mass", fields: ["p", "v"] },
    { id: "v", label: "Find velocity", fields: ["p", "m"] },
    { id: "J", label: "Impulse from force", fields: ["F", "t"] },
    { id: "dp", label: "Impulse from Δv", fields: ["m", "v0", "v1", "t2"] },
  ],
  fields: [
    { id: "p", label: "Momentum (p)", type: "number", units: momentum },
    { id: "m", label: "Mass (m)", type: "number", gt: 0, units: mass },
    { id: "v", label: "Velocity (v)", type: "number", units: speed },
    { id: "F", label: "Average force (F)", type: "number", units: force },
    { id: "t", label: "Contact time (Δt)", type: "number", gt: 0, units: time },
    { id: "v0", label: "Initial velocity (v₀)", type: "number", units: speed, hint: "Use a negative value for motion in the opposite direction." },
    { id: "v1", label: "Final velocity (v)", type: "number", units: speed },
    { id: "t2", label: "Contact time (Δt)", type: "number", gt: 0, optional: true, units: time, hint: "Optional: gives the average force." },
  ],
  example: { m: "0.145", v: "40", p: "5.8", F: "2000", t: "0.004", "t:unit": "s", v0: "-40", v1: "50", t2: "0.0007" },
  compute: (v) => {
    switch (v.mode) {
      case "p": {
        const m = v.num("m")!;
        const vel = v.num("v")!;
        const p = m * vel;
        return { outputs: [{ label: "Momentum", value: `${num(p)} kg·m/s`, primary: true }, ...unitOutputs("Momentum", p, momentum, ["gcms", "lbfts"])], steps: [`p = m × v = ${num(m)} kg × ${num(vel)} m/s = ${num(p)} kg·m/s`] };
      }
      case "m": {
        const p = v.num("p")!;
        const vel = v.num("v")!;
        if (vel === 0) return "Velocity cannot be 0 when solving for mass.";
        const m = p / vel;
        if (m <= 0) return "Momentum and velocity must have the same sign.";
        return { outputs: [{ label: "Mass", value: `${num(m)} kg`, primary: true }], steps: [`m = p / v = ${num(p)} / ${num(vel)} = ${num(m)} kg`] };
      }
      case "v": {
        const p = v.num("p")!;
        const m = v.num("m")!;
        const vel = p / m;
        return { outputs: [{ label: "Velocity", value: `${num(vel)} m/s`, primary: true }, ...unitOutputs("Velocity", vel, speed, ["kmh", "mph"])], steps: [`v = p / m = ${num(p)} / ${num(m)} = ${num(vel)} m/s`] };
      }
      case "J": {
        const F = v.num("F")!;
        const t = v.num("t")!;
        const J = F * t;
        return {
          outputs: [{ label: "Impulse", value: `${num(J)} N·s`, primary: true }, { label: "Change in momentum", value: `${num(J)} kg·m/s` }],
          steps: [`J = F × Δt = ${num(F)} N × ${num(t)} s = ${num(J)} N·s`, "By the impulse-momentum theorem, J = Δp."],
        };
      }
      default: {
        const m = v.num("m")!;
        const v0 = v.num("v0")!;
        const v1 = v.num("v1")!;
        const t = v.num("t2");
        const dp = m * (v1 - v0);
        const steps = [`Δp = m(v − v₀) = ${num(m)} × (${num(v1)} − (${num(v0)})) = ${num(dp)} kg·m/s`, `J = Δp = ${num(dp)} N·s`];
        if (t !== null) steps.push(`F_avg = J / Δt = ${num(dp)} / ${num(t)} = ${num(dp / t)} N`);
        return {
          outputs: [
            { label: "Impulse (Δp)", value: `${num(dp)} N·s`, primary: true },
            { label: "Initial momentum", value: `${num(m * v0)} kg·m/s` },
            { label: "Final momentum", value: `${num(m * v1)} kg·m/s` },
            ...(t !== null ? [{ label: "Average force", value: `${num(dp / t)} N` }] : []),
          ],
          steps,
        };
      }
    }
  },
};

export default function Tool() {
  return <FormulaTool spec={spec} />;
}

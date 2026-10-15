"use client";

import { FormulaTool, num, type FormulaSpec } from "@/components/tools/engines/FormulaTool";
import { accel, force, mass } from "./lib/units";
import { G0 } from "./lib/constants";
import { unitOutputs } from "./shared";

/** Approximate surface gravity in m/s² (NASA planetary fact sheets; Earth uses standard gravity). */
const BODIES: { value: string; label: string; g: number }[] = [
  { value: "earth", label: "Earth (standard g, 9.80665)", g: G0 },
  { value: "moon", label: "Moon (1.62)", g: 1.62 },
  { value: "mercury", label: "Mercury (3.70)", g: 3.7 },
  { value: "venus", label: "Venus (8.87)", g: 8.87 },
  { value: "mars", label: "Mars (3.71)", g: 3.71 },
  { value: "jupiter", label: "Jupiter (24.79)", g: 24.79 },
  { value: "saturn", label: "Saturn (10.44)", g: 10.44 },
  { value: "uranus", label: "Uranus (8.87)", g: 8.87 },
  { value: "neptune", label: "Neptune (11.15)", g: 11.15 },
  { value: "pluto", label: "Pluto (0.62)", g: 0.62 },
  { value: "custom", label: "Custom g", g: NaN },
];

const spec: FormulaSpec = {
  modes: [
    { id: "F", label: "Find force", fields: ["m", "a"] },
    { id: "m", label: "Find mass", fields: ["F", "a"] },
    { id: "a", label: "Find acceleration", fields: ["F", "m"] },
    { id: "w", label: "Weight on a planet", fields: ["m", "body", "g"] },
  ],
  fields: [
    { id: "F", label: "Force (F)", type: "number", units: force },
    { id: "m", label: "Mass (m)", type: "number", gt: 0, units: mass },
    { id: "a", label: "Acceleration (a)", type: "number", units: accel },
    { id: "body", label: "Body", type: "select", options: BODIES.map((b) => ({ value: b.value, label: b.label })) },
    { id: "g", label: "Custom g", type: "number", gt: 0, optional: true, units: accel, hint: "Used only when Body is set to Custom g." },
  ],
  example: { m: "70", F: "700", a: "2.5" },
  lead: <p>Newton&apos;s second law: F = m × a. Weight is the force gravity exerts on a mass: W = m × g.</p>,
  compute: (v) => {
    if (v.mode === "F") {
      const m = v.num("m")!;
      const a = v.num("a")!;
      const F = m * a;
      return {
        outputs: [{ label: "Force", value: `${num(F)} N`, primary: true }, ...unitOutputs("Force", F, force, ["kN", "lbf", "kgf"])],
        steps: [`F = m × a = ${num(m)} kg × ${num(a)} m/s² = ${num(F)} N`],
      };
    }
    if (v.mode === "m") {
      const F = v.num("F")!;
      const a = v.num("a")!;
      if (a === 0) return "Acceleration cannot be 0 when solving for mass.";
      const m = F / a;
      if (m <= 0) return "Force and acceleration must point the same way (same sign) to give a positive mass.";
      return {
        outputs: [{ label: "Mass", value: `${num(m)} kg`, primary: true }, ...unitOutputs("Mass", m, mass, ["g", "lb"])],
        steps: [`m = F / a = ${num(F)} N / ${num(a)} m/s² = ${num(m)} kg`],
      };
    }
    if (v.mode === "a") {
      const F = v.num("F")!;
      const m = v.num("m")!;
      const a = F / m;
      return {
        outputs: [{ label: "Acceleration", value: `${num(a)} m/s²`, primary: true }, ...unitOutputs("Acceleration", a, accel, ["fts2", "g0"])],
        steps: [`a = F / m = ${num(F)} N / ${num(m)} kg = ${num(a)} m/s²`],
      };
    }
    const m = v.num("m")!;
    const body = BODIES.find((b) => b.value === v.str("body")) ?? BODIES[0];
    const g = body.value === "custom" ? v.num("g") : body.g;
    if (g === null) return null;
    const W = m * g;
    return {
      outputs: [
        { label: `Weight on ${body.value === "custom" ? "this body" : body.label.split(" (")[0]}`, value: `${num(W)} N`, primary: true },
        ...unitOutputs("Weight", W, force, ["lbf", "kgf"]),
        { label: "Compared with Earth", value: `${num((g / G0) * 100, 4)}%` },
      ],
      steps: [`W = m × g = ${num(m)} kg × ${num(g)} m/s² = ${num(W)} N`],
      notes: [
        "A bathroom scale shows kgf (or lbf): the mass that would weigh the same on Earth. Mass itself does not change between planets.",
        "Planet values are approximate surface gravity at the equator and ignore rotation; for gas giants they refer to the 1 bar pressure level.",
      ],
    };
  },
};

export default function Tool() {
  return <FormulaTool spec={spec} />;
}

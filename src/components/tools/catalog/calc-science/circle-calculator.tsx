"use client";

import { FormulaTool, num, type FormulaSpec } from "@/components/tools/engines/FormulaTool";
import { lengthChoices } from "./lib/units";
import { Figure, mutedText, stroke, textStyle } from "./shared";

const spec: FormulaSpec = {
  fields: [
    {
      id: "known",
      label: "I know the",
      type: "select",
      options: [
        { value: "r", label: "Radius (r)" },
        { value: "d", label: "Diameter (d)" },
        { value: "c", label: "Circumference (C)" },
        { value: "a", label: "Area (A)" },
      ],
    },
    { id: "unit", label: "Length unit", type: "select", options: lengthChoices },
    { id: "value", label: "Value", type: "number", gt: 0, hint: "For area, enter it in square units of the chosen length unit." },
  ],
  defaults: { unit: "cm" },
  example: { known: "c", unit: "cm", value: "31.4159" },
  compute: (v) => {
    const k = v.str("known");
    const x = v.num("value")!;
    const u = v.str("unit") === "u" ? "" : v.str("unit");
    const L = (n: number) => (u ? `${num(n)} ${u}` : num(n));
    const A2 = (n: number) => (u ? `${num(n)} ${u}²` : `${num(n)} square units`);
    let r: number;
    const steps: string[] = [];
    if (k === "r") {
      r = x;
      steps.push(`r = ${num(r)}`);
    } else if (k === "d") {
      r = x / 2;
      steps.push(`r = d / 2 = ${num(x)} / 2 = ${num(r)}`);
    } else if (k === "c") {
      r = x / (2 * Math.PI);
      steps.push(`r = C / (2π) = ${num(x)} / ${num(2 * Math.PI)} = ${num(r)}`);
    } else {
      r = Math.sqrt(x / Math.PI);
      steps.push(`r = √(A / π) = √(${num(x)} / π) = ${num(r)}`);
    }
    const d = 2 * r;
    const c = 2 * Math.PI * r;
    const a = Math.PI * r * r;
    if (k !== "d") steps.push(`d = 2r = ${num(d)}`);
    if (k !== "c") steps.push(`C = 2πr = 2 × π × ${num(r)} = ${num(c)}`);
    if (k !== "a") steps.push(`A = πr² = π × ${num(r)}² = ${num(a)}`);
    return {
      outputs: [
        { label: "Radius", value: L(r), primary: k !== "r" },
        { label: "Diameter", value: L(d) },
        { label: "Circumference", value: L(c) },
        { label: "Area", value: A2(a), primary: k === "r" },
      ],
      steps,
      visual: (
        <Figure label={`Circle: radius ${L(r)}, diameter ${L(d)}, circumference ${L(c)}`} viewBox="0 0 320 200">
          <circle cx={160} cy={100} r={80} {...stroke} />
          <line x1={80} y1={100} x2={240} y2={100} stroke="var(--muted)" strokeDasharray="4 4" />
          <line x1={160} y1={100} x2={216.6} y2={43.4} stroke="var(--ink)" strokeWidth={1.5} />
          <circle cx={160} cy={100} r={3} fill="var(--ink)" />
          <text x={196} y={66} {...textStyle}>r</text>
          <text x={100} y={118} {...mutedText}>d = 2r</text>
        </Figure>
      ),
    };
  },
};

export default function Tool() {
  return <FormulaTool spec={spec} />;
}

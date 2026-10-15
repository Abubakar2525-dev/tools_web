"use client";

import { FormulaTool, num, type FormulaSpec } from "@/components/tools/engines/FormulaTool";
import { requiredGpa } from "./lib/grades";

const spec: FormulaSpec = {
  lead: (
    <>
      <strong>Required GPA = (target × (done + remaining) − current × done) ÷ remaining</strong>, a credit-weighted average.
    </>
  ),
  fields: [
    { id: "gpa", label: "Current cumulative GPA", type: "number", min: 0 },
    { id: "done", label: "Credits completed", type: "number", min: 0 },
    { id: "remaining", label: "Credits remaining", type: "number", gt: 0 },
    { id: "target", label: "Target cumulative GPA", type: "number", min: 0 },
    {
      id: "scale",
      label: "GPA scale maximum",
      type: "select",
      options: [
        { value: "4", label: "4.0" },
        { value: "4.3", label: "4.3 (A+ = 4.3)" },
        { value: "5", label: "5.0" },
        { value: "10", label: "10-point" },
      ],
    },
  ],
  example: { gpa: "3.1", done: "60", remaining: "60", target: "3.4", scale: "4" },
  compute: (v) => {
    const gpa = v.num("gpa") as number;
    const done = v.num("done") as number;
    const rem = v.num("remaining") as number;
    const target = v.num("target") as number;
    const max = Number(v.str("scale"));
    if (gpa > max) return `The current GPA is above the ${max} scale maximum.`;
    if (target > max) return `The target is above the ${max} scale maximum.`;
    const req = requiredGpa(gpa, done, rem, target);
    const best = (gpa * done + max * rem) / (done + rem);
    let note: string;
    if (req <= 0) note = "Already secured: even the lowest grades keep you at or above the target.";
    else if (req > max + 1e-9) note = `Not possible with ${num(rem)} credits: even a perfect ${max} only reaches ${num(best, 3)}.`;
    else if (req > max * 0.925) note = "Possible, but it needs near-perfect grades on every remaining credit.";
    else note = "Reachable if you average this across the remaining credits.";
    const extra: number | null = req > max ? ((target - gpa) * done) / (max - target) : null;
    return {
      outputs: [
        { label: "GPA needed on remaining credits", value: req <= 0 ? "0.00" : num(Math.round(req * 1000) / 1000, 4), primary: true, note },
        { label: "Highest reachable GPA", value: num(Math.round(best * 1000) / 1000, 4) },
        { label: "Total credits at the end", value: num(done + rem) },
        ...(extra !== null && Number.isFinite(extra) && extra > 0 ? [{ label: "Credits of straight max grades needed", value: num(Math.ceil(extra)) }] : []),
      ],
      steps: [
        `Quality points so far = ${num(gpa)} × ${num(done)} = ${num(gpa * done, 6)}`,
        `Quality points needed = ${num(target)} × ${num(done + rem)} = ${num(target * (done + rem), 6)}`,
        `Required = (${num(target * (done + rem), 6)} − ${num(gpa * done, 6)}) ÷ ${num(rem)} = ${num(req, 5)}`,
      ],
      table: {
        caption: "What different averages on the remaining credits would give you",
        columns: ["Average on remaining", "Final cumulative GPA"],
        rows: Array.from({ length: 6 }, (_, i) => {
          const g = max - (i * max) / 10;
          return [num(g, 3), num(Math.round(((gpa * done + g * rem) / (done + rem)) * 1000) / 1000, 4)];
        }),
      },
      notes: ["Your registrar may round, cap or exclude some courses (repeats, pass/fail). Check its rules before relying on the result."],
    };
  },
};

export default function Tool() {
  return <FormulaTool spec={spec} />;
}

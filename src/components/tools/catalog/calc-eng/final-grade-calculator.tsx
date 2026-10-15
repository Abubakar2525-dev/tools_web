"use client";

import { FormulaTool, num, type FormulaSpec } from "@/components/tools/engines/FormulaTool";
import { SCALE_PRESETS, requiredFinal } from "./lib/grades";

function feasibility(req: number, maxScore: number): string {
  if (req <= 0) return "You have already secured this grade, even with a zero on the final.";
  if (req > maxScore) return `Not reachable: you would need more than the maximum of ${num(maxScore)}% on the final.`;
  if (req > 90) return "Possible, but it needs a near-perfect final.";
  return "Reachable with this final score.";
}

const spec: FormulaSpec = {
  lead: (
    <>
      <strong>Required final = (target − current × (1 − w)) ÷ w</strong>, where w is the final exam&apos;s share of the course grade.
    </>
  ),
  fields: [
    { id: "current", label: "Current grade", type: "number", suffix: "%", min: 0, hint: "Your grade before the final, as a percentage." },
    { id: "weight", label: "Final exam weight", type: "number", suffix: "%", gt: 0, max: 100 },
    { id: "target", label: "Target course grade", type: "number", suffix: "%", min: 0 },
    { id: "max", label: "Maximum possible final score", type: "number", suffix: "%", optional: true, gt: 0, placeholder: "100", hint: "Raise this if the final has extra credit." },
  ],
  example: { current: "84", weight: "30", target: "85" },
  compute: (v) => {
    const cur = v.num("current") as number;
    const w = (v.num("weight") as number) / 100;
    const target = v.num("target") as number;
    const maxScore = v.num("max") ?? 100;
    const req = requiredFinal(cur, w, target);
    const floor = cur * (1 - w);
    const ceiling = floor + maxScore * w;
    const rows = SCALE_PRESETS.standard.rows
      .filter((r) => r.min > 0)
      .map((r) => {
        const x = requiredFinal(cur, w, r.min);
        return [`${r.letter} (${r.min}%)`, x <= 0 ? "Already secured" : x > maxScore ? "Not reachable" : `${num(x, 4)}%`];
      });
    return {
      outputs: [
        { label: "Score needed on the final", value: `${num(Math.max(req, 0), 4)}%`, primary: true, note: feasibility(req, maxScore) },
        { label: "Grade if you score 0", value: `${num(floor, 4)}%` },
        { label: `Grade if you score ${num(maxScore)}`, value: `${num(ceiling, 4)}%` },
      ],
      steps: [
        `Points already locked in = ${num(cur)} × (1 − ${num(w)}) = ${num(floor, 5)}`,
        `Required = (${num(target)} − ${num(floor, 5)}) ÷ ${num(w)} = ${num(req, 5)}%`,
      ],
      table: { caption: "Final score needed for each letter (A-F 90/80/70/60 scale)", columns: ["Course grade", "Final score needed"], rows },
    };
  },
};

export default function Tool() {
  return <FormulaTool spec={spec} />;
}

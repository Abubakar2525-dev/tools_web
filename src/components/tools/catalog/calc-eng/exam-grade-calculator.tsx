"use client";

import { FormulaTool, num, type FormulaSpec } from "@/components/tools/engines/FormulaTool";
import { SCALE_PRESETS, letterFor, parseScale, type ScaleRow } from "./lib/grades";

const spec: FormulaSpec = {
  lead: <>Turns a raw score into a percentage and letter, and builds a grading table for every possible score.</>,
  fields: [
    { id: "score", label: "Points scored", type: "number", min: 0 },
    { id: "total", label: "Total points possible", type: "number", gt: 0 },
    {
      id: "scale",
      label: "Grading scale",
      type: "select",
      options: [...Object.entries(SCALE_PRESETS).map(([value, s]) => ({ value, label: s.label })), { value: "custom", label: "Custom scale" }],
    },
    { id: "custom", label: "Custom scale", type: "text", optional: true, placeholder: "A=85, B=75, C=65, D=50, F=0", hint: "Only used with Custom scale: letter = minimum percent." },
    { id: "step", label: "Table step", type: "number", optional: true, gt: 0, placeholder: "auto", hint: "Points between table rows." },
  ],
  example: { score: "43", total: "50", scale: "standard" },
  compute: (v) => {
    const score = v.num("score") as number;
    const total = v.num("total") as number;
    let rows: ScaleRow[];
    if (v.str("scale") === "custom") {
      const parsed = parseScale(v.str("custom"));
      if (typeof parsed === "string") return parsed;
      rows = parsed;
    } else rows = SCALE_PRESETS[v.str("scale")].rows;
    const pct = (score / total) * 100;
    const letter = letterFor(pct, rows);
    const step = v.num("step") ?? (total <= 60 ? 1 : Math.ceil(total / 60));
    if (total / step > 1000) return "That step would make more than 1,000 table rows. Use a larger step.";
    const table: (string | number)[][] = [];
    for (let s = total; s >= -1e-9; s -= step) {
      const p = (Math.max(s, 0) / total) * 100;
      table.push([num(Math.max(s, 0), 6), `${num(p, 4)}%`, letterFor(p, rows), num(total - Math.max(s, 0), 6)]);
    }
    const next = rows
      .filter((r) => r.min > pct + 1e-9)
      .sort((a, b) => a.min - b.min)[0];
    return {
      outputs: [
        { label: "Percentage", value: `${num(pct, 4)}%`, primary: true, note: `Letter grade: ${letter}` },
        { label: "Letter grade", value: letter },
        { label: "Points missed", value: num(total - score, 6) },
        ...(next ? [{ label: `Points needed for ${next.letter}`, value: num(Math.ceil(((next.min * total) / 100 - score) * 1e6) / 1e6, 6) }] : []),
      ],
      steps: [`Percentage = ${num(score)} ÷ ${num(total)} × 100 = ${num(pct, 6)}%`, `Scale: ${rows.map((r) => `${r.letter} ≥ ${num(r.min)}%`).join(", ")}`],
      table: { caption: `Grading table for ${num(total)} points`, columns: ["Score", "Percent", "Grade", "Points missed"], rows: table },
      notes: score > total ? ["The score is above the total, which usually means extra credit."] : undefined,
    };
  },
};

export default function Tool() {
  return <FormulaTool spec={spec} />;
}

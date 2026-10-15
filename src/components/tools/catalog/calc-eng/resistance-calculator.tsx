"use client";

import { FormulaTool, type FormulaSpec } from "@/components/tools/engines/FormulaTool";
import { U, parseSIList, si } from "./lib/units";

const spec: FormulaSpec = {
  lead: (
    <>
      List resistor values separated by commas or spaces. Prefixes work: <code>220</code>, <code>4.7k</code>, <code>1M</code>, <code>470m</code> (milliohm).
    </>
  ),
  fields: [
    { id: "list", label: "Resistor values", type: "text", mono: true, placeholder: "100, 220, 470", hint: "Two or more values; bare numbers use the unit below." },
    {
      id: "bare",
      label: "Unit for bare numbers",
      type: "select",
      options: [
        { value: "1", label: "Ω (ohms)" },
        { value: "1000", label: "kΩ" },
        { value: "1000000", label: "MΩ" },
      ],
    },
    { id: "V", label: "Supply voltage", type: "number", units: U.volt, optional: true, min: 0, hint: "Optional: shows currents and voltage drops." },
  ],
  example: { list: "100, 220, 470" },
  compute: (v) => {
    const vals = parseSIList(v.str("list"), ["Ω", "ohm", "ohms", "R"], Number(v.str("bare")));
    if (typeof vals === "string") return vals;
    const series = vals.reduce((a, b) => a + b, 0);
    const parallel = 1 / vals.reduce((a, b) => a + 1 / b, 0);
    const V = v.num("V");
    const steps = [
      `Series: R = ${vals.map((x) => si(x, "Ω")).join(" + ")} = ${si(series, "Ω")}`,
      `Parallel: 1/R = ${vals.map((x) => `1/${si(x, "Ω")}`).join(" + ")} = ${si(1 / parallel, "S")}`,
      `Parallel: R = 1 ÷ ${si(1 / parallel, "S")} = ${si(parallel, "Ω")}`,
    ];
    if (vals.length === 2) steps.push(`Two resistors: R₁R₂ ÷ (R₁ + R₂) = ${si(vals[0] * vals[1], "Ω²")} ÷ ${si(vals[0] + vals[1], "Ω")} = ${si(parallel, "Ω")}`);
    const columns = ["Resistor", "Value"];
    const rows: (string | number)[][] = vals.map((x, i) => [`R${i + 1}`, si(x, "Ω")]);
    if (V !== null && V > 0) {
      const Is = V / series;
      columns.push("Series: voltage drop", "Parallel: current", "Parallel: power");
      vals.forEach((x, i) => rows[i].push(si(Is * x, "V"), si(V / x, "A"), si((V * V) / x, "W")));
      steps.push(`Series current = ${si(V, "V")} ÷ ${si(series, "Ω")} = ${si(Is, "A")}; each drop = I × Rn`, `Parallel: each branch sees ${si(V, "V")}, so In = V ÷ Rn`);
    }
    return {
      outputs: [
        { label: "Series total", value: si(series, "Ω"), primary: true },
        { label: "Parallel total", value: si(parallel, "Ω") },
        { label: "Resistors", value: String(vals.length) },
        ...(V !== null && V > 0
          ? [
              { label: "Series current", value: si(V / series, "A") },
              { label: "Parallel total current", value: si(V / parallel, "A") },
            ]
          : []),
      ],
      steps,
      table: { caption: "Per-resistor values", columns, rows },
      notes: vals.length < 2 ? ["Add at least two values to see a meaningful series or parallel combination."] : undefined,
    };
  },
};

export default function Tool() {
  return <FormulaTool spec={spec} />;
}

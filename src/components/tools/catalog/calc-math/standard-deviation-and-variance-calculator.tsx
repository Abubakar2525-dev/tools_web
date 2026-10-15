"use client";

import { FormulaTool, num, type FormulaSpec } from "@/components/tools/engines/FormulaTool";
import { mean, parseNumbers, sum } from "./lib/descriptive";

const MAX_VALUES = 100000;
const MAX_ROWS = 200;

const spec: FormulaSpec = {
  fields: [
    { id: "data", label: "Data", type: "text", multiline: true, placeholder: "2, 4, 4, 4, 5, 5, 7, 9", hint: "Numbers separated by commas, spaces or new lines." },
    {
      id: "kind",
      label: "Your data is a",
      type: "select",
      options: [
        { value: "sample", label: "Sample (divide by n − 1)" },
        { value: "population", label: "Population (divide by n)" },
      ],
    },
  ],
  example: { data: "2, 4, 4, 4, 5, 5, 7, 9", kind: "population" },
  compute: (v) => {
    const { values, invalid } = parseNumbers(v.str("data"));
    if (invalid.length) return `Not a number: ${invalid.slice(0, 5).map((t) => `"${t}"`).join(", ")}`;
    if (!values.length) return null;
    if (values.length > MAX_VALUES) return `At most ${MAX_VALUES.toLocaleString("en-US")} values.`;
    const sample = v.str("kind") === "sample";
    const n = values.length;
    if (sample && n < 2) return "A sample needs at least 2 values (n − 1 must be positive).";
    const m = mean(values);
    const devs = values.map((x) => x - m);
    const sq = devs.map((d) => d * d);
    const ss = sum(sq);
    const varS = n > 1 ? ss / (n - 1) : NaN;
    const varP = ss / n;
    const variance = sample ? varS : varP;
    const sd = Math.sqrt(variance);
    const sem = Math.sqrt(varS) / Math.sqrt(n);
    const div = sample ? `n − 1 = ${n - 1}` : `n = ${n}`;
    return {
      outputs: [
        { label: sample ? "Sample standard deviation (s)" : "Population standard deviation (σ)", value: num(sd, 12), primary: true },
        { label: sample ? "Sample variance (s²)" : "Population variance (σ²)", value: num(variance, 12) },
        { label: "Mean", value: num(m, 12) },
        { label: "Count (n)", value: n.toLocaleString("en-US") },
        { label: "Sum of squares (SS)", value: num(ss, 12) },
        { label: sample ? "Population SD (σ)" : "Sample SD (s)", value: sample ? num(Math.sqrt(varP), 12) : Number.isFinite(varS) ? num(Math.sqrt(varS), 12) : "n/a" },
        { label: "Standard error of the mean", value: Number.isFinite(sem) ? num(sem, 10) : "n/a" },
        { label: "Coefficient of variation", value: m !== 0 ? `${num((sd / Math.abs(m)) * 100, 6)}%` : "n/a" },
      ],
      table: {
        caption: n > MAX_ROWS ? `First ${MAX_ROWS} of ${n} rows` : "Deviation table",
        columns: ["#", "x", "x − mean", "(x − mean)²"],
        rows: values.slice(0, MAX_ROWS).map((x, i) => [i + 1, num(x, 10), num(devs[i], 10), num(sq[i], 10)]),
      },
      steps: [
        `Mean = ${num(sum(values), 12)} / ${n} = ${num(m, 12)}`,
        `Sum of squared deviations SS = Σ(x − mean)² = ${num(ss, 12)}`,
        `Variance = SS / (${div}) = ${num(ss, 12)} / ${sample ? n - 1 : n} = ${num(variance, 12)}`,
        `Standard deviation = √variance = ${num(sd, 12)}`,
      ],
      notes: [
        sample
          ? "Sample formulas divide by n − 1 (Bessel's correction) so the variance is an unbiased estimate of the population variance."
          : "Population formulas divide by n. Use them only when the data covers the entire group you care about.",
      ],
    };
  },
};

export default function Tool() {
  return <FormulaTool spec={spec} />;
}

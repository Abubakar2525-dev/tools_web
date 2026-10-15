"use client";

import { FormulaTool, num, type FormulaSpec } from "@/components/tools/engines/FormulaTool";
import { QUARTILE_METHODS, kurtosis, mean, medianSorted, modes, parseNumbers, quartiles, skewness, sortedCopy, sum, type QuartileMethod } from "./lib/descriptive";

const MAX_VALUES = 100000;

const spec: FormulaSpec = {
  fields: [
    {
      id: "data",
      label: "Data",
      type: "text",
      multiline: true,
      placeholder: "6, 7, 15, 36, 39, 40, 41, 42, 43, 47, 49",
      hint: "Numbers separated by commas, spaces, semicolons or new lines (paste a spreadsheet column).",
    },
    { id: "method", label: "Quartile method", type: "select", options: QUARTILE_METHODS.map((m) => ({ value: m.value, label: m.label })) },
  ],
  example: { data: "6, 7, 15, 36, 39, 40, 41, 42, 43, 47, 49", method: "inclusive" },
  compute: (v) => {
    const { values, invalid } = parseNumbers(v.str("data"));
    if (invalid.length) return `Not a number: ${invalid.slice(0, 5).map((t) => `"${t}"`).join(", ")}${invalid.length > 5 ? " …" : ""}`;
    if (!values.length) return null;
    if (values.length > MAX_VALUES) return `At most ${MAX_VALUES.toLocaleString("en-US")} values.`;
    const n = values.length;
    const s = sortedCopy(values);
    const total = sum(values);
    const m = mean(values);
    const med = medianSorted(s);
    const mo = modes(values);
    const method = v.str("method") as QuartileMethod;
    const [q1, , q3] = quartiles(s, method);
    const iqr = q3 - q1;
    const lowFence = q1 - 1.5 * iqr;
    const highFence = q3 + 1.5 * iqr;
    const outliers = s.filter((x) => x < lowFence || x > highFence);
    const sk = skewness(values);
    const kt = kurtosis(values);
    const half = Math.floor(n / 2);
    const modeText = mo.values.length === 0 ? "No mode (all values occur equally often)" : mo.values.length > 10 ? `${mo.values.length} values tie` : mo.values.map((x) => num(x)).join(", ");
    const methodNote = QUARTILE_METHODS.find((q) => q.value === method)?.note ?? "";
    const shown = s.length > 40 ? `${s.slice(0, 40).map((x) => num(x)).join(", ")}, …` : s.map((x) => num(x)).join(", ");
    return {
      outputs: [
        { label: "Mean", value: num(m, 12), primary: true, note: `Median ${num(med, 12)} · ${mo.values.length ? `Mode ${modeText}` : "No mode"}` },
        { label: "Median", value: num(med, 12) },
        { label: mo.values.length > 1 ? "Modes" : "Mode", value: mo.values.length ? `${modeText} (×${mo.count})` : "None" },
        { label: "Count (n)", value: n.toLocaleString("en-US") },
        { label: "Sum", value: num(total, 12) },
        { label: "Range", value: num(s[n - 1] - s[0], 12) },
        { label: "Minimum", value: num(s[0], 12) },
        { label: "Maximum", value: num(s[n - 1], 12) },
        { label: "Q1", value: num(q1, 12) },
        { label: "Q3", value: num(q3, 12) },
        { label: "IQR", value: num(iqr, 12) },
        { label: "Outliers (1.5 × IQR)", value: outliers.length ? outliers.slice(0, 8).map((x) => num(x)).join(", ") + (outliers.length > 8 ? " …" : "") : "None" },
        { label: "Skewness (sample G1)", value: Number.isFinite(sk.G1) ? num(sk.G1, 6) : "n/a" },
        { label: "Skewness (population g1)", value: Number.isFinite(sk.g1) ? num(sk.g1, 6) : "n/a" },
        { label: "Excess kurtosis (G2)", value: Number.isFinite(kt) ? num(kt, 6) : "n/a" },
      ],
      steps: [
        `Sorted: ${shown}`,
        `Mean = sum / n = ${num(total, 12)} / ${n} = ${num(m, 12)}`,
        n % 2 ? `n is odd, so the median is value #${half + 1} = ${num(med, 12)}` : `n is even, so the median is the average of values #${half} and #${half + 1} = (${num(s[half - 1])} + ${num(s[half])}) / 2 = ${num(med, 12)}`,
        `Quartiles: ${methodNote} Q1 = ${num(q1, 12)}, Q3 = ${num(q3, 12)}`,
        `Outlier fences: Q1 − 1.5 × IQR = ${num(lowFence, 10)}, Q3 + 1.5 × IQR = ${num(highFence, 10)}`,
      ],
      notes: ["Quartile conventions differ between textbooks and software, so Q1, Q3 and IQR can change with the method. The mean, median and mode do not."],
    };
  },
};

export default function Tool() {
  return <FormulaTool spec={spec} />;
}

"use client";

import { FormulaTool, fixed, num, type FormulaSpec } from "@/components/tools/engines/FormulaTool";

const spec: FormulaSpec = {
  lead: (
    <>
      Declining-balance model: the car loses the same percentage of its remaining value each year. <strong>Value after n years = price × (1 − r)ⁿ</strong>.
    </>
  ),
  modes: [
    { id: "schedule", label: "Yearly schedule", fields: ["price", "rate", "first", "years"] },
    { id: "derive", label: "Find the rate", fields: ["price", "now", "age", "years"] },
  ],
  fields: [
    { id: "price", label: "Purchase price", type: "number", gt: 0 },
    { id: "rate", label: "Annual depreciation rate", type: "number", suffix: "%", min: 0, max: 99, placeholder: "15" },
    { id: "first", label: "Extra first-year drop", type: "number", suffix: "%", optional: true, min: 0, max: 99, hint: "Optional: new cars often lose more in year one. Replaces the rate for year 1." },
    { id: "now", label: "Value today", type: "number", gt: 0 },
    { id: "age", label: "Age of the car", type: "number", suffix: "years", gt: 0 },
    { id: "years", label: "Years to show", type: "number", integer: true, min: 1, max: 30 },
  ],
  defaults: { years: "8" },
  example: { __mode: "schedule", price: "32000", rate: "15", first: "20", years: "8" },
  compute: (v) => {
    const price = v.num("price") as number;
    const years = v.num("years") as number;
    let r: number;
    let first: number;
    const steps: string[] = [];
    if (v.mode === "derive") {
      const now = v.num("now") as number;
      const age = v.num("age") as number;
      if (now >= price) return "Today's value should be lower than the purchase price for a depreciation rate.";
      r = 1 - (now / price) ** (1 / age);
      first = r;
      steps.push(`r = 1 − (value ÷ price)^(1 ÷ age) = 1 − (${num(now)} ÷ ${num(price)})^(1 ÷ ${num(age)}) = ${num(r * 100, 5)}%`);
    } else {
      r = (v.num("rate") as number) / 100;
      first = v.num("first") !== null ? (v.num("first") as number) / 100 : r;
      steps.push(`Year 1 value = ${num(price)} × (1 − ${num(first, 4)}) = ${fixed(price * (1 - first))}`, `Later years: value × (1 − ${num(r, 4)})`);
    }
    const rows: (string | number)[][] = [];
    let value = price;
    for (let y = 1; y <= years; y++) {
      const rate = y === 1 ? first : r;
      const loss = value * rate;
      value -= loss;
      rows.push([y, fixed(value), fixed(loss), fixed(price - value), `${num(((price - value) / price) * 100, 4)}%`]);
    }
    const end = value;
    const halfLife = r > 0 ? Math.log(0.5) / Math.log(1 - r) : Infinity;
    return {
      outputs: [
        { label: `Value after ${years} year${years === 1 ? "" : "s"}`, value: fixed(end), primary: true, note: `${num((end / price) * 100, 4)}% of the purchase price remains` },
        { label: "Total depreciation", value: fixed(price - end) },
        { label: "Annual rate", value: `${num(r * 100, 4)}%` },
        { label: "Average loss per year", value: fixed((price - end) / years) },
        { label: "Years to lose half (at the annual rate)", value: Number.isFinite(halfLife) ? num(halfLife, 3) : "never" },
      ],
      steps,
      table: { caption: "Depreciation schedule", columns: ["Year", "Value at year end", "Loss that year", "Total lost", "Total lost %"], rows },
      notes: ["Real resale values depend on mileage, condition, model demand and the market. Treat this as an estimate."],
    };
  },
};

export default function Tool() {
  return <FormulaTool spec={spec} />;
}

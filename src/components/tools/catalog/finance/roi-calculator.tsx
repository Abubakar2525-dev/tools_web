"use client";

import { FormulaTool, num, type FormulaOutput, type FormulaSpec, type UnitOption } from "@/components/tools/engines/FormulaTool";
import { roi } from "./lib/growth";
import { money, pct } from "./lib/money";
import { currencyField } from "./ui";

const timeUnits: UnitOption[] = [
  { value: "y", label: "years", factor: 1 },
  { value: "m", label: "months", factor: 1 / 12 },
  { value: "d", label: "days", factor: 1 / 365.25 },
];

const spec: FormulaSpec = {
  fields: [
    { id: "cost", label: "Amount invested", type: "number", gt: 0, placeholder: "10000", hint: "Include fees and other costs." },
    { id: "value", label: "Amount returned", type: "number", min: 0, placeholder: "13500", hint: "Final value plus any income received." },
    { id: "time", label: "Holding period", type: "number", gt: 0, optional: true, units: timeUnits, hint: "Needed for the annualized return." },
    currencyField(),
  ],
  defaults: { cost: "10000", value: "13500", time: "3" },
  example: { cost: "2500", value: "3100", time: "18", "time:unit": "m" },
  compute: (v) => {
    const c = v.str("currency");
    const m = (n: number) => money(n, c);
    const cost = v.num("cost") as number;
    const value = v.num("value") as number;
    const years = v.num("time");
    const r = roi(cost, value, years);
    const outputs: FormulaOutput[] = [
      { label: "Return on investment", value: pct(r.roiPct), primary: true, note: r.gain >= 0 ? "Gain on the amount invested." : "Loss on the amount invested." },
      { label: r.gain >= 0 ? "Net gain" : "Net loss", value: m(Math.abs(r.gain)) },
      { label: "Value multiple", value: `${num(value / cost, 4)}×` },
    ];
    const steps = [`ROI = (${m(value)} − ${m(cost)}) ÷ ${m(cost)} × 100 = ${pct(r.roiPct)}`];
    if (r.cagrPct !== null && years) {
      outputs.push({ label: "Annualized return (CAGR)", value: pct(r.cagrPct) });
      steps.push(`CAGR = (${m(value)} ÷ ${m(cost)})^(1 ÷ ${num(years, 6)}) − 1 = ${pct(r.cagrPct)}`);
    }
    return {
      outputs,
      steps,
      notes: [
        years && years < 1
          ? "Periods under a year are annualized by compounding, which can make short-term results look extreme."
          : "ROI ignores timing; compare investments of different lengths with the annualized return.",
      ],
    };
  },
};

export default function Tool() {
  return <FormulaTool spec={spec} />;
}

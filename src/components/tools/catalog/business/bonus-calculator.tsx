"use client";

import { FormulaTool, fixed, num, type FormulaSpec } from "@/components/tools/engines/FormulaTool";

const spec: FormulaSpec = {
  modes: [
    { id: "percent", label: "% of salary", fields: ["salary", "pct", "tax"] },
    { id: "target", label: "Target bonus", fields: ["salary", "target", "individual", "company", "tax"] },
    { id: "grossup", label: "Gross up a net bonus", fields: ["net", "tax"] },
  ],
  fields: [
    { id: "salary", label: "Annual base salary", type: "number", min: 0, placeholder: "85000" },
    { id: "pct", label: "Bonus", type: "number", suffix: "%", min: 0, max: 1000, placeholder: "10" },
    { id: "target", label: "Target bonus", type: "number", suffix: "%", min: 0, max: 1000, hint: "Share of salary paid when everything lands on target.", placeholder: "15" },
    { id: "individual", label: "Individual performance", type: "number", suffix: "%", min: 0, max: 500, hint: "100% means on target; 120% means above.", placeholder: "100" },
    { id: "company", label: "Company performance", type: "number", suffix: "%", min: 0, max: 500, hint: "Payout factor from company results; 100% if not used.", placeholder: "100" },
    { id: "net", label: "Net bonus you want to pay", type: "number", min: 0, placeholder: "5000" },
    {
      id: "tax",
      label: "Withholding on the bonus",
      type: "number",
      suffix: "%",
      min: 0,
      max: 99.99,
      optional: true,
      hint: "Combined tax and payroll withholding on supplemental pay, e.g. 22% US federal plus state and FICA.",
    },
  ],
  defaults: { individual: "100", company: "100" },
  example: { salary: "85000", pct: "10", target: "15", individual: "110", company: "90", net: "5000", tax: "29.65" },
  compute: (v) => {
    const t = (v.num("tax") ?? 0) / 100;
    if (v.mode === "grossup") {
      const net = v.num("net");
      if (net === null) return null;
      const gross = net / (1 - t);
      return {
        outputs: [
          { label: "Gross bonus to pay", value: fixed(gross), primary: true, note: `so the employee receives ${fixed(net)} after ${num(t * 100)}% withholding` },
          { label: "Withheld", value: fixed(gross - net) },
          { label: "Net received", value: fixed(net) },
        ],
        steps: [`Gross = net ÷ (1 − withholding) = ${fixed(net)} ÷ (1 − ${num(t)}) = ${fixed(gross)}`, `Check: ${fixed(gross)} × ${num(t)} = ${fixed(gross - net)} withheld`],
        notes: ["Grossing up at a flat rate is exact only when the whole bonus is withheld at that one rate. Progressive brackets or caps (such as the Social Security wage base) change the result."],
      };
    }
    const salary = v.num("salary");
    if (salary === null) return null;
    let gross: number;
    let steps: string[];
    if (v.mode === "percent") {
      const p = v.num("pct");
      if (p === null) return null;
      gross = (salary * p) / 100;
      steps = [`Bonus = ${fixed(salary)} × ${num(p)}% = ${fixed(gross)}`];
    } else {
      const target = v.num("target");
      const ind = v.num("individual");
      const co = v.num("company");
      if (target === null || ind === null || co === null) return null;
      const targetAmt = (salary * target) / 100;
      gross = (targetAmt * ind * co) / 10000;
      steps = [
        `Target amount = ${fixed(salary)} × ${num(target)}% = ${fixed(targetAmt)}`,
        `Bonus = ${fixed(targetAmt)} × ${num(ind)}% × ${num(co)}% = ${fixed(gross)}`,
      ];
    }
    const net = gross * (1 - t);
    if (t > 0) steps.push(`Net = ${fixed(gross)} × (1 − ${num(t)}) = ${fixed(net)}`);
    return {
      outputs: [
        { label: "Gross bonus", value: fixed(gross), primary: true, note: `${num((gross / (salary || 1)) * 100, 4)}% of base salary` },
        { label: "Net after withholding", value: fixed(net) },
        { label: "Withheld", value: fixed(gross - net) },
        { label: "Total cash pay this year", value: fixed(salary + gross) },
      ],
      steps,
    };
  },
};

export default function Tool() {
  return <FormulaTool spec={spec} />;
}

"use client";

import { FormulaTool, type FormulaSpec, type UnitOption } from "@/components/tools/engines/FormulaTool";
import { money, pct } from "./lib/money";
import { rentAffordability } from "./lib/simple";
import { currencyField, HBars } from "./ui";

const incomeUnits: UnitOption[] = [
  { value: "y", label: "per year", factor: 1 },
  { value: "m", label: "per month", factor: 12 },
];

const spec: FormulaSpec = {
  fields: [
    { id: "income", label: "Gross income (before tax)", type: "number", gt: 0, units: incomeUnits, placeholder: "60000", hint: "Combine incomes if renting together." },
    { id: "debts", label: "Monthly debt payments", type: "number", min: 0, optional: true, hint: "Car loan, student loan, card minimums." },
    { id: "share", label: "Rent share of income", type: "number", suffix: "%", gt: 0, max: 100, placeholder: "30" },
    { id: "dti", label: "Max rent + debts share", type: "number", suffix: "%", gt: 0, max: 100, placeholder: "36", hint: "A common debt-to-income ceiling." },
    { id: "rent", label: "Rent you are considering", type: "number", min: 0, optional: true },
    currencyField(),
  ],
  defaults: { income: "60000", debts: "0", share: "30", dti: "36" },
  example: { income: "5200", "income:unit": "m", debts: "450", share: "30", dti: "36", rent: "1650" },
  compute: (v) => {
    const c = v.str("currency");
    const m = (n: number) => money(n, c, 0);
    const annual = v.num("income") as number;
    const debts = v.num("debts") ?? 0;
    const share = v.num("share") as number;
    const dti = v.num("dti") as number;
    const r = rentAffordability(annual, debts, share, dti);
    const rent = v.num("rent");
    const notes: string[] = [];
    if (rent !== null && rent > 0) {
      const fails = [rent > r.byPercent ? `${share}% rule` : null, rent > r.by40x ? "40x rule" : null, rent > r.byDti ? "debt limit" : null].filter(Boolean);
      notes.push(
        fails.length
          ? `${m(rent)} is above the ${fails.join(", ")}. It takes ${pct((rent / r.monthly) * 100, 1)} of gross monthly income; landlords using 40x would want ${m(rent * 40)} a year.`
          : `${m(rent)} fits all three guidelines (${pct((rent / r.monthly) * 100, 1)} of gross monthly income).`,
      );
    }
    if (r.byDti === 0) notes.push("Your debt payments already reach the debt limit, so that rule leaves nothing for rent.");
    return {
      outputs: [
        { label: "Comfortable rent (strictest rule)", value: m(r.recommended), primary: true, note: "The lowest of the three guidelines below." },
        { label: `${share}% of income rule`, value: m(r.byPercent) },
        { label: "40x rent rule", value: m(r.by40x) },
        { label: "Debt-to-income limit", value: m(r.byDti) },
        { label: "Gross monthly income", value: m(r.monthly) },
      ],
      steps: [
        `${share}% rule: ${m(r.monthly)} × ${share}% = ${m(r.byPercent)}`,
        `40x rule: yearly income ÷ 40 = ${m(annual)} ÷ 40 = ${m(r.by40x)}`,
        `Debt limit: ${m(r.monthly)} × ${dti}% − ${m(debts)} debts = ${m(r.byDti)}`,
      ],
      notes,
      visual: (
        <HBars
          title="Maximum monthly rent by rule"
          items={[
            { label: `${share}% of income`, value: r.byPercent },
            { label: "40x rule", value: r.by40x },
            { label: "Debt-to-income limit", value: r.byDti },
            ...(rent !== null && rent > 0 ? [{ label: "Rent you entered", value: rent }] : []),
          ]}
          format={m}
        />
      ),
    };
  },
};

export default function Tool() {
  return <FormulaTool spec={spec} />;
}

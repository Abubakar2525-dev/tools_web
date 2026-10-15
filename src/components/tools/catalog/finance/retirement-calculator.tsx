"use client";

import { FormulaTool, type FormulaOutput, type FormulaSpec } from "@/components/tools/engines/FormulaTool";
import { retirement } from "./lib/growth";
import { money, pct, round } from "./lib/money";
import { currencyField, HBars, ScrollTable } from "./ui";

const spec: FormulaSpec = {
  fields: [
    { id: "age", label: "Current age", type: "number", integer: true, min: 15, max: 90, placeholder: "35" },
    { id: "retire", label: "Retirement age", type: "number", integer: true, min: 30, max: 100, placeholder: "65" },
    { id: "savings", label: "Retirement savings today", type: "number", min: 0, placeholder: "60000" },
    { id: "monthly", label: "Monthly contribution", type: "number", min: 0, placeholder: "600" },
    { id: "raise", label: "Yearly increase in contribution", type: "number", suffix: "%", min: 0, max: 20, optional: true },
    { id: "ret", label: "Expected annual return", type: "number", suffix: "%", min: -10, max: 20, placeholder: "6" },
    { id: "income", label: "Desired yearly income in retirement", type: "number", min: 0, placeholder: "50000", hint: "In today's money." },
    { id: "other", label: "Other yearly income (pension, Social Security)", type: "number", min: 0, optional: true, hint: "In today's money." },
    { id: "infl", label: "Inflation", type: "number", suffix: "%", min: 0, max: 20, placeholder: "2.5" },
    { id: "wr", label: "Safe withdrawal rate", type: "number", suffix: "%", gt: 0, max: 20, placeholder: "4", hint: "Share of savings withdrawn in the first year of retirement." },
    currencyField(),
  ],
  defaults: { age: "35", retire: "65", savings: "60000", monthly: "600", raise: "0", ret: "6", income: "50000", other: "18000", infl: "2.5", wr: "4" },
  example: { age: "28", retire: "62", savings: "15000", monthly: "450", raise: "2", ret: "6.5", income: "45000", other: "15000", infl: "2.5", wr: "4" },
  compute: (v) => {
    const c = v.str("currency");
    const m = (n: number) => money(n, c, 0);
    const age = v.num("age") as number;
    const retireAge = v.num("retire") as number;
    if (retireAge <= age) return "Retirement age must be later than your current age.";
    const r = retirement({
      currentAge: age,
      retireAge,
      savings: v.num("savings") as number,
      monthly: v.num("monthly") as number,
      contribGrowthPct: v.num("raise") ?? 0,
      returnPct: v.num("ret") as number,
      inflationPct: v.num("infl") as number,
      incomeToday: v.num("income") as number,
      otherIncomeToday: v.num("other") ?? 0,
      withdrawalPct: v.num("wr") as number,
    });
    const onTrack = r.gap <= 0;
    const outputs: FormulaOutput[] = [
      {
        label: onTrack ? "Projected surplus at retirement" : "Projected shortfall at retirement",
        value: m(Math.abs(r.gap)),
        primary: true,
        note: onTrack ? "Your projected savings meet the target." : `Save about ${m(r.extraMonthly)} more each month to close the gap.`,
      },
      { label: `Projected savings at ${retireAge}`, value: m(r.projected) },
      { label: "Target nest egg", value: m(r.target) },
      { label: "In today's money", value: `${m(r.projectedReal)} vs ${m(r.targetReal)}` },
      { label: "Sustainable yearly income", value: `${m(r.sustainableIncomeReal)} today` },
      { label: "Years to retirement", value: String(r.years) },
    ];
    const raw = r.rows.map((y) => [age + y.year, y.contributions, y.interest, y.balance]);
    return {
      outputs,
      steps: [
        `Income needed from savings = ${m(v.num("income") as number)} − ${m(v.num("other") ?? 0)} = ${m(Math.max(0, (v.num("income") as number) - (v.num("other") ?? 0)))} a year (today)`,
        `Inflated to retirement: × (1 + ${v.num("infl")}%)^${r.years} = × ${r.inflFactor.toFixed(4)}`,
        `Target = yearly need ÷ ${v.num("wr")}% = ${m(r.target)}`,
        `Projected savings (monthly compounding at ${v.num("ret")}%/12) = ${m(r.projected)}`,
      ],
      notes: [
        "The withdrawal rate rule is a rough guide from historical studies, not a guarantee. Taxes, fees and market swings are not modelled.",
      ],
      visual: (
        <div className="space-y-5">
          <HBars
            title="Savings at retirement compared with the target"
            items={[
              { label: "Projected savings", value: r.projected },
              { label: "Target nest egg", value: r.target },
            ]}
            format={m}
          />
          <p className="sr-only">{`Projected ${m(r.projected)} versus target ${m(r.target)}: ${pct((r.projected / Math.max(1, r.target)) * 100, 0)} of the goal.`}</p>
          <ScrollTable
            caption="Savings by age"
            columns={["Age", "Contributions", "Growth", "Balance"]}
            rows={raw.map((row) => row.map((n, i) => (i === 0 ? n : m(n))))}
            csvRows={raw.map((row) => row.map((n, i) => (i === 0 ? n : round(n, 2))))}
            csvName="retirement-projection.csv"
          />
        </div>
      ),
    };
  },
};

export default function Tool() {
  return <FormulaTool spec={spec} />;
}

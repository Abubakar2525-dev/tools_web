"use client";

import { FormulaTool, type FormulaSpec } from "@/components/tools/engines/FormulaTool";
import { compoundGrowth } from "./lib/growth";
import { money, pct, round } from "./lib/money";
import { currencyField, ScrollTable, StackedBars } from "./ui";

const spec: FormulaSpec = {
  fields: [
    { id: "initial", label: "Initial investment", type: "number", min: 0, placeholder: "10000" },
    { id: "monthly", label: "Monthly contribution", type: "number", min: 0, placeholder: "500" },
    { id: "increase", label: "Yearly increase in contribution", type: "number", suffix: "%", min: 0, max: 50, optional: true, hint: "For example, raise contributions 3% a year with your pay." },
    { id: "rate", label: "Expected annual return", type: "number", suffix: "%", min: -50, max: 50, placeholder: "7" },
    { id: "years", label: "Years invested", type: "number", gt: 0, max: 80, placeholder: "20" },
    { id: "inflation", label: "Inflation rate", type: "number", suffix: "%", min: 0, max: 50, optional: true, placeholder: "2.5" },
    {
      id: "timing",
      label: "Contributions are made at the",
      type: "select",
      options: [
        { value: "end", label: "End of each month" },
        { value: "start", label: "Start of each month" },
      ],
    },
    currencyField(),
  ],
  defaults: { initial: "10000", monthly: "500", increase: "0", rate: "7", years: "20", inflation: "2.5" },
  example: { initial: "25000", monthly: "800", increase: "3", rate: "6.5", years: "25", inflation: "3" },
  compute: (v) => {
    const c = v.str("currency");
    const m = (n: number) => money(n, c);
    const rate = v.num("rate") as number;
    const years = v.num("years") as number;
    const infl = v.num("inflation") ?? 0;
    // Annual return converted to an equivalent monthly rate: (1 + R)^(1/12) − 1.
    const res = compoundGrowth({
      principal: v.num("initial") as number,
      annualPct: rate,
      years,
      compounding: 1,
      contribution: v.num("monthly") as number,
      contribPerYear: 12,
      atStart: v.str("timing") === "start",
      contribGrowthPct: v.num("increase") ?? 0,
    });
    const last = res.years[res.years.length - 1];
    if (!last) return "Use at least one month.";
    const deflate = (n: number, y: number) => n / Math.pow(1 + infl / 100, y);
    const real = deflate(res.final, years);
    const raw = res.years.map((y) => [y.year, y.contributions, y.interest, y.balance, deflate(y.balance, y.year)]);
    return {
      outputs: [
        { label: "Future value", value: m(res.final), primary: true, note: infl > 0 ? `Worth about ${m(real)} in today's money at ${infl}% inflation.` : undefined },
        { label: "Total contributed", value: m(last.totalContributed) },
        { label: "Investment growth", value: m(last.totalInterest) },
        { label: "Inflation-adjusted value", value: m(real) },
        { label: "Growth share of final value", value: pct((last.totalInterest / res.final) * 100, 1) },
      ],
      steps: [
        `Monthly growth factor = (1 + ${rate}%)^(1/12) = ${Math.pow(1 + rate / 100, 1 / 12).toFixed(6)}`,
        `Contributions rise ${v.num("increase") ?? 0}% at the start of each new year.`,
        infl > 0 ? `Real value = ${m(res.final)} ÷ (1 + ${infl}%)^${years} = ${m(real)}` : "No inflation adjustment applied.",
      ],
      notes: ["Returns are assumed constant every year. Real markets vary, so treat this as a planning estimate, not a forecast."],
      visual: (
        <div className="space-y-5">
          <StackedBars
            title="Value by year"
            series={["Contributed", "Growth"]}
            data={res.years.map((y) => ({ label: String(y.year), values: [y.totalContributed, Math.max(0, y.totalInterest)] }))}
            formatMax={m}
            summary={`After ${years} years you contribute ${m(last.totalContributed)} and growth adds ${m(last.totalInterest)}, for ${m(res.final)} in total.`}
          />
          <ScrollTable
            caption="Year-by-year projection"
            columns={["Year", "Contributed", "Growth", "Balance", "In today's money"]}
            rows={raw.map((row) => row.map((n, i) => (i === 0 ? n : m(n))))}
            csvRows={raw.map((row) => row.map((n, i) => (i === 0 ? n : round(n, 2))))}
            csvName="investment-projection.csv"
          />
        </div>
      ),
    };
  },
};

export default function Tool() {
  return <FormulaTool spec={spec} />;
}

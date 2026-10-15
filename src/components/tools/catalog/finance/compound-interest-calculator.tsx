"use client";

import { FormulaTool, type FormulaSpec } from "@/components/tools/engines/FormulaTool";
import { compoundGrowth, effectiveAnnual, type Compounding } from "./lib/growth";
import { money, pct, round } from "./lib/money";
import { currencyField, ScrollTable, StackedBars } from "./ui";

const spec: FormulaSpec = {
  fields: [
    { id: "principal", label: "Starting amount", type: "number", min: 0, placeholder: "10000" },
    { id: "rate", label: "Annual interest rate", type: "number", suffix: "%", min: -50, max: 100, placeholder: "6" },
    { id: "years", label: "Years", type: "number", gt: 0, max: 100, placeholder: "10" },
    {
      id: "comp",
      label: "Compounding",
      type: "select",
      options: [
        { value: "12", label: "Monthly" },
        { value: "1", label: "Annually" },
        { value: "2", label: "Semiannually" },
        { value: "4", label: "Quarterly" },
        { value: "52", label: "Weekly" },
        { value: "365", label: "Daily" },
        { value: "0", label: "Continuously" },
      ],
    },
    { id: "contrib", label: "Regular contribution", type: "number", min: 0, optional: true, placeholder: "200" },
    {
      id: "freq",
      label: "Contribution frequency",
      type: "select",
      options: [
        { value: "12", label: "Monthly" },
        { value: "26", label: "Every 2 weeks" },
        { value: "52", label: "Weekly" },
        { value: "4", label: "Quarterly" },
        { value: "1", label: "Annually" },
      ],
    },
    {
      id: "timing",
      label: "Contributions are made at the",
      type: "select",
      options: [
        { value: "end", label: "End of each period" },
        { value: "start", label: "Start of each period" },
      ],
    },
    currencyField(),
  ],
  defaults: { principal: "10000", rate: "6", years: "10", contrib: "200" },
  example: { principal: "5000", rate: "7", years: "20", comp: "1", contrib: "150", freq: "12", timing: "start" },
  compute: (v) => {
    const c = v.str("currency");
    const m = (n: number) => money(n, c);
    const comp = Number(v.str("comp")) as Compounding;
    const rate = v.num("rate") as number;
    const years = v.num("years") as number;
    const contribution = v.num("contrib") ?? 0;
    const perYear = Number(v.str("freq"));
    const res = compoundGrowth({
      principal: v.num("principal") as number,
      annualPct: rate,
      years,
      compounding: comp,
      contribution,
      contribPerYear: contribution > 0 ? perYear : 12,
      atStart: v.str("timing") === "start",
    });
    const last = res.years[res.years.length - 1];
    if (!last) return "The period is too short to calculate. Use at least one contribution period.";
    const raw = res.years.map((y) => [y.year, y.contributions, y.interest, y.totalInterest, y.balance]);
    return {
      outputs: [
        { label: `Balance after ${years} years`, value: m(res.final), primary: true },
        { label: "Total contributed", value: m(last.totalContributed) },
        { label: "Total interest", value: m(last.totalInterest) },
        { label: "Effective annual rate", value: pct(effectiveAnnual(rate, comp) * 100, 3) },
      ],
      steps: [
        comp === 0 ? `Continuous compounding: growth factor per year = e^${rate / 100}` : `Rate per compounding period = ${rate}% ÷ ${comp}`,
        contribution > 0
          ? `Each contribution period grows by the matching effective rate; deposits are added at the ${v.str("timing") === "start" ? "start (annuity due)" : "end"} of each period.`
          : `Balance = P × (1 + r/n)^(n × t)`,
        `Final balance = ${m(last.totalContributed)} contributed + ${m(last.totalInterest)} interest = ${m(res.final)}`,
      ],
      visual: (
        <div className="space-y-5">
          <StackedBars
            title="Balance by year"
            series={["Contributions", "Interest"]}
            data={res.years.map((y) => ({ label: String(y.year), values: [y.totalContributed, Math.max(0, y.totalInterest)] }))}
            formatMax={m}
            summary={`The balance grows from ${m(v.num("principal") as number)} to ${m(res.final)}. Interest makes up ${pct((last.totalInterest / res.final) * 100, 1)} of the final balance.`}
          />
          <ScrollTable
            caption="Year-by-year growth"
            columns={["Year", "Contributions", "Interest", "Total interest", "Balance"]}
            rows={raw.map((row) => row.map((n, i) => (i === 0 ? n : m(n))))}
            csvRows={raw.map((row) => row.map((n, i) => (i === 0 ? n : round(n, 2))))}
            csvName="compound-interest.csv"
          />
        </div>
      ),
    };
  },
};

export default function Tool() {
  return <FormulaTool spec={spec} />;
}

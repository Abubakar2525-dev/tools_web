"use client";

import { FormulaTool, type FormulaOutput, type FormulaSpec, type UnitOption } from "@/components/tools/engines/FormulaTool";
import { amortize, byYear } from "./lib/loans";
import { money, round } from "./lib/money";
import { currencyField, ScrollTable, StackedBars } from "./ui";

const termUnits: UnitOption[] = [
  { value: "y", label: "years", factor: 12 },
  { value: "m", label: "months", factor: 1 },
];

const spec: FormulaSpec = {
  fields: [
    { id: "principal", label: "Loan amount", type: "number", gt: 0, placeholder: "25000" },
    { id: "rate", label: "Annual interest rate", type: "number", suffix: "%", min: 0, max: 100, placeholder: "9" },
    { id: "term", label: "Loan term", type: "number", gt: 0, max: 600, units: termUnits, placeholder: "5" },
    { id: "extra", label: "Extra payment each month", type: "number", min: 0, optional: true, hint: "Goes straight to principal." },
    currencyField(),
    {
      id: "view",
      label: "Schedule view",
      type: "select",
      options: [
        { value: "year", label: "Yearly summary" },
        { value: "month", label: "Every payment" },
      ],
    },
  ],
  defaults: { principal: "25000", rate: "9", term: "5" },
  example: { principal: "500000", rate: "8.5", term: "20", extra: "2000", currency: "INR" },
  compute: (v) => {
    const c = v.str("currency");
    const m = (n: number) => money(n, c);
    const P = v.num("principal") as number;
    const rate = v.num("rate") as number;
    const months = Math.round(v.num("term") as number);
    if (months < 1) return "The term must be at least one month.";
    const extra = v.num("extra") ?? 0;
    const base = amortize(P, rate, months);
    const sched = extra > 0 ? amortize(P, rate, months, extra) : base;

    const outputs: FormulaOutput[] = [
      { label: "Monthly payment (EMI)", value: m(base.payment), primary: true, note: extra > 0 ? `Plus ${m(extra)} extra toward principal.` : undefined },
      { label: "Total interest", value: m(sched.totalInterest) },
      { label: "Total paid", value: m(sched.totalPaid) },
    ];
    if (extra > 0) {
      const saved = base.months - sched.months;
      outputs.push(
        { label: "Paid off in", value: `${Math.floor(sched.months / 12)} yr ${sched.months % 12} mo` },
        { label: "Interest saved", value: m(base.totalInterest - sched.totalInterest) },
        { label: "Time saved", value: `${Math.floor(saved / 12)} yr ${saved % 12} mo` },
      );
    }
    const r = rate / 100 / 12;
    const years = byYear(sched.rows);
    const monthly = v.str("view") === "month";
    const columns = monthly
      ? ["Payment", "Interest", "Principal", ...(extra > 0 ? ["Extra"] : []), "Balance"]
      : ["Year", "Interest", "Principal", ...(extra > 0 ? ["Extra"] : []), "End balance"];
    const raw = monthly
      ? sched.rows.map((x) => [x.period, x.interest, x.principal, ...(extra > 0 ? [x.extra] : []), x.balance])
      : years.map((y) => [y.year, y.interest, y.principal, ...(extra > 0 ? [y.extra] : []), y.balance]);
    const rows = raw.map((row) => row.map((n, i) => (i === 0 ? n : m(n))));
    const csvRows = raw.map((row) => row.map((n, i) => (i === 0 ? n : round(n, 2))));

    return {
      outputs,
      steps: [
        `Monthly rate r = ${rate}% ÷ 12 = ${r.toFixed(6)}`,
        rate === 0
          ? `EMI = P ÷ n = ${m(P)} ÷ ${months} = ${m(base.payment)}`
          : `EMI = P × r × (1+r)^n ÷ ((1+r)^n − 1) = ${m(P)} × ${r.toFixed(6)} × ${Math.pow(1 + r, months).toFixed(6)} ÷ ${(Math.pow(1 + r, months) - 1).toFixed(6)} = ${m(base.payment)}`,
        `Total interest = total paid − principal = ${m(sched.totalPaid)} − ${m(P)} = ${m(sched.totalInterest)}`,
      ],
      visual: (
        <div className="space-y-5">
          <StackedBars
            title="Principal and interest paid each year"
            series={["Principal (incl. extra)", "Interest"]}
            data={years.map((y) => ({ label: `Y${y.year}`, values: [y.principal + y.extra, y.interest] }))}
            formatMax={m}
            summary={`Over ${years.length} years you repay ${m(P)} of principal and ${m(sched.totalInterest)} of interest. Interest is ${m(years[0]?.interest ?? 0)} in year 1 and ${m(years[years.length - 1]?.interest ?? 0)} in the final year.`}
          />
          <ScrollTable caption={monthly ? "Amortization schedule" : "Amortization by year"} columns={columns} rows={rows} csvRows={csvRows} csvName="amortization-schedule.csv" />
        </div>
      ),
    };
  },
};

export default function Tool() {
  return <FormulaTool spec={spec} />;
}

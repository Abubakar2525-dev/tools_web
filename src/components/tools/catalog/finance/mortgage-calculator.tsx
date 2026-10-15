"use client";

import { FormulaTool, type FormulaOutput, type FormulaSpec } from "@/components/tools/engines/FormulaTool";
import { byYear, mortgage } from "./lib/loans";
import { money, pct, round } from "./lib/money";
import { currencyField, HBars, ScrollTable } from "./ui";

const ym = (n: number) => `${Math.floor(n / 12)} yr ${n % 12} mo`;

const spec: FormulaSpec = {
  fields: [
    { id: "price", label: "Home price", type: "number", gt: 0, placeholder: "400000" },
    { id: "down", label: "Down payment", type: "number", min: 0, placeholder: "20" },
    {
      id: "downType",
      label: "Down payment is",
      type: "select",
      options: [
        { value: "pct", label: "Percent of price" },
        { value: "amt", label: "An amount" },
      ],
    },
    { id: "rate", label: "Interest rate", type: "number", suffix: "%", min: 0, max: 30, placeholder: "6.5" },
    { id: "years", label: "Loan term", type: "number", suffix: "yr", gt: 0, max: 50, placeholder: "30" },
    { id: "tax", label: "Property tax per year", type: "number", min: 0, optional: true },
    { id: "ins", label: "Home insurance per year", type: "number", min: 0, optional: true },
    { id: "hoa", label: "HOA fees per month", type: "number", min: 0, optional: true },
    { id: "pmi", label: "PMI rate per year", type: "number", suffix: "%", min: 0, max: 5, optional: true, hint: "Charged when you put down less than 20%. Often 0.3% to 1.5% of the loan." },
    { id: "extra", label: "Extra principal per month", type: "number", min: 0, optional: true },
    currencyField(),
    { id: "pmi78", label: "Cancel PMI when the balance reaches 78% of the home price", type: "checkbox", hint: "Unchecked means PMI is paid for the life of the loan." },
  ],
  defaults: { price: "400000", down: "10", rate: "6.5", years: "30", tax: "4800", ins: "1500", hoa: "0", pmi: "0.5", pmi78: true },
  example: { price: "350000", down: "35000", downType: "amt", rate: "6.25", years: "30", tax: "4200", ins: "1350", hoa: "75", pmi: "0.6", extra: "250", pmi78: true },
  compute: (v) => {
    const c = v.str("currency");
    const m = (n: number) => money(n, c);
    const price = v.num("price") as number;
    const downRaw = v.num("down") as number;
    const down = v.str("downType") === "pct" ? (price * downRaw) / 100 : downRaw;
    if (down >= price) return "The down payment covers the whole price, so there is no loan to calculate.";
    const r = mortgage({
      homePrice: price,
      downPayment: down,
      annualRatePct: v.num("rate") as number,
      years: v.num("years") as number,
      propertyTaxYear: v.num("tax") ?? 0,
      insuranceYear: v.num("ins") ?? 0,
      pmiRatePct: v.num("pmi") ?? 0,
      pmiTo78: v.bool("pmi78"),
      hoaMonth: v.num("hoa") ?? 0,
      extraMonth: v.num("extra") ?? 0,
    });
    const extra = v.num("extra") ?? 0;
    const outputs: FormulaOutput[] = [
      { label: "Monthly payment", value: m(r.firstMonthTotal), primary: true, note: r.pmiMonth > 0 && r.pmiMonths < r.withExtra.months ? `Drops to ${m(r.afterPmiTotal)} once PMI ends after ${ym(r.pmiMonths)}.` : undefined },
      { label: "Principal and interest", value: m(r.pi) },
      { label: "Loan amount", value: m(r.loan) },
      { label: "Loan-to-value", value: pct(r.ltvPct, 1) },
      { label: "Total interest", value: m(r.withExtra.totalInterest) },
      { label: "Total PMI", value: m(r.totalPmi) },
    ];
    if (extra > 0) {
      outputs.push(
        { label: "Paid off in", value: ym(r.withExtra.months) },
        { label: "Interest saved", value: m(r.base.totalInterest - r.withExtra.totalInterest) },
        { label: "Time saved", value: ym(r.base.months - r.withExtra.months) },
      );
    }
    const years = byYear(r.withExtra.rows);
    const raw = years.map((y) => [y.year, y.interest, y.principal + y.extra, y.balance]);
    const parts = [
      { label: "Principal and interest", value: r.pi },
      { label: "Property tax", value: r.taxMonth },
      { label: "Home insurance", value: r.insMonth },
      { label: "PMI", value: r.pmiMonth },
      { label: "HOA", value: r.hoaMonth },
    ].filter((p) => p.value > 0);
    return {
      outputs,
      steps: [
        `Loan = ${m(price)} − ${m(down)} down = ${m(r.loan)}`,
        `P&I = level payment on ${m(r.loan)} at ${v.num("rate")}% over ${v.num("years")} years = ${m(r.pi)}`,
        `Tax ${m(r.taxMonth)} + insurance ${m(r.insMonth)} + PMI ${m(r.pmiMonth)} + HOA ${m(r.hoaMonth)} per month`,
        `Monthly total = ${m(r.firstMonthTotal)}`,
      ],
      notes: r.ltvPct <= 80 && (v.num("pmi") ?? 0) > 0 ? ["With 20% or more down, PMI is not charged."] : undefined,
      visual: (
        <div className="space-y-5">
          <HBars title="What makes up the first monthly payment" items={parts.map((p) => ({ ...p, note: pct((p.value / r.firstMonthTotal) * 100, 0) }))} format={m} />
          <ScrollTable
            caption="Amortization by year"
            columns={["Year", "Interest", "Principal", "End balance"]}
            rows={raw.map((row) => row.map((n, i) => (i === 0 ? n : m(n))))}
            csvRows={raw.map((row) => row.map((n, i) => (i === 0 ? n : round(n, 2))))}
            csvName="mortgage-schedule.csv"
          />
        </div>
      ),
    };
  },
};

export default function Tool() {
  return <FormulaTool spec={spec} />;
}

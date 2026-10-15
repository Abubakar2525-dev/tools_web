"use client";

import { FormulaTool, type FormulaSpec } from "@/components/tools/engines/FormulaTool";
import { sip } from "./lib/growth";
import { CURRENCY_OPTIONS, money, pct, round } from "./lib/money";
import { ScrollTable, StackedBars } from "./ui";

// INR first: SIPs are most common in India.
const options = [...CURRENCY_OPTIONS.filter((o) => o.value === "INR"), ...CURRENCY_OPTIONS.filter((o) => o.value !== "INR")];

const sipSpec: FormulaSpec = {
  lead: (
    <p>
      Assumes you invest at the start of each month and returns compound monthly at the annual rate ÷ 12, the convention most SIP
      calculators use.
    </p>
  ),
  fields: [
    { id: "monthly", label: "Monthly SIP amount", type: "number", gt: 0, placeholder: "10000" },
    { id: "rate", label: "Expected annual return", type: "number", suffix: "%", min: 0, max: 50, placeholder: "12" },
    { id: "years", label: "Investment period", type: "number", suffix: "yr", integer: true, min: 1, max: 60, placeholder: "10" },
    { id: "step", label: "Yearly step-up", type: "number", suffix: "%", min: 0, max: 100, optional: true, hint: "Raise the SIP by this % every 12 months." },
    { id: "currency", label: "Currency", type: "select", options },
  ],
  defaults: { monthly: "10000", rate: "12", years: "10", step: "0" },
  example: { monthly: "5000", rate: "11", years: "15", step: "10" },
  compute: (v) => {
    const c = v.str("currency");
    const m = (n: number) => money(n, c, 0);
    const P = v.num("monthly") as number;
    const rate = v.num("rate") as number;
    const years = v.num("years") as number;
    const step = v.num("step") ?? 0;
    const r = sip(P, rate, years, step);
    const flat = step > 0 ? sip(P, rate, years, 0) : null;
    const i = rate / 1200;
    const n = years * 12;
    const raw = r.rows.map((y) => [y.year, y.monthly, y.invested, y.value - y.invested, y.value]);
    return {
      outputs: [
        { label: "Estimated value", value: m(r.value), primary: true },
        { label: "Amount invested", value: m(r.invested) },
        { label: "Estimated gains", value: m(r.gains) },
        { label: "Gains share", value: pct((r.gains / r.value) * 100, 1) },
        ...(flat ? [{ label: "Extra from step-up", value: m(r.value - flat.value) }] : []),
        ...(step > 0 ? [{ label: "Final monthly SIP", value: m(r.rows[r.rows.length - 1]?.monthly ?? P) }] : []),
      ],
      steps:
        step > 0
          ? [
              `Monthly rate i = ${rate}% ÷ 12 = ${i.toFixed(6)}`,
              `Each month: value = (value + SIP) × (1 + i); SIP rises ${step}% after every 12 instalments.`,
              `After ${n} instalments: ${m(r.value)}`,
            ]
          : [
              `Monthly rate i = ${rate}% ÷ 12 = ${i.toFixed(6)}, n = ${n}`,
              `FV = P × ((1 + i)^n − 1) ÷ i × (1 + i)`,
              `FV = ${m(P)} × ${(i === 0 ? n : (Math.pow(1 + i, n) - 1) / i).toFixed(4)} × ${(1 + i).toFixed(6)} = ${m(r.value)}`,
            ],
      notes: ["Mutual fund returns are not guaranteed and vary year to year. This shows the arithmetic for a constant return."],
      visual: (
        <div className="space-y-5">
          <StackedBars
            title="Invested amount and gains by year"
            series={["Invested", "Gains"]}
            data={r.rows.map((y) => ({ label: String(y.year), values: [y.invested, Math.max(0, y.value - y.invested)] }))}
            formatMax={m}
            summary={`You invest ${m(r.invested)} over ${years} years; at ${rate}% a year it grows to about ${m(r.value)}.`}
          />
          <ScrollTable
            caption="Year-by-year SIP growth"
            columns={["Year", "Monthly SIP", "Invested", "Gains", "Value"]}
            rows={raw.map((row) => row.map((x, k) => (k === 0 ? x : m(x))))}
            csvRows={raw.map((row) => row.map((x, k) => (k === 0 ? x : round(x, 2))))}
            csvName="sip-projection.csv"
          />
        </div>
      ),
    };
  },
};

export default function Tool() {
  return <FormulaTool spec={sipSpec} />;
}

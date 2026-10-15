"use client";

import { FormulaTool, num, type FormulaSpec } from "@/components/tools/engines/FormulaTool";
import { adjustForInflation, CPI_FIRST_YEAR, CPI_LAST_FULL_YEAR, CPI_PARTIAL, CPI_RETRIEVED } from "./lib/cpi";
import { money, pct } from "./lib/money";
import { currencyField } from "./ui";

const yearOptions = [
  { value: String(CPI_PARTIAL.year), label: `${CPI_PARTIAL.year} (Jan to ${CPI_PARTIAL.throughMonth.slice(0, 3)}, partial)` },
  ...Array.from({ length: CPI_LAST_FULL_YEAR - CPI_FIRST_YEAR + 1 }, (_, i) => {
    const y = String(CPI_LAST_FULL_YEAR - i);
    return { value: y, label: y };
  }),
];

const spec: FormulaSpec = {
  modes: [
    { id: "cpi", label: "US CPI history", fields: ["amount", "from", "to"] },
    { id: "custom", label: "Custom rate", fields: ["amount2", "rate", "years", "direction", "currency"] },
  ],
  fields: [
    { id: "amount", label: "Amount in US dollars", type: "number", min: 0, placeholder: "100" },
    { id: "from", label: "From year", type: "select", options: yearOptions },
    { id: "to", label: "To year", type: "select", options: yearOptions },
    { id: "amount2", label: "Amount", type: "number", min: 0, placeholder: "1000" },
    { id: "rate", label: "Average inflation per year", type: "number", suffix: "%", min: -20, max: 1000, placeholder: "3" },
    { id: "years", label: "Number of years", type: "number", gt: 0, max: 200, placeholder: "10" },
    {
      id: "direction",
      label: "Direction",
      type: "select",
      options: [
        { value: "future", label: "Future cost of today's amount" },
        { value: "past", label: "Today's value of a future amount" },
      ],
    },
    currencyField(),
  ],
  defaults: { amount: "100", from: "2000", to: String(CPI_LAST_FULL_YEAR), amount2: "1000", rate: "3", years: "10" },
  example: { amount: "50000", from: "1990", to: String(CPI_LAST_FULL_YEAR) },
  compute: (v) => {
    if (v.mode === "cpi") {
      const amount = v.num("amount") as number;
      const from = Number(v.str("from"));
      const to = Number(v.str("to"));
      const r = adjustForInflation(amount, from, to);
      if (!r) return "No CPI data for that year.";
      const usd = (n: number) => money(n, "USD");
      const partial = from === CPI_PARTIAL.year || to === CPI_PARTIAL.year;
      return {
        outputs: [
          { label: `${usd(amount)} in ${from} is worth about this in ${to}`, value: usd(r.value), primary: true },
          { label: to >= from ? "Cumulative inflation" : "Cumulative change", value: pct(r.cumulativePct) },
          { label: "Average per year", value: from === to ? "n/a" : pct(r.avgAnnualPct) },
          { label: `CPI ${from}`, value: num(r.fromIndex, 6) },
          { label: `CPI ${to}`, value: num(r.toIndex, 6) },
        ],
        steps: [
          `Value = amount × CPI(${to}) ÷ CPI(${from})`,
          `= ${usd(amount)} × ${r.toIndex} ÷ ${r.fromIndex} = ${usd(r.value)}`,
          from === to ? "Same year: no change." : `Average rate = (${r.ratio.toFixed(5)})^(1/${Math.abs(to - from)}) − 1 = ${pct(r.avgAnnualPct)}`,
        ],
        notes: [
          `Source: U.S. Bureau of Labor Statistics CPI-U annual averages via FRED (series CPIAUCNS), retrieved ${CPI_RETRIEVED}.`,
          ...(partial ? [`${CPI_PARTIAL.year} uses the average of January to ${CPI_PARTIAL.throughMonth} only, so it will change as new months are published.`] : []),
          ...(from === 2025 || to === 2025 ? ["BLS did not publish an October 2025 index; the 2025 average uses the 11 published months."] : []),
        ],
      };
    }
    const c = v.str("currency");
    const m = (n: number) => money(n, c);
    const amount = v.num("amount2") as number;
    const rate = v.num("rate") as number;
    const years = v.num("years") as number;
    const factor = Math.pow(1 + rate / 100, years);
    const future = v.str("direction") === "future";
    const result = future ? amount * factor : amount / factor;
    return {
      outputs: [
        { label: future ? `Cost after ${years} years` : "Value in today's money", value: m(result), primary: true },
        { label: "Cumulative inflation", value: pct((factor - 1) * 100) },
        { label: "Purchasing power kept", value: pct((1 / factor) * 100) },
      ],
      steps: [
        `Factor = (1 + ${rate}%)^${years} = ${factor.toFixed(6)}`,
        future ? `${m(amount)} × ${factor.toFixed(6)} = ${m(result)}` : `${m(amount)} ÷ ${factor.toFixed(6)} = ${m(result)}`,
      ],
    };
  },
};

export default function Tool() {
  return <FormulaTool spec={spec} />;
}

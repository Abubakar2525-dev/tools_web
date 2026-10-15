"use client";

import { FormulaTool, type FormulaSpec } from "@/components/tools/engines/FormulaTool";
import { compoundGrowth, savingsNeeded } from "./lib/growth";
import { money, round } from "./lib/money";
import { currencyField, ScrollTable } from "./ui";

/** Whole months from today until an ISO date (yyyy-mm-dd). */
function monthsUntil(iso: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  const now = new Date();
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const d = Number(m[3]);
  return (y - now.getFullYear()) * 12 + (mo - now.getMonth()) - (d < now.getDate() ? 1 : 0);
}

const spec: FormulaSpec = {
  modes: [
    { id: "date", label: "By a date", fields: ["goal", "current", "rate", "date", "currency"] },
    { id: "months", label: "In a number of months", fields: ["goal", "current", "rate", "months", "currency"] },
  ],
  fields: [
    { id: "goal", label: "Savings goal", type: "number", gt: 0, placeholder: "15000" },
    { id: "current", label: "Already saved", type: "number", min: 0, placeholder: "2000" },
    { id: "rate", label: "Interest rate (APR)", type: "number", suffix: "%", min: 0, max: 50, placeholder: "4", hint: "Compounded monthly. Use 0 for a plain savings jar." },
    { id: "date", label: "Target date", type: "date" },
    { id: "months", label: "Months to save", type: "number", integer: true, min: 1, max: 1200, placeholder: "24" },
    currencyField(),
  ],
  defaults: { goal: "15000", current: "2000", rate: "4", months: "24" },
  example: { __mode: "months", goal: "8000", current: "500", rate: "3.5", months: "18" },
  compute: (v) => {
    const c = v.str("currency");
    const m = (n: number) => money(n, c);
    const goal = v.num("goal") as number;
    const current = v.num("current") as number;
    const rate = v.num("rate") as number;
    const months = v.mode === "date" ? monthsUntil(v.str("date")) : (v.num("months") as number);
    if (months === null) return null;
    if (months < 1) return "Pick a target date at least one month from today.";
    const pmt = savingsNeeded(goal, current, rate, months);
    const sim = compoundGrowth({ principal: current, annualPct: rate, years: months / 12, compounding: 12, contribution: pmt, contribPerYear: 12, atStart: false });
    const last = sim.years[sim.years.length - 1];
    const deposits = pmt * months;
    const interest = sim.final - current - deposits;
    const raw = sim.years.map((y) => [y.year, y.contributions, y.interest, y.balance]);
    return {
      outputs: [
        {
          label: "Save each month",
          value: m(pmt),
          primary: true,
          note: pmt === 0 ? "Your current savings reach the goal with interest alone." : `For ${months} months, deposited at the end of each month.`,
        },
        { label: "Total you deposit", value: m(deposits) },
        { label: "Interest earned", value: m(Math.max(0, interest)) },
        { label: "Balance at the end", value: m(last?.balance ?? current) },
        { label: "Weekly equivalent", value: m((pmt * 12) / 52) },
      ],
      steps: [
        `Monthly rate i = ${rate}% ÷ 12 = ${(rate / 1200).toFixed(6)}, n = ${months}`,
        `Current savings grow to ${m(current * Math.pow(1 + rate / 1200, months))}`,
        `Payment = (goal − grown savings) × i ÷ ((1 + i)^n − 1) = ${m(pmt)}`,
      ],
      visual: (
        <ScrollTable
          caption="Savings by year"
          columns={["Year", "Deposits", "Interest", "Balance"]}
          rows={raw.map((row) => row.map((n, i) => (i === 0 ? n : m(n))))}
          csvRows={raw.map((row) => row.map((n, i) => (i === 0 ? n : round(n, 2))))}
          csvName="savings-plan.csv"
        />
      ),
    };
  },
};

export default function Tool() {
  return <FormulaTool spec={spec} />;
}

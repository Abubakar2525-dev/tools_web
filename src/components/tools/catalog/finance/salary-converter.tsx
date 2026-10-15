"use client";

import { FormulaTool, num, type FormulaSpec } from "@/components/tools/engines/FormulaTool";
import { money } from "./lib/money";
import { fromAnnual, toAnnual, type PayPeriod } from "./lib/simple";
import { currencyField } from "./ui";

const periods: { value: PayPeriod; label: string }[] = [
  { value: "hourly", label: "Hourly" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "biweekly", label: "Every 2 weeks (26 a year)" },
  { value: "semimonthly", label: "Twice a month (24 a year)" },
  { value: "monthly", label: "Monthly" },
  { value: "annual", label: "Yearly" },
];

const spec: FormulaSpec = {
  fields: [
    { id: "amount", label: "Pay amount", type: "number", gt: 0, placeholder: "25" },
    { id: "period", label: "Paid", type: "select", options: periods },
    { id: "hours", label: "Hours per week", type: "number", gt: 0, max: 168, placeholder: "40" },
    { id: "days", label: "Days per week", type: "number", gt: 0, max: 7, placeholder: "5" },
    { id: "weeks", label: "Paid weeks per year", type: "number", gt: 0, max: 53, placeholder: "52", hint: "52 if holidays are paid; lower it for unpaid time off." },
    currencyField(),
  ],
  defaults: { amount: "25", hours: "40", days: "5", weeks: "52" },
  example: { amount: "58000", period: "annual", hours: "37.5", days: "5", weeks: "52", currency: "GBP" },
  compute: (v) => {
    const c = v.str("currency");
    const m = (n: number) => money(n, c);
    const w = { hoursPerWeek: v.num("hours") as number, daysPerWeek: v.num("days") as number, weeksPerYear: v.num("weeks") as number };
    if (w.daysPerWeek > 7) return "A week has at most 7 days.";
    const from = v.str("period") as PayPeriod;
    const annual = toAnnual(v.num("amount") as number, from, w);
    const rows = periods.map((p) => [p.label, m(fromAnnual(annual, p.value, w))]);
    return {
      outputs: [
        { label: "Yearly pay", value: m(annual), primary: true },
        { label: "Monthly", value: m(fromAnnual(annual, "monthly", w)) },
        { label: "Weekly", value: m(fromAnnual(annual, "weekly", w)) },
        { label: "Daily", value: m(fromAnnual(annual, "daily", w)) },
        { label: "Hourly", value: m(fromAnnual(annual, "hourly", w)) },
        { label: "Hours per year", value: num(w.hoursPerWeek * w.weeksPerYear) },
      ],
      steps: [
        `Yearly = ${from === "hourly" ? `hourly × ${w.hoursPerWeek} h × ${w.weeksPerYear} wk` : from === "daily" ? `daily × ${w.daysPerWeek} d × ${w.weeksPerYear} wk` : from === "weekly" ? `weekly × ${w.weeksPerYear}` : from === "biweekly" ? "biweekly × 26" : from === "semimonthly" ? "semimonthly × 24" : from === "monthly" ? "monthly × 12" : "as entered"} = ${m(annual)}`,
        "Other periods divide the yearly figure the same way.",
      ],
      table: { caption: "Pay for every period (before tax)", columns: ["Period", "Pay"], rows },
      notes: ["Biweekly and twice-monthly amounts use 26 and 24 pay dates a year regardless of the weeks setting."],
    };
  },
};

export default function Tool() {
  return <FormulaTool spec={spec} />;
}

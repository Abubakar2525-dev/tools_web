"use client";

import { FormulaTool, fixed, num, type FormulaSpec } from "@/components/tools/engines/FormulaTool";
import { projectMrr } from "./lib/calc";

const spec: FormulaSpec = {
  modes: [
    { id: "sales", label: "Units × price", fields: ["units", "price", "discount", "returns"] },
    { id: "mrr", label: "Subscription MRR", fields: ["start", "arpu", "newPer", "growth", "churn", "months"] },
  ],
  fields: [
    { id: "units", label: "Units sold", type: "number", min: 0, placeholder: "1200" },
    { id: "price", label: "Price per unit", type: "number", min: 0, placeholder: "29.99" },
    { id: "discount", label: "Average discount", type: "number", suffix: "%", min: 0, max: 100, optional: true },
    { id: "returns", label: "Returns and refunds", type: "number", suffix: "%", min: 0, max: 100, optional: true, hint: "Share of gross sales refunded." },
    { id: "start", label: "Customers today", type: "number", min: 0, placeholder: "250" },
    { id: "arpu", label: "Average revenue per customer per month", type: "number", min: 0, placeholder: "39" },
    { id: "newPer", label: "New customers next month", type: "number", min: 0, placeholder: "40" },
    { id: "growth", label: "Growth in new sign-ups per month", type: "number", suffix: "%", min: -100, max: 100, optional: true, hint: "0% keeps new sign-ups flat." },
    { id: "churn", label: "Monthly churn", type: "number", suffix: "%", min: 0, max: 100, placeholder: "3", hint: "Share of customers who cancel each month." },
    { id: "months", label: "Months to project", type: "number", integer: true, min: 1, max: 60, placeholder: "12" },
  ],
  defaults: { months: "12" },
  example: { units: "1200", price: "29.99", discount: "5", returns: "2", start: "250", arpu: "39", newPer: "40", growth: "2", churn: "3", months: "12" },
  compute: (v) => {
    if (v.mode === "sales") {
      const units = v.num("units");
      const price = v.num("price");
      if (units === null || price === null) return null;
      const gross = units * price;
      const disc = (gross * (v.num("discount") ?? 0)) / 100;
      const afterDisc = gross - disc;
      const ret = (afterDisc * (v.num("returns") ?? 0)) / 100;
      const net = afterDisc - ret;
      return {
        outputs: [
          { label: "Net revenue", value: fixed(net), primary: true },
          { label: "Gross revenue", value: fixed(gross) },
          { label: "Discounts", value: fixed(disc) },
          { label: "Returns", value: fixed(ret) },
          { label: "Net price per unit", value: units > 0 ? fixed(net / units) : "0.00" },
        ],
        steps: [
          `Gross = ${num(units)} × ${fixed(price)} = ${fixed(gross)}`,
          `After discounts = ${fixed(gross)} − ${fixed(disc)} = ${fixed(afterDisc)}`,
          `Net = ${fixed(afterDisc)} − returns ${fixed(ret)} = ${fixed(net)}`,
        ],
      };
    }
    const start = v.num("start");
    const arpu = v.num("arpu");
    const newPer = v.num("newPer");
    const churn = v.num("churn");
    const months = v.num("months");
    if (start === null || arpu === null || newPer === null || churn === null || months === null) return null;
    const growth = v.num("growth") ?? 0;
    const rows = projectMrr(start, arpu, newPer, growth, churn, months);
    const last = rows[rows.length - 1];
    const startMrr = start * arpu;
    const notes: string[] = ["Customer counts are kept fractional in the projection and rounded for display."];
    if (growth === 0 && churn > 0) notes.push(`With flat sign-ups the customer base levels off near ${num(newPer / (churn / 100), 6)} customers (new per month ÷ churn rate).`);
    return {
      outputs: [
        { label: `MRR after ${months} months`, value: fixed(last.mrr), primary: true, note: `ARR run rate ${fixed(last.mrr * 12)}` },
        { label: "MRR today", value: fixed(startMrr) },
        { label: "Customers at the end", value: num(Math.round(last.customers)) },
        { label: "Total revenue in the period", value: fixed(last.cumulative) },
        { label: "MRR growth", value: startMrr > 0 ? `${num(((last.mrr - startMrr) / startMrr) * 100, 4)}%` : "n/a" },
      ],
      steps: [
        "Each month: customers = previous − previous × churn + new sign-ups",
        `New sign-ups in month m = ${num(newPer)} × (1 + ${num(growth)}%)^(m − 1)`,
        `MRR = customers × ${fixed(arpu)}`,
      ],
      table: {
        caption: "Monthly projection",
        columns: ["Month", "New", "Churned", "Customers", "MRR", "Cumulative revenue"],
        rows: rows.map((r) => [r.month, num(Math.round(r.newCustomers)), num(Math.round(r.churned)), num(Math.round(r.customers)), fixed(r.mrr), fixed(r.cumulative)]),
      },
      notes,
    };
  },
};

export default function Tool() {
  return <FormulaTool spec={spec} />;
}

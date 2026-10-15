"use client";

import { FormulaTool, fixed, num, type FormulaSpec } from "@/components/tools/engines/FormulaTool";

function summary(cost: number, price: number, steps: string[]) {
  const profit = price - cost;
  const margin = price !== 0 ? (profit / price) * 100 : NaN;
  const markup = cost !== 0 ? (profit / cost) * 100 : NaN;
  return {
    outputs: [
      { label: "Gross margin", value: Number.isFinite(margin) ? `${num(margin, 6)}%` : "undefined", primary: true, note: `Profit ${fixed(profit)} on a price of ${fixed(price)}` },
      { label: "Selling price", value: fixed(price) },
      { label: "Cost", value: fixed(cost) },
      { label: "Profit", value: fixed(profit) },
      { label: "Markup", value: Number.isFinite(markup) ? `${num(markup, 6)}%` : "undefined" },
    ],
    steps: [
      ...steps,
      `Profit = price − cost = ${fixed(price)} − ${fixed(cost)} = ${fixed(profit)}`,
      `Margin = profit ÷ price = ${fixed(profit)} ÷ ${fixed(price)} = ${Number.isFinite(margin) ? num(margin, 6) : "undefined"}%`,
      `Markup = profit ÷ cost = ${fixed(profit)} ÷ ${fixed(cost)} = ${Number.isFinite(markup) ? num(markup, 6) : "undefined"}%`,
    ],
    notes: profit < 0 ? ["The price is below cost, so margin and markup are negative (a loss on each sale)."] : undefined,
  };
}

const spec: FormulaSpec = {
  modes: [
    { id: "cp", label: "Cost and price", fields: ["cost", "price"] },
    { id: "cm", label: "Cost and margin", fields: ["cost", "margin"] },
    { id: "pm", label: "Price and margin", fields: ["price", "margin"] },
    { id: "ck", label: "Cost and markup", fields: ["cost", "markup"] },
  ],
  fields: [
    { id: "cost", label: "Cost per unit", type: "number", min: 0, placeholder: "40" },
    { id: "price", label: "Selling price per unit", type: "number", min: 0, placeholder: "65" },
    { id: "margin", label: "Gross margin", type: "number", suffix: "%", max: 99.9999, placeholder: "35" },
    { id: "markup", label: "Markup", type: "number", suffix: "%", min: -100, placeholder: "50" },
  ],
  example: { cost: "40", price: "65", margin: "35", markup: "50" },
  compute: (v) => {
    const cost = v.num("cost");
    const price = v.num("price");
    const margin = v.num("margin");
    const markup = v.num("markup");
    if (v.mode === "cp") {
      if (cost === null || price === null) return null;
      if (price === 0) return "Enter a selling price above zero to get a margin.";
      return summary(cost, price, []);
    }
    if (v.mode === "cm") {
      if (cost === null || margin === null) return null;
      const p = cost / (1 - margin / 100);
      return summary(cost, p, [`Price = cost ÷ (1 − margin) = ${fixed(cost)} ÷ (1 − ${num(margin / 100)}) = ${fixed(p)}`]);
    }
    if (v.mode === "pm") {
      if (price === null || margin === null) return null;
      const c = price * (1 - margin / 100);
      return summary(c, price, [`Cost = price × (1 − margin) = ${fixed(price)} × (1 − ${num(margin / 100)}) = ${fixed(c)}`]);
    }
    if (cost === null || markup === null) return null;
    const p = cost * (1 + markup / 100);
    if (p === 0) return "With this markup the price is zero, so the margin is undefined.";
    return summary(cost, p, [`Price = cost × (1 + markup) = ${fixed(cost)} × (1 + ${num(markup / 100)}) = ${fixed(p)}`]);
  },
};

export default function Tool() {
  return <FormulaTool spec={spec} />;
}

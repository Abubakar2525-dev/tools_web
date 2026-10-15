"use client";

import { FormulaTool, fixed, num, type FormulaSpec } from "@/components/tools/engines/FormulaTool";
import { marginFromMarkup, markupFromMargin } from "./lib/calc";

const COMMON = [10, 20, 25, 33.3333, 50, 75, 100, 150, 200];

const conversionTable = {
  caption: "Common markups and the margin they give",
  columns: ["Markup", "Margin", "Price on a cost of 100"],
  rows: COMMON.map((m) => [`${num(m, 4)}%`, `${num(marginFromMarkup(m), 4)}%`, fixed(100 * (1 + m / 100))]),
};

const spec: FormulaSpec = {
  modes: [
    { id: "price", label: "Price from markup", fields: ["cost", "markup"] },
    { id: "find", label: "Markup from price", fields: ["cost", "price"] },
    { id: "m2g", label: "Markup to margin", fields: ["markup"] },
    { id: "g2m", label: "Margin to markup", fields: ["margin"] },
  ],
  fields: [
    { id: "cost", label: "Cost per unit", type: "number", gt: 0, placeholder: "80" },
    { id: "markup", label: "Markup", type: "number", suffix: "%", min: -99.9999, placeholder: "25" },
    { id: "price", label: "Selling price per unit", type: "number", min: 0, placeholder: "100" },
    { id: "margin", label: "Gross margin", type: "number", suffix: "%", max: 99.9999, placeholder: "20" },
  ],
  example: { cost: "80", markup: "25", price: "100", margin: "20" },
  compute: (v) => {
    const cost = v.num("cost");
    const markup = v.num("markup");
    const price = v.num("price");
    const margin = v.num("margin");
    if (v.mode === "price") {
      if (cost === null || markup === null) return null;
      const p = cost * (1 + markup / 100);
      return {
        outputs: [
          { label: "Selling price", value: fixed(p), primary: true },
          { label: "Profit per unit", value: fixed(p - cost) },
          { label: "Equivalent margin", value: `${num(marginFromMarkup(markup), 6)}%` },
        ],
        steps: [`Price = ${fixed(cost)} × (1 + ${num(markup)}%) = ${fixed(p)}`, `Margin = markup ÷ (100 + markup) = ${num(markup)} ÷ ${num(100 + markup)} = ${num(marginFromMarkup(markup), 6)}%`],
        table: conversionTable,
      };
    }
    if (v.mode === "find") {
      if (cost === null || price === null) return null;
      const mk = ((price - cost) / cost) * 100;
      return {
        outputs: [
          { label: "Markup", value: `${num(mk, 6)}%`, primary: true },
          { label: "Profit per unit", value: fixed(price - cost) },
          { label: "Equivalent margin", value: price > 0 ? `${num(((price - cost) / price) * 100, 6)}%` : "undefined" },
        ],
        steps: [`Markup = (price − cost) ÷ cost = (${fixed(price)} − ${fixed(cost)}) ÷ ${fixed(cost)} = ${num(mk, 6)}%`],
        table: conversionTable,
      };
    }
    if (v.mode === "m2g") {
      if (markup === null) return null;
      return {
        outputs: [{ label: "Gross margin", value: `${num(marginFromMarkup(markup), 6)}%`, primary: true }],
        steps: [`Margin = markup ÷ (100 + markup) × 100 = ${num(markup)} ÷ ${num(100 + markup)} × 100 = ${num(marginFromMarkup(markup), 6)}%`],
        table: conversionTable,
      };
    }
    if (margin === null) return null;
    return {
      outputs: [{ label: "Markup", value: `${num(markupFromMargin(margin), 6)}%`, primary: true }],
      steps: [`Markup = margin ÷ (100 − margin) × 100 = ${num(margin)} ÷ ${num(100 - margin)} × 100 = ${num(markupFromMargin(margin), 6)}%`],
      table: conversionTable,
    };
  },
};

export default function Tool() {
  return <FormulaTool spec={spec} />;
}

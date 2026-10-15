"use client";

import { FormulaTool, type FormulaSpec } from "@/components/tools/engines/FormulaTool";
import { money, pct } from "./lib/money";
import { originalFromSale, salePrice, stackedDiscount } from "./lib/simple";
import { currencyField } from "./ui";

const spec: FormulaSpec = {
  modes: [
    { id: "sale", label: "Sale price", fields: ["price", "discount", "currency"] },
    { id: "original", label: "Original price", fields: ["sale", "discount", "currency"] },
    { id: "percent", label: "Percent off", fields: ["price", "sale", "currency"] },
    { id: "stacked", label: "Stacked discounts", fields: ["price", "d1", "d2", "d3", "currency"] },
  ],
  fields: [
    { id: "price", label: "Original price", type: "number", min: 0, placeholder: "80" },
    { id: "sale", label: "Sale price", type: "number", min: 0, placeholder: "60" },
    { id: "discount", label: "Discount", type: "number", suffix: "%", min: 0, max: 100, placeholder: "25" },
    { id: "d1", label: "First discount", type: "number", suffix: "%", min: 0, max: 100, placeholder: "20" },
    { id: "d2", label: "Second discount", type: "number", suffix: "%", min: 0, max: 100, placeholder: "10" },
    { id: "d3", label: "Third discount", type: "number", suffix: "%", min: 0, max: 100, optional: true },
    currencyField(),
  ],
  defaults: { price: "80", discount: "25", d1: "20", d2: "10" },
  example: { price: "120", discount: "30", sale: "84", d1: "20", d2: "15", d3: "5" },
  compute: (v) => {
    const c = v.str("currency");
    const m = (n: number) => money(n, c);
    if (v.mode === "sale") {
      const price = v.num("price") as number;
      const d = v.num("discount") as number;
      const r = salePrice(price, d);
      return {
        outputs: [
          { label: "Sale price", value: m(r.sale), primary: true, note: `You pay ${pct(100 - d)} of the original price.` },
          { label: "You save", value: m(r.savings) },
          { label: "Discount", value: pct(d) },
        ],
        steps: [`Savings = ${m(price)} × ${d}% = ${m(r.savings)}`, `Sale price = ${m(price)} − ${m(r.savings)} = ${m(r.sale)}`],
      };
    }
    if (v.mode === "original") {
      const sale = v.num("sale") as number;
      const d = v.num("discount") as number;
      const r = originalFromSale(sale, d);
      if (!r) return "A 100% discount makes the original price impossible to work out.";
      return {
        outputs: [
          { label: "Original price", value: m(r.original), primary: true },
          { label: "Amount discounted", value: m(r.savings) },
        ],
        steps: [`Original = sale ÷ (1 − discount) = ${m(sale)} ÷ ${(1 - d / 100).toFixed(4)} = ${m(r.original)}`],
      };
    }
    if (v.mode === "percent") {
      const price = v.num("price") as number;
      const sale = v.num("sale") as number;
      if (price <= 0) return "The original price must be greater than 0.";
      const off = ((price - sale) / price) * 100;
      return {
        outputs: [
          { label: off >= 0 ? "Percent off" : "Price increase", value: pct(Math.abs(off)), primary: true },
          { label: off >= 0 ? "You save" : "Extra cost", value: m(Math.abs(price - sale)) },
        ],
        steps: [`Percent off = (${m(price)} − ${m(sale)}) ÷ ${m(price)} × 100 = ${pct(off)}`],
      };
    }
    const price = v.num("price") as number;
    const ds = [v.num("d1"), v.num("d2"), v.num("d3")].filter((x): x is number => x !== null);
    const r = stackedDiscount(price, ds);
    const naive = ds.reduce((a, b) => a + b, 0);
    return {
      outputs: [
        { label: "Final price", value: m(r.final), primary: true },
        { label: "Total saved", value: m(r.savings) },
        { label: "Effective discount", value: pct(r.effectivePct) },
      ],
      steps: r.steps.map((s, i) => `Step ${i + 1}: ${m(s.before)} − ${s.pct}% = ${m(s.after)}`),
      notes: [
        `Stacked discounts apply one after another, so ${ds.map((d) => `${d}%`).join(" + ")} is ${pct(r.effectivePct)} off, not ${pct(Math.min(100, naive))}.`,
      ],
    };
  },
};

export default function Tool() {
  return <FormulaTool spec={spec} />;
}

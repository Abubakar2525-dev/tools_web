"use client";

import { FormulaTool, num, type FormulaSpec, type UnitOption } from "@/components/tools/engines/FormulaTool";
import { money, pct } from "./lib/money";
import { simpleInterest } from "./lib/simple";
import { currencyField } from "./ui";

const timeUnits: UnitOption[] = [
  { value: "y", label: "years", factor: 1 },
  { value: "m", label: "months", factor: 1 / 12 },
  { value: "d", label: "days (365/yr)", factor: 1 / 365 },
];

const spec: FormulaSpec = {
  lead: (
    <p>
      Simple interest uses <strong>I = P × r × t</strong>: principal times annual rate times time in years. Pick the value you want
      to find.
    </p>
  ),
  modes: [
    { id: "i", label: "Interest", fields: ["p", "r", "t", "currency"] },
    { id: "p", label: "Principal", fields: ["i", "r", "t", "currency"] },
    { id: "r", label: "Rate", fields: ["i", "p", "t", "currency"] },
    { id: "t", label: "Time", fields: ["i", "p", "r", "currency"] },
  ],
  fields: [
    { id: "p", label: "Principal (P)", type: "number", gt: 0, placeholder: "5000" },
    { id: "i", label: "Interest earned (I)", type: "number", gt: 0, placeholder: "750" },
    { id: "r", label: "Annual rate (r)", type: "number", suffix: "%", gt: 0, placeholder: "5" },
    { id: "t", label: "Time (t)", type: "number", gt: 0, placeholder: "3", units: timeUnits },
    currencyField(),
  ],
  defaults: { p: "5000", r: "5", t: "3" },
  example: { p: "8000", i: "960", r: "4", t: "36", "t:unit": "m" },
  compute: (v) => {
    const c = v.str("currency");
    const m = (n: number) => money(n, c);
    const P = v.num("p");
    const I = v.num("i");
    const r = v.num("r");
    const t = v.num("t");
    if (v.mode === "i" && P !== null && r !== null && t !== null) {
      const res = simpleInterest.interest(P, r, t);
      return {
        outputs: [
          { label: "Interest", value: m(res), primary: true },
          { label: "Total amount (P + I)", value: m(P + res) },
          { label: "Interest per year", value: m((P * r) / 100) },
        ],
        steps: [`I = P × r × t = ${m(P)} × ${r / 100} × ${num(t, 6)} yr = ${m(res)}`, `A = P + I = ${m(P + res)}`],
      };
    }
    if (v.mode === "p" && I !== null && r !== null && t !== null) {
      const res = simpleInterest.principal(I, r, t);
      return {
        outputs: [
          { label: "Principal", value: m(res), primary: true },
          { label: "Total amount (P + I)", value: m(res + I) },
        ],
        steps: [`P = I ÷ (r × t) = ${m(I)} ÷ (${r / 100} × ${num(t, 6)}) = ${m(res)}`],
      };
    }
    if (v.mode === "r" && I !== null && P !== null && t !== null) {
      const res = simpleInterest.rate(I, P, t);
      return {
        outputs: [
          { label: "Annual rate", value: pct(res, 4), primary: true },
          { label: "Total amount (P + I)", value: m(P + I) },
        ],
        steps: [`r = I ÷ (P × t) = ${m(I)} ÷ (${m(P)} × ${num(t, 6)}) = ${num(res / 100, 6)} = ${pct(res, 4)}`],
      };
    }
    if (v.mode === "t" && I !== null && P !== null && r !== null) {
      const res = simpleInterest.time(I, P, r);
      return {
        outputs: [
          { label: "Time", value: `${num(res, 6)} years`, primary: true, note: `About ${num(res * 12, 4)} months or ${num(res * 365, 5)} days.` },
          { label: "Total amount (P + I)", value: m(P + I) },
        ],
        steps: [`t = I ÷ (P × r) = ${m(I)} ÷ (${m(P)} × ${r / 100}) = ${num(res, 6)} years`],
      };
    }
    return null;
  },
};

export default function Tool() {
  return <FormulaTool spec={spec} />;
}

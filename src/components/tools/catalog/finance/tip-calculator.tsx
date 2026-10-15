"use client";

import { FormulaTool, type FormulaSpec } from "@/components/tools/engines/FormulaTool";
import { money, pct } from "./lib/money";
import { tip } from "./lib/simple";
import { currencyField } from "./ui";

const spec: FormulaSpec = {
  fields: [
    { id: "bill", label: "Bill amount", type: "number", gt: 0, placeholder: "86.40" },
    { id: "tip", label: "Tip", type: "number", suffix: "%", min: 0, max: 100, placeholder: "18", hint: "Common choices: 15, 18, 20." },
    { id: "people", label: "Number of people", type: "number", integer: true, min: 1, max: 100, placeholder: "1" },
    currencyField(),
    {
      id: "round",
      label: "Round each share up to a whole amount",
      type: "checkbox",
      hint: "The extra goes to the tip, so the server gets slightly more.",
    },
  ],
  defaults: { tip: "18", people: "1" },
  example: { bill: "86.40", tip: "18", people: "3", round: true },
  compute: (v) => {
    const c = v.str("currency");
    const m = (n: number) => money(n, c);
    const bill = v.num("bill") as number;
    const p = v.num("tip") as number;
    const people = v.num("people") as number;
    const r = tip(bill, p, people, v.bool("round"));
    const exact = tip(bill, p, people, false);
    return {
      outputs: [
        { label: people > 1 ? "Each person pays" : "Total to pay", value: m(people > 1 ? r.perPerson : r.total), primary: true },
        { label: "Tip", value: m(r.tip) },
        { label: "Total with tip", value: m(r.total) },
        ...(people > 1 ? [{ label: "Tip per person", value: m(r.tipPerPerson) }] : []),
        ...(v.bool("round") ? [{ label: "Effective tip", value: pct(r.effectiveTipPct) }] : []),
      ],
      steps: [
        `Tip = ${m(bill)} × ${p}% = ${m(exact.tip)}`,
        `Total = ${m(bill)} + ${m(exact.tip)} = ${m(exact.total)}`,
        ...(people > 1 ? [`Per person = ${m(exact.total)} ÷ ${people} = ${m(exact.perPerson)}`] : []),
        ...(v.bool("round") ? [`Rounded up: ${m(r.perPerson)} each, total ${m(r.total)}`] : []),
      ],
      table: {
        caption: "Quick comparison for common tip rates",
        columns: ["Tip", "Tip amount", "Total", "Per person"],
        rows: [10, 15, 18, 20, 25].map((t) => {
          const x = tip(bill, t, people, v.bool("round"));
          return [`${t}%`, m(x.tip), m(x.total), m(x.perPerson)];
        }),
      },
    };
  },
};

export default function Tool() {
  return <FormulaTool spec={spec} />;
}

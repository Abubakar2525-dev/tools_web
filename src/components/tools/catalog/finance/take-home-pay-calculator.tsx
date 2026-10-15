"use client";

import { FormulaTool, type FormulaSpec } from "@/components/tools/engines/FormulaTool";
import { money, pct } from "./lib/money";
import { UK_TAX_YEAR, US_SS_WAGE_BASE, US_STANDARD_DEDUCTION, US_TAX_YEAR, ukTakeHome, usTakeHome, type UsStatus } from "./lib/tax";
import { HBars } from "./ui";

const spec: FormulaSpec = {
  lead: (
    <p>
      Estimate only. US: federal income tax and FICA for tax year {US_TAX_YEAR}, no state or local tax. UK: England, Wales and
      Northern Ireland income tax and employee National Insurance for {UK_TAX_YEAR}. Other deductions are not included.
    </p>
  ),
  modes: [
    { id: "us", label: `United States (${US_TAX_YEAR})`, fields: ["usGross", "status", "k401"] },
    { id: "uk", label: `United Kingdom (${UK_TAX_YEAR})`, fields: ["ukGross"] },
  ],
  fields: [
    { id: "usGross", label: "Gross yearly salary (USD)", type: "number", min: 0, placeholder: "75000" },
    {
      id: "status",
      label: "Filing status",
      type: "select",
      options: [
        { value: "single", label: "Single" },
        { value: "mfj", label: "Married filing jointly" },
        { value: "hoh", label: "Head of household" },
      ],
      hint: "Married filing jointly treats the salary as the household's only wage income.",
    },
    { id: "k401", label: "Traditional 401(k) contributions per year", type: "number", min: 0, optional: true, hint: "Lowers income tax, not Social Security or Medicare." },
    { id: "ukGross", label: "Gross yearly salary (GBP)", type: "number", min: 0, placeholder: "40000" },
  ],
  defaults: { usGross: "75000", ukGross: "40000" },
  example: { usGross: "120000", status: "mfj", k401: "8000", ukGross: "110000" },
  compute: (v) => {
    if (v.mode === "us") {
      const m = (n: number) => money(n, "USD");
      const gross = v.num("usGross") as number;
      const status = v.str("status") as UsStatus;
      const k401 = v.num("k401") ?? 0;
      if (k401 > gross) return "401(k) contributions cannot be more than the salary.";
      const r = usTakeHome(gross, status, k401);
      return {
        outputs: [
          { label: "Take-home pay per year", value: m(r.net), primary: true, note: `About ${m(r.net / 12)} a month or ${m(r.net / 26)} every two weeks.` },
          { label: "Federal income tax", value: m(r.federal) },
          { label: "Social Security", value: m(r.ss) },
          { label: "Medicare", value: m(r.medicare + r.addlMedicare) },
          { label: "Effective tax rate", value: pct(r.effectivePct, 1) },
          { label: "Marginal income tax rate", value: pct(r.marginal * 100, 0) },
        ],
        steps: [
          `Taxable income = ${m(gross)}${k401 ? ` − ${m(k401)} 401(k)` : ""} − ${m(US_STANDARD_DEDUCTION[status])} standard deduction = ${m(r.taxable)}`,
          ...r.brackets.map((b) => `${pct(b.rate * 100, 0)} on ${m(b.from)} to ${m(b.to)} = ${m(b.tax)}`),
          `Social Security = 6.2% × ${m(Math.min(gross, US_SS_WAGE_BASE))} (wage base ${m(US_SS_WAGE_BASE)}) = ${m(r.ss)}`,
          `Medicare = 1.45% × ${m(gross)} = ${m(r.medicare)}${r.addlMedicare ? ` + 0.9% additional = ${m(r.addlMedicare)}` : ""}`,
        ],
        table: {
          caption: "Take-home pay by period",
          columns: ["Period", "Gross", "Taxes", "Take-home"],
          rows: [
            ["Year", m(gross), m(r.totalTax), m(r.net)],
            ["Month", m(gross / 12), m(r.totalTax / 12), m(r.net / 12)],
            ["Every 2 weeks", m(gross / 26), m(r.totalTax / 26), m(r.net / 26)],
            ["Week", m(gross / 52), m(r.totalTax / 52), m(r.net / 52)],
          ],
        },
        notes: [
          `Sources: IRS Rev. Proc. 2025-32 (${US_TAX_YEAR} brackets and standard deduction), SSA (${US_TAX_YEAR} wage base), IRS Topics 751 and 560 (FICA rates). Excludes state and local income tax, credits, itemized deductions, health premiums and other payroll deductions.`,
          ...(k401 ? ["Take-home shown is after the 401(k) contribution leaves your paycheck."] : []),
        ],
        visual: (
          <HBars
            title="Where the salary goes"
            items={[
              { label: "Take-home", value: r.net, note: pct((r.net / Math.max(1, gross)) * 100, 1) },
              { label: "Federal income tax", value: r.federal, note: pct((r.federal / Math.max(1, gross)) * 100, 1) },
              { label: "Social Security and Medicare", value: r.ss + r.medicare + r.addlMedicare, note: pct(((r.ss + r.medicare + r.addlMedicare) / Math.max(1, gross)) * 100, 1) },
              ...(k401 ? [{ label: "401(k)", value: k401, note: pct((k401 / Math.max(1, gross)) * 100, 1) }] : []),
            ]}
            format={m}
          />
        ),
      };
    }
    const m = (n: number) => money(n, "GBP");
    const gross = v.num("ukGross") as number;
    const r = ukTakeHome(gross);
    return {
      outputs: [
        { label: "Take-home pay per year", value: m(r.net), primary: true, note: `About ${m(r.net / 12)} a month or ${m(r.net / 52)} a week.` },
        { label: "Income Tax", value: m(r.incomeTax) },
        { label: "National Insurance", value: m(r.ni) },
        { label: "Personal Allowance", value: m(r.personalAllowance) },
        { label: "Effective rate", value: pct(r.effectivePct, 1) },
        { label: "Marginal rate (tax + NI)", value: pct((r.marginal + r.niMarginal) * 100, 0) },
      ],
      steps: [
        `Personal Allowance = £12,570${gross > 100000 ? ` − (${m(gross)} − £100,000) ÷ 2, floored at £0` : ""} = ${m(r.personalAllowance)}`,
        `Taxable income = ${m(gross)} − ${m(r.personalAllowance)} = ${m(r.taxable)}`,
        `20% basic rate = ${m(r.basic)}; 40% higher rate = ${m(r.higher)}; 45% additional rate = ${m(r.additional)}`,
        `NI = 8% of earnings £12,570 to £50,270 (${m(r.niMain)}) + 2% above £50,270 (${m(r.niUpper)})`,
      ],
      table: {
        caption: "Take-home pay by period",
        columns: ["Period", "Gross", "Tax + NI", "Take-home"],
        rows: [
          ["Year", m(gross), m(r.totalTax), m(r.net)],
          ["Month", m(gross / 12), m(r.totalTax / 12), m(r.net / 12)],
          ["Week", m(gross / 52), m(r.totalTax / 52), m(r.net / 52)],
        ],
      },
      notes: [
        `Source: GOV.UK Income Tax rates and rates and thresholds for employers ${UK_TAX_YEAR}. Scottish income tax bands differ and are not covered. Pension contributions, student loan repayments, benefits in kind and tax code adjustments are not included.`,
        ...(gross > 100000 && gross < 125140 ? ["Between £100,000 and £125,140 the allowance taper creates an effective 60% income tax rate on each extra pound."] : []),
      ],
      visual: (
        <HBars
          title="Where the salary goes"
          items={[
            { label: "Take-home", value: r.net, note: pct((r.net / Math.max(1, gross)) * 100, 1) },
            { label: "Income Tax", value: r.incomeTax, note: pct((r.incomeTax / Math.max(1, gross)) * 100, 1) },
            { label: "National Insurance", value: r.ni, note: pct((r.ni / Math.max(1, gross)) * 100, 1) },
          ]}
          format={m}
        />
      ),
    };
  },
};

export default function Tool() {
  return <FormulaTool spec={spec} />;
}

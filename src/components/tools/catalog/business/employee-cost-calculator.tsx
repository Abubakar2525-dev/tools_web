"use client";

import { FormulaTool, fixed, num, type FormulaSpec } from "@/components/tools/engines/FormulaTool";

const spec: FormulaSpec = {
  fields: [
    { id: "salary", label: "Gross annual salary", type: "number", min: 0, placeholder: "60000" },
    { id: "payroll", label: "Employer payroll taxes", type: "number", suffix: "%", min: 0, max: 100, hint: "Employer share only, e.g. 7.65% US FICA plus unemployment taxes.", placeholder: "8.5" },
    { id: "benefits", label: "Benefits per year", type: "number", min: 0, optional: true, hint: "Health insurance, retirement match, allowances.", placeholder: "9000" },
    { id: "overhead", label: "Other overheads per year", type: "number", min: 0, optional: true, hint: "Equipment, software seats, desk space, training.", placeholder: "4000" },
    { id: "bonus", label: "Expected bonus per year", type: "number", min: 0, optional: true },
    { id: "hours", label: "Hours per week", type: "number", gt: 0, max: 100, placeholder: "40" },
    { id: "pto", label: "Paid days off per year", type: "number", min: 0, max: 260, optional: true, hint: "Vacation plus public holidays plus expected sick days.", placeholder: "25" },
  ],
  defaults: { hours: "40" },
  example: { salary: "60000", payroll: "8.5", benefits: "9000", overhead: "4000", bonus: "3000", hours: "40", pto: "25" },
  compute: (v) => {
    const salary = v.num("salary");
    const payrollPct = v.num("payroll");
    const hours = v.num("hours");
    if (salary === null || payrollPct === null || hours === null) return null;
    const bonus = v.num("bonus") ?? 0;
    const benefits = v.num("benefits") ?? 0;
    const overhead = v.num("overhead") ?? 0;
    const pto = v.num("pto") ?? 0;
    const taxes = ((salary + bonus) * payrollPct) / 100;
    const total = salary + bonus + taxes + benefits + overhead;
    const paidHours = hours * 52;
    const dayHours = hours / 5;
    const productive = paidHours - pto * dayHours;
    if (productive <= 0) return "Paid days off leave no working hours. Check the inputs.";
    return {
      outputs: [
        { label: "Total cost per year", value: fixed(total), primary: true, note: `${num((total / (salary || 1)) * 100, 4)}% of gross salary` },
        { label: "Per month", value: fixed(total / 12) },
        { label: "Per paid hour", value: fixed(total / paidHours) },
        { label: "Per productive hour", value: fixed(total / productive) },
        { label: "Employer taxes", value: fixed(taxes) },
        { label: "Productive hours per year", value: num(productive, 6) },
      ],
      steps: [
        `Employer taxes = (${fixed(salary)} + ${fixed(bonus)}) × ${num(payrollPct)}% = ${fixed(taxes)}`,
        `Total = salary ${fixed(salary)} + bonus ${fixed(bonus)} + taxes ${fixed(taxes)} + benefits ${fixed(benefits)} + overheads ${fixed(overhead)} = ${fixed(total)}`,
        `Paid hours = ${num(hours)} × 52 = ${num(paidHours)}`,
        `Productive hours = ${num(paidHours)} − ${num(pto)} days × ${num(dayHours)} h = ${num(productive)}`,
        `Per productive hour = ${fixed(total)} ÷ ${num(productive)} = ${fixed(total / productive)}`,
      ],
      table: {
        caption: "Cost breakdown",
        columns: ["Item", "Per year", "Per month", "Share"],
        rows: (
          [
            ["Salary", salary],
            ["Bonus", bonus],
            ["Employer taxes", taxes],
            ["Benefits", benefits],
            ["Overheads", overhead],
          ] as [string, number][]
        ).map(([k, a]) => [k, fixed(a), fixed(a / 12), total > 0 ? `${num((a / total) * 100, 3)}%` : "0%"]),
      },
      notes: ["Payroll tax caps (such as wage bases for social security or unemployment insurance) are not applied; enter an average effective rate if your salary is above a cap."],
    };
  },
};

export default function Tool() {
  return <FormulaTool spec={spec} />;
}

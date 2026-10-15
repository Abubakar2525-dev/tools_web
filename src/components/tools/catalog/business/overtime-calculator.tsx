"use client";

import { FormulaTool, fixed, num, type FormulaSpec } from "@/components/tools/engines/FormulaTool";
import { splitOvertime } from "./lib/calc";

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function parseDays(raw: string): number[] | string {
  const parts = raw.split(/[,;\s]+/).map((p) => p.trim()).filter(Boolean);
  if (!parts.length) return "Enter the hours worked each day, separated by commas.";
  if (parts.length > 7) return "Enter at most 7 days (one week).";
  const out: number[] = [];
  for (const p of parts) {
    const m = p.match(/^(\d{1,2}):(\d{2})$/);
    const v = m ? Number(m[1]) + Number(m[2]) / 60 : Number(p);
    if (!Number.isFinite(v) || v < 0 || v > 24) return `"${p}" is not a valid number of hours (0 to 24, or h:mm).`;
    out.push(v);
  }
  return out;
}

const spec: FormulaSpec = {
  modes: [
    { id: "weekly", label: "Weekly total", fields: ["rate", "hours", "weekly", "dtWeekly", "otMult", "dtMult"] },
    { id: "daily", label: "Day by day", fields: ["rate", "days", "daily", "dt", "weekly", "otMult", "dtMult"] },
  ],
  fields: [
    { id: "rate", label: "Regular hourly rate", type: "number", min: 0, placeholder: "25" },
    { id: "hours", label: "Hours worked this week", type: "number", min: 0, max: 168, placeholder: "48" },
    { id: "days", label: "Hours per day", type: "text", placeholder: "9, 10, 8, 12, 9", hint: "Up to 7 values, Monday first. Decimals or h:mm both work." },
    { id: "weekly", label: "Weekly overtime after", type: "number", suffix: "h", min: 0, optional: true, hint: "40 under the US FLSA. Leave empty for no weekly rule." },
    { id: "daily", label: "Daily overtime after", type: "number", suffix: "h", min: 0, optional: true, hint: "8 in California. Leave empty for no daily rule." },
    { id: "dt", label: "Daily double time after", type: "number", suffix: "h", min: 0, optional: true, hint: "12 in California." },
    { id: "dtWeekly", label: "Double time after (weekly)", type: "number", suffix: "h", min: 0, optional: true, hint: "Only if your contract pays double time past a weekly total, e.g. 60." },
    { id: "otMult", label: "Overtime multiplier", type: "number", gt: 0, placeholder: "1.5" },
    { id: "dtMult", label: "Double time multiplier", type: "number", gt: 0, placeholder: "2" },
  ],
  defaults: { otMult: "1.5", dtMult: "2", weekly: "40" },
  example: { rate: "24", hours: "52", days: "10, 9, 12, 8, 10", weekly: "40", daily: "8", dt: "12", otMult: "1.5", dtMult: "2" },
  compute: (v) => {
    const rate = v.num("rate");
    const otMult = v.num("otMult");
    const dtMult = v.num("dtMult");
    if (rate === null || otMult === null || dtMult === null) return null;
    const weekly = v.num("weekly");
    let regular: number;
    let overtime: number;
    let double: number;
    let total: number;
    let table: { columns: string[]; rows: (string | number)[][]; caption?: string } | undefined;
    if (v.mode === "weekly") {
      const h = v.num("hours");
      if (h === null) return null;
      const dtW = v.num("dtWeekly");
      if (dtW !== null && weekly !== null && dtW <= weekly) return "The double time threshold must be higher than the overtime threshold.";
      total = h;
      double = dtW !== null ? Math.max(0, h - dtW) : 0;
      const capped = h - double;
      overtime = weekly !== null ? Math.max(0, capped - weekly) : 0;
      regular = capped - overtime;
    } else {
      const days = parseDays(v.str("days"));
      if (typeof days === "string") return days;
      const daily = v.num("daily");
      const dt = v.num("dt");
      if (daily !== null && dt !== null && dt <= daily) return "Daily double time must start after daily overtime.";
      const s = splitOvertime(days, { dailyOT: daily, dailyDT: dt, weeklyOT: weekly });
      ({ regular, overtime, double, total } = s);
      table = {
        caption: "Hours by day",
        columns: ["Day", "Worked", "Regular", "Overtime", "Double"],
        rows: s.days.map((d, i) => [DAY_NAMES[i], num(d.hours, 4), num(d.regular, 4), num(d.overtime, 4), num(d.double, 4)]),
      };
    }
    const regPay = regular * rate;
    const otPay = overtime * rate * otMult;
    const dtPay = double * rate * dtMult;
    const pay = regPay + otPay + dtPay;
    return {
      outputs: [
        { label: "Gross pay for the week", value: fixed(pay), primary: true, note: `${num(total, 4)} hours worked` },
        { label: "Regular hours", value: num(regular, 4) },
        { label: "Overtime hours", value: num(overtime, 4) },
        { label: "Double time hours", value: num(double, 4) },
        { label: "Overtime pay", value: fixed(otPay + dtPay) },
        { label: "Effective hourly rate", value: total > 0 ? fixed(pay / total) : "0.00" },
      ],
      steps: [
        `Regular pay = ${num(regular, 4)} h × ${fixed(rate)} = ${fixed(regPay)}`,
        `Overtime pay = ${num(overtime, 4)} h × ${fixed(rate)} × ${num(otMult)} = ${fixed(otPay)}`,
        `Double time pay = ${num(double, 4)} h × ${fixed(rate)} × ${num(dtMult)} = ${fixed(dtPay)}`,
        `Total = ${fixed(regPay)} + ${fixed(otPay)} + ${fixed(dtPay)} = ${fixed(pay)}`,
      ],
      table,
      notes: v.mode === "daily" ? ["Daily rules are applied first, then any regular hours past the weekly limit become overtime, so no hour is paid twice."] : undefined,
    };
  },
};

export default function Tool() {
  return <FormulaTool spec={spec} />;
}

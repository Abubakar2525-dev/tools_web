"use client";

import { FormulaTool, num, type FormulaSpec } from "@/components/tools/engines/FormulaTool";
import { evalDurationExpr, formatClock, formatHMS, formatWords, parseClock, parseDuration } from "./lib/time";

const durOutputs = (sec: number) => [
  { label: "Hours : minutes : seconds", value: formatHMS(sec), primary: true, note: formatWords(sec) },
  { label: "Decimal hours", value: num(sec / 3600, 6) },
  { label: "Total minutes", value: num(sec / 60, 8) },
  { label: "Total seconds", value: num(sec, 10) },
];

const spec: FormulaSpec = {
  modes: [
    { id: "sum", label: "Add / subtract durations", fields: ["expr"] },
    { id: "clock", label: "Clock time ± duration", fields: ["start", "op", "dur"] },
    { id: "diff", label: "Time between", fields: ["from", "to"] },
    { id: "conv", label: "Decimal hours", fields: ["conv"] },
  ],
  fields: [
    { id: "expr", label: "Durations", type: "text", mono: true, placeholder: "1:30 + 45m - 0:10", hint: "Use h:mm, h:mm:ss or units like 2h 15m, 90m, 45s. Bare numbers are minutes." },
    { id: "start", label: "Start time", type: "text", placeholder: "22:15 or 10:15 pm" },
    {
      id: "op",
      label: "Operation",
      type: "select",
      options: [
        { value: "+", label: "Add" },
        { value: "-", label: "Subtract" },
      ],
    },
    { id: "dur", label: "Duration", type: "text", placeholder: "3h 20m or 3:20" },
    { id: "from", label: "From", type: "text", placeholder: "22:30" },
    { id: "to", label: "To", type: "text", placeholder: "06:15", hint: "If this is earlier than From, it is read as the next day." },
    { id: "conv", label: "Duration or decimal hours", type: "text", placeholder: "7.75 or 7:45", hint: "Bare numbers are read as hours here." },
  ],
  example: { __mode: "sum", expr: "1:30 + 45m - 0:10 + 2h 5m" },
  compute: (v) => {
    if (v.mode === "sum") {
      const s = evalDurationExpr(v.str("expr"), "m");
      if (typeof s === "string") return s;
      return { outputs: durOutputs(s), steps: [`Total = ${s} seconds = ${formatHMS(s)}`] };
    }
    if (v.mode === "clock") {
      const start = parseClock(v.str("start"));
      if (typeof start === "string") return start;
      const d = parseDuration(v.str("dur"), "m");
      if (typeof d === "string") return d;
      const sign = v.str("op") === "-" ? -1 : 1;
      const end = start + sign * d;
      const days = Math.floor(end / 86400);
      const c = formatClock(end);
      const dayNote = days === 0 ? "Same day" : days > 0 ? `${days} day${days === 1 ? "" : "s"} later` : `${-days} day${days === -1 ? "" : "s"} earlier`;
      return {
        outputs: [
          { label: "Resulting time", value: c.h24, primary: true, note: `${c.h12}, ${dayNote.toLowerCase()}` },
          { label: "12-hour clock", value: c.h12 },
          { label: "Day", value: dayNote },
        ],
        steps: [`${formatClock(start).h24} ${sign > 0 ? "+" : "−"} ${formatHMS(d)} = ${c.h24}${days ? ` (${dayNote.toLowerCase()})` : ""}`],
      };
    }
    if (v.mode === "diff") {
      const a = parseClock(v.str("from"));
      if (typeof a === "string") return a;
      const b = parseClock(v.str("to"));
      if (typeof b === "string") return b;
      let d = b - a;
      const overnight = d < 0;
      if (overnight) d += 86400;
      return {
        outputs: durOutputs(d),
        steps: [overnight ? `End is before start, so it is the next day: ${formatClock(b).h24} + 24:00 − ${formatClock(a).h24} = ${formatHMS(d)}` : `${formatClock(b).h24} − ${formatClock(a).h24} = ${formatHMS(d)}`],
        notes: overnight ? ["Crossed midnight. Daylight saving changes overnight are not taken into account."] : undefined,
      };
    }
    const d = parseDuration(v.str("conv"), "h");
    if (typeof d === "string") return d;
    return { outputs: durOutputs(d), steps: [`${v.str("conv").trim()} = ${num(d, 10)} s = ${num(d / 3600, 8)} h = ${formatHMS(d)}`] };
  },
};

export default function Tool() {
  return <FormulaTool spec={spec} />;
}

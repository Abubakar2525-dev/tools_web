"use client";

import { useMemo, useState } from "react";
import {
  Btn,
  CellInput,
  Notice,
  NumberField,
  PrivacyNote,
  ResultCard,
  StatGrid,
  TextField,
  ToolPanel,
  downloadFile,
  parseNum,
  uid,
  usePersistentState,
} from "@/components/tools/kit";
import { fixed, num } from "@/components/tools/engines/FormulaTool";
import { Icon } from "@/components/ui/Icon";
import { hm, parseClock, shiftMinutes, splitOvertime } from "./lib/calc";
import { toCsv } from "./lib/csv";

type Row = { id: string; day: string; start: string; end: string; brk: string };
type Sheet = { rows: Row[]; rate: string; weekly: string; daily: string; mult: string; employee: string };

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const blank = (): Sheet => ({
  rows: DAYS.map((d, i) => ({ id: `d${i}`, day: d, start: "", end: "", brk: "" })),
  rate: "",
  weekly: "40",
  daily: "",
  mult: "1.5",
  employee: "",
});
const example = (): Sheet => ({
  ...blank(),
  employee: "Sam Rivera",
  rate: "22.50",
  rows: DAYS.map((d, i) => ({
    id: `d${i}`,
    day: d,
    start: i < 5 ? ["08:30", "08:45", "09:00", "08:30", "07:30"][i] : i === 5 ? "10:00" : "",
    end: i < 5 ? ["17:15", "18:30", "17:30", "19:00", "16:00"][i] : i === 5 ? "14:00" : "",
    brk: i < 5 ? "30" : i === 5 ? "0" : "",
  })),
});

function normalize(s: unknown): Sheet {
  const b = blank();
  if (!s || typeof s !== "object") return b;
  const o = s as Partial<Sheet>;
  const str = (v: unknown, d: string) => (typeof v === "string" ? v.slice(0, 40) : d);
  const rows = Array.isArray(o.rows)
    ? o.rows.slice(0, 31).map((r, i) => ({
        id: typeof r?.id === "string" ? r.id : `r${i}`,
        day: str(r?.day, ""),
        start: str(r?.start, ""),
        end: str(r?.end, ""),
        brk: str(r?.brk, ""),
      }))
    : b.rows;
  return { rows, rate: str(o.rate, ""), weekly: str(o.weekly, "40"), daily: str(o.daily, ""), mult: str(o.mult, "1.5"), employee: str(o.employee, "") };
}

export default function Tool() {
  const [initial] = useState(blank);
  const [stored, setStored] = usePersistentState<Sheet>("timesheet-and-working-hours-calculator", initial);
  const sheet = useMemo(() => normalize(stored), [stored]);
  const set = (patch: Partial<Sheet>) => setStored((p) => ({ ...normalize(p), ...patch }));
  const setRow = (id: string, patch: Partial<Row>) => setStored((p) => {
    const s = normalize(p);
    return { ...s, rows: s.rows.map((r) => (r.id === id ? { ...r, ...patch } : r)) };
  });
  const [undo, setUndo] = useState<Sheet | null>(null);

  const calc = useMemo(() => {
    const rowInfo = sheet.rows.map((r) => {
      if (!r.start.trim() && !r.end.trim()) return { minutes: 0, error: null as string | null, empty: true };
      const a = parseClock(r.start);
      const b = parseClock(r.end);
      if (a === null) return { minutes: 0, error: "Start time not recognized (use 9:00, 0900 or 9am).", empty: false };
      if (b === null) return { minutes: 0, error: "End time not recognized.", empty: false };
      const brk = r.brk.trim() ? parseNum(r.brk) : 0;
      if (brk === null || brk < 0) return { minutes: 0, error: "Break must be minutes, like 30.", empty: false };
      const mins = shiftMinutes(a, b, brk);
      if (shiftMinutes(a, b, 0) <= brk) return { minutes: 0, error: "The break is as long as the shift.", empty: false };
      return { minutes: mins, error: null, empty: false };
    });
    const weekly = sheet.weekly.trim() ? parseNum(sheet.weekly) : null;
    const daily = sheet.daily.trim() ? parseNum(sheet.daily) : null;
    const rate = sheet.rate.trim() ? parseNum(sheet.rate) : null;
    const mult = parseNum(sheet.mult) ?? 1.5;
    const split = splitOvertime(rowInfo.map((r) => r.minutes / 60), { dailyOT: daily, dailyDT: null, weeklyOT: weekly });
    const pay = rate !== null ? split.regular * rate + split.overtime * rate * mult : null;
    return { rowInfo, split, pay, rate, mult, days: rowInfo.filter((r) => r.minutes > 0).length };
  }, [sheet]);

  const csv = () => {
    const rows: (string | number)[][] = [["Day", "Start", "End", "Break (min)", "Hours (h:mm)", "Hours (decimal)", "Regular", "Overtime"]];
    sheet.rows.forEach((r, i) => {
      const d = calc.split.days[i];
      rows.push([r.day, r.start, r.end, r.brk, hm(calc.rowInfo[i].minutes), d.hours.toFixed(2), d.regular.toFixed(2), d.overtime.toFixed(2)]);
    });
    rows.push([], ["Total", "", "", "", hm(calc.split.total * 60), calc.split.total.toFixed(2), calc.split.regular.toFixed(2), calc.split.overtime.toFixed(2)]);
    if (calc.pay !== null) rows.push(["Gross pay", "", "", "", "", calc.pay.toFixed(2)]);
    const name = sheet.employee.trim() ? `${sheet.employee.trim().replace(/[^\w-]+/g, "-")}-timesheet.csv` : "timesheet.csv";
    downloadFile(name, toCsv(rows), "text/csv");
  };

  return (
    <div className="space-y-5">
      <ToolPanel
        title="Week"
        actions={
          <>
            <Btn variant="ghost" icon="spark" onClick={() => { setUndo(sheet); setStored(example()); }}>
              Load example
            </Btn>
            <Btn variant="subtle" icon="reset" onClick={() => { setUndo(sheet); setStored(blank()); }}>
              Clear
            </Btn>
          </>
        }
      >
        {undo && (
          <div className="mb-4">
            <Notice tone="success">
              Timesheet replaced.{" "}
              <button type="button" className="min-h-10 font-medium text-accent-strong underline underline-offset-2" onClick={() => { setStored(undo); setUndo(null); }}>
                Undo
              </button>
            </Notice>
          </div>
        )}
        <p className="mb-4 text-sm text-ink-2">Type times as 9:00, 0900, 9am or 5:30pm. A shift that ends before it starts is treated as running past midnight.</p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="text-left text-muted">
                <th scope="col" className="pb-2 font-normal">Day</th>
                <th scope="col" className="pb-2 font-normal">Start</th>
                <th scope="col" className="pb-2 font-normal">End</th>
                <th scope="col" className="pb-2 font-normal">Break (min)</th>
                <th scope="col" className="pb-2 text-right font-normal">Hours</th>
                <th scope="col" className="pb-2 font-normal"><span className="sr-only">Remove</span></th>
              </tr>
            </thead>
            <tbody>
              {sheet.rows.map((r, i) => {
                const info = calc.rowInfo[i];
                const d = calc.split.days[i];
                return (
                  <tr key={r.id} className="align-top">
                    <td className="py-1 pr-2"><CellInput label={`Row ${i + 1} day`} value={r.day} onChange={(e) => setRow(r.id, { day: e.target.value })} className="min-w-[110px]" /></td>
                    <td className="py-1 pr-2"><CellInput label={`${r.day || `Row ${i + 1}`} start time`} value={r.start} placeholder="9:00" invalid={!!info.error && info.error.startsWith("Start")} onChange={(e) => setRow(r.id, { start: e.target.value })} /></td>
                    <td className="py-1 pr-2"><CellInput label={`${r.day || `Row ${i + 1}`} end time`} value={r.end} placeholder="17:30" invalid={!!info.error && info.error.startsWith("End")} onChange={(e) => setRow(r.id, { end: e.target.value })} /></td>
                    <td className="py-1 pr-2"><CellInput label={`${r.day || `Row ${i + 1}`} break minutes`} inputMode="numeric" value={r.brk} placeholder="30" onChange={(e) => setRow(r.id, { brk: e.target.value })} /></td>
                    <td className="py-1 pr-2 text-right tabular-nums">
                      <span className="inline-flex h-10 items-center font-medium text-ink">{info.minutes ? hm(info.minutes) : "–"}</span>
                      {d.overtime > 0 && <span className="block text-xs text-muted">{num(d.overtime, 4)} h overtime</span>}
                      {info.error && <span className="block max-w-[180px] text-left text-xs text-danger" role="alert">{info.error}</span>}
                    </td>
                    <td className="py-1">
                      <button type="button" aria-label={`Remove ${r.day || `row ${i + 1}`}`} onClick={() => setStored((p) => { const s = normalize(p); return { ...s, rows: s.rows.filter((x) => x.id !== r.id) }; })} className="grid h-10 w-10 place-items-center rounded-lg text-danger hover:bg-sunken">
                        <Icon name="trash" size={18} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="mt-3">
          <Btn variant="ghost" icon="plus" disabled={sheet.rows.length >= 31} onClick={() => setStored((p) => { const s = normalize(p); return { ...s, rows: [...s.rows, { id: uid(), day: "", start: "", end: "", brk: "" }] }; })}>
            Add row
          </Btn>
        </div>
      </ToolPanel>

      <div className="grid gap-5 lg:grid-cols-2">
        <ToolPanel title="Pay and overtime">
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label="Employee name" optional value={sheet.employee} onChange={(e) => set({ employee: e.target.value })} />
            <NumberField label="Hourly rate" optional value={sheet.rate} onChange={(e) => set({ rate: e.target.value })} placeholder="22.50" />
            <NumberField label="Weekly overtime after (hours)" optional hint="Leave empty for no weekly rule." value={sheet.weekly} onChange={(e) => set({ weekly: e.target.value })} />
            <NumberField label="Daily overtime after (hours)" optional hint="For daily rules such as 8 hours in California." value={sheet.daily} onChange={(e) => set({ daily: e.target.value })} />
            <NumberField label="Overtime multiplier" value={sheet.mult} onChange={(e) => set({ mult: e.target.value })} />
          </div>
        </ToolPanel>
        <ToolPanel title="Totals" actions={<Btn variant="ghost" icon="download" onClick={csv} disabled={calc.split.total === 0}>Download CSV</Btn>}>
          <div className="space-y-4">
            <ResultCard label="Total hours worked" value={hm(calc.split.total * 60)} detail={`${num(calc.split.total, 4)} decimal hours over ${calc.days} day${calc.days === 1 ? "" : "s"}`} />
            <StatGrid
              items={[
                { label: "Regular hours", value: num(calc.split.regular, 4) },
                { label: "Overtime hours", value: num(calc.split.overtime, 4) },
                { label: "Gross pay", value: calc.pay !== null ? fixed(calc.pay) : "Add a rate" },
                { label: "Regular pay", value: calc.rate !== null ? fixed(calc.split.regular * calc.rate) : "–" },
                { label: "Overtime pay", value: calc.rate !== null ? fixed(calc.split.overtime * calc.rate * calc.mult) : "–" },
                { label: "Average per day", value: calc.days ? hm((calc.split.total * 60) / calc.days) : "–" },
              ]}
            />
            <PrivacyNote stored />
          </div>
        </ToolPanel>
      </div>
    </div>
  );
}

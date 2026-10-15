"use client";

import { useState } from "react";
import {
  CopyBtn,
  EmptyState,
  Notice,
  NumberField,
  PrivacyNote,
  ResetBtn,
  ResultCard,
  Segmented,
  StatGrid,
  ToolPanel,
  parseNum,
} from "@/components/tools/kit";
import { useTodayISO } from "./hooks";
import {
  type MonthMode,
  MONTH_NAMES,
  addDays,
  addMonths,
  dayOfYear,
  daysBetween,
  formatISODate,
  formatLong,
  isoWeek,
  parseISODate,
} from "./lib/dates";
import { DateInput, int, plural } from "./ui";

type Op = "add" | "subtract";
type Amounts = { years: string; months: string; weeks: string; days: string };
const EMPTY: Amounts = { years: "", months: "", weeks: "", days: "" };
const LIMIT = 100_000;

function readAmount(raw: string): { n: number; error: string | null } {
  if (raw.trim() === "") return { n: 0, error: null };
  const n = parseNum(raw);
  if (n === null || !Number.isInteger(n)) return { n: 0, error: "Use a whole number." };
  if (Math.abs(n) > LIMIT) return { n: 0, error: `Keep it under ${int(LIMIT)}.` };
  return { n, error: null };
}

export default function Tool() {
  const today = useTodayISO();
  const [startRaw, setStartRaw] = useState<string | null>(null);
  const [op, setOp] = useState<Op>("add");
  const [amt, setAmt] = useState<Amounts>({ ...EMPTY, days: "30" });
  const [mode, setMode] = useState<MonthMode>("clamp");

  const startValue = startRaw ?? today;
  const start = parseISODate(startValue);
  const parsed = {
    years: readAmount(amt.years),
    months: readAmount(amt.months),
    weeks: readAmount(amt.weeks),
    days: readAmount(amt.days),
  };
  const hasError = Object.values(parsed).some((p) => p.error);
  const sign = op === "add" ? 1 : -1;

  let result: null | { date: string; adjusted: boolean; mid: string; text: string; target: string; error?: string } = null;
  if (start && !hasError) {
    const totalMonths = sign * (parsed.years.n * 12 + parsed.months.n);
    const step1 = addMonths(start, totalMonths, mode);
    const final = addDays(step1.date, sign * (parsed.weeks.n * 7 + parsed.days.n));
    if (final.y < 1 || final.y > 9999) {
      result = { date: "", adjusted: false, mid: "", text: "", target: "", error: "The result falls outside the years 1 to 9999." };
    } else {
      result = {
        date: formatISODate(final),
        adjusted: step1.adjusted,
        mid: formatISODate(step1.date),
        text: formatLong(final),
        target: (() => {
          const t = addMonths(start, totalMonths, "clamp").date;
          return `${MONTH_NAMES[t.m - 1]} ${t.y}`;
        })(),
      };
    }
  }
  const final = result && !result.error ? parseISODate(result.date) : null;
  const set = (k: keyof Amounts) => (e: React.ChangeEvent<HTMLInputElement>) => setAmt((a) => ({ ...a, [k]: e.target.value }));

  return (
    <div className="space-y-5">
      <ToolPanel
        title="Add or subtract time"
        actions={
          <ResetBtn
            onClick={() => {
              setStartRaw(null);
              setOp("add");
              setAmt({ ...EMPTY, days: "30" });
              setMode("clamp");
            }}
          />
        }
      >
        <div className="space-y-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <DateInput
              label="Start date"
              value={startValue}
              onChange={(v) => setStartRaw(v)}
              error={startValue && !start ? "Enter a valid date." : null}
            />
            <div>
              <p className="text-sm font-medium text-ink" aria-hidden="true">
                Operation
              </p>
              <div className="mt-2">
                <Segmented
                  label="Operation"
                  value={op}
                  onChange={setOp}
                  options={[
                    { value: "add", label: "Add" },
                    { value: "subtract", label: "Subtract" },
                  ]}
                />
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <NumberField label="Years" value={amt.years} onChange={set("years")} placeholder="0" error={parsed.years.error} />
            <NumberField label="Months" value={amt.months} onChange={set("months")} placeholder="0" error={parsed.months.error} />
            <NumberField label="Weeks" value={amt.weeks} onChange={set("weeks")} placeholder="0" error={parsed.weeks.error} />
            <NumberField label="Days" value={amt.days} onChange={set("days")} placeholder="0" error={parsed.days.error} />
          </div>
          <div>
            <p className="text-sm font-medium text-ink" aria-hidden="true">
              When the day does not exist in the target month
            </p>
            <div className="mt-2">
              <Segmented
                label="When the day does not exist in the target month"
                value={mode}
                onChange={setMode}
                options={[
                  { value: "clamp", label: "Use the last day (Jan 31 + 1 month = Feb 28)" },
                  { value: "overflow", label: "Roll over (Jan 31 + 1 month = Mar 3)" },
                ]}
              />
            </div>
          </div>
        </div>
      </ToolPanel>

      {!result || !start ? (
        <EmptyState icon="calendar" title="Choose a start date">
          Enter a date and an amount of years, months, weeks or days.
        </EmptyState>
      ) : result.error ? (
        <Notice tone="error">{result.error}</Notice>
      ) : (
        <ToolPanel title="Result" actions={<CopyBtn text={result.date} label="Copy date" />}>
          <div className="space-y-5">
            <ResultCard label={`${op === "add" ? "Adding to" : "Subtracting from"} ${formatLong(start)}`} value={result.date} detail={result.text} />
            {result.adjusted && (
              <Notice tone="warning" title="Month-end adjustment applied">
                {result.target} has no day {start.d}, so{" "}
                {mode === "clamp" ? "the last day of that month was used" : "the extra days rolled into the next month"}. After the
                years and months step the date is {result.mid}; weeks and days are added after that.
              </Notice>
            )}
            {final && (
              <StatGrid
                items={[
                  { label: "Calendar days apart", value: int(Math.abs(daysBetween(start, final))) },
                  { label: "Day of year", value: dayOfYear(final) },
                  { label: "ISO week", value: `W${isoWeek(final).week} ${isoWeek(final).year}` },
                ]}
              />
            )}
            <p className="text-[0.8125rem] text-muted">
              Order of operations: years and months first (with the month-end rule above), then weeks and days.
              {final ? ` Net change: ${plural(Math.abs(daysBetween(start, final)), "day")}.` : ""}
            </p>
          </div>
        </ToolPanel>
      )}
      <PrivacyNote />
    </div>
  );
}

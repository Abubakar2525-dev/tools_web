"use client";

import Link from "next/link";
import { useState } from "react";
import { Btn, Checkbox, CopyBtn, EmptyState, PrivacyNote, ResetBtn, ResultCard, StatGrid, ToolPanel } from "@/components/tools/kit";
import { useTodayISO } from "./hooks";
import { addDays, compareDates, countBusinessDays, daysBetween, diffYMD, formatLong, parseISODate } from "./lib/dates";
import { DateInput, int, plural } from "./ui";

const WEEKEND = new Set([0, 6]);
const NO_HOLIDAYS = new Map<string, string>();

export default function Tool() {
  const today = useTodayISO();
  const [startRaw, setStartRaw] = useState<string | null>(null);
  const [endRaw, setEndRaw] = useState("");
  const [includeEnd, setIncludeEnd] = useState(false);

  const startValue = startRaw ?? today;
  const start = parseISODate(startValue);
  const end = parseISODate(endRaw);
  const startErr = startValue && !start ? "Enter a valid start date." : null;
  const endErr = endRaw && !end ? "Enter a valid end date." : null;

  let result: null | {
    ymdText: string;
    days: number;
    negative: boolean;
    weeks: number;
    remDays: number;
    months: number;
    weekdays: number;
  } = null;
  if (start && end) {
    const negative = compareDates(start, end) > 0;
    const [a, b] = negative ? [end, start] : [start, end];
    const bAdj = includeEnd ? addDays(b, 1) : b;
    const ymd = diffYMD(a, bAdj);
    const days = daysBetween(a, bAdj);
    result = {
      ymdText: `${plural(ymd.years, "year")}, ${plural(ymd.months, "month")}, ${plural(ymd.days, "day")}`,
      days,
      negative,
      weeks: Math.floor(days / 7),
      remDays: days % 7,
      months: ymd.years * 12 + ymd.months,
      weekdays: days === 0 ? 0 : countBusinessDays(a, b, WEEKEND, NO_HOLIDAYS, true, includeEnd).workdays,
    };
  }

  const summary =
    result && start && end
      ? `From ${formatLong(start)} to ${formatLong(end)}${includeEnd ? " (end date included)" : ""}: ${plural(result.days, "day")} (${result.ymdText}).`
      : "";

  return (
    <div className="space-y-5">
      <ToolPanel
        title="Date difference"
        actions={
          <ResetBtn
            onClick={() => {
              setStartRaw(null);
              setEndRaw("");
              setIncludeEnd(false);
            }}
          />
        }
      >
        <div className="grid items-end gap-5 sm:grid-cols-[1fr_auto_1fr]">
          <DateInput label="Start date" value={startValue} onChange={(v) => setStartRaw(v)} error={startErr} />
          <Btn
            variant="ghost"
            icon="swap"
            aria-label="Swap start and end dates"
            className="justify-self-start sm:mb-0.5"
            onClick={() => {
              setStartRaw(endRaw);
              setEndRaw(startValue);
            }}
          >
            Swap
          </Btn>
          <DateInput label="End date" value={endRaw} onChange={setEndRaw} error={endErr} />
        </div>
        <div className="mt-5">
          <Checkbox
            label="Include the end date"
            hint="Counts both the first and last day, e.g. Monday to Friday becomes 5 days instead of 4."
            checked={includeEnd}
            onChange={setIncludeEnd}
          />
        </div>
      </ToolPanel>

      {!result ? (
        <EmptyState icon="calendar" title="Pick two dates">
          The start date defaults to today. Choose an end date to see the gap in days, weeks, months and years.
        </EmptyState>
      ) : (
        <ToolPanel title="Result" actions={<CopyBtn text={summary} label="Copy summary" />}>
          <div className="space-y-5">
            <ResultCard
              label={result.negative ? "The end date is before the start date. Difference" : "Difference"}
              value={plural(result.days, "day")}
              detail={result.ymdText}
            />
            <StatGrid
              items={[
                { label: "Weeks and days", value: `${int(result.weeks)} w ${result.remDays} d` },
                { label: "Total months", value: int(result.months) },
                { label: "Weekdays (Mon to Fri)", value: int(result.weekdays) },
                { label: "Hours", value: int(result.days * 24) },
                { label: "Minutes", value: int(result.days * 1440) },
                { label: "Seconds", value: int(result.days * 86400) },
              ]}
            />
            <p className="text-[0.8125rem] text-muted">
              Months are counted by calendar anniversaries: January 31 to February 28 is one month, because February has
              no 31st. Hours and smaller units assume 24-hour days. For holidays and custom weekends, use the{" "}
              <Link className="link" href="/tools/business-days-calculator">
                business days calculator
              </Link>
              .
            </p>
          </div>
        </ToolPanel>
      )}
      <PrivacyNote />
    </div>
  );
}

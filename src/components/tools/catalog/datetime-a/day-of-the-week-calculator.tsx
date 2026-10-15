"use client";

import { useState } from "react";
import { CopyBtn, EmptyState, PrivacyNote, ResetBtn, ResultCard, StatGrid, ToolPanel } from "@/components/tools/kit";
import { useTodayISO } from "./hooks";
import {
  MONTH_NAMES,
  WEEKDAY_NAMES,
  daysBetween,
  daysInMonth,
  daysInYear,
  dayOfYear,
  formatISODate,
  formatLong,
  isLeapYear,
  isoWeek,
  monthGrid,
  parseISODate,
  quarter,
  usWeek,
  weekday,
} from "./lib/dates";
import { DateInput, int, plural } from "./ui";

const HEAD = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function Tool() {
  const today = useTodayISO();
  const [raw, setRaw] = useState<string | null>(null);
  const value = raw ?? today;
  const date = parseISODate(value);
  const todayDate = parseISODate(today);

  const nth = date ? Math.floor((date.d - 1) / 7) + 1 : 0;
  const isLast = date ? date.d + 7 > daysInMonth(date.y, date.m) : false;
  const ordinal = ["first", "second", "third", "fourth", "fifth"][nth - 1];
  const rel = date && todayDate ? daysBetween(todayDate, date) : null;

  return (
    <div className="space-y-5">
      <ToolPanel title="Day of the week" actions={<ResetBtn onClick={() => setRaw(null)} />}>
        <DateInput
          label="Date"
          hint="Any date from year 1 to 9999 (Gregorian calendar)."
          value={value}
          onChange={(v) => setRaw(v)}
          error={value && !date ? "Enter a valid date." : null}
          className="max-w-sm"
        />
      </ToolPanel>

      {!date ? (
        <EmptyState icon="calendar" title="Pick a date">
          The weekday, day of the year, ISO week and quarter appear here.
        </EmptyState>
      ) : (
        <ToolPanel title="Result" actions={<CopyBtn text={formatLong(date)} />}>
          <div className="grid gap-6 lg:grid-cols-[1fr_auto]">
            <div className="min-w-0 space-y-5">
              <ResultCard
                label={formatISODate(date)}
                value={WEEKDAY_NAMES[weekday(date)]}
                detail={`The ${ordinal}${isLast && nth >= 4 ? " (and last)" : ""} ${WEEKDAY_NAMES[weekday(date)]} of ${MONTH_NAMES[date.m - 1]} ${date.y}.`}
              />
              <StatGrid
                items={[
                  { label: "Day of year", value: `${dayOfYear(date)} of ${daysInYear(date.y)}` },
                  { label: "Days left in year", value: int(daysInYear(date.y) - dayOfYear(date)) },
                  { label: "ISO week", value: `W${String(isoWeek(date).week).padStart(2, "0")} ${isoWeek(date).year}` },
                  { label: "US week (Sun start)", value: usWeek(date).week },
                  { label: "Quarter", value: `Q${quarter(date)}` },
                  { label: "Leap year", value: isLeapYear(date.y) ? "Yes" : "No" },
                ]}
              />
              {rel !== null && (
                <p className="text-sm text-ink-2">
                  {rel === 0 ? "This is today." : rel > 0 ? `${plural(rel, "day")} from today.` : `${plural(-rel, "day")} ago.`}
                </p>
              )}
            </div>
            <div>
              <table className="border-collapse text-center text-sm">
                <caption className="pb-2 text-left text-sm font-medium text-ink">
                  {MONTH_NAMES[date.m - 1]} {date.y}
                </caption>
                <thead>
                  <tr>
                    {HEAD.map((h) => (
                      <th key={h} scope="col" className="h-9 w-10 font-medium text-muted">
                        <abbr title={h} className="no-underline">
                          {h.slice(0, 2)}
                        </abbr>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {monthGrid(date.y, date.m, 1).map((row, i) => (
                    <tr key={i}>
                      {row.map((c, j) => {
                        const sel = c?.d === date.d;
                        return (
                          <td
                            key={j}
                            aria-current={sel ? "date" : undefined}
                            className={`h-9 w-10 tabular-nums ${sel ? "rounded-lg bg-ink font-semibold text-surface" : "text-ink-2"}`}
                          >
                            {c?.d ?? ""}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </ToolPanel>
      )}
      <PrivacyNote />
    </div>
  );
}

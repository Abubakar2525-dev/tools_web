"use client";

import { useState } from "react";
import {
  Btn,
  CopyBtn,
  EmptyState,
  NumberField,
  PrivacyNote,
  ResetBtn,
  ResultCard,
  Segmented,
  StatGrid,
  ToolPanel,
  downloadFile,
  parseNum,
} from "@/components/tools/kit";
import { useTodayISO } from "./hooks";
import {
  type CivilDate,
  addDays,
  compareDates,
  formatISODate,
  formatShort,
  isoWeek,
  isoWeekStart,
  isoWeeksInYear,
  parseISODate,
  usWeek,
  usWeekStart,
  usWeeksInYear,
} from "./lib/dates";
import { toCsv } from "./lib/duration";
import { DataTable, DateInput } from "./ui";

type System = "iso" | "us";
type Mode = "date" | "week";

function weekOf(sys: System, c: CivilDate) {
  return sys === "iso" ? isoWeek(c) : usWeek(c);
}
function weeksIn(sys: System, y: number) {
  return sys === "iso" ? isoWeeksInYear(y) : usWeeksInYear(y);
}
function startOf(sys: System, y: number, w: number) {
  return sys === "iso" ? isoWeekStart(y, w) : usWeekStart(y, w);
}

export default function Tool() {
  const today = useTodayISO();
  const [sys, setSys] = useState<System>("iso");
  const [mode, setMode] = useState<Mode>("date");
  const [raw, setRaw] = useState<string | null>(null);
  const [yearRaw, setYearRaw] = useState<string | null>(null);
  const [weekRaw, setWeekRaw] = useState("1");

  const value = raw ?? today;
  const date = parseISODate(value);
  const todayDate = parseISODate(today);
  const defaultYear = date ? weekOf(sys, date).year : todayDate?.y;
  const yearValue = yearRaw ?? (defaultYear ? String(defaultYear) : "");
  const year = parseNum(yearValue);
  const yearOk = year !== null && Number.isInteger(year) && year >= 2 && year <= 9998;
  const week = parseNum(weekRaw);
  const maxWeek = yearOk ? weeksIn(sys, year) : 53;
  const weekOk = week !== null && Number.isInteger(week) && week >= 1 && week <= maxWeek;

  const label = sys === "iso" ? "ISO week" : "US week";
  const sysNote =
    sys === "iso"
      ? "ISO 8601: weeks run Monday to Sunday and week 1 contains January 4."
      : "US convention: weeks run Sunday to Saturday and week 1 contains January 1, so weeks 1 and the last week may span two years.";

  let result: { title: string; week: number; year: number; start: CivilDate; end: CivilDate } | null = null;
  if (mode === "date" && date) {
    const w = weekOf(sys, date);
    const start = startOf(sys, w.year, w.week);
    result = { title: `${label} for ${formatShort(date)}`, week: w.week, year: w.year, start, end: addDays(start, 6) };
  } else if (mode === "week" && yearOk && weekOk) {
    const start = startOf(sys, year, week);
    result = { title: `${label} ${week} of ${year}`, week, year, start, end: addDays(start, 6) };
  }

  const tableRows: { w: number; start: CivilDate; end: CivilDate }[] = [];
  if (yearOk) for (let w = 1; w <= weeksIn(sys, year); w++) tableRows.push({ w, start: startOf(sys, year, w), end: addDays(startOf(sys, year, w), 6) });
  const isCurrent = (r: { start: CivilDate; end: CivilDate }) =>
    todayDate !== null && compareDates(r.start, todayDate) <= 0 && compareDates(todayDate, r.end) <= 0;

  return (
    <div className="space-y-5">
      <ToolPanel
        title="Week number"
        actions={
          <ResetBtn
            onClick={() => {
              setRaw(null);
              setYearRaw(null);
              setWeekRaw("1");
              setMode("date");
              setSys("iso");
            }}
          />
        }
      >
        <div className="space-y-5">
          <div className="flex flex-wrap gap-3">
            <Segmented
              label="Numbering system"
              value={sys}
              onChange={setSys}
              options={[
                { value: "iso", label: "ISO 8601 (Mon start)" },
                { value: "us", label: "US (Sun start)" },
              ]}
            />
            <Segmented
              label="Look up"
              value={mode}
              onChange={setMode}
              options={[
                { value: "date", label: "Week of a date" },
                { value: "week", label: "Dates of a week" },
              ]}
            />
          </div>
          <p className="text-[0.8125rem] text-muted">{sysNote}</p>
          <div className="grid gap-5 sm:grid-cols-2">
            {mode === "date" ? (
              <DateInput label="Date" value={value} onChange={(v) => setRaw(v)} error={value && !date ? "Enter a valid date." : null} />
            ) : (
              <>
                <NumberField label="Year" value={yearValue} onChange={(e) => setYearRaw(e.target.value)} error={yearValue && !yearOk ? "Use a year from 2 to 9998." : null} />
                <NumberField
                  label="Week"
                  hint={yearOk ? `${year} has ${maxWeek} weeks in this system.` : undefined}
                  value={weekRaw}
                  onChange={(e) => setWeekRaw(e.target.value)}
                  error={weekRaw && !weekOk ? `Use a week from 1 to ${maxWeek}.` : null}
                />
              </>
            )}
          </div>
        </div>
      </ToolPanel>

      {!result ? (
        <EmptyState icon="calendar" title="Nothing to show yet">
          Pick a date, or switch to Dates of a week and enter a year and week number.
        </EmptyState>
      ) : (
        <ToolPanel title="Result" actions={<CopyBtn text={sys === "iso" ? `${result.year}-W${String(result.week).padStart(2, "0")}` : `Week ${result.week}, ${result.year}`} />}>
          <div className="space-y-5">
            <ResultCard
              label={result.title}
              value={sys === "iso" ? `W${String(result.week).padStart(2, "0")}` : `Week ${result.week}`}
              detail={`${formatShort(result.start)} to ${formatShort(result.end)}${result.start.y !== result.end.y || result.start.y !== result.year ? " (crosses a year boundary)" : ""}`}
            />
            <StatGrid
              items={[
                { label: "Week-numbering year", value: result.year },
                { label: "Weeks in that year", value: weeksIn(sys, result.year) },
                { label: "ISO notation", value: sys === "iso" ? `${result.year}-W${String(result.week).padStart(2, "0")}` : "n/a" },
              ]}
            />
          </div>
        </ToolPanel>
      )}

      {yearOk && (
        <ToolPanel
          title={`All weeks of ${year}`}
          actions={
            <Btn
              variant="ghost"
              icon="download"
              onClick={() =>
                downloadFile(
                  `weeks-${year}-${sys}.csv`,
                  toCsv([["week", "start", "end"], ...tableRows.map((r) => [r.w, formatISODate(r.start), formatISODate(r.end)])]),
                  "text/csv",
                )
              }
            >
              Download CSV
            </Btn>
          }
        >
          <div className="max-h-[420px] overflow-auto">
            <DataTable
              caption={`${label} numbers for ${year}. The current week is highlighted.`}
              columns={["Week", "Starts", "Ends"]}
              rows={tableRows.map((r) => [
                <span key="w">
                  {r.w}
                  {isCurrent(r) && <span className="ml-2 text-[0.8125rem] text-accent-strong">current</span>}
                </span>,
                formatShort(r.start),
                formatShort(r.end),
              ])}
              highlight={(i) => isCurrent(tableRows[i])}
            />
          </div>
        </ToolPanel>
      )}
      <PrivacyNote />
    </div>
  );
}

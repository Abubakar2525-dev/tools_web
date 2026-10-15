"use client";

import { useMemo, useState } from "react";
import {
  Checkbox,
  CopyBtn,
  EmptyState,
  Notice,
  NumberField,
  PrivacyNote,
  ResetBtn,
  ResultCard,
  Segmented,
  StatGrid,
  TextArea,
  ToolPanel,
  parseNum,
  usePersistentState,
} from "@/components/tools/kit";
import { useTodayISO } from "./hooks";
import {
  WEEKDAY_NAMES,
  addBusinessDays,
  countBusinessDays,
  formatISODate,
  formatLong,
  isWorkday,
  parseHolidayList,
  parseISODate,
} from "./lib/dates";
import { DateInput, int, plural } from "./ui";

type Mode = "count" | "add";
type Settings = { weekend: number[]; holidays: string };
const DEFAULTS: Settings = { weekend: [0, 6], holidays: "" };
/** Display order Monday first. */
const ORDER = [1, 2, 3, 4, 5, 6, 0];

function tryCalc<T>(fn: () => T): { value: T } | { error: string } {
  try {
    return { value: fn() };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not calculate this." };
  }
}

export default function Tool() {
  const today = useTodayISO();
  const [mode, setMode] = useState<Mode>("count");
  const [startRaw, setStartRaw] = useState<string | null>(null);
  const [endRaw, setEndRaw] = useState("");
  const [nRaw, setNRaw] = useState("10");
  const [incStart, setIncStart] = useState(true);
  const [incEnd, setIncEnd] = useState(true);
  const [settings, setSettings, clearSettings] = usePersistentState<Settings>("business-days-calculator", DEFAULTS);

  const weekend = useMemo(() => new Set(settings.weekend), [settings.weekend]);
  const holidayParse = useMemo(() => parseHolidayList(settings.holidays), [settings.holidays]);
  const holidays = holidayParse.holidays;

  const startValue = startRaw ?? today;
  const start = parseISODate(startValue);
  const end = parseISODate(endRaw);
  const n = parseNum(nRaw);
  const nError = nRaw.trim() && (n === null || !Number.isInteger(n)) ? "Use a whole number (negative counts backward)." : n !== null && Math.abs(n) > 50000 ? "Keep it under 50,000." : null;
  const allWeekend = weekend.size >= 7;

  let out: React.ReactNode = null;
  let copyText = "";
  if (allWeekend) {
    out = <Notice tone="error">Every day is marked as a weekend day. Leave at least one working day.</Notice>;
  } else if (mode === "count" && start && end) {
    const attempt = tryCalc(() => countBusinessDays(start, end, weekend, holidays, incStart, incEnd));
    if ("error" in attempt) out = <Notice tone="error">{attempt.error}</Notice>;
    else {
      const r = attempt.value;
      copyText = `${r.workdays} business days between ${formatISODate(start)} and ${formatISODate(end)}`;
      out = (
        <div className="space-y-5">
          <ResultCard label="Business days" value={int(r.workdays)} detail={`${formatLong(start)} to ${formatLong(end)}`} />
          <StatGrid
            items={[
              { label: "Calendar days counted", value: int(r.calendarDays) },
              { label: "Weekend days", value: int(r.weekendDays) },
              { label: "Holidays on workdays", value: int(r.holidaysOnWorkdays) },
            ]}
          />
          {r.holidayHits.length > 0 && r.holidayHits.length <= 40 && (
            <p className="text-sm text-ink-2">
              Holidays skipped:{" "}
              {r.holidayHits.map((h) => (holidays.get(h) ? `${h} (${holidays.get(h)})` : h)).join(", ")}
            </p>
          )}
        </div>
      );
    }
  } else if (mode === "add" && start && n !== null && !nError) {
    const attempt = tryCalc(() => addBusinessDays(start, n, weekend, holidays));
    if ("error" in attempt) out = <Notice tone="error">{attempt.error}</Notice>;
    else {
      const r = attempt.value;
      copyText = formatISODate(r.date);
      out = (
        <div className="space-y-5">
          <ResultCard
            label={`${plural(Math.abs(n), "business day")} ${n < 0 ? "before" : "after"} ${formatLong(start)}`}
            value={formatISODate(r.date)}
            detail={formatLong(r.date)}
          />
          <StatGrid
            items={[
              { label: "Weekend days skipped", value: int(r.skippedWeekend) },
              { label: "Holidays skipped", value: int(r.skippedHolidays) },
              { label: "Start is a workday", value: isWorkday(start, weekend, holidays) ? "Yes" : "No" },
            ]}
          />
          <p className="text-[0.8125rem] text-muted">
            The start date itself is not counted: 1 business day after a Friday is the following Monday (with a Saturday
            and Sunday weekend).
          </p>
        </div>
      );
    }
  }

  const toggleDay = (d: number, on: boolean) =>
    setSettings((s) => ({ ...s, weekend: on ? Array.from(new Set([...s.weekend, d])).sort((a, b) => a - b) : s.weekend.filter((x) => x !== d) }));

  return (
    <div className="space-y-5">
      <ToolPanel
        title="Business days"
        actions={
          <ResetBtn
            onClick={() => {
              setStartRaw(null);
              setEndRaw("");
              setNRaw("10");
              setIncStart(true);
              setIncEnd(true);
              clearSettings();
            }}
          />
        }
      >
        <div className="space-y-5">
          <Segmented
            label="Mode"
            value={mode}
            onChange={setMode}
            options={[
              { value: "count", label: "Count between dates" },
              { value: "add", label: "Add business days" },
            ]}
          />
          <div className="grid gap-5 sm:grid-cols-2">
            <DateInput label="Start date" value={startValue} onChange={(v) => setStartRaw(v)} error={startValue && !start ? "Enter a valid date." : null} />
            {mode === "count" ? (
              <DateInput label="End date" value={endRaw} onChange={setEndRaw} error={endRaw && !end ? "Enter a valid date." : null} />
            ) : (
              <NumberField label="Business days to add" hint="Use a negative number to count backward." value={nRaw} onChange={(e) => setNRaw(e.target.value)} error={nError} />
            )}
          </div>
          {mode === "count" && (
            <div className="grid gap-3 sm:grid-cols-2">
              <Checkbox label="Count the start date" checked={incStart} onChange={setIncStart} />
              <Checkbox label="Count the end date" checked={incEnd} onChange={setIncEnd} />
            </div>
          )}
          <fieldset>
            <legend className="text-sm font-medium text-ink">Weekend days</legend>
            <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2">
              {ORDER.map((d) => (
                <Checkbox key={d} label={WEEKDAY_NAMES[d]} checked={weekend.has(d)} onChange={(on) => toggleDay(d, on)} />
              ))}
            </div>
          </fieldset>
          <TextArea
            label="Holidays"
            optional
            mono
            hint="One per line as YYYY-MM-DD, optionally followed by a name. Lines starting with # are ignored. Saved in this browser."
            placeholder={"2026-12-25 Christmas Day\n2027-01-01 New Year's Day"}
            value={settings.holidays}
            onChange={(e) => setSettings((s) => ({ ...s, holidays: e.target.value }))}
            rows={5}
          />
          {holidayParse.errors.length > 0 ? (
            <Notice tone="warning" title={`${plural(holidayParse.errors.length, "line")} ignored`}>
              <ul className="list-disc space-y-0.5 pl-5">
                {holidayParse.errors.slice(0, 8).map((e) => (
                  <li key={e.line}>
                    Line {e.line} (<code>{e.text.slice(0, 40)}</code>): {e.reason}
                  </li>
                ))}
              </ul>
            </Notice>
          ) : holidays.size > 0 ? (
            <p className="text-[0.8125rem] text-muted">{plural(holidays.size, "holiday")} loaded.</p>
          ) : null}
        </div>
      </ToolPanel>

      {out ? (
        <ToolPanel title="Result" actions={copyText ? <CopyBtn text={copyText} /> : undefined}>
          {out}
        </ToolPanel>
      ) : (
        <EmptyState icon="briefcase" title={mode === "count" ? "Pick an end date" : "Enter a number of days"}>
          Weekends and holidays you list are skipped automatically.
        </EmptyState>
      )}
      <PrivacyNote stored />
    </div>
  );
}

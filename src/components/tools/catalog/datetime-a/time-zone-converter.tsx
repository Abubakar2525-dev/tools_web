"use client";

import { useState } from "react";
import { Btn, Checkbox, CopyBtn, EmptyState, Notice, PrivacyNote, ResetBtn, TextField, ToolPanel, usePersistentState } from "@/components/tools/kit";
import { useLocalZone, useTodayISO } from "./hooks";
import { WEEKDAY_NAMES, daysBetween, formatShort, parseISODate, weekday } from "./lib/dates";
import { describeDiff, formatOffset, formatWallTime, offsetMinutes, wallTime, zoneAbbrev, zoneCity, zonedToEpoch } from "./lib/tz";
import { ZonePicker } from "./ZonePicker";
import { DateInput } from "./ui";

const DEFAULT_TARGETS = ["UTC", "America/New_York", "Europe/London", "Asia/Tokyo"];

function parseTime(s: string): { h: number; mi: number } | null {
  const m = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(s.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const mi = Number(m[2]);
  return h <= 23 && mi <= 59 ? { h, mi } : null;
}

export default function Tool() {
  const today = useTodayISO();
  const local = useLocalZone();
  const [dateRaw, setDateRaw] = useState<string | null>(null);
  const [timeRaw, setTimeRaw] = useState("09:00");
  const [srcRaw, setSrcRaw] = useState<string | null>(null);
  const [h12, setH12] = useState(false);
  const [targets, setTargets, clearTargets] = usePersistentState<string[]>("time-zone-converter", DEFAULT_TARGETS);

  const dateValue = dateRaw ?? today;
  const src = srcRaw ?? local;
  const date = parseISODate(dateValue);
  const time = parseTime(timeRaw);

  const conv = date && time && src ? zonedToEpoch(src, { y: date.y, m: date.m, d: date.d, h: time.h, mi: time.mi, s: 0 }) : null;
  const srcOffset = conv && src ? offsetMinutes(src, conv.epoch) : 0;

  const rows =
    conv && date
      ? targets.map((tz) => {
          const w = wallTime(tz, conv.epoch);
          const off = offsetMinutes(tz, conv.epoch);
          const dayShift = daysBetween(date, w);
          return { tz, w, off, abbr: zoneAbbrev(tz, conv.epoch), dayShift, diff: off - srcOffset };
        })
      : [];

  const copyText = rows
    .map((r) => `${r.tz}: ${WEEKDAY_NAMES[weekday(r.w)].slice(0, 3)} ${formatShort(r.w)} ${formatWallTime(r.w, h12)} (${formatOffset(r.off)})`)
    .join("\n");

  const setNow = () => {
    if (!src) return;
    const w = wallTime(src, Date.now());
    setDateRaw(`${String(w.y).padStart(4, "0")}-${String(w.m).padStart(2, "0")}-${String(w.d).padStart(2, "0")}`);
    setTimeRaw(`${String(w.h).padStart(2, "0")}:${String(w.mi).padStart(2, "0")}`);
  };

  const move = (i: number, dir: -1 | 1) =>
    setTargets((t) => {
      const j = i + dir;
      if (j < 0 || j >= t.length) return t;
      const next = t.slice();
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  return (
    <div className="space-y-5">
      <ToolPanel
        title="Convert a time"
        actions={
          <>
            <Btn variant="ghost" icon="timer" onClick={setNow} disabled={!src}>
              Use current time
            </Btn>
            <ResetBtn
              onClick={() => {
                setDateRaw(null);
                setTimeRaw("09:00");
                setSrcRaw(null);
                clearTargets();
              }}
            />
          </>
        }
      >
        <div className="grid gap-5 md:grid-cols-3">
          <DateInput label="Date" value={dateValue} onChange={(v) => setDateRaw(v)} error={dateValue && !date ? "Enter a valid date." : null} />
          <TextField label="Time" type="time" value={timeRaw} onChange={(e) => setTimeRaw(e.target.value)} error={timeRaw && !time ? "Enter a time as HH:MM." : null} />
          <ZonePicker label="From time zone" value={src} onChange={setSrcRaw} hint={src === local && local ? "Your device's zone." : undefined} />
        </div>
        <div className="mt-5">
          <Checkbox label="Show 12-hour clock (AM/PM)" checked={h12} onChange={setH12} />
        </div>
        {conv?.kind === "gap" && (
          <div className="mt-5">
            <Notice tone="warning" title="This time does not exist">
              Clocks in {src} jump forward on this date, so {timeRaw} is skipped. It has been treated as{" "}
              {formatWallTime(wallTime(src, conv.epoch), h12)} ({formatOffset(srcOffset)}), the same instant most calendar
              apps would choose.
            </Notice>
          </div>
        )}
        {conv?.kind === "overlap" && conv.alternate !== undefined && (
          <div className="mt-5">
            <Notice tone="warning" title="This time happens twice">
              Clocks in {src} fall back on this date, so {timeRaw} occurs at {formatOffset(srcOffset)} and again at{" "}
              {formatOffset(offsetMinutes(src, conv.alternate))}. The first occurrence is shown.
            </Notice>
          </div>
        )}
      </ToolPanel>

      <ToolPanel title="Converted times" actions={rows.length ? <CopyBtn text={copyText} label="Copy all" /> : undefined}>
        <div className="space-y-4">
          {!conv ? (
            <EmptyState icon="globe" title="Enter a date and time">
              Results appear for every zone in your list.
            </EmptyState>
          ) : rows.length === 0 ? (
            <EmptyState icon="globe" title="No target zones">
              Add a time zone below.
            </EmptyState>
          ) : (
            <ul className="divide-y divide-line rounded-xl shadow-[0_0_0_1px_var(--line)]">
              {rows.map((r, i) => (
                <li key={r.tz} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
                  <div className="min-w-0 flex-1 basis-48">
                    <p className="font-medium text-ink">{zoneCity(r.tz)}</p>
                    <p className="truncate text-[0.8125rem] text-muted">
                      {r.tz} · {r.abbr} · {formatOffset(r.off)}
                    </p>
                  </div>
                  <div className="basis-40 text-right sm:text-left">
                    <p className="text-xl font-semibold tabular-nums text-ink">{formatWallTime(r.w, h12)}</p>
                    <p className="text-[0.8125rem] text-ink-2">
                      {WEEKDAY_NAMES[weekday(r.w)].slice(0, 3)}, {formatShort(r.w)}
                      {r.dayShift !== 0 && (
                        <span className="ml-1 font-medium text-accent-strong">
                          ({r.dayShift > 0 ? "+" : ""}
                          {r.dayShift} day)
                        </span>
                      )}
                    </p>
                  </div>
                  <p className="basis-28 text-[0.8125rem] text-muted">{describeDiff(r.diff)} vs source</p>
                  <div className="flex gap-1">
                    <Btn variant="subtle" aria-label={`Move ${r.tz} up`} disabled={i === 0} onClick={() => move(i, -1)}>
                      ↑
                    </Btn>
                    <Btn variant="subtle" aria-label={`Move ${r.tz} down`} disabled={i === rows.length - 1} onClick={() => move(i, 1)}>
                      ↓
                    </Btn>
                    <Btn variant="subtle" icon="trash" aria-label={`Remove ${r.tz}`} onClick={() => setTargets((t) => t.filter((z) => z !== r.tz))} />
                  </div>
                </li>
              ))}
            </ul>
          )}
          <ZonePicker
            label="Add a time zone"
            value=""
            onChange={(tz) => setTargets((t) => (t.includes(tz) ? t : [...t, tz]))}
            className="max-w-md"
          />
        </div>
      </ToolPanel>
      <PrivacyNote stored />
    </div>
  );
}

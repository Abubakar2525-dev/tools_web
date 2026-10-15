"use client";

import { useState } from "react";
import { Btn, CellInput, EmptyState, Notice, PrivacyNote, ResetBtn, TextField, ToolPanel, uid, usePersistentState } from "@/components/tools/kit";
import { useLocalZone, useTodayISO } from "./hooks";
import { addDays, formatLong, parseISODate } from "./lib/dates";
import { formatOffset, offsetMinutes, wallTime, zoneCity, zonedToEpoch } from "./lib/tz";
import { ZonePicker } from "./ZonePicker";
import { DateInput } from "./ui";

type Person = { id: string; name: string; tz: string; start: string; end: string };
const SEED: Person[] = [
  { id: "a", name: "London office", tz: "Europe/London", start: "09:00", end: "17:00" },
  { id: "b", name: "New York office", tz: "America/New_York", start: "09:00", end: "17:00" },
  { id: "c", name: "Karachi office", tz: "Asia/Karachi", start: "10:00", end: "18:00" },
];
const HOUR = 3_600_000;

function toMin(s: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(s);
  if (!m) return null;
  const h = Number(m[1]);
  const mi = Number(m[2]);
  return h <= 24 && mi <= 59 && h * 60 + mi <= 1440 ? h * 60 + mi : null;
}

/** Is the hour starting at local minute `m` fully inside working hours [s, e)? Handles overnight shifts. */
function working(m: number, s: number, e: number): boolean {
  if (s === e) return false;
  if (s < e) return m >= s && m + 60 <= e;
  return m >= s || m + 60 <= e;
}

const hhmm = (h: number, mi: number) => `${String(h).padStart(2, "0")}:${String(mi).padStart(2, "0")}`;

export default function Tool() {
  const today = useTodayISO();
  const local = useLocalZone();
  const [dateRaw, setDateRaw] = useState<string | null>(null);
  const [people, setPeople, clearPeople] = usePersistentState<Person[]>("meeting-planner", SEED);

  const dateValue = dateRaw ?? today;
  const date = parseISODate(dateValue);
  const base = people[0];

  const update = (id: string, patch: Partial<Person>) => setPeople((ps) => ps.map((p) => (p.id === id ? { ...p, ...patch } : p)));

  let slots: number[] = [];
  if (date && base) {
    const startE = zonedToEpoch(base.tz, { y: date.y, m: date.m, d: date.d, h: 0, mi: 0, s: 0 }).epoch;
    const n = addDays(date, 1);
    const endE = zonedToEpoch(base.tz, { y: n.y, m: n.m, d: n.d, h: 0, mi: 0, s: 0 }).epoch;
    for (let e = startE; e < endE && slots.length < 26; e += HOUR) slots.push(e);
  } else slots = [];

  const ranges = people.map((p) => ({ s: toMin(p.start), e: toMin(p.end) }));
  const invalid = ranges.some((r) => r.s === null || r.e === null);
  const cell = slots.map((e) =>
    people.map((p, i) => {
      const w = wallTime(p.tz, e);
      const m = w.h * 60 + w.mi;
      const r = ranges[i];
      return { w, work: r.s !== null && r.e !== null && working(m, r.s, r.e) };
    }),
  );
  const overlap = cell.map((col) => people.length > 0 && col.every((c) => c.work));

  // Group consecutive overlap slots into ranges for the text summary.
  const groups: [number, number][] = [];
  overlap.forEach((ok, i) => {
    if (!ok) return;
    const last = groups[groups.length - 1];
    if (last && last[1] === i - 1) last[1] = i;
    else groups.push([i, i]);
  });
  const fmtAt = (tz: string, e: number) => {
    const w = wallTime(tz, e);
    return hhmm(w.h, w.mi);
  };
  const summary =
    !base || slots.length === 0
      ? ""
      : groups.length === 0
        ? "There is no hour on this date when everyone is inside their working hours."
        : groups
            .map(([a, b]) => {
              const s = slots[a];
              const e = slots[b] + HOUR;
              const each = people.map((p) => `${fmtAt(p.tz, s)} to ${fmtAt(p.tz, e)} for ${p.name || zoneCity(p.tz)}`).join(", ");
              return `${b - a + 1} hour${b === a ? "" : "s"} of overlap: ${each}.`;
            })
            .join(" ");

  return (
    <div className="space-y-5">
      <ToolPanel title="Participants" actions={<ResetBtn onClick={clearPeople} label="Reset participants" />}>
        <div className="space-y-4">
          <DateInput
            label="Meeting date"
            hint={base ? `The grid shows this calendar day in the first participant's zone (${base.tz}).` : undefined}
            value={dateValue}
            onChange={(v) => setDateRaw(v)}
            error={dateValue && !date ? "Enter a valid date." : null}
            className="max-w-sm"
          />
          <ul className="space-y-3">
            {people.map((p, i) => (
              <li key={p.id} className="grid gap-3 rounded-xl bg-sunken p-3 sm:grid-cols-[1fr_1.4fr_auto_auto_auto] sm:items-end">
                <TextField label={`Participant ${i + 1} name`} value={p.name} onChange={(e) => update(p.id, { name: e.target.value })} placeholder="Name or office" />
                <ZonePicker label={`Participant ${i + 1} time zone`} value={p.tz} onChange={(tz) => update(p.id, { tz })} />
                <div>
                  <label className="text-sm font-medium text-ink" htmlFor={`${p.id}-s`}>
                    Starts
                  </label>
                  <CellInput id={`${p.id}-s`} label={`Participant ${i + 1} working hours start`} type="time" value={p.start} invalid={toMin(p.start) === null} onChange={(e) => update(p.id, { start: e.target.value })} className="mt-2 h-11" />
                </div>
                <div>
                  <label className="text-sm font-medium text-ink" htmlFor={`${p.id}-e`}>
                    Ends
                  </label>
                  <CellInput id={`${p.id}-e`} label={`Participant ${i + 1} working hours end`} type="time" value={p.end} invalid={toMin(p.end) === null} onChange={(e) => update(p.id, { end: e.target.value })} className="mt-2 h-11" />
                </div>
                <div className="flex gap-1">
                  <Btn
                    variant="subtle"
                    aria-label={`Make ${p.name || `participant ${i + 1}`} the reference zone`}
                    disabled={i === 0}
                    onClick={() => setPeople((ps) => [ps[i], ...ps.filter((_, j) => j !== i)])}
                  >
                    ↑ First
                  </Btn>
                  <Btn variant="subtle" icon="trash" aria-label={`Remove ${p.name || `participant ${i + 1}`}`} onClick={() => setPeople((ps) => ps.filter((x) => x.id !== p.id))} />
                </div>
              </li>
            ))}
          </ul>
          <Btn
            variant="ghost"
            icon="plus"
            onClick={() => setPeople((ps) => [...ps, { id: uid(), name: "", tz: local || "UTC", start: "09:00", end: "17:00" }])}
          >
            Add participant
          </Btn>
          {invalid && <Notice tone="error">Enter working hours as HH:MM for every participant.</Notice>}
        </div>
      </ToolPanel>

      <ToolPanel title="24-hour overlap grid">
        {!base || !date ? (
          <EmptyState icon="globe" title="Add a participant and pick a date" />
        ) : (
          <div className="space-y-4">
            <Notice tone={groups.length ? "success" : "warning"} title={groups.length ? "Best meeting window" : "No shared working hour"}>
              <p aria-live="polite">{summary}</p>
            </Notice>
            <div className="max-w-full overflow-x-auto rounded-xl shadow-[0_0_0_1px_var(--line)]" role="region" aria-label="Hourly grid" tabIndex={0}>
              <table className="border-collapse text-center text-[0.8125rem]">
                <caption className="sr-only">
                  Local time for each participant at each hour of {formatLong(date)} in {base.tz}. Cells marked work are
                  inside that person&apos;s working hours; columns marked all are shared by everyone.
                </caption>
                <thead>
                  <tr>
                    <th scope="col" className="sticky left-0 z-10 min-w-36 bg-surface px-3 py-2 text-left font-medium text-ink-2">
                      Participant
                    </th>
                    {slots.map((e, i) => (
                      <th key={e} scope="col" className={`min-w-12 px-1 py-2 font-medium ${overlap[i] ? "bg-accent text-surface" : "text-muted"}`}>
                        {overlap[i] ? "All" : <span aria-hidden="true">·</span>}
                        <span className="sr-only">{overlap[i] ? " free" : "Not shared"}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {people.map((p, pi) => (
                    <tr key={p.id} className="border-t border-line">
                      <th scope="row" className="sticky left-0 z-10 bg-surface px-3 py-2 text-left font-normal">
                        <span className="block font-medium text-ink">{p.name || zoneCity(p.tz)}</span>
                        <span className="block text-muted">{formatOffset(offsetMinutes(p.tz, slots[0] ?? 0))}</span>
                      </th>
                      {slots.map((e, si) => {
                        const c = cell[si][pi];
                        const night = c.w.h < 6 || c.w.h >= 22;
                        return (
                          <td
                            key={e}
                            className={`px-1 py-2 tabular-nums ${c.work ? "bg-accent-soft font-semibold text-ink" : night ? "bg-sunken text-muted" : "text-ink-2"} ${overlap[si] ? "shadow-[inset_0_0_0_2px_var(--accent)]" : ""}`}
                          >
                            {c.w.mi ? hhmm(c.w.h, c.w.mi) : c.w.h}
                            {c.w.h === 0 && c.w.mi === 0 && <span className="block text-[0.6875rem] text-muted">{c.w.m}/{c.w.d}</span>}
                            <span className="sr-only">{c.work ? ", work" : ", off"}</span>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-[0.8125rem] text-muted">
              Each column is one real hour of the reference day (23 or 25 columns on a daylight-saving change). Bold cells are
              working hours, grey cells are 22:00 to 06:00, and outlined columns work for everyone. An hour counts only if it
              fits entirely inside someone&apos;s working hours.
            </p>
          </div>
        )}
      </ToolPanel>
      <PrivacyNote stored />
    </div>
  );
}

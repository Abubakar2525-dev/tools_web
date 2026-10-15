"use client";

import { useState, useSyncExternalStore } from "react";
import {
  Btn,
  CellInput,
  Checkbox,
  CopyBtn,
  EmptyState,
  Notice,
  NumberField,
  PrivacyNote,
  ResetBtn,
  Segmented,
  SelectField,
  StatGrid,
  TextField,
  ToolPanel,
  downloadFile,
  fmt,
  parseNum,
  uid,
  usePersistentState,
} from "@/components/tools/kit";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

type Priority = "low" | "medium" | "high";
type Topic = { id: string; text: string; done: boolean };
type Subject = { id: string; name: string; deadline: string; priority: Priority; hours: string; topics: Topic[] };
type ExportMode = "timed" | "allday";
type PlannerState = {
  subjects: Subject[];
  availability: string[]; // Mon..Sun, hours as typed
  startDate: string; // "" means today
  exportMode: ExportMode;
  startTime: string; // "HH:MM"
};

const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const PRIORITY_WEIGHT: Record<Priority, number> = { high: 3, medium: 2, low: 1 };
const NO_DEADLINE_PACE_DAYS = 28;
const MAX_HOURS = 500;

const INITIAL: PlannerState = {
  subjects: [],
  availability: ["2", "2", "2", "2", "2", "3", "3"],
  startDate: "",
  exportMode: "timed",
  startTime: "18:00",
};

/* ------------------------------------------------------------------ */
/* Date helpers (dates are "YYYY-MM-DD" strings, math done in UTC)     */
/* ------------------------------------------------------------------ */

const DAY_MS = 86_400_000;

function isoToUtc(iso: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  const t = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const d = new Date(t);
  if (d.getUTCFullYear() !== Number(m[1]) || d.getUTCMonth() !== Number(m[2]) - 1 || d.getUTCDate() !== Number(m[3])) return null;
  return t;
}
const pad = (n: number, w = 2) => String(n).padStart(w, "0");
function utcToIso(t: number) {
  const d = new Date(t);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}
const addDays = (iso: string, n: number) => utcToIso((isoToUtc(iso) ?? 0) + n * DAY_MS);
const diffDays = (from: string, to: string) => Math.round(((isoToUtc(to) ?? 0) - (isoToUtc(from) ?? 0)) / DAY_MS);
const weekdayIdx = (iso: string) => (new Date(isoToUtc(iso) ?? 0).getUTCDay() + 6) % 7;
const dateLabel = (iso: string) =>
  new Date(isoToUtc(iso) ?? 0).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });

function localTodayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
const noopSubscribe = () => () => {};

/* ------------------------------------------------------------------ */
/* Planning logic                                                      */
/* ------------------------------------------------------------------ */

const hrs = (units: number) => `${fmt(units / 2, 1)}h`;

type SubjectEval = {
  errors: { name?: string; hours?: string; deadline?: string };
  incomplete: boolean;
  doneTopics: number;
  totalTopics: number;
  remainingUnits: number; // half-hour blocks
};

function evalSubject(s: Subject): SubjectEval {
  const errors: SubjectEval["errors"] = {};
  const h = parseNum(s.hours);
  if (s.hours.trim() !== "") {
    if (h === null) errors.hours = "Hours must be a number, like 6 or 7.5.";
    else if (h <= 0) errors.hours = "Hours must be more than 0.";
    else if (h > MAX_HOURS) errors.hours = `That looks too high (max ${MAX_HOURS} hours).`;
  }
  if (s.deadline && isoToUtc(s.deadline) === null) errors.deadline = "Enter a valid date.";
  const incomplete = !s.name.trim() || s.hours.trim() === "";
  const totalTopics = s.topics.length;
  const doneTopics = s.topics.filter((t) => t.done).length;
  let remainingUnits = 0;
  if (h !== null && !errors.hours) {
    const remainingHours = totalTopics > 0 ? (h * (totalTopics - doneTopics)) / totalTopics : h;
    remainingUnits = Math.max(0, Math.ceil(remainingHours * 2 - 1e-9));
  }
  return { errors, incomplete, doneTopics, totalTopics, remainingUnits };
}

type Session = { subjectId: string; name: string; units: number };
type DayPlan = { iso: string; capUnits: number; sessions: Session[]; usedUnits: number };
type Warning = { key: string; text: string };

function buildPlan(subjects: Subject[], evals: SubjectEval[], availHours: number[], start: string) {
  const days: DayPlan[] = Array.from({ length: 7 }, (_, i) => {
    const iso = addDays(start, i);
    return { iso, capUnits: Math.floor(availHours[weekdayIdx(iso)] * 2 + 1e-9), sessions: [], usedUnits: 0 };
  });
  const warnings: Warning[] = [];
  const notes: Warning[] = [];

  type Item = { s: Subject; e: SubjectEval; daysLeft: number | null };
  const items: Item[] = [];
  subjects.forEach((s, i) => {
    const e = evals[i];
    if (e.incomplete || e.errors.hours || e.errors.deadline) return;
    const label = s.name.trim();
    if (e.remainingUnits === 0) {
      notes.push({ key: `done-${s.id}`, text: `${label}: every topic is done, so no time is planned.` });
      return;
    }
    const daysLeft = s.deadline ? diffDays(start, s.deadline) : null;
    if (daysLeft !== null && daysLeft < 0) {
      warnings.push({ key: `past-${s.id}`, text: `${label}: the date ${dateLabel(s.deadline)} has already passed, so it is left out. Update the date to plan it.` });
      return;
    }
    if (daysLeft === 0) {
      warnings.push({ key: `today-${s.id}`, text: `${label} is due on the plan's first day, so there are no study days before it.` });
      return;
    }
    items.push({ s, e, daysLeft });
  });

  // 1. Order: nearest deadline first (no date last), then higher priority, then name.
  items.sort((a, b) => {
    const da = a.daysLeft ?? Number.POSITIVE_INFINITY;
    const db = b.daysLeft ?? Number.POSITIVE_INFINITY;
    if (da !== db) return da - db;
    const pw = PRIORITY_WEIGHT[b.s.priority] - PRIORITY_WEIGHT[a.s.priority];
    if (pw !== 0) return pw;
    const n = a.s.name.trim().localeCompare(b.s.name.trim());
    return n !== 0 ? n : a.s.id.localeCompare(b.s.id);
  });

  const allocated = new Map<string, number>();
  for (const { s, e, daysLeft } of items) {
    const label = s.name.trim();
    const paceDays = daysLeft ?? NO_DEADLINE_PACE_DAYS;
    // 2. This week's share: everything if the date is within 7 days, otherwise a pro-rated slice.
    const target = paceDays <= 7 ? e.remainingUnits : Math.ceil((e.remainingUnits * 7) / paceDays);
    const eligible = days.filter((_, i) => i < Math.min(7, paceDays));
    let left = target;
    const give = (d: DayPlan, amount: number) => {
      if (amount <= 0) return;
      const existing = d.sessions.find((x) => x.subjectId === s.id);
      if (existing) existing.units += amount;
      else d.sessions.push({ subjectId: s.id, name: label, units: amount });
      d.usedUnits += amount;
      left -= amount;
    };
    // 3. Spread evenly across eligible days, then pour leftovers into the earliest free time.
    const perDay = Math.ceil(target / Math.max(1, eligible.length));
    for (const d of eligible) give(d, Math.min(perDay, left, d.capUnits - d.usedUnits));
    for (const d of eligible) give(d, Math.min(left, d.capUnits - d.usedUnits));
    allocated.set(s.id, target - left);

    if (left > 0) {
      if (daysLeft !== null && daysLeft <= 7)
        warnings.push({
          key: `short-${s.id}`,
          text: `${label}: ${hrs(left)} of the ${hrs(e.remainingUnits)} needed does not fit before ${dateLabel(s.deadline)}. Add study time, start earlier or lower the estimate.`,
        });
      else
        warnings.push({
          key: `pace-${s.id}`,
          text: `${label}: ${hrs(left)} of this week's ${hrs(target)} share did not fit. You will fall behind the pace needed${daysLeft !== null ? ` for ${dateLabel(s.deadline)}` : ""}.`,
        });
    }
  }

  // 4. Long-range check: for each later date, compare all work due by then with the time available before it.
  const dated = items.filter((x) => x.daysLeft !== null).sort((a, b) => (a.daysLeft ?? 0) - (b.daysLeft ?? 0));
  let cumulative = 0;
  const names: string[] = [];
  let capacity = 0;
  let counted = 0;
  for (const it of dated) {
    cumulative += it.e.remainingUnits;
    names.push(it.s.name.trim());
    const dl = it.daysLeft ?? 0;
    while (counted < dl) {
      capacity += Math.floor(availHours[weekdayIdx(addDays(start, counted))] * 2 + 1e-9);
      counted++;
    }
    if (dl > 7 && cumulative > capacity) {
      warnings.push({
        key: `range-${it.s.id}`,
        text: `By ${dateLabel(it.s.deadline)} you need ${hrs(cumulative)} for ${names.join(", ")}, but only ${hrs(capacity)} of study time is available before then.`,
      });
    }
  }

  // Keep sessions in subject order within each day.
  const order = new Map(items.map((it, i) => [it.s.id, i]));
  days.forEach((d) => d.sessions.sort((a, b) => (order.get(a.subjectId) ?? 0) - (order.get(b.subjectId) ?? 0)));

  const totalNeeded = items.reduce((sum, it) => sum + it.e.remainingUnits, 0);
  return { days, warnings, notes, allocated, totalNeeded, planned: items.length };
}

/* ------------------------------------------------------------------ */
/* iCalendar export                                                    */
/* ------------------------------------------------------------------ */

function icsEscape(s: string) {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** Folds a content line to at most 75 octets per line (RFC 5545 section 3.1). */
function foldLine(line: string): string {
  const enc = new TextEncoder();
  const out: string[] = [];
  let current = "";
  let bytes = 0;
  for (const ch of Array.from(line)) {
    const b = enc.encode(ch).length;
    const limit = out.length === 0 ? 75 : 74; // continuation lines start with a space
    if (bytes + b > limit) {
      out.push(current);
      current = "";
      bytes = 0;
    }
    current += ch;
    bytes += b;
  }
  out.push(current);
  return out.join("\r\n ");
}

const icsDate = (iso: string) => iso.replace(/-/g, "");
function icsLocalDateTime(t: number) {
  const d = new Date(t);
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}00`;
}
function icsStamp(now: Date) {
  return `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}T${pad(now.getUTCHours())}${pad(
    now.getUTCMinutes(),
  )}${pad(now.getUTCSeconds())}Z`;
}

function buildIcs(days: DayPlan[], mode: ExportMode, startTime: string, subjects: Subject[]) {
  const stamp = icsStamp(new Date());
  const [hh, mm] = startTime.split(":").map(Number);
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//NuvellaPromoCode//Study Planner//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH"];
  for (const d of days) {
    let cursor = (isoToUtc(d.iso) ?? 0) + (hh * 60 + mm) * 60_000;
    for (const s of d.sessions) {
      const subj = subjects.find((x) => x.id === s.subjectId);
      const open = subj ? subj.topics.filter((t) => !t.done).map((t) => t.text.trim()).filter(Boolean) : [];
      const desc = `Planned study: ${hrs(s.units)}.${open.length ? ` Topics left: ${open.join(", ")}.` : ""}`;
      lines.push("BEGIN:VEVENT", `UID:${uid()}@stratum-study-planner`, `DTSTAMP:${stamp}`);
      if (mode === "allday") {
        lines.push(`DTSTART;VALUE=DATE:${icsDate(d.iso)}`, `DTEND;VALUE=DATE:${icsDate(addDays(d.iso, 1))}`, "TRANSP:TRANSPARENT");
      } else {
        const end = cursor + s.units * 30 * 60_000;
        lines.push(`DTSTART:${icsLocalDateTime(cursor)}`, `DTEND:${icsLocalDateTime(end)}`);
        cursor = end;
      }
      lines.push(`SUMMARY:${icsEscape(`Study: ${s.name} (${hrs(s.units)})`)}`, `DESCRIPTION:${icsEscape(desc)}`, "END:VEVENT");
    }
  }
  lines.push("END:VCALENDAR");
  return lines.map(foldLine).join("\r\n") + "\r\n";
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export default function Tool() {
  const [stored, setState, clear] = usePersistentState<PlannerState>("study-planner", INITIAL);
  const state: PlannerState = {
    ...INITIAL,
    ...stored,
    subjects: Array.isArray(stored.subjects) ? stored.subjects.map((s) => ({ ...s, topics: Array.isArray(s.topics) ? s.topics : [] })) : [],
    availability: Array.isArray(stored.availability) && stored.availability.length === 7 ? stored.availability : INITIAL.availability,
  };
  const update = (fn: (s: PlannerState) => PlannerState) =>
    setState((p) => fn({ ...INITIAL, ...p, subjects: Array.isArray(p.subjects) ? p.subjects : [] }));

  const today = useSyncExternalStore(noopSubscribe, localTodayIso, () => "");
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  /* ---------- derived ---------- */
  const startValid = state.startDate !== "" && isoToUtc(state.startDate) !== null;
  const start = startValid ? state.startDate : today;

  const availChecks = state.availability.map((raw) => {
    if (raw.trim() === "") return { hours: 0, error: null as string | null };
    const n = parseNum(raw);
    if (n === null) return { hours: 0, error: "Enter a number of hours." };
    if (n < 0) return { hours: 0, error: "Hours cannot be negative." };
    if (n > 24) return { hours: 0, error: "A day has at most 24 hours." };
    return { hours: n, error: null };
  });
  const availHours = availChecks.map((a) => a.hours);
  const weeklyHours = availHours.reduce((a, b) => a + b, 0);

  const evals = state.subjects.map(evalSubject);
  const plan = start ? buildPlan(state.subjects, evals, availHours, start) : null;
  const timeValid = /^([01]\d|2[0-3]):[0-5]\d$/.test(state.startTime);
  const hasSessions = Boolean(plan && plan.days.some((d) => d.sessions.length > 0));

  const planText = (() => {
    if (!plan || !hasSessions) return "";
    const first = plan.days[0].iso;
    const last = plan.days[6].iso;
    const lines = [`Study plan: ${dateLabel(first)} to ${dateLabel(last)}`, ""];
    for (const d of plan.days) {
      lines.push(
        `${dateLabel(d.iso)}: ${d.sessions.length ? d.sessions.map((s) => `${s.name} ${hrs(s.units)}`).join(", ") : "No study planned"}`,
      );
    }
    if (plan.warnings.length) {
      lines.push("", "Warnings:");
      plan.warnings.forEach((w) => lines.push(`- ${w.text}`));
    }
    return lines.join("\n");
  })();

  /* ---------- ops ---------- */
  const patchSubject = (id: string, p: Partial<Subject>) =>
    update((s) => ({ ...s, subjects: s.subjects.map((x) => (x.id === id ? { ...x, ...p } : x)) }));
  const addSubject = () =>
    update((s) => ({
      ...s,
      subjects: [...s.subjects, { id: uid(), name: "", deadline: "", priority: "medium", hours: "", topics: [] }],
    }));
  const removeSubject = (id: string, label: string) => {
    if (typeof window !== "undefined" && !window.confirm(`Remove ${label} and its topics?`)) return;
    update((s) => ({ ...s, subjects: s.subjects.filter((x) => x.id !== id) }));
  };
  const addTopic = (subjectId: string) => {
    const text = (drafts[subjectId] ?? "").trim();
    if (!text) return;
    update((s) => ({
      ...s,
      subjects: s.subjects.map((x) => (x.id === subjectId ? { ...x, topics: [...x.topics, { id: uid(), text, done: false }] } : x)),
    }));
    setDrafts((d) => ({ ...d, [subjectId]: "" }));
  };
  const patchTopic = (subjectId: string, topicId: string, p: Partial<Topic>) =>
    update((s) => ({
      ...s,
      subjects: s.subjects.map((x) =>
        x.id === subjectId ? { ...x, topics: x.topics.map((t) => (t.id === topicId ? { ...t, ...p } : t)) } : x,
      ),
    }));
  const removeTopic = (subjectId: string, topicId: string) =>
    update((s) => ({
      ...s,
      subjects: s.subjects.map((x) => (x.id === subjectId ? { ...x, topics: x.topics.filter((t) => t.id !== topicId) } : x)),
    }));
  const setAvail = (i: number, v: string) =>
    update((s) => ({ ...s, availability: s.availability.map((a, j) => (j === i ? v : a)) }));

  const exportIcs = () => {
    if (!plan || !hasSessions) return;
    downloadFile(`study-plan-${plan.days[0].iso}.ics`, buildIcs(plan.days, state.exportMode, timeValid ? state.startTime : "18:00", state.subjects), "text/calendar");
  };

  /* ---------- render ---------- */
  return (
    <div className="space-y-5">
      <ToolPanel
        title="Subjects"
        actions={
          <>
            <Btn variant="ghost" icon="plus" onClick={addSubject}>
              Add subject
            </Btn>
            <ResetBtn
              label="Reset all"
              onClick={() => {
                if (window.confirm("Delete all subjects, topics and availability? This cannot be undone.")) {
                  clear();
                  setDrafts({});
                }
              }}
            />
          </>
        }
      >
        {state.subjects.length === 0 ? (
          <EmptyState icon="book" title="No subjects yet">
            Add each course or exam you are preparing for, with an estimate of the hours it needs.
          </EmptyState>
        ) : (
          <ol className="space-y-4">
            {state.subjects.map((s, i) => {
              const e = evals[i];
              const label = s.name.trim() || `Subject ${i + 1}`;
              const pct = e.totalTopics ? Math.round((e.doneTopics / e.totalTopics) * 100) : 0;
              const draft = drafts[s.id] ?? "";
              return (
                <li key={s.id} className="rounded-xl bg-sunken p-4 sm:p-5">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <h3 className="font-sans text-[1rem] font-semibold tracking-normal [overflow-wrap:anywhere]">{label}</h3>
                    <Btn variant="danger" icon="trash" onClick={() => removeSubject(s.id, label)} aria-label={`Remove ${label}`}>
                      Remove
                    </Btn>
                  </div>

                  <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <TextField
                      label="Subject name"
                      placeholder="e.g. Data Structures"
                      autoComplete="off"
                      value={s.name}
                      onChange={(ev) => patchSubject(s.id, { name: ev.target.value })}
                    />
                    <TextField
                      label="Exam or deadline"
                      optional
                      type="date"
                      value={s.deadline}
                      error={e.errors.deadline}
                      onChange={(ev) => patchSubject(s.id, { deadline: ev.target.value })}
                    />
                    <SelectField
                      label="Priority"
                      value={s.priority}
                      options={[
                        { value: "high", label: "High" },
                        { value: "medium", label: "Medium" },
                        { value: "low", label: "Low" },
                      ]}
                      onChange={(ev) => patchSubject(s.id, { priority: ev.target.value as Priority })}
                    />
                    <NumberField
                      label="Hours needed"
                      placeholder="e.g. 12"
                      value={s.hours}
                      error={e.errors.hours}
                      onChange={(ev) => patchSubject(s.id, { hours: ev.target.value })}
                    />
                  </div>

                  {e.incomplete && (
                    <p className="mt-3 text-[0.8125rem] text-muted">Add a name and hours needed to include this subject in the plan.</p>
                  )}

                  <div className="mt-4">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p className="text-sm font-medium text-ink">Topics</p>
                      <p className="text-[0.8125rem] text-ink-2 tabular-nums">
                        {e.totalTopics
                          ? `${e.doneTopics} of ${e.totalTopics} done (${pct}%), ${hrs(e.remainingUnits)} left`
                          : "No topics yet"}
                      </p>
                    </div>
                    {e.totalTopics > 0 && (
                      <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface shadow-[inset_0_0_0_1px_var(--line)]" aria-hidden="true">
                        <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
                      </div>
                    )}
                    {s.topics.length > 0 && (
                      <ul className="mt-3 space-y-1">
                        {s.topics.map((t) => (
                          <li key={t.id} className="flex min-h-10 items-center justify-between gap-2">
                            <div className={`min-w-0 [overflow-wrap:anywhere] ${t.done ? "text-muted line-through" : ""}`}>
                              <Checkbox
                                label={
                                  <>
                                    {t.text}
                                    <span className="sr-only">{t.done ? " (done)" : ""}</span>
                                  </>
                                }
                                checked={t.done}
                                onChange={(v) => patchTopic(s.id, t.id, { done: v })}
                              />
                            </div>
                            <Btn
                              variant="subtle"
                              icon="close"
                              className="w-10 shrink-0 !px-0"
                              aria-label={`Remove topic ${t.text} from ${label}`}
                              onClick={() => removeTopic(s.id, t.id)}
                            />
                          </li>
                        ))}
                      </ul>
                    )}
                    <form
                      className="mt-3 flex gap-2"
                      onSubmit={(ev) => {
                        ev.preventDefault();
                        addTopic(s.id);
                      }}
                    >
                      <CellInput
                        label={`New topic for ${label}`}
                        placeholder="Add a topic, e.g. Binary trees"
                        autoComplete="off"
                        maxLength={120}
                        value={draft}
                        className="min-w-0 flex-1"
                        onChange={(ev) => setDrafts((d) => ({ ...d, [s.id]: ev.target.value }))}
                      />
                      <Btn type="submit" variant="ghost" icon="plus" disabled={!draft.trim()}>
                        Add
                      </Btn>
                    </form>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </ToolPanel>

      <ToolPanel title="Weekly availability">
        <div className="space-y-4">
          <p className="text-sm text-ink-2">Hours you can study on each weekday. Leave a day empty or at 0 to keep it free.</p>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-7">
            {WEEKDAYS.map((d, i) => (
              <NumberField
                key={d}
                label={d}
                value={state.availability[i]}
                placeholder="0"
                error={availChecks[i].error}
                onChange={(e) => setAvail(i, e.target.value)}
              />
            ))}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              label="Plan starts on"
              type="date"
              value={start}
              hint="The plan covers 7 days from this date. Defaults to today."
              onChange={(e) => update((s) => ({ ...s, startDate: e.target.value }))}
            />
            <div className="self-end">
              <p className="text-sm text-ink-2 tabular-nums" aria-live="polite">
                Total available: <span className="font-semibold text-ink">{fmt(weeklyHours, 2)} hours per week</span>
              </p>
              {state.startDate && (
                <Btn variant="subtle" className="mt-2" onClick={() => update((s) => ({ ...s, startDate: "" }))}>
                  Start from today
                </Btn>
              )}
            </div>
          </div>
        </div>
      </ToolPanel>

      <ToolPanel
        title="Your week"
        actions={
          <>
            <CopyBtn text={planText} label="Copy plan" />
            <Btn variant="ghost" icon="download" disabled={!hasSessions} onClick={exportIcs}>
              Download .ics
            </Btn>
          </>
        }
      >
        <div className="space-y-5">
          <details className="rounded-lg bg-sunken px-4 py-3 text-sm text-ink-2">
            <summary className="cursor-pointer font-medium text-ink">How the plan is built</summary>
            <ol className="mt-2 list-decimal space-y-1 pl-5">
              <li>Hours left for a subject = hours needed × share of topics not done yet, rounded up to half hours.</li>
              <li>Subjects are ordered by nearest date first, then priority (high, medium, low), then name.</li>
              <li>
                If the date is within 7 days, all remaining hours go into this week. Otherwise the week gets a fair slice
                (hours left × 7 ÷ days to go). Subjects without a date are paced over {NO_DEADLINE_PACE_DAYS} days.
              </li>
              <li>
                Each subject is spread evenly over the days before its date, in half-hour blocks. If a day is full, the
                rest goes to the earliest day with free time.
              </li>
              <li>No study is planned on the day of an exam or deadline.</li>
            </ol>
          </details>

          {!plan ? (
            <EmptyState icon="calendar" title="Loading your plan" />
          ) : plan.planned === 0 ? (
            <EmptyState icon="calendar" title="Nothing to plan yet">
              Add a subject with a name and hours needed to build your week.
            </EmptyState>
          ) : (
            <>
              {plan.warnings.length > 0 && (
                <Notice tone="warning" title="Not everything fits">
                  <ul className="list-disc space-y-1 pl-4">
                    {plan.warnings.map((w) => (
                      <li key={w.key}>{w.text}</li>
                    ))}
                  </ul>
                </Notice>
              )}
              {plan.notes.length > 0 && (
                <Notice tone="success">
                  <ul className="space-y-1">
                    {plan.notes.map((w) => (
                      <li key={w.key}>{w.text}</li>
                    ))}
                  </ul>
                </Notice>
              )}
              {weeklyHours === 0 && (
                <Notice tone="warning">You have 0 hours of availability. Add study hours to at least one weekday.</Notice>
              )}
              <StatGrid
                items={[
                  { label: "Hours left in total", value: hrs(plan.totalNeeded) },
                  { label: "Planned this week", value: hrs(plan.days.reduce((a, d) => a + d.usedUnits, 0)) },
                  { label: "Free this week", value: hrs(plan.days.reduce((a, d) => a + d.capUnits - d.usedUnits, 0)) },
                ]}
              />
              <ol className="divide-y divide-line overflow-hidden rounded-xl shadow-[0_0_0_1px_var(--line)]" aria-label="Day by day schedule">
                {plan.days.map((d) => (
                  <li key={d.iso} className="grid gap-2 bg-surface px-4 py-3 sm:grid-cols-[9rem_minmax(0,1fr)] sm:items-start">
                    <div>
                      <p className="font-medium text-ink">{dateLabel(d.iso)}</p>
                      <p className="text-[0.8125rem] text-muted tabular-nums">
                        {d.capUnits === 0 ? "No study time" : `${hrs(d.usedUnits)} of ${hrs(d.capUnits)} used`}
                      </p>
                    </div>
                    {d.sessions.length ? (
                      <ul className="flex flex-wrap gap-2">
                        {d.sessions.map((s) => (
                          <li key={s.subjectId} className="chip h-auto min-h-8 py-1 [overflow-wrap:anywhere]">
                            <span className="text-ink">{s.name}</span>
                            <span className="font-medium tabular-nums text-accent-strong">{hrs(s.units)}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-muted">{d.capUnits === 0 ? "Free day" : "Nothing scheduled"}</p>
                    )}
                  </li>
                ))}
              </ol>

              <div className="space-y-3 rounded-xl bg-sunken p-4">
                <p className="text-sm font-medium text-ink">Calendar export</p>
                <Segmented<ExportMode>
                  label="Calendar event type"
                  value={state.exportMode}
                  onChange={(v) => update((s) => ({ ...s, exportMode: v }))}
                  options={[
                    { value: "timed", label: "Timed sessions" },
                    { value: "allday", label: "All-day events" },
                  ]}
                />
                {state.exportMode === "timed" ? (
                  <TextField
                    label="Daily start time"
                    type="time"
                    className="max-w-[12rem]"
                    value={state.startTime}
                    error={timeValid ? null : "Enter a time like 18:00."}
                    hint="Sessions run back to back from this time, in your calendar's local time zone."
                    onChange={(e) => update((s) => ({ ...s, startTime: e.target.value }))}
                  />
                ) : (
                  <p className="text-[0.8125rem] text-muted">Each session becomes an all-day event that does not block your calendar.</p>
                )}
                {!hasSessions && <p className="text-[0.8125rem] text-muted">Download is available once at least one session is planned.</p>}
              </div>
            </>
          )}
        </div>
      </ToolPanel>

      <PrivacyNote stored />
    </div>
  );
}

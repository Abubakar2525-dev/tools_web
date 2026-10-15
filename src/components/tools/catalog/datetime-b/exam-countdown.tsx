"use client";

import { useState } from "react";
import { Btn, EmptyState, PrivacyNote, TextField, ToolPanel, uid, usePersistentState } from "@/components/tools/kit";
import { Icon } from "@/components/ui/Icon";
import { countdownParts, dayKey, diffDays, isDayKey, parseHHMM } from "./lib/dates";
import { examInitial, normalizeExams, type Exam, type ExamState } from "./lib/schema";
import { BackupBar, PrintArea, fmtDay, useNow } from "./shared";

/** Exam start as local epoch ms (no time = start of day). */
function examMs(e: Exam) {
  const [y, m, d] = e.date.split("-").map(Number);
  const min = parseHHMM(e.time) ?? 0;
  return new Date(y, m - 1, d, Math.floor(min / 60), min % 60).getTime();
}

function label(e: Exam, today: string) {
  const days = diffDays(today, e.date);
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days <= 7) return "This week";
  return null;
}

const EMPTY_FORM = { subject: "", date: "", time: "", location: "", notes: "" };

export default function Tool() {
  const [state, setState, clear] = usePersistentState<ExamState>("exam-countdown", examInitial);
  const now = useNow(1000);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editing, setEditing] = useState<string | null>(null);
  const [errors, setErrors] = useState<{ subject?: string; date?: string }>({});

  const today = now === null ? "" : dayKey(new Date(now));
  const sorted = [...state.exams].sort((a, b) => examMs(a) - examMs(b));
  // An exam with no time stays "upcoming" for its whole day.
  const isPast = (e: Exam) => now !== null && (e.time ? examMs(e) + 3 * 3600_000 < now : e.date < today);
  const upcoming = sorted.filter((e) => !isPast(e));
  const past = sorted.filter(isPast).reverse();
  const next = upcoming[0];

  const submit = (ev: React.FormEvent) => {
    ev.preventDefault();
    const errs: typeof errors = {};
    if (!form.subject.trim()) errs.subject = "Enter the exam or subject.";
    if (!isDayKey(form.date)) errs.date = "Choose the exam date.";
    setErrors(errs);
    if (errs.subject || errs.date) return;
    const exam: Exam = {
      id: editing ?? uid(),
      subject: form.subject.trim().slice(0, 120),
      date: form.date,
      time: parseHHMM(form.time) !== null ? form.time : "",
      location: form.location.trim().slice(0, 120),
      notes: form.notes.trim().slice(0, 500),
    };
    setState((s) => ({ exams: editing ? s.exams.map((x) => (x.id === editing ? exam : x)) : [...s.exams, exam] }));
    setForm(EMPTY_FORM);
    setEditing(null);
  };

  const countdown = (e: Exam) => {
    if (now === null) return "";
    const ms = examMs(e) - now;
    if (ms <= 0) return e.time ? "Started" : "Today";
    const p = countdownParts(ms);
    if (p.days >= 1) return `${p.days} d ${p.hours} h ${p.minutes} min`;
    return `${p.hours} h ${p.minutes} min ${p.seconds} s`;
  };

  const card = (e: Exam, highlight: boolean) => {
    const tag = today ? label(e, today) : null;
    return (
      <li
        key={e.id}
        className={`rounded-xl p-4 ${highlight ? "bg-accent-soft shadow-[inset_0_0_0_1.5px_var(--accent)]" : "bg-sunken"}`}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              {highlight && <span className="rounded-full bg-accent px-2 py-0.5 text-[0.7rem] font-medium text-white">Next exam</span>}
              {tag && <span className="rounded-full bg-surface px-2 py-0.5 text-[0.7rem] font-medium text-ink-2 shadow-sm">{tag}</span>}
            </div>
            <h3 className="mt-1 break-words font-sans text-[1.05rem] font-semibold text-ink">{e.subject}</h3>
            <p className="text-sm text-ink-2">
              {fmtDay(e.date, { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
              {e.time && ` at ${e.time}`}
              {e.location && ` · ${e.location}`}
            </p>
            {e.notes && <p className="mt-1 whitespace-pre-wrap break-words text-[0.85rem] text-muted">{e.notes}</p>}
          </div>
          <div className="text-right">
            <p className={`font-display font-semibold tabular-nums tracking-[-0.02em] text-ink ${highlight ? "text-[1.6rem]" : "text-[1.15rem]"}`}>
              {countdown(e)}
            </p>
            {today && diffDays(today, e.date) > 0 && (
              <p className="text-[0.78rem] text-muted">
                {diffDays(today, e.date)} day{diffDays(today, e.date) === 1 ? "" : "s"} to go
              </p>
            )}
          </div>
        </div>
        <div className="mt-2 flex gap-1">
          <Btn
            variant="subtle"
            icon="pen"
            onClick={() => {
              setEditing(e.id);
              setForm({ subject: e.subject, date: e.date, time: e.time, location: e.location, notes: e.notes });
              setErrors({});
            }}
          >
            Edit
          </Btn>
          <Btn variant="subtle" icon="trash" className="hover:!text-danger" onClick={() => setState((s) => ({ exams: s.exams.filter((x) => x.id !== e.id) }))}>
            Delete
          </Btn>
        </div>
      </li>
    );
  };

  return (
    <div className="space-y-5">
      <ToolPanel title={editing ? "Edit exam" : "Add an exam"}>
        <form onSubmit={submit} noValidate className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <TextField label="Exam or subject" value={form.subject} maxLength={120} error={errors.subject} placeholder="Organic chemistry final" onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))} />
            <TextField label="Date" type="date" value={form.date} error={errors.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} />
            <TextField label="Start time" type="time" optional value={form.time} onChange={(e) => setForm((f) => ({ ...f, time: e.target.value }))} />
            <TextField label="Location" optional value={form.location} maxLength={120} placeholder="Hall B" onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))} />
          </div>
          <TextField label="Notes" optional value={form.notes} maxLength={500} placeholder="Allowed: calculator, one formula sheet" onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
          <div className="flex gap-2">
            <Btn type="submit" icon={editing ? "check" : "plus"}>
              {editing ? "Save changes" : "Add exam"}
            </Btn>
            {editing && (
              <Btn
                variant="subtle"
                onClick={() => {
                  setEditing(null);
                  setForm(EMPTY_FORM);
                  setErrors({});
                }}
              >
                Cancel
              </Btn>
            )}
          </div>
        </form>
      </ToolPanel>

      <ToolPanel title="Countdowns">
        {state.exams.length === 0 ? (
          <EmptyState icon="deadline" title="No exams yet">
            Add your exams and each one gets a live countdown. The nearest exam is highlighted.
          </EmptyState>
        ) : (
          <div className="space-y-6">
            {upcoming.length > 0 ? (
              <ul className="space-y-3" aria-label="Upcoming exams">
                {upcoming.map((e) => card(e, e === next))}
              </ul>
            ) : (
              <p className="flex items-center gap-2 text-sm text-ink-2">
                <Icon name="check" size={16} className="text-accent" /> No upcoming exams. All done.
              </p>
            )}
            {past.length > 0 && (
              <details>
                <summary className="cursor-pointer text-sm font-medium text-ink-2">Finished exams ({past.length})</summary>
                <ul className="mt-3 space-y-2">
                  {past.map((e) => (
                    <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-sunken px-3 py-2 text-sm">
                      <span className="text-ink-2">
                        <span className="mr-2 text-[0.72rem] font-medium uppercase tracking-wide text-muted">Finished</span>
                        {e.subject} · {fmtDay(e.date)}
                      </span>
                      <button
                        type="button"
                        className="grid h-10 w-10 place-items-center rounded-lg text-muted hover:bg-surface hover:text-danger"
                        aria-label={`Delete ${e.subject}`}
                        onClick={() => setState((s) => ({ exams: s.exams.filter((x) => x.id !== e.id) }))}
                      >
                        <Icon name="trash" size={15} />
                      </button>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        )}
      </ToolPanel>

      <ToolPanel>
        <div className="space-y-4">
          <BackupBar<ExamState>
            tool="exam-countdown"
            data={state}
            normalize={normalizeExams}
            onImport={(v) => setState(v)}
            onClear={clear}
            hasData={state.exams.length > 0}
            printLabel="Print schedule"
          />
          <PrivacyNote stored />
        </div>
      </ToolPanel>

      <PrintArea>
        <h2>Exam schedule</h2>
        {today && <p className="meta">Printed {fmtDay(today, { weekday: "long", month: "long", day: "numeric", year: "numeric" })}</p>}
        <table>
          <thead>
            <tr>
              <th>Exam</th>
              <th>Date</th>
              <th>Time</th>
              <th>Location</th>
              <th>Days left</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {upcoming.map((e) => (
              <tr key={e.id}>
                <td>
                  <strong>{e.subject}</strong>
                </td>
                <td>{fmtDay(e.date)}</td>
                <td>{e.time || "-"}</td>
                <td>{e.location || "-"}</td>
                <td>{today ? Math.max(0, diffDays(today, e.date)) : ""}</td>
                <td>{e.notes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </PrintArea>
    </div>
  );
}

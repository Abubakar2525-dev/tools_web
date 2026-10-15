"use client";

import { useState } from "react";
import { Btn, EmptyState, Notice, NumberField, PrivacyNote, SelectField, StatGrid, TextField, ToolPanel, inputCls, parseNum, uid, usePersistentState } from "@/components/tools/kit";
import { Icon } from "@/components/ui/Icon";
import { addDays, dayKey, fmtClockMs, fmtMinutes, isDayKey } from "./lib/dates";
import { normalizeStudyTimer, studyTimerInitial, type Session, type StudyTimerState } from "./lib/schema";
import { BackupBar, PrintArea, SubHead, fmtDay, useNow } from "./shared";

const MIN_SAVE_MS = 10_000;

export default function Tool() {
  const [state, setState, clear] = usePersistentState<StudyTimerState>("study-timer", studyTimerInitial);
  const now = useNow(1000);
  const [subjectDraft, setSubjectDraft] = useState({ name: "", goal: "60" });
  const [subjectError, setSubjectError] = useState<string | null>(null);
  const [picked, setPicked] = useState("");
  const [manual, setManual] = useState({ subjectId: "", minutes: "", date: "" });
  const [manualError, setManualError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const { subjects, sessions, active } = state;
  const today = now === null ? "" : dayKey(new Date(now));
  const subjectId = active?.subjectId ?? (subjects.some((s) => s.id === picked) ? picked : (subjects[0]?.id ?? ""));
  const elapsed = active ? active.accumulated + (active.startedAt !== null && now !== null ? Math.max(0, now - active.startedAt) : 0) : 0;
  const name = (id: string) => subjects.find((s) => s.id === id)?.name ?? "Unknown";

  const minutesOn = (sid: string, day: string) =>
    sessions.filter((s) => s.subjectId === sid && s.day === day).reduce((a, s) => a + s.ms, 0) / 60000 +
    (active && active.subjectId === sid && active.day === day ? elapsed / 60000 : 0);

  const start = () => {
    if (!subjectId || now === null) return;
    const t = Date.now();
    setNotice(null);
    setState((s) => ({ ...s, active: { subjectId, startedAt: t, accumulated: 0, day: dayKey(new Date(t)), firstStart: t } }));
  };
  const pause = () =>
    setState((s) => (s.active && s.active.startedAt !== null ? { ...s, active: { ...s.active, accumulated: s.active.accumulated + (Date.now() - s.active.startedAt), startedAt: null } } : s));
  const resume = () => setState((s) => (s.active && s.active.startedAt === null ? { ...s, active: { ...s.active, startedAt: Date.now() } } : s));
  const stop = (save: boolean) => {
    setState((s) => {
      if (!s.active) return s;
      const a = s.active;
      const ms = a.accumulated + (a.startedAt !== null ? Date.now() - a.startedAt : 0);
      if (!save || ms < MIN_SAVE_MS) return { ...s, active: null };
      const session: Session = { id: uid(), subjectId: a.subjectId, start: a.firstStart, ms: Math.round(ms), day: a.day };
      return { ...s, sessions: [...s.sessions, session], active: null };
    });
    if (save && elapsed < MIN_SAVE_MS) setNotice("Sessions shorter than 10 seconds aren't saved.");
    else if (save) setNotice(`Saved ${fmtClockMs(elapsed)} of ${name(active?.subjectId ?? "")}.`);
  };

  const last7 = today ? Array.from({ length: 7 }, (_, i) => addDays(today, i - 6)) : [];
  const todayTotal = subjects.reduce((a, s) => a + (today ? minutesOn(s.id, today) : 0), 0);
  const goalTotal = subjects.reduce((a, s) => a + s.goal, 0);
  const weekTotal = last7.reduce((a, d) => a + subjects.reduce((b, s) => b + minutesOn(s.id, d), 0), 0);
  const recent = [...sessions].sort((a, b) => b.start - a.start).slice(0, 25);

  return (
    <div className="space-y-5">
      <ToolPanel title="Study timer">
        {subjects.length === 0 ? (
          <EmptyState icon="timer" title="Add a subject to start">
            Each subject has its own daily goal. Time you track is logged per subject and per day.
          </EmptyState>
        ) : (
          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
              <SelectField
                label="Subject"
                value={subjectId}
                disabled={!!active}
                hint={active ? "Stop the current session to switch subjects." : undefined}
                onChange={(e) => setPicked(e.target.value)}
                options={subjects.map((s) => ({ value: s.id, label: s.name }))}
              />
            </div>
            <div className="rounded-xl bg-night px-5 py-6 text-center text-night-ink">
              <p className="text-sm text-night-muted">
                {active ? `${name(active.subjectId)}${active.startedAt === null ? " (paused)" : ""}` : "Ready"}
              </p>
              <p className="mt-1 font-mono text-[3.25rem] font-semibold leading-none tabular-nums sm:text-[4rem]" role="timer" aria-live="off">
                {fmtClockMs(elapsed)}
              </p>
              <div className="mt-5 flex flex-wrap justify-center gap-2">
                {!active && (
                  <Btn icon="play" onClick={start} className="btn-light">
                    Start
                  </Btn>
                )}
                {active && active.startedAt !== null && (
                  <Btn icon="pause" onClick={pause} className="btn-light">
                    Pause
                  </Btn>
                )}
                {active && active.startedAt === null && (
                  <Btn icon="play" onClick={resume} className="btn-light">
                    Resume
                  </Btn>
                )}
                {active && (
                  <>
                    <Btn icon="check" onClick={() => stop(true)} className="btn-light">
                      Stop and save
                    </Btn>
                    <Btn variant="ghost" className="!text-night-ink" onClick={() => stop(false)}>
                      Discard
                    </Btn>
                  </>
                )}
              </div>
            </div>
            {notice && <Notice tone="success">{notice}</Notice>}

            <div>
              <SubHead>Today&apos;s goals</SubHead>
              <ul className="mt-3 space-y-3">
                {subjects.map((s) => {
                  const m = today ? minutesOn(s.id, today) : 0;
                  const pct = s.goal ? Math.min(100, (m / s.goal) * 100) : 0;
                  const met = s.goal > 0 && m >= s.goal;
                  return (
                    <li key={s.id}>
                      <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
                        <span className="font-medium text-ink">{s.name}</span>
                        <span className="tabular-nums text-ink-2">
                          {Math.floor(m)} of {s.goal} min{met && <span className="ml-2 font-medium text-accent-strong">Goal met</span>}
                        </span>
                      </div>
                      <div
                        className="mt-1.5 h-2 overflow-hidden rounded-full bg-sunken"
                        role="progressbar"
                        aria-label={`${s.name} daily goal`}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={Math.round(pct)}
                      >
                        <div className="h-full rounded-full bg-accent transition-[width] duration-300 motion-reduce:transition-none" style={{ width: `${pct}%` }} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
            <StatGrid
              items={[
                { label: "Today", value: fmtMinutes(todayTotal) },
                { label: "Daily goal", value: fmtMinutes(goalTotal) },
                { label: "Last 7 days", value: fmtMinutes(weekTotal) },
              ]}
            />
          </div>
        )}
      </ToolPanel>

      <ToolPanel title="Subjects and manual entries">
        <form
          noValidate
          className="grid gap-3 sm:grid-cols-[1fr_10rem_auto] sm:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            const goal = parseNum(subjectDraft.goal);
            if (!subjectDraft.name.trim()) return setSubjectError("Enter a subject name.");
            if (goal === null || goal < 0 || goal > 1440) return setSubjectError("Daily goal must be 0 to 1440 minutes.");
            setSubjectError(null);
            const id = uid();
            setState((s) => ({ ...s, subjects: [...s.subjects, { id, name: subjectDraft.name.trim().slice(0, 80), goal: Math.round(goal) }] }));
            setPicked(id);
            setSubjectDraft({ name: "", goal: subjectDraft.goal });
          }}
        >
          <TextField label="New subject" placeholder="Statistics" value={subjectDraft.name} maxLength={80} onChange={(e) => setSubjectDraft((d) => ({ ...d, name: e.target.value }))} />
          <NumberField label="Daily goal (min)" value={subjectDraft.goal} onChange={(e) => setSubjectDraft((d) => ({ ...d, goal: e.target.value }))} />
          <Btn type="submit" icon="plus" className="h-11">
            Add subject
          </Btn>
        </form>
        {subjectError && (
          <p className="mt-2 text-sm text-danger" role="alert">
            {subjectError}
          </p>
        )}

        {subjects.length > 0 && (
          <ul className="mt-4 divide-y divide-line overflow-hidden rounded-xl shadow-[0_0_0_1px_var(--line)]">
            {subjects.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center gap-3 bg-surface px-3 py-2 text-sm">
                <span className="min-w-0 flex-1 text-ink">{s.name}</span>
                <label className="flex items-center gap-2 text-ink-2">
                  Goal
                  <input
                    type="number"
                    min={0}
                    max={1440}
                    aria-label={`Daily goal for ${s.name} in minutes`}
                    value={s.goal}
                    onChange={(e) => {
                      const n = Math.round(Number(e.target.value));
                      if (Number.isFinite(n) && n >= 0 && n <= 1440) setState((st) => ({ ...st, subjects: st.subjects.map((x) => (x.id === s.id ? { ...x, goal: n } : x)) }));
                    }}
                    className={`${inputCls} h-10 w-20 px-2`}
                  />
                  min
                </label>
                <button
                  type="button"
                  aria-label={`Delete ${s.name} and its sessions`}
                  disabled={active?.subjectId === s.id}
                  className="grid h-10 w-10 place-items-center rounded-lg text-muted hover:bg-sunken hover:text-danger disabled:opacity-35"
                  onClick={() => {
                    const n = sessions.filter((x) => x.subjectId === s.id).length;
                    if (n && !window.confirm(`Delete ${s.name} and its ${n} logged session${n === 1 ? "" : "s"}?`)) return;
                    setState((st) => ({ ...st, subjects: st.subjects.filter((x) => x.id !== s.id), sessions: st.sessions.filter((x) => x.subjectId !== s.id) }));
                  }}
                >
                  <Icon name="trash" size={15} />
                </button>
              </li>
            ))}
          </ul>
        )}

        {subjects.length > 0 && (
          <form
            noValidate
            className="mt-6 space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              const sid = manual.subjectId || subjects[0].id;
              const mins = parseNum(manual.minutes);
              const date = manual.date || today;
              if (mins === null || mins <= 0 || mins > 1440) return setManualError("Minutes must be between 1 and 1440.");
              if (!isDayKey(date)) return setManualError("Choose a valid date.");
              setManualError(null);
              const [y, m, d] = date.split("-").map(Number);
              const startMs = new Date(y, m - 1, d, 12).getTime();
              setState((st) => ({ ...st, sessions: [...st.sessions, { id: uid(), subjectId: sid, start: startMs, ms: Math.round(mins * 60000), day: date }] }));
              setManual((x) => ({ ...x, minutes: "" }));
            }}
          >
            <SubHead>Log time you studied away from the timer</SubHead>
            <div className="grid gap-3 sm:grid-cols-[1fr_8rem_11rem_auto] sm:items-end">
              <SelectField
                label="Subject"
                value={manual.subjectId || subjects[0].id}
                onChange={(e) => setManual((x) => ({ ...x, subjectId: e.target.value }))}
                options={subjects.map((s) => ({ value: s.id, label: s.name }))}
              />
              <NumberField label="Minutes" value={manual.minutes} onChange={(e) => setManual((x) => ({ ...x, minutes: e.target.value }))} />
              <TextField label="Date" type="date" value={manual.date || today} onChange={(e) => setManual((x) => ({ ...x, date: e.target.value }))} />
              <Btn type="submit" variant="ghost" icon="plus" className="h-11">
                Log
              </Btn>
            </div>
            {manualError && (
              <p className="text-sm text-danger" role="alert">
                {manualError}
              </p>
            )}
          </form>
        )}
      </ToolPanel>

      {subjects.length > 0 && today && (
        <ToolPanel title="History">
          <div className="overflow-x-auto rounded-xl shadow-[0_0_0_1px_var(--line)]" role="region" aria-label="Minutes per subject, last 7 days" tabIndex={0}>
            <table className="w-full min-w-[560px] border-collapse text-sm">
              <caption className="sr-only">Minutes studied per subject over the last 7 days</caption>
              <thead className="bg-sunken">
                <tr>
                  <th scope="col" className="px-3 py-2 text-left font-medium text-ink">
                    Subject
                  </th>
                  {last7.map((d) => (
                    <th key={d} scope="col" className={`px-2 py-2 text-right font-medium ${d === today ? "text-accent-strong" : "text-ink"}`}>
                      {d === today ? "Today" : fmtDay(d, { weekday: "short", day: "numeric" })}
                    </th>
                  ))}
                  <th scope="col" className="px-3 py-2 text-right font-medium text-ink">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody>
                {subjects.map((s) => {
                  const vals = last7.map((d) => minutesOn(s.id, d));
                  return (
                    <tr key={s.id} className="border-t border-line">
                      <th scope="row" className="px-3 py-2 text-left font-normal text-ink">
                        {s.name}
                      </th>
                      {vals.map((v, i) => (
                        <td key={last7[i]} className={`px-2 py-2 text-right tabular-nums ${s.goal && v >= s.goal ? "font-semibold text-accent-strong" : "text-ink-2"}`}>
                          {Math.floor(v)}
                          {s.goal > 0 && v >= s.goal && <span className="sr-only"> (goal met)</span>}
                        </td>
                      ))}
                      <td className="px-3 py-2 text-right tabular-nums text-ink">{fmtMinutes(vals.reduce((a, b) => a + b, 0))}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-[0.8125rem] text-muted">Values are minutes. Bold figures met that subject&apos;s daily goal.</p>

          {recent.length > 0 && (
            <details className="mt-5">
              <summary className="cursor-pointer text-sm font-medium text-ink-2">Recent sessions ({sessions.length} total)</summary>
              <ul className="mt-3 divide-y divide-line overflow-hidden rounded-xl shadow-[0_0_0_1px_var(--line)]">
                {recent.map((s) => (
                  <li key={s.id} className="flex items-center gap-3 bg-surface px-3 py-1.5 text-sm">
                    <span className="w-32 shrink-0 text-ink-2">{fmtDay(s.day, { month: "short", day: "numeric" })}</span>
                    <span className="min-w-0 flex-1 text-ink">{name(s.subjectId)}</span>
                    <span className="tabular-nums text-ink-2">{fmtClockMs(s.ms)}</span>
                    <button
                      type="button"
                      aria-label={`Delete ${name(s.subjectId)} session on ${s.day}`}
                      className="grid h-10 w-10 place-items-center rounded-lg text-muted hover:bg-sunken hover:text-danger"
                      onClick={() => setState((st) => ({ ...st, sessions: st.sessions.filter((x) => x.id !== s.id) }))}
                    >
                      <Icon name="trash" size={15} />
                    </button>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </ToolPanel>
      )}

      <ToolPanel>
        <div className="space-y-4">
          <BackupBar<StudyTimerState>
            tool="study-timer"
            data={{ ...state, active: null }}
            normalize={normalizeStudyTimer}
            onImport={(v) => setState(v)}
            onClear={clear}
            hasData={subjects.length > 0}
            printLabel="Print history"
          />
          <PrivacyNote stored />
        </div>
      </ToolPanel>

      {today && (
        <PrintArea>
          <h2>Study log</h2>
          <p className="meta">
            Last 7 days to {fmtDay(today)} · total {fmtMinutes(weekTotal)}
          </p>
          <table>
            <thead>
              <tr>
                <th>Subject</th>
                <th>Goal/day</th>
                {last7.map((d) => (
                  <th key={d}>{fmtDay(d, { weekday: "short", day: "numeric" })}</th>
                ))}
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {subjects.map((s) => {
                const vals = last7.map((d) => minutesOn(s.id, d));
                return (
                  <tr key={s.id}>
                    <td>{s.name}</td>
                    <td>{s.goal} min</td>
                    {vals.map((v, i) => (
                      <td key={last7[i]}>{Math.floor(v)}</td>
                    ))}
                    <td>{fmtMinutes(vals.reduce((a, b) => a + b, 0))}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </PrintArea>
      )}
    </div>
  );
}

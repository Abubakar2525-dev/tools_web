"use client";

import { useState } from "react";
import { Btn, CellInput, CellSelect, EmptyState, PrivacyNote, StatGrid, TextField, ToolPanel, inputCls, uid, usePersistentState } from "@/components/tools/kit";
import { Icon } from "@/components/ui/Icon";
import { dayKey, fmtClock, fmtMinutes, isDayKey, parseHHMM, scheduleBlocks } from "./lib/dates";
import { dailyStudyInitial, normalizeDailyStudy, type DailyStudyState, type StudyBlock } from "./lib/schema";
import { BackupBar, PrintArea, PrintBox, fmtDay, useNow } from "./shared";

const iconBtn =
  "grid h-10 w-10 shrink-0 place-items-center rounded-lg text-muted transition-colors hover:bg-sunken hover:text-ink disabled:cursor-not-allowed disabled:opacity-35";

function TaskAdder({ onAdd, label }: { onAdd: (text: string) => void; label: string }) {
  const [draft, setDraft] = useState("");
  return (
    <form
      className="flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (!draft.trim()) return;
        onAdd(draft.trim().slice(0, 300));
        setDraft("");
      }}
    >
      <input
        aria-label={label}
        placeholder="Add a task for this block"
        value={draft}
        maxLength={300}
        onChange={(e) => setDraft(e.target.value)}
        className={`${inputCls} h-10 min-w-0 flex-1 px-2.5 text-[0.9rem]`}
      />
      <button type="submit" className="btn btn-sm btn-ghost h-10 px-3" disabled={!draft.trim()} aria-label={`${label}: add`}>
        <Icon name="plus" size={16} />
      </button>
    </form>
  );
}

export default function Tool() {
  const [state, setState, clear] = usePersistentState<DailyStudyState>("daily-study-planner", dailyStudyInitial);
  const now = useNow(15_000);
  const [startRaw, setStartRaw] = useState<string | null>(null);

  const today = now === null ? "" : dayKey(new Date(now));
  const date = state.date || today;
  const startMin = parseHHMM(state.startTime) ?? 540;
  const times = scheduleBlocks(startMin, state.blocks.map((b) => b.minutes));
  const nowMin = now === null ? null : new Date(now).getHours() * 60 + new Date(now).getMinutes();
  const isToday = date === today;

  const study = state.blocks.filter((b) => b.kind === "study").reduce((a, b) => a + b.minutes, 0);
  const breaks = state.blocks.filter((b) => b.kind === "break").reduce((a, b) => a + b.minutes, 0);
  const allTasks = state.blocks.flatMap((b) => b.tasks);
  const endMin = times.length ? times[times.length - 1].end : startMin;

  const setBlocks = (fn: (b: StudyBlock[]) => StudyBlock[]) => setState((s) => ({ ...s, blocks: fn(s.blocks) }));
  const patch = (id: string, p: Partial<StudyBlock>) => setBlocks((bs) => bs.map((b) => (b.id === id ? { ...b, ...p } : b)));
  const addBlock = (kind: "study" | "break", minutes: number) =>
    setBlocks((bs) => [...bs, { id: uid(), subject: kind === "break" ? "Break" : "", minutes, kind, tasks: [] }]);
  const move = (i: number, d: -1 | 1) =>
    setBlocks((bs) => {
      const next = [...bs];
      const j = i + d;
      if (j < 0 || j >= next.length) return bs;
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  return (
    <div className="space-y-5">
      <ToolPanel title="Daily study planner">
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="Day"
            type="date"
            value={date}
            onChange={(e) => setState((s) => ({ ...s, date: isDayKey(e.target.value) ? e.target.value : "" }))}
          />
          <TextField
            label="Start time"
            type="time"
            value={startRaw ?? state.startTime}
            error={startRaw !== null && parseHHMM(startRaw) === null ? "Enter a time like 09:00." : null}
            onChange={(e) => {
              setStartRaw(e.target.value);
              if (parseHHMM(e.target.value) !== null) setState((s) => ({ ...s, startTime: e.target.value }));
            }}
            onBlur={() => setStartRaw(null)}
          />
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <Btn icon="plus" onClick={() => addBlock("study", 50)}>
            Study block (50 min)
          </Btn>
          <Btn variant="ghost" icon="plus" onClick={() => addBlock("study", 25)}>
            Short block (25 min)
          </Btn>
          <Btn variant="ghost" icon="plus" onClick={() => addBlock("break", 10)}>
            Break (10 min)
          </Btn>
          <Btn variant="ghost" icon="plus" onClick={() => addBlock("break", 30)}>
            Long break (30 min)
          </Btn>
        </div>

        {state.blocks.length > 0 && (
          <div className="mt-5">
            <StatGrid
              items={[
                { label: "Study time", value: fmtMinutes(study) },
                { label: "Breaks", value: fmtMinutes(breaks) },
                { label: "Finishes at", value: fmtClock(endMin) },
                { label: "Tasks done", value: `${allTasks.filter((t) => t.done).length} of ${allTasks.length}` },
              ]}
            />
          </div>
        )}

        <ol className="mt-5 space-y-3">
          {state.blocks.length === 0 && (
            <EmptyState icon="timer" title="No blocks yet">
              Add study blocks and breaks. Times are calculated from your start time, one block after another.
            </EmptyState>
          )}
          {state.blocks.map((b, i) => {
            const t = times[i];
            const current = isToday && nowMin !== null && nowMin >= t.start && nowMin < t.end;
            const past = isToday && nowMin !== null && nowMin >= t.end;
            return (
              <li
                key={b.id}
                className={`rounded-xl p-4 ${current ? "bg-accent-soft shadow-[inset_0_0_0_1.5px_var(--accent)]" : b.kind === "break" ? "bg-sunken/60" : "bg-sunken"}`}
                aria-current={current ? "time" : undefined}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="min-w-[8.5rem] font-mono text-[0.9rem] tabular-nums text-ink">
                    {fmtClock(t.start)} to {fmtClock(t.end)}
                  </span>
                  {current && <span className="rounded-full bg-accent px-2 py-0.5 text-[0.7rem] font-medium text-white">Now</span>}
                  {past && <span className="text-[0.75rem] text-muted">Finished</span>}
                  <span className="ml-auto flex">
                    <button type="button" className={iconBtn} aria-label={`Move block ${i + 1} earlier`} disabled={i === 0} onClick={() => move(i, -1)}>
                      <Icon name="chevron" size={16} className="rotate-180" />
                    </button>
                    <button
                      type="button"
                      className={iconBtn}
                      aria-label={`Move block ${i + 1} later`}
                      disabled={i === state.blocks.length - 1}
                      onClick={() => move(i, 1)}
                    >
                      <Icon name="chevron" size={16} />
                    </button>
                    <button
                      type="button"
                      className={`${iconBtn} hover:!text-danger`}
                      aria-label={`Delete block ${i + 1}`}
                      onClick={() => setBlocks((bs) => bs.filter((x) => x.id !== b.id))}
                    >
                      <Icon name="trash" size={15} />
                    </button>
                  </span>
                </div>
                <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_7rem_8rem]">
                  <CellInput
                    label={`Block ${i + 1} subject`}
                    placeholder={b.kind === "break" ? "Break" : "Subject or topic"}
                    value={b.subject}
                    maxLength={120}
                    onChange={(e) => patch(b.id, { subject: e.target.value })}
                  />
                  <div className="flex items-center gap-1.5">
                    <CellInput
                      label={`Block ${i + 1} length in minutes`}
                      type="number"
                      min={1}
                      max={600}
                      inputMode="numeric"
                      value={b.minutes}
                      onChange={(e) => {
                        const n = Math.round(Number(e.target.value));
                        if (Number.isFinite(n) && n >= 1 && n <= 600) patch(b.id, { minutes: n });
                      }}
                    />
                    <span className="text-sm text-muted">min</span>
                  </div>
                  <CellSelect
                    label={`Block ${i + 1} type`}
                    value={b.kind}
                    onChange={(e) => patch(b.id, { kind: e.target.value as StudyBlock["kind"] })}
                    options={[
                      { value: "study", label: "Study" },
                      { value: "break", label: "Break" },
                    ]}
                  />
                </div>
                {b.kind === "study" && (
                  <div className="mt-3 space-y-1.5">
                    {b.tasks.map((task) => (
                      <div key={task.id} className="flex items-center gap-2">
                        <input
                          id={`st-${task.id}`}
                          type="checkbox"
                          checked={task.done}
                          onChange={() => patch(b.id, { tasks: b.tasks.map((x) => (x.id === task.id ? { ...x, done: !x.done } : x)) })}
                          className="h-[18px] w-[18px] shrink-0 accent-[var(--accent)]"
                        />
                        <label htmlFor={`st-${task.id}`} className={`min-w-0 flex-1 text-[0.9rem] ${task.done ? "text-muted line-through" : "text-ink"}`}>
                          {task.text}
                        </label>
                        <button
                          type="button"
                          className="grid h-9 w-9 place-items-center rounded-md text-muted hover:bg-surface hover:text-danger"
                          aria-label={`Delete task ${task.text}`}
                          onClick={() => patch(b.id, { tasks: b.tasks.filter((x) => x.id !== task.id) })}
                        >
                          <Icon name="close" size={14} />
                        </button>
                      </div>
                    ))}
                    <TaskAdder label={`New task for block ${i + 1}`} onAdd={(text) => patch(b.id, { tasks: [...b.tasks, { id: uid(), text, done: false }] })} />
                  </div>
                )}
              </li>
            );
          })}
        </ol>
        {endMin >= 1440 && (
          <p className="mt-3 text-sm text-danger" role="alert">
            This plan runs past midnight. Start earlier or shorten some blocks.
          </p>
        )}
      </ToolPanel>

      <ToolPanel>
        <div className="space-y-4">
          <BackupBar<DailyStudyState>
            tool="daily-study-planner"
            data={state}
            normalize={normalizeDailyStudy}
            onImport={(v) => setState(v)}
            onClear={clear}
            hasData={state.blocks.length > 0}
            printLabel="Print plan"
          />
          <PrivacyNote stored />
        </div>
      </ToolPanel>

      <PrintArea>
        <h2>Study plan{date ? `: ${fmtDay(date, { weekday: "long", month: "long", day: "numeric", year: "numeric" })}` : ""}</h2>
        <p className="meta">
          Study {fmtMinutes(study)} · Breaks {fmtMinutes(breaks)} · Finishes at {fmtClock(endMin)}
        </p>
        <table>
          <thead>
            <tr>
              <th style={{ width: "22%" }}>Time</th>
              <th style={{ width: "28%" }}>Block</th>
              <th>Tasks</th>
            </tr>
          </thead>
          <tbody>
            {state.blocks.map((b, i) => (
              <tr key={b.id}>
                <td>
                  {fmtClock(times[i].start)} to {fmtClock(times[i].end)}
                </td>
                <td>
                  <strong>{b.subject || (b.kind === "break" ? "Break" : "Study")}</strong>
                  <br />
                  <span className="muted">
                    {b.kind === "break" ? "Break" : "Study"}, {b.minutes} min
                  </span>
                </td>
                <td>
                  {b.tasks.map((t) => (
                    <div key={t.id}>
                      <PrintBox checked={t.done} />
                      {t.text}
                    </div>
                  ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </PrintArea>
    </div>
  );
}

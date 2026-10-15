"use client";

import { useState } from "react";
import { Btn, CellSelect, PrivacyNote, Segmented, TextArea, ToolPanel, inputCls, uid, usePersistentState } from "@/components/tools/kit";
import { Icon } from "@/components/ui/Icon";
import { addDays, isDayKey, startOfWeek } from "./lib/dates";
import { normalizeWeekPlanner, weekPlannerInitial, type WeekData, type WeekPlannerState } from "./lib/schema";
import { BackupBar, PrintArea, PrintBox, fmtDay, useToday } from "./shared";

const EMPTY: WeekData = { tasks: [], notes: "" };
const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function DayCard({
  name,
  date,
  isToday,
  tasks,
  dayOptions,
  onAdd,
  onToggle,
  onDelete,
  onMove,
}: {
  name: string;
  date: string;
  isToday: boolean;
  tasks: WeekData["tasks"];
  dayOptions: { value: string; label: string }[];
  onAdd: (text: string) => void;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onMove: (id: string, day: number) => void;
}) {
  const [draft, setDraft] = useState("");
  const done = tasks.filter((t) => t.done).length;
  return (
    <section
      aria-label={`${name}, ${fmtDay(date, { month: "long", day: "numeric" })}`}
      className={`flex flex-col rounded-xl p-4 ${isToday ? "bg-accent-soft shadow-[inset_0_0_0_1.5px_var(--accent)]" : "bg-sunken"}`}
    >
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="font-sans text-[0.95rem] font-semibold text-ink">
          {name}
          {isToday && <span className="ml-2 rounded-full bg-accent px-2 py-0.5 text-[0.7rem] font-medium text-white">Today</span>}
        </h3>
        <span className="text-[0.8125rem] text-muted">{fmtDay(date, { month: "short", day: "numeric" })}</span>
      </div>
      {tasks.length > 0 && (
        <p className="mt-0.5 text-[0.75rem] text-muted">
          {done} of {tasks.length} done
        </p>
      )}
      <ul className="mt-3 space-y-1.5">
        {tasks.map((t) => (
          <li key={t.id} className="group flex items-start gap-2 rounded-lg bg-surface px-2.5 py-2 shadow-sm">
            <input
              id={`wt-${t.id}`}
              type="checkbox"
              checked={t.done}
              onChange={() => onToggle(t.id)}
              className="mt-0.5 h-[18px] w-[18px] shrink-0 cursor-pointer accent-[var(--accent)]"
            />
            <label htmlFor={`wt-${t.id}`} className={`min-w-0 flex-1 cursor-pointer break-words text-[0.9rem] ${t.done ? "text-muted line-through" : "text-ink"}`}>
              {t.text}
            </label>
            <details className="relative shrink-0">
              <summary className="grid h-7 w-7 cursor-pointer list-none place-items-center rounded-md text-muted hover:bg-sunken hover:text-ink" aria-label={`Options for ${t.text}`}>
                <Icon name="menu" size={15} />
              </summary>
              <div className="absolute right-0 z-10 mt-1 w-48 space-y-2 rounded-lg bg-surface p-2.5 shadow-lg">
                <CellSelect
                  label={`Move "${t.text}" to day`}
                  value={String(-1)}
                  options={[{ value: "-1", label: "Move to…" }, ...dayOptions]}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    if (v >= 0) onMove(t.id, v);
                  }}
                />
                <Btn variant="danger" icon="trash" className="w-full" onClick={() => onDelete(t.id)}>
                  Delete
                </Btn>
              </div>
            </details>
          </li>
        ))}
      </ul>
      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const text = draft.trim();
          if (!text) return;
          onAdd(text);
          setDraft("");
        }}
      >
        <input
          aria-label={`New task for ${name}`}
          value={draft}
          maxLength={300}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Add a task"
          className={`${inputCls} h-10 min-w-0 flex-1 px-2.5 text-[0.9rem]`}
        />
        <button type="submit" className="btn btn-sm btn-ghost h-10 shrink-0 px-3" aria-label={`Add task to ${name}`} disabled={!draft.trim()}>
          <Icon name="plus" size={16} />
        </button>
      </form>
    </section>
  );
}

export default function Tool() {
  const [state, setState, clear] = usePersistentState<WeekPlannerState>("week-planner", weekPlannerInitial);
  const today = useToday();
  const [view, setView] = useState<string | null>(null);
  const ws = state.weekStartsOn;

  if (!today) return <ToolPanel title="Week planner"><p className="text-sm text-muted">Loading your planner…</p></ToolPanel>;

  const weekKey = startOfWeek(view ?? today, ws);
  const week = state.weeks[weekKey] ?? EMPTY;
  const days = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(weekKey, i);
    return { index: i, date, name: DAY_NAMES[(ws + i) % 7] };
  });
  const dayOptions = days.map((d) => ({ value: String(d.index), label: d.name }));
  const total = week.tasks.length;
  const done = week.tasks.filter((t) => t.done).length;
  const hasData = Object.values(state.weeks).some((w) => w.tasks.length || w.notes.trim());

  const updateWeek = (key: string, fn: (w: WeekData) => WeekData) =>
    setState((s) => {
      const next = fn(s.weeks[key] ?? EMPTY);
      const weeks = { ...s.weeks };
      if (!next.tasks.length && !next.notes.trim()) delete weeks[key];
      else weeks[key] = next;
      return { ...s, weeks };
    });

  const unfinished = week.tasks.filter((t) => !t.done);
  const nextKey = addDays(weekKey, 7);

  const range = `${fmtDay(weekKey, { month: "short", day: "numeric" })} to ${fmtDay(addDays(weekKey, 6), { month: "short", day: "numeric", year: "numeric" })}`;

  return (
    <div className="space-y-5">
      <ToolPanel title="Week planner">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm text-muted">Week of</p>
            <p className="font-display text-[1.375rem] font-semibold tracking-[-0.02em] text-ink" aria-live="polite">
              {range}
            </p>
            <p className="mt-0.5 text-sm text-ink-2">{total ? `${done} of ${total} tasks done` : "No tasks yet this week"}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Btn variant="ghost" onClick={() => setView(addDays(weekKey, -7))} aria-label="Previous week">
              <Icon name="chevron" size={16} className="rotate-90" />
              Prev
            </Btn>
            <Btn variant="ghost" onClick={() => setView(null)} disabled={weekKey === startOfWeek(today, ws)}>
              This week
            </Btn>
            <Btn variant="ghost" onClick={() => setView(addDays(weekKey, 7))} aria-label="Next week">
              Next
              <Icon name="chevron" size={16} className="-rotate-90" />
            </Btn>
            <input
              type="date"
              aria-label="Jump to the week containing a date"
              className={`${inputCls} h-10 w-auto px-2.5 text-[0.95rem]`}
              value={view ?? ""}
              onChange={(e) => setView(isDayKey(e.target.value) ? e.target.value : null)}
            />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <span className="text-sm text-ink-2">Week starts on</span>
          <Segmented
            label="Week starts on"
            value={ws === 1 ? "mon" : "sun"}
            onChange={(v) => setState((s) => ({ ...s, weekStartsOn: v === "mon" ? 1 : 0 }))}
            options={[
              { value: "mon", label: "Monday" },
              { value: "sun", label: "Sunday" },
            ]}
          />
        </div>
        {ws === 0 && (
          <p className="mt-2 text-[0.8125rem] text-muted">Tasks are stored by position in the week, so switching the start day shifts which weekday they appear on.</p>
        )}

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {days.map((d) => (
            <DayCard
              key={`${weekKey}-${d.index}`}
              name={d.name}
              date={d.date}
              isToday={d.date === today}
              tasks={week.tasks.filter((t) => t.day === d.index)}
              dayOptions={dayOptions.filter((o) => o.value !== String(d.index))}
              onAdd={(text) => updateWeek(weekKey, (w) => ({ ...w, tasks: [...w.tasks, { id: uid(), day: d.index, text, done: false }] }))}
              onToggle={(id) => updateWeek(weekKey, (w) => ({ ...w, tasks: w.tasks.map((t) => (t.id === id ? { ...t, done: !t.done } : t)) }))}
              onDelete={(id) => updateWeek(weekKey, (w) => ({ ...w, tasks: w.tasks.filter((t) => t.id !== id) }))}
              onMove={(id, day) => updateWeek(weekKey, (w) => ({ ...w, tasks: w.tasks.map((t) => (t.id === id ? { ...t, day } : t)) }))}
            />
          ))}
          <div className="rounded-xl bg-sunken p-4">
            <TextArea
              label="Notes for this week"
              value={week.notes}
              maxLength={20000}
              placeholder="Goals, reminders, groceries…"
              onChange={(e) => {
                const notes = e.target.value;
                updateWeek(weekKey, (w) => ({ ...w, notes }));
              }}
            />
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-2">
          <Btn
            variant="ghost"
            icon="arrow"
            disabled={!unfinished.length}
            onClick={() => {
              const moving = unfinished.map((t) => ({ ...t, id: uid() }));
              updateWeek(weekKey, (w) => ({ ...w, tasks: w.tasks.filter((t) => t.done) }));
              updateWeek(nextKey, (w) => ({ ...w, tasks: [...w.tasks, ...moving] }));
              setView(nextKey);
            }}
          >
            Move {unfinished.length || ""} unfinished to next week
          </Btn>
        </div>
      </ToolPanel>

      <ToolPanel>
        <div className="space-y-4">
          <BackupBar<WeekPlannerState>
            tool="week-planner"
            data={state}
            normalize={normalizeWeekPlanner}
            onImport={(v) => setState(v)}
            onClear={clear}
            hasData={hasData}
            printLabel="Print this week"
          />
          <PrivacyNote stored />
        </div>
      </ToolPanel>

      <PrintArea>
        <h2>Week of {range}</h2>
        <p className="meta">
          {done} of {total} tasks done
        </p>
        <table>
          <thead>
            <tr>
              <th style={{ width: "22%" }}>Day</th>
              <th>Tasks</th>
            </tr>
          </thead>
          <tbody>
            {days.map((d) => {
              const tasks = week.tasks.filter((t) => t.day === d.index);
              return (
                <tr key={d.index}>
                  <td>
                    <strong>{d.name}</strong>
                    <br />
                    <span className="muted">{fmtDay(d.date, { month: "short", day: "numeric" })}</span>
                  </td>
                  <td style={{ height: "60pt" }}>
                    {tasks.map((t) => (
                      <div key={t.id}>
                        <PrintBox checked={t.done} />
                        {t.text}
                      </div>
                    ))}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {week.notes.trim() && (
          <>
            <h2>Notes</h2>
            <p style={{ whiteSpace: "pre-wrap" }}>{week.notes}</p>
          </>
        )}
      </PrintArea>
    </div>
  );
}

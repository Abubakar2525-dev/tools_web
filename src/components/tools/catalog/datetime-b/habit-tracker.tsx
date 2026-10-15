"use client";

import { useRef, useState } from "react";
import { Btn, EmptyState, PrivacyNote, StatGrid, ToolPanel, fmt, inputCls, uid, usePersistentState } from "@/components/tools/kit";
import { Icon } from "@/components/ui/Icon";
import { addDays, completionRate, streaks } from "./lib/dates";
import { habitInitial, normalizeHabits, type Habit, type HabitState } from "./lib/schema";
import { BackupBar, PrintArea, fmtDay, useToday } from "./shared";

const SPAN = 14;

export default function Tool() {
  const [state, setState, clear] = usePersistentState<HabitState>("habit-tracker", habitInitial);
  const today = useToday();
  const [offset, setOffset] = useState(0); // days back from today for the last visible column
  const [draft, setDraft] = useState("");
  const gridRef = useRef<HTMLTableElement>(null);

  if (!today) return <ToolPanel title="Habit tracker"><p className="text-sm text-muted">Loading your habits…</p></ToolPanel>;

  const end = addDays(today, -offset);
  const days = Array.from({ length: SPAN }, (_, i) => addDays(end, i - SPAN + 1));
  const habits = state.habits;

  const toggle = (h: Habit, d: string) =>
    setState((s) => ({
      habits: s.habits.map((x) => {
        if (x.id !== h.id) return x;
        const has = x.checks.includes(d);
        const checks = has ? x.checks.filter((c) => c !== d) : [...x.checks, d].sort();
        return { ...x, checks, created: !has && d < x.created ? d : x.created };
      }),
    }));

  const stats = habits.map((h) => ({ ...streaks(h.checks, today), ...completionRate(h.checks, h.created, today) }));
  const doneToday = habits.filter((h) => h.checks.includes(today)).length;
  const avgRate = stats.length ? stats.reduce((a, s) => a + s.rate, 0) / stats.length : 0;

  const onGridKey = (e: React.KeyboardEvent<HTMLTableElement>) => {
    const t = e.target as HTMLElement;
    const r = Number(t.dataset.r);
    const c = Number(t.dataset.c);
    if (!Number.isFinite(r) || !Number.isFinite(c) || t.dataset.r === undefined) return;
    const delta: Record<string, [number, number]> = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
    const d = delta[e.key];
    if (!d) return;
    const next = gridRef.current?.querySelector<HTMLButtonElement>(`[data-r="${r + d[0]}"][data-c="${c + d[1]}"]`);
    if (next) {
      e.preventDefault();
      next.focus();
    }
  };

  return (
    <div className="space-y-5">
      <ToolPanel title="Habit tracker">
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const name = draft.trim();
            if (!name) return;
            setState((s) => ({ habits: [...s.habits, { id: uid(), name: name.slice(0, 80), created: today, checks: [] }] }));
            setDraft("");
          }}
        >
          <input
            aria-label="New habit"
            placeholder="New habit, e.g. Read 20 pages"
            value={draft}
            maxLength={80}
            onChange={(e) => setDraft(e.target.value)}
            className={`${inputCls} h-11 min-w-0 flex-1`}
          />
          <Btn type="submit" icon="plus" className="h-11" disabled={!draft.trim()}>
            Add habit
          </Btn>
        </form>

        {habits.length === 0 ? (
          <div className="mt-5">
            <EmptyState icon="checklist" title="No habits yet">
              Add a habit, then tick each day you do it. Streaks and completion rates update as you go.
            </EmptyState>
          </div>
        ) : (
          <>
            <div className="mt-5">
              <StatGrid
                items={[
                  { label: "Done today", value: `${doneToday} of ${habits.length}` },
                  { label: "Average completion", value: `${fmt(avgRate * 100, 0)}%` },
                  { label: "Longest current streak", value: `${Math.max(...stats.map((s) => s.current))} days` },
                ]}
              />
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-ink-2" aria-live="polite">
                {fmtDay(days[0], { month: "short", day: "numeric" })} to {fmtDay(end, { month: "short", day: "numeric", year: "numeric" })}
              </p>
              <div className="flex gap-2">
                <Btn variant="ghost" onClick={() => setOffset((o) => o + 7)}>
                  <Icon name="chevron" size={16} className="rotate-90" />
                  Earlier
                </Btn>
                <Btn variant="ghost" onClick={() => setOffset((o) => Math.max(0, o - 7))} disabled={offset === 0}>
                  Later
                  <Icon name="chevron" size={16} className="-rotate-90" />
                </Btn>
                <Btn variant="subtle" onClick={() => setOffset(0)} disabled={offset === 0}>
                  Today
                </Btn>
              </div>
            </div>

            <div className="mt-3 overflow-x-auto rounded-xl shadow-[0_0_0_1px_var(--line)]" tabIndex={-1}>
              <table ref={gridRef} onKeyDown={onGridKey} className="w-full border-collapse text-sm">
                <caption className="sr-only">Daily check-ins. Use the arrow keys to move between days and Enter or Space to toggle.</caption>
                <thead className="bg-sunken">
                  <tr>
                    <th scope="col" className="sticky left-0 z-[1] min-w-[9rem] bg-sunken px-3 py-2 text-left font-medium text-ink">
                      Habit
                    </th>
                    {days.map((d) => (
                      <th key={d} scope="col" className={`px-0.5 py-2 text-center text-[0.72rem] font-medium ${d === today ? "text-accent-strong" : "text-muted"}`}>
                        <span className="block">{fmtDay(d, { weekday: "narrow" })}</span>
                        <span className={`block tabular-nums ${d === today ? "font-semibold underline underline-offset-2" : ""}`}>
                          {Number(d.slice(8))}
                        </span>
                        {d === today && <span className="sr-only">(today)</span>}
                      </th>
                    ))}
                    <th scope="col" className="px-2 py-2 text-right font-medium text-ink">
                      Streak
                    </th>
                    <th scope="col" className="px-2 py-2 text-right font-medium text-ink">
                      Best
                    </th>
                    <th scope="col" className="px-3 py-2 text-right font-medium text-ink">
                      Rate
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {habits.map((h, r) => {
                    const st = stats[r];
                    return (
                      <tr key={h.id} className="border-t border-line">
                        <th scope="row" className="sticky left-0 z-[1] bg-surface px-3 py-1.5 text-left font-normal">
                          <div className="flex items-center justify-between gap-1">
                            <span className="break-words text-ink">{h.name}</span>
                            <button
                              type="button"
                              aria-label={`Delete habit ${h.name}`}
                              className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-muted hover:bg-sunken hover:text-danger"
                              onClick={() => {
                                if (window.confirm(`Delete "${h.name}" and all its check-ins?`)) setState((s) => ({ habits: s.habits.filter((x) => x.id !== h.id) }));
                              }}
                            >
                              <Icon name="trash" size={14} />
                            </button>
                          </div>
                        </th>
                        {days.map((d, c) => {
                          const on = h.checks.includes(d);
                          const future = d > today;
                          return (
                            <td key={d} className="px-0.5 py-1.5 text-center">
                              <button
                                type="button"
                                data-r={r}
                                data-c={c}
                                disabled={future}
                                aria-pressed={on}
                                aria-label={`${h.name}, ${fmtDay(d, { weekday: "long", month: "long", day: "numeric" })}`}
                                onClick={() => toggle(h, d)}
                                className={`mx-auto grid h-10 w-10 place-items-center rounded-lg transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-30 ${
                                  on ? "bg-accent text-white" : "bg-sunken text-transparent hover:bg-accent-soft"
                                } ${d === today && !on ? "shadow-[inset_0_0_0_1.5px_var(--accent)]" : ""}`}
                              >
                                <Icon name="check" size={16} />
                              </button>
                            </td>
                          );
                        })}
                        <td className="px-2 py-1.5 text-right tabular-nums text-ink">{st.current}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums text-ink-2">{st.best}</td>
                        <td className="px-3 py-1.5 text-right tabular-nums text-ink-2" title={`${st.done} of ${st.total} days`}>
                          {fmt(st.rate * 100, 0)}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-[0.8125rem] text-muted">
              Streaks count consecutive days by your local calendar. An unticked today doesn&apos;t break a streak until the day is over. Rate = days
              ticked ÷ days since the habit was added.
            </p>
          </>
        )}
      </ToolPanel>

      <ToolPanel>
        <div className="space-y-4">
          <BackupBar<HabitState>
            tool="habit-tracker"
            data={state}
            normalize={normalizeHabits}
            onImport={(v) => setState(v)}
            onClear={clear}
            hasData={habits.length > 0}
            printLabel="Print these two weeks"
          />
          <PrivacyNote stored />
        </div>
      </ToolPanel>

      <PrintArea>
        <h2>Habit tracker</h2>
        <p className="meta">
          {fmtDay(days[0], { month: "short", day: "numeric" })} to {fmtDay(end, { month: "short", day: "numeric", year: "numeric" })}
        </p>
        <table>
          <thead>
            <tr>
              <th>Habit</th>
              {days.map((d) => (
                <th key={d} style={{ textAlign: "center", padding: "3pt 2pt" }}>
                  {fmtDay(d, { weekday: "narrow" })}
                  <br />
                  {Number(d.slice(8))}
                </th>
              ))}
              <th>Streak</th>
              <th>Best</th>
              <th>Rate</th>
            </tr>
          </thead>
          <tbody>
            {habits.map((h, r) => (
              <tr key={h.id}>
                <td>{h.name}</td>
                {days.map((d) => (
                  <td key={d} style={{ textAlign: "center", padding: "3pt 2pt" }}>
                    {h.checks.includes(d) ? "✓" : ""}
                  </td>
                ))}
                <td>{stats[r].current}</td>
                <td>{stats[r].best}</td>
                <td>
                  {fmt(stats[r].rate * 100, 0)}% ({stats[r].done}/{stats[r].total})
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </PrintArea>
    </div>
  );
}

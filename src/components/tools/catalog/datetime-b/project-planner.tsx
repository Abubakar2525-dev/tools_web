"use client";

import { useState } from "react";
import {
  Btn,
  CellInput,
  CellSelect,
  EmptyState,
  Notice,
  PrivacyNote,
  Segmented,
  SelectField,
  StatGrid,
  TextField,
  ToolPanel,
  uid,
  usePersistentState,
} from "@/components/tools/kit";
import { Icon } from "@/components/ui/Icon";
import { addDays, diffDays, findCycle, isDayKey } from "./lib/dates";
import { STATUS_LABEL, normalizeProject, projectInitial, type ProjectState, type ProjectTask, type TaskStatus } from "./lib/schema";
import { BackupBar, PrintArea, fmtDay, useToday } from "./shared";

const STATUS_OPTIONS = (Object.keys(STATUS_LABEL) as TaskStatus[]).map((s) => ({ value: s, label: STATUS_LABEL[s] }));
const BAR_CLS: Record<TaskStatus, string> = {
  todo: "fill-[var(--line-strong)]",
  doing: "fill-accent",
  blocked: "fill-danger",
  done: "fill-accent-strong",
};
const short = (k: string) => fmtDay(k, { month: "short", day: "numeric" });

type Issue = { id: string; text: string };

function issuesFor(tasks: ProjectTask[]): Issue[] {
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const out: Issue[] = [];
  for (const t of tasks) {
    if (t.end < t.start) out.push({ id: t.id, text: `"${t.name}" ends before it starts.` });
    for (const d of t.deps) {
      const dep = byId.get(d);
      if (dep && dep.end >= t.start) out.push({ id: t.id, text: `"${t.name}" starts on ${short(t.start)}, before "${dep.name}" finishes on ${short(dep.end)}.` });
    }
  }
  return out;
}

function Gantt({ tasks, today, title, fit = false }: { tasks: ProjectTask[]; today: string; title: string; fit?: boolean }) {
  const min = addDays(tasks.reduce((m, t) => (t.start < m ? t.start : m), tasks[0].start), -1);
  const max = addDays(tasks.reduce((m, t) => (t.end > m ? t.end : m), tasks[0].end), 1);
  const days = diffDays(min, max) + 1;
  const px = days <= 35 ? 26 : days <= 100 ? 12 : days <= 250 ? 6 : 3;
  const LABEL = 170;
  const ROW = 34;
  const HEAD = 40;
  const width = LABEL + days * px + 90;
  const height = HEAD + tasks.length * ROW + 8;
  const x = (k: string) => LABEL + diffDays(min, k) * px;
  const rowOf = new Map(tasks.map((t, i) => [t.id, i]));

  const ticks: { k: string; label: string; major: boolean }[] = [];
  for (let i = 0; i < days; i++) {
    const k = addDays(min, i);
    const d = Number(k.slice(8));
    if (d === 1 || i === 0) ticks.push({ k, label: fmtDay(k, { month: "short", year: "numeric" }), major: true });
    else if (px >= 12 && (px >= 26 || new Date(`${k}T12:00:00`).getDay() === 1)) ticks.push({ k, label: String(d), major: false });
  }
  const summary = `Timeline of ${tasks.length} tasks from ${fmtDay(min)} to ${fmtDay(max)}. The table view lists the same dates.`;

  return (
    <div className={fit ? "" : "overflow-x-auto rounded-xl bg-surface shadow-[0_0_0_1px_var(--line)]"} tabIndex={fit ? undefined : 0} role="region" aria-label="Gantt timeline">
      <svg width={fit ? "100%" : width} height={fit ? undefined : height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={summary} className="block font-sans">
        <title>{`${title || "Project"} timeline`}</title>
        <defs>
          <marker id="pp-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto">
            <path d="M0,0 L8,4 L0,8 z" className="fill-ink-2" />
          </marker>
        </defs>
        {tasks.map((_, i) => (i % 2 ? <rect key={i} x={0} y={HEAD + i * ROW} width={width} height={ROW} className="fill-sunken" /> : null))}
        {ticks.map((t) => (
          <g key={t.k}>
            <line x1={x(t.k)} x2={x(t.k)} y1={t.major ? 4 : 24} y2={height} className={t.major ? "stroke-[var(--line-strong)]" : "stroke-[var(--line)]"} />
            <text x={x(t.k) + 3} y={t.major ? 15 : 34} className={`fill-muted ${t.major ? "text-[11px] font-medium" : "text-[10px]"}`}>
              {t.label}
            </text>
          </g>
        ))}
        {tasks.map((t, i) => {
          const y = HEAD + i * ROW;
          const bx = x(t.start);
          const bw = Math.max(px, (diffDays(t.start, t.end) + 1) * px);
          return (
            <g key={t.id}>
              <text x={8} y={y + ROW / 2 + 4} className="fill-ink text-[12px]">
                {t.name.length > 24 ? `${t.name.slice(0, 23)}…` : t.name}
              </text>
              <rect x={bx} y={y + 8} width={bw} height={ROW - 16} rx={4} className={BAR_CLS[t.status]} opacity={t.status === "done" ? 0.55 : 1} />
              <text x={bx + bw + 6} y={y + ROW / 2 + 4} className="fill-ink-2 text-[11px]">
                {STATUS_LABEL[t.status]}
                {t.owner ? ` · ${t.owner}` : ""}
              </text>
            </g>
          );
        })}
        {tasks.flatMap((t) =>
          t.deps.map((d) => {
            const dep = tasks.find((z) => z.id === d);
            const r1 = rowOf.get(d);
            const r2 = rowOf.get(t.id);
            if (!dep || r1 === undefined || r2 === undefined) return null;
            const x1 = x(addDays(dep.end, 1));
            const y1 = HEAD + r1 * ROW + ROW / 2;
            const x2 = x(t.start);
            const y2 = HEAD + r2 * ROW + ROW / 2;
            const mid = Math.max(x1 + 6, Math.min(x2 - 6, x1 + 10));
            return (
              <path
                key={`${d}-${t.id}`}
                d={`M${x1},${y1} H${mid} V${y2} H${x2 - 1}`}
                fill="none"
                className="stroke-ink-2"
                strokeWidth={1.2}
                markerEnd="url(#pp-arrow)"
              />
            );
          }),
        )}
        {today >= min && today <= max && (
          <g>
            <line x1={x(today) + px / 2} x2={x(today) + px / 2} y1={HEAD - 6} y2={height} className="stroke-danger" strokeDasharray="4 3" />
            <text x={x(today) + px / 2 + 3} y={HEAD - 8} className="fill-danger text-[10px] font-medium">
              Today
            </text>
          </g>
        )}
      </svg>
    </div>
  );
}

function SummaryTable({ tasks }: { tasks: ProjectTask[] }) {
  const name = (id: string) => tasks.find((t) => t.id === id)?.name ?? "";
  return (
    <div className="overflow-x-auto rounded-xl shadow-[0_0_0_1px_var(--line)]" tabIndex={0} role="region" aria-label="Task table">
      <table className="w-full min-w-[640px] border-collapse text-sm">
        <thead className="bg-sunken text-left">
          <tr>
            {["Task", "Owner", "Start", "End", "Days", "Status", "Depends on"].map((h) => (
              <th key={h} scope="col" className="px-3 py-2 font-medium text-ink">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {tasks.map((t) => (
            <tr key={t.id} className="border-t border-line">
              <td className="px-3 py-2 text-ink">{t.name}</td>
              <td className="px-3 py-2 text-ink-2">{t.owner || "-"}</td>
              <td className="px-3 py-2 tabular-nums">{fmtDay(t.start)}</td>
              <td className="px-3 py-2 tabular-nums">{fmtDay(t.end)}</td>
              <td className="px-3 py-2 tabular-nums">{diffDays(t.start, t.end) + 1}</td>
              <td className="px-3 py-2">{STATUS_LABEL[t.status]}</td>
              <td className="px-3 py-2 text-ink-2">{t.deps.map(name).join(", ") || "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function Tool() {
  const [state, setState, clear] = usePersistentState<ProjectState>("project-planner", projectInitial);
  const today = useToday();
  const [view, setView] = useState<"timeline" | "table">("timeline");
  const [draft, setDraft] = useState({ name: "", owner: "", start: "", end: "", status: "todo" as TaskStatus });
  const [error, setError] = useState<string | null>(null);

  const tasks = state.tasks;
  const sorted = [...tasks].sort((a, b) => a.start.localeCompare(b.start) || a.end.localeCompare(b.end));
  const cycle = findCycle(tasks);
  const issues = issuesFor(tasks);
  const t0 = today ?? "";

  const setTasks = (fn: (t: ProjectTask[]) => ProjectTask[]) => setState((s) => ({ ...s, tasks: fn(s.tasks) }));
  const patch = (id: string, p: Partial<ProjectTask>) => setTasks((ts) => ts.map((t) => (t.id === id ? { ...t, ...p } : t)));

  const add = (e: React.FormEvent) => {
    e.preventDefault();
    const start = draft.start || t0;
    const end = draft.end || (start ? addDays(start, 4) : "");
    if (!draft.name.trim()) return setError("Give the task a name.");
    if (!isDayKey(start) || !isDayKey(end)) return setError("Choose valid start and end dates.");
    if (end < start) return setError("The end date can't be before the start date.");
    setError(null);
    setTasks((ts) => [...ts, { id: uid(), name: draft.name.trim().slice(0, 160), owner: draft.owner.trim().slice(0, 80), start, end, status: draft.status, deps: [] }]);
    setDraft((d) => ({ ...d, name: "", start: addDays(end, 1), end: "" }));
  };

  const doneCount = tasks.filter((t) => t.status === "done").length;
  const overdue = today ? tasks.filter((t) => t.status !== "done" && t.end < today).length : 0;
  const span = tasks.length ? diffDays(sorted[0].start, tasks.reduce((m, t) => (t.end > m ? t.end : m), tasks[0].end)) + 1 : 0;

  return (
    <div className="space-y-5">
      <ToolPanel title="Project planner">
        <TextField label="Project name" optional placeholder="Website relaunch" value={state.name} maxLength={120} onChange={(e) => setState((s) => ({ ...s, name: e.target.value }))} />

        <form onSubmit={add} noValidate className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-[2fr_1.2fr_1fr_1fr_1fr_auto] lg:items-end">
          <TextField label="Task" placeholder="Design mockups" value={draft.name} maxLength={160} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} />
          <TextField label="Owner" optional value={draft.owner} maxLength={80} onChange={(e) => setDraft((d) => ({ ...d, owner: e.target.value }))} />
          <TextField label="Start" type="date" value={draft.start || t0} onChange={(e) => setDraft((d) => ({ ...d, start: e.target.value }))} />
          <TextField
            label="End"
            type="date"
            value={draft.end || ((draft.start || t0) && isDayKey(draft.start || t0) ? addDays(draft.start || t0, 4) : "")}
            onChange={(e) => setDraft((d) => ({ ...d, end: e.target.value }))}
          />
          <SelectField label="Status" value={draft.status} options={STATUS_OPTIONS} onChange={(e) => setDraft((d) => ({ ...d, status: e.target.value as TaskStatus }))} />
          <Btn type="submit" icon="plus" className="h-11">
            Add task
          </Btn>
        </form>
        {error && (
          <p className="mt-2 text-sm text-danger" role="alert">
            {error}
          </p>
        )}

        {tasks.length > 0 && (
          <div className="mt-6 overflow-x-auto rounded-xl shadow-[0_0_0_1px_var(--line)]" role="region" aria-label="Edit tasks" tabIndex={0}>
            <table className="w-full min-w-[860px] border-collapse text-sm">
              <thead className="bg-sunken text-left">
                <tr>
                  {["Task", "Owner", "Start", "End", "Status", "Depends on", ""].map((h, i) => (
                    <th key={i} scope="col" className="px-2 py-2 font-medium text-ink">
                      {h || <span className="sr-only">Actions</span>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tasks.map((t) => {
                  const others = tasks.filter((o) => o.id !== t.id);
                  return (
                    <tr key={t.id} className="border-t border-line align-top">
                      <td className="px-2 py-1.5">
                        <CellInput label="Task name" value={t.name} maxLength={160} onChange={(e) => patch(t.id, { name: e.target.value })} />
                      </td>
                      <td className="w-32 px-2 py-1.5">
                        <CellInput label={`Owner of ${t.name}`} value={t.owner} maxLength={80} onChange={(e) => patch(t.id, { owner: e.target.value })} />
                      </td>
                      <td className="w-40 px-2 py-1.5">
                        <CellInput
                          label={`Start of ${t.name}`}
                          type="date"
                          value={t.start}
                          onChange={(e) => isDayKey(e.target.value) && patch(t.id, { start: e.target.value, end: t.end < e.target.value ? e.target.value : t.end })}
                        />
                      </td>
                      <td className="w-40 px-2 py-1.5">
                        <CellInput
                          label={`End of ${t.name}`}
                          type="date"
                          value={t.end}
                          min={t.start}
                          invalid={t.end < t.start}
                          onChange={(e) => isDayKey(e.target.value) && e.target.value >= t.start && patch(t.id, { end: e.target.value })}
                        />
                      </td>
                      <td className="w-36 px-2 py-1.5">
                        <CellSelect label={`Status of ${t.name}`} value={t.status} options={STATUS_OPTIONS} onChange={(e) => patch(t.id, { status: e.target.value as TaskStatus })} />
                      </td>
                      <td className="w-44 px-2 py-1.5">
                        {others.length === 0 ? (
                          <span className="text-muted">-</span>
                        ) : (
                          <details className="relative">
                            <summary className="flex h-10 cursor-pointer list-none items-center rounded-lg px-2.5 text-ink-2 shadow-[inset_0_0_0_1px_var(--line-strong)]">
                              {t.deps.length ? `${t.deps.length} selected` : "None"}
                              <Icon name="chevron" size={14} className="ml-auto" />
                            </summary>
                            <fieldset className="absolute z-10 mt-1 max-h-60 w-60 space-y-1 overflow-auto rounded-lg bg-surface p-2.5 shadow-lg">
                              <legend className="sr-only">Tasks that must finish before {t.name}</legend>
                              {others.map((o) => (
                                <label key={o.id} className="flex min-h-9 cursor-pointer items-center gap-2 text-sm">
                                  <input
                                    type="checkbox"
                                    checked={t.deps.includes(o.id)}
                                    onChange={(e) => patch(t.id, { deps: e.target.checked ? [...t.deps, o.id] : t.deps.filter((d) => d !== o.id) })}
                                    className="h-4 w-4 accent-[var(--accent)]"
                                  />
                                  {o.name}
                                </label>
                              ))}
                            </fieldset>
                          </details>
                        )}
                      </td>
                      <td className="w-12 px-2 py-1.5">
                        <button
                          type="button"
                          aria-label={`Delete ${t.name}`}
                          className="grid h-10 w-10 place-items-center rounded-lg text-muted hover:bg-sunken hover:text-danger"
                          onClick={() => setTasks((ts) => ts.filter((x) => x.id !== t.id).map((x) => ({ ...x, deps: x.deps.filter((d) => d !== t.id) })))}
                        >
                          <Icon name="trash" size={15} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {(cycle || issues.length > 0) && (
          <div className="mt-4 space-y-2">
            {cycle && (
              <Notice tone="error" title="Circular dependency">
                {cycle.map((id) => tasks.find((t) => t.id === id)?.name).join(" → ")}. Remove one of these links.
              </Notice>
            )}
            {issues.length > 0 && (
              <Notice tone="warning" title="Schedule conflicts">
                <ul className="list-disc pl-4">
                  {issues.map((i, n) => (
                    <li key={n}>{i.text}</li>
                  ))}
                </ul>
              </Notice>
            )}
          </div>
        )}
      </ToolPanel>

      <ToolPanel
        title="Timeline"
        actions={
          <Segmented
            label="View"
            value={view}
            onChange={setView}
            options={[
              { value: "timeline", label: "Gantt chart" },
              { value: "table", label: "Table" },
            ]}
          />
        }
      >
        {tasks.length === 0 ? (
          <EmptyState icon="calendar" title="No tasks yet">
            Add tasks with start and end dates to see the timeline.
          </EmptyState>
        ) : (
          <div className="space-y-4">
            <StatGrid
              items={[
                { label: "Tasks", value: tasks.length },
                { label: "Done", value: `${doneCount} (${Math.round((doneCount / tasks.length) * 100)}%)` },
                { label: "Overdue", value: overdue },
                { label: "Span", value: `${span} days` },
              ]}
            />
            {view === "timeline" ? <Gantt tasks={sorted} today={t0} title={state.name} /> : <SummaryTable tasks={sorted} />}
            {view === "timeline" && (
              <p className="text-[0.8125rem] text-muted">
                Bars show each task&apos;s dates (status written beside each bar), arrows show dependencies, and the dashed line marks today. Switch to
                Table for the same data as text.
              </p>
            )}
          </div>
        )}
      </ToolPanel>

      <ToolPanel>
        <div className="space-y-4">
          <BackupBar<ProjectState>
            tool="project-planner"
            data={state}
            normalize={normalizeProject}
            onImport={(v) => setState(v)}
            onClear={clear}
            hasData={tasks.length > 0 || !!state.name}
            printLabel="Print plan"
          />
          <PrivacyNote stored />
        </div>
      </ToolPanel>

      {tasks.length > 0 && (
        <PrintArea>
          <h2>{state.name || "Project plan"}</h2>
          <p className="meta">
            {tasks.length} tasks · {doneCount} done · {span} days
          </p>
          <Gantt tasks={sorted} today={t0} title={state.name} fit />
          <h2>Tasks</h2>
          <SummaryTable tasks={sorted} />
        </PrintArea>
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import {
  Btn,
  CellSelect,
  EmptyState,
  NumberField,
  PrivacyNote,
  SelectField,
  StatGrid,
  TextField,
  ToolPanel,
  inputCls,
  parseNum,
  uid,
  usePersistentState,
} from "@/components/tools/kit";
import { Icon } from "@/components/ui/Icon";
import { addDays, diffDays, isDayKey } from "./lib/dates";
import { normalizeSemester, semesterInitial, type SemesterState, type TermItem, type TermKind } from "./lib/schema";
import { BackupBar, PrintArea, PrintBox, SubHead, fmtDay, useToday } from "./shared";

const KIND_LABEL: Record<TermKind, string> = { deadline: "Due", exam: "Exam", other: "Event" };
const KIND_CLS: Record<TermKind, string> = {
  deadline: "bg-accent-soft text-accent-strong",
  exam: "bg-[color-mix(in_oklch,var(--danger)_12%,transparent)] text-danger",
  other: "bg-sunken text-ink-2",
};

const short = (k: string) => fmtDay(k, { month: "short", day: "numeric" });

function KindTag({ kind }: { kind: TermKind }) {
  return <span className={`inline-block rounded px-1.5 py-px text-[0.7rem] font-semibold uppercase tracking-wide ${KIND_CLS[kind]}`}>{KIND_LABEL[kind]}</span>;
}

export default function Tool() {
  const [state, setState, clear] = usePersistentState<SemesterState>("semester-planner", semesterInitial);
  const today = useToday();
  const [courseDraft, setCourseDraft] = useState("");
  const [item, setItem] = useState<{ title: string; courseId: string; kind: TermKind; date: string }>({ title: "", courseId: "", kind: "deadline", date: "" });
  const [itemError, setItemError] = useState<string | null>(null);
  const [weeksRaw, setWeeksRaw] = useState<string | null>(null);

  const { courses, items, termStart, weeks } = state;
  const courseName = (id: string) => courses.find((c) => c.id === id)?.name ?? "General";
  const hasGeneral = items.some((i) => !i.courseId);
  const columns = [...courses.map((c) => ({ id: c.id, name: c.name })), ...(hasGeneral || !courses.length ? [{ id: "", name: "General" }] : [])];

  const termEnd = termStart ? addDays(termStart, weeks * 7 - 1) : "";
  const weekRows = termStart ? Array.from({ length: weeks }, (_, i) => ({ n: i + 1, start: addDays(termStart, i * 7), end: addDays(termStart, i * 7 + 6) })) : [];
  const currentWeek = today && termStart ? Math.floor(diffDays(termStart, today) / 7) + 1 : null;
  const sorted = [...items].sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title));
  const upcoming7 = today ? items.filter((i) => !i.done && i.date >= today && diffDays(today, i.date) <= 7).length : 0;
  const hasData = courses.length > 0 || items.length > 0 || !!termStart;

  const weeksError = weeksRaw !== null && (() => {
    const n = parseNum(weeksRaw);
    return n === null || !Number.isInteger(n) || n < 1 || n > 30 ? "Enter a whole number of weeks from 1 to 30." : null;
  })();

  const addItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!item.title.trim()) return setItemError("Give the item a title.");
    if (!isDayKey(item.date)) return setItemError("Choose a date.");
    setItemError(null);
    const it: TermItem = { id: uid(), courseId: item.courseId, title: item.title.trim().slice(0, 200), date: item.date, kind: item.kind, done: false };
    setState((s) => ({ ...s, items: [...s.items, it] }));
    setItem((x) => ({ ...x, title: "" }));
  };

  const toggle = (id: string) => setState((s) => ({ ...s, items: s.items.map((i) => (i.id === id ? { ...i, done: !i.done } : i)) }));

  const cellItems = (weekStart: string, weekEnd: string, courseId: string) =>
    sorted.filter((i) => i.courseId === courseId && i.date >= weekStart && i.date <= weekEnd);

  return (
    <div className="space-y-5">
      <ToolPanel title="Term setup">
        <div className="grid gap-4 sm:grid-cols-3">
          <TextField
            label="Term name"
            optional
            placeholder="Fall 2026"
            value={state.termName}
            maxLength={80}
            onChange={(e) => setState((s) => ({ ...s, termName: e.target.value }))}
          />
          <TextField
            label="First day of term"
            type="date"
            value={termStart}
            onChange={(e) => setState((s) => ({ ...s, termStart: isDayKey(e.target.value) ? e.target.value : "" }))}
          />
          <NumberField
            label="Weeks in term"
            value={weeksRaw ?? String(weeks)}
            error={weeksError || null}
            onChange={(e) => {
              setWeeksRaw(e.target.value);
              const n = parseNum(e.target.value);
              if (n !== null && Number.isInteger(n) && n >= 1 && n <= 30) setState((s) => ({ ...s, weeks: n }));
            }}
            onBlur={() => setWeeksRaw(null)}
          />
        </div>

        <div className="mt-6">
          <SubHead>Courses</SubHead>
          <form
            className="mt-2 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const name = courseDraft.trim();
              if (!name) return;
              const id = uid();
              setState((s) => ({ ...s, courses: [...s.courses, { id, name: name.slice(0, 80) }] }));
              setItem((x) => ({ ...x, courseId: x.courseId || id }));
              setCourseDraft("");
            }}
          >
            <input
              aria-label="Course name"
              placeholder="Course name, e.g. BIO 201"
              value={courseDraft}
              maxLength={80}
              onChange={(e) => setCourseDraft(e.target.value)}
              className={`${inputCls} h-11 min-w-0 flex-1`}
            />
            <Btn type="submit" icon="plus" className="h-11" disabled={!courseDraft.trim()}>
              Add course
            </Btn>
          </form>
          {courses.length > 0 && (
            <ul className="mt-3 flex flex-wrap gap-2">
              {courses.map((c) => {
                const count = items.filter((i) => i.courseId === c.id).length;
                return (
                  <li key={c.id} className="inline-flex items-center gap-1 rounded-full bg-sunken py-1 pl-3 pr-1 text-sm text-ink">
                    {c.name}
                    <span className="text-muted">({count})</span>
                    <button
                      type="button"
                      aria-label={`Remove course ${c.name}`}
                      className="grid h-8 w-8 place-items-center rounded-full text-muted hover:bg-surface hover:text-danger"
                      onClick={() => {
                        if (count && !window.confirm(`Remove ${c.name} and its ${count} item${count === 1 ? "" : "s"}?`)) return;
                        setState((s) => ({ ...s, courses: s.courses.filter((x) => x.id !== c.id), items: s.items.filter((i) => i.courseId !== c.id) }));
                        setItem((x) => (x.courseId === c.id ? { ...x, courseId: "" } : x));
                      }}
                    >
                      <Icon name="close" size={14} />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <form onSubmit={addItem} className="mt-6 space-y-3" noValidate>
          <SubHead>Add a deadline or exam</SubHead>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[2fr_1.2fr_1fr_1.2fr_auto] lg:items-end">
            <TextField label="Title" placeholder="Lab report 2" value={item.title} maxLength={200} onChange={(e) => setItem((x) => ({ ...x, title: e.target.value }))} />
            <SelectField
              label="Course"
              value={item.courseId}
              onChange={(e) => setItem((x) => ({ ...x, courseId: e.target.value }))}
              options={[...courses.map((c) => ({ value: c.id, label: c.name })), { value: "", label: "General" }]}
            />
            <SelectField
              label="Type"
              value={item.kind}
              onChange={(e) => setItem((x) => ({ ...x, kind: e.target.value as TermKind }))}
              options={[
                { value: "deadline", label: "Deadline" },
                { value: "exam", label: "Exam" },
                { value: "other", label: "Other event" },
              ]}
            />
            <TextField label="Date" type="date" value={item.date} onChange={(e) => setItem((x) => ({ ...x, date: e.target.value }))} />
            <Btn type="submit" icon="plus" className="h-11">
              Add
            </Btn>
          </div>
          {itemError && (
            <p className="text-sm text-danger" role="alert">
              {itemError}
            </p>
          )}
        </form>
      </ToolPanel>

      <ToolPanel title={state.termName.trim() || "Term overview"}>
        {!termStart ? (
          <EmptyState icon="calendar" title="Set the first day of term">
            The week-by-week grid appears once the term has a start date.
          </EmptyState>
        ) : (
          <div className="space-y-5">
            <StatGrid
              items={[
                {
                  label: "Current week",
                  value: currentWeek === null ? "-" : currentWeek < 1 ? "Not started" : currentWeek > weeks ? "Term over" : `${currentWeek} of ${weeks}`,
                },
                { label: "Due in next 7 days", value: upcoming7 },
                { label: "Exams", value: items.filter((i) => i.kind === "exam").length },
              ]}
            />
            <p className="text-sm text-ink-2">
              {fmtDay(termStart)} to {fmtDay(termEnd)}
            </p>
            <div className="overflow-x-auto rounded-xl shadow-[0_0_0_1px_var(--line)]" tabIndex={0} role="region" aria-label="Term weeks grid">
              <table className="w-full min-w-[560px] border-collapse text-sm">
                <thead className="bg-sunken">
                  <tr>
                    <th scope="col" className="w-36 px-3 py-2 text-left font-medium text-ink">
                      Week
                    </th>
                    {columns.map((c) => (
                      <th key={c.id || "general"} scope="col" className="px-3 py-2 text-left font-medium text-ink">
                        {c.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {weekRows.map((w) => {
                    const isNow = currentWeek === w.n;
                    return (
                      <tr key={w.n} className={`border-t border-line align-top ${isNow ? "bg-accent-soft" : ""}`}>
                        <th scope="row" className="px-3 py-2 text-left font-normal">
                          <span className="block font-medium text-ink">Week {w.n}</span>
                          <span className="block text-[0.78rem] text-muted">
                            {short(w.start)} to {short(w.end)}
                          </span>
                          {isNow && <span className="mt-1 inline-block rounded-full bg-accent px-2 py-0.5 text-[0.7rem] font-medium text-white">This week</span>}
                        </th>
                        {columns.map((c) => (
                          <td key={c.id || "general"} className="px-3 py-2">
                            <ul className="space-y-1.5">
                              {cellItems(w.start, w.end, c.id).map((i) => (
                                <li key={i.id} className="flex items-start gap-1.5">
                                  <input
                                    id={`ti-${i.id}`}
                                    type="checkbox"
                                    checked={i.done}
                                    onChange={() => toggle(i.id)}
                                    className="mt-1 h-4 w-4 shrink-0 accent-[var(--accent)]"
                                  />
                                  <label htmlFor={`ti-${i.id}`} className={`min-w-0 ${i.done ? "text-muted line-through" : "text-ink"}`}>
                                    <KindTag kind={i.kind} /> {i.title} <span className="text-[0.78rem] text-muted">{short(i.date)}</span>
                                  </label>
                                </li>
                              ))}
                            </ul>
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {sorted.length > 0 && (
          <div className="mt-6">
            <SubHead>All items by date</SubHead>
            <ul className="mt-2 divide-y divide-line overflow-hidden rounded-xl shadow-[0_0_0_1px_var(--line)]">
              {sorted.map((i) => {
                const outside = termStart && (i.date < termStart || i.date > termEnd);
                const overdue = today && !i.done && i.date < today;
                return (
                  <li key={i.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 bg-surface px-3 py-2 text-sm">
                    <span className="w-28 shrink-0 tabular-nums text-ink-2">{fmtDay(i.date, { weekday: "short", month: "short", day: "numeric" })}</span>
                    <KindTag kind={i.kind} />
                    <span className={`min-w-0 flex-1 ${i.done ? "text-muted line-through" : "text-ink"}`}>
                      {i.title} <span className="text-muted">· {courseName(i.courseId)}</span>
                    </span>
                    {i.done && <span className="text-[0.78rem] text-accent-strong">Done</span>}
                    {overdue && <span className="text-[0.78rem] font-medium text-danger">Overdue</span>}
                    {outside && <span className="text-[0.78rem] text-muted">Outside term</span>}
                    <CellSelect
                      label={`Type for ${i.title}`}
                      value={i.kind}
                      className="w-32"
                      onChange={(e) => setState((s) => ({ ...s, items: s.items.map((x) => (x.id === i.id ? { ...x, kind: e.target.value as TermKind } : x)) }))}
                      options={[
                        { value: "deadline", label: "Deadline" },
                        { value: "exam", label: "Exam" },
                        { value: "other", label: "Other" },
                      ]}
                    />
                    <button
                      type="button"
                      aria-label={`Delete ${i.title}`}
                      className="grid h-10 w-10 place-items-center rounded-lg text-muted hover:bg-sunken hover:text-danger"
                      onClick={() => setState((s) => ({ ...s, items: s.items.filter((x) => x.id !== i.id) }))}
                    >
                      <Icon name="trash" size={15} />
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </ToolPanel>

      <ToolPanel>
        <div className="space-y-4">
          <BackupBar<SemesterState>
            tool="semester-planner"
            data={state}
            normalize={normalizeSemester}
            onImport={(v) => setState(v)}
            onClear={clear}
            hasData={hasData}
            printLabel="Print term grid"
          />
          <PrivacyNote stored />
        </div>
      </ToolPanel>

      <PrintArea>
        <h2>{state.termName.trim() || "Semester plan"}</h2>
        {termStart && (
          <p className="meta">
            {fmtDay(termStart)} to {fmtDay(termEnd)} · {weeks} weeks
          </p>
        )}
        {termStart ? (
          <table>
            <thead>
              <tr>
                <th style={{ width: "16%" }}>Week</th>
                {columns.map((c) => (
                  <th key={c.id || "general"}>{c.name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {weekRows.map((w) => (
                <tr key={w.n}>
                  <td>
                    <strong>Week {w.n}</strong>
                    <br />
                    <span className="muted">
                      {short(w.start)} to {short(w.end)}
                    </span>
                  </td>
                  {columns.map((c) => (
                    <td key={c.id || "general"}>
                      {cellItems(w.start, w.end, c.id).map((i) => (
                        <div key={i.id}>
                          <PrintBox checked={i.done} />
                          <strong>{KIND_LABEL[i.kind]}:</strong> {i.title} <span className="muted">({short(i.date)})</span>
                        </div>
                      ))}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <ul>
            {sorted.map((i) => (
              <li key={i.id}>
                {i.date} {KIND_LABEL[i.kind]}: {i.title} ({courseName(i.courseId)})
              </li>
            ))}
          </ul>
        )}
      </PrintArea>
    </div>
  );
}

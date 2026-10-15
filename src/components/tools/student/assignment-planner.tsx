"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import {
  Btn,
  EmptyState,
  Notice,
  NumberField,
  PrivacyNote,
  SelectField,
  Segmented,
  StatGrid,
  TextArea,
  TextField,
  ToolPanel,
  downloadFile,
  fmt,
  parseNum,
  uid,
  usePersistentState,
} from "@/components/tools/kit";
import { Icon } from "@/components/ui/Icon";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

type Priority = "low" | "medium" | "high";

type Assignment = {
  id: string;
  title: string;
  course: string;
  /** Local wall-clock time, "YYYY-MM-DDTHH:mm" (as produced by datetime-local). */
  due: string;
  priority: Priority;
  hours: number | null;
  notes: string;
  done: boolean;
  createdAt: number;
};

type Draft = {
  title: string;
  course: string;
  due: string;
  priority: Priority;
  hours: string;
  notes: string;
};

const EMPTY_DRAFT: Draft = { title: "", course: "", due: "", priority: "medium", hours: "", notes: "" };

const PRIORITY_RANK: Record<Priority, number> = { high: 0, medium: 1, low: 2 };
const PRIORITY_LABEL: Record<Priority, string> = { high: "High priority", medium: "Medium priority", low: "Low priority" };

/* ------------------------------------------------------------------ */
/* Date helpers (all local time)                                       */
/* ------------------------------------------------------------------ */

const DUE_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

/** Parses "YYYY-MM-DDTHH:mm" as a local date. Returns null when the value is not a real date. */
function parseLocal(value: string): Date | null {
  const m = DUE_RE.exec(value.trim());
  if (!m) return null;
  const [y, mo, d, h, mi] = m.slice(1).map(Number);
  const date = new Date(y, mo - 1, d, h, mi);
  if (
    date.getFullYear() !== y ||
    date.getMonth() !== mo - 1 ||
    date.getDate() !== d ||
    date.getHours() !== h ||
    date.getMinutes() !== mi
  ) {
    // Rejects impossible dates (Feb 30) and times skipped by daylight saving.
    return null;
  }
  return date;
}

/** Whole calendar days from a to b, ignoring time of day and DST shifts. */
function calendarDayDiff(a: Date, b: Date) {
  const ua = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const ub = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((ub - ua) / 86_400_000);
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

const timeFmt = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" });
const dateFmt = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });

function dueLabel(due: Date, now: Date, done: boolean) {
  if (done) return "Done";
  const diff = calendarDayDiff(now, due);
  if (due.getTime() < now.getTime()) {
    if (diff === 0) return `overdue since ${timeFmt.format(due)} today`;
    return `overdue by ${plural(-diff, "day")}`;
  }
  if (diff === 0) return `due today at ${timeFmt.format(due)}`;
  if (diff === 1) return `due tomorrow at ${timeFmt.format(due)}`;
  return `due in ${plural(diff, "day")}`;
}

type GroupKey = "overdue" | "today" | "week" | "later" | "done";
const GROUPS: { key: GroupKey; title: string }[] = [
  { key: "overdue", title: "Overdue" },
  { key: "today", title: "Due today" },
  { key: "week", title: "This week" },
  { key: "later", title: "Later" },
  { key: "done", title: "Done" },
];

function groupOf(a: Assignment, now: Date): GroupKey {
  if (a.done) return "done";
  const due = parseLocal(a.due);
  if (!due) return "later";
  if (due.getTime() < now.getTime()) return "overdue";
  const diff = calendarDayDiff(now, due);
  if (diff === 0) return "today";
  if (diff <= 7) return "week";
  return "later";
}

/* Minute clock: re-renders once a minute so labels stay current. */
const MINUTE = 60_000;
function subscribeMinute(cb: () => void) {
  const id = window.setInterval(cb, 15_000);
  const onVis = () => cb();
  document.addEventListener("visibilitychange", onVis);
  return () => {
    window.clearInterval(id);
    document.removeEventListener("visibilitychange", onVis);
  };
}
function useMinuteNow() {
  return useSyncExternalStore(
    subscribeMinute,
    () => Math.floor(Date.now() / MINUTE) * MINUTE,
    () => 0,
  );
}

/* ------------------------------------------------------------------ */
/* Export helpers                                                      */
/* ------------------------------------------------------------------ */

function icsEscape(s: string) {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r\n|\r|\n/g, "\\n");
}

/** Folds a content line to 75 octets per RFC 5545 (continuation lines start with a space). */
function icsFold(line: string) {
  const enc = new TextEncoder();
  const out: string[] = [];
  let current = "";
  let bytes = 0;
  let limit = 75;
  for (const ch of Array.from(line)) {
    const size = enc.encode(ch).length;
    if (bytes + size > limit) {
      out.push(current);
      current = " " + ch;
      bytes = 1 + size;
      limit = 75;
    } else {
      current += ch;
      bytes += size;
    }
  }
  out.push(current);
  return out.join("\r\n");
}

function icsUtc(d: Date) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}T${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}Z`;
}

function buildIcs(items: Assignment[]) {
  const stamp = icsUtc(new Date());
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//NuvellaPromoCode//Assignment planner//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
  ];
  for (const a of items) {
    const due = parseLocal(a.due);
    if (!due) continue;
    const end = new Date(due.getTime() + 15 * 60_000);
    const summary = a.course ? `${a.course}: ${a.title}` : a.title;
    const desc = [
      PRIORITY_LABEL[a.priority],
      a.hours != null ? `Estimated work: ${fmt(a.hours, 1)} h` : "",
      a.notes,
    ]
      .filter(Boolean)
      .join("\n");
    lines.push(
      "BEGIN:VEVENT",
      `UID:${a.id}@stratum-assignment-planner`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${icsUtc(due)}`,
      `DTEND:${icsUtc(end)}`,
      `SUMMARY:${icsEscape(`Due: ${summary}`)}`,
    );
    if (desc) lines.push(`DESCRIPTION:${icsEscape(desc)}`);
    if (a.course) lines.push(`CATEGORIES:${icsEscape(a.course)}`);
    lines.push(
      `PRIORITY:${a.priority === "high" ? 1 : a.priority === "medium" ? 5 : 9}`,
      "BEGIN:VALARM",
      "ACTION:DISPLAY",
      `DESCRIPTION:${icsEscape(`Due tomorrow: ${summary}`)}`,
      "TRIGGER:-P1D",
      "END:VALARM",
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return lines.map(icsFold).join("\r\n") + "\r\n";
}

function csvCell(v: string) {
  // Neutralise spreadsheet formulas, then quote.
  const safe = /^[=+\-@]/.test(v) ? `'${v}` : v;
  return `"${safe.replace(/"/g, '""')}"`;
}

function buildCsv(items: Assignment[]) {
  const head = ["Title", "Course", "Due", "Priority", "Estimated hours", "Status", "Notes"];
  const rows = items.map((a) => [
    a.title,
    a.course,
    a.due.replace("T", " "),
    a.priority,
    a.hours != null ? String(a.hours) : "",
    a.done ? "done" : "open",
    a.notes,
  ]);
  return "\uFEFF" + [head, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export default function Tool() {
  const [items, setItems, clearItems] = usePersistentState<Assignment[]>("assignments", []);
  const list = useMemo(() => (Array.isArray(items) ? items : []), [items]);

  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [status, setStatus] = useState("");
  const [courseFilter, setCourseFilter] = useState("all");
  const [sortBy, setSortBy] = useState<"due" | "priority">("due");
  const [confirmClear, setConfirmClear] = useState(false);
  const [undo, setUndo] = useState<{ item: Assignment; index: number } | null>(null);
  const undoTimer = useRef<number | null>(null);
  const formRef = useRef<HTMLDivElement>(null);

  const minute = useMinuteNow();
  const ready = minute > 0;
  const now = useMemo(() => new Date(minute || 0), [minute]);

  useEffect(
    () => () => {
      if (undoTimer.current) window.clearTimeout(undoTimer.current);
    },
    [],
  );

  /* Validation */
  const titleError = !draft.title.trim() ? "Enter a title for the assignment." : null;
  const dueError = !draft.due.trim()
    ? "Choose a due date and time."
    : !parseLocal(draft.due)
      ? "That date and time is not valid. Use the picker or the format YYYY-MM-DD HH:MM."
      : null;
  const hoursNum = parseNum(draft.hours);
  const hoursError =
    draft.hours.trim() && (hoursNum === null || hoursNum < 0 || hoursNum > 1000)
      ? "Estimated hours must be a number between 0 and 1000."
      : null;

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => ({ ...d, [k]: v }));

  const focusForm = () => {
    window.setTimeout(() => {
      formRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
      formRef.current?.querySelector<HTMLInputElement>("input")?.focus({ preventScroll: true });
    }, 0);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    if (titleError || dueError || hoursError) {
      setStatus("Fix the highlighted fields to save the assignment.");
      return;
    }
    const base = {
      title: draft.title.trim(),
      course: draft.course.trim(),
      due: draft.due.trim(),
      priority: draft.priority,
      hours: draft.hours.trim() ? hoursNum : null,
      notes: draft.notes.trim(),
    };
    if (editingId) {
      setItems((prev) => prev.map((a) => (a.id === editingId ? { ...a, ...base } : a)));
      setStatus(`Saved changes to "${base.title}".`);
    } else {
      setItems((prev) => [...prev, { ...base, id: uid(), done: false, createdAt: Date.now() }]);
      setStatus(`Added "${base.title}".`);
    }
    setDraft((d) => ({ ...EMPTY_DRAFT, course: editingId ? "" : d.course.trim(), priority: "medium" }));
    setEditingId(null);
    setSubmitted(false);
  };

  const startEdit = (a: Assignment) => {
    setEditingId(a.id);
    setDraft({
      title: a.title,
      course: a.course,
      due: a.due,
      priority: a.priority,
      hours: a.hours != null ? String(a.hours) : "",
      notes: a.notes,
    });
    setSubmitted(false);
    setStatus(`Editing "${a.title}".`);
    focusForm();
  };

  const cancelEdit = () => {
    setEditingId(null);
    setDraft(EMPTY_DRAFT);
    setSubmitted(false);
    setStatus("Edit cancelled.");
  };

  const toggleDone = (a: Assignment) => {
    setItems((prev) => prev.map((x) => (x.id === a.id ? { ...x, done: !x.done } : x)));
    setStatus(a.done ? `Reopened "${a.title}".` : `Marked "${a.title}" as done.`);
  };

  const remove = useCallback(
    (a: Assignment) => {
      const index = list.findIndex((x) => x.id === a.id);
      setItems((prev) => prev.filter((x) => x.id !== a.id));
      if (editingId === a.id) {
        setEditingId(null);
        setDraft(EMPTY_DRAFT);
      }
      setUndo({ item: a, index });
      setStatus(`Deleted "${a.title}". Undo is available for a few seconds.`);
      if (undoTimer.current) window.clearTimeout(undoTimer.current);
      undoTimer.current = window.setTimeout(() => setUndo(null), 6000);
    },
    [list, setItems, editingId],
  );

  const restore = () => {
    if (!undo) return;
    const { item, index } = undo;
    setItems((prev) => {
      if (prev.some((x) => x.id === item.id)) return prev;
      const next = [...prev];
      next.splice(Math.max(0, Math.min(index, next.length)), 0, item);
      return next;
    });
    setUndo(null);
    if (undoTimer.current) window.clearTimeout(undoTimer.current);
    setStatus(`Restored "${item.title}".`);
  };

  /* Derived views */
  const courses = useMemo(
    () => Array.from(new Set(list.map((a) => a.course).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    [list],
  );
  const activeCourse = courseFilter === "all" || courses.includes(courseFilter) ? courseFilter : "all";

  const visible = useMemo(() => {
    const filtered = activeCourse === "all" ? list : list.filter((a) => a.course === activeCourse);
    const time = (a: Assignment) => parseLocal(a.due)?.getTime() ?? Number.MAX_SAFE_INTEGER;
    return [...filtered].sort((a, b) =>
      sortBy === "priority"
        ? PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || time(a) - time(b)
        : time(a) - time(b) || PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority],
    );
  }, [list, activeCourse, sortBy]);

  const grouped = useMemo(() => {
    const map: Record<GroupKey, Assignment[]> = { overdue: [], today: [], week: [], later: [], done: [] };
    for (const a of visible) map[groupOf(a, now)].push(a);
    return map;
  }, [visible, now]);

  const stats = useMemo(() => {
    const open = list.filter((a) => !a.done);
    let week = 0;
    let overdue = 0;
    let hours = 0;
    for (const a of open) {
      const g = groupOf(a, now);
      if (g === "overdue") overdue++;
      if (g === "today" || g === "week") week++;
      hours += a.hours ?? 0;
    }
    return { open: open.length, week, overdue, hours };
  }, [list, now]);

  const openItems = list.filter((a) => !a.done);

  return (
    <div className="space-y-5">
      <ToolPanel title={editingId ? "Edit assignment" : "Add an assignment"}>
        <div ref={formRef} className="scroll-mt-24">
          <form onSubmit={submit} noValidate className="grid gap-4 sm:grid-cols-2">
            <TextField
              label="Title"
              className="sm:col-span-2"
              value={draft.title}
              onChange={(e) => set("title", e.target.value)}
              placeholder="e.g. Lab report 3"
              error={submitted ? titleError : null}
              maxLength={200}
              required
            />
            <TextField
              label="Course"
              optional
              value={draft.course}
              onChange={(e) => set("course", e.target.value)}
              placeholder="e.g. CS 201"
              list="assignment-courses"
              maxLength={80}
            />
            <TextField
              label="Due date and time"
              type="datetime-local"
              value={draft.due}
              onChange={(e) => set("due", e.target.value)}
              error={submitted ? dueError : null}
              required
            />
            <SelectField
              label="Priority"
              value={draft.priority}
              onChange={(e) => set("priority", e.target.value as Priority)}
              options={[
                { value: "high", label: "High" },
                { value: "medium", label: "Medium" },
                { value: "low", label: "Low" },
              ]}
            />
            <NumberField
              label="Estimated hours"
              optional
              value={draft.hours}
              onChange={(e) => set("hours", e.target.value)}
              placeholder="e.g. 4"
              error={hoursError}
            />
            <TextArea
              label="Notes"
              optional
              className="sm:col-span-2"
              value={draft.notes}
              onChange={(e) => set("notes", e.target.value)}
              placeholder="Submission link, rubric reminders, group members"
              rows={3}
              maxLength={2000}
            />
            <div className="flex flex-wrap gap-2 sm:col-span-2">
              <button type="submit" className="btn btn-sm">
                <Icon name={editingId ? "check" : "plus"} size={16} />
                {editingId ? "Save changes" : "Add assignment"}
              </button>
              {editingId && (
                <Btn variant="ghost" onClick={cancelEdit}>
                  Cancel
                </Btn>
              )}
            </div>
          </form>
          <datalist id="assignment-courses">
            {courses.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </div>
      </ToolPanel>

      <ToolPanel
        title="Your assignments"
        actions={
          <>
            <Btn
              variant="ghost"
              icon="calendar"
              disabled={openItems.length === 0}
              onClick={() => {
                downloadFile("assignments.ics", buildIcs(openItems), "text/calendar");
                setStatus(`Exported ${plural(openItems.length, "open assignment")} to a calendar file.`);
              }}
            >
              Export .ics
            </Btn>
            <Btn
              variant="ghost"
              icon="download"
              disabled={list.length === 0}
              onClick={() => {
                downloadFile("assignments.csv", buildCsv(visible), "text/csv");
                setStatus(`Exported ${plural(visible.length, "assignment")} to CSV.`);
              }}
            >
              Export CSV
            </Btn>
          </>
        }
      >
        <div className="space-y-5">
          <p className="sr-only" role="status" aria-live="polite">
            {status}
          </p>

          {undo && (
            <div
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-night px-4 py-2.5 text-sm text-night-ink"
              role="status"
            >
              <span>Deleted &ldquo;{undo.item.title}&rdquo;.</span>
              <button
                type="button"
                onClick={restore}
                className="min-h-10 rounded-md px-3 font-semibold text-accent-night underline underline-offset-2"
              >
                Undo
              </button>
            </div>
          )}

          <StatGrid
            items={[
              { label: "Open", value: ready ? stats.open : "–" },
              { label: "Due this week", value: ready ? stats.week : "–" },
              {
                label: "Overdue",
                value: ready ? <span className={stats.overdue > 0 ? "text-danger" : ""}>{stats.overdue}</span> : "–",
              },
              { label: "Hours of work left", value: ready ? fmt(stats.hours, 1) : "–" },
            ]}
          />

          {list.length > 0 && (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <SelectField
                label="Course"
                className="sm:w-64"
                value={activeCourse}
                onChange={(e) => setCourseFilter(e.target.value)}
                options={[{ value: "all", label: "All courses" }, ...courses.map((c) => ({ value: c, label: c }))]}
              />
              <div>
                <p className="mb-2 text-sm font-medium text-ink">
                  Sort by
                </p>
                <Segmented
                  label="Sort by"
                  value={sortBy}
                  onChange={setSortBy}
                  options={[
                    { value: "due", label: "Due date" },
                    { value: "priority", label: "Priority" },
                  ]}
                />
              </div>
            </div>
          )}

          {!ready ? null : list.length === 0 ? (
            <EmptyState icon="deadline" title="No assignments yet">
              Add your first assignment above. Deadlines are sorted and grouped for you automatically.
            </EmptyState>
          ) : visible.length === 0 ? (
            <EmptyState icon="search" title="Nothing for this course">
              Choose &ldquo;All courses&rdquo; to see every assignment.
            </EmptyState>
          ) : (
            GROUPS.filter((g) => grouped[g.key].length > 0).map((g) => (
              <section key={g.key} aria-labelledby={`group-${g.key}`}>
                <h3 id={`group-${g.key}`} className="mb-2.5 flex items-center gap-2 font-sans text-[0.95rem] font-semibold tracking-normal text-ink">
                  {g.title}
                  <span className="chip h-6 tabular-nums">{grouped[g.key].length}</span>
                </h3>
                <ul className="space-y-2.5">
                  {grouped[g.key].map((a) => (
                    <AssignmentCard
                      key={a.id}
                      a={a}
                      now={now}
                      editing={editingId === a.id}
                      onEdit={() => startEdit(a)}
                      onToggle={() => toggleDone(a)}
                      onDelete={() => remove(a)}
                    />
                  ))}
                </ul>
              </section>
            ))
          )}

          {list.length > 0 && (
            <div className="border-t border-line pt-4">
              {confirmClear ? (
                <Notice tone="warning" title="Delete every assignment?">
                  <p>This removes all {list.length} assignments from this browser and cannot be undone.</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Btn
                      variant="danger"
                      icon="trash"
                      onClick={() => {
                        clearItems();
                        setConfirmClear(false);
                        setUndo(null);
                        setEditingId(null);
                        setDraft(EMPTY_DRAFT);
                        setStatus("All assignments cleared.");
                      }}
                    >
                      Yes, clear all
                    </Btn>
                    <Btn variant="ghost" onClick={() => setConfirmClear(false)}>
                      Keep them
                    </Btn>
                  </div>
                </Notice>
              ) : (
                <Btn variant="danger" icon="trash" onClick={() => setConfirmClear(true)}>
                  Clear all
                </Btn>
              )}
            </div>
          )}

          <PrivacyNote stored />
        </div>
      </ToolPanel>
    </div>
  );
}

function AssignmentCard({
  a,
  now,
  editing,
  onEdit,
  onToggle,
  onDelete,
}: {
  a: Assignment;
  now: Date;
  editing: boolean;
  onEdit: () => void;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const due = parseLocal(a.due);
  const label = due ? dueLabel(due, now, a.done) : "invalid date";
  const overdue = !a.done && due != null && due.getTime() < now.getTime();
  return (
    <li
      className={`rounded-xl bg-surface p-4 shadow-[0_0_0_1px_var(--line)] ${editing ? "shadow-[0_0_0_2px_var(--accent)]" : ""} ${a.done ? "opacity-75" : ""}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
        <p className={`min-w-0 break-words font-medium text-ink ${a.done ? "line-through decoration-muted" : ""}`}>
          {a.title}
        </p>
        <span className={`text-sm font-medium ${overdue ? "text-danger" : a.done ? "text-muted" : "text-accent-strong"}`}>
          {overdue && <Icon name="alert" size={14} className="mr-1 inline -translate-y-px" />}
          {label}
        </span>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {a.course && <span className="chip">{a.course}</span>}
        <span className="chip">{PRIORITY_LABEL[a.priority]}</span>
        {a.hours != null && <span className="chip">{fmt(a.hours, 1)} h</span>}
        {due && <span className="chip">{`${dateFmt.format(due)}, ${timeFmt.format(due)}`}</span>}
      </div>
      {a.notes && <p className="mt-2 whitespace-pre-wrap break-words text-sm text-ink-2">{a.notes}</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        <Btn variant={a.done ? "ghost" : "primary"} icon={a.done ? "reset" : "check"} onClick={onToggle} aria-label={`${a.done ? "Reopen" : "Mark done"}: ${a.title}`}>
          {a.done ? "Reopen" : "Mark done"}
        </Btn>
        <Btn variant="ghost" onClick={onEdit} aria-label={`Edit ${a.title}`}>
          Edit
        </Btn>
        <Btn variant="danger" icon="trash" onClick={onDelete} aria-label={`Delete ${a.title}`}>
          Delete
        </Btn>
      </div>
    </li>
  );
}

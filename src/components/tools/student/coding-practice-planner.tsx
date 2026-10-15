"use client";

import { useMemo, useRef, useState, useSyncExternalStore } from "react";
import {
  Btn,
  CellInput,
  CellSelect,
  EmptyState,
  Notice,
  PrivacyNote,
  SelectField,
  StatGrid,
  TextArea,
  TextField,
  ToolPanel,
  downloadFile,
  uid,
  usePersistentState,
} from "@/components/tools/kit";
import { Icon } from "@/components/ui/Icon";

/* ------------------------------------------------------------------ */
/* Types and constants                                                 */
/* ------------------------------------------------------------------ */

type TopicStatus = "not-started" | "learning" | "practicing" | "confident";
type Difficulty = "easy" | "medium" | "hard";
type TaskStatus = "todo" | "done";

type Task = {
  id: string;
  title: string;
  difficulty: Difficulty;
  link: string;
  status: TaskStatus;
  notes: string;
  /** Local calendar date "YYYY-MM-DD" when marked done. */
  completedAt: string | null;
};

type Topic = { id: string; name: string; status: TopicStatus; tasks: Task[] };
type Data = { version: 1; topics: Topic[] };

const TOPIC_STATUSES: { value: TopicStatus; label: string }[] = [
  { value: "not-started", label: "Not started" },
  { value: "learning", label: "Learning" },
  { value: "practicing", label: "Practicing" },
  { value: "confident", label: "Confident" },
];
const STATUS_RANK: Record<TopicStatus, number> = { "not-started": 0, learning: 1, practicing: 2, confident: 3 };
const STATUS_LABEL: Record<TopicStatus, string> = {
  "not-started": "Not started",
  learning: "Learning",
  practicing: "Practicing",
  confident: "Confident",
};
const DIFFS: Difficulty[] = ["easy", "medium", "hard"];
const DIFF_RANK: Record<Difficulty, number> = { easy: 0, medium: 1, hard: 2 };
const DIFF_LABEL: Record<Difficulty, string> = { easy: "Easy", medium: "Medium", hard: "Hard" };

const STARTER_NAMES = [
  "Arrays",
  "Strings",
  "Hashing",
  "Two pointers",
  "Recursion",
  "Trees",
  "Graphs",
  "Dynamic programming",
  "SQL",
  "System design basics",
];

const STARTER: Data = {
  version: 1,
  topics: STARTER_NAMES.map((name) => ({
    id: `starter-${name.toLowerCase().replace(/\s+/g, "-")}`,
    name,
    status: "not-started",
    tasks: [],
  })),
};

/* ------------------------------------------------------------------ */
/* Date helpers (local calendar days)                                  */
/* ------------------------------------------------------------------ */

function localKey(d: Date) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
function shiftKey(key: string, days: number) {
  const [y, m, d] = key.split("-").map(Number);
  return localKey(new Date(y, m - 1, d + days));
}
function subscribeDay(cb: () => void) {
  const id = window.setInterval(cb, 60_000);
  document.addEventListener("visibilitychange", cb);
  return () => {
    window.clearInterval(id);
    document.removeEventListener("visibilitychange", cb);
  };
}

function streaks(dates: Set<string>, today: string) {
  // Current streak counts back from today, or from yesterday if nothing is done yet today.
  let current = 0;
  let cursor = dates.has(today) ? today : shiftKey(today, -1);
  while (dates.has(cursor)) {
    current++;
    cursor = shiftKey(cursor, -1);
  }
  let best = 0;
  for (const d of dates) {
    if (dates.has(shiftKey(d, -1))) continue;
    let len = 1;
    let c = shiftKey(d, 1);
    while (dates.has(c)) {
      len++;
      c = shiftKey(c, 1);
    }
    best = Math.max(best, len);
  }
  return { current, best, activeToday: dates.has(today) };
}

/* ------------------------------------------------------------------ */
/* Validation                                                          */
/* ------------------------------------------------------------------ */

function linkError(raw: string) {
  const s = raw.trim();
  if (!s) return null;
  try {
    const u = new URL(s);
    if (u.protocol !== "http:" && u.protocol !== "https:") return "Links must start with http:// or https://.";
    return null;
  } catch {
    return "Enter a full link that starts with http:// or https://.";
  }
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

function validateImport(raw: unknown): { data: Data | null; errors: string[] } {
  const errors: string[] = [];
  if (!isObj(raw)) return { data: null, errors: ["The file must contain a JSON object with a \"topics\" list."] };
  if (!Array.isArray(raw.topics)) return { data: null, errors: ["Missing \"topics\" list at the top level."] };
  if (raw.topics.length > 500) return { data: null, errors: ["Too many topics (the limit is 500)."] };
  const topics: Topic[] = [];
  const seen = new Set<string>();
  raw.topics.forEach((t, ti) => {
    const where = `Topic ${ti + 1}`;
    if (!isObj(t)) {
      errors.push(`${where} is not an object.`);
      return;
    }
    const name = typeof t.name === "string" ? t.name.trim() : "";
    if (!name) errors.push(`${where} needs a "name".`);
    const status = t.status;
    if (typeof status !== "string" || !(status in STATUS_RANK))
      errors.push(`${where} ("${name || "unnamed"}") has status "${String(status)}". Use not-started, learning, practicing or confident.`);
    if (!Array.isArray(t.tasks)) {
      errors.push(`${where} ("${name || "unnamed"}") needs a "tasks" list (it can be empty).`);
      return;
    }
    const tasks: Task[] = [];
    t.tasks.forEach((k, ki) => {
      const tw = `${where}, task ${ki + 1}`;
      if (!isObj(k)) {
        errors.push(`${tw} is not an object.`);
        return;
      }
      const title = typeof k.title === "string" ? k.title.trim() : "";
      if (!title) errors.push(`${tw} needs a "title".`);
      if (typeof k.difficulty !== "string" || !(k.difficulty in DIFF_RANK))
        errors.push(`${tw} has difficulty "${String(k.difficulty)}". Use easy, medium or hard.`);
      if (k.status !== "todo" && k.status !== "done") errors.push(`${tw} has status "${String(k.status)}". Use todo or done.`);
      const link = typeof k.link === "string" ? k.link.trim() : "";
      if (link && linkError(link)) errors.push(`${tw} has a link that is not http or https.`);
      const completedAt =
        typeof k.completedAt === "string" && /^\d{4}-\d{2}-\d{2}$/.test(k.completedAt) ? k.completedAt : null;
      if (k.completedAt != null && completedAt === null)
        errors.push(`${tw} has "completedAt" that is not a YYYY-MM-DD date.`);
      let id = typeof k.id === "string" && k.id ? k.id : uid();
      if (seen.has(id)) id = uid();
      seen.add(id);
      tasks.push({
        id,
        title,
        difficulty: k.difficulty as Difficulty,
        link,
        status: k.status as TaskStatus,
        notes: typeof k.notes === "string" ? k.notes : "",
        completedAt: k.status === "done" ? completedAt : null,
      });
    });
    let id = typeof t.id === "string" && t.id ? t.id : uid();
    if (seen.has(id)) id = uid();
    seen.add(id);
    topics.push({ id, name, status: status as TopicStatus, tasks });
  });
  if (errors.length) return { data: null, errors };
  return { data: { version: 1, topics }, errors: [] };
}

/* ------------------------------------------------------------------ */
/* Task form                                                           */
/* ------------------------------------------------------------------ */

type TaskDraft = { title: string; difficulty: Difficulty; link: string; notes: string };

function TaskForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial: TaskDraft;
  submitLabel: string;
  onSubmit: (d: TaskDraft) => void;
  onCancel?: () => void;
}) {
  const [d, setD] = useState<TaskDraft>(initial);
  const [tried, setTried] = useState(false);
  const titleErr = !d.title.trim() ? "Enter a task title." : null;
  const linkErr = linkError(d.link);
  return (
    <form
      noValidate
      className="grid gap-3 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        setTried(true);
        if (titleErr || linkErr) return;
        onSubmit({ ...d, title: d.title.trim(), link: d.link.trim(), notes: d.notes.trim() });
        if (!onCancel) {
          setD({ title: "", difficulty: d.difficulty, link: "", notes: "" });
          setTried(false);
        }
      }}
    >
      <TextField
        label="Task"
        value={d.title}
        onChange={(e) => setD({ ...d, title: e.target.value })}
        placeholder="e.g. Two sum"
        error={tried ? titleErr : null}
        maxLength={200}
      />
      <SelectField
        label="Difficulty"
        value={d.difficulty}
        onChange={(e) => setD({ ...d, difficulty: e.target.value as Difficulty })}
        options={DIFFS.map((x) => ({ value: x, label: DIFF_LABEL[x] }))}
      />
      <TextField
        label="Link"
        optional
        type="url"
        inputMode="url"
        value={d.link}
        onChange={(e) => setD({ ...d, link: e.target.value })}
        placeholder="https://"
        error={tried || d.link.length > 8 ? linkErr : null}
        autoComplete="off"
        className="sm:col-span-2"
      />
      <TextArea
        label="Notes"
        optional
        value={d.notes}
        onChange={(e) => setD({ ...d, notes: e.target.value })}
        rows={2}
        className="sm:col-span-2 [&_textarea]:min-h-[72px]"
        maxLength={2000}
      />
      <div className="flex flex-wrap gap-2 sm:col-span-2">
        <button type="submit" className="btn btn-sm">
          <Icon name={onCancel ? "check" : "plus"} size={16} />
          {submitLabel}
        </button>
        {onCancel && (
          <Btn variant="ghost" onClick={onCancel}>
            Cancel
          </Btn>
        )}
      </div>
    </form>
  );
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export default function Tool() {
  const [stored, setData, resetData] = usePersistentState<Data>("coding-practice", STARTER);
  const topics = useMemo(() => (stored && Array.isArray(stored.topics) ? stored.topics : STARTER.topics), [stored]);

  const today = useSyncExternalStore(subscribeDay, () => localKey(new Date()), () => "");

  const [statusFilter, setStatusFilter] = useState<"all" | TaskStatus>("all");
  const [diffFilter, setDiffFilter] = useState<"all" | Difficulty>("all");
  const [newTopic, setNewTopic] = useState("");
  const [newTopicErr, setNewTopicErr] = useState<string | null>(null);
  const [editingTask, setEditingTask] = useState<string | null>(null);
  const [addingTo, setAddingTo] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState<{ topicId: string; taskId: string } | "none" | null>(null);
  const [importMsg, setImportMsg] = useState<{ tone: "success" | "error"; title: string; lines: string[] } | null>(null);
  const [confirm, setConfirm] = useState<null | "reset" | { topicId: string }>(null);
  const [announce, setAnnounce] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const update = (fn: (topics: Topic[]) => Topic[]) =>
    setData((prev) => ({ version: 1, topics: fn(prev && Array.isArray(prev.topics) ? prev.topics : STARTER.topics) }));

  const updateTopic = (id: string, patch: Partial<Topic>) => update((ts) => ts.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  const updateTask = (topicId: string, taskId: string, fn: (k: Task) => Task) =>
    update((ts) => ts.map((t) => (t.id === topicId ? { ...t, tasks: t.tasks.map((k) => (k.id === taskId ? fn(k) : k)) } : t)));

  /* Overview */
  const overview = useMemo(() => {
    const byDiff: Record<Difficulty, { done: number; total: number }> = {
      easy: { done: 0, total: 0 },
      medium: { done: 0, total: 0 },
      hard: { done: 0, total: 0 },
    };
    const dist: Record<TopicStatus, number> = { "not-started": 0, learning: 0, practicing: 0, confident: 0 };
    const dates = new Set<string>();
    let done = 0;
    let total = 0;
    for (const t of topics) {
      dist[t.status] = (dist[t.status] ?? 0) + 1;
      for (const k of t.tasks) {
        total++;
        byDiff[k.difficulty].total++;
        if (k.status === "done") {
          done++;
          byDiff[k.difficulty].done++;
          if (k.completedAt) dates.add(k.completedAt);
        }
      }
    }
    return { byDiff, dist, dates, done, total };
  }, [topics]);
  const streak = today ? streaks(overview.dates, today) : { current: 0, best: 0, activeToday: false };

  const suggestNext = () => {
    const ranked = topics
      .map((t, i) => ({ t, i }))
      .filter(({ t }) => t.tasks.some((k) => k.status === "todo"))
      .sort((a, b) => STATUS_RANK[a.t.status] - STATUS_RANK[b.t.status] || a.i - b.i);
    const pick = ranked[0]?.t;
    if (!pick) {
      setSuggestion("none");
      setAnnounce("No open tasks to suggest. Add a task to any topic.");
      return;
    }
    const task = pick.tasks
      .map((k, i) => ({ k, i }))
      .filter(({ k }) => k.status === "todo")
      .sort((a, b) => DIFF_RANK[a.k.difficulty] - DIFF_RANK[b.k.difficulty] || a.i - b.i)[0].k;
    setSuggestion({ topicId: pick.id, taskId: task.id });
    setAnnounce(`Suggested next: ${task.title}, ${DIFF_LABEL[task.difficulty].toLowerCase()}, in ${pick.name}.`);
  };
  const suggested =
    suggestion && suggestion !== "none"
      ? (() => {
          const t = topics.find((x) => x.id === suggestion.topicId);
          const k = t?.tasks.find((x) => x.id === suggestion.taskId);
          return t && k && k.status === "todo" ? { t, k } : null;
        })()
      : null;

  const addTopic = (e: React.FormEvent) => {
    e.preventDefault();
    const name = newTopic.trim();
    if (!name) {
      setNewTopicErr("Enter a topic name.");
      return;
    }
    if (topics.some((t) => t.name.toLocaleLowerCase() === name.toLocaleLowerCase())) {
      setNewTopicErr("You already have a topic with that name.");
      return;
    }
    update((ts) => [...ts, { id: uid(), name, status: "not-started", tasks: [] }]);
    setNewTopic("");
    setNewTopicErr(null);
    setAnnounce(`Added topic ${name}.`);
  };

  const toggleTask = (topicId: string, k: Task) => {
    const done = k.status !== "done";
    updateTask(topicId, k.id, (x) => ({ ...x, status: done ? "done" : "todo", completedAt: done ? localKey(new Date()) : null }));
    setAnnounce(done ? `Marked ${k.title} as done.` : `Moved ${k.title} back to to do.`);
  };

  const exportJson = () => {
    const payload = { app: "stratum-coding-practice", version: 1, exportedAt: new Date().toISOString(), topics };
    downloadFile(`coding-practice-${today || "export"}.json`, JSON.stringify(payload, null, 2), "application/json");
    setAnnounce("Exported your plan as JSON.");
  };

  const importJson = async (file: File) => {
    if (file.size > 2_000_000) {
      setImportMsg({ tone: "error", title: "File too large", lines: ["Choose a JSON file under 2 MB."] });
      return;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(await file.text());
    } catch {
      setImportMsg({ tone: "error", title: "Could not read that file", lines: ["It is not valid JSON. Export a plan from this tool and try that file."] });
      return;
    }
    const { data, errors } = validateImport(parsed);
    if (!data) {
      setImportMsg({
        tone: "error",
        title: "Nothing was imported",
        lines: errors.length > 8 ? [...errors.slice(0, 8), `And ${errors.length - 8} more problems.`] : errors,
      });
      return;
    }
    setData(data);
    setSuggestion(null);
    setEditingTask(null);
    const n = data.topics.reduce((s, t) => s + t.tasks.length, 0);
    setImportMsg({
      tone: "success",
      title: "Import complete",
      lines: [`Loaded ${data.topics.length} topics and ${n} tasks. Your previous plan was replaced.`],
    });
  };

  const filtered = (t: Topic) =>
    t.tasks.filter(
      (k) => (statusFilter === "all" || k.status === statusFilter) && (diffFilter === "all" || k.difficulty === diffFilter),
    );
  const filtering = statusFilter !== "all" || diffFilter !== "all";

  return (
    <div className="space-y-5">
      <p className="sr-only" role="status" aria-live="polite">
        {announce}
      </p>

      <ToolPanel
        title="Progress"
        actions={
          <Btn icon="compass" onClick={suggestNext}>
            Suggest next
          </Btn>
        }
      >
        <div className="space-y-4">
          {suggestion === "none" && (
            <Notice tone="info">No open tasks yet. Add a task to any topic and try again.</Notice>
          )}
          {suggested && (
            <Notice tone="success" title="Suggested next">
              <p>
                <span className="font-medium">{suggested.k.title}</span> ({DIFF_LABEL[suggested.k.difficulty].toLowerCase()}) in{" "}
                {suggested.t.name}, your least confident topic with open tasks.
              </p>
              {suggested.k.link && (
                <a href={suggested.k.link} target="_blank" rel="noopener noreferrer" className="link mt-1 inline-flex min-h-10 items-center gap-1">
                  Open problem <Icon name="external" size={14} />
                </a>
              )}
            </Notice>
          )}
          <StatGrid
            items={[
              { label: "Tasks done", value: `${overview.done} / ${overview.total}` },
              ...DIFFS.map((d) => ({
                label: `${DIFF_LABEL[d]} done`,
                value: `${overview.byDiff[d].done} / ${overview.byDiff[d].total}`,
              })),
              {
                label: "Current streak",
                value: today ? `${streak.current} day${streak.current === 1 ? "" : "s"}` : "–",
              },
              { label: "Best streak", value: today ? `${streak.best} day${streak.best === 1 ? "" : "s"}` : "–" },
            ]}
          />
          {today && streak.current > 0 && !streak.activeToday && (
            <p className="text-sm text-ink-2">Finish one task today to keep your streak going.</p>
          )}
          <div>
            <p className="mb-2 text-sm font-medium text-ink">Topic confidence</p>
            <div className="flex h-3 overflow-hidden rounded-full bg-sunken" aria-hidden="true">
              {TOPIC_STATUSES.map((s, i) =>
                overview.dist[s.value] ? (
                  <div
                    key={s.value}
                    className="h-full bg-accent"
                    style={{ width: `${(overview.dist[s.value] / Math.max(1, topics.length)) * 100}%`, opacity: 0.25 + i * 0.25 }}
                  />
                ) : null,
              )}
            </div>
            <ul className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-ink-2 sm:grid-cols-4">
              {TOPIC_STATUSES.map((s, i) => (
                <li key={s.value} className="flex items-center gap-2">
                  <span aria-hidden="true" className="h-2.5 w-2.5 rounded-sm bg-accent" style={{ opacity: 0.25 + i * 0.25 }} />
                  {s.label}: <span className="font-semibold tabular-nums text-ink">{overview.dist[s.value]}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </ToolPanel>

      <ToolPanel title="Topics and tasks">
        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <SelectField
              label="Show tasks"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as "all" | TaskStatus)}
              options={[
                { value: "all", label: "All statuses" },
                { value: "todo", label: "To do" },
                { value: "done", label: "Done" },
              ]}
            />
            <SelectField
              label="Difficulty"
              value={diffFilter}
              onChange={(e) => setDiffFilter(e.target.value as "all" | Difficulty)}
              options={[{ value: "all", label: "All difficulties" }, ...DIFFS.map((d) => ({ value: d, label: DIFF_LABEL[d] }))]}
            />
          </div>

          {topics.length === 0 ? (
            <EmptyState icon="practice" title="No topics">
              Add a topic below, or reset to load the starter list.
            </EmptyState>
          ) : (
            <ul className="space-y-3">
              {topics.map((t, ti) => {
                const shown = filtered(t);
                const doneCount = t.tasks.filter((k) => k.status === "done").length;
                return (
                  <li key={t.id} className="rounded-xl bg-surface shadow-[0_0_0_1px_var(--line)]">
                    <details className="group" open={t.tasks.length > 0 || addingTo === t.id}>
                      <summary className="flex min-h-12 cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 [&::-webkit-details-marker]:hidden">
                        <Icon name="chevron" size={18} className="shrink-0 -rotate-90 text-muted transition-transform group-open:rotate-0 motion-reduce:transition-none" />
                        <span className="min-w-0 flex-1 break-words font-medium text-ink">{t.name || `Topic ${ti + 1}`}</span>
                        <span className="chip">{STATUS_LABEL[t.status]}</span>
                        <span className="text-sm tabular-nums text-muted">
                          {doneCount}/{t.tasks.length} done
                        </span>
                      </summary>
                      <div className="space-y-4 border-t border-line px-4 pb-4 pt-4">
                        <div className="grid gap-2 sm:grid-cols-[1fr_200px_auto]">
                          <CellInput
                            label={`Topic name for ${t.name || `topic ${ti + 1}`}`}
                            value={t.name}
                            onChange={(e) => updateTopic(t.id, { name: e.target.value })}
                            maxLength={80}
                          />
                          <CellSelect
                            label={`Confidence for ${t.name}`}
                            value={t.status}
                            onChange={(e) => updateTopic(t.id, { status: e.target.value as TopicStatus })}
                            options={TOPIC_STATUSES}
                          />
                          <Btn variant="danger" icon="trash" onClick={() => setConfirm({ topicId: t.id })} aria-label={`Delete topic ${t.name}`}>
                            <span className="sm:sr-only">Delete topic</span>
                          </Btn>
                        </div>
                        {!t.name.trim() && <p className="text-sm text-danger" role="alert">Give this topic a name.</p>}

                        {typeof confirm === "object" && confirm?.topicId === t.id && (
                          <Notice tone="warning" title={`Delete ${t.name || "this topic"}?`}>
                            <p>Its {t.tasks.length} tasks will be removed too.</p>
                            <div className="mt-3 flex flex-wrap gap-2">
                              <Btn
                                variant="danger"
                                icon="trash"
                                onClick={() => {
                                  update((ts) => ts.filter((x) => x.id !== t.id));
                                  setConfirm(null);
                                  setAnnounce(`Deleted topic ${t.name}.`);
                                }}
                              >
                                Delete topic
                              </Btn>
                              <Btn variant="ghost" onClick={() => setConfirm(null)}>
                                Cancel
                              </Btn>
                            </div>
                          </Notice>
                        )}

                        {t.tasks.length === 0 ? (
                          <p className="text-sm text-muted">No tasks yet. Add a problem to practice.</p>
                        ) : shown.length === 0 ? (
                          <p className="text-sm text-muted">No tasks match the current filters.</p>
                        ) : (
                          <ul className="space-y-2">
                            {shown.map((k) => {
                              const isSuggested = suggested?.k.id === k.id;
                              return (
                                <li
                                  key={k.id}
                                  className={`rounded-lg bg-sunken p-3 ${isSuggested ? "shadow-[0_0_0_2px_var(--accent)]" : ""}`}
                                >
                                  {editingTask === k.id ? (
                                    <TaskForm
                                      initial={{ title: k.title, difficulty: k.difficulty, link: k.link, notes: k.notes }}
                                      submitLabel="Save task"
                                      onCancel={() => setEditingTask(null)}
                                      onSubmit={(d) => {
                                        updateTask(t.id, k.id, (x) => ({ ...x, ...d }));
                                        setEditingTask(null);
                                        setAnnounce(`Saved ${d.title}.`);
                                      }}
                                    />
                                  ) : (
                                    <>
                                      <div className="flex items-start gap-3">
                                        <input
                                          id={`task-${k.id}`}
                                          type="checkbox"
                                          checked={k.status === "done"}
                                          onChange={() => toggleTask(t.id, k)}
                                          className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer accent-[var(--accent)]"
                                        />
                                        <label
                                          htmlFor={`task-${k.id}`}
                                          className={`min-w-0 flex-1 cursor-pointer break-words text-[0.95rem] ${k.status === "done" ? "text-muted line-through" : "text-ink"}`}
                                        >
                                          {k.title}
                                          <span className="sr-only">{k.status === "done" ? " (done)" : " (to do)"}</span>
                                        </label>
                                      </div>
                                      <div className="mt-2 flex flex-wrap items-center gap-1.5 pl-8">
                                        <span className="chip">{DIFF_LABEL[k.difficulty]}</span>
                                        {k.status === "done" && k.completedAt && <span className="chip">Done {k.completedAt}</span>}
                                        {isSuggested && <span className="chip font-medium text-accent-strong">Suggested</span>}
                                      </div>
                                      {k.notes && <p className="mt-2 whitespace-pre-wrap break-words pl-8 text-sm text-ink-2">{k.notes}</p>}
                                      <div className="mt-2 flex flex-wrap gap-2 pl-8">
                                        {k.link && !linkError(k.link) && (
                                          <a
                                            href={k.link}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="btn btn-sm btn-ghost"
                                            aria-label={`Open ${k.title} in a new tab`}
                                          >
                                            <Icon name="external" size={16} />
                                            Open
                                          </a>
                                        )}
                                        <Btn variant="ghost" onClick={() => setEditingTask(k.id)} aria-label={`Edit ${k.title}`}>
                                          Edit
                                        </Btn>
                                        <Btn
                                          variant="danger"
                                          icon="trash"
                                          aria-label={`Delete ${k.title}`}
                                          onClick={() => {
                                            update((ts) =>
                                              ts.map((x) => (x.id === t.id ? { ...x, tasks: x.tasks.filter((y) => y.id !== k.id) } : x)),
                                            );
                                            setAnnounce(`Deleted ${k.title}.`);
                                          }}
                                        >
                                          Delete
                                        </Btn>
                                      </div>
                                    </>
                                  )}
                                </li>
                              );
                            })}
                          </ul>
                        )}

                        {addingTo === t.id ? (
                          <div className="rounded-lg p-3 shadow-[inset_0_0_0_1px_var(--line-strong)]">
                            <p className="mb-3 text-sm font-medium text-ink">New task in {t.name}</p>
                            <TaskForm
                              initial={{ title: "", difficulty: "easy", link: "", notes: "" }}
                              submitLabel="Add task"
                              onSubmit={(d) => {
                                update((ts) =>
                                  ts.map((x) =>
                                    x.id === t.id
                                      ? { ...x, tasks: [...x.tasks, { id: uid(), ...d, status: "todo", completedAt: null }] }
                                      : x,
                                  ),
                                );
                                setAnnounce(`Added ${d.title} to ${t.name}.`);
                              }}
                            />
                            <Btn variant="subtle" className="mt-2" onClick={() => setAddingTo(null)}>
                              Done adding
                            </Btn>
                          </div>
                        ) : (
                          <Btn variant="ghost" icon="plus" onClick={() => setAddingTo(t.id)}>
                            Add task
                          </Btn>
                        )}
                      </div>
                    </details>
                  </li>
                );
              })}
            </ul>
          )}

          {filtering && (
            <p className="text-[0.8125rem] text-muted">Filters hide some tasks. Topic totals still count every task.</p>
          )}

          <form onSubmit={addTopic} noValidate className="flex flex-col gap-2 sm:flex-row sm:items-start">
            <TextField
              label="New topic"
              value={newTopic}
              onChange={(e) => {
                setNewTopic(e.target.value);
                setNewTopicErr(null);
              }}
              placeholder="e.g. Heaps"
              error={newTopicErr}
              className="flex-1"
              maxLength={80}
            />
            <button type="submit" className="btn btn-sm btn-ghost sm:mt-7">
              <Icon name="plus" size={16} />
              Add topic
            </button>
          </form>
        </div>
      </ToolPanel>

      <ToolPanel title="Backup and reset">
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Btn variant="ghost" icon="download" onClick={exportJson}>
              Export JSON
            </Btn>
            <Btn variant="ghost" icon="deploy" onClick={() => fileRef.current?.click()}>
              Import JSON
            </Btn>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="sr-only"
              tabIndex={-1}
              aria-label="Choose a JSON file to import"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (file) void importJson(file);
              }}
            />
            <Btn variant="danger" icon="reset" onClick={() => setConfirm("reset")}>
              Reset to starter list
            </Btn>
          </div>
          <p className="text-[0.8125rem] text-muted">Importing replaces your current plan. Export first if you want a backup.</p>
          {importMsg && (
            <Notice tone={importMsg.tone} title={importMsg.title}>
              {importMsg.lines.length === 1 ? (
                <p>{importMsg.lines[0]}</p>
              ) : (
                <ul className="list-disc space-y-0.5 pl-4">
                  {importMsg.lines.map((l, i) => (
                    <li key={i}>{l}</li>
                  ))}
                </ul>
              )}
            </Notice>
          )}
          {confirm === "reset" && (
            <Notice tone="warning" title="Reset everything?">
              <p>All topics, tasks and completion dates will be replaced by the starter list. This cannot be undone.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Btn
                  variant="danger"
                  icon="reset"
                  onClick={() => {
                    resetData();
                    setConfirm(null);
                    setSuggestion(null);
                    setEditingTask(null);
                    setAddingTo(null);
                    setImportMsg(null);
                    setAnnounce("Plan reset to the starter list.");
                  }}
                >
                  Yes, reset
                </Btn>
                <Btn variant="ghost" onClick={() => setConfirm(null)}>
                  Cancel
                </Btn>
              </div>
            </Notice>
          )}
          <PrivacyNote stored />
        </div>
      </ToolPanel>
    </div>
  );
}

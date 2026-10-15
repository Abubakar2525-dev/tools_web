/**
 * Data shapes, defaults and import validators for the datetime-b planners.
 * Pure TS. Every normalizer accepts untrusted JSON (a backup file or old
 * localStorage) and returns a clean value or a human-readable error.
 */

export type Result<T> = { ok: true; value: T } | { ok: false; error: string };

const DAY = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown, max = 500, fallback = "") => (typeof v === "string" ? v.slice(0, max) : fallback);
const bool = (v: unknown) => v === true;
const num = (v: unknown, min: number, max: number, fallback: number) =>
  typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback;
const day = (v: unknown, fallback = "") => (typeof v === "string" && DAY.test(v) ? v : fallback);
const time = (v: unknown, fallback = "") => (typeof v === "string" && TIME.test(v) ? v : fallback);
const oneOf = <T extends string>(v: unknown, opts: readonly T[], fallback: T): T => (opts.includes(v as T) ? (v as T) : fallback);

let counter = 0;
/** Random-enough id for imported rows that lack one. */
export const newId = () => `${Date.now().toString(36)}${(counter++).toString(36)}${Math.random().toString(36).slice(2, 8)}`;
const id = (v: unknown, seen: Set<string>) => {
  let out = typeof v === "string" && v.length > 0 && v.length <= 80 ? v : newId();
  while (seen.has(out)) out = newId();
  seen.add(out);
  return out;
};

const MAX_ITEMS = 5000;
function list<T>(v: unknown, map: (item: Obj, seen: Set<string>) => T | null): T[] {
  if (!Array.isArray(v)) return [];
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of v.slice(0, MAX_ITEMS)) {
    if (!isObj(item)) continue;
    const m = map(item, seen);
    if (m !== null) out.push(m);
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Backup envelope                                                     */
/* ------------------------------------------------------------------ */

export const BACKUP_FORMAT = "stratum-planner";

export function wrapBackup(tool: string, data: unknown, exportedAt: string) {
  return { format: BACKUP_FORMAT, tool, version: 1, exportedAt, data };
}

/** Parses a backup file's text and validates it for `tool`. */
export function readBackup<T>(text: string, tool: string, normalize: (u: unknown) => Result<T>): Result<T> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, error: "This file is not valid JSON." };
  }
  if (isObj(parsed) && parsed.format === BACKUP_FORMAT) {
    if (parsed.tool !== tool) return { ok: false, error: `This backup belongs to a different tool (${String(parsed.tool).slice(0, 60)}).` };
    return normalize(parsed.data);
  }
  return normalize(parsed);
}

/* ------------------------------------------------------------------ */
/* Week planner                                                        */
/* ------------------------------------------------------------------ */

export interface WeekTask { id: string; day: number; text: string; done: boolean }
export interface WeekData { tasks: WeekTask[]; notes: string }
export interface WeekPlannerState { weekStartsOn: 0 | 1; weeks: Record<string, WeekData> }
export const weekPlannerInitial: WeekPlannerState = { weekStartsOn: 1, weeks: {} };

export function normalizeWeekPlanner(u: unknown): Result<WeekPlannerState> {
  if (!isObj(u) || !isObj(u.weeks)) return { ok: false, error: "Expected a week planner backup with a \"weeks\" object." };
  const weeks: Record<string, WeekData> = {};
  for (const [k, v] of Object.entries(u.weeks).slice(0, 520)) {
    if (!DAY.test(k) || !isObj(v)) continue;
    weeks[k] = {
      notes: str(v.notes, 20000),
      tasks: list(v.tasks, (t, seen) => {
        const text = str(t.text, 300).trim();
        if (!text) return null;
        return { id: id(t.id, seen), day: Math.round(num(t.day, 0, 6, 0)), text, done: bool(t.done) };
      }),
    };
  }
  return { ok: true, value: { weekStartsOn: u.weekStartsOn === 0 ? 0 : 1, weeks } };
}

/* ------------------------------------------------------------------ */
/* To-do lists                                                         */
/* ------------------------------------------------------------------ */

export type Recur = "none" | "daily" | "weekly";
export interface TodoItem { id: string; text: string; done: boolean; recur: Recur; doneOn: string | null }
export interface TodoList { id: string; name: string; items: TodoItem[] }
export interface TodoState { lists: TodoList[]; activeId: string }
export const todoInitial: TodoState = { lists: [{ id: "default", name: "My list", items: [] }], activeId: "default" };

export function normalizeTodo(u: unknown): Result<TodoState> {
  if (!isObj(u) || !Array.isArray(u.lists)) return { ok: false, error: "Expected a to-do backup with a \"lists\" array." };
  const lists = list(u.lists, (l, seen) => ({
    id: id(l.id, seen),
    name: str(l.name, 80).trim() || "Untitled list",
    items: list(l.items, (it, s2) => {
      const text = str(it.text, 500).trim();
      if (!text) return null;
      const doneOn = day(it.doneOn) || null;
      return { id: id(it.id, s2), text, done: bool(it.done), recur: oneOf(it.recur, ["none", "daily", "weekly"] as const, "none"), doneOn };
    }),
  }));
  if (!lists.length) return { ok: false, error: "The backup contains no lists." };
  const activeId = typeof u.activeId === "string" && lists.some((l) => l.id === u.activeId) ? u.activeId : lists[0].id;
  return { ok: true, value: { lists, activeId } };
}

/* ------------------------------------------------------------------ */
/* Habits                                                              */
/* ------------------------------------------------------------------ */

export interface Habit { id: string; name: string; created: string; checks: string[] }
export interface HabitState { habits: Habit[] }
export const habitInitial: HabitState = { habits: [] };

export function normalizeHabits(u: unknown): Result<HabitState> {
  if (!isObj(u) || !Array.isArray(u.habits)) return { ok: false, error: "Expected a habit backup with a \"habits\" array." };
  const habits = list(u.habits, (h, seen) => {
    const name = str(h.name, 80).trim();
    if (!name) return null;
    const checks = Array.isArray(h.checks) ? [...new Set(h.checks.filter((c): c is string => typeof c === "string" && DAY.test(c)))].sort().slice(-20000) : [];
    const created = day(h.created) || checks[0] || "";
    if (!created) return null;
    return { id: id(h.id, seen), name, created: checks[0] && checks[0] < created ? checks[0] : created, checks };
  });
  return { ok: true, value: { habits } };
}

/* ------------------------------------------------------------------ */
/* Notes                                                               */
/* ------------------------------------------------------------------ */

export interface Note { id: string; title: string; body: string; updated: number }
export interface NotesState { notes: Note[]; activeId: string | null }
export const notesInitial: NotesState = { notes: [], activeId: null };

export function normalizeNotes(u: unknown): Result<NotesState> {
  if (!isObj(u) || !Array.isArray(u.notes)) return { ok: false, error: "Expected a notes backup with a \"notes\" array." };
  const notes = list(u.notes, (n, seen) => ({
    id: id(n.id, seen),
    title: str(n.title, 200),
    body: str(n.body, 500_000),
    updated: num(n.updated, 0, 8.64e15, 0),
  }));
  const activeId = typeof u.activeId === "string" && notes.some((n) => n.id === u.activeId) ? u.activeId : (notes[0]?.id ?? null);
  return { ok: true, value: { notes, activeId } };
}

/* ------------------------------------------------------------------ */
/* Semester planner                                                    */
/* ------------------------------------------------------------------ */

export type TermKind = "deadline" | "exam" | "other";
export interface Course { id: string; name: string }
export interface TermItem { id: string; courseId: string; title: string; date: string; kind: TermKind; done: boolean }
export interface SemesterState { termName: string; termStart: string; weeks: number; courses: Course[]; items: TermItem[] }
export const semesterInitial: SemesterState = { termName: "", termStart: "", weeks: 15, courses: [], items: [] };

export function normalizeSemester(u: unknown): Result<SemesterState> {
  if (!isObj(u) || !Array.isArray(u.courses) || !Array.isArray(u.items)) return { ok: false, error: "Expected a semester backup with \"courses\" and \"items\" arrays." };
  const courses = list(u.courses, (c, seen) => {
    const name = str(c.name, 80).trim();
    return name ? { id: id(c.id, seen), name } : null;
  });
  const ids = new Set(courses.map((c) => c.id));
  const items = list(u.items, (it, seen) => {
    const title = str(it.title, 200).trim();
    const date = day(it.date);
    if (!title || !date) return null;
    const courseId = typeof it.courseId === "string" && ids.has(it.courseId) ? it.courseId : "";
    return { id: id(it.id, seen), courseId, title, date, kind: oneOf(it.kind, ["deadline", "exam", "other"] as const, "deadline"), done: bool(it.done) };
  });
  return {
    ok: true,
    value: { termName: str(u.termName, 80), termStart: day(u.termStart), weeks: Math.round(num(u.weeks, 1, 30, 15)), courses, items },
  };
}

/* ------------------------------------------------------------------ */
/* Daily study planner                                                 */
/* ------------------------------------------------------------------ */

export interface StudyTask { id: string; text: string; done: boolean }
export interface StudyBlock { id: string; subject: string; minutes: number; kind: "study" | "break"; tasks: StudyTask[] }
export interface DailyStudyState { date: string; startTime: string; blocks: StudyBlock[] }
export const dailyStudyInitial: DailyStudyState = { date: "", startTime: "09:00", blocks: [] };

export function normalizeDailyStudy(u: unknown): Result<DailyStudyState> {
  if (!isObj(u) || !Array.isArray(u.blocks)) return { ok: false, error: "Expected a study plan backup with a \"blocks\" array." };
  const blocks = list(u.blocks, (b, seen) => ({
    id: id(b.id, seen),
    subject: str(b.subject, 120),
    minutes: Math.round(num(b.minutes, 1, 600, 50)),
    kind: oneOf(b.kind, ["study", "break"] as const, "study"),
    tasks: list(b.tasks, (t, s2) => {
      const text = str(t.text, 300).trim();
      return text ? { id: id(t.id, s2), text, done: bool(t.done) } : null;
    }),
  }));
  return { ok: true, value: { date: day(u.date), startTime: time(u.startTime, "09:00"), blocks } };
}

/* ------------------------------------------------------------------ */
/* Project planner                                                     */
/* ------------------------------------------------------------------ */

export type TaskStatus = "todo" | "doing" | "blocked" | "done";
export const STATUS_LABEL: Record<TaskStatus, string> = { todo: "To do", doing: "In progress", blocked: "Blocked", done: "Done" };
export interface ProjectTask { id: string; name: string; owner: string; start: string; end: string; status: TaskStatus; deps: string[] }
export interface ProjectState { name: string; tasks: ProjectTask[] }
export const projectInitial: ProjectState = { name: "", tasks: [] };

export function normalizeProject(u: unknown): Result<ProjectState> {
  if (!isObj(u) || !Array.isArray(u.tasks)) return { ok: false, error: "Expected a project backup with a \"tasks\" array." };
  const tasks = list(u.tasks, (t, seen) => {
    const name = str(t.name, 160).trim();
    const start = day(t.start);
    const end = day(t.end);
    if (!name || !start || !end) return null;
    return {
      id: id(t.id, seen),
      name,
      owner: str(t.owner, 80),
      start,
      end: end < start ? start : end,
      status: oneOf(t.status, ["todo", "doing", "blocked", "done"] as const, "todo"),
      deps: Array.isArray(t.deps) ? t.deps.filter((d): d is string => typeof d === "string").slice(0, 50) : [],
    };
  });
  const ids = new Set(tasks.map((t) => t.id));
  for (const t of tasks) t.deps = [...new Set(t.deps.filter((d) => d !== t.id && ids.has(d)))];
  return { ok: true, value: { name: str(u.name, 120), tasks } };
}

/* ------------------------------------------------------------------ */
/* Thesis planner                                                      */
/* ------------------------------------------------------------------ */

export interface Milestone { id: string; name: string; days: number; done: boolean }
export interface Chapter { id: string; name: string; percent: number; written: number }
export interface ThesisState { title: string; submission: string; bufferDays: number; milestones: Milestone[]; totalWords: number; chapters: Chapter[] }

export const thesisInitial: ThesisState = {
  title: "",
  submission: "",
  bufferDays: 7,
  milestones: [
    { id: "m1", name: "Finalize proposal and outline", days: 14, done: false },
    { id: "m2", name: "Literature review", days: 35, done: false },
    { id: "m3", name: "Methodology and ethics approval", days: 21, done: false },
    { id: "m4", name: "Data collection", days: 42, done: false },
    { id: "m5", name: "Analysis", days: 28, done: false },
    { id: "m6", name: "Full first draft", days: 42, done: false },
    { id: "m7", name: "Supervisor feedback and revisions", days: 21, done: false },
    { id: "m8", name: "Proofreading, references, formatting", days: 10, done: false },
  ],
  totalWords: 15000,
  chapters: [
    { id: "c1", name: "Introduction", percent: 10, written: 0 },
    { id: "c2", name: "Literature review", percent: 20, written: 0 },
    { id: "c3", name: "Methodology", percent: 15, written: 0 },
    { id: "c4", name: "Results", percent: 25, written: 0 },
    { id: "c5", name: "Discussion", percent: 20, written: 0 },
    { id: "c6", name: "Conclusion", percent: 10, written: 0 },
  ],
};

export function normalizeThesis(u: unknown): Result<ThesisState> {
  if (!isObj(u) || !Array.isArray(u.milestones) || !Array.isArray(u.chapters)) return { ok: false, error: "Expected a thesis backup with \"milestones\" and \"chapters\" arrays." };
  return {
    ok: true,
    value: {
      title: str(u.title, 200),
      submission: day(u.submission),
      bufferDays: Math.round(num(u.bufferDays, 0, 365, 7)),
      totalWords: Math.round(num(u.totalWords, 0, 1_000_000, 15000)),
      milestones: list(u.milestones, (m, seen) => ({ id: id(m.id, seen), name: str(m.name, 160), days: Math.round(num(m.days, 1, 730, 14)), done: bool(m.done) })),
      chapters: list(u.chapters, (c, seen) => ({ id: id(c.id, seen), name: str(c.name, 160), percent: num(c.percent, 0, 100, 0), written: Math.round(num(c.written, 0, 1_000_000, 0)) })),
    },
  };
}

/* ------------------------------------------------------------------ */
/* Study timer                                                         */
/* ------------------------------------------------------------------ */

export interface Subject { id: string; name: string; goal: number }
export interface Session { id: string; subjectId: string; start: number; ms: number; day: string }
export interface ActiveTimer { subjectId: string; startedAt: number | null; accumulated: number; day: string; firstStart: number }
export interface StudyTimerState { subjects: Subject[]; sessions: Session[]; active: ActiveTimer | null }
export const studyTimerInitial: StudyTimerState = { subjects: [], sessions: [], active: null };

export function normalizeStudyTimer(u: unknown): Result<StudyTimerState> {
  if (!isObj(u) || !Array.isArray(u.subjects) || !Array.isArray(u.sessions)) return { ok: false, error: "Expected a study timer backup with \"subjects\" and \"sessions\" arrays." };
  const subjects = list(u.subjects, (s, seen) => {
    const name = str(s.name, 80).trim();
    return name ? { id: id(s.id, seen), name, goal: Math.round(num(s.goal, 0, 1440, 60)) } : null;
  });
  const ids = new Set(subjects.map((s) => s.id));
  const sessions = list(u.sessions, (s, seen) => {
    const d = day(s.day);
    if (typeof s.subjectId !== "string" || !ids.has(s.subjectId) || !d) return null;
    return { id: id(s.id, seen), subjectId: s.subjectId, start: num(s.start, 0, 8.64e15, 0), ms: Math.round(num(s.ms, 0, 86_400_000, 0)), day: d };
  });
  return { ok: true, value: { subjects, sessions, active: null } };
}

/* ------------------------------------------------------------------ */
/* Exam countdown                                                      */
/* ------------------------------------------------------------------ */

export interface Exam { id: string; subject: string; date: string; time: string; location: string; notes: string }
export interface ExamState { exams: Exam[] }
export const examInitial: ExamState = { exams: [] };

export function normalizeExams(u: unknown): Result<ExamState> {
  if (!isObj(u) || !Array.isArray(u.exams)) return { ok: false, error: "Expected an exam backup with an \"exams\" array." };
  const exams = list(u.exams, (e, seen) => {
    const subject = str(e.subject, 120).trim();
    const date = day(e.date);
    if (!subject || !date) return null;
    return { id: id(e.id, seen), subject, date, time: time(e.time), location: str(e.location, 120), notes: str(e.notes, 500) };
  });
  return { ok: true, value: { exams } };
}

/* ------------------------------------------------------------------ */
/* Presentation timer (settings only)                                  */
/* ------------------------------------------------------------------ */

export interface PresSection { id: string; name: string; seconds: number }
export interface PresState { sections: PresSection[]; warnAt: number; chimes: boolean }
export const presInitial: PresState = {
  sections: [
    { id: "s1", name: "Opening", seconds: 60 },
    { id: "s2", name: "Problem", seconds: 120 },
    { id: "s3", name: "Solution", seconds: 240 },
    { id: "s4", name: "Q&A", seconds: 180 },
  ],
  warnAt: 30,
  chimes: true,
};

/**
 * Pure calendar helpers for the datetime-b planners. No DOM, no React.
 * "Day keys" are local calendar dates as "YYYY-MM-DD" strings, so streaks and
 * deadlines follow the user's wall calendar, never UTC midnight.
 */

const pad = (n: number, w = 2) => String(Math.trunc(Math.abs(n))).padStart(w, "0");

export const DAY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Local calendar day of a Date as YYYY-MM-DD. */
export function dayKey(d: Date): string {
  return `${pad(d.getFullYear(), 4)}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** True when `s` is a real calendar date in YYYY-MM-DD form (rejects 2026-02-30). */
export function isDayKey(s: unknown): s is string {
  if (typeof s !== "string") return false;
  const m = DAY_RE.exec(s);
  if (!m) return false;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1) return false;
  return d <= daysInMonth(y, mo - 1);
}

function parts(k: string): [number, number, number] {
  const m = DAY_RE.exec(k);
  if (!m) throw new Error(`Invalid day key: ${k}`);
  return [Number(m[1]), Number(m[2]) - 1, Number(m[3])];
}

/** Local midnight Date for a day key. */
export function parseDay(k: string): Date {
  const [y, m, d] = parts(k);
  const dt = new Date(y, m, d);
  dt.setFullYear(y); // keep years < 100 intact
  return dt;
}

/** Calendar arithmetic on a day key (DST-safe: works on UTC day numbers). */
export function addDays(k: string, n: number): string {
  const [y, m, d] = parts(k);
  const t = new Date(Date.UTC(y, m, d + n));
  return `${pad(t.getUTCFullYear(), 4)}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

/** Whole days from a to b (positive when b is later). */
export function diffDays(a: string, b: string): number {
  const [y1, m1, d1] = parts(a);
  const [y2, m2, d2] = parts(b);
  return Math.round((Date.UTC(y2, m2, d2) - Date.UTC(y1, m1, d1)) / 86_400_000);
}

/** 0 = Sunday … 6 = Saturday. */
export function weekdayOf(k: string): number {
  const [y, m, d] = parts(k);
  return new Date(Date.UTC(y, m, d)).getUTCDay();
}

export function startOfWeek(k: string, weekStartsOn: 0 | 1): string {
  const wd = weekdayOf(k);
  const back = (wd - weekStartsOn + 7) % 7;
  return addDays(k, -back);
}

export function daysInMonth(year: number, month0: number): number {
  return new Date(Date.UTC(year, month0 + 1, 0)).getUTCDate();
}

/** ISO 8601 week number (weeks start Monday; week 1 contains the first Thursday). */
export function isoWeek(k: string): { year: number; week: number } {
  const wd = (weekdayOf(k) + 6) % 7; // Monday = 0
  const thursday = addDays(k, 3 - wd);
  const [ty] = parts(thursday);
  const jan1 = `${pad(ty, 4)}-01-01`;
  return { year: ty, week: Math.floor(diffDays(jan1, thursday) / 7) + 1 };
}

/** Weeks (rows of 7) for a month grid; null = padding cell outside the month. */
export function monthMatrix(year: number, month0: number, weekStartsOn: 0 | 1): (number | null)[][] {
  const first = new Date(Date.UTC(year, month0, 1)).getUTCDay();
  const lead = (first - weekStartsOn + 7) % 7;
  const total = daysInMonth(year, month0);
  const cells: (number | null)[] = Array.from({ length: lead }, () => null);
  for (let d = 1; d <= total; d++) cells.push(d);
  while (cells.length % 7) cells.push(null);
  const rows: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
  return rows;
}

export const keyOf = (year: number, month0: number, day: number) => `${pad(year, 4)}-${pad(month0 + 1)}-${pad(day)}`;

/**
 * Parses a holiday list, one per line: "2026-12-25 Christmas" (one date) or
 * "12-25 Christmas" (every year). Separators after the date may be a space,
 * tab, comma, colon or dash. Lines starting with # are ignored.
 */
export function parseHolidays(text: string, years: number[]): { byDay: Record<string, string[]>; errors: string[] } {
  const byDay: Record<string, string[]> = {};
  const errors: string[] = [];
  const add = (k: string, name: string) => {
    (byDay[k] ??= []).push(name);
  };
  text.split(/\r?\n/).forEach((raw, i) => {
    const line = raw.trim();
    if (!line || line.startsWith("#")) return;
    const m = /^(?:(\d{4})-)?(\d{1,2})-(\d{1,2})(?:[\s,:–-]+(.*))?$/.exec(line);
    if (!m) {
      errors.push(`Line ${i + 1}: start with a date like 2026-12-25 or 12-25.`);
      return;
    }
    const name = (m[4] ?? "").trim() || "Holiday";
    const mo = Number(m[2]);
    const d = Number(m[3]);
    const targetYears = m[1] ? [Number(m[1])] : years;
    let valid = false;
    for (const y of targetYears) {
      const k = keyOf(y, mo - 1, d);
      if (isDayKey(k)) {
        valid = true;
        if (years.includes(y)) add(k, name);
      }
    }
    if (!valid && !(m[1] === undefined && mo === 2 && d === 29)) errors.push(`Line ${i + 1}: ${line.split(/\s/)[0]} is not a real date.`);
  });
  return { byDay, errors };
}

/* ------------------------------------------------------------------ */
/* Habits                                                              */
/* ------------------------------------------------------------------ */

/**
 * Current and best streaks of consecutive checked days. The current streak
 * counts back from today; if today is not checked yet it counts back from
 * yesterday, so an unchecked "today" does not break a running streak.
 */
export function streaks(checks: readonly string[], today: string): { current: number; best: number } {
  const set = new Set(checks.filter((c) => isDayKey(c) && c <= today));
  const sorted = [...set].sort();
  let best = 0;
  let run = 0;
  let prev: string | null = null;
  for (const k of sorted) {
    run = prev !== null && diffDays(prev, k) === 1 ? run + 1 : 1;
    if (run > best) best = run;
    prev = k;
  }
  let current = 0;
  let cursor = set.has(today) ? today : addDays(today, -1);
  while (set.has(cursor)) {
    current++;
    cursor = addDays(cursor, -1);
  }
  return { current, best };
}

/** Checked days / days elapsed from `from` to `today`, both inclusive. */
export function completionRate(checks: readonly string[], from: string, today: string): { done: number; total: number; rate: number } {
  const total = Math.max(0, diffDays(from, today) + 1);
  if (total === 0) return { done: 0, total: 0, rate: 0 };
  const done = new Set(checks.filter((c) => isDayKey(c) && c >= from && c <= today)).size;
  return { done, total, rate: done / total };
}

/* ------------------------------------------------------------------ */
/* Thesis                                                              */
/* ------------------------------------------------------------------ */

/**
 * Back-schedules milestones that run one after another and end `bufferDays`
 * before submission. Each milestone spans `days` calendar days, start and due
 * date inclusive. Returned in the same order as `durations`.
 */
export function backSchedule(submission: string, bufferDays: number, durations: readonly number[]): { start: string; due: string }[] {
  const out: { start: string; due: string }[] = new Array(durations.length);
  let due = addDays(submission, -Math.max(0, Math.round(bufferDays)));
  for (let i = durations.length - 1; i >= 0; i--) {
    const len = Math.max(1, Math.round(durations[i]));
    const start = addDays(due, -(len - 1));
    out[i] = { start, due };
    due = addDays(start, -1);
  }
  return out;
}

/**
 * Splits a word target by percentages. When the percentages total 100 the
 * parts use largest-remainder rounding so they add up exactly to `total`.
 */
export function splitWords(total: number, percents: readonly number[]): number[] {
  const exact = percents.map((p) => (total * p) / 100);
  const floors = exact.map(Math.floor);
  const sum = percents.reduce((a, b) => a + b, 0);
  if (Math.abs(sum - 100) > 1e-9) return exact.map((x) => Math.round(x));
  let remainder = Math.round(total) - floors.reduce((a, b) => a + b, 0);
  const order = exact.map((x, i) => ({ i, frac: x - Math.floor(x) })).sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (const { i } of order) {
    if (remainder <= 0) break;
    floors[i]++;
    remainder--;
  }
  return floors;
}

/* ------------------------------------------------------------------ */
/* Clock / durations                                                   */
/* ------------------------------------------------------------------ */

/** "HH:MM" → minutes after midnight, or null. */
export function parseHHMM(s: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(s.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const mi = Number(m[2]);
  if (h > 23 || mi > 59) return null;
  return h * 60 + mi;
}

/** Minutes after midnight → "HH:MM", with " (+1 day)" style suffix past midnight. */
export function fmtClock(min: number): string {
  const day = Math.floor(min / 1440);
  const m = ((min % 1440) + 1440) % 1440;
  const base = `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
  return day > 0 ? `${base} (+${day} day${day > 1 ? "s" : ""})` : base;
}

/** Sequential schedule: each block starts when the previous one ends. */
export function scheduleBlocks(startMin: number, minutes: readonly number[]): { start: number; end: number }[] {
  let t = startMin;
  return minutes.map((m) => {
    const start = t;
    t += Math.max(0, m);
    return { start, end: t };
  });
}

/** Milliseconds → "1:02:03" or "2:03" (truncates toward zero; sign kept). */
export function fmtClockMs(ms: number): string {
  const neg = ms < 0;
  const total = Math.floor(Math.abs(ms) / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const body = h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
  return neg ? `-${body}` : body;
}

/** Minutes → "1 h 25 min" / "40 min". */
export function fmtMinutes(min: number): string {
  const m = Math.round(min);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h} h ${r} min` : `${h} h`;
}

/** Breaks a positive duration into days/hours/minutes/seconds. */
export function countdownParts(ms: number): { days: number; hours: number; minutes: number; seconds: number } {
  const s = Math.max(0, Math.floor(ms / 1000));
  return {
    days: Math.floor(s / 86400),
    hours: Math.floor((s % 86400) / 3600),
    minutes: Math.floor((s % 3600) / 60),
    seconds: s % 60,
  };
}

/** "m:ss" or "h:mm:ss" → seconds, or null. Plain numbers are minutes. */
export function parseDuration(s: string): number | null {
  const t = s.trim();
  if (/^\d+(\.\d+)?$/.test(t)) return Math.round(Number(t) * 60);
  const m = /^(?:(\d+):)?(\d{1,2}):(\d{2})$/.exec(t);
  if (!m) return null;
  const h = m[1] ? Number(m[1]) : 0;
  const mi = Number(m[2]);
  const sec = Number(m[3]);
  if (sec > 59 || (m[1] && mi > 59)) return null;
  return h * 3600 + mi * 60 + sec;
}

/* ------------------------------------------------------------------ */
/* Projects                                                            */
/* ------------------------------------------------------------------ */

/** Returns one dependency cycle as a list of ids (first id repeated at the end), or null. */
export function findCycle(tasks: readonly { id: string; deps: readonly string[] }[]): string[] | null {
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const state = new Map<string, 1 | 2>(); // 1 visiting, 2 done
  const stack: string[] = [];
  const visit = (id: string): string[] | null => {
    const s = state.get(id);
    if (s === 2) return null;
    if (s === 1) return [...stack.slice(stack.indexOf(id)), id];
    state.set(id, 1);
    stack.push(id);
    for (const d of byId.get(id)?.deps ?? []) {
      if (!byId.has(d)) continue;
      const c = visit(d);
      if (c) return c;
    }
    stack.pop();
    state.set(id, 2);
    return null;
  };
  for (const t of tasks) {
    const c = visit(t.id);
    if (c) return c;
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* To-do recurrence                                                    */
/* ------------------------------------------------------------------ */

/** Whether a recurring item checked on `doneOn` still counts as done on `today`. */
export function recurringDone(recur: "none" | "daily" | "weekly", doneOn: string | null, today: string): boolean {
  if (!doneOn || !isDayKey(doneOn)) return false;
  if (recur === "daily") return doneOn === today;
  if (recur === "weekly") return startOfWeek(doneOn, 1) === startOfWeek(today, 1);
  return true;
}

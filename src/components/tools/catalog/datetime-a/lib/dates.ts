/**
 * Pure calendar math on civil (wall-calendar) dates in the proleptic Gregorian
 * calendar. Dates are plain { y, m, d } objects (m is 1-12), never Date
 * instances, so time zones and daylight-saving changes cannot shift a day.
 * Day arithmetic uses a day count (days since 1970-01-01) computed with
 * Howard Hinnant's civil-from-days algorithms.
 */

export type CivilDate = { y: number; m: number; d: number };

export const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

export const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;

export function isLeapYear(y: number): boolean {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}

export function daysInMonth(y: number, m: number): number {
  if (m === 2) return isLeapYear(y) ? 29 : 28;
  return [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1];
}

export function daysInYear(y: number): number {
  return isLeapYear(y) ? 366 : 365;
}

export function isValidDate(y: number, m: number, d: number): boolean {
  return (
    Number.isInteger(y) &&
    Number.isInteger(m) &&
    Number.isInteger(d) &&
    m >= 1 &&
    m <= 12 &&
    d >= 1 &&
    d <= daysInMonth(y, m)
  );
}

/** Days since 1970-01-01 (negative before). */
export function toDays({ y, m, d }: CivilDate): number {
  const yy = m <= 2 ? y - 1 : y;
  const era = Math.floor(yy / 400);
  const yoe = yy - era * 400;
  const mp = (m + 9) % 12;
  const doy = Math.floor((153 * mp + 2) / 5) + d - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146097 + doe - 719468;
}

export function fromDays(n: number): CivilDate {
  const z = n + 719468;
  const era = Math.floor(z / 146097);
  const doe = z - era * 146097;
  const yoe = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365);
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
  const mp = Math.floor((5 * doy + 2) / 153);
  const d = doy - Math.floor((153 * mp + 2) / 5) + 1;
  const m = mp < 10 ? mp + 3 : mp - 9;
  const y = yoe + era * 400 + (m <= 2 ? 1 : 0);
  return { y, m, d };
}

const pad = (n: number, w = 2) => String(Math.abs(n)).padStart(w, "0");

/** Parses strict `YYYY-MM-DD` (the value format of `<input type="date">`). */
export function parseISODate(s: string): CivilDate | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (y < 1 || !isValidDate(y, mo, d)) return null;
  return { y, m: mo, d };
}

export function formatISODate(c: CivilDate): string {
  return `${c.y < 0 ? "-" : ""}${pad(c.y, 4)}-${pad(c.m)}-${pad(c.d)}`;
}

/** "Monday, October 12, 2026". */
export function formatLong(c: CivilDate): string {
  return `${WEEKDAY_NAMES[weekday(c)]}, ${MONTH_NAMES[c.m - 1]} ${c.d}, ${c.y}`;
}

/** "Oct 12, 2026". */
export function formatShort(c: CivilDate): string {
  return `${MONTH_NAMES[c.m - 1].slice(0, 3)} ${c.d}, ${c.y}`;
}

export function compareDates(a: CivilDate, b: CivilDate): number {
  return toDays(a) - toDays(b);
}

export function addDays(c: CivilDate, n: number): CivilDate {
  return fromDays(toDays(c) + n);
}

export function daysBetween(a: CivilDate, b: CivilDate): number {
  return toDays(b) - toDays(a);
}

/** 0 = Sunday … 6 = Saturday. */
export function weekday(c: CivilDate): number {
  return (((toDays(c) + 4) % 7) + 7) % 7;
}

/** ISO weekday: 1 = Monday … 7 = Sunday. */
export function isoWeekday(c: CivilDate): number {
  return weekday(c) || 7;
}

export function dayOfYear(c: CivilDate): number {
  return toDays(c) - toDays({ y: c.y, m: 1, d: 1 }) + 1;
}

export function quarter(c: CivilDate): number {
  return Math.floor((c.m - 1) / 3) + 1;
}

export type MonthMode = "clamp" | "overflow";

/**
 * Adds calendar months. When the target month is shorter than the start day
 * (Jan 31 + 1 month), "clamp" returns the last day of the target month
 * (Feb 28 or 29) and "overflow" rolls the extra days into the next month
 * (Mar 3 or Mar 2). `adjusted` is true when either rule had to apply.
 */
export function addMonths(c: CivilDate, n: number, mode: MonthMode = "clamp"): { date: CivilDate; adjusted: boolean } {
  const total = c.y * 12 + (c.m - 1) + n;
  const y = Math.floor(total / 12);
  const m = total - y * 12 + 1;
  const dim = daysInMonth(y, m);
  if (c.d <= dim) return { date: { y, m, d: c.d }, adjusted: false };
  if (mode === "clamp") return { date: { y, m, d: dim }, adjusted: true };
  return { date: addDays({ y, m, d: dim }, c.d - dim), adjusted: true };
}

export function addYears(c: CivilDate, n: number, mode: MonthMode = "clamp") {
  return addMonths(c, n * 12, mode);
}

/* ------------------------------------------------------------------ */
/* Differences                                                         */
/* ------------------------------------------------------------------ */

export type YMD = { years: number; months: number; days: number; negative: boolean };

/**
 * Calendar difference from `a` to `b` as whole years, months and days.
 * Years count completed anniversaries (Feb 29 anniversaries in common years
 * fall on Feb 28 with "clamp" or Mar 1 with "overflow"). Months count
 * completed month anniversaries after that, clamped to month ends
 * (Jan 31 + 1 month = Feb 28/29). Days are the remainder.
 */
export function diffYMD(a: CivilDate, b: CivilDate, leapMode: MonthMode = "clamp"): YMD {
  if (compareDates(a, b) > 0) return { ...diffYMD(b, a, leapMode), negative: true };
  const bd = toDays(b);
  let years = b.y - a.y;
  while (years > 0 && toDays(addYears(a, years, leapMode).date) > bd) years -= 1;
  const anchor = years === 0 ? a : addYears(a, years, leapMode).date;
  let months = 0;
  let monthAnchor = anchor;
  for (let k = 1; k <= 11; k++) {
    const cand = addMonths(a, years * 12 + k, "clamp").date;
    if (toDays(cand) > bd || toDays(cand) < toDays(anchor)) break;
    months = k;
    monthAnchor = cand;
  }
  return { years, months, days: bd - toDays(monthAnchor), negative: false };
}

/** Next anniversary of `birth` on or after `from` (today counts). */
export function nextAnniversary(birth: CivilDate, from: CivilDate, leapMode: MonthMode = "clamp") {
  let n = Math.max(0, from.y - birth.y);
  let date = addYears(birth, n, leapMode).date;
  while (compareDates(date, from) < 0) {
    n += 1;
    date = addYears(birth, n, leapMode).date;
  }
  return { date, years: n, daysUntil: daysBetween(from, date) };
}

/* ------------------------------------------------------------------ */
/* Week numbering                                                      */
/* ------------------------------------------------------------------ */

/**
 * ISO 8601 week: weeks start on Monday and week 1 is the week containing
 * January 4 (equivalently, the first Thursday). Early January days can belong
 * to the previous ISO year, late December days to the next.
 */
export function isoWeek(c: CivilDate): { year: number; week: number } {
  const thursday = addDays(c, 4 - isoWeekday(c));
  return { year: thursday.y, week: Math.floor((dayOfYear(thursday) - 1) / 7) + 1 };
}

/** 52 or 53. December 28 always falls in the last ISO week of its year. */
export function isoWeeksInYear(y: number): number {
  return isoWeek({ y, m: 12, d: 28 }).week;
}

/** Monday that starts ISO week `week` of ISO year `year`. */
export function isoWeekStart(year: number, week: number): CivilDate {
  const jan4 = { y: year, m: 1, d: 4 };
  return addDays(jan4, -(isoWeekday(jan4) - 1) + (week - 1) * 7);
}

/**
 * US-style week number: weeks start on Sunday and week 1 is the week that
 * contains January 1, so the first and last weeks can be partial.
 */
export function usWeek(c: CivilDate): { year: number; week: number } {
  const jan1 = { y: c.y, m: 1, d: 1 };
  return { year: c.y, week: Math.floor((dayOfYear(c) - 1 + weekday(jan1)) / 7) + 1 };
}

export function usWeeksInYear(y: number): number {
  return usWeek({ y, m: 12, d: 31 }).week;
}

/** Sunday that starts US week `week` of `year` (week 1 may start in December). */
export function usWeekStart(year: number, week: number): CivilDate {
  const jan1 = { y: year, m: 1, d: 1 };
  return addDays(jan1, -weekday(jan1) + (week - 1) * 7);
}

/* ------------------------------------------------------------------ */
/* Business days                                                       */
/* ------------------------------------------------------------------ */

export type HolidayParse = {
  holidays: Map<string, string>;
  errors: { line: number; text: string; reason: string }[];
};

/**
 * One holiday per line: `YYYY-MM-DD` optionally followed by a label.
 * Blank lines and lines starting with `#` are ignored.
 */
export function parseHolidayList(text: string): HolidayParse {
  const holidays = new Map<string, string>();
  const errors: HolidayParse["errors"] = [];
  text.split(/\r?\n/).forEach((raw, i) => {
    const line = raw.trim();
    if (!line || line.startsWith("#")) return;
    const m = /^(\d{4}-\d{2}-\d{2})(?:\s+(.*))?$/.exec(line);
    if (!m) {
      errors.push({ line: i + 1, text: line, reason: "Use the format YYYY-MM-DD, optionally followed by a name." });
      return;
    }
    const date = parseISODate(m[1]);
    if (!date) {
      errors.push({ line: i + 1, text: line, reason: "This date does not exist." });
      return;
    }
    holidays.set(m[1], (m[2] ?? "").trim());
  });
  return { holidays, errors };
}

export type BusinessCount = {
  workdays: number;
  weekendDays: number;
  /** Holidays that fell on a working weekday (holidays on weekends are not double counted). */
  holidaysOnWorkdays: number;
  calendarDays: number;
  holidayHits: string[];
};

/** Hard cap so a typo like year 9999 cannot freeze the page. */
export const MAX_SPAN_DAYS = 366 * 300;

/**
 * Counts days in [start, end] (each end optionally excluded). Works in either
 * direction; the counts are always non-negative.
 */
export function countBusinessDays(
  start: CivilDate,
  end: CivilDate,
  weekend: ReadonlySet<number>,
  holidays: ReadonlyMap<string, string>,
  includeStart = true,
  includeEnd = true,
): BusinessCount {
  let a = toDays(start);
  let b = toDays(end);
  let incA = includeStart;
  let incB = includeEnd;
  if (a > b) {
    [a, b] = [b, a];
    [incA, incB] = [incB, incA];
  }
  if (!incA) a += 1;
  if (!incB) b -= 1;
  const out: BusinessCount = { workdays: 0, weekendDays: 0, holidaysOnWorkdays: 0, calendarDays: 0, holidayHits: [] };
  if (b - a > MAX_SPAN_DAYS) throw new Error("Range is too long. Keep it under 300 years.");
  for (let n = a; n <= b; n++) {
    out.calendarDays += 1;
    const wd = (((n + 4) % 7) + 7) % 7;
    if (weekend.has(wd)) {
      out.weekendDays += 1;
      continue;
    }
    const iso = formatISODate(fromDays(n));
    if (holidays.has(iso)) {
      out.holidaysOnWorkdays += 1;
      out.holidayHits.push(iso);
      continue;
    }
    out.workdays += 1;
  }
  return out;
}

export function isWorkday(c: CivilDate, weekend: ReadonlySet<number>, holidays: ReadonlyMap<string, string>) {
  return !weekend.has(weekday(c)) && !holidays.has(formatISODate(c));
}

/**
 * Moves `n` working days from `start` (negative goes backward). The start day
 * itself is not counted, so 1 business day after Friday is Monday.
 */
export function addBusinessDays(
  start: CivilDate,
  n: number,
  weekend: ReadonlySet<number>,
  holidays: ReadonlyMap<string, string>,
): { date: CivilDate; skippedWeekend: number; skippedHolidays: number } {
  if (weekend.size >= 7) throw new Error("At least one day of the week must be a working day.");
  const step = n < 0 ? -1 : 1;
  let left = Math.abs(n);
  let day = toDays(start);
  let skippedWeekend = 0;
  let skippedHolidays = 0;
  let guard = 0;
  while (left > 0) {
    day += step;
    if (++guard > MAX_SPAN_DAYS) throw new Error("Result is too far away. Use a smaller number of days.");
    const c = fromDays(day);
    if (weekend.has(weekday(c))) skippedWeekend += 1;
    else if (holidays.has(formatISODate(c))) skippedHolidays += 1;
    else left -= 1;
  }
  return { date: fromDays(day), skippedWeekend, skippedHolidays };
}

/* ------------------------------------------------------------------ */
/* Leap years                                                          */
/* ------------------------------------------------------------------ */

export function leapExplanation(y: number): { leap: boolean; steps: string[] } {
  const steps: string[] = [];
  if (y % 4 !== 0) {
    steps.push(`${y} is not divisible by 4, so it is a common year.`);
    return { leap: false, steps };
  }
  steps.push(`${y} is divisible by 4.`);
  if (y % 100 !== 0) {
    steps.push(`${y} is not divisible by 100, so it is a leap year.`);
    return { leap: true, steps };
  }
  steps.push(`${y} is divisible by 100, so it is only a leap year if it is also divisible by 400.`);
  if (y % 400 === 0) {
    steps.push(`${y} is divisible by 400, so it is a leap year.`);
    return { leap: true, steps };
  }
  steps.push(`${y} is not divisible by 400, so it is a common year.`);
  return { leap: false, steps };
}

export function nearbyLeapYears(y: number, count = 5): { before: number[]; after: number[] } {
  const before: number[] = [];
  const after: number[] = [];
  for (let k = y - 1; before.length < count && k >= 1; k--) if (isLeapYear(k)) before.unshift(k);
  for (let k = y + 1; after.length < count; k++) if (isLeapYear(k)) after.push(k);
  return { before, after };
}

/** Leap years in [a, b] inclusive, via the closed form. */
export function countLeapYears(a: number, b: number): number {
  const upTo = (y: number) => Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400);
  if (a > b) [a, b] = [b, a];
  return upTo(b) - upTo(a - 1);
}

/** Calendar grid for a month: weeks of 7 cells (null = padding). */
export function monthGrid(y: number, m: number, weekStartsOn: 0 | 1 = 1): (CivilDate | null)[][] {
  const first = { y, m, d: 1 };
  const lead = (weekday(first) - weekStartsOn + 7) % 7;
  const cells: (CivilDate | null)[] = Array.from({ length: lead }, () => null);
  for (let d = 1; d <= daysInMonth(y, m); d++) cells.push({ y, m, d });
  while (cells.length % 7) cells.push(null);
  const rows: (CivilDate | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
  return rows;
}

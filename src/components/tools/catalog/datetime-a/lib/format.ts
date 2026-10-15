/**
 * Date string parsing (ISO 8601, RFC 2822, numeric and written formats) and
 * token-based formatting. Parsing is done with explicit patterns, never with
 * the browser's lenient `Date.parse`, so results are identical everywhere.
 */

import { MONTH_NAMES, WEEKDAY_NAMES, dayOfYear, isValidDate, isoWeek, isoWeekStart, isoWeeksInYear, isoWeekday, addDays, quarter, weekday } from "./dates";

export type DateOrder = "DMY" | "MDY" | "YMD";

/** A wall-clock reading plus its UTC offset (null when the text had no zone). */
export type ParsedDate = {
  y: number;
  m: number;
  d: number;
  h: number;
  mi: number;
  s: number;
  ms: number;
  offset: number | null;
  hasTime: boolean;
  format: string;
  warning?: string;
};

export type ParseResult = { ok: true; value: ParsedDate } | { ok: false; error: string };

const MONTH_LOOKUP: Record<string, number> = {};
MONTH_NAMES.forEach((name, i) => {
  MONTH_LOOKUP[name.toLowerCase()] = i + 1;
  MONTH_LOOKUP[name.slice(0, 3).toLowerCase()] = i + 1;
});
MONTH_LOOKUP.sept = 9;

/** RFC 2822 section 4.3 obsolete zone names. */
const NAMED_ZONES: Record<string, number> = {
  ut: 0,
  utc: 0,
  gmt: 0,
  z: 0,
  est: -300,
  edt: -240,
  cst: -360,
  cdt: -300,
  mst: -420,
  mdt: -360,
  pst: -480,
  pdt: -420,
};

/** POSIX-style pivot for two-digit years: 69-99 → 1900s, 00-68 → 2000s. */
export function expandTwoDigitYear(yy: number): number {
  return yy >= 69 ? 1900 + yy : 2000 + yy;
}

function parseOffset(raw: string | undefined): number | null | undefined {
  if (raw === undefined || raw === "") return null;
  const t = raw.trim().toLowerCase();
  if (t in NAMED_ZONES) return NAMED_ZONES[t];
  const m = /^(?:utc|gmt)?([+-])(\d{1,2})(?::?(\d{2}))?$/.exec(t);
  if (!m) return undefined;
  const h = Number(m[2]);
  const mi = Number(m[3] ?? 0);
  if (h > 18 || mi > 59) return undefined;
  return (m[1] === "-" ? -1 : 1) * (h * 60 + mi);
}

function fracToMs(frac: string | undefined): number {
  if (!frac) return 0;
  return Math.floor(Number(`0.${frac}`) * 1000 + 1e-9);
}

function build(
  y: number,
  m: number,
  d: number,
  time: { h: number; mi: number; s: number; ms: number } | null,
  offset: number | null,
  format: string,
): ParseResult {
  if (!isValidDate(y, m, d)) return { ok: false, error: `${MONTH_NAMES[m - 1] ?? `Month ${m}`} ${d}, ${y} is not a real date.` };
  if (y < 1 || y > 9999) return { ok: false, error: "Use a year between 1 and 9999." };
  const t = time ?? { h: 0, mi: 0, s: 0, ms: 0 };
  if (t.h > 23 || t.mi > 59 || t.s > 60) return { ok: false, error: "The time is out of range (use 00:00:00 to 23:59:59)." };
  return {
    ok: true,
    value: { y, m, d, h: t.h, mi: t.mi, s: Math.min(t.s, 59), ms: t.ms, offset, hasTime: time !== null, format },
  };
}

const TIME_RE =
  /(?:^|[\sT,@])(\d{1,2}):(\d{2})(?::(\d{2})(?:[.,](\d{1,9}))?)?\s*(a\.?m\.?|p\.?m\.?)?\s*(z|utc|gmt|[a-z]{3}|(?:utc|gmt)?[+-]\d{1,2}(?::?\d{2})?)?\s*$/i;

/** Pulls a trailing time (and optional zone) off a string. */
function splitTime(s: string):
  | { rest: string; time: { h: number; mi: number; s: number; ms: number } | null; offset: number | null }
  | { error: string } {
  const m = TIME_RE.exec(s);
  if (!m) {
    // Allow "2 PM" style.
    const ampm = /(?:^|\s)(\d{1,2})\s*(a\.?m\.?|p\.?m\.?)\s*$/i.exec(s);
    if (ampm) {
      let h = Number(ampm[1]);
      if (h < 1 || h > 12) return { error: "With AM/PM, the hour must be 1 to 12." };
      const pm = /^p/i.test(ampm[2]);
      h = (h % 12) + (pm ? 12 : 0);
      return { rest: s.slice(0, ampm.index).trim(), time: { h, mi: 0, s: 0, ms: 0 }, offset: null };
    }
    return { rest: s.trim(), time: null, offset: null };
  }
  let h = Number(m[1]);
  if (m[5]) {
    if (h < 1 || h > 12) return { error: "With AM/PM, the hour must be 1 to 12." };
    const pm = /^p/i.test(m[5]);
    h = (h % 12) + (pm ? 12 : 0);
  }
  const offset = parseOffset(m[6]);
  if (offset === undefined) return { error: `Unknown time zone "${m[6]}". Use Z, UTC, GMT or an offset such as +05:30.` };
  return {
    rest: s.slice(0, m.index).replace(/[\s,T@]+$/i, "").trim(),
    time: { h, mi: Number(m[2]), s: Number(m[3] ?? 0), ms: fracToMs(m[4]) },
    offset,
  };
}

/**
 * Parses a date string. `order` decides how ambiguous numeric dates such as
 * 03/04/2026 are read (DMY: 3 April, MDY: March 4).
 */
export function parseDateString(input: string, order: DateOrder): ParseResult {
  const s = input.trim().replace(/\s+/g, " ");
  if (!s) return { ok: false, error: "Enter a date." };

  // Unix timestamp (10 digits seconds, 13 digits milliseconds).
  if (/^-?\d{10}$|^-?\d{13}$/.test(s)) {
    const n = Number(s);
    const ms = s.replace("-", "").length === 13 ? n : n * 1000;
    const dt = new Date(ms);
    if (Number.isNaN(dt.getTime())) return { ok: false, error: "Timestamp is out of range." };
    return build(
      dt.getUTCFullYear(),
      dt.getUTCMonth() + 1,
      dt.getUTCDate(),
      { h: dt.getUTCHours(), mi: dt.getUTCMinutes(), s: dt.getUTCSeconds(), ms: dt.getUTCMilliseconds() },
      0,
      s.replace("-", "").length === 13 ? "Unix timestamp (milliseconds)" : "Unix timestamp (seconds)",
    );
  }

  // ISO 8601 calendar date, extended or basic, with optional time and offset.
  let m =
    /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:[.,](\d{1,9}))?)?)?\s*(Z|[+-]\d{2}(?::?\d{2})?)?$/i.exec(s) ??
    /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(?:(\d{2})(?:[.,](\d{1,9}))?)?)?(Z|[+-]\d{2}(?:\d{2})?)?$/i.exec(s);
  if (m) {
    const off = parseOffset(m[8]);
    if (off === undefined) return { ok: false, error: "Invalid UTC offset." };
    const time = m[4] !== undefined ? { h: Number(m[4]), mi: Number(m[5]), s: Number(m[6] ?? 0), ms: fracToMs(m[7]) } : null;
    return build(Number(m[1]), Number(m[2]), Number(m[3]), time, off, "ISO 8601");
  }

  // ISO 8601 week date: 2026-W42-1 or 2026W421.
  m = /^(\d{4})-?W(\d{2})-?([1-7])?$/i.exec(s);
  if (m) {
    const year = Number(m[1]);
    const week = Number(m[2]);
    if (week < 1 || week > isoWeeksInYear(year)) return { ok: false, error: `${year} has ${isoWeeksInYear(year)} ISO weeks.` };
    const c = addDays(isoWeekStart(year, week), Number(m[3] ?? 1) - 1);
    return build(c.y, c.m, c.d, null, null, "ISO 8601 week date");
  }

  // ISO 8601 ordinal date: 2026-285.
  m = /^(\d{4})-(\d{3})$/.exec(s);
  if (m) {
    const year = Number(m[1]);
    const n = Number(m[2]);
    const len = isValidDate(year, 2, 29) ? 366 : 365;
    if (n < 1 || n > len) return { ok: false, error: `Day of year must be 1 to ${len} for ${year}.` };
    const c = addDays({ y: year, m: 1, d: 1 }, n - 1);
    return build(c.y, c.m, c.d, null, null, "ISO 8601 ordinal date");
  }

  // RFC 2822: [Mon, ]12 Oct 2026 14:30[:00] +0000
  m =
    /^(?:([a-z]{3}),?\s*)?(\d{1,2})\s+([a-z]{3})\s+(\d{2}|\d{4})\s+(\d{2}):(\d{2})(?::(\d{2}))?\s*([+-]\d{4}|[a-z]{1,3})?$/i.exec(s);
  if (m && m[3].toLowerCase() in MONTH_LOOKUP) {
    const off = parseOffset(m[8]);
    if (off === undefined) return { ok: false, error: `Unknown zone "${m[8]}".` };
    const yRaw = Number(m[4]);
    const y = m[4].length === 2 ? (yRaw < 50 ? 2000 + yRaw : 1900 + yRaw) : yRaw;
    const r = build(y, MONTH_LOOKUP[m[3].toLowerCase()], Number(m[2]), { h: Number(m[5]), mi: Number(m[6]), s: Number(m[7] ?? 0), ms: 0 }, off ?? 0, "RFC 2822");
    if (r.ok && m[1]) {
      const wd = WEEKDAY_NAMES[weekday(r.value)].slice(0, 3).toLowerCase();
      if (wd !== m[1].toLowerCase()) r.value.warning = `The text says ${m[1]}, but this date is a ${WEEKDAY_NAMES[weekday(r.value)]}. The date was used.`;
    }
    if (r.ok && !m[8]) r.value.warning = "No zone was given, so UTC was assumed (RFC 2822 requires a zone).";
    return r;
  }

  // Everything else: optional weekday, date part, optional time part.
  const split = splitTime(s);
  if ("error" in split) return { ok: false, error: split.error };
  let rest = split.rest.replace(/^(?:mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun)[a-z]*\.?,?\s*/i, "").trim();
  rest = rest.replace(/,$/, "").trim();

  // Numeric: 12/10/2026, 12-10-26, 2026/10/12, 12.10.2026
  m = /^(\d{1,4})([/.-])(\d{1,2})\2(\d{1,4})$/.exec(rest);
  if (m) {
    const a = m[1];
    const b = Number(m[3]);
    const c = m[4];
    if (a.length === 4 || order === "YMD") {
      if (c.length > 2) return { ok: false, error: "For year-first dates use YYYY-MM-DD style, e.g. 2026/10/12." };
      const y = a.length <= 2 ? expandTwoDigitYear(Number(a)) : Number(a);
      return build(y, b, Number(c), split.time, split.offset, `Numeric (year-month-day, "${m[2]}")`);
    }
    if (c.length === 3 || c.length === 1) return { ok: false, error: "Write the year with 2 or 4 digits." };
    const y = c.length === 2 ? expandTwoDigitYear(Number(c)) : Number(c);
    const first = Number(a);
    const [mo, d] = order === "MDY" ? [first, b] : [b, first];
    let warning: string | undefined;
    if (mo > 12 && d <= 12) return { ok: false, error: `Month ${mo} does not exist. Did you mean the ${order === "MDY" ? "DMY" : "MDY"} order?` };
    if (first <= 12 && b <= 12 && first !== b)
      warning = `Ambiguous: read as ${order === "MDY" ? "month/day" : "day/month"} because ${order} is selected.`;
    const r = build(y, mo, d, split.time, split.offset, order === "MDY" ? "Numeric (month/day/year)" : "Numeric (day/month/year)");
    if (r.ok && warning) r.value.warning = warning;
    if (r.ok && c.length === 2) r.value.warning = `${r.value.warning ? `${r.value.warning} ` : ""}Two-digit year ${c} was read as ${y}.`;
    return r;
  }

  // Written month: "October 12, 2026", "Oct 12 2026", "12 October 2026", "12th Oct, 2026"
  m = /^([a-z]+)\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})$/i.exec(rest);
  if (m && m[1].toLowerCase() in MONTH_LOOKUP) {
    return build(Number(m[3]), MONTH_LOOKUP[m[1].toLowerCase()], Number(m[2]), split.time, split.offset, "Written (month day, year)");
  }
  m = /^(\d{1,2})(?:st|nd|rd|th)?\s+(?:of\s+)?([a-z]+)\.?,?\s+(\d{4})$/i.exec(rest);
  if (m && m[2].toLowerCase() in MONTH_LOOKUP) {
    return build(Number(m[3]), MONTH_LOOKUP[m[2].toLowerCase()], Number(m[1]), split.time, split.offset, "Written (day month year)");
  }
  m = /^(\d{1,2})-([a-z]{3})-(\d{2}|\d{4})$/i.exec(rest);
  if (m && m[2].toLowerCase() in MONTH_LOOKUP) {
    const y = m[3].length === 2 ? expandTwoDigitYear(Number(m[3])) : Number(m[3]);
    return build(y, MONTH_LOOKUP[m[2].toLowerCase()], Number(m[1]), split.time, split.offset, "DD-Mon-YYYY");
  }

  return { ok: false, error: "This format was not recognized. Try 2026-10-12, 12/10/2026, Oct 12, 2026 or an RFC 2822 date." };
}

/** Converts a parsed date to an instant. Text without a zone uses `fallbackOffset(…)`. */
export function parsedToEpoch(p: ParsedDate, assumeUtc: boolean): number {
  const dt = new Date(Date.UTC(2000, 0, 1, p.h, p.mi, p.s, p.ms));
  dt.setUTCFullYear(p.y, p.m - 1, p.d);
  if (p.offset !== null) return dt.getTime() - p.offset * 60000;
  if (assumeUtc) return dt.getTime();
  const local = new Date(2000, 0, 1, p.h, p.mi, p.s, p.ms);
  local.setFullYear(p.y, p.m - 1, p.d);
  return local.getTime();
}

/* ------------------------------------------------------------------ */
/* Formatting                                                          */
/* ------------------------------------------------------------------ */

/** Wall reading used for formatting, with its offset in minutes. */
export type FormatParts = { y: number; m: number; d: number; h: number; mi: number; s: number; ms: number; offset: number; epoch: number };

export function partsFor(epoch: number, zone: "local" | "utc"): FormatParts {
  const dt = new Date(epoch);
  if (zone === "utc")
    return {
      y: dt.getUTCFullYear(),
      m: dt.getUTCMonth() + 1,
      d: dt.getUTCDate(),
      h: dt.getUTCHours(),
      mi: dt.getUTCMinutes(),
      s: dt.getUTCSeconds(),
      ms: dt.getUTCMilliseconds(),
      offset: 0,
      epoch,
    };
  return {
    y: dt.getFullYear(),
    m: dt.getMonth() + 1,
    d: dt.getDate(),
    h: dt.getHours(),
    mi: dt.getMinutes(),
    s: dt.getSeconds(),
    ms: dt.getMilliseconds(),
    offset: -dt.getTimezoneOffset(),
    epoch,
  };
}

const z = (n: number, w = 2) => String(Math.abs(n)).padStart(w, "0");

function ordinal(n: number) {
  const s = n % 100;
  if (s >= 11 && s <= 13) return `${n}th`;
  return `${n}${["th", "st", "nd", "rd"][n % 10] ?? "th"}`;
}

export function offsetString(min: number, colon = true): string {
  const sign = min < 0 ? "-" : "+";
  const a = Math.abs(min);
  return `${sign}${z(Math.floor(a / 60))}${colon ? ":" : ""}${z(a % 60)}`;
}

/** Token reference shown in the UI. Order matters only for display. */
export const TOKENS: { token: string; meaning: string; example: string }[] = [
  { token: "YYYY", meaning: "4-digit year", example: "2026" },
  { token: "YY", meaning: "2-digit year", example: "26" },
  { token: "Q", meaning: "Quarter", example: "4" },
  { token: "MMMM", meaning: "Month name", example: "October" },
  { token: "MMM", meaning: "Short month name", example: "Oct" },
  { token: "MM", meaning: "Month, 2 digits", example: "10" },
  { token: "M", meaning: "Month", example: "10" },
  { token: "DDDD", meaning: "Day of year, 3 digits", example: "285" },
  { token: "DDD", meaning: "Day of year", example: "285" },
  { token: "DD", meaning: "Day of month, 2 digits", example: "05" },
  { token: "D", meaning: "Day of month", example: "5" },
  { token: "Do", meaning: "Day with ordinal suffix", example: "5th" },
  { token: "dddd", meaning: "Weekday name", example: "Monday" },
  { token: "ddd", meaning: "Short weekday name", example: "Mon" },
  { token: "d", meaning: "Weekday number, Sunday = 0", example: "1" },
  { token: "E", meaning: "ISO weekday, Monday = 1", example: "1" },
  { token: "WW", meaning: "ISO week, 2 digits", example: "42" },
  { token: "W", meaning: "ISO week", example: "42" },
  { token: "GGGG", meaning: "ISO week-numbering year", example: "2026" },
  { token: "HH", meaning: "Hour 00-23", example: "14" },
  { token: "H", meaning: "Hour 0-23", example: "14" },
  { token: "hh", meaning: "Hour 01-12", example: "02" },
  { token: "h", meaning: "Hour 1-12", example: "2" },
  { token: "mm", meaning: "Minutes, 2 digits", example: "05" },
  { token: "m", meaning: "Minutes", example: "5" },
  { token: "ss", meaning: "Seconds, 2 digits", example: "09" },
  { token: "s", meaning: "Seconds", example: "9" },
  { token: "SSS", meaning: "Milliseconds", example: "042" },
  { token: "A", meaning: "AM or PM", example: "PM" },
  { token: "a", meaning: "am or pm", example: "pm" },
  { token: "Z", meaning: "UTC offset with colon", example: "+05:30" },
  { token: "ZZ", meaning: "UTC offset without colon", example: "+0530" },
  { token: "X", meaning: "Unix seconds", example: "1791810000" },
  { token: "x", meaning: "Unix milliseconds", example: "1791810000000" },
  { token: "[text]", meaning: "Literal text, not replaced", example: "[at] → at" },
];

const TOKEN_RE = /\[([^\]]*)\]|YYYY|YY|GGGG|MMMM|MMM|MM|M|DDDD|DDD|Do|DD|D|dddd|ddd|d|E|WW|W|HH|H|hh|h|mm|m|ss|s|SSS|A|a|ZZ|Z|X|x|Q/g;

export function formatTokens(pattern: string, p: FormatParts): string {
  const c = { y: p.y, m: p.m, d: p.d };
  return pattern.replace(TOKEN_RE, (tok, literal: string | undefined) => {
    if (literal !== undefined) return literal;
    switch (tok) {
      case "YYYY":
        return p.y < 0 ? `-${z(p.y, 4)}` : z(p.y, 4);
      case "YY":
        return z(p.y % 100);
      case "GGGG":
        return z(isoWeek(c).year, 4);
      case "Q":
        return String(quarter(c));
      case "MMMM":
        return MONTH_NAMES[p.m - 1];
      case "MMM":
        return MONTH_NAMES[p.m - 1].slice(0, 3);
      case "MM":
        return z(p.m);
      case "M":
        return String(p.m);
      case "DDDD":
        return z(dayOfYear(c), 3);
      case "DDD":
        return String(dayOfYear(c));
      case "Do":
        return ordinal(p.d);
      case "DD":
        return z(p.d);
      case "D":
        return String(p.d);
      case "dddd":
        return WEEKDAY_NAMES[weekday(c)];
      case "ddd":
        return WEEKDAY_NAMES[weekday(c)].slice(0, 3);
      case "d":
        return String(weekday(c));
      case "E":
        return String(isoWeekday(c));
      case "WW":
        return z(isoWeek(c).week);
      case "W":
        return String(isoWeek(c).week);
      case "HH":
        return z(p.h);
      case "H":
        return String(p.h);
      case "hh":
        return z(p.h % 12 || 12);
      case "h":
        return String(p.h % 12 || 12);
      case "mm":
        return z(p.mi);
      case "m":
        return String(p.mi);
      case "ss":
        return z(p.s);
      case "s":
        return String(p.s);
      case "SSS":
        return z(p.ms, 3);
      case "A":
        return p.h < 12 ? "AM" : "PM";
      case "a":
        return p.h < 12 ? "am" : "pm";
      case "ZZ":
        return offsetString(p.offset, false);
      case "Z":
        return offsetString(p.offset, true);
      case "X":
        return String(Math.floor(p.epoch / 1000));
      case "x":
        return String(p.epoch);
      default:
        return tok;
    }
  });
}

/** RFC 2822 / RFC 5322 date, e.g. "Mon, 12 Oct 2026 14:30:00 +0000". */
export function toRfc2822(p: FormatParts): string {
  return formatTokens("ddd, DD MMM YYYY HH:mm:ss ZZ", p);
}

/** ISO 8601 with the parts' own offset ("Z" for UTC). */
export function toIsoWithOffset(p: FormatParts, withMs = false): string {
  const base = formatTokens(withMs ? "YYYY-MM-DD[T]HH:mm:ss.SSS" : "YYYY-MM-DD[T]HH:mm:ss", p);
  return p.offset === 0 ? `${base}Z` : `${base}${offsetString(p.offset)}`;
}

/**
 * Excel / Google Sheets serial number (1900 date system): days since
 * 1899-12-30, time as the fraction. Only valid from 1900-03-01 on, because
 * Excel treats 1900 as a leap year.
 */
export function excelSerial(p: FormatParts): number | null {
  const base = Date.UTC(1899, 11, 30);
  const wall = new Date(Date.UTC(2000, 0, 1, p.h, p.mi, p.s, p.ms));
  wall.setUTCFullYear(p.y, p.m - 1, p.d);
  if (wall.getTime() < Date.UTC(1900, 2, 1)) return null;
  return (wall.getTime() - base) / 86_400_000;
}

/** Picks a sensible unit for a difference and formats it, e.g. "in 3 days", "2 hours ago". */
export function relativeTime(epoch: number, now: number, locale = "en-US"): string {
  const diff = epoch - now;
  const a = Math.abs(diff);
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  const S = 1000;
  const MIN = 60 * S;
  const H = 60 * MIN;
  const D = 24 * H;
  if (a < 45 * S) return rtf.format(Math.round(diff / S), "second");
  if (a < 45 * MIN) return rtf.format(Math.round(diff / MIN), "minute");
  if (a < 22 * H) return rtf.format(Math.round(diff / H), "hour");
  if (a < 26 * D) return rtf.format(Math.round(diff / D), "day");
  if (a < 320 * D) return rtf.format(Math.round(diff / (30.436875 * D)), "month");
  return rtf.format(Math.round(diff / (365.2425 * D)), "year");
}

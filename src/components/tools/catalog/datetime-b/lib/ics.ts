/**
 * RFC 5545 iCalendar builder (pure TS). Handles CRLF line endings, 75-octet
 * folding, TEXT escaping, UTC / TZID (with a generated VTIMEZONE) / floating
 * times, all-day events, VALARM reminders and a DAILY/WEEKLY/MONTHLY RRULE.
 */

export type Weekday = "MO" | "TU" | "WE" | "TH" | "FR" | "SA" | "SU";
export const WEEKDAYS: Weekday[] = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"];
/** JS getUTCDay() index (0 = Sunday) → RFC 5545 weekday code. */
const JS_DAY: Weekday[] = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

export type TzMode = "utc" | "tzid" | "floating";

export interface Person {
  name: string;
  email: string;
}

export interface Recurrence {
  freq: "DAILY" | "WEEKLY" | "MONTHLY";
  interval: number;
  /** WEEKLY only; empty means "the start date's weekday". */
  byDay: Weekday[];
  /** MONTHLY only: same date each month, the nth weekday, or the last weekday. */
  monthly: "date" | "nth" | "last";
  end: { kind: "never" } | { kind: "count"; count: number } | { kind: "until"; date: string };
}

export interface IcsEvent {
  uid: string;
  title: string;
  description: string;
  location: string;
  url: string;
  allDay: boolean;
  startDate: string; // YYYY-MM-DD
  startTime: string; // HH:MM
  endDate: string;
  endTime: string;
  tzMode: TzMode;
  timeZone: string; // IANA zone the times were entered in
  organizer: Person | null;
  attendees: Person[];
  /** Minutes before start. */
  alarms: number[];
  recurrence: Recurrence | null;
}

/* ------------------------------------------------------------------ */
/* Low-level formatting                                                */
/* ------------------------------------------------------------------ */

const pad = (n: number, w = 2) => String(Math.abs(Math.trunc(n))).padStart(w, "0");

/** RFC 5545 §3.3.11 TEXT escaping. */
export function escapeText(s: string): string {
  return s
    .replace(/\r\n?/g, "\n")
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

/** Parameter value (§3.2): quote when it contains : ; , and drop characters that are not allowed. */
export function paramValue(s: string): string {
  const clean = s.replace(/["\u0000-\u001f\u007f]/g, "").trim();
  return /[:;,]/.test(clean) ? `"${clean}"` : clean;
}

const encoder = new TextEncoder();
const octets = (s: string) => encoder.encode(s).length;

/** Folds one content line into ≤ 75-octet lines joined by CRLF + space (§3.1). Never splits a character. */
export function foldLine(line: string): string {
  if (octets(line) <= 75) return line;
  const out: string[] = [];
  let cur = "";
  let curLen = 0;
  let limit = 75;
  for (const ch of line) {
    const n = octets(ch);
    if (curLen + n > limit) {
      out.push(cur);
      cur = " ";
      curLen = 1;
      limit = 75;
    }
    cur += ch;
    curLen += n;
  }
  out.push(cur);
  return out.join("\r\n");
}

/** Reverses folding (useful for tests and parsers). */
export function unfold(ics: string): string[] {
  return ics.replace(/\r\n[ \t]/g, "").split("\r\n");
}

const ymd = (date: string) => date.replace(/-/g, "");
const hms = (time: string) => `${time.replace(":", "")}00`;

export function utcStamp(ms: number): string {
  const d = new Date(ms);
  return `${pad(d.getUTCFullYear(), 4)}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
}

function localStamp(ms: number): string {
  // `ms` here is a "wall clock as if UTC" value.
  return utcStamp(ms).slice(0, -1);
}

function fmtOffset(min: number): string {
  const sign = min < 0 ? "-" : "+";
  const a = Math.abs(min);
  return `${sign}${pad(Math.floor(a / 60))}${pad(a % 60)}`;
}

/** TRIGGER duration for an alarm `min` minutes before the start. */
export function triggerFor(min: number): string {
  const m = Math.max(0, Math.round(min));
  if (m === 0) return "PT0M";
  if (m % 1440 === 0) return `-P${m / 1440}D`;
  if (m % 60 === 0) return `-PT${m / 60}H`;
  return `-PT${m}M`;
}

/* ------------------------------------------------------------------ */
/* Time zones (via Intl)                                               */
/* ------------------------------------------------------------------ */

const dtfCache = new Map<string, Intl.DateTimeFormat>();
function dtf(tz: string) {
  let f = dtfCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    dtfCache.set(tz, f);
  }
  return f;
}

export function isValidTimeZone(tz: string): boolean {
  try {
    dtf(tz);
    return true;
  } catch {
    return false;
  }
}

/** UTC offset in minutes of `tz` at the instant `utcMs` (east of UTC is positive). */
export function tzOffset(tz: string, utcMs: number): number {
  const t = Math.floor(utcMs / 1000) * 1000;
  const p: Record<string, number> = {};
  for (const part of dtf(tz).formatToParts(new Date(t))) if (part.type !== "literal") p[part.type] = Number(part.value);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour === 24 ? 0 : p.hour, p.minute, p.second);
  return Math.round((asUtc - t) / 60000);
}

/** Wall-clock time in `tz` → UTC epoch ms. Times in a DST gap resolve forward. */
export function zonedToUtc(date: string, time: string, tz: string): number {
  const [y, mo, d] = date.split("-").map(Number);
  const [h, mi] = time.split(":").map(Number);
  const local = Date.UTC(y, mo - 1, d, h, mi);
  const o1 = tzOffset(tz, local);
  const t = local - o1 * 60000;
  const o2 = tzOffset(tz, t);
  if (o2 === o1) return t;
  const t2 = local - o2 * 60000;
  // Consistent with the second offset: use it. Otherwise the wall time falls in a gap; keep `t` (later instant).
  return tzOffset(tz, t2) === o2 ? t2 : t;
}

/** Offset transitions of `tz` between two instants, found by daily sampling + binary search. */
export function transitions(tz: string, fromMs: number, toMs: number): { at: number; from: number; to: number }[] {
  const out: { at: number; from: number; to: number }[] = [];
  const DAY = 86_400_000;
  let prevT = fromMs;
  let prevO = tzOffset(tz, prevT);
  for (let t = fromMs + DAY; t <= toMs + DAY; t += DAY) {
    const o = tzOffset(tz, t);
    if (o !== prevO) {
      let lo = prevT;
      let hi = t;
      while (hi - lo > 60_000) {
        const mid = Math.floor((lo + hi) / 2 / 60_000) * 60_000;
        if (mid <= lo || mid >= hi) break;
        if (tzOffset(tz, mid) === prevO) lo = mid;
        else hi = mid;
      }
      out.push({ at: hi, from: prevO, to: o });
      prevO = o;
    }
    prevT = t;
  }
  return out;
}

/** VTIMEZONE lines covering the given years (explicit observances, no RRULE). */
export function vtimezone(tz: string, fromYear: number, toYear: number): string[] {
  const start = Date.UTC(fromYear, 0, 1) - tzOffset(tz, Date.UTC(fromYear, 0, 1)) * 60000;
  const end = Date.UTC(toYear + 1, 0, 1);
  const trans = transitions(tz, start, end);
  const first = tzOffset(tz, start);
  const lines = ["BEGIN:VTIMEZONE", `TZID:${tz}`];
  const initialType = trans.length && trans[0].to < trans[0].from ? "DAYLIGHT" : "STANDARD";
  lines.push(
    `BEGIN:${initialType}`,
    `DTSTART:${localStamp(start + first * 60000)}`,
    `TZOFFSETFROM:${fmtOffset(first)}`,
    `TZOFFSETTO:${fmtOffset(first)}`,
    `END:${initialType}`,
  );
  for (const tr of trans) {
    const type = tr.to > tr.from ? "DAYLIGHT" : "STANDARD";
    lines.push(
      `BEGIN:${type}`,
      `DTSTART:${localStamp(tr.at + tr.from * 60000)}`,
      `TZOFFSETFROM:${fmtOffset(tr.from)}`,
      `TZOFFSETTO:${fmtOffset(tr.to)}`,
      `END:${type}`,
    );
  }
  lines.push("END:VTIMEZONE");
  return lines;
}

/* ------------------------------------------------------------------ */
/* Recurrence                                                          */
/* ------------------------------------------------------------------ */

function weekdayCode(date: string): Weekday {
  const [y, m, d] = date.split("-").map(Number);
  return JS_DAY[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
}

/** Builds the RRULE value (without the "RRULE:" prefix). */
export function buildRrule(r: Recurrence, ev: Pick<IcsEvent, "allDay" | "startDate" | "tzMode" | "timeZone">): string {
  const parts = [`FREQ=${r.freq}`];
  if (r.interval > 1) parts.push(`INTERVAL=${Math.round(r.interval)}`);
  if (r.freq === "WEEKLY") {
    const days = r.byDay.length ? WEEKDAYS.filter((d) => r.byDay.includes(d)) : [weekdayCode(ev.startDate)];
    parts.push(`BYDAY=${days.join(",")}`);
  }
  if (r.freq === "MONTHLY") {
    const day = Number(ev.startDate.slice(8, 10));
    const code = weekdayCode(ev.startDate);
    if (r.monthly === "date") parts.push(`BYMONTHDAY=${day}`);
    else if (r.monthly === "nth") parts.push(`BYDAY=${Math.ceil(day / 7)}${code}`);
    else parts.push(`BYDAY=-1${code}`);
  }
  if (r.end.kind === "count") parts.push(`COUNT=${Math.max(1, Math.round(r.end.count))}`);
  if (r.end.kind === "until") {
    if (ev.allDay) parts.push(`UNTIL=${ymd(r.end.date)}`);
    else if (ev.tzMode === "floating") parts.push(`UNTIL=${ymd(r.end.date)}T235959`);
    else {
      const zone = ev.tzMode === "utc" || ev.tzMode === "tzid" ? ev.timeZone : "UTC";
      // Last second of the chosen day in the event's zone, expressed in UTC (§3.3.10).
      parts.push(`UNTIL=${utcStamp(zonedToUtc(r.end.date, "23:59", zone) + 59_000)}`);
    }
  }
  return parts.join(";");
}

/** Human summary of the recurrence rule. */
export function describeRrule(r: Recurrence, startDate: string): string {
  const names: Record<Weekday, string> = { MO: "Monday", TU: "Tuesday", WE: "Wednesday", TH: "Thursday", FR: "Friday", SA: "Saturday", SU: "Sunday" };
  const every = r.interval > 1 ? `Every ${r.interval} ` : "Every ";
  let s = "";
  if (r.freq === "DAILY") s = r.interval > 1 ? `${every}days` : "Every day";
  if (r.freq === "WEEKLY") {
    const days = (r.byDay.length ? WEEKDAYS.filter((d) => r.byDay.includes(d)) : [weekdayCode(startDate)]).map((d) => names[d]);
    s = `${r.interval > 1 ? `${every}weeks` : "Every week"} on ${days.join(", ")}`;
  }
  if (r.freq === "MONTHLY") {
    const day = Number(startDate.slice(8, 10));
    const wd = names[weekdayCode(startDate)];
    const ord = ["first", "second", "third", "fourth", "fifth"][Math.ceil(day / 7) - 1];
    const on = r.monthly === "date" ? `on day ${day}` : r.monthly === "nth" ? `on the ${ord} ${wd}` : `on the last ${wd}`;
    s = `${r.interval > 1 ? `${every}months` : "Every month"} ${on}`;
  }
  if (r.end.kind === "count") s += `, ${r.end.count} time${r.end.count === 1 ? "" : "s"}`;
  if (r.end.kind === "until") s += `, until ${r.end.date}`;
  return s;
}

/* ------------------------------------------------------------------ */
/* Validation + build                                                  */
/* ------------------------------------------------------------------ */

const EMAIL_RE = /^[^\s@<>()",;:]+@[^\s@<>()",;:]+\.[^\s@<>()",;:]{2,}$/;
export const isEmail = (s: string) => EMAIL_RE.test(s.trim());

/** Parses "Name <email>", "email" or "Name, email" lines. Returns people and bad lines. */
export function parsePeople(text: string): { people: Person[]; bad: string[] } {
  const people: Person[] = [];
  const bad: string[] = [];
  for (const raw of text.split(/\r?\n|;/)) {
    const line = raw.trim();
    if (!line) continue;
    const angle = /^(.*?)<([^>]+)>$/.exec(line);
    let name = "";
    let email = line;
    if (angle) {
      name = angle[1].trim().replace(/^"|"$/g, "");
      email = angle[2].trim();
    } else if (line.includes(",")) {
      const [a, b] = line.split(",").map((x) => x.trim());
      if (isEmail(b ?? "")) {
        name = a;
        email = b;
      }
    }
    if (isEmail(email)) people.push({ name, email });
    else bad.push(line);
  }
  return { people, bad };
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export type IcsErrors = Partial<Record<"title" | "start" | "end" | "timeZone" | "organizer" | "url" | "count" | "until" | "interval", string>>;

export function validateEvent(ev: IcsEvent): IcsErrors {
  const e: IcsErrors = {};
  if (!ev.title.trim()) e.title = "Add a title for the event.";
  if (!DATE_RE.test(ev.startDate) || (!ev.allDay && !TIME_RE.test(ev.startTime))) e.start = "Enter a valid start date and time.";
  if (!DATE_RE.test(ev.endDate) || (!ev.allDay && !TIME_RE.test(ev.endTime))) e.end = "Enter a valid end date and time.";
  if (!e.start && !e.end) {
    const a = ev.allDay ? ev.startDate : `${ev.startDate}T${ev.startTime}`;
    const b = ev.allDay ? ev.endDate : `${ev.endDate}T${ev.endTime}`;
    if (ev.allDay ? b < a : b <= a) e.end = ev.allDay ? "The last day can't be before the first day." : "The end must be after the start.";
  }
  if (ev.tzMode !== "floating" && !isValidTimeZone(ev.timeZone)) e.timeZone = "Choose a valid time zone.";
  if (ev.organizer && !isEmail(ev.organizer.email)) e.organizer = "Enter a valid organizer email.";
  if (!ev.organizer && ev.attendees.length) e.organizer = "Invitations with attendees need an organizer email.";
  if (ev.url.trim() && !/^https?:\/\/\S+$/i.test(ev.url.trim())) e.url = "Use a full link starting with http:// or https://.";
  const r = ev.recurrence;
  if (r) {
    if (!Number.isInteger(r.interval) || r.interval < 1 || r.interval > 999) e.interval = "Repeat interval must be a whole number from 1 to 999.";
    if (r.end.kind === "count" && (!Number.isInteger(r.end.count) || r.end.count < 1 || r.end.count > 1000)) e.count = "Occurrences must be a whole number from 1 to 1000.";
    if (r.end.kind === "until" && (!DATE_RE.test(r.end.date) || r.end.date < ev.startDate)) e.until = "The end date must be on or after the start date.";
  }
  return e;
}

function personLine(prop: "ORGANIZER" | "ATTENDEE", p: Person): string {
  const params: string[] = [];
  if (p.name.trim()) params.push(`CN=${paramValue(p.name)}`);
  if (prop === "ATTENDEE") params.push("ROLE=REQ-PARTICIPANT", "PARTSTAT=NEEDS-ACTION", "RSVP=TRUE");
  return `${prop}${params.map((x) => `;${x}`).join("")}:mailto:${p.email.trim()}`;
}

function nextDay(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + 1));
  return `${pad(t.getUTCFullYear(), 4)}${pad(t.getUTCMonth() + 1)}${pad(t.getUTCDate())}`;
}

/** Builds the full .ics text. `nowMs` sets DTSTAMP. Assumes validateEvent() passed. */
export function buildIcs(ev: IcsEvent, nowMs: number): string {
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//NuvellaPromoCode//Calendar invite generator//EN",
    "CALSCALE:GREGORIAN",
    `METHOD:${ev.attendees.length ? "REQUEST" : "PUBLISH"}`,
  ];

  const useTzid = !ev.allDay && ev.tzMode === "tzid";
  if (useTzid) {
    const startYear = Number(ev.startDate.slice(0, 4));
    let endYear = Math.max(startYear, Number(ev.endDate.slice(0, 4)));
    const r = ev.recurrence;
    if (r) endYear = r.end.kind === "until" ? Math.max(endYear, Number(r.end.date.slice(0, 4))) : Math.max(endYear, startYear + 5);
    lines.push(...vtimezone(ev.timeZone, startYear, Math.min(endYear, startYear + 30)));
  }

  lines.push("BEGIN:VEVENT", `UID:${ev.uid}`, `DTSTAMP:${utcStamp(nowMs)}`);
  if (ev.allDay) {
    lines.push(`DTSTART;VALUE=DATE:${ymd(ev.startDate)}`, `DTEND;VALUE=DATE:${nextDay(ev.endDate)}`);
  } else if (ev.tzMode === "utc") {
    lines.push(
      `DTSTART:${utcStamp(zonedToUtc(ev.startDate, ev.startTime, ev.timeZone))}`,
      `DTEND:${utcStamp(zonedToUtc(ev.endDate, ev.endTime, ev.timeZone))}`,
    );
  } else if (useTzid) {
    lines.push(
      `DTSTART;TZID=${ev.timeZone}:${ymd(ev.startDate)}T${hms(ev.startTime)}`,
      `DTEND;TZID=${ev.timeZone}:${ymd(ev.endDate)}T${hms(ev.endTime)}`,
    );
  } else {
    lines.push(`DTSTART:${ymd(ev.startDate)}T${hms(ev.startTime)}`, `DTEND:${ymd(ev.endDate)}T${hms(ev.endTime)}`);
  }
  if (ev.recurrence) lines.push(`RRULE:${buildRrule(ev.recurrence, ev)}`);
  lines.push(`SUMMARY:${escapeText(ev.title.trim())}`);
  if (ev.description.trim()) lines.push(`DESCRIPTION:${escapeText(ev.description.trim())}`);
  if (ev.location.trim()) lines.push(`LOCATION:${escapeText(ev.location.trim())}`);
  if (ev.url.trim()) lines.push(`URL:${ev.url.trim()}`);
  if (ev.organizer) lines.push(personLine("ORGANIZER", ev.organizer));
  for (const a of ev.attendees) lines.push(personLine("ATTENDEE", a));
  lines.push("SEQUENCE:0", "STATUS:CONFIRMED", "TRANSP:OPAQUE");
  const alarms = [...new Set(ev.alarms.map((m) => Math.max(0, Math.round(m))))].sort((a, b) => a - b);
  for (const m of alarms) {
    lines.push("BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${escapeText(ev.title.trim() || "Reminder")}`, `TRIGGER:${triggerFor(m)}`, "END:VALARM");
  }
  lines.push("END:VEVENT", "END:VCALENDAR");
  return lines.map(foldLine).join("\r\n") + "\r\n";
}

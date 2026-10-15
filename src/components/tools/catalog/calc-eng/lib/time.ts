/**
 * Duration and clock-time parsing/formatting. All values are whole or
 * fractional seconds. Pure functions.
 */

const UNIT_SECONDS: Record<string, number> = {
  w: 604800,
  wk: 604800,
  wks: 604800,
  week: 604800,
  weeks: 604800,
  d: 86400,
  day: 86400,
  days: 86400,
  h: 3600,
  hr: 3600,
  hrs: 3600,
  hour: 3600,
  hours: 3600,
  m: 60,
  min: 60,
  mins: 60,
  minute: 60,
  minutes: 60,
  s: 1,
  sec: 1,
  secs: 1,
  second: 1,
  seconds: 1,
};

/**
 * Parses one duration: "1:30" (h:mm), "1:30:15" (h:mm:ss), "2h 15m",
 * "1.5h", "90 min", "2d 3h", "45s", or a bare number (read as `bareUnit`).
 */
export function parseDuration(raw: string, bareUnit: "h" | "m" | "s" = "m"): number | string {
  const s = raw.trim().toLowerCase();
  if (!s) return "Enter a duration.";
  const colon = /^(\d+):([0-5]?\d)(?::([0-5]?\d(?:\.\d+)?))?$/.exec(s);
  if (colon) return Number(colon[1]) * 3600 + Number(colon[2]) * 60 + Number(colon[3] ?? 0);
  if (/^\d+(\.\d+)?$/.test(s) || /^\.\d+$/.test(s)) return Number(s) * (bareUnit === "h" ? 3600 : bareUnit === "m" ? 60 : 1);
  const re = /(\d+(?:\.\d+)?|\.\d+)\s*([a-z]+)/g;
  let total = 0;
  let consumed = "";
  let m: RegExpExecArray | null;
  while ((m = re.exec(s))) {
    const f = UNIT_SECONDS[m[2]];
    if (f === undefined) return `Unknown unit "${m[2]}". Use d, h, m or s.`;
    total += Number(m[1]) * f;
    consumed += m[0];
  }
  if (!consumed || consumed.replace(/\s+/g, "") !== s.replace(/[\s,]+|and/g, "")) return `Could not read "${raw.trim()}". Try 1:30, 2h 15m or 90m.`;
  return total;
}

/**
 * Evaluates "1:30 + 45m - 0:10" left to right. Returns seconds (may be
 * negative) or an error message.
 */
export function evalDurationExpr(expr: string, bareUnit: "h" | "m" | "s" = "m"): number | string {
  const parts = expr
    .replace(/[−–]/g, "-")
    .split(/(?=[+-])|(?<=[+-])/)
    .map((x) => x.trim())
    .filter(Boolean);
  if (!parts.length) return "Enter at least one duration.";
  let total = 0;
  let sign = 1;
  let expectTerm = true;
  for (const p of parts) {
    if (p === "+" || p === "-") {
      if (expectTerm) {
        if (p === "-") sign = -sign;
        continue;
      }
      sign = p === "-" ? -1 : 1;
      expectTerm = true;
      continue;
    }
    if (!expectTerm) return "Put + or - between durations.";
    const v = parseDuration(p, bareUnit);
    if (typeof v === "string") return v;
    total += sign * v;
    sign = 1;
    expectTerm = false;
  }
  if (expectTerm) return "The expression ends with an operator.";
  return total;
}

/** Parses "14:30", "2:30 pm", "2pm", "0930", "12:00 am". Returns seconds after midnight. */
export function parseClock(raw: string): number | string {
  const s = raw.trim().toLowerCase().replace(/\./g, "");
  const m = /^(\d{1,2})(?::?(\d{2}))?(?::(\d{2}))?\s*(am|pm|a|p)?$/.exec(s);
  if (!m) return `Could not read the time "${raw.trim()}". Use 14:30 or 2:30 pm.`;
  let h = Number(m[1]);
  const min = Number(m[2] ?? 0);
  const sec = Number(m[3] ?? 0);
  const ap = m[4];
  if (min > 59 || sec > 59) return "Minutes and seconds must be below 60.";
  if (ap) {
    if (h < 1 || h > 12) return "With am/pm, the hour must be 1 to 12.";
    if (h === 12) h = 0;
    if (ap.startsWith("p")) h += 12;
  } else if (h > 24 || (h === 24 && (min || sec))) return "Hours must be 0 to 23.";
  return (h % 24) * 3600 + min * 60 + sec;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** "2 h 05 min" style is noisy; this gives "2:05:00" plus a readable form. */
export function formatHMS(totalSeconds: number, withSeconds = true): string {
  const neg = totalSeconds < 0;
  let t = Math.round(Math.abs(totalSeconds));
  const h = Math.floor(t / 3600);
  t -= h * 3600;
  const m = Math.floor(t / 60);
  const s = t - m * 60;
  return `${neg ? "-" : ""}${h}:${pad(m)}${withSeconds ? `:${pad(s)}` : ""}`;
}

export function formatWords(totalSeconds: number): string {
  const neg = totalSeconds < 0;
  let t = Math.round(Math.abs(totalSeconds));
  const d = Math.floor(t / 86400);
  t -= d * 86400;
  const h = Math.floor(t / 3600);
  t -= h * 3600;
  const m = Math.floor(t / 60);
  const s = t - m * 60;
  const parts: string[] = [];
  if (d) parts.push(`${d} day${d === 1 ? "" : "s"}`);
  if (h) parts.push(`${h} hour${h === 1 ? "" : "s"}`);
  if (m) parts.push(`${m} minute${m === 1 ? "" : "s"}`);
  if (s || !parts.length) parts.push(`${s} second${s === 1 ? "" : "s"}`);
  return (neg ? "minus " : "") + parts.join(", ");
}

/** Clock display for seconds-after-midnight, 24 h and 12 h. */
export function formatClock(secOfDay: number): { h24: string; h12: string } {
  const t = ((Math.round(secOfDay) % 86400) + 86400) % 86400;
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  const sec = s ? `:${pad(s)}` : "";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return { h24: `${pad(h)}:${pad(m)}${sec}`, h12: `${h12}:${pad(m)}${sec} ${h < 12 ? "AM" : "PM"}` };
}

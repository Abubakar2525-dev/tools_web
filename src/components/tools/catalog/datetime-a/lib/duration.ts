/** Duration helpers for timers, stopwatches and countdowns. */

export type Split = { days: number; hours: number; minutes: number; seconds: number; ms: number };

export function splitDuration(totalMs: number): Split {
  const t = Math.max(0, Math.floor(totalMs));
  return {
    days: Math.floor(t / 86_400_000),
    hours: Math.floor((t % 86_400_000) / 3_600_000),
    minutes: Math.floor((t % 3_600_000) / 60_000),
    seconds: Math.floor((t % 60_000) / 1000),
    ms: t % 1000,
  };
}

const p2 = (n: number) => String(n).padStart(2, "0");

/** Stopwatch style: "1:02:03.45" or "02:03.45" (hundredths, truncated). */
export function formatStopwatch(ms: number, digits: 1 | 2 | 3 = 2): string {
  const t = Math.max(0, ms);
  const h = Math.floor(t / 3_600_000);
  const m = Math.floor((t % 3_600_000) / 60_000);
  const s = Math.floor((t % 60_000) / 1000);
  const frac = Math.floor((t % 1000) / 10 ** (3 - digits));
  const tail = `${p2(m)}:${p2(s)}.${String(frac).padStart(digits, "0")}`;
  return h > 0 ? `${h}:${tail}` : tail;
}

/** Clock style: "1:05:09" or "05:09" (rounded up so a timer never shows 00:00 while running). */
export function formatClock(ms: number, roundUp = true): string {
  const total = roundUp ? Math.ceil(Math.max(0, ms) / 1000) : Math.floor(Math.max(0, ms) / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h > 0 ? `${h}:${p2(m)}:${p2(s)}` : `${p2(m)}:${p2(s)}`;
}

/** "2 days, 3 hours, 4 minutes" (zero parts omitted). */
export function describeDuration(ms: number, withSeconds = true): string {
  const d = splitDuration(ms);
  const parts: string[] = [];
  const add = (n: number, unit: string) => n && parts.push(`${n} ${unit}${n === 1 ? "" : "s"}`);
  add(d.days, "day");
  add(d.hours, "hour");
  add(d.minutes, "minute");
  if (withSeconds) add(d.seconds, "second");
  return parts.length ? parts.join(", ") : withSeconds ? "0 seconds" : "less than a minute";
}

/** Builds a CSV document from rows; quotes cells that need it. */
export function toCsv(rows: (string | number)[][]): string {
  return rows
    .map((r) =>
      r
        .map((cell) => {
          const s = String(cell);
          return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        })
        .join(","),
    )
    .join("\r\n");
}

/**
 * Unix timestamp unit detection by magnitude. Values below 1e11 are read as
 * seconds (1e11 s is the year 5138), below 1e14 as milliseconds, below 1e17
 * as microseconds, otherwise nanoseconds.
 */
export type TsUnit = "s" | "ms" | "us" | "ns";
export function detectTimestampUnit(n: number): TsUnit {
  const a = Math.abs(n);
  if (a < 1e11) return "s";
  if (a < 1e14) return "ms";
  if (a < 1e17) return "us";
  return "ns";
}

export const TS_FACTOR: Record<TsUnit, number> = { s: 1000, ms: 1, us: 0.001, ns: 0.000001 };
export const TS_LABEL: Record<TsUnit, string> = { s: "seconds", ms: "milliseconds", us: "microseconds", ns: "nanoseconds" };

/** Largest instant a JavaScript Date can hold (±8.64e15 ms, about ±275,760 years). */
export const MAX_DATE_MS = 8.64e15;

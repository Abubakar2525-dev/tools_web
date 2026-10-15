"use client";

import { useEffect, useMemo, useState } from "react";
import cronstrue from "cronstrue";
import { Btn, CellSelect, CopyBtn, Notice, PrivacyNote, ResetBtn, SelectField, TextField, ToolPanel } from "@/components/tools/kit";
import { Spinner } from "@/components/tools/engines/files";
import { errorMessage, useNow } from "./shared";

type CronParserMod = typeof import("cron-parser");

const PRESETS: { label: string; expr: string }[] = [
  { label: "Every minute", expr: "* * * * *" },
  { label: "Every 5 minutes", expr: "*/5 * * * *" },
  { label: "Every 15 minutes", expr: "*/15 * * * *" },
  { label: "Every hour", expr: "0 * * * *" },
  { label: "Every day at midnight", expr: "0 0 * * *" },
  { label: "Every day at 09:30", expr: "30 9 * * *" },
  { label: "Weekdays at 09:00", expr: "0 9 * * 1-5" },
  { label: "Every Sunday at 03:00", expr: "0 3 * * 0" },
  { label: "First day of the month", expr: "0 0 1 * *" },
  { label: "Every quarter (Jan, Apr, Jul, Oct)", expr: "0 0 1 1,4,7,10 *" },
  { label: "Office hours, every 30 min", expr: "*/30 9-17 * * 1-5" },
];

const FIELDS = [
  { key: "minute", label: "Minute", range: "0-59", opts: ["*", "0", "*/5", "*/10", "*/15", "*/30", "0,30"] },
  { key: "hour", label: "Hour", range: "0-23", opts: ["*", "0", "6", "9", "12", "18", "*/2", "*/6", "9-17"] },
  { key: "dom", label: "Day of month", range: "1-31", opts: ["*", "1", "15", "1,15", "L", "*/2"] },
  { key: "month", label: "Month", range: "1-12 or JAN-DEC", opts: ["*", "1", "6", "12", "*/3", "1,4,7,10"] },
  { key: "dow", label: "Day of week", range: "0-6 (Sun=0) or SUN-SAT", opts: ["*", "1-5", "0,6", "1", "5", "0"] },
] as const;

const DEFAULT = "0 9 * * 1-5";

function tzList(): string[] {
  try {
    const fn = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf;
    if (fn) return ["UTC", ...fn("timeZone").filter((z) => z !== "UTC")];
  } catch {
    /* older browsers */
  }
  return ["UTC", "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles", "Europe/London", "Europe/Berlin", "Asia/Kolkata", "Asia/Tokyo", "Australia/Sydney"];
}

function computeRuns(mod: CronParserMod, expr: string, tz: string, n: number, now: number) {
  const zone = tz === "local" ? Intl.DateTimeFormat().resolvedOptions().timeZone : tz;
  try {
    const it = mod.CronExpressionParser.parse(expr, { tz: zone, currentDate: new Date(now) });
    const out: Date[] = [];
    for (let i = 0; i < n; i++) out.push(it.next().toDate());
    const withSeconds = expr.split(/\s+/).length === 6;
    const f = new Intl.DateTimeFormat(undefined, {
      timeZone: zone,
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: withSeconds ? "2-digit" : undefined,
      timeZoneName: "short",
    });
    return { ok: true as const, zone, items: out.map((d) => ({ local: f.format(d), iso: d.toISOString() })) };
  } catch (e) {
    return { ok: false as const, error: errorMessage(e) };
  }
}

export default function Tool() {
  const [expr, setExpr] = useState(DEFAULT);
  const [tz, setTz] = useState("local");
  const [count, setCount] = useState("10");
  const [mod, setMod] = useState<CronParserMod | null>(null);
  const now = useNow(30000);
  const zones = useMemo(() => tzList(), []);

  useEffect(() => {
    let alive = true;
    import("cron-parser").then((m) => {
      if (alive) setMod(m);
    });
    return () => {
      alive = false;
    };
  }, []);

  const parts = expr.trim().split(/\s+/);
  const fiveFields = parts.length === 5;
  const setField = (i: number, v: string) => {
    const p = fiveFields ? [...parts] : ["*", "*", "*", "*", "*"];
    p[i] = v.trim() || "*";
    setExpr(p.join(" "));
  };

  const description = useMemo(() => {
    if (!expr.trim()) return { ok: false as const, text: "Enter a cron expression." };
    try {
      return { ok: true as const, text: cronstrue.toString(expr.trim(), { use24HourTimeFormat: true, verbose: true }) };
    } catch (e) {
      return { ok: false as const, text: String(e).replace(/^Error:\s*/, "") };
    }
  }, [expr]);

  const runs = useMemo(() => (mod && now !== null && expr.trim() ? computeRuns(mod, expr.trim(), tz, Number(count), now) : null), [mod, now, expr, tz, count]);

  return (
    <div className="space-y-5">
      <ToolPanel title="Cron expression" actions={<ResetBtn onClick={() => setExpr(DEFAULT)} />}>
        <div className="space-y-5">
          <div className="flex flex-wrap items-end gap-3">
            <TextField
              className="min-w-0 flex-1"
              label="Expression"
              hint="Five fields: minute hour day-of-month month day-of-week. A sixth leading seconds field is also accepted."
              value={expr}
              spellCheck={false}
              autoComplete="off"
              error={description.ok ? null : description.text}
              onChange={(e) => setExpr(e.target.value)}
              style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" }}
            />
            <div className="pb-[2px]">
              <CopyBtn text={expr.trim()} />
            </div>
          </div>
          {description.ok && (
            <div className="rounded-xl bg-accent-soft p-5" aria-live="polite">
              <p className="text-sm text-ink-2">In plain English</p>
              <p className="mt-1 text-lg font-semibold text-ink">{description.text}</p>
            </div>
          )}
          <div>
            <p className="mb-2 text-sm font-medium text-ink">Presets</p>
            <div className="flex flex-wrap gap-2">
              {PRESETS.map((p) => (
                <Btn key={p.expr} variant={expr.trim() === p.expr ? "primary" : "ghost"} onClick={() => setExpr(p.expr)}>
                  {p.label}
                </Btn>
              ))}
            </div>
          </div>
        </div>
      </ToolPanel>

      <ToolPanel title="Builder">
        {!fiveFields && <Notice>The builder edits standard five-field expressions. Changing a field here converts the expression to five fields.</Notice>}
        <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {FIELDS.map((f, i) => {
            const value = fiveFields ? parts[i] : "*";
            const known = (f.opts as readonly string[]).includes(value);
            return (
              <div key={f.key} className="space-y-2">
                <TextField label={f.label} hint={f.range} value={value} spellCheck={false} onChange={(e) => setField(i, e.target.value)} />
                <CellSelect
                  label={`${f.label} quick pick`}
                  value={known ? value : ""}
                  onChange={(e) => e.target.value && setField(i, e.target.value)}
                  options={[{ value: "", label: "Quick pick…" }, ...f.opts.map((o) => ({ value: o, label: o === "*" ? "* (every)" : o }))]}
                />
              </div>
            );
          })}
        </div>
        <p className="mt-4 text-[0.8125rem] text-muted">Syntax: * any value, a,b list, a-b range, */n every n, a-b/n stepped range. When both day of month and day of week are set, standard cron runs on either match.</p>
      </ToolPanel>

      <ToolPanel title="Next run times">
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField
              label="Time zone"
              value={tz}
              onChange={(e) => setTz(e.target.value)}
              options={[{ value: "local", label: "This browser's time zone" }, ...zones.map((z) => ({ value: z, label: z }))]}
            />
            <SelectField label="How many" value={count} onChange={(e) => setCount(e.target.value)} options={["5", "10", "20", "50"]} />
          </div>
          {!mod || now === null ? (
            <Spinner label="Loading the schedule calculator" />
          ) : !runs ? null : !runs.ok ? (
            <Notice tone="error" title="Cannot compute run times">
              {runs.error}
            </Notice>
          ) : (
            <ol className="divide-y divide-line overflow-hidden rounded-lg shadow-[inset_0_0_0_1px_var(--line)]">
              {runs.items.map((r, i) => (
                <li key={r.iso} className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-2.5 text-sm">
                  <span className="text-ink">
                    <span className="mr-3 tabular-nums text-muted">{i + 1}.</span>
                    {r.local}
                  </span>
                  <span className="font-mono text-[0.8rem] text-muted">{r.iso}</span>
                </li>
              ))}
            </ol>
          )}
          {runs?.ok && <p className="text-[0.8125rem] text-muted">Computed in {runs.zone}. Daylight saving changes can skip or repeat local times; the schedule follows the time zone rules your browser knows.</p>}
        </div>
      </ToolPanel>
      <PrivacyNote />
    </div>
  );
}

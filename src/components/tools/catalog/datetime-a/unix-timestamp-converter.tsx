"use client";

import { useState } from "react";
import { Btn, CopyBtn, EmptyState, Notice, PrivacyNote, ResetBtn, Segmented, TextField, ToolPanel } from "@/components/tools/kit";
import { useLocalZone, useNow } from "./hooks";
import { partsFor, relativeTime, toIsoWithOffset, toRfc2822 } from "./lib/format";
import { MAX_DATE_MS, TS_FACTOR, TS_LABEL, type TsUnit, detectTimestampUnit } from "./lib/duration";

type UnitChoice = "auto" | TsUnit;
type Zone = "local" | "utc";

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line py-2.5 last:border-0">
      <dt className="text-sm text-ink-2">{label}</dt>
      <dd className="flex min-w-0 items-center gap-2">
        <code className="break-all font-mono text-[0.875rem] text-ink">{value}</code>
        <CopyBtn text={value} label="Copy" />
      </dd>
    </div>
  );
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

export default function Tool() {
  const now = useNow(1000);
  const zone = useLocalZone();
  const [raw, setRaw] = useState("");
  const [unit, setUnit] = useState<UnitChoice>("auto");
  const [dtRaw, setDtRaw] = useState("");
  const [dtZone, setDtZone] = useState<Zone>("local");

  // Timestamp → date
  const trimmed = raw.trim().replace(/[_\s,]/g, "");
  const num = /^-?\d+(\.\d+)?$/.test(trimmed) ? Number(trimmed) : null;
  const usedUnit: TsUnit | null = num === null ? null : unit === "auto" ? detectTimestampUnit(num) : unit;
  const ms = num !== null && usedUnit ? num * TS_FACTOR[usedUnit] : null;
  const tsError = trimmed && num === null ? "Enter digits only, e.g. 1791810000." : ms !== null && Math.abs(ms) > MAX_DATE_MS ? "This value is outside the range a date can represent." : null;
  const valid = ms !== null && !tsError;

  // Date → timestamp
  const dm = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(dtRaw);
  let dtMs: number | null = null;
  if (dm) {
    const [y, mo, d, h, mi, s] = [1, 2, 3, 4, 5, 6].map((i) => Number(dm[i] ?? 0));
    const dt = dtZone === "utc" ? new Date(Date.UTC(2000, 0, 1, h, mi, s)) : new Date(2000, 0, 1, h, mi, s);
    if (dtZone === "utc") dt.setUTCFullYear(y, mo - 1, d);
    else dt.setFullYear(y, mo - 1, d);
    dtMs = dt.getTime();
  }

  return (
    <div className="space-y-5">
      <ToolPanel title="Current Unix time">
        <div className="grid gap-3 sm:grid-cols-2" aria-live="off">
          <div className="rounded-xl bg-accent-soft p-5">
            <p className="text-sm text-ink-2">Seconds</p>
            <p className="mt-1 break-all font-display text-[2rem] font-semibold leading-none tabular-nums text-ink">
              {now === null ? "…" : Math.floor(now / 1000)}
            </p>
          </div>
          <div className="rounded-xl bg-sunken p-5">
            <p className="text-sm text-ink-2">Milliseconds (at last tick)</p>
            <p className="mt-1 break-all font-display text-[2rem] font-semibold leading-none tabular-nums text-ink">{now === null ? "…" : now}</p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Btn variant="ghost" disabled={now === null} onClick={() => {
              setRaw(String(Math.floor(Date.now() / 1000)));
              setUnit("auto");
            }}>
            Convert current time
          </Btn>
          {now !== null && <CopyBtn text={String(Math.floor(now / 1000))} label="Copy seconds" />}
        </div>
      </ToolPanel>

      <ToolPanel
        title="Timestamp to date"
        actions={
          <ResetBtn
            onClick={() => {
              setRaw("");
              setUnit("auto");
            }}
          />
        }
      >
        <div className="space-y-4">
          <TextField
            label="Unix timestamp"
            hint="Seconds or milliseconds since 1970-01-01 00:00:00 UTC. Negative values are before 1970."
            inputMode="numeric"
            autoComplete="off"
            className="font-mono"
            placeholder="1791810000"
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            error={tsError}
          />
          <Segmented
            label="Unit"
            value={unit}
            onChange={setUnit}
            options={[
              { value: "auto", label: "Auto-detect" },
              { value: "s", label: "Seconds" },
              { value: "ms", label: "Milliseconds" },
              { value: "us", label: "Microseconds" },
              { value: "ns", label: "Nanoseconds" },
            ]}
          />
          {!valid || ms === null || !usedUnit ? (
            <EmptyState icon="hash" title="Paste a timestamp">
              10 digits usually means seconds, 13 digits milliseconds.
            </EmptyState>
          ) : (
            <>
              {unit === "auto" && <Notice tone="info">Read as {TS_LABEL[usedUnit]} based on its size.</Notice>}
              <dl>
                <Row label="ISO 8601 (UTC)" value={new Date(ms).toISOString()} />
                <Row label={`ISO 8601 (local${zone ? `, ${zone}` : ""})`} value={toIsoWithOffset(partsFor(ms, "local"), ms % 1000 !== 0)} />
                <Row label="UTC (RFC 2822)" value={toRfc2822(partsFor(ms, "utc"))} />
                <Row label="Local, readable" value={new Date(ms).toLocaleString("en-US", { dateStyle: "full", timeStyle: "long" })} />
                <Row label="Relative" value={now === null ? "…" : relativeTime(ms, now)} />
                <Row label="Seconds" value={String(Math.floor(ms / 1000))} />
                <Row label="Milliseconds" value={String(Math.round(ms))} />
              </dl>
            </>
          )}
        </div>
      </ToolPanel>

      <ToolPanel title="Date to timestamp">
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
            <TextField label="Date and time" type="datetime-local" step={1} value={dtRaw} onChange={(e) => setDtRaw(e.target.value)} />
            <Segmented
              label="Interpret as"
              value={dtZone}
              onChange={setDtZone}
              options={[
                { value: "local", label: "Local time" },
                { value: "utc", label: "UTC" },
              ]}
            />
          </div>
          <Btn
            variant="ghost"
            onClick={() => {
              const d = new Date();
              setDtZone("local");
              setDtRaw(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`);
            }}
          >
            Use now
          </Btn>
          {dtMs === null ? (
            <EmptyState icon="calendar" title="Pick a date and time" />
          ) : (
            <dl>
              <Row label="Unix seconds" value={String(Math.floor(dtMs / 1000))} />
              <Row label="Unix milliseconds" value={String(dtMs)} />
              <Row label="ISO 8601 (UTC)" value={new Date(dtMs).toISOString()} />
            </dl>
          )}
        </div>
      </ToolPanel>
      <PrivacyNote />
    </div>
  );
}

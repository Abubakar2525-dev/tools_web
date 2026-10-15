"use client";

import { useState } from "react";
import { Btn, CopyBtn, EmptyState, Notice, PrivacyNote, ResetBtn, Segmented, TextField, ToolPanel } from "@/components/tools/kit";
import { useNow } from "./hooks";
import {
  type DateOrder,
  TOKENS,
  excelSerial,
  formatTokens,
  parseDateString,
  parsedToEpoch,
  partsFor,
  relativeTime,
  toIsoWithOffset,
  toRfc2822,
} from "./lib/format";
import { DataTable } from "./ui";

type Zone = "local" | "utc";
const SAMPLES = ["2026-10-12T14:30:00Z", "Mon, 12 Oct 2026 14:30:00 +0200", "12/10/2026 2:30 PM", "October 12, 2026", "2026-W42-1"];

export default function Tool() {
  const now = useNow(30_000);
  const [input, setInput] = useState("");
  const [order, setOrder] = useState<DateOrder>("DMY");
  const [assume, setAssume] = useState<Zone>("local");
  const [out, setOut] = useState<Zone>("utc");
  const [pattern, setPattern] = useState("dddd, MMMM Do YYYY [at] HH:mm");

  const parsed = input.trim() ? parseDateString(input, order) : null;
  const epoch = parsed?.ok ? parsedToEpoch(parsed.value, assume === "utc") : null;
  const p = epoch !== null && Number.isFinite(epoch) ? partsFor(epoch, out) : null;

  const rows: [string, string][] = p
    ? [
        ["ISO 8601", toIsoWithOffset(p)],
        ["ISO 8601 with milliseconds", toIsoWithOffset(p, true)],
        ["ISO date only", formatTokens("YYYY-MM-DD", p)],
        ["RFC 2822 (email)", toRfc2822(p)],
        ["HTTP date (always GMT)", new Date(p.epoch).toUTCString()],
        ["US (MM/DD/YYYY)", formatTokens("MM/DD/YYYY", p)],
        ["European (DD/MM/YYYY)", formatTokens("DD/MM/YYYY", p)],
        ["Long", formatTokens("dddd, MMMM D, YYYY h:mm A", p)],
        ["ISO week date", formatTokens("GGGG-[W]WW-E", p)],
        ["Ordinal date", formatTokens("YYYY-DDDD", p)],
        ["Unix seconds", formatTokens("X", p)],
        ["Unix milliseconds", formatTokens("x", p)],
        ["Excel serial (1900 system)", excelSerial(p) === null ? "n/a before 1900-03-01" : String(Math.round((excelSerial(p) as number) * 1e6) / 1e6)],
        ["Relative to now", now === null ? "…" : relativeTime(p.epoch, now)],
      ]
    : [];

  const noZone = parsed?.ok && parsed.value.offset === null;

  return (
    <div className="space-y-5">
      <ToolPanel
        title="Date format converter"
        actions={
          <ResetBtn
            onClick={() => {
              setInput("");
              setOrder("DMY");
              setAssume("local");
              setOut("utc");
            }}
          />
        }
      >
        <div className="space-y-5">
          <TextField
            label="Date to convert"
            hint="ISO 8601, RFC 2822, numeric dates (12/10/2026, 12.10.26), written dates (Oct 12, 2026), ISO week or ordinal dates, or a Unix timestamp."
            placeholder="2026-10-12 14:30"
            autoComplete="off"
            spellCheck={false}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            error={parsed && !parsed.ok ? parsed.error : null}
          />
          <div className="flex flex-wrap gap-2">
            {SAMPLES.map((s) => (
              <Btn key={s} variant="subtle" onClick={() => setInput(s)}>
                {s}
              </Btn>
            ))}
          </div>
          <div className="grid gap-5 md:grid-cols-3">
            <div>
              <p className="text-sm font-medium text-ink">Numeric dates like 03/04/2026</p>
              <div className="mt-2">
                <Segmented
                  label="Numeric date order"
                  value={order}
                  onChange={setOrder}
                  options={[
                    { value: "DMY", label: "Day first" },
                    { value: "MDY", label: "Month first" },
                    { value: "YMD", label: "Year first" },
                  ]}
                />
              </div>
            </div>
            <div>
              <p className="text-sm font-medium text-ink">If the input has no zone</p>
              <div className="mt-2">
                <Segmented
                  label="Zone for input without an offset"
                  value={assume}
                  onChange={setAssume}
                  options={[
                    { value: "local", label: "Local time" },
                    { value: "utc", label: "UTC" },
                  ]}
                />
              </div>
            </div>
            <div>
              <p className="text-sm font-medium text-ink">Show output in</p>
              <div className="mt-2">
                <Segmented
                  label="Output zone"
                  value={out}
                  onChange={setOut}
                  options={[
                    { value: "utc", label: "UTC" },
                    { value: "local", label: "Local time" },
                  ]}
                />
              </div>
            </div>
          </div>
        </div>
      </ToolPanel>

      <ToolPanel title="Output">
        {!p || !parsed?.ok ? (
          <EmptyState icon="calendar" title="Enter a date above">
            Every format below updates as you type.
          </EmptyState>
        ) : (
          <div className="space-y-4">
            <Notice tone="success" title={`Recognized as ${parsed.value.format}`}>
              {noZone ? `No zone in the input, so it was read as ${assume === "utc" ? "UTC" : "your local time"}.` : "The input included a zone or offset."}
              {!parsed.value.hasTime && " No time given, so midnight was used."}
            </Notice>
            {parsed.value.warning && <Notice tone="warning">{parsed.value.warning}</Notice>}
            <dl className="rounded-xl px-4 shadow-[0_0_0_1px_var(--line)]">
              {rows.map(([label, value]) => (
                <div key={label} className="flex flex-wrap items-center justify-between gap-2 border-b border-line py-2.5 last:border-0">
                  <dt className="text-sm text-ink-2">{label}</dt>
                  <dd className="flex min-w-0 items-center gap-2">
                    <code className="break-all font-mono text-[0.875rem] text-ink">{value}</code>
                    <CopyBtn text={value} />
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        )}
      </ToolPanel>

      <ToolPanel title="Custom format">
        <div className="space-y-4">
          <TextField
            label="Pattern"
            hint="Combine the tokens below. Wrap literal words in square brackets, e.g. [at]."
            spellCheck={false}
            autoComplete="off"
            value={pattern}
            onChange={(e) => setPattern(e.target.value)}
          />
          <div className="flex flex-wrap items-center gap-3 rounded-lg bg-night px-4 py-3">
            <code className="min-w-0 flex-1 break-all font-mono text-[0.9rem] text-night-ink" aria-live="polite">
              {p ? formatTokens(pattern, p) : "Enter a date above to preview"}
            </code>
            {p && <CopyBtn text={formatTokens(pattern, p)} />}
          </div>
          <DataTable caption="Format tokens" columns={["Token", "Meaning", "Example"]} rows={TOKENS.map((t) => [<code key="t">{t.token}</code>, t.meaning, t.example])} />
        </div>
      </ToolPanel>
      <PrivacyNote />
    </div>
  );
}

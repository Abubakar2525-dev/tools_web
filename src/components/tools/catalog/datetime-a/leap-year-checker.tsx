"use client";

import { useState } from "react";
import { EmptyState, Notice, NumberField, PrivacyNote, ResetBtn, ResultCard, StatGrid, ToolPanel, parseNum } from "@/components/tools/kit";
import { useTodayISO } from "./hooks";
import { countLeapYears, daysInYear, formatLong, leapExplanation, nearbyLeapYears } from "./lib/dates";
import { int } from "./ui";

function readYear(raw: string): { y: number | null; error: string | null } {
  if (!raw.trim()) return { y: null, error: null };
  const n = parseNum(raw);
  if (n === null || !Number.isInteger(n)) return { y: null, error: "Enter a whole year, e.g. 2028." };
  if (n < 1 || n > 99999) return { y: null, error: "Use a year from 1 to 99,999." };
  return { y: n, error: null };
}

export default function Tool() {
  const today = useTodayISO();
  const [raw, setRaw] = useState<string | null>(null);
  const [fromRaw, setFromRaw] = useState("2001");
  const [toRaw, setToRaw] = useState("2100");

  const value = raw ?? (today ? today.slice(0, 4) : "");
  const { y, error } = readYear(value);
  const from = readYear(fromRaw);
  const to = readYear(toRaw);
  const info = y !== null ? leapExplanation(y) : null;
  const near = y !== null ? nearbyLeapYears(y, 5) : null;

  return (
    <div className="space-y-5">
      <ToolPanel
        title="Leap year checker"
        actions={
          <ResetBtn
            onClick={() => {
              setRaw(null);
              setFromRaw("2001");
              setToRaw("2100");
            }}
          />
        }
      >
        <NumberField label="Year" value={value} onChange={(e) => setRaw(e.target.value)} error={error} className="max-w-xs" />
      </ToolPanel>

      {y === null || !info || !near ? (
        <EmptyState icon="calendar" title="Enter a year">
          The result explains each rule of the Gregorian calendar as it applies.
        </EmptyState>
      ) : (
        <ToolPanel title="Result">
          <div className="space-y-5">
            <ResultCard
              label={`Is ${y} a leap year?`}
              value={info.leap ? "Yes" : "No"}
              detail={info.leap ? `${y} has 366 days and February has 29 days.` : `${y} has 365 days and February has 28 days.`}
              tone={info.leap ? "accent" : "neutral"}
            />
            <ol className="list-decimal space-y-1.5 pl-5 text-[0.95rem] text-ink">
              {info.steps.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ol>
            {y < 1583 && (
              <Notice tone="info">
                The Gregorian calendar began in October 1582, and many countries adopted it much later (Britain and its
                colonies in 1752). Results for earlier years use the same rules projected backward (the proleptic
                Gregorian calendar), which can differ from the Julian calendar used at the time.
              </Notice>
            )}
            <StatGrid
              items={[
                { label: "Days in year", value: daysInYear(y) },
                { label: "Previous leap year", value: near.before[near.before.length - 1] ?? "none" },
                { label: "Next leap year", value: near.after[0] },
              ]}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <h3 className="text-sm font-medium text-ink">Earlier leap years</h3>
                <p className="mt-1 tabular-nums text-ink-2">{near.before.length ? near.before.join(", ") : "None"}</p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-ink">Later leap years</h3>
                <p className="mt-1 tabular-nums text-ink-2">{near.after.join(", ")}</p>
              </div>
            </div>
            {info.leap && (
              <p className="text-sm text-ink-2">Leap day this year: {formatLong({ y, m: 2, d: 29 })}.</p>
            )}
          </div>
        </ToolPanel>
      )}

      <ToolPanel title="Count leap years in a range">
        <div className="grid gap-5 sm:grid-cols-3">
          <NumberField label="From year" value={fromRaw} onChange={(e) => setFromRaw(e.target.value)} error={from.error} />
          <NumberField label="To year" value={toRaw} onChange={(e) => setToRaw(e.target.value)} error={to.error} />
          <div aria-live="polite">
            <p className="text-sm font-medium text-ink">Leap years (inclusive)</p>
            <p className="mt-2 text-[1.75rem] font-semibold tabular-nums text-ink">
              {from.y !== null && to.y !== null ? int(countLeapYears(from.y, to.y)) : "-"}
            </p>
          </div>
        </div>
      </ToolPanel>
      <PrivacyNote />
    </div>
  );
}

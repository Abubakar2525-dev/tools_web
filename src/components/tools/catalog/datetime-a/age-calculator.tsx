"use client";

import { useState } from "react";
import { EmptyState, Notice, PrivacyNote, ResetBtn, ResultCard, Segmented, StatGrid, ToolPanel } from "@/components/tools/kit";
import { useTodayISO } from "./hooks";
import {
  type MonthMode,
  WEEKDAY_NAMES,
  compareDates,
  daysBetween,
  diffYMD,
  formatLong,
  nextAnniversary,
  parseISODate,
  weekday,
} from "./lib/dates";
import { DateInput, int, plural } from "./ui";

export default function Tool() {
  const today = useTodayISO();
  const [birthRaw, setBirthRaw] = useState("");
  const [atRaw, setAtRaw] = useState<string | null>(null);
  const [leap, setLeap] = useState<MonthMode>("clamp");

  const atValue = atRaw ?? today;
  const birth = parseISODate(birthRaw);
  const at = parseISODate(atValue);
  const birthError = birthRaw && !birth ? "Enter a valid date of birth." : null;
  const atError = atValue && !at ? "Enter a valid date." : null;
  const orderError = birth && at && compareDates(birth, at) > 0 ? "The date of birth is after the age-at date." : null;

  const ready = birth && at && !orderError;
  const ymd = ready ? diffYMD(birth, at, leap) : null;
  const totalDays = ready ? daysBetween(birth, at) : 0;
  const next = ready ? nextAnniversary(birth, at, leap) : null;
  const isFeb29 = birth?.m === 2 && birth.d === 29;

  return (
    <div className="space-y-5">
      <ToolPanel
        title="Age calculator"
        actions={
          <ResetBtn
            onClick={() => {
              setBirthRaw("");
              setAtRaw(null);
              setLeap("clamp");
            }}
          />
        }
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <DateInput label="Date of birth" value={birthRaw} onChange={setBirthRaw} error={birthError} />
          <DateInput
            label="Age on this date"
            hint="Defaults to today. Change it to see an age on any past or future date."
            value={atValue}
            onChange={(v) => setAtRaw(v)}
            error={atError ?? orderError}
          />
        </div>
        {isFeb29 && (
          <div className="mt-5 space-y-2">
            <p className="text-sm font-medium text-ink" id="leap-label">
              Birthday in common years (born on February 29)
            </p>
            <Segmented
              label="Birthday in common years"
              value={leap}
              onChange={setLeap}
              options={[
                { value: "clamp", label: "February 28" },
                { value: "overflow", label: "March 1" },
              ]}
            />
            <p className="text-[0.8125rem] text-muted">
              In years without February 29, the birthday counts on the day you choose. Many people celebrate on
              February 28; some legal systems treat March 1 as the day a leap-day birthday turns over.
            </p>
          </div>
        )}
      </ToolPanel>

      {!ymd || !birth || !at || !next ? (
        <EmptyState icon="calendar" title="Enter a date of birth">
          Your exact age in years, months and days appears here, with totals and a countdown to your next birthday.
        </EmptyState>
      ) : (
        <ToolPanel title="Result">
          <div className="space-y-5">
            <ResultCard
              label={`Age on ${formatLong(at)}`}
              value={`${ymd.years} ${ymd.years === 1 ? "year" : "years"}`}
              detail={`${plural(ymd.years, "year")}, ${plural(ymd.months, "month")} and ${plural(ymd.days, "day")}`}
            />
            {next.daysUntil === 0 && next.years > 0 && (
              <Notice tone="success">Happy birthday. This is birthday number {next.years}.</Notice>
            )}
            <StatGrid
              items={[
                { label: "Total months", value: int(ymd.years * 12 + ymd.months) },
                { label: "Total weeks", value: `${int(Math.floor(totalDays / 7))} w ${totalDays % 7} d` },
                { label: "Total days", value: int(totalDays) },
                { label: "Total hours", value: int(totalDays * 24) },
                { label: "Total minutes", value: int(totalDays * 1440) },
                { label: "Born on a", value: WEEKDAY_NAMES[weekday(birth)] },
              ]}
            />
            <div className="rounded-xl bg-sunken p-5">
              <p className="text-sm text-ink-2">Next birthday</p>
              <p className="mt-1 text-lg font-semibold text-ink">
                {next.daysUntil === 0 ? "Today" : `In ${plural(next.daysUntil, "day")}`}: {formatLong(next.date)}
              </p>
              <p className="mt-1 text-sm text-ink-2">
                Turning {next.years}
                {isFeb29 && next.date.m !== 2 ? " (March 1 used because this year has no February 29)" : ""}
                {isFeb29 && next.date.m === 2 && next.date.d === 28 ? " (February 28 used because this year has no February 29)" : ""}.
              </p>
            </div>
            <p className="text-[0.8125rem] text-muted">
              Hour and minute totals count whole calendar days (24 hours each) from midnight to midnight, so they ignore
              the time of birth and daylight-saving changes.
            </p>
          </div>
        </ToolPanel>
      )}
      <PrivacyNote />
    </div>
  );
}

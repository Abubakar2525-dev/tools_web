"use client";

import { Btn, CopyBtn, EmptyState, Notice, PrivacyNote, TextField, ToolPanel, uid, usePersistentState } from "@/components/tools/kit";
import { useState } from "react";
import { useLocalZone, useLocationSearch, useNow, useTodayISO } from "./hooks";
import { formatLong, parseISODate } from "./lib/dates";
import { describeDuration, splitDuration } from "./lib/duration";
import { formatOffset, formatWallTime, isValidZone, offsetMinutes, wallTime, zonedToEpoch } from "./lib/tz";
import { ZonePicker } from "./ZonePicker";
import { DateInput } from "./ui";

type Target = { title: string; date: string; time: string; tz: string };
type Saved = Target & { id: string };

function fromSearch(search: string): Target | null {
  if (!search) return null;
  const q = new URLSearchParams(search);
  const date = q.get("date") ?? "";
  if (!parseISODate(date)) return null;
  const time = /^\d{2}:\d{2}$/.test(q.get("time") ?? "") ? (q.get("time") as string) : "00:00";
  const tzRaw = q.get("tz") ?? "";
  return { title: (q.get("title") ?? "").slice(0, 120), date, time, tz: isValidZone(tzRaw) ? tzRaw : "" };
}

function epochOf(t: Target): { epoch: number; gap: boolean } | null {
  const d = parseISODate(t.date);
  const m = /^(\d{2}):(\d{2})$/.exec(t.time);
  if (!d || !m || !t.tz || Number(m[1]) > 23 || Number(m[2]) > 59) return null;
  const r = zonedToEpoch(t.tz, { y: d.y, m: d.m, d: d.d, h: Number(m[1]), mi: Number(m[2]), s: 0 });
  return { epoch: r.epoch, gap: r.kind === "gap" };
}

function shareUrl(t: Target): string {
  if (typeof window === "undefined") return "";
  const q = new URLSearchParams();
  if (t.title) q.set("title", t.title);
  q.set("date", t.date);
  q.set("time", t.time);
  q.set("tz", t.tz);
  return `${window.location.origin}${window.location.pathname}?${q.toString()}`;
}

export default function Tool() {
  const today = useTodayISO();
  const local = useLocalZone();
  const search = useLocationSearch();
  const now = useNow(1000);
  const [draft, setDraft] = useState<Target | null>(null);
  const [saved, setSaved] = usePersistentState<Saved[]>("countdown", []);

  const urlTarget = fromSearch(search);
  const fallback: Target = { title: "New Year", date: today ? `${Number(today.slice(0, 4)) + 1}-01-01` : "", time: "00:00", tz: local };
  const base = draft ?? urlTarget ?? fallback;
  const t: Target = { ...base, tz: base.tz || local };
  const set = (patch: Partial<Target>) => setDraft({ ...t, ...patch });

  const target = epochOf(t);
  const left = target && now !== null ? target.epoch - now : null;
  const parts = left !== null ? splitDuration(Math.abs(left)) : null;
  const done = left !== null && left <= 0;
  const url = t.date && t.tz ? shareUrl(t) : "";
  const localWall = target && local ? wallTime(local, target.epoch) : null;

  return (
    <div className="space-y-5">
      <ToolPanel title="Countdown target">
        <div className="grid gap-5 md:grid-cols-2">
          <TextField label="Title" optional value={t.title} maxLength={120} onChange={(e) => set({ title: e.target.value })} placeholder="Launch day" />
          <ZonePicker label="Time zone" value={t.tz} onChange={(tz) => set({ tz })} />
          <DateInput label="Date" value={t.date} onChange={(date) => set({ date })} error={t.date && !parseISODate(t.date) ? "Enter a valid date." : null} />
          <TextField label="Time" type="time" value={t.time} onChange={(e) => set({ time: e.target.value })} />
        </div>
        {urlTarget && !draft && (
          <p className="mt-4 text-[0.8125rem] text-muted">Loaded from the shared link. Edit any field to make your own.</p>
        )}
        {target?.gap && (
          <div className="mt-4">
            <Notice tone="warning">That time is skipped by a daylight-saving change in {t.tz}; the countdown uses the moment clocks jump forward to.</Notice>
          </div>
        )}
      </ToolPanel>

      {!target ? (
        <EmptyState icon="timer" title="Choose a date, time and zone" />
      ) : (
        <ToolPanel title={t.title || "Countdown"}>
          <div className="space-y-5">
            {parts === null ? (
              <div className="grid min-h-28 place-items-center text-sm text-muted" role="status">
                Starting…
              </div>
            ) : (
              <>
                {done && <Notice tone="success" title="Reached">This moment arrived {describeDuration(Math.abs(left ?? 0), false)} ago.</Notice>}
                <div className="grid grid-cols-4 gap-2 sm:gap-3" aria-hidden="true">
                  {[
                    ["Days", parts.days],
                    ["Hours", parts.hours],
                    ["Minutes", parts.minutes],
                    ["Seconds", parts.seconds],
                  ].map(([label, n]) => (
                    <div key={label} className={`rounded-xl p-3 text-center sm:p-5 ${done ? "bg-sunken" : "bg-accent-soft"}`}>
                      <p className="font-display text-[1.75rem] font-semibold leading-none tabular-nums text-ink sm:text-[2.75rem]">
                        {label === "Days" ? (n as number).toLocaleString("en-US") : String(n).padStart(2, "0")}
                      </p>
                      <p className="mt-2 text-[0.8125rem] text-ink-2">{label}</p>
                    </div>
                  ))}
                </div>
                <p className="sr-only">
                  {done ? "Reached." : `${describeDuration(left ?? 0, false)} remaining.`}
                </p>
              </>
            )}
            <p className="text-sm text-ink-2">
              Target: {parseISODate(t.date) ? formatLong(parseISODate(t.date)!) : t.date} at {t.time} in {t.tz} ({formatOffset(offsetMinutes(t.tz, target.epoch))})
              {localWall && local !== t.tz && (
                <>
                  , which is {formatWallTime(localWall)} on {formatLong(localWall)} in your zone
                </>
              )}
              .
            </p>
            <div className="flex flex-wrap gap-2">
              <CopyBtn text={url} label="Copy share link" />
              <Btn
                variant="ghost"
                icon="plus"
                onClick={() => setSaved((s) => [{ ...t, id: uid() }, ...s.filter((x) => !(x.date === t.date && x.time === t.time && x.tz === t.tz && x.title === t.title))].slice(0, 30))}
              >
                Save countdown
              </Btn>
            </div>
            <p className="text-[0.8125rem] text-muted">
              The share link stores the title, date, time and zone in the address, so anyone who opens it sees the same
              moment converted to their own clock. Updates once per second and pauses while the tab is hidden.
            </p>
          </div>
        </ToolPanel>
      )}

      <ToolPanel title="Saved countdowns">
        {saved.length === 0 ? (
          <EmptyState icon="list" title="Nothing saved yet">
            Saved countdowns stay in this browser.
          </EmptyState>
        ) : (
          <ul className="divide-y divide-line">
            {saved.map((s) => {
              const e = epochOf(s);
              const l = e && now !== null ? e.epoch - now : null;
              return (
                <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="font-medium text-ink">{s.title || "Untitled"}</p>
                    <p className="text-[0.8125rem] text-muted">
                      {s.date} {s.time} · {s.tz}
                      {l !== null && ` · ${l > 0 ? `in ${describeDuration(l, false)}` : "reached"}`}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <Btn variant="ghost" onClick={() => setDraft({ title: s.title, date: s.date, time: s.time, tz: s.tz })}>
                      Show
                    </Btn>
                    <Btn variant="subtle" icon="trash" aria-label={`Delete ${s.title || "countdown"}`} onClick={() => setSaved((x) => x.filter((y) => y.id !== s.id))} />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </ToolPanel>
      <PrivacyNote stored />
    </div>
  );
}

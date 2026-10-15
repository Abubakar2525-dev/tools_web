"use client";

import { Btn, Checkbox, EmptyState, PrivacyNote, ResetBtn, ToolPanel, usePersistentState } from "@/components/tools/kit";
import { useLocalZone, useNow } from "./hooks";
import { WEEKDAY_NAMES, daysBetween, formatShort, weekday } from "./lib/dates";
import { describeDiff, formatOffset, formatWallTime, offsetMinutes, wallTime, zoneAbbrev, zoneCity } from "./lib/tz";
import { ZonePicker } from "./ZonePicker";

type Prefs = { zones: string[]; h12: boolean; seconds: boolean };
const DEFAULTS: Prefs = { zones: ["America/New_York", "Europe/London", "Asia/Dubai", "Asia/Tokyo"], h12: false, seconds: true };

function partOfDay(h: number) {
  if (h >= 5 && h < 12) return "Morning";
  if (h >= 12 && h < 17) return "Afternoon";
  if (h >= 17 && h < 21) return "Evening";
  return "Night";
}

export default function Tool() {
  const now = useNow(1000);
  const local = useLocalZone();
  const [prefs, setPrefs, clearPrefs] = usePersistentState<Prefs>("world-clock", DEFAULTS);

  const all = local ? [local, ...prefs.zones.filter((z) => z !== local)] : prefs.zones;
  const localOffset = now !== null && local ? offsetMinutes(local, now) : 0;
  const localWall = now !== null && local ? wallTime(local, now) : null;

  const move = (tz: string, dir: -1 | 1) =>
    setPrefs((p) => {
      const i = p.zones.indexOf(tz);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= p.zones.length) return p;
      const zones = p.zones.slice();
      [zones[i], zones[j]] = [zones[j], zones[i]];
      return { ...p, zones };
    });

  return (
    <div className="space-y-5">
      <ToolPanel title="World clock" actions={<ResetBtn onClick={clearPrefs} label="Reset list" />}>
        <div className="space-y-5">
          <div className="flex flex-wrap gap-x-6 gap-y-3">
            <Checkbox label="12-hour clock" checked={prefs.h12} onChange={(v) => setPrefs((p) => ({ ...p, h12: v }))} />
            <Checkbox label="Show seconds" checked={prefs.seconds} onChange={(v) => setPrefs((p) => ({ ...p, seconds: v }))} />
          </div>
          {now === null ? (
            <div className="grid min-h-40 place-items-center text-sm text-muted" role="status">
              Reading your clock…
            </div>
          ) : all.length === 0 ? (
            <EmptyState icon="globe" title="No clocks yet">
              Add a city below.
            </EmptyState>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {all.map((tz) => {
                const w = wallTime(tz, now);
                const off = offsetMinutes(tz, now);
                const isLocal = tz === local;
                const dayShift = localWall ? daysBetween(localWall, w) : 0;
                const idx = prefs.zones.indexOf(tz);
                return (
                  <li key={tz} className={`rounded-xl p-4 ${isLocal ? "bg-accent-soft" : "bg-sunken"}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-ink">
                          {zoneCity(tz)}
                          {isLocal && <span className="ml-2 text-[0.8125rem] font-normal text-accent-strong">Your zone</span>}
                        </p>
                        <p className="truncate text-[0.8125rem] text-muted">
                          {zoneAbbrev(tz, now)} · {formatOffset(off)}
                        </p>
                      </div>
                      {!isLocal && (
                        <div className="-mr-2 -mt-1 flex shrink-0">
                          <Btn variant="subtle" aria-label={`Move ${tz} earlier`} disabled={idx <= 0} onClick={() => move(tz, -1)} className="!px-2.5">
                            ↑
                          </Btn>
                          <Btn variant="subtle" aria-label={`Move ${tz} later`} disabled={idx === prefs.zones.length - 1} onClick={() => move(tz, 1)} className="!px-2.5">
                            ↓
                          </Btn>
                          <Btn
                            variant="subtle"
                            icon="trash"
                            aria-label={`Remove ${tz}`}
                            className="!px-2.5"
                            onClick={() => setPrefs((p) => ({ ...p, zones: p.zones.filter((z) => z !== tz) }))}
                          />
                        </div>
                      )}
                    </div>
                    <p className="mt-3 font-display text-[2rem] font-semibold leading-none tracking-[-0.02em] tabular-nums text-ink">
                      <time dateTime={new Date(now).toISOString()}>{formatWallTime(w, prefs.h12, prefs.seconds)}</time>
                    </p>
                    <p className="mt-2 text-[0.8125rem] text-ink-2">
                      {WEEKDAY_NAMES[weekday(w)]}, {formatShort(w)} · {partOfDay(w.h)}
                      {dayShift !== 0 && ` · ${dayShift > 0 ? "tomorrow" : "yesterday"} for you`}
                    </p>
                    {!isLocal && local && <p className="mt-1 text-[0.8125rem] text-muted">{describeDiff(off - localOffset)} from your time</p>}
                  </li>
                );
              })}
            </ul>
          )}
          <ZonePicker
            label="Add a city or time zone"
            value=""
            onChange={(tz) => setPrefs((p) => (p.zones.includes(tz) || tz === local ? p : { ...p, zones: [...p.zones, tz] }))}
            className="max-w-md"
          />
          <p className="text-[0.8125rem] text-muted">
            Clocks update once per second and pause while this tab is hidden. Offsets and abbreviations come from your
            browser&apos;s time zone data, so daylight-saving changes are applied automatically.
          </p>
        </div>
      </ToolPanel>
      <PrivacyNote stored />
    </div>
  );
}


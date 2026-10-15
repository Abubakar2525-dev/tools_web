"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Btn,
  CellInput,
  CellSelect,
  CopyBtn,
  Notice,
  NumberField,
  PrivacyNote,
  ResultCard,
  StatGrid,
  ToolPanel,
  parseNum,
  uid,
  usePersistentState,
} from "@/components/tools/kit";
import { fixed, num } from "@/components/tools/engines/FormulaTool";
import { Icon } from "@/components/ui/Icon";
import { hm, meetingHourlyCost, type AttendeeGroup } from "./lib/calc";

type Group = { id: string; role: string; count: string; amount: string; basis: "hourly" | "annual" };
type Setup = { groups: Group[]; minutes: string; hoursPerYear: string; overhead: string };

const blank = (): Setup => ({
  groups: [
    { id: "g0", role: "Engineers", count: "4", amount: "120000", basis: "annual" },
    { id: "g1", role: "Manager", count: "1", amount: "150000", basis: "annual" },
  ],
  minutes: "60",
  hoursPerYear: "2080",
  overhead: "30",
});

function normalize(v: unknown): Setup {
  const b = blank();
  if (!v || typeof v !== "object") return b;
  const o = v as Partial<Setup>;
  const s = (x: unknown) => (typeof x === "string" ? x.slice(0, 40) : "");
  return {
    groups: Array.isArray(o.groups)
      ? o.groups.slice(0, 50).map((g, i) => ({ id: typeof g?.id === "string" ? g.id : `g${i}`, role: s(g?.role), count: s(g?.count), amount: s(g?.amount), basis: g?.basis === "hourly" ? "hourly" : "annual" }))
      : b.groups,
    minutes: s(o.minutes) || b.minutes,
    hoursPerYear: s(o.hoursPerYear) || b.hoursPerYear,
    overhead: s(o.overhead),
  };
}

export default function Tool() {
  const [initial] = useState(blank);
  const [stored, setStored] = usePersistentState<Setup>("meeting-cost-calculator", initial);
  const setup = useMemo(() => normalize(stored), [stored]);
  const update = (fn: (x: Setup) => Setup) => setStored((p) => fn(normalize(p)));

  // Live meter: elapsed = accumulated + (now - startedAt) while running.
  const [running, setRunning] = useState(false);
  const [startedAt, setStartedAt] = useState(0);
  const [accumulated, setAccumulated] = useState(0);
  const [now, setNow] = useState(0);

  useEffect(() => {
    if (!running) return;
    const reduced = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const id = window.setInterval(() => setNow(Date.now()), reduced ? 1000 : 200);
    return () => window.clearInterval(id);
  }, [running]);

  const elapsedMs = accumulated + (running ? Math.max(0, now - startedAt) : 0);

  const calc = useMemo(() => {
    const errors: string[] = [];
    const groups: AttendeeGroup[] = [];
    let people = 0;
    setup.groups.forEach((g, i) => {
      const c = parseNum(g.count);
      const a = parseNum(g.amount);
      if (c === null || a === null || c < 0 || a < 0 || !Number.isInteger(c)) {
        if (g.count.trim() || g.amount.trim()) errors.push(`Row ${i + 1}: enter a whole number of people and a positive pay amount.`);
        return;
      }
      people += c;
      groups.push({ count: c, amount: a, basis: g.basis });
    });
    const hpy = parseNum(setup.hoursPerYear);
    if (hpy === null || hpy <= 0) errors.push("Working hours per year must be above zero.");
    const overhead = setup.overhead.trim() ? parseNum(setup.overhead) : 0;
    if (overhead === null || overhead < 0) errors.push("Overhead must be 0% or more.");
    const minutes = parseNum(setup.minutes);
    if (minutes === null || minutes < 0) errors.push("Enter the planned length in minutes.");
    const perHour = hpy && hpy > 0 ? meetingHourlyCost(groups, hpy, overhead ?? 0) : 0;
    return { errors, perHour, people, minutes: minutes ?? 0, overhead: overhead ?? 0, hpy: hpy ?? 2080 };
  }, [setup]);

  const liveCost = (calc.perHour * elapsedMs) / 3600000;
  const planned = (calc.perHour * calc.minutes) / 60;
  const seconds = Math.floor(elapsedMs / 1000);
  const clock = `${hm(Math.floor(seconds / 60))}:${String(seconds % 60).padStart(2, "0")}`;

  const start = () => {
    const t = Date.now();
    setStartedAt(t);
    setNow(t);
    setRunning(true);
  };
  const pause = () => {
    const t = Date.now();
    setAccumulated((a) => a + Math.max(0, t - startedAt));
    setNow(t);
    setRunning(false);
  };
  const resetMeter = () => {
    setRunning(false);
    setAccumulated(0);
    setStartedAt(0);
    setNow(0);
  };

  const summary = `Meeting with ${calc.people} people: ${fixed(calc.perHour)} per hour, ${fixed(calc.perHour / 60)} per minute. Planned ${num(calc.minutes)} minutes: ${fixed(planned)}.`;

  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-2">
        <ToolPanel title="Attendees" actions={<Btn variant="subtle" icon="reset" onClick={() => setStored(blank())}>Reset</Btn>}>
          <ul className="space-y-3">
            {setup.groups.map((g, i) => (
              <li key={g.id} className="grid grid-cols-2 gap-2 rounded-xl bg-sunken p-3 sm:grid-cols-[1.4fr_0.6fr_1fr_1fr_auto]">
                <CellInput label={`Row ${i + 1} role`} placeholder="Role" value={g.role} className="col-span-2 sm:col-span-1" onChange={(e) => update((x) => ({ ...x, groups: x.groups.map((y) => (y.id === g.id ? { ...y, role: e.target.value } : y)) }))} />
                <CellInput label={`Row ${i + 1} number of people`} inputMode="numeric" placeholder="1" value={g.count} onChange={(e) => update((x) => ({ ...x, groups: x.groups.map((y) => (y.id === g.id ? { ...y, count: e.target.value } : y)) }))} />
                <CellInput label={`Row ${i + 1} pay per person`} inputMode="decimal" placeholder="Pay" value={g.amount} onChange={(e) => update((x) => ({ ...x, groups: x.groups.map((y) => (y.id === g.id ? { ...y, amount: e.target.value } : y)) }))} />
                <CellSelect
                  label={`Row ${i + 1} pay basis`}
                  value={g.basis}
                  onChange={(e) => update((x) => ({ ...x, groups: x.groups.map((y) => (y.id === g.id ? { ...y, basis: e.target.value === "hourly" ? "hourly" : "annual" } : y)) }))}
                  options={[
                    { value: "annual", label: "per year" },
                    { value: "hourly", label: "per hour" },
                  ]}
                />
                <button type="button" aria-label={`Remove row ${i + 1}`} onClick={() => update((x) => ({ ...x, groups: x.groups.filter((y) => y.id !== g.id) }))} className="grid h-10 w-10 place-items-center rounded-lg text-danger hover:bg-surface">
                  <Icon name="trash" size={18} />
                </button>
              </li>
            ))}
          </ul>
          <div className="mt-3">
            <Btn variant="ghost" icon="plus" onClick={() => update((x) => ({ ...x, groups: [...x.groups, { id: uid(), role: "", count: "1", amount: "", basis: "annual" }] }))}>
              Add attendees
            </Btn>
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-3">
            <NumberField label="Planned length (min)" value={setup.minutes} onChange={(e) => update((x) => ({ ...x, minutes: e.target.value }))} />
            <NumberField label="Work hours per year" hint="2080 = 40 h × 52 weeks." value={setup.hoursPerYear} onChange={(e) => update((x) => ({ ...x, hoursPerYear: e.target.value }))} />
            <NumberField label="Overhead (%)" optional hint="Employer taxes and benefits on top of pay." value={setup.overhead} onChange={(e) => update((x) => ({ ...x, overhead: e.target.value }))} />
          </div>
        </ToolPanel>

        <ToolPanel title="Cost" actions={<CopyBtn text={summary} label="Copy summary" />}>
          <div className="space-y-4">
            {calc.errors.length > 0 && <Notice tone="error">{calc.errors.slice(0, 3).join(" ")}</Notice>}
            <ResultCard label={`Planned ${num(calc.minutes)} minute meeting`} value={fixed(planned)} detail={`${calc.people} people, ${fixed(calc.perHour)} per hour including ${num(calc.overhead)}% overhead`} />
            <div className="rounded-xl bg-night p-5 text-night-ink">
              <p className="text-sm text-night-muted">Live meter</p>
              <p role="timer" aria-label={`Elapsed ${clock}, cost so far ${fixed(liveCost)}`} className="mt-1 font-display text-[2.5rem] font-semibold leading-none tabular-nums">
                {fixed(liveCost)}
              </p>
              <p className="mt-2 text-sm tabular-nums text-night-muted">Elapsed {clock}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {running ? (
                  <Btn variant="ghost" icon="pause" onClick={pause} className="!bg-night-ink !text-night">
                    Pause
                  </Btn>
                ) : (
                  <Btn variant="ghost" icon="play" onClick={start} disabled={calc.perHour <= 0} className="!bg-night-ink !text-night">
                    {elapsedMs > 0 ? "Resume" : "Start meeting"}
                  </Btn>
                )}
                <Btn variant="ghost" icon="reset" onClick={resetMeter} disabled={elapsedMs === 0 && !running} className="!text-night-ink">
                  Reset meter
                </Btn>
              </div>
              <p className="mt-3 text-xs text-night-muted">The meter keeps time from the clock, so it stays accurate if this tab is in the background.</p>
            </div>
            <StatGrid
              items={[
                { label: "Per minute", value: fixed(calc.perHour / 60) },
                { label: "Per hour", value: fixed(calc.perHour) },
                { label: "Weekly, if recurring", value: fixed(planned) },
                { label: "Per year, weekly", value: fixed(planned * 52) },
                { label: "Per year, daily (5/wk)", value: fixed(planned * 5 * 52) },
                { label: "People", value: String(calc.people) },
              ]}
            />
            <PrivacyNote stored />
          </div>
        </ToolPanel>
      </div>
    </div>
  );
}

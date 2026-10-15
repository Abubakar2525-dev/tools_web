"use client";

import { useEffect, useRef, useState } from "react";
import { Btn, CellInput, Checkbox, CopyBtn, PrivacyNote, SelectField, ToolPanel, uid, usePersistentState } from "@/components/tools/kit";
import { Icon } from "@/components/ui/Icon";
import { fmtClockMs, parseDuration } from "./lib/dates";
import { presInitial, type PresSection, type PresState } from "./lib/schema";

type Run = { index: number; segStart: number | null; acc: number[]; finished: boolean };

const iconBtn =
  "grid h-10 w-10 shrink-0 place-items-center rounded-lg text-muted transition-colors hover:bg-sunken hover:text-ink disabled:cursor-not-allowed disabled:opacity-35";

const elapsedOf = (r: Run, i: number, t: number) => (r.acc[i] ?? 0) + (i === r.index && r.segStart !== null ? Math.max(0, t - r.segStart) : 0);
const fmtTarget = (sec: number) => fmtClockMs(sec * 1000);
const fmtDiff = (ms: number) => `${ms > 0 ? "+" : ms < 0 ? "-" : ""}${fmtClockMs(Math.abs(ms))}`;

/* ------------------------------------------------------------------ */
/* Chimes (Web Audio, generated tones)                                 */
/* ------------------------------------------------------------------ */

type AudioCtor = typeof AudioContext;
let ctx: AudioContext | null = null;
function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const C: AudioCtor | undefined = window.AudioContext ?? (window as unknown as { webkitAudioContext?: AudioCtor }).webkitAudioContext;
    if (!C) return null;
    ctx = new C();
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function tone(freq: number, at: number, dur = 0.6) {
  const a = audio();
  if (!a) return;
  const t = a.currentTime + at;
  const osc = a.createOscillator();
  const gain = a.createGain();
  osc.type = "sine";
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(0.25, t + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(gain).connect(a.destination);
  osc.start(t);
  osc.stop(t + dur + 0.05);
}

const chime = {
  warn: () => tone(880, 0),
  end: () => {
    tone(660, 0);
    tone(880, 0.25);
    tone(1100, 0.5, 0.8);
  },
  over: () => {
    tone(440, 0, 0.4);
    tone(440, 0.45, 0.4);
  },
};

/* ------------------------------------------------------------------ */

function SectionEditor({ sections, onChange, disabled }: { sections: PresSection[]; onChange: (s: PresSection[]) => void; disabled: boolean }) {
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= sections.length) return;
    const next = [...sections];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  return (
    <div className="space-y-2">
      {sections.map((s, i) => {
        const raw = drafts[s.id];
        const invalid = raw !== undefined && (parseDuration(raw) === null || parseDuration(raw)! < 1);
        return (
          <div key={s.id} className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
            <span className="w-6 text-right text-sm tabular-nums text-muted">{i + 1}.</span>
            <CellInput
              label={`Section ${i + 1} name`}
              value={s.name}
              maxLength={80}
              disabled={disabled}
              className="min-w-0 flex-1"
              onChange={(e) => onChange(sections.map((x) => (x.id === s.id ? { ...x, name: e.target.value } : x)))}
            />
            <CellInput
              label={`Section ${i + 1} target duration (m:ss)`}
              value={raw ?? fmtTarget(s.seconds)}
              invalid={invalid}
              disabled={disabled}
              inputMode="numeric"
              className="!w-24 text-center tabular-nums"
              onChange={(e) => {
                const v = e.target.value;
                setDrafts((d) => ({ ...d, [s.id]: v }));
                const sec = parseDuration(v);
                if (sec !== null && sec >= 1 && sec <= 6 * 3600) onChange(sections.map((x) => (x.id === s.id ? { ...x, seconds: sec } : x)));
              }}
              onBlur={() =>
                setDrafts((d) => {
                  const n = { ...d };
                  delete n[s.id];
                  return n;
                })
              }
            />
            <span className="flex">
              <button type="button" className={iconBtn} aria-label={`Move ${s.name} up`} disabled={disabled || i === 0} onClick={() => move(i, -1)}>
                <Icon name="chevron" size={16} className="rotate-180" />
              </button>
              <button type="button" className={iconBtn} aria-label={`Move ${s.name} down`} disabled={disabled || i === sections.length - 1} onClick={() => move(i, 1)}>
                <Icon name="chevron" size={16} />
              </button>
              <button
                type="button"
                className={`${iconBtn} hover:!text-danger`}
                aria-label={`Delete ${s.name}`}
                disabled={disabled || sections.length === 1}
                onClick={() => onChange(sections.filter((x) => x.id !== s.id))}
              >
                <Icon name="trash" size={15} />
              </button>
            </span>
          </div>
        );
      })}
      <p className="text-[0.8125rem] text-muted">Durations use minutes:seconds, like 2:30. A plain number means minutes.</p>
    </div>
  );
}

export default function Tool() {
  const [cfg, setCfg] = usePersistentState<PresState>("presentation-timer", presInitial);
  const [run, setRun] = useState<Run | null>(null);
  const [now, setNow] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [isFs, setIsFs] = useState(false);
  const displayRef = useRef<HTMLDivElement>(null);
  const fired = useRef(new Set<string>());

  const sections = cfg.sections.length ? cfg.sections : presInitial.sections;
  const running = !!run && run.segStart !== null;

  // Tick + chimes while running.
  useEffect(() => {
    if (!run || run.segStart === null) return;
    const id = window.setInterval(() => {
      const t = performance.now();
      setNow(t);
      if (!cfg.chimes) return;
      const target = (sections[run.index]?.seconds ?? 0) * 1000;
      const e = elapsedOf(run, run.index, t);
      const key = (k: string) => `${run.index}:${k}`;
      const fire = (k: string, fn: () => void) => {
        if (fired.current.has(key(k))) return;
        fired.current.add(key(k));
        fn();
      };
      if (target > cfg.warnAt * 1000 && e >= target - cfg.warnAt * 1000 && e < target) fire("warn", chime.warn);
      if (e >= target) fire("end", chime.end);
      const overMin = Math.floor((e - target) / 60000);
      if (overMin >= 1) fire(`over${overMin}`, chime.over);
    }, 200);
    return () => window.clearInterval(id);
  }, [run, cfg.chimes, cfg.warnAt, sections]);

  useEffect(() => {
    const onFs = () => setIsFs(document.fullscreenElement === displayRef.current && !!displayRef.current);
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  const start = () => {
    audio(); // unlock audio on a user gesture
    const t = performance.now();
    setNow(t);
    fired.current.clear();
    setRun({ index: 0, segStart: t, acc: sections.map(() => 0), finished: false });
  };
  const pause = () => {
    const t = performance.now();
    setNow(t);
    setRun((r) => (r && r.segStart !== null ? { ...r, acc: r.acc.map((v, i) => (i === r.index ? v + (t - r.segStart!) : v)), segStart: null } : r));
  };
  const resume = () => {
    audio();
    const t = performance.now();
    setNow(t);
    setRun((r) => (r && !r.finished ? { ...r, segStart: t } : r));
  };
  const next = () => {
    const t = performance.now();
    setNow(t);
    setRun((r) => {
      if (!r || r.finished) return r;
      const acc = r.acc.map((v, i) => (i === r.index && r.segStart !== null ? v + (t - r.segStart) : v));
      const last = r.index >= sections.length - 1;
      if (last) return { ...r, acc, segStart: null, finished: true };
      return { index: r.index + 1, acc, segStart: r.segStart !== null ? t : null, finished: false };
    });
  };
  const reset = () => {
    setRun(null);
    fired.current.clear();
  };

  const toggleFullscreen = async () => {
    const el = displayRef.current;
    if (!el) return;
    if (document.fullscreenElement) {
      await document.exitFullscreen().catch(() => {});
      return;
    }
    if (el.requestFullscreen) {
      try {
        await el.requestFullscreen();
        el.focus();
        return;
      } catch {
        /* fall back below */
      }
    }
    setExpanded(true);
    window.requestAnimationFrame(() => el.focus());
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.target !== e.currentTarget) return;
    if (e.key === " ") {
      e.preventDefault();
      if (!run) start();
      else if (running) pause();
      else resume();
    } else if (e.key === "ArrowRight" || e.key.toLowerCase() === "n") {
      e.preventDefault();
      next();
    } else if (e.key === "Escape" && expanded) setExpanded(false);
  };

  const big = isFs || expanded;
  const totalTarget = sections.reduce((a, s) => a + s.seconds * 1000, 0);
  const cur = run ? sections[run.index] : sections[0];
  const curTarget = (cur?.seconds ?? 0) * 1000;
  const curElapsed = run ? elapsedOf(run, run.index, now) : 0;
  const remaining = curTarget - curElapsed;
  const over = run && !run.finished && remaining < 0;
  const warn = run && !run.finished && !over && remaining <= cfg.warnAt * 1000;
  const totalElapsed = run ? sections.reduce((a, _, i) => a + elapsedOf(run, i, now), 0) : 0;
  const plannedSoFar = run ? sections.slice(0, run.index).reduce((a, s) => a + s.seconds * 1000, 0) + Math.min(curElapsed, curTarget) : 0;
  const drift = run ? totalElapsed - plannedSoFar : 0;
  const pct = curTarget ? Math.min(100, (curElapsed / curTarget) * 100) : 0;

  const report = run
    ? sections.map((s, i) => {
        const actual = elapsedOf(run, i, now);
        const reached = run.finished || i <= run.index;
        return { name: s.name || `Section ${i + 1}`, target: s.seconds * 1000, actual, diff: actual - s.seconds * 1000, reached };
      })
    : [];
  const reportText = [
    ["Section", "Target", "Actual", "Difference"].join("\t"),
    ...report.map((r) => [r.name, fmtClockMs(r.target), r.reached ? fmtClockMs(r.actual) : "-", r.reached ? fmtDiff(r.diff) : "-"].join("\t")),
    ["Total", fmtClockMs(totalTarget), fmtClockMs(totalElapsed), fmtDiff(totalElapsed - totalTarget)].join("\t"),
  ].join("\n");

  const statusText = !run
    ? "Ready"
    : run.finished
      ? "Finished"
      : over
        ? `Over time by ${fmtClockMs(-remaining)}`
        : warn
          ? `${fmtClockMs(remaining)} left, wrap up`
          : `${fmtClockMs(remaining)} left`;

  return (
    <div className="space-y-5">
      <div
        ref={displayRef}
        tabIndex={-1}
        onKeyDown={onKey}
        role="region"
        aria-label="Timer display. Space starts or pauses, N or the right arrow moves to the next section."
        className={`card relative flex flex-col p-5 outline-none sm:p-7 ${big ? "fixed inset-0 z-[100] !rounded-none justify-center bg-night text-night-ink" : ""}`}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className={`text-sm ${big ? "text-night-muted" : "text-muted"}`}>
            {run ? (run.finished ? "All sections done" : `Section ${run.index + 1} of ${sections.length}`) : `${sections.length} sections · ${fmtClockMs(totalTarget)} planned`}
          </p>
          <Btn variant="ghost" icon={big ? "close" : "eye"} onClick={() => (expanded ? setExpanded(false) : void toggleFullscreen())} className={big ? "!text-night-ink" : ""}>
            {big ? "Exit full screen" : "Full screen"}
          </Btn>
        </div>

        <div className={`text-center ${big ? "py-10" : "py-6"}`}>
          <p className={`font-display font-semibold tracking-[-0.02em] ${big ? "text-[clamp(1.5rem,4vw,3rem)]" : "text-[1.375rem]"}`}>{run?.finished ? "Done" : cur?.name}</p>
          <p
            className={`mt-2 font-mono font-semibold leading-none tabular-nums ${big ? "text-[clamp(4rem,18vw,14rem)]" : "text-[clamp(3rem,14vw,5.5rem)]"} ${
              over ? "text-danger" : warn ? "text-[oklch(0.62_0.15_65)]" : ""
            }`}
            role="timer"
            aria-live="off"
          >
            {run?.finished ? fmtClockMs(totalElapsed) : over ? `+${fmtClockMs(-remaining)}` : fmtClockMs(Math.max(0, run ? remaining : curTarget))}
          </p>
          <p className={`mt-3 text-[1rem] font-medium ${over ? "text-danger" : big ? "text-night-muted" : "text-ink-2"}`} aria-live="polite">
            {over && <Icon name="alert" size={16} className="mr-1 inline -translate-y-px" />}
            {statusText}
          </p>
          {run && !run.finished && (
            <div className={`mx-auto mt-4 h-2 max-w-xl overflow-hidden rounded-full ${big ? "bg-night-2" : "bg-sunken"}`} aria-hidden="true">
              <div
                className={`h-full rounded-full transition-[width] duration-200 motion-reduce:transition-none ${over ? "bg-danger" : warn ? "bg-[oklch(0.75_0.15_75)]" : "bg-accent"}`}
                style={{ width: `${over ? 100 : pct}%` }}
              />
            </div>
          )}
          {run && (
            <p className={`mt-3 text-sm tabular-nums ${big ? "text-night-muted" : "text-muted"}`}>
              Total {fmtClockMs(totalElapsed)} of {fmtClockMs(totalTarget)}
              {!run.finished && Math.abs(drift) >= 1000 && ` · ${drift > 0 ? "behind" : "ahead of"} plan by ${fmtClockMs(Math.abs(drift))}`}
              {!run.finished && sections[run.index + 1] && ` · Next: ${sections[run.index + 1].name}`}
            </p>
          )}
        </div>

        <div className="flex flex-wrap justify-center gap-2">
          {!run && (
            <Btn icon="play" onClick={start} className={big ? "btn-light" : ""}>
              Start
            </Btn>
          )}
          {run && !run.finished && running && (
            <Btn icon="pause" onClick={pause} className={big ? "btn-light" : ""}>
              Pause
            </Btn>
          )}
          {run && !run.finished && !running && (
            <Btn icon="play" onClick={resume} className={big ? "btn-light" : ""}>
              Resume
            </Btn>
          )}
          {run && !run.finished && (
            <Btn variant="ghost" icon="arrow" onClick={next} className={big ? "!text-night-ink" : ""}>
              {run.index >= sections.length - 1 ? "Finish" : "Next section"}
            </Btn>
          )}
          {run && (
            <Btn variant="subtle" icon="reset" onClick={reset} className={big ? "!text-night-ink" : ""}>
              Reset
            </Btn>
          )}
        </div>
      </div>

      {report.length > 0 && (
        <ToolPanel title="Split report" actions={<CopyBtn text={reportText} label="Copy report" />}>
          <div className="overflow-x-auto rounded-xl shadow-[0_0_0_1px_var(--line)]" role="region" aria-label="Split report" tabIndex={0}>
            <table className="w-full min-w-[480px] border-collapse text-sm">
              <thead className="bg-sunken text-left">
                <tr>
                  <th scope="col" className="px-3 py-2 font-medium text-ink">Section</th>
                  <th scope="col" className="px-3 py-2 text-right font-medium text-ink">Target</th>
                  <th scope="col" className="px-3 py-2 text-right font-medium text-ink">Actual</th>
                  <th scope="col" className="px-3 py-2 text-right font-medium text-ink">Difference</th>
                </tr>
              </thead>
              <tbody>
                {report.map((r, i) => (
                  <tr key={i} className={`border-t border-line ${run && !run.finished && i === run.index ? "bg-accent-soft" : ""}`}>
                    <td className="px-3 py-2 text-ink">{r.name}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{fmtClockMs(r.target)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{r.reached ? fmtClockMs(r.actual) : "-"}</td>
                    <td className={`px-3 py-2 text-right tabular-nums ${r.reached && r.diff > 0 ? "font-medium text-danger" : "text-ink-2"}`}>
                      {r.reached ? `${fmtDiff(r.diff)} ${r.diff > 0 ? "over" : r.diff < 0 ? "under" : ""}` : "-"}
                    </td>
                  </tr>
                ))}
                <tr className="border-t border-line-strong font-semibold">
                  <td className="px-3 py-2">Total</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmtClockMs(totalTarget)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmtClockMs(totalElapsed)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmtDiff(totalElapsed - totalTarget)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </ToolPanel>
      )}

      <ToolPanel title="Sections">
        <SectionEditor sections={sections} onChange={(s) => setCfg((c) => ({ ...c, sections: s }))} disabled={!!run} />
        <div className="mt-3 flex flex-wrap gap-2">
          <Btn
            variant="ghost"
            icon="plus"
            disabled={!!run || sections.length >= 30}
            onClick={() => setCfg((c) => ({ ...c, sections: [...(c.sections.length ? c.sections : presInitial.sections), { id: uid(), name: `Section ${sections.length + 1}`, seconds: 120 }] }))}
          >
            Add section
          </Btn>
          <Btn variant="subtle" icon="reset" disabled={!!run} onClick={() => setCfg(presInitial)}>
            Restore example
          </Btn>
        </div>
        {run && <p className="mt-2 text-[0.8125rem] text-muted">Reset the timer to edit sections.</p>}

        <div className="mt-6 grid gap-4 sm:grid-cols-2 sm:items-end">
          <SelectField
            label="Warn before a section ends"
            value={String(cfg.warnAt)}
            onChange={(e) => setCfg((c) => ({ ...c, warnAt: Number(e.target.value) }))}
            options={[
              { value: "15", label: "15 seconds" },
              { value: "30", label: "30 seconds" },
              { value: "60", label: "1 minute" },
              { value: "120", label: "2 minutes" },
            ]}
          />
          <Checkbox
            label="Play chimes"
            hint="One tone at the warning, a rising chime at the target, and a low double tone for each full minute over."
            checked={cfg.chimes}
            onChange={(v) => setCfg((c) => ({ ...c, chimes: v }))}
          />
        </div>
        <div className="mt-2">
          <Btn variant="subtle" icon="wave" onClick={chime.end}>
            Test chime
          </Btn>
        </div>
      </ToolPanel>

      <PrivacyNote stored />
    </div>
  );
}

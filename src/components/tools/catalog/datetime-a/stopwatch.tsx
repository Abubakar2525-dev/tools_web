"use client";

import { useCallback, useEffect, useState } from "react";
import { Btn, CopyBtn, EmptyState, PrivacyNote, ToolPanel, downloadFile } from "@/components/tools/kit";
import { useReducedMotion } from "./hooks";
import { formatStopwatch, toCsv } from "./lib/duration";
import { DataTable } from "./ui";

type Watch = {
  running: boolean;
  /** performance.now() when the current run started. */
  startedAt: number;
  /** Time banked from earlier runs. */
  banked: number;
  /** Cumulative split times (ms) at each lap press. */
  laps: number[];
};
const IDLE: Watch = { running: false, startedAt: 0, banked: 0, laps: [] };

const elapsedAt = (at: number, s: Watch) => s.banked + (s.running ? Math.max(0, at - s.startedAt) : 0);

function isTyping(el: EventTarget | null) {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || tag === "BUTTON" || tag === "A" || el.isContentEditable;
}

export default function Tool() {
  const [w, setW] = useState<Watch>(IDLE);
  const [tick, setTick] = useState(0);
  const reduced = useReducedMotion();

  const elapsed = elapsedAt(tick, w);

  // Refresh the display while running: every frame, or 4 times a second with reduced motion.
  useEffect(() => {
    if (!w.running) return;
    let raf = 0;
    let timer = 0;
    const loop = () => {
      setTick(performance.now());
      if (reduced) timer = window.setTimeout(loop, 250);
      else raf = requestAnimationFrame(loop);
    };
    if (reduced) timer = window.setTimeout(loop, 250);
    else raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(timer);
    };
  }, [w.running, reduced]);

  const toggle = useCallback(() => {
    const t = performance.now();
    setTick(t);
    setW((s) => (s.running ? { ...s, running: false, banked: elapsedAt(t, s) } : { ...s, running: true, startedAt: t }));
  }, []);
  const lap = useCallback(() => {
    const t = performance.now();
    setTick(t);
    setW((s) => (s.running ? { ...s, laps: [...s.laps, elapsedAt(t, s)] } : s));
  }, []);
  const reset = useCallback(() => {
    setW(IDLE);
    setTick(0);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.repeat || isTyping(e.target)) return;
      if (e.code === "Space") {
        e.preventDefault();
        toggle();
      } else if (e.key === "l" || e.key === "L") lap();
      else if (e.key === "r" || e.key === "R") reset();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggle, lap, reset]);

  const lapTimes = w.laps.map((t, i) => t - (i === 0 ? 0 : w.laps[i - 1]));
  const fastest = lapTimes.length > 1 ? Math.min(...lapTimes) : null;
  const slowest = lapTimes.length > 1 ? Math.max(...lapTimes) : null;
  const csv = toCsv([
    ["lap", "lap_time", "split_time", "lap_ms", "split_ms"],
    ...w.laps.map((t, i) => [i + 1, formatStopwatch(lapTimes[i], 3), formatStopwatch(t, 3), Math.round(lapTimes[i]), Math.round(t)]),
  ]);

  return (
    <div className="space-y-5">
      <ToolPanel title="Stopwatch">
        <div className="space-y-6 text-center">
          <p
            className="font-display text-[3.25rem] font-semibold leading-none tracking-[-0.03em] tabular-nums text-ink sm:text-[4.5rem]"
            role="timer"
            aria-label={`Elapsed ${formatStopwatch(elapsed)}`}
          >
            {formatStopwatch(elapsed)}
          </p>
          <p className="sr-only" aria-live="polite">
            {w.running ? "Running" : elapsed > 0 ? `Stopped at ${formatStopwatch(elapsed)}` : "Ready"}
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            <Btn icon={w.running ? "pause" : "play"} onClick={toggle} className="min-w-28">
              {w.running ? "Stop" : elapsed > 0 ? "Resume" : "Start"}
            </Btn>
            <Btn variant="ghost" icon="plus" onClick={lap} disabled={!w.running}>
              Lap
            </Btn>
            <Btn variant="ghost" icon="reset" onClick={reset} disabled={!w.running && elapsed === 0 && w.laps.length === 0}>
              Reset
            </Btn>
          </div>
          <p className="text-[0.8125rem] text-muted">
            Keyboard: <kbd className="font-mono">Space</kbd> start or stop, <kbd className="font-mono">L</kbd> lap,{" "}
            <kbd className="font-mono">R</kbd> reset (when no field or button has focus).
          </p>
        </div>
      </ToolPanel>

      <ToolPanel
        title="Laps"
        actions={
          w.laps.length > 0 ? (
            <>
              <CopyBtn text={csv} label="Copy CSV" />
              <Btn variant="ghost" icon="download" onClick={() => downloadFile("stopwatch-laps.csv", csv, "text/csv")}>
                Download CSV
              </Btn>
            </>
          ) : undefined
        }
      >
        {w.laps.length === 0 ? (
          <EmptyState icon="timer" title="No laps yet">
            Press Lap (or L) while the stopwatch runs.
          </EmptyState>
        ) : (
          <div className="max-h-[420px] overflow-auto">
            <DataTable
              caption="Laps, newest first"
              captionHidden
              columns={["Lap", "Lap time", "Split (total)", "Note"]}
              rows={w.laps
                .map((t, i) => [
                  i + 1,
                  formatStopwatch(lapTimes[i]),
                  formatStopwatch(t),
                  lapTimes[i] === fastest ? "Fastest" : lapTimes[i] === slowest ? "Slowest" : "",
                ])
                .reverse()}
            />
          </div>
        )}
      </ToolPanel>
      <PrivacyNote />
    </div>
  );
}

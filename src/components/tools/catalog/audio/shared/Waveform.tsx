"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Btn, inputCls } from "@/components/tools/kit";
import { durationOf, formatTime, parseTime, type Pcm } from "../lib/pcm";
import type { Region } from "../lib/silence";
import { computePeaks } from "../lib/waveform";

export type Selection = { start: number; end: number };

const MIN_SEL = 0.01;

function niceStep(seconds: number, px: number) {
  const target = (seconds / px) * 90; // about one label every 90px
  const steps = [0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 900, 1800, 3600];
  return steps.find((s) => s >= target) ?? 3600;
}

function cssVar(el: Element, name: string, fallback: string) {
  const v = getComputedStyle(el).getPropertyValue(name).trim();
  return v || fallback;
}

/**
 * Canvas waveform with an optional draggable selection (start/end handles
 * that are also keyboard sliders), markers, highlighted regions, a playhead
 * and zoom. Clicking without dragging places the cursor.
 */
export function Waveform({
  pcm,
  label,
  selection,
  onSelectionChange,
  markers,
  regions,
  playhead,
  cursor,
  onCursor,
  height = 140,
}: {
  pcm: Pcm;
  label: string;
  selection?: Selection | null;
  onSelectionChange?: (s: Selection) => void;
  markers?: number[];
  regions?: Region[];
  playhead?: number | null;
  cursor?: number | null;
  onCursor?: (t: number) => void;
  height?: number;
}) {
  const duration = durationOf(pcm);
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [width, setWidth] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState(0); // view start (seconds)
  const drag = useRef<{ kind: "start" | "end" | "new"; anchor: number; x0: number; moved: boolean } | null>(null);

  const viewDur = duration / zoom;
  const viewStart = Math.max(0, Math.min(offset, duration - viewDur));

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.floor(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const peaks = useMemo(() => {
    if (!width) return null;
    const sr = pcm.sampleRate;
    return computePeaks(pcm.channels, width, viewStart * sr, (viewStart + viewDur) * sr);
  }, [pcm, width, viewStart, viewDur]);

  useEffect(() => {
    const c = canvas.current;
    if (!c || !peaks || !width) return;
    const dpr = window.devicePixelRatio || 1;
    c.width = Math.round(width * dpr);
    c.height = Math.round(height * dpr);
    const g = c.getContext("2d");
    if (!g) return;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const accent = cssVar(c, "--accent", "#1f8a74");
    const ink = cssVar(c, "--ink", "#222");
    const muted = cssVar(c, "--muted", "#777");
    const sunken = cssVar(c, "--bg-sunken", "#f2f4f4");
    const danger = cssVar(c, "--danger", "#c33");
    const rulerH = 18;
    const top = rulerH;
    const h = height - rulerH;
    const mid = top + h / 2;
    const tx = (t: number) => ((t - viewStart) / viewDur) * width;
    g.clearRect(0, 0, width, height);
    g.fillStyle = sunken;
    g.fillRect(0, top, width, h);
    // Regions (e.g. detected silences)
    if (regions?.length) {
      g.fillStyle = "rgba(200, 120, 0, 0.18)";
      for (const r of regions) {
        const x0 = tx(r.start);
        const x1 = tx(r.end);
        if (x1 < 0 || x0 > width) continue;
        g.fillRect(x0, top, Math.max(1, x1 - x0), h);
      }
    }
    // Selection
    if (selection) {
      const x0 = tx(selection.start);
      const x1 = tx(selection.end);
      g.fillStyle = "rgba(31, 138, 116, 0.16)";
      g.fillRect(x0, top, x1 - x0, h);
    }
    // Waveform
    g.fillStyle = selection ? muted : accent;
    const amp = h / 2 - 2;
    for (let x = 0; x < width; x++) {
      const lo = peaks.min[x];
      const hi = peaks.max[x];
      const y0 = mid - hi * amp;
      const y1 = mid - lo * amp;
      g.fillRect(x, y0, 1, Math.max(1, y1 - y0));
    }
    if (selection) {
      // Redraw selected part in accent
      const x0 = Math.max(0, Math.floor(tx(selection.start)));
      const x1 = Math.min(width, Math.ceil(tx(selection.end)));
      g.fillStyle = accent;
      for (let x = x0; x < x1; x++) {
        const y0 = mid - peaks.max[x] * amp;
        const y1 = mid - peaks.min[x] * amp;
        g.fillRect(x, y0, 1, Math.max(1, y1 - y0));
      }
      g.fillStyle = ink;
      g.fillRect(tx(selection.start) - 1, top, 2, h);
      g.fillRect(tx(selection.end) - 1, top, 2, h);
    }
    // Markers
    if (markers?.length) {
      g.fillStyle = danger;
      for (const m of markers) {
        const x = tx(m);
        if (x < -2 || x > width + 2) continue;
        g.fillRect(x - 1, top, 2, h);
        g.beginPath();
        g.moveTo(x - 5, top);
        g.lineTo(x + 5, top);
        g.lineTo(x, top + 7);
        g.fill();
      }
    }
    // Cursor and playhead
    if (cursor !== null && cursor !== undefined) {
      g.fillStyle = ink;
      g.globalAlpha = 0.5;
      g.fillRect(tx(cursor), top, 1, h);
      g.globalAlpha = 1;
    }
    if (playhead !== null && playhead !== undefined) {
      g.fillStyle = ink;
      g.fillRect(tx(playhead) - 1, top, 2, h);
    }
    // Ruler
    g.fillStyle = muted;
    g.font = "11px ui-sans-serif, system-ui, sans-serif";
    g.textBaseline = "top";
    const step = niceStep(viewDur, width);
    const first = Math.ceil(viewStart / step) * step;
    for (let t = first; t <= viewStart + viewDur + 1e-9; t += step) {
      const x = tx(t);
      g.fillRect(x, rulerH - 5, 1, 5);
      const decimals = step < 0.1 ? 2 : step < 1 ? 1 : 0;
      if (x < width - 30) g.fillText(formatTime(t, decimals), x + 3, 2);
    }
  }, [peaks, width, height, viewStart, viewDur, selection, markers, regions, cursor, playhead]);

  const timeAt = (clientX: number) => {
    const r = wrap.current?.getBoundingClientRect();
    if (!r || !r.width) return 0;
    const t = viewStart + ((clientX - r.left) / r.width) * viewDur;
    return Math.max(0, Math.min(duration, t));
  };

  const setSel = (s: Selection) => {
    if (!onSelectionChange) return;
    let { start, end } = s;
    start = Math.max(0, Math.min(duration, start));
    end = Math.max(0, Math.min(duration, end));
    if (end < start) [start, end] = [end, start];
    onSelectionChange({ start, end });
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const t = timeAt(e.clientX);
    const pxPerSec = width / viewDur;
    let kind: "start" | "end" | "new" = "new";
    if (selection && onSelectionChange) {
      if (Math.abs(t - selection.start) * pxPerSec < 12) kind = "start";
      else if (Math.abs(t - selection.end) * pxPerSec < 12) kind = "end";
    }
    drag.current = { kind, anchor: t, x0: e.clientX, moved: false };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    if (Math.abs(e.clientX - d.x0) > 3) d.moved = true;
    if (!d.moved || !selection || !onSelectionChange) return;
    const t = timeAt(e.clientX);
    if (d.kind === "start") setSel({ start: Math.min(t, selection.end - MIN_SEL), end: selection.end });
    else if (d.kind === "end") setSel({ start: selection.start, end: Math.max(t, selection.start + MIN_SEL) });
    else setSel({ start: Math.min(d.anchor, t), end: Math.max(d.anchor, t) });
  };
  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    drag.current = null;
    if (d && !d.moved) onCursor?.(timeAt(e.clientX));
  };

  const handleKey = (which: "start" | "end") => (e: React.KeyboardEvent) => {
    if (!selection) return;
    const step = e.shiftKey ? 1 : e.altKey ? 0.01 : 0.1;
    const cur = selection[which];
    let next: number | null = null;
    if (e.key === "ArrowLeft" || e.key === "ArrowDown") next = cur - step;
    else if (e.key === "ArrowRight" || e.key === "ArrowUp") next = cur + step;
    else if (e.key === "PageDown") next = cur - 5;
    else if (e.key === "PageUp") next = cur + 5;
    else if (e.key === "Home") next = which === "start" ? 0 : selection.start + MIN_SEL;
    else if (e.key === "End") next = which === "end" ? duration : selection.end - MIN_SEL;
    if (next === null) return;
    e.preventDefault();
    if (which === "start") setSel({ start: Math.max(0, Math.min(next, selection.end - MIN_SEL)), end: selection.end });
    else setSel({ start: selection.start, end: Math.min(duration, Math.max(next, selection.start + MIN_SEL)) });
  };

  const changeZoom = (z: number) => {
    const nz = Math.max(1, Math.min(512, z));
    const focus = selection ? (selection.start + selection.end) / 2 : (cursor ?? viewStart + viewDur / 2);
    const nd = duration / nz;
    setZoom(nz);
    setOffset(Math.max(0, Math.min(duration - nd, focus - nd / 2)));
  };

  const pct = (t: number) => ((t - viewStart) / viewDur) * 100;
  const handle = (which: "start" | "end") => {
    if (!selection) return null;
    const t = selection[which];
    const p = pct(t);
    if (p < -0.5 || p > 100.5) return null;
    return (
      <div
        role="slider"
        tabIndex={0}
        aria-label={which === "start" ? "Selection start" : "Selection end"}
        aria-valuemin={0}
        aria-valuemax={Math.round(duration * 1000) / 1000}
        aria-valuenow={Math.round(t * 1000) / 1000}
        aria-valuetext={formatTime(t)}
        onKeyDown={handleKey(which)}
        className="group absolute bottom-0 top-[18px] z-10 flex w-6 -translate-x-1/2 cursor-ew-resize justify-center outline-none"
        style={{ left: `${p}%` }}
      >
        <span className="mt-auto mb-auto h-10 w-2.5 rounded-full bg-ink shadow-sm ring-2 ring-surface group-focus-visible:ring-accent" />
      </div>
    );
  };

  return (
    <div>
      <div
        ref={wrap}
        className="relative touch-none select-none overflow-hidden rounded-lg"
        style={{ height }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => (drag.current = null)}
      >
        <canvas
          ref={canvas}
          role="img"
          aria-label={`${label}. Duration ${formatTime(duration, 1)}.${selection ? ` Selected ${formatTime(selection.start, 2)} to ${formatTime(selection.end, 2)}.` : ""}${markers?.length ? ` ${markers.length} markers.` : ""}${regions?.length ? ` ${regions.length} highlighted regions.` : ""}`}
          className="block h-full w-full"
        />
        {handle("start")}
        {handle("end")}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Btn variant="ghost" onClick={() => changeZoom(zoom / 2)} disabled={zoom <= 1} aria-label="Zoom out">
          −
        </Btn>
        <Btn variant="ghost" onClick={() => changeZoom(zoom * 2)} disabled={zoom >= 512 || duration / zoom < 0.05} aria-label="Zoom in">
          +
        </Btn>
        <Btn variant="subtle" onClick={() => changeZoom(1)} disabled={zoom === 1}>
          Fit
        </Btn>
        <span className="text-[0.8125rem] tabular-nums text-muted">{zoom}x</span>
        {zoom > 1 && (
          <label className="flex min-w-[160px] flex-1 items-center gap-2 text-[0.8125rem] text-muted">
            <span className="shrink-0">Scroll</span>
            <input
              type="range"
              min={0}
              max={Math.max(0, duration - viewDur)}
              step={viewDur / 100}
              value={viewStart}
              onChange={(e) => setOffset(Number(e.target.value))}
              className="h-10 w-full accent-[var(--accent)]"
              aria-label="Scroll the zoomed waveform"
            />
          </label>
        )}
      </div>
    </div>
  );
}

/** Text input for a time value (accepts seconds or m:ss.mmm). Commits on blur or Enter. */
export function TimeInput({
  label,
  value,
  onCommit,
  min = 0,
  max,
  hint,
}: {
  label: string;
  value: number;
  onCommit: (v: number) => void;
  min?: number;
  max?: number;
  hint?: string;
}) {
  const id = useId();
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const commit = () => {
    if (draft === null) return;
    const v = parseTime(draft);
    if (v === null) {
      setError("Use seconds (12.5) or minutes:seconds (1:02.5).");
      return;
    }
    if (v < min || (max !== undefined && v > max)) {
      setError(`Must be between ${formatTime(min)} and ${formatTime(max ?? v)}.`);
      return;
    }
    setError(null);
    setDraft(null);
    onCommit(v);
  };
  return (
    <div>
      <label htmlFor={id} className="text-sm font-medium text-ink">
        {label}
      </label>
      <input
        id={id}
        inputMode="decimal"
        autoComplete="off"
        className={`${inputCls} mt-2 h-11 tabular-nums`}
        value={draft ?? formatTime(value)}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") {
            setDraft(null);
            setError(null);
          }
        }}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-err` : hint ? `${id}-hint` : undefined}
      />
      {hint && !error && (
        <p id={`${id}-hint`} className="mt-1 text-[0.8125rem] text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-err`} role="alert" className="mt-1 text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

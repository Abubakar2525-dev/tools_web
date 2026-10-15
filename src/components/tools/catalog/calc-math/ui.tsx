"use client";

/** Small shared pieces for the calc-math batch (display of long numbers, SVG plot frame). */

import { useId } from "react";
import { CopyBtn } from "@/components/tools/kit";

/** Full digits of a long number in a scrollable, wrapping box with copy. */
export function BigDigits({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-xl bg-sunken p-4">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-ink">{label}</p>
        <CopyBtn text={value} label="Copy digits" />
      </div>
      {note && <p className="mb-2 text-[0.8125rem] text-muted">{note}</p>}
      <p
        tabIndex={0}
        aria-label={label}
        className="max-h-56 overflow-y-auto break-all font-mono text-[0.8125rem] leading-relaxed text-ink-2"
      >
        {value}
      </p>
    </div>
  );
}

/** Nice axis ticks covering [lo, hi]. */
export function niceTicks(lo: number, hi: number, count = 6): number[] {
  if (!(hi > lo)) return [lo];
  const raw = (hi - lo) / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw;
  const out: number[] = [];
  for (let t = Math.ceil(lo / step) * step; t <= hi + step * 1e-9; t += step) out.push(Math.abs(t) < step * 1e-9 ? 0 : t);
  return out;
}

export const tickLabel = (t: number) => {
  const a = Math.abs(t);
  if (a !== 0 && (a >= 1e5 || a < 1e-3)) return t.toExponential(1).replace("e+", "e");
  return String(Number(t.toPrecision(6))).replace("-", "−");
};

/**
 * Cartesian plot frame: maps data coords to a 600×360 viewBox, draws grid, axes and tick labels,
 * and passes the mappers to children.
 */
export function PlotFrame({
  xMin,
  xMax,
  yMin,
  yMax,
  title,
  desc,
  children,
}: {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
  title: string;
  desc: string;
  children: (sx: (x: number) => number, sy: (y: number) => number) => React.ReactNode;
}) {
  const id = useId();
  const W = 600;
  const H = 360;
  const pad = { l: 52, r: 16, t: 14, b: 34 };
  const sx = (x: number) => pad.l + ((x - xMin) / (xMax - xMin)) * (W - pad.l - pad.r);
  const sy = (y: number) => H - pad.b - ((y - yMin) / (yMax - yMin)) * (H - pad.t - pad.b);
  const xt = niceTicks(xMin, xMax);
  const yt = niceTicks(yMin, yMax, 5);
  return (
    <figure className="overflow-hidden rounded-xl bg-surface shadow-[0_0_0_1px_var(--line)]">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-labelledby={`${id}-t ${id}-d`} className="block h-auto w-full">
        <title id={`${id}-t`}>{title}</title>
        <desc id={`${id}-d`}>{desc}</desc>
        <g stroke="var(--line)" strokeWidth={1}>
          {xt.map((t) => (
            <line key={`x${t}`} x1={sx(t)} x2={sx(t)} y1={pad.t} y2={H - pad.b} />
          ))}
          {yt.map((t) => (
            <line key={`y${t}`} x1={pad.l} x2={W - pad.r} y1={sy(t)} y2={sy(t)} />
          ))}
        </g>
        {yMin <= 0 && yMax >= 0 && <line x1={pad.l} x2={W - pad.r} y1={sy(0)} y2={sy(0)} stroke="var(--muted)" strokeWidth={1.25} />}
        {xMin <= 0 && xMax >= 0 && <line x1={sx(0)} x2={sx(0)} y1={pad.t} y2={H - pad.b} stroke="var(--muted)" strokeWidth={1.25} />}
        <g fill="var(--muted)" fontSize={12} className="tabular-nums">
          {xt.map((t) => (
            <text key={`xl${t}`} x={sx(t)} y={H - pad.b + 18} textAnchor="middle">
              {tickLabel(t)}
            </text>
          ))}
          {yt.map((t) => (
            <text key={`yl${t}`} x={pad.l - 6} y={sy(t) + 4} textAnchor="end">
              {tickLabel(t)}
            </text>
          ))}
        </g>
        <svg x={pad.l} y={pad.t} width={W - pad.l - pad.r} height={H - pad.t - pad.b} overflow="hidden">
          <g transform={`translate(${-pad.l} ${-pad.t})`}>{children(sx, sy)}</g>
        </svg>
      </svg>
    </figure>
  );
}

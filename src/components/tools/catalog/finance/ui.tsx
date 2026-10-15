"use client";

/** Shared presentational pieces for the finance tools (charts, schedule table, currency field). */

import { Btn, downloadFile } from "@/components/tools/kit";
import type { FormulaField } from "@/components/tools/engines/FormulaTool";
import { CURRENCY_OPTIONS, toCsv } from "./lib/money";

export const currencyField = (id = "currency", label = "Currency"): FormulaField => ({
  id,
  label,
  type: "select",
  options: CURRENCY_OPTIONS,
});

export const SERIES_COLORS = [
  "var(--accent)",
  "color-mix(in oklch, var(--accent) 38%, var(--surface))",
  "var(--ink-2)",
  "color-mix(in oklch, var(--danger) 70%, var(--surface))",
];

/** Scrollable table with sticky header and optional CSV download. */
export function ScrollTable({
  caption,
  columns,
  rows,
  csvName,
  csvRows,
  maxHeight = 380,
}: {
  caption: string;
  columns: string[];
  rows: (string | number)[][];
  csvName?: string;
  /** Raw (unformatted) rows for the CSV; defaults to `rows`. */
  csvRows?: (string | number)[][];
  maxHeight?: number;
}) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-ink">{caption}</p>
        {csvName && (
          <Btn
            variant="ghost"
            icon="download"
            onClick={() => downloadFile(csvName, toCsv([columns, ...(csvRows ?? rows)]), "text/csv")}
          >
            Download CSV
          </Btn>
        )}
      </div>
      <div
        className="overflow-auto rounded-xl shadow-[0_0_0_1px_var(--line)]"
        style={{ maxHeight }}
        tabIndex={0}
        role="region"
        aria-label={caption}
      >
        <table className="w-full text-left text-sm">
          <caption className="sr-only">{caption}</caption>
          <thead className="sticky top-0 bg-surface">
            <tr className="shadow-[inset_0_-1px_0_var(--line)]">
              {columns.map((c) => (
                <th key={c} scope="col" className="whitespace-nowrap px-3 py-2.5 font-medium text-ink">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-b border-line last:border-0">
                {r.map((c, j) => (
                  <td key={j} className="whitespace-nowrap px-3 py-2 tabular-nums text-ink-2">
                    {c}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * Stacked column chart built from plain elements so it scales at any width.
 * `summary` is required: it is the accessible text alternative and is shown under the chart.
 */
export function StackedBars({
  title,
  series,
  data,
  summary,
  formatMax,
}: {
  title: string;
  series: string[];
  data: { label: string; values: number[] }[];
  summary: string;
  formatMax: (n: number) => string;
}) {
  const totals = data.map((d) => d.values.reduce((a, b) => a + Math.max(0, b), 0));
  const max = Math.max(1e-9, ...totals);
  const labelEvery = Math.max(1, Math.ceil(data.length / 8));
  return (
    <figure className="rounded-xl bg-sunken p-4">
      <figcaption className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <span className="font-medium text-ink">{title}</span>
        <span className="flex flex-wrap gap-3 text-[0.8125rem] text-ink-2">
          {series.map((s, i) => (
            <span key={s} className="inline-flex items-center gap-1.5">
              <span aria-hidden="true" className="h-2.5 w-2.5 rounded-sm" style={{ background: SERIES_COLORS[i] }} />
              {s}
            </span>
          ))}
        </span>
      </figcaption>
      <div role="img" aria-label={`${title}. ${summary}`} className="mt-3">
        <p aria-hidden="true" className="text-[0.75rem] tabular-nums text-muted">
          {formatMax(max)}
        </p>
        <div aria-hidden="true" className="mt-1 flex h-44 items-end gap-[2px] border-b border-line-strong">
          {data.map((d, i) => (
            <div key={i} className="flex h-full min-w-0 flex-1 flex-col-reverse" title={d.label}>
              {d.values.map((v, j) => (
                <div
                  key={j}
                  style={{ height: `${(Math.max(0, v) / max) * 100}%`, background: SERIES_COLORS[j] }}
                  className={j === d.values.length - 1 ? "rounded-t-[2px]" : ""}
                />
              ))}
            </div>
          ))}
        </div>
        <div aria-hidden="true" className="mt-1 flex gap-[2px] text-[0.6875rem] tabular-nums text-muted">
          {data.map((d, i) => (
            <span key={i} className="min-w-0 flex-1 overflow-visible whitespace-nowrap text-center">
              {i % labelEvery === 0 || i === data.length - 1 ? d.label : ""}
            </span>
          ))}
        </div>
      </div>
      <p className="mt-3 text-[0.8125rem] text-ink-2">{summary}</p>
    </figure>
  );
}

/** Horizontal bars for category comparisons, with values in text. */
export function HBars({
  title,
  items,
  format,
}: {
  title: string;
  items: { label: string; value: number; target?: number; note?: string }[];
  format: (n: number) => string;
}) {
  const max = Math.max(1e-9, ...items.map((i) => Math.max(i.value, i.target ?? 0)));
  return (
    <figure className="rounded-xl bg-sunken p-4">
      <figcaption className="text-sm font-medium text-ink">{title}</figcaption>
      <ul className="mt-3 space-y-3">
        {items.map((it) => (
          <li key={it.label}>
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 text-[0.8125rem]">
              <span className="text-ink">{it.label}</span>
              <span className="tabular-nums text-ink-2">
                {format(it.value)}
                {it.target !== undefined && <> of {format(it.target)} target</>}
                {it.note && <> · {it.note}</>}
              </span>
            </div>
            <div className="relative mt-1.5 h-2.5 rounded-full bg-surface shadow-[inset_0_0_0_1px_var(--line)]" aria-hidden="true">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${Math.min(100, (Math.max(0, it.value) / max) * 100)}%`,
                  background: it.target !== undefined && it.value > it.target ? SERIES_COLORS[3] : SERIES_COLORS[0],
                }}
              />
              {it.target !== undefined && (
                <div className="absolute top-[-3px] h-4 w-[2px] bg-ink" style={{ left: `${Math.min(100, (it.target / max) * 100)}%` }} />
              )}
            </div>
          </li>
        ))}
      </ul>
    </figure>
  );
}

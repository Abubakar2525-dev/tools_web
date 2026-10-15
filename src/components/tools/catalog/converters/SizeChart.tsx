"use client";

/** Shared converter + accessible reference table for size charts (clothing, shoes). */

import { useState } from "react";
import { Notice, PrivacyNote, ResetBtn, SelectField, StatGrid, ToolPanel } from "@/components/tools/kit";

export type Chart = { id: string; title: string; systems: string[]; rows: string[][]; note: string };

export function SizeChart({ charts, disclaimer }: { charts: Chart[]; disclaimer: string }) {
  const [chartId, setChartId] = useState(charts[0].id);
  const [system, setSystem] = useState(0);
  const [rowIdx, setRowIdx] = useState(Math.floor(charts[0].rows.length / 2));

  const chart = charts.find((c) => c.id === chartId) ?? charts[0];
  const sys = Math.min(system, chart.systems.length - 1);
  const row = chart.rows[Math.min(rowIdx, chart.rows.length - 1)];
  const activeRow = Math.min(rowIdx, chart.rows.length - 1);

  // Size options for the chosen system; values that repeat (e.g. letter sizes) keep their row index.
  const sizeOptions = chart.rows.map((r, i) => {
    const dupes = chart.rows.filter((x) => x[sys] === r[sys]).length > 1;
    const ref = sys === 0 ? 1 : 0;
    return { value: String(i), label: dupes ? `${r[sys]} (${chart.systems[ref]} ${r[ref]})` : r[sys] };
  });

  return (
    <div className="space-y-5">
      <ToolPanel
        title="Convert a size"
        actions={
          <ResetBtn
            onClick={() => {
              setChartId(charts[0].id);
              setSystem(0);
              setRowIdx(Math.floor(charts[0].rows.length / 2));
            }}
          />
        }
      >
        <div className="grid gap-5 sm:grid-cols-3">
          {charts.length > 1 && (
            <SelectField
              label="Chart"
              value={chartId}
              onChange={(e) => {
                const next = charts.find((c) => c.id === e.target.value) ?? charts[0];
                setChartId(next.id);
                setSystem(0);
                setRowIdx(Math.floor(next.rows.length / 2));
              }}
              options={charts.map((c) => ({ value: c.id, label: c.title }))}
            />
          )}
          <SelectField
            label="Your sizing system"
            value={String(sys)}
            onChange={(e) => setSystem(Number(e.target.value))}
            options={chart.systems.map((s, i) => ({ value: String(i), label: s }))}
          />
          <SelectField label="Your size" value={String(activeRow)} onChange={(e) => setRowIdx(Number(e.target.value))} options={sizeOptions} />
        </div>
        <div className="mt-6 space-y-4" aria-live="polite">
          <p className="text-sm text-ink-2">
            {chart.systems[sys]} size <strong className="text-ink">{row[sys]}</strong> is approximately:
          </p>
          <StatGrid items={chart.systems.map((s, i) => ({ label: s, value: row[i] })).filter((_, i) => i !== sys)} />
          <Notice tone="warning" title="Approximate and brand-dependent">
            {disclaimer} {chart.note}
          </Notice>
        </div>
      </ToolPanel>

      <ToolPanel title={`${chart.title}: full chart`}>
        <div className="overflow-x-auto rounded-xl shadow-[0_0_0_1px_var(--line)]" tabIndex={0} role="region" aria-label={`${chart.title} size chart`}>
          <table className="w-full text-left text-sm">
            <caption className="sr-only">{chart.title} approximate size equivalents. The selected size is marked.</caption>
            <thead>
              <tr className="border-b border-line">
                {chart.systems.map((s) => (
                  <th key={s} scope="col" className="whitespace-nowrap px-4 py-2.5 font-medium text-ink">
                    {s}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {chart.rows.map((r, i) => (
                <tr key={i} className={`border-b border-line last:border-0 ${i === activeRow ? "bg-accent-soft" : ""}`} aria-current={i === activeRow ? "true" : undefined}>
                  {r.map((c, j) => (
                    <td key={j} className={`whitespace-nowrap px-4 py-2 tabular-nums ${i === activeRow ? "font-semibold text-ink" : "text-ink-2"}`}>
                      {c}
                      {i === activeRow && j === 0 && <span className="sr-only"> (selected)</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ToolPanel>
      <PrivacyNote />
    </div>
  );
}

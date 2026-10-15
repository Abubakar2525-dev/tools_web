"use client";

/** Small presentational helpers shared by the datetime-a tools. */

import { TextField } from "@/components/tools/kit";

export function DateInput({
  label,
  value,
  onChange,
  error,
  hint,
  className,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string | null;
  hint?: string;
  className?: string;
}) {
  return (
    <TextField
      label={label}
      type="date"
      min="0001-01-01"
      max="9999-12-31"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      error={error}
      hint={hint}
      className={className}
    />
  );
}

/** Table that scrolls inside its own box on narrow screens. */
export function DataTable({
  caption,
  columns,
  rows,
  highlight,
  captionHidden = false,
}: {
  caption: string;
  columns: string[];
  rows: React.ReactNode[][];
  highlight?: (rowIndex: number) => boolean;
  captionHidden?: boolean;
}) {
  return (
    <div className="max-w-full overflow-x-auto rounded-xl shadow-[0_0_0_1px_var(--line)]" tabIndex={0} role="region" aria-label={caption}>
      <table className="w-full min-w-max border-collapse text-left text-sm">
        <caption className={captionHidden ? "sr-only" : "px-4 pb-1 pt-3 text-left text-[0.8125rem] text-muted"}>{caption}</caption>
        <thead>
          <tr className="border-b border-line">
            {columns.map((c) => (
              <th key={c} scope="col" className="px-4 py-2.5 font-medium text-ink-2">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className={`border-b border-line last:border-0 ${highlight?.(i) ? "bg-accent-soft" : ""}`}>
              {r.map((cell, j) => (
                <td key={j} className="px-4 py-2.5 tabular-nums text-ink">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Formats an integer with thousands separators. */
export const int = (n: number) => Math.round(n).toLocaleString("en-US");

export const plural = (n: number, unit: string) => `${int(n)} ${unit}${Math.abs(n) === 1 ? "" : "s"}`;

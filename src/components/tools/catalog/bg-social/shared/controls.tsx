"use client";

import { useId, useState } from "react";
import { inputCls } from "@/components/tools/kit";
import { normalizeHex } from "../lib/misc";

/** Labelled range slider with the current value shown. Keyboard operable by default. */
export function RangeField({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  format,
  hint,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
  hint?: string;
}) {
  const id = useId();
  const shown = format ? format(value) : String(value);
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-sm font-medium text-ink">
          {label}
        </label>
        <span className="text-[0.8125rem] tabular-nums text-muted">{shown}</span>
      </div>
      {hint && <p className="mt-0.5 text-[0.8125rem] text-muted">{hint}</p>}
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-valuetext={shown}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1 h-10 w-full cursor-pointer accent-[var(--accent)]"
      />
    </div>
  );
}

/** Color swatch + hex text input that stay in sync. */
export function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const id = useId();
  const [draft, setDraft] = useState<string | null>(null);
  const text = draft ?? value;
  const invalid = draft !== null && normalizeHex(draft) === null;
  return (
    <div>
      <label htmlFor={id} className="text-sm font-medium text-ink">
        {label}
      </label>
      <div className="mt-1.5 flex items-center gap-2">
        <input
          type="color"
          aria-label={`${label} picker`}
          value={normalizeHex(value) ?? "#000000"}
          onChange={(e) => {
            setDraft(null);
            onChange(e.target.value);
          }}
          className="h-10 w-12 shrink-0 cursor-pointer rounded-md border border-line-strong bg-surface p-1"
        />
        <input
          id={id}
          type="text"
          value={text}
          spellCheck={false}
          autoComplete="off"
          aria-invalid={invalid || undefined}
          onChange={(e) => {
            const v = e.target.value;
            setDraft(v);
            const n = normalizeHex(v);
            if (n) onChange(n);
          }}
          onBlur={() => setDraft(null)}
          className={`${inputCls} h-10 font-mono text-[0.9rem]`}
        />
      </div>
      {invalid && <p className="mt-1 text-[0.8125rem] text-danger">Use a hex color like #1a2b3c.</p>}
    </div>
  );
}

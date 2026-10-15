"use client";

/**
 * Declarative calculator engine. A tool describes its inputs and a pure
 * `compute` function; this renders labelled fields, unit selectors, inline
 * validation, results, step-by-step working, tables, copy, reset and example.
 *
 * Units: a number field with `units` converts the typed value to the base
 * unit (value * factor + (offset ?? 0)) before `compute` sees it via `v.num`.
 * Use `v.raw` for the value exactly as typed.
 */

import { useDeferredValue, useId, useMemo, useState } from "react";
import {
  Btn,
  Checkbox,
  CopyBtn,
  EmptyState,
  Notice,
  PrivacyNote,
  ResetBtn,
  ResultCard,
  Segmented,
  StatGrid,
  ToolPanel,
  inputCls,
  parseNum,
} from "../kit";
import { Icon } from "@/components/ui/Icon";

export type UnitOption = { value: string; label: string; factor: number; offset?: number };

export type FormulaField =
  | {
      id: string;
      label: string;
      type: "number";
      hint?: string;
      placeholder?: string;
      /** Static unit label shown inside the field (e.g. "%", "kg"). */
      suffix?: string;
      units?: UnitOption[];
      defaultUnit?: string;
      optional?: boolean;
      min?: number;
      max?: number;
      /** Exclusive lower bound, e.g. 0 for "must be positive". */
      gt?: number;
      integer?: boolean;
    }
  | { id: string; label: string; type: "select"; options: { value: string; label: string }[]; hint?: string }
  | { id: string; label: string; type: "text"; hint?: string; placeholder?: string; multiline?: boolean; optional?: boolean; mono?: boolean }
  | { id: string; label: string; type: "date"; hint?: string; optional?: boolean; withTime?: boolean }
  | { id: string; label: string; type: "checkbox"; hint?: string };

export type FormulaOutput = { label: string; value: string; primary?: boolean; note?: string };

export type FormulaResult = {
  outputs: FormulaOutput[];
  /** Ordered working lines, e.g. "Area = π × r² = 3.1416 × 25 = 78.54". */
  steps?: string[];
  notes?: string[];
  table?: { caption?: string; columns: string[]; rows: (string | number)[][] };
  /** Optional custom visual (chart/diagram) rendered under the results. */
  visual?: React.ReactNode;
};

export type FormulaValues = {
  /** Number in base units (after unit conversion), or null if empty/invalid. */
  num: (id: string) => number | null;
  /** Number exactly as typed. */
  raw: (id: string) => number | null;
  /** Selected unit value for a number field. */
  unit: (id: string) => string;
  str: (id: string) => string;
  bool: (id: string) => boolean;
  mode: string;
};

export type FormulaSpec = {
  modes?: { id: string; label: string; fields: string[] }[];
  fields: FormulaField[];
  /** Initial values (strings for inputs, booleans for checkboxes, unit ids via "<id>:unit"). */
  defaults?: Record<string, string | boolean>;
  /** Values loaded by "Load example". */
  example?: Record<string, string | boolean>;
  /**
   * Return a result, an error string (shown as a validation notice), or null
   * when inputs are incomplete. Must be pure and fast.
   */
  compute: (v: FormulaValues) => FormulaResult | string | null;
  /** Text above the fields, e.g. formula reminder. */
  lead?: React.ReactNode;
  /** Label for results panel. */
  resultsTitle?: string;
};

type State = Record<string, string | boolean>;

function initialState(spec: FormulaSpec): State {
  const s: State = {};
  for (const f of spec.fields) {
    if (f.type === "checkbox") s[f.id] = false;
    else if (f.type === "select") s[f.id] = f.options[0]?.value ?? "";
    else s[f.id] = "";
    if (f.type === "number" && f.units?.length) s[`${f.id}:unit`] = f.defaultUnit ?? f.units[0].value;
  }
  if (spec.modes?.length) s.__mode = spec.modes[0].id;
  return { ...s, ...(spec.defaults ?? {}) };
}

export function FormulaTool({ spec }: { spec: FormulaSpec }) {
  const [state, setState] = useState<State>(() => initialState(spec));
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const deferred = useDeferredValue(state);
  const mode = String(state.__mode ?? "");
  const visible = useMemo(() => {
    const m = spec.modes?.find((x) => x.id === mode);
    return m ? spec.fields.filter((f) => m.fields.includes(f.id)) : spec.fields;
  }, [spec, mode]);

  const { fieldErrors, result } = useMemo(() => {
    const st = deferred;
    const errors: Record<string, string> = {};
    const m = spec.modes?.find((x) => x.id === String(st.__mode ?? ""));
    const vis = m ? spec.fields.filter((f) => m.fields.includes(f.id)) : spec.fields;
    let incomplete = false;
    const nums: Record<string, number | null> = {};
    const raws: Record<string, number | null> = {};

    for (const f of spec.fields) {
      if (f.type !== "number") continue;
      const rawStr = String(st[f.id] ?? "");
      const n = parseNum(rawStr);
      const isVisible = vis.includes(f);
      if (rawStr.trim() !== "" && n === null) {
        if (isVisible) errors[f.id] = "Enter a valid number.";
      } else if (n !== null) {
        if (f.integer && !Number.isInteger(n)) errors[f.id] = "Enter a whole number.";
        else if (f.gt !== undefined && !(n > f.gt)) errors[f.id] = `Must be greater than ${f.gt}.`;
        else if (f.min !== undefined && n < f.min) errors[f.id] = `Must be at least ${f.min}.`;
        else if (f.max !== undefined && n > f.max) errors[f.id] = `Must be at most ${f.max}.`;
      }
      if (n === null && !f.optional && isVisible) incomplete = true;
      raws[f.id] = errors[f.id] ? null : n;
      if (raws[f.id] !== null && f.units?.length) {
        const u = f.units.find((x) => x.value === st[`${f.id}:unit`]) ?? f.units[0];
        nums[f.id] = (raws[f.id] as number) * u.factor + (u.offset ?? 0);
      } else nums[f.id] = raws[f.id];
    }
    for (const f of vis) {
      if ((f.type === "text" || f.type === "date") && !f.optional && String(st[f.id] ?? "").trim() === "") incomplete = true;
    }

    const visibleErrors = Object.keys(errors).filter((k) => vis.some((f) => f.id === k));
    if (incomplete || visibleErrors.length) return { fieldErrors: errors, result: null as FormulaResult | string | null };

    const v: FormulaValues = {
      num: (id) => nums[id] ?? null,
      raw: (id) => raws[id] ?? null,
      unit: (id) => String(st[`${id}:unit`] ?? ""),
      str: (id) => String(st[id] ?? ""),
      bool: (id) => st[id] === true,
      mode: String(st.__mode ?? ""),
    };
    let r: FormulaResult | string | null;
    try {
      r = spec.compute(v);
    } catch (e) {
      r = e instanceof Error ? e.message : "Could not calculate with these inputs.";
    }
    return { fieldErrors: errors, result: r };
  }, [deferred, spec]);

  const set = (id: string, val: string | boolean) => setState((s) => ({ ...s, [id]: val }));
  const reset = () => {
    setState(initialState(spec));
    setTouched({});
  };
  const loadExample = () => {
    if (!spec.example) return;
    setState((s) => ({ ...initialState(spec), __mode: s.__mode, ...spec.example }));
    setTouched({});
  };

  const resultText =
    result && typeof result !== "string"
      ? [
          ...result.outputs.map((o) => `${o.label}: ${o.value}`),
          ...(result.steps?.length ? ["", "Working:", ...result.steps] : []),
        ].join("\n")
      : "";

  const primary = result && typeof result !== "string" ? result.outputs.find((o) => o.primary) ?? result.outputs[0] : null;
  const secondary = result && typeof result !== "string" ? result.outputs.filter((o) => o !== primary) : [];

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
      <ToolPanel
        title="Inputs"
        actions={
          <>
            {spec.example && (
              <Btn variant="ghost" icon="spark" onClick={loadExample}>
                Load example
              </Btn>
            )}
            <ResetBtn onClick={reset} />
          </>
        }
      >
        {spec.lead && <div className="mb-5 text-sm text-ink-2">{spec.lead}</div>}
        {spec.modes && spec.modes.length > 1 && (
          <div className="mb-6">
            <Segmented
              label="Calculation mode"
              value={mode}
              onChange={(m) => set("__mode", m)}
              options={spec.modes.map((m) => ({ value: m.id, label: m.label }))}
            />
          </div>
        )}
        <div className="grid gap-5 sm:grid-cols-2">
          {visible.map((f) => (
            <FieldControl
              key={f.id}
              field={f}
              state={state}
              set={set}
              error={touched[f.id] || String(state[f.id] ?? "") !== "" ? fieldErrors[f.id] : undefined}
              onBlur={() => setTouched((t) => ({ ...t, [f.id]: true }))}
            />
          ))}
        </div>
      </ToolPanel>

      <ToolPanel title={spec.resultsTitle ?? "Result"} actions={resultText ? <CopyBtn text={resultText} label="Copy result" /> : undefined}>
        {result === null ? (
          <EmptyState icon="calculator" title="Fill in the inputs to see the result">
            {spec.example ? "Or load the example to see how it works." : "Results update as you type."}
          </EmptyState>
        ) : typeof result === "string" ? (
          <Notice tone="error">{result}</Notice>
        ) : (
          <div className="space-y-5">
            {primary && <ResultCard label={primary.label} value={primary.value} detail={primary.note} />}
            {secondary.length > 0 && <StatGrid items={secondary.map((o) => ({ label: o.label, value: o.value }))} />}
            {result.visual}
            {result.table && (
              <div className="overflow-x-auto rounded-xl shadow-[0_0_0_1px_var(--line)]">
                <table className="w-full text-left text-sm">
                  {result.table.caption && <caption className="px-4 pt-3 text-left text-[0.8125rem] text-muted">{result.table.caption}</caption>}
                  <thead>
                    <tr className="border-b border-line">
                      {result.table.columns.map((c) => (
                        <th key={c} scope="col" className="whitespace-nowrap px-4 py-2.5 font-medium text-ink">
                          {c}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {result.table.rows.map((r, i) => (
                      <tr key={i} className="border-b border-line last:border-0">
                        {r.map((c, j) => (
                          <td key={j} className="whitespace-nowrap px-4 py-2 tabular-nums text-ink-2">
                            {c}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {result.steps && result.steps.length > 0 && (
              <details className="rounded-xl bg-sunken p-4" open>
                <summary className="cursor-pointer text-sm font-medium text-ink">Show the working</summary>
                <ol className="mt-3 space-y-1.5 font-mono text-[0.8125rem] leading-relaxed text-ink-2">
                  {result.steps.map((s, i) => (
                    <li key={i} className="break-words">
                      {s}
                    </li>
                  ))}
                </ol>
              </details>
            )}
            {result.notes?.map((n, i) => (
              <Notice key={i} tone="info">
                {n}
              </Notice>
            ))}
          </div>
        )}
        <div className="mt-6">
          <PrivacyNote />
        </div>
      </ToolPanel>
    </div>
  );
}

function FieldControl({
  field: f,
  state,
  set,
  error,
  onBlur,
}: {
  field: FormulaField;
  state: State;
  set: (id: string, v: string | boolean) => void;
  error?: string;
  onBlur: () => void;
}) {
  const id = useId();
  const describedBy = [f.hint ? `${id}-hint` : null, error ? `${id}-err` : null].filter(Boolean).join(" ") || undefined;
  const wide = f.type === "text" && f.multiline;

  if (f.type === "checkbox") {
    return (
      <div className="sm:col-span-2">
        <Checkbox label={f.label} hint={f.hint} checked={state[f.id] === true} onChange={(v) => set(f.id, v)} />
      </div>
    );
  }

  return (
    <div className={wide ? "sm:col-span-2" : ""}>
      <label htmlFor={id} className="text-sm font-medium text-ink">
        {f.label}{" "}
        {"optional" in f && f.optional && <span className="font-normal text-muted">(optional)</span>}
      </label>
      {f.hint && (
        <p id={`${id}-hint`} className="mt-1 text-[0.8125rem] text-muted">
          {f.hint}
        </p>
      )}
      <div className="mt-2">
        {f.type === "number" && (
          <div className="flex gap-2">
            <div className="relative min-w-0 flex-1">
              <input
                id={id}
                inputMode="decimal"
                autoComplete="off"
                value={String(state[f.id] ?? "")}
                placeholder={f.placeholder}
                onChange={(e) => set(f.id, e.target.value)}
                onBlur={onBlur}
                aria-invalid={error ? true : undefined}
                aria-describedby={describedBy}
                className={`${inputCls} h-11 tabular-nums ${f.suffix ? "pr-12" : ""}`}
              />
              {f.suffix && (
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted">{f.suffix}</span>
              )}
            </div>
            {f.units && f.units.length > 0 && (
              <div className="relative w-[42%] max-w-[180px] shrink-0">
                <select
                  aria-label={`${f.label} unit`}
                  value={String(state[`${f.id}:unit`] ?? f.units[0].value)}
                  onChange={(e) => set(`${f.id}:unit`, e.target.value)}
                  className={`${inputCls} h-11 appearance-none pl-3 pr-8 text-[0.95rem]`}
                >
                  {f.units.map((u) => (
                    <option key={u.value} value={u.value}>
                      {u.label}
                    </option>
                  ))}
                </select>
                <Icon name="chevron" size={16} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted" />
              </div>
            )}
          </div>
        )}
        {f.type === "select" && (
          <div className="relative">
            <select
              id={id}
              value={String(state[f.id] ?? "")}
              onChange={(e) => set(f.id, e.target.value)}
              aria-describedby={describedBy}
              className={`${inputCls} h-11 appearance-none pr-10`}
            >
              {f.options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <Icon name="chevron" size={18} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted" />
          </div>
        )}
        {f.type === "text" &&
          (f.multiline ? (
            <textarea
              id={id}
              value={String(state[f.id] ?? "")}
              placeholder={f.placeholder}
              onChange={(e) => set(f.id, e.target.value)}
              onBlur={onBlur}
              spellCheck={f.mono ? false : undefined}
              aria-describedby={describedBy}
              className={`${inputCls} min-h-[120px] resize-y py-3 ${f.mono ? "font-mono text-[0.875rem]" : ""}`}
            />
          ) : (
            <input
              id={id}
              value={String(state[f.id] ?? "")}
              placeholder={f.placeholder}
              onChange={(e) => set(f.id, e.target.value)}
              onBlur={onBlur}
              spellCheck={f.mono ? false : undefined}
              aria-describedby={describedBy}
              className={`${inputCls} h-11 ${f.mono ? "font-mono text-[0.9rem]" : ""}`}
            />
          ))}
        {f.type === "date" && (
          <input
            id={id}
            type={f.withTime ? "datetime-local" : "date"}
            value={String(state[f.id] ?? "")}
            onChange={(e) => set(f.id, e.target.value)}
            onBlur={onBlur}
            aria-describedby={describedBy}
            className={`${inputCls} h-11`}
          />
        )}
      </div>
      {error && (
        <p id={`${id}-err`} role="alert" className="mt-2 flex items-start gap-1.5 text-sm text-danger">
          <span aria-hidden="true" className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-danger" />
          {error}
        </p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Number formatting helpers for compute functions                     */
/* ------------------------------------------------------------------ */

/** Up to `sig` significant digits, no float noise, thousands separators for |n| ≥ 1000. */
export function num(n: number, sig = 10): string {
  if (!Number.isFinite(n)) return n > 0 ? "∞" : n < 0 ? "−∞" : "undefined";
  if (n === 0) return "0";
  const abs = Math.abs(n);
  if (abs >= 1e15 || abs < 1e-6) return n.toExponential(Math.min(sig, 8) - 1).replace(/\.?0+e/, "e");
  const p = Number(n.toPrecision(sig));
  return p.toLocaleString("en-US", { maximumFractionDigits: 12 });
}

/** Fixed decimals with separators, e.g. money(1234.5) → "1,234.50". */
export function fixed(n: number, digits = 2): string {
  return (Math.round((n + Number.EPSILON * Math.sign(n)) * 10 ** digits) / 10 ** digits).toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

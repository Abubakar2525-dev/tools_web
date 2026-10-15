"use client";

/**
 * Unit converter engine. Each unit maps to a shared base unit either by a
 * linear factor (value_in_base = value * factor) or explicit functions for
 * non-linear scales (temperature, fuel economy).
 */

import { useDeferredValue, useId, useMemo, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { CopyBtn, EmptyState, Notice, PrivacyNote, ResetBtn, ToolPanel, inputCls, parseNum } from "../kit";
import { num } from "./FormulaTool";

export type ConvUnit = {
  id: string;
  label: string;
  symbol: string;
  /** Linear factor to the base unit, or a function for non-linear scales. */
  toBase: number | ((v: number) => number);
  /** Required when toBase is a function. */
  fromBase?: (b: number) => number;
  /** Optional optgroup label. */
  group?: string;
};

function toBase(u: ConvUnit, v: number) {
  return typeof u.toBase === "number" ? v * u.toBase : u.toBase(v);
}
function fromBase(u: ConvUnit, b: number) {
  if (typeof u.toBase === "number") return b / u.toBase;
  if (!u.fromBase) throw new Error(`Unit ${u.id} needs fromBase`);
  return u.fromBase(b);
}

export function convert(units: ConvUnit[], value: number, from: string, to: string) {
  const f = units.find((u) => u.id === from);
  const t = units.find((u) => u.id === to);
  if (!f || !t) return NaN;
  return fromBase(t, toBase(f, value));
}

export function UnitConverterTool({
  units,
  defaultFrom,
  defaultTo,
  defaultValue = "1",
  sig = 10,
  allowNegative = false,
  footnote,
  extra,
}: {
  units: ConvUnit[];
  defaultFrom: string;
  defaultTo: string;
  defaultValue?: string;
  /** Significant digits shown. */
  sig?: number;
  /** e.g. temperatures. */
  allowNegative?: boolean;
  footnote?: React.ReactNode;
  /** Extra content under the converter (reference chart etc.). */
  extra?: React.ReactNode;
}) {
  const [value, setValue] = useState(defaultValue);
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);
  const v = useDeferredValue(value);
  const valueId = useId();
  const n = parseNum(v);
  const invalid = v.trim() !== "" && n === null;
  const negativeErr = n !== null && n < 0 && !allowNegative;

  const result = useMemo(() => (n === null || negativeErr ? null : convert(units, n, from, to)), [n, negativeErr, units, from, to]);
  const fromU = units.find((u) => u.id === from)!;
  const toU = units.find((u) => u.id === to)!;
  const oneLinear = typeof fromU.toBase === "number" && typeof toU.toBase === "number";

  const groups = useMemo(() => {
    const m = new Map<string, ConvUnit[]>();
    units.forEach((u) => m.set(u.group ?? "", [...(m.get(u.group ?? "") ?? []), u]));
    return [...m.entries()];
  }, [units]);

  const options = groups.map(([g, us]) =>
    g ? (
      <optgroup key={g} label={g}>
        {us.map((u) => (
          <option key={u.id} value={u.id}>
            {u.label} ({u.symbol})
          </option>
        ))}
      </optgroup>
    ) : (
      us.map((u) => (
        <option key={u.id} value={u.id}>
          {u.label} ({u.symbol})
        </option>
      ))
    ),
  );

  const resultText = result !== null && Number.isFinite(result) ? `${num(n!, sig)} ${fromU.symbol} = ${num(result, sig)} ${toU.symbol}` : "";

  return (
    <div className="space-y-5">
      <ToolPanel
        title="Convert"
        actions={
          <>
            {resultText && <CopyBtn text={resultText} label="Copy result" />}
            <ResetBtn
              onClick={() => {
                setValue(defaultValue);
                setFrom(defaultFrom);
                setTo(defaultTo);
              }}
            />
          </>
        }
      >
        <div className="grid items-end gap-4 md:grid-cols-[1fr_1fr_auto_1fr]">
          <div>
            <label htmlFor={valueId} className="text-sm font-medium">
              Value
            </label>
            <input
              id={valueId}
              inputMode="decimal"
              autoComplete="off"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              aria-invalid={invalid || negativeErr ? true : undefined}
              className={`${inputCls} mt-2 h-12 text-lg tabular-nums`}
            />
          </div>
          <UnitSelect label="From" value={from} onChange={setFrom}>
            {options}
          </UnitSelect>
          <button
            type="button"
            onClick={() => {
              setFrom(to);
              setTo(from);
            }}
            className="mx-auto grid h-12 w-12 place-items-center rounded-full text-ink-2 shadow-[inset_0_0_0_1px_var(--line-strong)] transition-colors hover:bg-sunken hover:text-ink"
          >
            <Icon name="swap" size={20} />
            <span className="sr-only">Swap units</span>
          </button>
          <UnitSelect label="To" value={to} onChange={setTo}>
            {options}
          </UnitSelect>
        </div>

        <div className="mt-6" aria-live="polite">
          {invalid ? (
            <Notice tone="error">Enter a number, for example 12.5.</Notice>
          ) : negativeErr ? (
            <Notice tone="error">This quantity cannot be negative.</Notice>
          ) : result === null ? (
            <EmptyState icon="swap" title="Type a value to convert" />
          ) : !Number.isFinite(result) ? (
            <Notice tone="error">That value has no equivalent in the target unit.</Notice>
          ) : (
            <div className="rounded-xl bg-accent-soft p-5">
              <p className="text-sm text-ink-2">
                {num(n!, sig)} {fromU.label.toLowerCase()} equals
              </p>
              <p className="mt-1 break-all font-display text-[2.25rem] font-semibold leading-tight tracking-[-0.03em] tabular-nums">
                {num(result, sig)} <span className="text-[1.25rem] text-ink-2">{toU.symbol}</span>
              </p>
              {oneLinear && from !== to && (
                <p className="mt-2 text-sm text-ink-2">
                  1 {fromU.symbol} = {num(convert(units, 1, from, to), sig)} {toU.symbol}
                </p>
              )}
            </div>
          )}
        </div>
      </ToolPanel>

      {n !== null && !invalid && !negativeErr && (
        <ToolPanel title={`${num(n, sig)} ${fromU.symbol} in every unit`}>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-line">
                  <th scope="col" className="px-3 py-2 font-medium">
                    Unit
                  </th>
                  <th scope="col" className="px-3 py-2 font-medium">
                    Value
                  </th>
                </tr>
              </thead>
              <tbody>
                {units.map((u) => {
                  const r = convert(units, n, from, u.id);
                  return (
                    <tr key={u.id} className={`border-b border-line last:border-0 ${u.id === to ? "bg-accent-soft/60" : ""}`}>
                      <td className="px-3 py-2 text-ink-2">
                        {u.label} <span className="text-muted">({u.symbol})</span>
                      </td>
                      <td className="px-3 py-2 tabular-nums text-ink">{Number.isFinite(r) ? num(r, sig) : "n/a"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </ToolPanel>
      )}

      {extra}
      {footnote && <p className="text-sm text-muted">{footnote}</p>}
      <PrivacyNote />
    </div>
  );
}

function UnitSelect({ label, value, onChange, children }: { label: string; value: string; onChange: (v: string) => void; children: React.ReactNode }) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <div className="relative mt-2">
        <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className={`${inputCls} h-12 appearance-none pr-10`}>
          {children}
        </select>
        <Icon name="chevron" size={18} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted" />
      </div>
    </div>
  );
}

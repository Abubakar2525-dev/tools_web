"use client";

import { useState } from "react";
import {
  Btn,
  CellInput,
  CopyBtn,
  EmptyState,
  Notice,
  PrivacyNote,
  ResetBtn,
  ResultCard,
  Segmented,
  SelectField,
  StatGrid,
  ToolPanel,
  parseNum,
  uid,
} from "@/components/tools/kit";
import { CURRENCY_OPTIONS, money, pct } from "./lib/money";
import { addTax, removeTax } from "./lib/simple";

type Mode = "add" | "remove";
type Line = { id: string; label: string; amount: string; rate: string };

const PRESETS = [5, 7.5, 10, 12, 15, 18, 20, 21, 23];

const fresh = (): Line[] => [{ id: uid(), label: "", amount: "100", rate: "20" }];

export default function Tool() {
  const [mode, setMode] = useState<Mode>("add");
  const [currency, setCurrency] = useState("USD");
  const [lines, setLines] = useState<Line[]>(fresh);

  const m = (n: number) => money(n, currency);
  const update = (id: string, patch: Partial<Line>) => setLines((ls) => ls.map((l) => (l.id === id ? { ...l, ...patch } : l)));

  const parsed = lines.map((l) => {
    const amount = parseNum(l.amount);
    const rate = parseNum(l.rate);
    const amountErr = l.amount.trim() !== "" && (amount === null || amount < 0);
    const rateErr = l.rate.trim() !== "" && (rate === null || rate < 0 || rate > 100);
    const ok = amount !== null && rate !== null && !amountErr && !rateErr;
    const r = ok ? (mode === "add" ? addTax(amount, rate) : removeTax(amount, rate)) : null;
    return { ...l, amountErr, rateErr, r, rateNum: rate };
  });
  const valid = parsed.filter((p) => p.r);
  const totals = valid.reduce((a, p) => ({ net: a.net + (p.r?.net ?? 0), tax: a.tax + (p.r?.tax ?? 0), gross: a.gross + (p.r?.gross ?? 0) }), { net: 0, tax: 0, gross: 0 });
  const byRate = new Map<number, { net: number; tax: number; gross: number }>();
  for (const p of valid) {
    const k = p.rateNum as number;
    const cur = byRate.get(k) ?? { net: 0, tax: 0, gross: 0 };
    byRate.set(k, { net: cur.net + (p.r?.net ?? 0), tax: cur.tax + (p.r?.tax ?? 0), gross: cur.gross + (p.r?.gross ?? 0) });
  }
  const rateRows = [...byRate.entries()].sort((a, b) => a[0] - b[0]);
  const summary = [
    `Net: ${m(totals.net)}`,
    `Tax: ${m(totals.tax)}`,
    `Gross: ${m(totals.gross)}`,
    ...rateRows.map(([r, t]) => `${r}%: net ${m(t.net)}, tax ${m(t.tax)}, gross ${m(t.gross)}`),
  ].join("\n");

  return (
    <div className="grid gap-5 lg:grid-cols-[1.15fr_1fr]">
      <ToolPanel
        title="Amounts"
        actions={
          <ResetBtn
            onClick={() => {
              setLines(fresh());
              setMode("add");
            }}
          />
        }
      >
        <div className="flex flex-wrap items-end gap-4">
          <Segmented
            label="Calculation"
            value={mode}
            onChange={setMode}
            options={[
              { value: "add", label: "Add tax to net" },
              { value: "remove", label: "Remove tax from gross" },
            ]}
          />
          <SelectField label="Currency" className="min-w-[200px] flex-1" value={currency} onChange={(e) => setCurrency(e.target.value)} options={CURRENCY_OPTIONS} />
        </div>
        <p className="mt-4 text-sm text-ink-2">
          {mode === "add" ? "Enter prices before tax (net)." : "Enter prices that already include tax (gross)."} Use one line per item or per tax rate.
        </p>
        <ul className="mt-4 space-y-3">
          {parsed.map((l, i) => (
            <li key={l.id} className="grid grid-cols-[1fr_1fr] gap-2 rounded-xl bg-sunken p-3 sm:grid-cols-[1.3fr_1fr_0.8fr_auto] sm:items-center">
              <CellInput label={`Line ${i + 1} description`} placeholder={`Item ${i + 1}`} value={l.label} onChange={(e) => update(l.id, { label: e.target.value })} className="col-span-2 sm:col-span-1" />
              <CellInput label={`Line ${i + 1} amount`} inputMode="decimal" placeholder="Amount" value={l.amount} invalid={l.amountErr} onChange={(e) => update(l.id, { amount: e.target.value })} />
              <div className="relative">
                <CellInput label={`Line ${i + 1} tax rate percent`} inputMode="decimal" placeholder="Rate" value={l.rate} invalid={l.rateErr} onChange={(e) => update(l.id, { rate: e.target.value })} className="pr-7" />
                <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-sm text-muted">%</span>
              </div>
              <Btn variant="subtle" icon="trash" aria-label={`Remove line ${i + 1}`} disabled={lines.length === 1} onClick={() => setLines((ls) => ls.filter((x) => x.id !== l.id))} className="col-span-2 sm:col-span-1">
                <span className="sm:sr-only">Remove</span>
              </Btn>
              {(l.amountErr || l.rateErr) && (
                <p className="col-span-2 text-sm text-danger sm:col-span-4" role="alert">
                  {l.amountErr ? "Enter a valid amount of 0 or more. " : ""}
                  {l.rateErr ? "Rate must be between 0 and 100." : ""}
                </p>
              )}
            </li>
          ))}
        </ul>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Btn variant="ghost" icon="plus" onClick={() => setLines((ls) => [...ls, { id: uid(), label: "", amount: "", rate: ls[ls.length - 1]?.rate ?? "20" }])}>
            Add line
          </Btn>
        </div>
        <div className="mt-5">
          <p className="text-sm font-medium text-ink">Set every line to a common rate</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {PRESETS.map((r) => (
              <Btn key={r} variant="subtle" onClick={() => setLines((ls) => ls.map((l) => ({ ...l, rate: String(r) })))}>
                {r}%
              </Btn>
            ))}
          </div>
          <p className="mt-2 text-[0.8125rem] text-muted">Rates change; check the current rate with your tax authority.</p>
        </div>
      </ToolPanel>

      <ToolPanel title="Result" actions={valid.length ? <CopyBtn text={summary} label="Copy result" /> : undefined}>
        {valid.length === 0 ? (
          <EmptyState icon="calculator" title="Enter an amount and a tax rate">
            Results update as you type.
          </EmptyState>
        ) : (
          <div className="space-y-5">
            <ResultCard label={mode === "add" ? "Total including tax (gross)" : "Total before tax (net)"} value={m(mode === "add" ? totals.gross : totals.net)} detail={`Tax: ${m(totals.tax)}`} />
            <StatGrid
              items={[
                { label: "Net", value: m(totals.net) },
                { label: "Tax", value: m(totals.tax) },
                { label: "Gross", value: m(totals.gross) },
              ]}
            />
            {rateRows.length > 0 && (
              <div className="overflow-x-auto rounded-xl shadow-[0_0_0_1px_var(--line)]">
                <table className="w-full text-left text-sm">
                  <caption className="px-4 pt-3 text-left text-[0.8125rem] text-muted">Breakdown by rate</caption>
                  <thead>
                    <tr className="border-b border-line">
                      {["Rate", "Net", "Tax", "Gross"].map((c) => (
                        <th key={c} scope="col" className="whitespace-nowrap px-4 py-2.5 font-medium text-ink">
                          {c}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rateRows.map(([r, t]) => (
                      <tr key={r} className="border-b border-line last:border-0">
                        <td className="px-4 py-2 tabular-nums text-ink-2">{pct(r, 3)}</td>
                        <td className="px-4 py-2 tabular-nums text-ink-2">{m(t.net)}</td>
                        <td className="px-4 py-2 tabular-nums text-ink-2">{m(t.tax)}</td>
                        <td className="px-4 py-2 tabular-nums text-ink-2">{m(t.gross)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <details className="rounded-xl bg-sunken p-4">
              <summary className="cursor-pointer text-sm font-medium text-ink">Show the formula</summary>
              <p className="mt-2 font-mono text-[0.8125rem] text-ink-2">
                {mode === "add" ? "tax = net × rate; gross = net + tax" : "net = gross ÷ (1 + rate); tax = gross − net"}
              </p>
            </details>
            {mode === "remove" && (
              <Notice>Removing 20% tax from a gross price is not the same as taking 20% off: divide by 1.20 instead.</Notice>
            )}
          </div>
        )}
        <div className="mt-6">
          <PrivacyNote />
        </div>
      </ToolPanel>
    </div>
  );
}

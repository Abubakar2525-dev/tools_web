"use client";

import { useState } from "react";
import {
  Btn,
  EmptyState,
  NumberField,
  PrivacyNote,
  ResetBtn,
  ResultCard,
  SelectField,
  StatGrid,
  TextField,
  ToolPanel,
  downloadFile,
  parseNum,
  uid,
  usePersistentState,
} from "@/components/tools/kit";
import { CURRENCY_OPTIONS, money, round, toCsv } from "./lib/money";
import { HBars, ScrollTable } from "./ui";

type Entry = { id: string; date: string; description: string; category: string; amount: number };
type State = { currency: string; entries: Entry[] };

const CATEGORIES = ["Groceries", "Housing", "Utilities", "Transport", "Eating out", "Health", "Shopping", "Entertainment", "Travel", "Education", "Bills and fees", "Other"];

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const monthLabel = (ym: string) => {
  const [y, mo] = ym.split("-").map(Number);
  return new Date(y, mo - 1, 1).toLocaleDateString("en-US", { month: "short", year: "numeric" });
};

export default function Tool() {
  const [state, setState, clear] = usePersistentState<State>("expense-tracker", { currency: "USD", entries: [] });
  const [draft, setDraft] = useState({ date: "", description: "", category: "Groceries", amount: "" });
  const [errors, setErrors] = useState<{ amount?: string; date?: string }>({});
  const [month, setMonth] = useState("all");
  const [cat, setCat] = useState("all");
  const m = (n: number) => money(n, state.currency);

  const add = () => {
    const amount = parseNum(draft.amount);
    const date = draft.date || today();
    const e: typeof errors = {};
    if (amount === null || amount <= 0) e.amount = "Enter an amount greater than 0.";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) e.date = "Pick a valid date.";
    setErrors(e);
    if (Object.keys(e).length) return;
    setState((s) => ({ ...s, entries: [...s.entries, { id: uid(), date, description: draft.description.trim(), category: draft.category, amount: amount as number }] }));
    setDraft((d) => ({ ...d, description: "", amount: "" }));
  };

  const months = [...new Set(state.entries.map((e) => e.date.slice(0, 7)))].sort().reverse();
  const filtered = state.entries
    .filter((e) => (month === "all" || e.date.startsWith(month)) && (cat === "all" || e.category === cat))
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  const total = filtered.reduce((a, e) => a + e.amount, 0);
  const byCat = new Map<string, number>();
  for (const e of filtered) byCat.set(e.category, (byCat.get(e.category) ?? 0) + e.amount);
  const monthly = months.map((ym) => {
    const list = state.entries.filter((e) => e.date.startsWith(ym) && (cat === "all" || e.category === cat));
    return [monthLabel(ym), list.length, list.reduce((a, e) => a + e.amount, 0)] as [string, number, number];
  });

  const exportCsv = () =>
    downloadFile(
      "expenses.csv",
      toCsv([["Date", "Description", "Category", "Amount", "Currency"], ...filtered.map((e) => [e.date, e.description, e.category, round(e.amount, 2), state.currency])]),
      "text/csv",
    );

  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-[1fr_1.2fr]">
        <ToolPanel title="Add an expense">
          <form
            className="grid gap-4 sm:grid-cols-2"
            onSubmit={(ev) => {
              ev.preventDefault();
              add();
            }}
          >
            <NumberField label="Amount" value={draft.amount} error={errors.amount} onChange={(e) => setDraft((d) => ({ ...d, amount: e.target.value }))} placeholder="12.50" />
            <TextField label="Date" type="date" hint="Leave empty for today." value={draft.date} error={errors.date} onChange={(e) => setDraft((d) => ({ ...d, date: e.target.value }))} />
            <SelectField label="Category" value={draft.category} onChange={(e) => setDraft((d) => ({ ...d, category: e.target.value }))} options={CATEGORIES} />
            <TextField label="Description" optional value={draft.description} maxLength={120} onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))} placeholder="Weekly shop" />
            <div className="flex flex-wrap gap-2 sm:col-span-2">
              <button type="submit" className="btn btn-sm">
                Add expense
              </button>
            </div>
          </form>
          <SelectField label="Currency" className="mt-5 max-w-xs" value={state.currency} onChange={(e) => setState((s) => ({ ...s, currency: e.target.value }))} options={CURRENCY_OPTIONS} />
        </ToolPanel>

        <ToolPanel
          title="Summary"
          actions={
            <>
              <Btn variant="ghost" icon="download" onClick={exportCsv} disabled={!filtered.length}>
                Export CSV
              </Btn>
              <ResetBtn
                label="Delete all"
                onClick={() => {
                  if (state.entries.length === 0 || window.confirm(`Delete all ${state.entries.length} expenses from this browser?`)) clear();
                }}
              />
            </>
          }
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField label="Month" value={month} onChange={(e) => setMonth(e.target.value)} options={[{ value: "all", label: "All months" }, ...months.map((ym) => ({ value: ym, label: monthLabel(ym) }))]} />
            <SelectField label="Category" value={cat} onChange={(e) => setCat(e.target.value)} options={[{ value: "all", label: "All categories" }, ...CATEGORIES]} />
          </div>
          <div className="mt-5 space-y-4">
            <ResultCard label={month === "all" ? "Total spent" : `Spent in ${monthLabel(month)}`} value={m(total)} detail={`${filtered.length} ${filtered.length === 1 ? "expense" : "expenses"}`} />
            {byCat.size > 0 && (
              <HBars title="By category" items={[...byCat.entries()].sort((a, b) => b[1] - a[1]).map(([label, value]) => ({ label, value }))} format={m} />
            )}
            {monthly.length > 1 && (
              <StatGrid items={monthly.slice(0, 6).map(([label, , value]) => ({ label, value: m(value) }))} />
            )}
          </div>
        </ToolPanel>
      </div>

      <ToolPanel title="Expenses">
        {filtered.length === 0 ? (
          <EmptyState icon="list" title={state.entries.length ? "No expenses match these filters" : "No expenses yet"}>
            {state.entries.length ? "Change the month or category filter." : "Add your first expense above. It stays in this browser."}
          </EmptyState>
        ) : (
          <div className="overflow-auto rounded-xl shadow-[0_0_0_1px_var(--line)]" style={{ maxHeight: 460 }} tabIndex={0} role="region" aria-label="Expenses list">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">Expenses</caption>
              <thead className="sticky top-0 bg-surface">
                <tr className="shadow-[inset_0_-1px_0_var(--line)]">
                  {["Date", "Description", "Category", "Amount", ""].map((c, i) => (
                    <th key={i} scope="col" className="whitespace-nowrap px-3 py-2.5 font-medium text-ink">
                      {c || <span className="sr-only">Actions</span>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((e) => (
                  <tr key={e.id} className="border-b border-line last:border-0">
                    <td className="whitespace-nowrap px-3 py-1.5 tabular-nums text-ink-2">{e.date}</td>
                    <td className="px-3 py-1.5 text-ink">{e.description || <span className="text-muted">None</span>}</td>
                    <td className="whitespace-nowrap px-3 py-1.5 text-ink-2">{e.category}</td>
                    <td className="whitespace-nowrap px-3 py-1.5 tabular-nums text-ink">{m(e.amount)}</td>
                    <td className="px-1 py-1">
                      <Btn variant="subtle" icon="trash" aria-label={`Delete ${e.description || e.category} on ${e.date}`} onClick={() => setState((s) => ({ ...s, entries: s.entries.filter((x) => x.id !== e.id) }))} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {monthly.length > 0 && (
          <div className="mt-5">
            <ScrollTable
              caption={cat === "all" ? "Monthly totals" : `Monthly totals: ${cat}`}
              columns={["Month", "Expenses", "Total"]}
              rows={monthly.map(([l, n, v]) => [l, n, m(v)])}
              csvRows={monthly.map(([l, n, v]) => [l, n, round(v, 2)])}
              csvName="monthly-totals.csv"
              maxHeight={300}
            />
          </div>
        )}
      </ToolPanel>
      <PrivacyNote stored />
    </div>
  );
}

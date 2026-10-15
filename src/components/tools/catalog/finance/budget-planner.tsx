"use client";

import {
  Btn,
  CellInput,
  CellSelect,
  Notice,
  PrivacyNote,
  ResetBtn,
  ResultCard,
  SelectField,
  StatGrid,
  ToolPanel,
  downloadFile,
  parseNum,
  uid,
  usePersistentState,
} from "@/components/tools/kit";
import { CURRENCY_OPTIONS, money, pct, round, toCsv } from "./lib/money";
import { HBars } from "./ui";

type Bucket = "needs" | "wants" | "savings";
type Income = { id: string; name: string; amount: string };
type Expense = { id: string; name: string; amount: string; bucket: Bucket };
type State = { currency: string; income: Income[]; expenses: Expense[] };

const BUCKETS: { value: Bucket; label: string; target: number }[] = [
  { value: "needs", label: "Needs", target: 50 },
  { value: "wants", label: "Wants", target: 30 },
  { value: "savings", label: "Savings and debt payoff", target: 20 },
];

const INITIAL: State = {
  currency: "USD",
  income: [{ id: "i1", name: "Take-home pay", amount: "" }],
  expenses: [
    { id: "e1", name: "Rent or mortgage", amount: "", bucket: "needs" },
    { id: "e2", name: "Groceries", amount: "", bucket: "needs" },
    { id: "e3", name: "Utilities and phone", amount: "", bucket: "needs" },
    { id: "e4", name: "Transport", amount: "", bucket: "needs" },
    { id: "e5", name: "Eating out and fun", amount: "", bucket: "wants" },
    { id: "e6", name: "Emergency fund", amount: "", bucket: "savings" },
  ],
};

const bad = (s: string) => s.trim() !== "" && (parseNum(s) === null || (parseNum(s) as number) < 0);
const amt = (s: string) => (bad(s) ? 0 : parseNum(s) ?? 0);

export default function Tool() {
  const [state, setState, clear] = usePersistentState<State>("budget-planner", INITIAL);
  const m = (n: number) => money(n, state.currency);
  const income = state.income.reduce((a, r) => a + amt(r.amount), 0);
  const spent = state.expenses.reduce((a, r) => a + amt(r.amount), 0);
  const left = income - spent;
  const byBucket = BUCKETS.map((b) => ({ ...b, value: state.expenses.filter((e) => e.bucket === b.value).reduce((a, r) => a + amt(r.amount), 0) }));

  const setIncome = (id: string, patch: Partial<Income>) => setState((s) => ({ ...s, income: s.income.map((r) => (r.id === id ? { ...r, ...patch } : r)) }));
  const setExpense = (id: string, patch: Partial<Expense>) => setState((s) => ({ ...s, expenses: s.expenses.map((r) => (r.id === id ? { ...r, ...patch } : r)) }));

  const exportCsv = () => {
    const rows: (string | number)[][] = [["Type", "Name", "Group", "Monthly amount"]];
    for (const r of state.income) rows.push(["Income", r.name, "", round(amt(r.amount), 2)]);
    for (const r of state.expenses) rows.push(["Expense", r.name, BUCKETS.find((b) => b.value === r.bucket)?.label ?? "", round(amt(r.amount), 2)]);
    rows.push(["Total", "Income", "", round(income, 2)], ["Total", "Expenses", "", round(spent, 2)], ["Total", "Left over", "", round(left, 2)]);
    downloadFile("budget.csv", toCsv(rows), "text/csv");
  };

  return (
    <div className="space-y-5">
      <ToolPanel
        title="Monthly budget"
        actions={
          <>
            <Btn variant="ghost" icon="download" onClick={exportCsv}>
              Export CSV
            </Btn>
            <ResetBtn onClick={clear} label="Clear all" />
          </>
        }
      >
        <div className="grid gap-5 lg:grid-cols-[1fr_1.2fr]">
          <div className="space-y-4">
            <ResultCard
              label={left >= 0 ? "Left over each month" : "Over budget each month"}
              value={m(Math.abs(left))}
              detail={income > 0 ? `${pct((spent / income) * 100, 1)} of income is planned.` : "Add your income to start."}
            />
            <StatGrid
              items={[
                { label: "Income", value: m(income) },
                { label: "Planned spending", value: m(spent) },
                { label: "Per year left over", value: m(left * 12) },
              ]}
            />
            <SelectField label="Currency" value={state.currency} onChange={(e) => setState((s) => ({ ...s, currency: e.target.value }))} options={CURRENCY_OPTIONS} />
          </div>
          <div className="space-y-3">
            {income > 0 ? (
              <HBars
                title="Your plan against the 50/30/20 guideline"
                items={byBucket.map((b) => ({ label: `${b.label} (${b.target}%)`, value: b.value, target: (income * b.target) / 100, note: pct((b.value / income) * 100, 0) }))}
                format={m}
              />
            ) : (
              <Notice>Enter your monthly take-home income to compare your plan with the 50/30/20 guideline.</Notice>
            )}
            <p className="text-[0.8125rem] text-muted">
              The 50/30/20 rule is a starting point: half of after-tax income to needs, 30% to wants, 20% to savings and extra debt payments. The black tick marks each target; bars past the target turn red.
            </p>
          </div>
        </div>
      </ToolPanel>

      <div className="grid gap-5 lg:grid-cols-[1fr_1.4fr]">
        <ToolPanel title="Income (monthly, after tax)">
          <ul className="space-y-3">
            {state.income.map((r, i) => (
              <li key={r.id} className="grid grid-cols-[1fr_1fr_auto] items-center gap-2">
                <CellInput label={`Income ${i + 1} name`} value={r.name} placeholder="Source" onChange={(e) => setIncome(r.id, { name: e.target.value })} />
                <CellInput label={`Income ${i + 1} amount`} inputMode="decimal" placeholder="0" value={r.amount} invalid={bad(r.amount)} onChange={(e) => setIncome(r.id, { amount: e.target.value })} />
                <Btn variant="subtle" icon="trash" aria-label={`Remove income ${i + 1}`} onClick={() => setState((s) => ({ ...s, income: s.income.filter((x) => x.id !== r.id) }))} />
              </li>
            ))}
          </ul>
          <Btn variant="ghost" icon="plus" className="mt-4" onClick={() => setState((s) => ({ ...s, income: [...s.income, { id: uid(), name: "", amount: "" }] }))}>
            Add income
          </Btn>
        </ToolPanel>
        <ToolPanel title="Expenses (monthly)">
          <ul className="space-y-3">
            {state.expenses.map((r, i) => (
              <li key={r.id} className="grid grid-cols-2 gap-2 rounded-xl bg-sunken p-3 sm:grid-cols-[1.3fr_1fr_1fr_auto] sm:items-center">
                <CellInput label={`Expense ${i + 1} name`} value={r.name} placeholder="Expense" onChange={(e) => setExpense(r.id, { name: e.target.value })} className="col-span-2 sm:col-span-1" />
                <CellSelect label={`Expense ${i + 1} group`} value={r.bucket} options={BUCKETS.map((b) => ({ value: b.value, label: b.label }))} onChange={(e) => setExpense(r.id, { bucket: e.target.value as Bucket })} />
                <CellInput label={`Expense ${i + 1} amount`} inputMode="decimal" placeholder="0" value={r.amount} invalid={bad(r.amount)} onChange={(e) => setExpense(r.id, { amount: e.target.value })} />
                <Btn variant="subtle" icon="trash" aria-label={`Remove expense ${i + 1}`} onClick={() => setState((s) => ({ ...s, expenses: s.expenses.filter((x) => x.id !== r.id) }))} className="col-span-2 sm:col-span-1">
                  <span className="sm:sr-only">Remove</span>
                </Btn>
              </li>
            ))}
          </ul>
          {state.expenses.some((r) => bad(r.amount)) || state.income.some((r) => bad(r.amount)) ? (
            <p role="alert" className="mt-3 text-sm text-danger">
              Some amounts are not valid numbers and are left out of the totals.
            </p>
          ) : null}
          <Btn variant="ghost" icon="plus" className="mt-4" onClick={() => setState((s) => ({ ...s, expenses: [...s.expenses, { id: uid(), name: "", amount: "", bucket: "needs" }] }))}>
            Add expense
          </Btn>
        </ToolPanel>
      </div>
      <PrivacyNote stored />
    </div>
  );
}

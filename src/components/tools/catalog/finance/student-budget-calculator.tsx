"use client";

import {
  Btn,
  CellInput,
  CellSelect,
  NumberField,
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
import { CURRENCY_OPTIONS, money, round, toCsv } from "./lib/money";
import { HBars } from "./ui";

type Freq = "year" | "term" | "month" | "week";
type Line = { id: string; name: string; amount: string; freq: Freq };
type State = { currency: string; weeks: string; months: string; terms: string; income: Line[]; costs: Line[] };

const FREQS: { value: Freq; label: string }[] = [
  { value: "year", label: "Per academic year" },
  { value: "term", label: "Per term" },
  { value: "month", label: "Per month" },
  { value: "week", label: "Per week" },
];

const INITIAL: State = {
  currency: "GBP",
  weeks: "39",
  months: "9",
  terms: "3",
  income: [
    { id: "i1", name: "Maintenance loan", amount: "", freq: "year" },
    { id: "i2", name: "Grant or bursary", amount: "", freq: "year" },
    { id: "i3", name: "Part-time job", amount: "", freq: "week" },
    { id: "i4", name: "Family support", amount: "", freq: "month" },
  ],
  costs: [
    { id: "c1", name: "Rent", amount: "", freq: "week" },
    { id: "c2", name: "Bills and phone", amount: "", freq: "month" },
    { id: "c3", name: "Travel", amount: "", freq: "month" },
    { id: "c4", name: "Course materials", amount: "", freq: "year" },
  ],
};

const bad = (s: string) => s.trim() !== "" && (parseNum(s) === null || (parseNum(s) as number) < 0);

function LineList({ title, kind, lines, onChange }: { title: string; kind: string; lines: Line[]; onChange: (l: Line[]) => void }) {
  return (
    <ToolPanel title={title}>
      <ul className="space-y-3">
        {lines.map((l, i) => (
          <li key={l.id} className="grid grid-cols-2 gap-2 rounded-xl bg-sunken p-3 sm:grid-cols-[1.3fr_0.9fr_1.1fr_auto] sm:items-center">
            <CellInput label={`${kind} ${i + 1} name`} value={l.name} placeholder="Name" onChange={(e) => onChange(lines.map((x) => (x.id === l.id ? { ...x, name: e.target.value } : x)))} className="col-span-2 sm:col-span-1" />
            <CellInput label={`${kind} ${i + 1} amount`} inputMode="decimal" value={l.amount} placeholder="0" invalid={bad(l.amount)} onChange={(e) => onChange(lines.map((x) => (x.id === l.id ? { ...x, amount: e.target.value } : x)))} />
            <CellSelect label={`${kind} ${i + 1} frequency`} value={l.freq} options={FREQS} onChange={(e) => onChange(lines.map((x) => (x.id === l.id ? { ...x, freq: e.target.value as Freq } : x)))} />
            <Btn variant="subtle" icon="trash" aria-label={`Remove ${kind} ${i + 1}`} onClick={() => onChange(lines.filter((x) => x.id !== l.id))} className="col-span-2 sm:col-span-1">
              <span className="sm:sr-only">Remove</span>
            </Btn>
          </li>
        ))}
      </ul>
      {lines.some((l) => bad(l.amount)) && (
        <p role="alert" className="mt-3 text-sm text-danger">
          Some amounts are not valid and are left out.
        </p>
      )}
      <Btn variant="ghost" icon="plus" className="mt-4" onClick={() => onChange([...lines, { id: uid(), name: "", amount: "", freq: "month" }])}>
        Add {kind}
      </Btn>
    </ToolPanel>
  );
}

export default function Tool() {
  const [state, setState, clear] = usePersistentState<State>("student-budget-calculator", INITIAL);
  const m = (n: number) => money(n, state.currency);
  const weeks = parseNum(state.weeks);
  const months = parseNum(state.months);
  const terms = parseNum(state.terms);
  const weeksErr = weeks === null || weeks <= 0 || weeks > 53 ? "Enter 1 to 53 weeks." : null;
  const monthsErr = months === null || months <= 0 || months > 12 ? "Enter 1 to 12 months." : null;
  const termsErr = terms === null || terms <= 0 || terms > 6 || !Number.isInteger(terms) ? "Enter 1 to 6 terms." : null;
  const ok = !weeksErr && !monthsErr && !termsErr;
  const mult: Record<Freq, number> = { year: 1, term: terms ?? 0, month: months ?? 0, week: weeks ?? 0 };
  const yearTotal = (l: Line) => (bad(l.amount) ? 0 : (parseNum(l.amount) ?? 0) * mult[l.freq]);
  const income = state.income.reduce((a, l) => a + yearTotal(l), 0);
  const costs = state.costs.reduce((a, l) => a + yearTotal(l), 0);
  const left = income - costs;
  const perWeek = ok ? left / (weeks as number) : 0;

  const exportCsv = () => {
    const rows: (string | number)[][] = [["Type", "Name", "Amount", "Frequency", "Academic year total"]];
    for (const l of state.income) rows.push(["Income", l.name, round(parseNum(l.amount) ?? 0, 2), l.freq, round(yearTotal(l), 2)]);
    for (const l of state.costs) rows.push(["Cost", l.name, round(parseNum(l.amount) ?? 0, 2), l.freq, round(yearTotal(l), 2)]);
    rows.push(["Total", "Left for spending", "", "", round(left, 2)], ["Total", "Per week", "", "", round(perWeek, 2)]);
    downloadFile("student-budget.csv", toCsv(rows), "text/csv");
  };

  return (
    <div className="space-y-5">
      <ToolPanel
        title="Academic year"
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
              label={left >= 0 ? "Spending money per week" : "Weekly shortfall"}
              value={ok ? m(Math.abs(perWeek)) : "n/a"}
              detail={ok ? `For food, social life and everything else over ${weeks} weeks.` : "Fix the year settings below."}
            />
            <StatGrid
              items={[
                { label: "Income for the year", value: m(income) },
                { label: "Fixed costs", value: m(costs) },
                { label: "Left for the year", value: m(left) },
                { label: "Per month", value: ok ? m(left / (months as number)) : "n/a" },
              ]}
            />
          </div>
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <NumberField label="Weeks in the year" value={state.weeks} error={weeksErr} onChange={(e) => setState((s) => ({ ...s, weeks: e.target.value }))} />
              <NumberField label="Months" value={state.months} error={monthsErr} onChange={(e) => setState((s) => ({ ...s, months: e.target.value }))} />
              <NumberField label="Terms" value={state.terms} error={termsErr} onChange={(e) => setState((s) => ({ ...s, terms: e.target.value }))} />
            </div>
            <p className="text-[0.8125rem] text-muted">Match these to your tenancy and course: a typical UK academic year is about 39 weeks; use 52 if your rent and costs run all year.</p>
            <SelectField label="Currency" value={state.currency} onChange={(e) => setState((s) => ({ ...s, currency: e.target.value }))} options={CURRENCY_OPTIONS} />
            {ok && costs > 0 && (
              <HBars
                title="Biggest costs for the year"
                items={state.costs
                  .map((l, i) => ({ label: l.name || `Cost ${i + 1}`, value: yearTotal(l) }))
                  .filter((x) => x.value > 0)
                  .sort((a, b) => b.value - a.value)}
                format={m}
              />
            )}
          </div>
        </div>
      </ToolPanel>
      <div className="grid gap-5 lg:grid-cols-2">
        <LineList title="Income" kind="income" lines={state.income} onChange={(income) => setState((s) => ({ ...s, income }))} />
        <LineList title="Fixed costs" kind="cost" lines={state.costs} onChange={(costs) => setState((s) => ({ ...s, costs }))} />
      </div>
      <PrivacyNote stored />
    </div>
  );
}

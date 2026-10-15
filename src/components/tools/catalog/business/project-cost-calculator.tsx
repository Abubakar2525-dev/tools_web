"use client";

import { useMemo, useState } from "react";
import {
  Btn,
  CellInput,
  CopyBtn,
  Notice,
  NumberField,
  PrivacyNote,
  ResultCard,
  StatGrid,
  TextField,
  ToolPanel,
  downloadFile,
  parseNum,
  uid,
  usePersistentState,
} from "@/components/tools/kit";
import { fixed, num } from "@/components/tools/engines/FormulaTool";
import { Icon } from "@/components/ui/Icon";
import { projectQuote } from "./lib/calc";
import { toCsv } from "./lib/csv";

type Task = { id: string; name: string; hours: string; rate: string };
type Expense = { id: string; name: string; amount: string };
type Project = { name: string; tasks: Task[]; expenses: Expense[]; contingency: string; margin: string; tax: string };

const blank = (): Project => ({
  name: "",
  tasks: [{ id: "t0", name: "", hours: "", rate: "" }],
  expenses: [],
  contingency: "10",
  margin: "20",
  tax: "",
});
const example = (): Project => ({
  name: "Customer portal MVP",
  tasks: [
    { id: "t0", name: "Discovery and planning", hours: "16", rate: "95" },
    { id: "t1", name: "UI design", hours: "40", rate: "85" },
    { id: "t2", name: "Front-end build", hours: "80", rate: "90" },
    { id: "t3", name: "API and database", hours: "60", rate: "100" },
    { id: "t4", name: "Testing and launch", hours: "24", rate: "80" },
  ],
  expenses: [
    { id: "e0", name: "Stock photography", amount: "250" },
    { id: "e1", name: "Hosting, first year", amount: "480" },
  ],
  contingency: "10",
  margin: "20",
  tax: "",
});

function normalize(v: unknown): Project {
  const b = blank();
  if (!v || typeof v !== "object") return b;
  const o = v as Partial<Project>;
  const s = (x: unknown, n = 120) => (typeof x === "string" ? x.slice(0, n) : "");
  return {
    name: s(o.name),
    tasks: Array.isArray(o.tasks) ? o.tasks.slice(0, 200).map((t, i) => ({ id: typeof t?.id === "string" ? t.id : `t${i}`, name: s(t?.name), hours: s(t?.hours, 20), rate: s(t?.rate, 20) })) : b.tasks,
    expenses: Array.isArray(o.expenses) ? o.expenses.slice(0, 200).map((e, i) => ({ id: typeof e?.id === "string" ? e.id : `e${i}`, name: s(e?.name), amount: s(e?.amount, 20) })) : b.expenses,
    contingency: s(o.contingency, 20),
    margin: s(o.margin, 20),
    tax: s(o.tax, 20),
  };
}

const val = (s: string) => (s.trim() ? parseNum(s) : 0);

export default function Tool() {
  const [initial] = useState(blank);
  const [stored, setStored] = usePersistentState<Project>("project-cost-calculator", initial);
  const p = useMemo(() => normalize(stored), [stored]);
  const update = (fn: (x: Project) => Project) => setStored((prev) => fn(normalize(prev)));
  const [undo, setUndo] = useState<Project | null>(null);

  const calc = useMemo(() => {
    const errors: string[] = [];
    const taskCosts = p.tasks.map((t, i) => {
      const h = val(t.hours);
      const r = val(t.rate);
      if (h === null || r === null || (h ?? 0) < 0 || (r ?? 0) < 0) {
        errors.push(`Task ${i + 1}: hours and rate must be positive numbers.`);
        return 0;
      }
      return (h ?? 0) * (r ?? 0);
    });
    const expCosts = p.expenses.map((e, i) => {
      const a = val(e.amount);
      if (a === null || a < 0) {
        errors.push(`Expense ${i + 1}: enter a positive amount.`);
        return 0;
      }
      return a;
    });
    const cont = val(p.contingency);
    const margin = val(p.margin);
    const tax = val(p.tax);
    if (cont === null || cont < 0) errors.push("Contingency must be 0% or more.");
    if (margin === null || margin < 0 || margin >= 100) errors.push("Margin must be at least 0% and below 100%.");
    if (tax === null || tax < 0) errors.push("Tax must be 0% or more.");
    const hours = p.tasks.reduce((a, t) => { const h = val(t.hours); return a + (h !== null && h > 0 ? h : 0); }, 0);
    const labor = taskCosts.reduce((a, b) => a + b, 0);
    const expenses = expCosts.reduce((a, b) => a + b, 0);
    const q = projectQuote(labor, expenses, cont ?? 0, margin !== null && margin < 100 && margin >= 0 ? margin : 0, tax ?? 0);
    return { errors, hours, taskCosts, labor, expenses, q, cont: cont ?? 0, margin: margin ?? 0, tax: tax ?? 0 };
  }, [p]);

  const q = calc.q;
  const summary = q
    ? [
        p.name ? `Project: ${p.name}` : "",
        `Labor: ${fixed(calc.labor)} (${num(calc.hours)} hours)`,
        `Expenses: ${fixed(calc.expenses)}`,
        `Contingency ${num(calc.cont)}%: ${fixed(q.contingency)}`,
        `Total cost: ${fixed(q.cost)}`,
        `Price at ${num(calc.margin)}% margin: ${fixed(q.price)}`,
        calc.tax ? `Tax ${num(calc.tax)}%: ${fixed(q.tax)}` : "",
        `Quote total: ${fixed(q.total)}`,
      ]
        .filter(Boolean)
        .join("\n")
    : "";

  const csv = () => {
    if (!q) return;
    const rows: (string | number)[][] = [["Item", "Hours", "Rate", "Amount"]];
    p.tasks.forEach((t, i) => rows.push([t.name || `Task ${i + 1}`, t.hours, t.rate, calc.taskCosts[i].toFixed(2)]));
    p.expenses.forEach((e, i) => rows.push([e.name || `Expense ${i + 1}`, "", "", (val(e.amount) ?? 0).toFixed(2)]));
    rows.push([], ["Contingency", "", `${calc.cont}%`, q.contingency.toFixed(2)], ["Total cost", "", "", q.cost.toFixed(2)], ["Profit", "", `${calc.margin}% margin`, q.profit.toFixed(2)], ["Price before tax", "", "", q.price.toFixed(2)]);
    if (calc.tax) rows.push(["Tax", "", `${calc.tax}%`, q.tax.toFixed(2)]);
    rows.push(["Quote total", "", "", q.total.toFixed(2)]);
    downloadFile(`${(p.name.trim() || "project").replace(/[^\w-]+/g, "-")}-cost.csv`, toCsv(rows), "text/csv");
  };

  return (
    <div className="space-y-5">
      <ToolPanel
        title="Tasks"
        actions={
          <>
            <Btn variant="ghost" icon="spark" onClick={() => { setUndo(p); setStored(example()); }}>
              Load example
            </Btn>
            <Btn variant="subtle" icon="reset" onClick={() => { setUndo(p); setStored(blank()); }}>
              Clear
            </Btn>
          </>
        }
      >
        {undo && (
          <div className="mb-4">
            <Notice tone="success">
              Project replaced.{" "}
              <button type="button" className="min-h-10 font-medium text-accent-strong underline underline-offset-2" onClick={() => { setStored(undo); setUndo(null); }}>
                Undo
              </button>
            </Notice>
          </div>
        )}
        <TextField label="Project name" optional value={p.name} onChange={(e) => update((x) => ({ ...x, name: e.target.value }))} className="mb-4 max-w-md" />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[540px] text-sm">
            <thead>
              <tr className="text-left text-muted">
                <th scope="col" className="pb-2 font-normal">Task</th>
                <th scope="col" className="pb-2 font-normal">Hours</th>
                <th scope="col" className="pb-2 font-normal">Rate per hour</th>
                <th scope="col" className="pb-2 text-right font-normal">Cost</th>
                <th scope="col" className="pb-2"><span className="sr-only">Remove</span></th>
              </tr>
            </thead>
            <tbody>
              {p.tasks.map((t, i) => (
                <tr key={t.id}>
                  <td className="py-1 pr-2"><CellInput label={`Task ${i + 1} name`} value={t.name} placeholder="Task" onChange={(e) => update((x) => ({ ...x, tasks: x.tasks.map((y) => (y.id === t.id ? { ...y, name: e.target.value } : y)) }))} /></td>
                  <td className="w-24 py-1 pr-2"><CellInput label={`Task ${i + 1} hours`} inputMode="decimal" value={t.hours} onChange={(e) => update((x) => ({ ...x, tasks: x.tasks.map((y) => (y.id === t.id ? { ...y, hours: e.target.value } : y)) }))} /></td>
                  <td className="w-32 py-1 pr-2"><CellInput label={`Task ${i + 1} hourly rate`} inputMode="decimal" value={t.rate} onChange={(e) => update((x) => ({ ...x, tasks: x.tasks.map((y) => (y.id === t.id ? { ...y, rate: e.target.value } : y)) }))} /></td>
                  <td className="whitespace-nowrap py-1 pr-2 text-right tabular-nums text-ink">{fixed(calc.taskCosts[i])}</td>
                  <td className="py-1">
                    <button type="button" aria-label={`Remove task ${i + 1}`} onClick={() => update((x) => ({ ...x, tasks: x.tasks.filter((y) => y.id !== t.id) }))} className="grid h-10 w-10 place-items-center rounded-lg text-danger hover:bg-sunken">
                      <Icon name="trash" size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-3">
          <Btn
            variant="ghost"
            icon="plus"
            onClick={() => update((x) => ({ ...x, tasks: [...x.tasks, { id: uid(), name: "", hours: "", rate: x.tasks[x.tasks.length - 1]?.rate ?? "" }] }))}
          >
            Add task
          </Btn>
        </div>

        <h3 className="mt-6 text-sm font-semibold text-ink">Expenses and materials</h3>
        <ul className="mt-2 space-y-2">
          {p.expenses.map((e, i) => (
            <li key={e.id} className="flex gap-2">
              <CellInput label={`Expense ${i + 1} name`} placeholder="Item" value={e.name} onChange={(ev) => update((x) => ({ ...x, expenses: x.expenses.map((y) => (y.id === e.id ? { ...y, name: ev.target.value } : y)) }))} />
              <CellInput label={`Expense ${i + 1} amount`} inputMode="decimal" placeholder="0.00" value={e.amount} className="!w-32" onChange={(ev) => update((x) => ({ ...x, expenses: x.expenses.map((y) => (y.id === e.id ? { ...y, amount: ev.target.value } : y)) }))} />
              <button type="button" aria-label={`Remove expense ${i + 1}`} onClick={() => update((x) => ({ ...x, expenses: x.expenses.filter((y) => y.id !== e.id) }))} className="grid h-10 w-10 shrink-0 place-items-center rounded-lg text-danger hover:bg-sunken">
                <Icon name="trash" size={18} />
              </button>
            </li>
          ))}
        </ul>
        <div className="mt-3">
          <Btn variant="ghost" icon="plus" onClick={() => update((x) => ({ ...x, expenses: [...x.expenses, { id: uid(), name: "", amount: "" }] }))}>
            Add expense
          </Btn>
        </div>
      </ToolPanel>

      <div className="grid gap-5 lg:grid-cols-2">
        <ToolPanel title="Pricing">
          <div className="grid gap-4 sm:grid-cols-2">
            <NumberField label="Contingency (%)" hint="Buffer for unknowns, added to cost." value={p.contingency} onChange={(e) => update((x) => ({ ...x, contingency: e.target.value }))} />
            <NumberField label="Target margin (%)" hint="Profit as a share of the price, before tax." value={p.margin} onChange={(e) => update((x) => ({ ...x, margin: e.target.value }))} />
            <NumberField label="Sales tax or VAT (%)" optional value={p.tax} onChange={(e) => update((x) => ({ ...x, tax: e.target.value }))} />
          </div>
        </ToolPanel>
        <ToolPanel
          title="Quote"
          actions={
            <>
              <CopyBtn text={summary} label="Copy summary" />
              <Btn variant="ghost" icon="download" onClick={csv} disabled={!q}>
                CSV
              </Btn>
            </>
          }
        >
          <div className="space-y-4">
            {calc.errors.length > 0 && <Notice tone="error">{calc.errors.slice(0, 3).join(" ")}</Notice>}
            {q && (
              <>
                <ResultCard label="Quote total" value={fixed(q.total)} detail={`Price ${fixed(q.price)}${calc.tax ? ` + tax ${fixed(q.tax)}` : ""}`} />
                <StatGrid
                  items={[
                    { label: "Labor", value: fixed(calc.labor) },
                    { label: "Expenses", value: fixed(calc.expenses) },
                    { label: "Contingency", value: fixed(q.contingency) },
                    { label: "Total cost", value: fixed(q.cost) },
                    { label: "Profit", value: fixed(q.profit) },
                    { label: "Blended rate", value: calc.hours > 0 ? `${fixed((q.price - calc.expenses) / calc.hours)}/h` : "–" },
                  ]}
                />
                <p className="text-[0.8125rem] text-muted">
                  Price = cost ÷ (1 − margin). A {num(calc.margin)}% margin equals a {num(q.markup, 4)}% markup on cost. Blended rate spreads the price, minus expenses, over {num(calc.hours)} hours.
                </p>
              </>
            )}
            <PrivacyNote stored />
          </div>
        </ToolPanel>
      </div>
    </div>
  );
}

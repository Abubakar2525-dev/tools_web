"use client";

import { useMemo, useState } from "react";
import {
  Btn,
  CellInput,
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
import { cashFlow } from "./lib/calc";
import { toCsv } from "./lib/csv";

type Row = { id: string; inflow: string; outflow: string };
type Plan = { opening: string; start: string; rows: Row[] };

const blank = (): Plan => ({ opening: "", start: "", rows: Array.from({ length: 12 }, (_, i) => ({ id: `m${i}`, inflow: "", outflow: "" })) });
const example = (start: string): Plan => ({
  opening: "50000",
  start,
  rows: [
    [8000, 14500],
    [9000, 14500],
    [9500, 15200],
    [11000, 15200],
    [12500, 18900],
    [13000, 15200],
    [14000, 15800],
    [15500, 15800],
    [16000, 21000],
    [17500, 16400],
    [18000, 16400],
    [20000, 17000],
  ].map(([a, b], i) => ({ id: `m${i}`, inflow: String(a), outflow: String(b) })),
});

function normalize(v: unknown): Plan {
  const b = blank();
  if (!v || typeof v !== "object") return b;
  const o = v as Partial<Plan>;
  const s = (x: unknown) => (typeof x === "string" ? x.slice(0, 30) : "");
  return {
    opening: s(o.opening),
    start: /^\d{4}-\d{2}$/.test(s(o.start)) ? s(o.start) : "",
    rows: Array.isArray(o.rows) ? o.rows.slice(0, 60).map((r, i) => ({ id: typeof r?.id === "string" ? r.id : `r${i}`, inflow: s(r?.inflow), outflow: s(r?.outflow) })) : b.rows,
  };
}

function monthLabel(start: string, i: number): string {
  if (!/^\d{4}-\d{2}$/.test(start)) return `Month ${i + 1}`;
  const [y, m] = start.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + i, 1));
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
}

export default function Tool() {
  const [initial] = useState(blank);
  const [stored, setStored] = usePersistentState<Plan>("cash-flow-calculator", initial);
  const plan = useMemo(() => normalize(stored), [stored]);
  const update = (fn: (p: Plan) => Plan) => setStored((p) => fn(normalize(p)));
  const [fillIn, setFillIn] = useState("");
  const [fillOut, setFillOut] = useState("");
  const [undo, setUndo] = useState<Plan | null>(null);

  const calc = useMemo(() => {
    const opening = plan.opening.trim() ? parseNum(plan.opening) : 0;
    const errors: string[] = [];
    if (opening === null) errors.push("Opening balance is not a number.");
    const rows = plan.rows.map((r, i) => {
      const a = r.inflow.trim() ? parseNum(r.inflow) : 0;
      const b = r.outflow.trim() ? parseNum(r.outflow) : 0;
      if (a === null || b === null || (a ?? 0) < 0 || (b ?? 0) < 0) errors.push(`${monthLabel(plan.start, i)}: enter positive numbers.`);
      return { inflow: a !== null && a >= 0 ? a : 0, outflow: b !== null && b >= 0 ? b : 0 };
    });
    return { errors, res: cashFlow(opening ?? 0, rows), opening: opening ?? 0 };
  }, [plan]);

  const { res } = calc;
  const hasData = plan.rows.some((r) => r.inflow.trim() || r.outflow.trim()) || plan.opening.trim() !== "";
  const runOut = res.runsOutAt !== null ? monthLabel(plan.start, res.runsOutAt) : null;

  const csv = () => {
    const rows: (string | number)[][] = [["Month", "Opening", "Inflows", "Outflows", "Net", "Closing"]];
    res.rows.forEach((r, i) => rows.push([monthLabel(plan.start, i), r.opening.toFixed(2), r.inflow.toFixed(2), r.outflow.toFixed(2), r.net.toFixed(2), r.closing.toFixed(2)]));
    downloadFile("cash-flow.csv", toCsv(rows), "text/csv");
  };

  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-2">
        <ToolPanel
          title="Setup"
          actions={
            <>
              <Btn
                variant="ghost"
                icon="spark"
                onClick={() => {
                  const now = new Date();
                  setUndo(plan);
                  setStored(example(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`));
                }}
              >
                Load example
              </Btn>
              <Btn variant="subtle" icon="reset" onClick={() => { setUndo(plan); setStored(blank()); }}>
                Clear
              </Btn>
            </>
          }
        >
          {undo && (
            <div className="mb-4">
              <Notice tone="success">
                Plan replaced.{" "}
                <button type="button" className="min-h-10 font-medium text-accent-strong underline underline-offset-2" onClick={() => { setStored(undo); setUndo(null); }}>
                  Undo
                </button>
              </Notice>
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <NumberField label="Opening cash balance" value={plan.opening} onChange={(e) => update((p) => ({ ...p, opening: e.target.value }))} placeholder="50000" />
            <TextField label="First month" optional type="month" value={plan.start} onChange={(e) => update((p) => ({ ...p, start: e.target.value }))} />
          </div>
          <div className="mt-5 rounded-xl bg-sunken p-4">
            <p className="text-sm font-medium text-ink">Fill every month</p>
            <p className="text-[0.8125rem] text-muted">Handy for recurring amounts; you can still edit single months below.</p>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-[1fr_1fr_auto]">
              <CellInput label="Inflow for every month" inputMode="decimal" placeholder="Inflow" value={fillIn} onChange={(e) => setFillIn(e.target.value)} />
              <CellInput label="Outflow for every month" inputMode="decimal" placeholder="Outflow" value={fillOut} onChange={(e) => setFillOut(e.target.value)} />
              <Btn
                variant="ghost"
                className="col-span-2 sm:col-span-1"
                onClick={() => update((p) => ({ ...p, rows: p.rows.map((r) => ({ ...r, inflow: fillIn.trim() ? fillIn : r.inflow, outflow: fillOut.trim() ? fillOut : r.outflow })) }))}
              >
                Apply
              </Btn>
            </div>
          </div>
        </ToolPanel>

        <ToolPanel title="Result">
          {!hasData ? (
            <p className="text-sm text-muted">Enter an opening balance and monthly amounts, or load the example.</p>
          ) : (
            <div className="space-y-4">
              {calc.errors.length > 0 && <Notice tone="error">{calc.errors.slice(0, 3).join(" ")}</Notice>}
              <ResultCard
                label={runOut ? "Cash runs out in" : "Closing balance"}
                value={runOut ?? fixed(res.closing)}
                detail={runOut ? `The balance first drops below zero in ${runOut}.` : res.runwayAfter !== null ? `About ${num(res.runwayAfter, 3)} more months of runway at the recent burn rate.` : "The balance stays above zero for the whole plan."}
              />
              <StatGrid
                items={[
                  { label: "Closing balance", value: fixed(res.closing) },
                  { label: "Total inflows", value: fixed(res.totalIn) },
                  { label: "Total outflows", value: fixed(res.totalOut) },
                  { label: "Average monthly net", value: fixed(res.avgNet) },
                  { label: "Burn (last 3 months)", value: res.burn > 0 ? fixed(res.burn) : "None" },
                  { label: "Runway after plan", value: res.runwayAfter !== null ? `${num(res.runwayAfter, 3)} mo` : res.burn > 0 ? "0 mo" : "Not burning" },
                ]}
              />
              <p className="text-[0.8125rem] text-muted">Burn is the average net outflow of the last three months. Runway divides the closing balance by that burn.</p>
            </div>
          )}
        </ToolPanel>
      </div>

      <ToolPanel title="Months" actions={<Btn variant="ghost" icon="download" onClick={csv} disabled={!hasData}>Download CSV</Btn>}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[620px] text-sm">
            <caption className="sr-only">Monthly cash flow with running balance</caption>
            <thead>
              <tr className="text-left text-muted">
                <th scope="col" className="pb-2 font-normal">Month</th>
                <th scope="col" className="pb-2 font-normal">Inflows</th>
                <th scope="col" className="pb-2 font-normal">Outflows</th>
                <th scope="col" className="pb-2 text-right font-normal">Net</th>
                <th scope="col" className="pb-2 text-right font-normal">Closing balance</th>
                <th scope="col" className="pb-2"><span className="sr-only">Remove</span></th>
              </tr>
            </thead>
            <tbody>
              {plan.rows.map((r, i) => {
                const c = res.rows[i];
                const neg = c.closing < 0;
                const label = monthLabel(plan.start, i);
                return (
                  <tr key={r.id} className="border-t border-line">
                    <td className="whitespace-nowrap py-1 pr-2 text-ink-2">{label}</td>
                    <td className="py-1 pr-2"><CellInput label={`${label} inflows`} inputMode="decimal" value={r.inflow} onChange={(e) => update((p) => ({ ...p, rows: p.rows.map((x) => (x.id === r.id ? { ...x, inflow: e.target.value } : x)) }))} /></td>
                    <td className="py-1 pr-2"><CellInput label={`${label} outflows`} inputMode="decimal" value={r.outflow} onChange={(e) => update((p) => ({ ...p, rows: p.rows.map((x) => (x.id === r.id ? { ...x, outflow: e.target.value } : x)) }))} /></td>
                    <td className="whitespace-nowrap py-1 pr-2 text-right tabular-nums text-ink-2">{fixed(c.net)}</td>
                    <td className={`whitespace-nowrap py-1 pr-2 text-right font-medium tabular-nums ${neg ? "text-danger" : "text-ink"}`}>
                      {fixed(c.closing)}
                      {neg && <span className="block text-xs font-normal">below zero</span>}
                    </td>
                    <td className="py-1">
                      <button type="button" aria-label={`Remove ${label}`} onClick={() => update((p) => ({ ...p, rows: p.rows.filter((x) => x.id !== r.id) }))} className="grid h-10 w-10 place-items-center rounded-lg text-danger hover:bg-sunken">
                        <Icon name="trash" size={18} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <Btn variant="ghost" icon="plus" disabled={plan.rows.length >= 60} onClick={() => update((p) => ({ ...p, rows: [...p.rows, { id: uid(), inflow: "", outflow: "" }] }))}>
            Add month
          </Btn>
          <PrivacyNote stored />
        </div>
      </ToolPanel>
    </div>
  );
}

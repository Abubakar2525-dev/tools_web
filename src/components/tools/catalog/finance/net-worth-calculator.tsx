"use client";

import {
  Btn,
  CellInput,
  CellSelect,
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

type Row = { id: string; name: string; category: string; value: string };
type State = { currency: string; assets: Row[]; liabilities: Row[] };

const ASSET_CATS = ["Cash and savings", "Investments", "Retirement accounts", "Property", "Vehicles", "Other assets"];
const DEBT_CATS = ["Mortgage", "Car loan", "Student loan", "Credit cards", "Personal loan", "Other debt"];

const INITIAL: State = {
  currency: "USD",
  assets: [
    { id: "a1", name: "Checking and savings", category: "Cash and savings", value: "" },
    { id: "a2", name: "Retirement account", category: "Retirement accounts", value: "" },
    { id: "a3", name: "Home value", category: "Property", value: "" },
  ],
  liabilities: [
    { id: "l1", name: "Mortgage balance", category: "Mortgage", value: "" },
    { id: "l2", name: "Credit card balance", category: "Credit cards", value: "" },
  ],
};

function Section({
  title,
  rows,
  cats,
  onChange,
  invalid,
}: {
  title: string;
  rows: Row[];
  cats: string[];
  onChange: (rows: Row[]) => void;
  invalid: (r: Row) => boolean;
}) {
  const kind = title === "Assets" ? "asset" : "liability";
  return (
    <ToolPanel title={title}>
      <ul className="space-y-3">
        {rows.map((r, i) => (
          <li key={r.id} className="grid grid-cols-2 gap-2 rounded-xl bg-sunken p-3 sm:grid-cols-[1.3fr_1fr_1fr_auto] sm:items-center">
            <CellInput label={`${kind} ${i + 1} name`} placeholder="Name" value={r.name} onChange={(e) => onChange(rows.map((x) => (x.id === r.id ? { ...x, name: e.target.value } : x)))} className="col-span-2 sm:col-span-1" />
            <CellSelect label={`${kind} ${i + 1} category`} options={cats} value={r.category} onChange={(e) => onChange(rows.map((x) => (x.id === r.id ? { ...x, category: e.target.value } : x)))} />
            <CellInput label={`${kind} ${i + 1} value`} inputMode="decimal" placeholder="0" value={r.value} invalid={invalid(r)} onChange={(e) => onChange(rows.map((x) => (x.id === r.id ? { ...x, value: e.target.value } : x)))} />
            <Btn variant="subtle" icon="trash" aria-label={`Remove ${kind} ${i + 1}`} onClick={() => onChange(rows.filter((x) => x.id !== r.id))} className="col-span-2 sm:col-span-1">
              <span className="sm:sr-only">Remove</span>
            </Btn>
            {invalid(r) && (
              <p role="alert" className="col-span-2 text-sm text-danger sm:col-span-4">
                Enter a positive number.
              </p>
            )}
          </li>
        ))}
      </ul>
      <Btn variant="ghost" icon="plus" className="mt-4" onClick={() => onChange([...rows, { id: uid(), name: "", category: cats[0], value: "" }])}>
        Add {kind}
      </Btn>
    </ToolPanel>
  );
}

export default function Tool() {
  const [state, setState, clear] = usePersistentState<State>("net-worth-calculator", INITIAL);
  const m = (n: number) => money(n, state.currency);
  const val = (r: Row) => parseNum(r.value);
  const invalid = (r: Row) => r.value.trim() !== "" && (val(r) === null || (val(r) as number) < 0);
  const sum = (rows: Row[]) => rows.reduce((a, r) => a + (invalid(r) ? 0 : val(r) ?? 0), 0);
  const assets = sum(state.assets);
  const debts = sum(state.liabilities);
  const net = assets - debts;
  const group = (rows: Row[]) => {
    const g = new Map<string, number>();
    for (const r of rows) if (!invalid(r) && (val(r) ?? 0) > 0) g.set(r.category, (g.get(r.category) ?? 0) + (val(r) as number));
    return [...g.entries()].sort((a, b) => b[1] - a[1]).map(([label, value]) => ({ label, value }));
  };
  const exportCsv = () => {
    const rows: (string | number)[][] = [["Type", "Name", "Category", "Value"]];
    for (const r of state.assets) rows.push(["Asset", r.name, r.category, round(val(r) ?? 0, 2)]);
    for (const r of state.liabilities) rows.push(["Liability", r.name, r.category, round(val(r) ?? 0, 2)]);
    rows.push(["Total", "Assets", "", round(assets, 2)], ["Total", "Liabilities", "", round(debts, 2)], ["Total", "Net worth", "", round(net, 2)]);
    downloadFile("net-worth.csv", toCsv(rows), "text/csv");
  };

  return (
    <div className="space-y-5">
      <ToolPanel
        title="Your net worth"
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
            <ResultCard label="Net worth" value={m(net)} detail={net < 0 ? "Liabilities are larger than assets." : "Assets minus liabilities."} />
            <SelectField label="Currency" value={state.currency} onChange={(e) => setState((s) => ({ ...s, currency: e.target.value }))} options={CURRENCY_OPTIONS} />
          </div>
          <div className="space-y-4">
            <StatGrid
              items={[
                { label: "Total assets", value: m(assets) },
                { label: "Total liabilities", value: m(debts) },
                { label: "Debt-to-asset ratio", value: assets > 0 ? pct((debts / assets) * 100, 1) : "n/a" },
              ]}
            />
            {(assets > 0 || debts > 0) && (
              <HBars
                title="By category"
                items={[...group(state.assets).map((x) => ({ ...x, label: `${x.label} (asset)` })), ...group(state.liabilities).map((x) => ({ ...x, label: `${x.label} (debt)` }))]}
                format={m}
              />
            )}
          </div>
        </div>
      </ToolPanel>
      <div className="grid gap-5 lg:grid-cols-2">
        <Section title="Assets" rows={state.assets} cats={ASSET_CATS} invalid={invalid} onChange={(assets) => setState((s) => ({ ...s, assets }))} />
        <Section title="Liabilities" rows={state.liabilities} cats={DEBT_CATS} invalid={invalid} onChange={(liabilities) => setState((s) => ({ ...s, liabilities }))} />
      </div>
      <PrivacyNote stored />
    </div>
  );
}

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
import { CYCLES, yearlyCost, type Cycle } from "./lib/simple";
import { HBars } from "./ui";

type Sub = { id: string; name: string; price: string; cycle: Cycle; active: boolean };
type State = { currency: string; subs: Sub[] };

const INITIAL: State = {
  currency: "USD",
  subs: [
    { id: "s1", name: "Video streaming", price: "15.49", cycle: "monthly", active: true },
    { id: "s2", name: "Music", price: "10.99", cycle: "monthly", active: true },
    { id: "s3", name: "Cloud storage", price: "99.99", cycle: "annual", active: true },
  ],
};

const bad = (s: string) => s.trim() !== "" && (parseNum(s) === null || (parseNum(s) as number) < 0);

export default function Tool() {
  const [state, setState, clear] = usePersistentState<State>("subscription-cost-calculator", INITIAL);
  const m = (n: number) => money(n, state.currency);
  const update = (id: string, patch: Partial<Sub>) => setState((s) => ({ ...s, subs: s.subs.map((x) => (x.id === id ? { ...x, ...patch } : x)) }));
  const rows = state.subs.map((s) => ({ ...s, yearly: bad(s.price) ? 0 : yearlyCost(parseNum(s.price) ?? 0, s.cycle) }));
  const active = rows.filter((r) => r.active);
  const yearly = active.reduce((a, r) => a + r.yearly, 0);
  const paused = rows.filter((r) => !r.active).reduce((a, r) => a + r.yearly, 0);

  const exportCsv = () =>
    downloadFile(
      "subscriptions.csv",
      toCsv([
        ["Name", "Price", "Billing", "Counted", "Per month", "Per year"],
        ...rows.map((r) => [r.name, round(parseNum(r.price) ?? 0, 2), CYCLES.find((c) => c.value === r.cycle)?.label ?? r.cycle, r.active ? "yes" : "no", round(r.yearly / 12, 2), round(r.yearly, 2)]),
      ]),
      "text/csv",
    );

  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-[1.3fr_1fr]">
        <ToolPanel
          title="Subscriptions"
          actions={
            <>
              <Btn variant="ghost" icon="download" onClick={exportCsv}>
                Export CSV
              </Btn>
              <ResetBtn onClick={clear} />
            </>
          }
        >
          <ul className="space-y-3">
            {state.subs.map((s, i) => (
              <li key={s.id} className="grid grid-cols-2 gap-2 rounded-xl bg-sunken p-3 sm:grid-cols-[1.4fr_0.9fr_1.1fr_auto_auto] sm:items-center">
                <CellInput label={`Subscription ${i + 1} name`} placeholder="Name" value={s.name} onChange={(e) => update(s.id, { name: e.target.value })} className="col-span-2 sm:col-span-1" />
                <CellInput label={`Subscription ${i + 1} price`} inputMode="decimal" placeholder="Price" value={s.price} invalid={bad(s.price)} onChange={(e) => update(s.id, { price: e.target.value })} />
                <CellSelect label={`Subscription ${i + 1} billing cycle`} value={s.cycle} options={CYCLES.map((c) => ({ value: c.value, label: c.label }))} onChange={(e) => update(s.id, { cycle: e.target.value as Cycle })} />
                <label className="inline-flex h-10 cursor-pointer items-center gap-2 text-sm text-ink-2">
                  <input type="checkbox" className="h-[18px] w-[18px] accent-[var(--accent)]" checked={s.active} onChange={(e) => update(s.id, { active: e.target.checked })} />
                  Count
                </label>
                <Btn variant="subtle" icon="trash" aria-label={`Remove subscription ${i + 1}`} onClick={() => setState((st) => ({ ...st, subs: st.subs.filter((x) => x.id !== s.id) }))} />
              </li>
            ))}
          </ul>
          {state.subs.some((s) => bad(s.price)) && (
            <p role="alert" className="mt-3 text-sm text-danger">
              Some prices are not valid numbers and are left out of the totals.
            </p>
          )}
          <Btn variant="ghost" icon="plus" className="mt-4" onClick={() => setState((s) => ({ ...s, subs: [...s.subs, { id: uid(), name: "", price: "", cycle: "monthly", active: true }] }))}>
            Add subscription
          </Btn>
          <p className="mt-3 text-[0.8125rem] text-muted">Untick Count to see what you would save by cancelling.</p>
        </ToolPanel>

        <ToolPanel title="Totals">
          <div className="space-y-4">
            <ResultCard label="Per month" value={m(yearly / 12)} detail={`${active.length} counted ${active.length === 1 ? "subscription" : "subscriptions"}`} />
            <StatGrid
              items={[
                { label: "Per week", value: m(yearly / 52) },
                { label: "Per year", value: m(yearly) },
                { label: "Per day", value: m(yearly / 365) },
              ]}
            />
            {paused > 0 && <p className="text-sm text-ink-2">Cancelling the unticked ones saves {m(paused)} a year ({m(paused / 12)} a month).</p>}
            <SelectField label="Currency" value={state.currency} onChange={(e) => setState((s) => ({ ...s, currency: e.target.value }))} options={CURRENCY_OPTIONS} />
            {active.length > 0 && yearly > 0 && (
              <HBars
                title="Yearly cost, highest first"
                items={[...active].sort((a, b) => b.yearly - a.yearly).map((r, i) => ({ label: r.name || `Subscription ${i + 1}`, value: r.yearly, note: pct((r.yearly / yearly) * 100, 0) }))}
                format={m}
              />
            )}
          </div>
        </ToolPanel>
      </div>
      <PrivacyNote stored />
    </div>
  );
}

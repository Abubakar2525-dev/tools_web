"use client";

import {
  Btn,
  CellInput,
  CellSelect,
  CopyBtn,
  EmptyState,
  Notice,
  NumberField,
  PrivacyNote,
  ResetBtn,
  ResultCard,
  Segmented,
  SelectField,
  ToolPanel,
  parseNum,
  uid,
  usePersistentState,
} from "@/components/tools/kit";
import { allocate, currencyDigits, CURRENCY_OPTIONS, money } from "./lib/money";
import { balancesFrom, itemizedSplit, settle } from "./lib/split";

type Mode = "even" | "items" | "group";
type Person = { id: string; name: string };
type Item = { id: string; name: string; amount: string; who: string[] };
type Expense = { id: string; desc: string; amount: string; payer: string; among: string[] };
type State = {
  currency: string;
  mode: Mode;
  even: { subtotal: string; tax: string; tip: string; people: string };
  people: Person[];
  items: Item[];
  tax: string;
  tip: string;
  group: Person[];
  expenses: Expense[];
};

const INITIAL: State = {
  currency: "USD",
  mode: "even",
  even: { subtotal: "", tax: "", tip: "18", people: "2" },
  people: [
    { id: "p1", name: "Alex" },
    { id: "p2", name: "Sam" },
    { id: "p3", name: "Jordan" },
  ],
  items: [
    { id: "it1", name: "Shared starter", amount: "", who: ["p1", "p2", "p3"] },
    { id: "it2", name: "Main", amount: "", who: ["p1"] },
  ],
  tax: "",
  tip: "18",
  group: [
    { id: "g1", name: "Alex" },
    { id: "g2", name: "Sam" },
    { id: "g3", name: "Jordan" },
  ],
  expenses: [{ id: "x1", desc: "Groceries", amount: "", payer: "g1", among: ["g1", "g2", "g3"] }],
};

const isBad = (s: string) => s.trim() !== "" && (parseNum(s) === null || (parseNum(s) as number) < 0);

function PeopleEditor({ people, onChange, label }: { people: Person[]; onChange: (p: Person[]) => void; label: string }) {
  return (
    <div>
      <p className="text-sm font-medium text-ink">{label}</p>
      <ul className="mt-2 grid gap-2 sm:grid-cols-2">
        {people.map((p, i) => (
          <li key={p.id} className="flex gap-2">
            <CellInput label={`Person ${i + 1} name`} value={p.name} maxLength={40} onChange={(e) => onChange(people.map((x) => (x.id === p.id ? { ...x, name: e.target.value } : x)))} />
            <Btn variant="subtle" icon="trash" aria-label={`Remove ${p.name || `person ${i + 1}`}`} disabled={people.length <= 2} onClick={() => onChange(people.filter((x) => x.id !== p.id))} />
          </li>
        ))}
      </ul>
      <Btn variant="ghost" icon="plus" className="mt-3" disabled={people.length >= 30} onClick={() => onChange([...people, { id: uid(), name: `Person ${people.length + 1}` }])}>
        Add person
      </Btn>
    </div>
  );
}

function WhoPicker({ people, selected, onChange, legend }: { people: Person[]; selected: string[]; onChange: (ids: string[]) => void; legend: string }) {
  return (
    <fieldset className="col-span-full">
      <legend className="sr-only">{legend}</legend>
      <div className="flex flex-wrap gap-1.5">
        {people.map((p, i) => {
          const on = selected.includes(p.id);
          return (
            <label key={p.id} className={`inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-lg px-3 text-sm ${on ? "bg-accent-soft text-ink" : "bg-surface text-ink-2 shadow-[inset_0_0_0_1px_var(--line)]"}`}>
              <input
                type="checkbox"
                className="h-4 w-4 accent-[var(--accent)]"
                checked={on}
                onChange={(e) => onChange(e.target.checked ? [...selected, p.id] : selected.filter((x) => x !== p.id))}
              />
              {p.name || `Person ${i + 1}`}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

export default function Tool() {
  const [s, setS, clear] = usePersistentState<State>("bill-splitter", INITIAL);
  const digits = currencyDigits(s.currency);
  const unit = 10 ** digits;
  const toMinor = (str: string) => Math.round((parseNum(str) ?? 0) * unit);
  const m = (minor: number) => money(minor / unit, s.currency);
  const set = (patch: Partial<State>) => setS((p) => ({ ...p, ...patch }));
  const name = (list: Person[], id: string) => {
    const i = list.findIndex((p) => p.id === id);
    return list[i]?.name || `Person ${i + 1}`;
  };

  /* ---------- Even split ---------- */
  const e = s.even;
  const evenPeople = parseNum(e.people);
  const evenPeopleErr = e.people.trim() !== "" && (evenPeople === null || !Number.isInteger(evenPeople) || evenPeople < 1 || evenPeople > 100) ? "Enter 1 to 100 people." : null;
  const evenReady = parseNum(e.subtotal) !== null && !isBad(e.subtotal) && !isBad(e.tax) && !isBad(e.tip) && evenPeople !== null && !evenPeopleErr;
  let evenResult: { total: number; tip: number; shares: number[] } | null = null;
  if (evenReady) {
    const sub = toMinor(e.subtotal);
    const tax = toMinor(e.tax);
    const tip = Math.round((sub * (parseNum(e.tip) ?? 0)) / 100);
    const total = sub + tax + tip;
    evenResult = { total, tip, shares: allocate(total, new Array(evenPeople as number).fill(1)) };
  }

  /* ---------- Itemized ---------- */
  const idx = new Map(s.people.map((p, i) => [p.id, i]));
  const itemsValid = s.items.filter((it) => !isBad(it.amount) && (parseNum(it.amount) ?? 0) > 0);
  const unassigned = itemsValid.filter((it) => !it.who.some((w) => idx.has(w)));
  const itemSplit = itemizedSplit(
    s.people.length,
    itemsValid.map((it) => ({ amount: toMinor(it.amount), people: it.who.map((w) => idx.get(w) ?? -1) })),
    isBad(s.tax) ? 0 : toMinor(s.tax),
    0,
  );
  const itemSub = itemSplit.reduce((a, r) => a + r.subtotal, 0);
  const tipMinor = isBad(s.tip) ? 0 : Math.round((itemSub * (parseNum(s.tip) ?? 0)) / 100);
  const tipParts = allocate(tipMinor, itemSplit.map((r) => r.subtotal));
  const itemRows = itemSplit.map((r, i) => ({ ...r, tip: tipParts[i], total: r.subtotal + r.tax + tipParts[i] }));
  const itemTotal = itemRows.reduce((a, r) => a + r.total, 0);

  /* ---------- Group settle-up ---------- */
  const gidx = new Map(s.group.map((p, i) => [p.id, i]));
  const exps = s.expenses
    .filter((x) => !isBad(x.amount) && (parseNum(x.amount) ?? 0) > 0 && gidx.has(x.payer))
    .map((x) => ({ payer: gidx.get(x.payer) as number, amount: toMinor(x.amount), among: x.among.filter((a) => gidx.has(a)).map((a) => gidx.get(a) as number) }));
  const balances = balancesFrom(s.group.length, exps);
  const transfers = settle(balances.map((b) => b.net));
  const groupTotal = exps.reduce((a, x) => a + x.amount, 0);

  const copyText =
    s.mode === "even" && evenResult
      ? `Total ${m(evenResult.total)} split ${evenPeople} ways: ${[...new Set(evenResult.shares)].map((v) => m(v)).join(" or ")} each`
      : s.mode === "items"
        ? s.people.map((p, i) => `${p.name || `Person ${i + 1}`}: ${m(itemRows[i]?.total ?? 0)}`).join("\n")
        : transfers.map((t) => `${name(s.group, s.group[t.from].id)} pays ${name(s.group, s.group[t.to].id)} ${m(t.amount)}`).join("\n");

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <Segmented
          label="Split mode"
          value={s.mode}
          onChange={(mode) => set({ mode })}
          options={[
            { value: "even", label: "Split evenly" },
            { value: "items", label: "Split by item" },
            { value: "group", label: "Settle group expenses" },
          ]}
        />
        <div className="flex flex-wrap items-end gap-2">
          <SelectField label="Currency" className="min-w-[200px]" value={s.currency} onChange={(ev) => set({ currency: ev.target.value })} options={CURRENCY_OPTIONS} />
          <ResetBtn onClick={clear} label="Clear all" />
        </div>
      </div>

      {s.mode === "even" && (
        <div className="grid gap-5 lg:grid-cols-2">
          <ToolPanel title="Bill">
            <div className="grid gap-5 sm:grid-cols-2">
              <NumberField label="Bill before tax and tip" value={e.subtotal} error={isBad(e.subtotal) ? "Enter a valid amount." : null} onChange={(ev) => set({ even: { ...e, subtotal: ev.target.value } })} placeholder="120.00" />
              <NumberField label="Tax amount" optional value={e.tax} error={isBad(e.tax) ? "Enter a valid amount." : null} onChange={(ev) => set({ even: { ...e, tax: ev.target.value } })} placeholder="0" />
              <NumberField label="Tip %" value={e.tip} hint="Calculated on the pre-tax bill." error={isBad(e.tip) ? "Enter a valid percent." : null} onChange={(ev) => set({ even: { ...e, tip: ev.target.value } })} />
              <NumberField label="Number of people" value={e.people} error={evenPeopleErr} onChange={(ev) => set({ even: { ...e, people: ev.target.value } })} />
            </div>
          </ToolPanel>
          <ToolPanel title="Each person pays" actions={evenResult ? <CopyBtn text={copyText} /> : undefined}>
            {evenResult ? (
              <div className="space-y-4">
                <ResultCard label="Per person" value={m(Math.max(...evenResult.shares))} detail={`Total ${m(evenResult.total)} including ${m(evenResult.tip)} tip.`} />
                {new Set(evenResult.shares).size > 1 && (
                  <Notice>
                    The total does not divide evenly: {evenResult.shares.filter((x) => x === Math.max(...evenResult.shares)).length} people pay {m(Math.max(...evenResult.shares))} and the rest pay {m(Math.min(...evenResult.shares))}, so it adds up exactly.
                  </Notice>
                )}
              </div>
            ) : (
              <EmptyState icon="calculator" title="Enter the bill amount" />
            )}
          </ToolPanel>
        </div>
      )}

      {s.mode === "items" && (
        <div className="grid gap-5 lg:grid-cols-[1.3fr_1fr]">
          <ToolPanel title="People and items">
            <PeopleEditor label="People" people={s.people} onChange={(people) => set({ people, items: s.items.map((it) => ({ ...it, who: it.who.filter((w) => people.some((p) => p.id === w)) })) })} />
            <ul className="mt-6 space-y-3">
              {s.items.map((it, i) => (
                <li key={it.id} className="grid grid-cols-[1fr_1fr_auto] gap-2 rounded-xl bg-sunken p-3">
                  <CellInput label={`Item ${i + 1} name`} value={it.name} placeholder={`Item ${i + 1}`} onChange={(ev) => set({ items: s.items.map((x) => (x.id === it.id ? { ...x, name: ev.target.value } : x)) })} />
                  <CellInput label={`Item ${i + 1} price`} inputMode="decimal" placeholder="Price" value={it.amount} invalid={isBad(it.amount)} onChange={(ev) => set({ items: s.items.map((x) => (x.id === it.id ? { ...x, amount: ev.target.value } : x)) })} />
                  <Btn variant="subtle" icon="trash" aria-label={`Remove item ${i + 1}`} onClick={() => set({ items: s.items.filter((x) => x.id !== it.id) })} />
                  <WhoPicker legend={`Who shares item ${i + 1}`} people={s.people} selected={it.who} onChange={(who) => set({ items: s.items.map((x) => (x.id === it.id ? { ...x, who } : x)) })} />
                </li>
              ))}
            </ul>
            <Btn variant="ghost" icon="plus" className="mt-3" onClick={() => set({ items: [...s.items, { id: uid(), name: "", amount: "", who: s.people.map((p) => p.id) }] })}>
              Add item
            </Btn>
            <div className="mt-5 grid gap-5 sm:grid-cols-2">
              <NumberField label="Tax amount on the bill" optional value={s.tax} error={isBad(s.tax) ? "Enter a valid amount." : null} onChange={(ev) => set({ tax: ev.target.value })} hint="Shared in proportion to what each person ordered." />
              <NumberField label="Tip %" value={s.tip} error={isBad(s.tip) ? "Enter a valid percent." : null} onChange={(ev) => set({ tip: ev.target.value })} hint="On the pre-tax total, shared the same way." />
            </div>
          </ToolPanel>
          <ToolPanel title="Who owes what" actions={itemTotal > 0 ? <CopyBtn text={copyText} /> : undefined}>
            {itemTotal === 0 ? (
              <EmptyState icon="calculator" title="Add item prices and tick who shared each one" />
            ) : (
              <div className="space-y-4">
                <ResultCard label="Bill total" value={m(itemTotal)} detail={`Items ${m(itemSub)}, tax ${m(itemRows.reduce((a, r) => a + r.tax, 0))}, tip ${m(tipMinor)}`} />
                <div className="overflow-x-auto rounded-xl shadow-[0_0_0_1px_var(--line)]">
                  <table className="w-full text-left text-sm">
                    <caption className="sr-only">Amount owed per person</caption>
                    <thead>
                      <tr className="border-b border-line">
                        {["Person", "Items", "Tax", "Tip", "Total"].map((c) => (
                          <th key={c} scope="col" className="whitespace-nowrap px-3 py-2.5 font-medium text-ink">
                            {c}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {itemRows.map((r, i) => (
                        <tr key={s.people[i].id} className="border-b border-line last:border-0">
                          <td className="px-3 py-2 text-ink">{s.people[i].name || `Person ${i + 1}`}</td>
                          <td className="px-3 py-2 tabular-nums text-ink-2">{m(r.subtotal)}</td>
                          <td className="px-3 py-2 tabular-nums text-ink-2">{m(r.tax)}</td>
                          <td className="px-3 py-2 tabular-nums text-ink-2">{m(r.tip)}</td>
                          <td className="px-3 py-2 font-medium tabular-nums text-ink">{m(r.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {unassigned.length > 0 && <Notice tone="warning">{unassigned.length} item(s) have nobody ticked and are not included.</Notice>}
              </div>
            )}
          </ToolPanel>
        </div>
      )}

      {s.mode === "group" && (
        <div className="grid gap-5 lg:grid-cols-[1.3fr_1fr]">
          <ToolPanel title="Group and expenses">
            <PeopleEditor
              label="Group members"
              people={s.group}
              onChange={(group) =>
                set({
                  group,
                  expenses: s.expenses.map((x) => ({ ...x, payer: group.some((g) => g.id === x.payer) ? x.payer : group[0].id, among: x.among.filter((a) => group.some((g) => g.id === a)) })),
                })
              }
            />
            <ul className="mt-6 space-y-3">
              {s.expenses.map((x, i) => (
                <li key={x.id} className="grid grid-cols-2 gap-2 rounded-xl bg-sunken p-3 sm:grid-cols-[1.2fr_0.9fr_1fr_auto]">
                  <CellInput label={`Expense ${i + 1} description`} value={x.desc} placeholder="What for" onChange={(ev) => set({ expenses: s.expenses.map((y) => (y.id === x.id ? { ...y, desc: ev.target.value } : y)) })} className="col-span-2 sm:col-span-1" />
                  <CellInput label={`Expense ${i + 1} amount`} inputMode="decimal" placeholder="Amount" value={x.amount} invalid={isBad(x.amount)} onChange={(ev) => set({ expenses: s.expenses.map((y) => (y.id === x.id ? { ...y, amount: ev.target.value } : y)) })} />
                  <CellSelect label={`Expense ${i + 1} paid by`} value={x.payer} options={s.group.map((g, k) => ({ value: g.id, label: `Paid by ${g.name || `Person ${k + 1}`}` }))} onChange={(ev) => set({ expenses: s.expenses.map((y) => (y.id === x.id ? { ...y, payer: ev.target.value } : y)) })} />
                  <Btn variant="subtle" icon="trash" aria-label={`Remove expense ${i + 1}`} onClick={() => set({ expenses: s.expenses.filter((y) => y.id !== x.id) })} className="col-span-2 sm:col-span-1">
                    <span className="sm:sr-only">Remove</span>
                  </Btn>
                  <WhoPicker legend={`Who shares expense ${i + 1}`} people={s.group} selected={x.among} onChange={(among) => set({ expenses: s.expenses.map((y) => (y.id === x.id ? { ...y, among } : y)) })} />
                </li>
              ))}
            </ul>
            <Btn variant="ghost" icon="plus" className="mt-3" onClick={() => set({ expenses: [...s.expenses, { id: uid(), desc: "", amount: "", payer: s.group[0]?.id ?? "", among: s.group.map((g) => g.id) }] })}>
              Add expense
            </Btn>
          </ToolPanel>
          <ToolPanel title="Settle up" actions={transfers.length ? <CopyBtn text={copyText} /> : undefined}>
            {groupTotal === 0 ? (
              <EmptyState icon="calculator" title="Add what each person paid" />
            ) : (
              <div className="space-y-4">
                <ResultCard label={transfers.length ? `${transfers.length} ${transfers.length === 1 ? "payment" : "payments"} settles everything` : "Everyone is even"} value={m(groupTotal)} detail="Total group spending" />
                {transfers.length > 0 && (
                  <ol className="space-y-2">
                    {transfers.map((t, i) => (
                      <li key={i} className="rounded-lg bg-sunken px-4 py-3 text-sm text-ink">
                        <strong>{name(s.group, s.group[t.from].id)}</strong> pays <strong>{name(s.group, s.group[t.to].id)}</strong> <span className="tabular-nums">{m(t.amount)}</span>
                      </li>
                    ))}
                  </ol>
                )}
                <div className="overflow-x-auto rounded-xl shadow-[0_0_0_1px_var(--line)]">
                  <table className="w-full text-left text-sm">
                    <caption className="sr-only">Balances</caption>
                    <thead>
                      <tr className="border-b border-line">
                        {["Person", "Paid", "Share", "Balance"].map((c) => (
                          <th key={c} scope="col" className="whitespace-nowrap px-3 py-2.5 font-medium text-ink">
                            {c}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {balances.map((b, i) => (
                        <tr key={s.group[i].id} className="border-b border-line last:border-0">
                          <td className="px-3 py-2 text-ink">{s.group[i].name || `Person ${i + 1}`}</td>
                          <td className="px-3 py-2 tabular-nums text-ink-2">{m(b.paid)}</td>
                          <td className="px-3 py-2 tabular-nums text-ink-2">{m(b.share)}</td>
                          <td className="whitespace-nowrap px-3 py-2 tabular-nums text-ink">{b.net > 0 ? `gets back ${m(b.net)}` : b.net < 0 ? `owes ${m(-b.net)}` : "even"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-[0.8125rem] text-muted">Matches the biggest debtor with the biggest creditor each time, which needs at most one payment fewer than the number of people.</p>
              </div>
            )}
          </ToolPanel>
        </div>
      )}
      <PrivacyNote stored />
    </div>
  );
}

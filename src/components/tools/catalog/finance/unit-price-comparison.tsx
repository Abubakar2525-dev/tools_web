"use client";

import { useState } from "react";
import {
  Btn,
  CellInput,
  CellSelect,
  EmptyState,
  Notice,
  PrivacyNote,
  ResetBtn,
  ResultCard,
  SelectField,
  ToolPanel,
  parseNum,
  uid,
} from "@/components/tools/kit";
import { CURRENCY_OPTIONS, money, pct } from "./lib/money";
import { UNITS, unitPrice, type Dimension } from "./lib/simple";

type Item = { id: string; name: string; price: string; qty: string; unit: string };

const unitOptions = UNITS.map((u) => ({ value: u.value, label: u.label }));

const PER: Record<Dimension, { value: string; label: string; unit: string; qty: number }[]> = {
  mass: [
    { value: "100g", label: "per 100 g", unit: "g", qty: 100 },
    { value: "kg", label: "per kg", unit: "kg", qty: 1 },
    { value: "oz", label: "per oz", unit: "oz", qty: 1 },
    { value: "lb", label: "per lb", unit: "lb", qty: 1 },
  ],
  volume: [
    { value: "100ml", label: "per 100 ml", unit: "ml", qty: 100 },
    { value: "l", label: "per litre", unit: "l", qty: 1 },
    { value: "floz", label: "per fl oz (US)", unit: "floz", qty: 1 },
    { value: "gal", label: "per gallon (US)", unit: "gal", qty: 1 },
  ],
  length: [
    { value: "m", label: "per metre", unit: "m", qty: 1 },
    { value: "ft", label: "per foot", unit: "ft", qty: 1 },
  ],
  count: [{ value: "item", label: "per item", unit: "item", qty: 1 }],
};

const start = (): Item[] => [
  { id: uid(), name: "Small pack", price: "3.49", qty: "500", unit: "g" },
  { id: uid(), name: "Large pack", price: "5.99", qty: "1", unit: "kg" },
];

export default function Tool() {
  const [items, setItems] = useState<Item[]>(start);
  const [currency, setCurrency] = useState("USD");
  const [per, setPer] = useState("");
  const update = (id: string, patch: Partial<Item>) => setItems((xs) => xs.map((x) => (x.id === id ? { ...x, ...patch } : x)));

  const rows = items.map((it, i) => {
    const price = parseNum(it.price);
    const qty = parseNum(it.qty);
    const u = UNITS.find((x) => x.value === it.unit);
    const priceErr = it.price.trim() !== "" && (price === null || price < 0);
    const qtyErr = it.qty.trim() !== "" && (qty === null || qty <= 0);
    return { ...it, index: i, priceN: price, qtyN: qty, dim: u?.dim, priceErr, qtyErr, ok: price !== null && qty !== null && !priceErr && !qtyErr };
  });
  const complete = rows.filter((r) => r.ok);
  const dims = [...new Set(complete.map((r) => r.dim))];
  const dim = (dims[0] ?? "mass") as Dimension;
  const perOptions = PER[dim];
  const perSel = perOptions.find((p) => p.value === per) ?? perOptions[0];
  const mixed = dims.length > 1;
  const priced = mixed
    ? []
    : complete
        .map((r) => ({ ...r, up: unitPrice(r.priceN as number, r.qtyN as number, r.unit, perSel.unit, perSel.qty) as number }))
        .sort((a, b) => a.up - b.up);
  const best = priced[0];
  const worst = priced[priced.length - 1];
  const m = (n: number) => money(n, currency, n < 1 ? 4 : undefined);
  const label = (r: { name: string; index: number }) => r.name.trim() || `Item ${r.index + 1}`;

  return (
    <div className="grid gap-5 lg:grid-cols-[1.2fr_1fr]">
      <ToolPanel title="Items to compare" actions={<ResetBtn onClick={() => setItems(start())} />}>
        <SelectField label="Currency" value={currency} onChange={(e) => setCurrency(e.target.value)} options={CURRENCY_OPTIONS} className="max-w-xs" />
        <ul className="mt-4 space-y-3">
          {rows.map((r, i) => (
            <li key={r.id} className="grid grid-cols-2 gap-2 rounded-xl bg-sunken p-3 sm:grid-cols-[1.4fr_1fr_1fr_0.9fr_auto] sm:items-center">
              <CellInput label={`Item ${i + 1} name`} placeholder={`Item ${i + 1}`} value={r.name} onChange={(e) => update(r.id, { name: e.target.value })} className="col-span-2 sm:col-span-1" />
              <CellInput label={`Item ${i + 1} price`} inputMode="decimal" placeholder="Price" value={r.price} invalid={r.priceErr} onChange={(e) => update(r.id, { price: e.target.value })} />
              <CellInput label={`Item ${i + 1} quantity`} inputMode="decimal" placeholder="Size" value={r.qty} invalid={r.qtyErr} onChange={(e) => update(r.id, { qty: e.target.value })} />
              <CellSelect label={`Item ${i + 1} unit`} options={unitOptions} value={r.unit} onChange={(e) => update(r.id, { unit: e.target.value })} />
              <Btn variant="subtle" icon="trash" aria-label={`Remove item ${i + 1}`} disabled={items.length <= 1} onClick={() => setItems((xs) => xs.filter((x) => x.id !== r.id))}>
                <span className="sm:sr-only">Remove</span>
              </Btn>
              {(r.priceErr || r.qtyErr) && (
                <p role="alert" className="col-span-2 text-sm text-danger sm:col-span-5">
                  {r.priceErr ? "Price must be a number of 0 or more. " : ""}
                  {r.qtyErr ? "Size must be greater than 0." : ""}
                </p>
              )}
            </li>
          ))}
        </ul>
        <Btn variant="ghost" icon="plus" className="mt-4" onClick={() => setItems((xs) => [...xs, { id: uid(), name: "", price: "", qty: "", unit: xs[xs.length - 1]?.unit ?? "g" }])}>
          Add item
        </Btn>
        <p className="mt-3 text-[0.8125rem] text-muted">For multipacks, enter the total size (for example 6 × 330 ml = 1980 ml).</p>
      </ToolPanel>

      <ToolPanel title="Cheapest per unit">
        {mixed ? (
          <Notice tone="error">
            Items use different kinds of units ({dims.join(", ")}). Compare weight with weight, volume with volume, or count with count.
          </Notice>
        ) : priced.length === 0 ? (
          <EmptyState icon="calculator" title="Add a price and size for at least one item" />
        ) : (
          <div className="space-y-5">
            <SelectField label="Compare" value={perSel.value} onChange={(e) => setPer(e.target.value)} options={perOptions.map((p) => ({ value: p.value, label: p.label }))} className="max-w-xs" />
            {best && (
              <ResultCard
                label="Best value"
                value={label(best)}
                detail={
                  <>
                    {m(best.up)} {perSel.label}
                    {priced.length > 1 && worst && worst.up > best.up && <> · {pct(((worst.up - best.up) / worst.up) * 100, 1)} cheaper than the most expensive</>}
                  </>
                }
              />
            )}
            <ol className="space-y-2">
              {priced.map((r, k) => (
                <li key={r.id} className="flex flex-wrap items-baseline justify-between gap-2 rounded-lg bg-sunken px-4 py-3 text-sm">
                  <span className="text-ink">
                    <span className="mr-2 font-semibold tabular-nums">{k + 1}.</span>
                    {label(r)}
                    {k === 0 && <span className="ml-2 rounded bg-accent-soft px-1.5 py-0.5 text-[0.75rem] font-medium">Cheapest</span>}
                  </span>
                  <span className="tabular-nums text-ink-2">
                    {m(r.up)} {perSel.label}
                    {k > 0 && best && best.up > 0 && <> · +{pct(((r.up - best.up) / best.up) * 100, 1)}</>}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        )}
        <div className="mt-6">
          <PrivacyNote />
        </div>
      </ToolPanel>
    </div>
  );
}

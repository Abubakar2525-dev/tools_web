"use client";

import { useMemo } from "react";
import { Btn, CellInput, CellSelect, CopyBtn, Notice, NumberField, PrivacyNote, ResetBtn, ResultCard, ToolPanel, fmt, parseNum, uid, usePersistentState } from "@/components/tools/kit";
import { DataTable } from "./ui";
import { parkingCost, type Tariff } from "./lib/parking";

type Row = {
  id: string;
  name: string;
  kind: "blocks" | "flat";
  firstMinutes: string;
  firstPrice: string;
  blockMinutes: string;
  blockPrice: string;
  dailyMax: string;
  flatPrice: string;
  grace: string;
};
type Saved = { days: string; hours: string; minutes: string; rows: Row[] };

const initial: Saved = {
  days: "0",
  hours: "5",
  minutes: "30",
  rows: [
    { id: "t1", name: "Street meter", kind: "blocks", firstMinutes: "60", firstPrice: "3", blockMinutes: "60", blockPrice: "3", dailyMax: "", flatPrice: "", grace: "0" },
    { id: "t2", name: "City garage", kind: "blocks", firstMinutes: "60", firstPrice: "4", blockMinutes: "30", blockPrice: "1.5", dailyMax: "18", flatPrice: "", grace: "10" },
    { id: "t3", name: "Park and ride", kind: "flat", firstMinutes: "", firstPrice: "", blockMinutes: "", blockPrice: "", dailyMax: "", flatPrice: "12", grace: "0" },
  ],
};

function toTariff(r: Row): Tariff | string {
  const n = (s: string, def: number | null = null) => (s.trim() === "" ? def : parseNum(s));
  const grace = n(r.grace, 0);
  if (grace === null || grace < 0) return "Grace period must be 0 or more minutes.";
  if (r.kind === "flat") {
    const flat = n(r.flatPrice);
    if (flat === null || flat < 0) return "Enter the flat price per day.";
    return { kind: "flat", flatPrice: flat, grace, firstMinutes: 0, firstPrice: 0, blockMinutes: 0, blockPrice: 0, dailyMax: null };
  }
  const fm = n(r.firstMinutes),
    fp = n(r.firstPrice),
    bm = n(r.blockMinutes),
    bp = n(r.blockPrice, 0),
    max = n(r.dailyMax);
  if (fm === null || fm <= 0) return "Enter the length of the first period in minutes.";
  if (fp === null || fp < 0) return "Enter the price of the first period.";
  if (bm === null || bm <= 0) return "Enter the length of each extra period in minutes.";
  if (bp === null || bp < 0) return "Enter the price of each extra period.";
  if (r.dailyMax.trim() !== "" && (max === null || max < 0)) return "Daily maximum must be a number.";
  return { kind: "blocks", firstMinutes: fm, firstPrice: fp, blockMinutes: bm, blockPrice: bp, dailyMax: max, flatPrice: 0, grace };
}

export default function Tool() {
  const [data, setData, clear] = usePersistentState<Saved>("parking-cost-calculator", initial);
  const setRows = (fn: (r: Row[]) => Row[]) => setData((d) => ({ ...d, rows: fn(d.rows) }));
  const update = (id: string, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const stay = useMemo(() => {
    const d = parseNum(data.days || "0"),
      h = parseNum(data.hours || "0"),
      m = parseNum(data.minutes || "0");
    if (d === null || h === null || m === null || d < 0 || h < 0 || m < 0) return null;
    return d * 1440 + h * 60 + m;
  }, [data.days, data.hours, data.minutes]);

  const results = useMemo(
    () =>
      data.rows.map((r) => {
        const t = toTariff(r);
        if (typeof t === "string" || stay === null) return { row: r, error: typeof t === "string" ? t : null, cost: null as number | null };
        return { row: r, error: null, cost: parkingCost(t, stay) };
      }),
    [data.rows, stay],
  );
  const valid = results.filter((r) => r.cost !== null) as { row: Row; cost: number }[];
  const best = valid.length ? valid.reduce((a, b) => (b.cost < a.cost ? b : a)) : null;
  const stayText = stay !== null ? `${Math.floor(stay / 60)} h ${Math.round(stay % 60)} min` : "";
  const summary = valid.map((r) => `${r.row.name || "Tariff"}: ${fmt(r.cost, 2)}`).join("\n");

  return (
    <div className="space-y-5">
      <ToolPanel title="Your stay" actions={<ResetBtn onClick={clear} />}>
        <div className="grid grid-cols-3 gap-4 sm:max-w-md">
          <NumberField label="Days" value={data.days} onChange={(e) => setData((d) => ({ ...d, days: e.target.value }))} />
          <NumberField label="Hours" value={data.hours} onChange={(e) => setData((d) => ({ ...d, hours: e.target.value }))} />
          <NumberField label="Minutes" value={data.minutes} onChange={(e) => setData((d) => ({ ...d, minutes: e.target.value }))} />
        </div>
        {stay === null && (
          <div className="mt-4">
            <Notice tone="error">Enter the stay as non-negative numbers.</Notice>
          </div>
        )}
      </ToolPanel>

      <ToolPanel title="Tariffs to compare">
        <p className="mb-4 text-[0.8125rem] text-muted">
          Per-period tariffs charge the first period, then every started extra period, capped by the daily maximum for each 24 hours. Flat tariffs charge once per started 24 hours.
        </p>
        <ul className="space-y-3">
          {data.rows.map((r, i) => {
            const res = results[i];
            return (
              <li key={r.id} className="rounded-xl bg-sunken p-3">
                <div className="grid gap-2 sm:grid-cols-[1fr_12rem_auto]">
                  <CellInput label={`Tariff ${i + 1} name`} placeholder="Name" value={r.name} onChange={(e) => update(r.id, { name: e.target.value })} />
                  <CellSelect
                    label={`Tariff ${i + 1} type`}
                    value={r.kind}
                    onChange={(e) => update(r.id, { kind: e.target.value as Row["kind"] })}
                    options={[
                      { value: "blocks", label: "Per period" },
                      { value: "flat", label: "Flat per day" },
                    ]}
                  />
                  <Btn variant="danger" icon="trash" aria-label={`Remove tariff ${i + 1}`} onClick={() => setRows((rs) => rs.filter((x) => x.id !== r.id))} />
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-6">
                  {r.kind === "blocks" ? (
                    <>
                      <Labeled label="First period (min)">
                        <CellInput label={`Tariff ${i + 1} first period minutes`} inputMode="decimal" value={r.firstMinutes} onChange={(e) => update(r.id, { firstMinutes: e.target.value })} />
                      </Labeled>
                      <Labeled label="First period price">
                        <CellInput label={`Tariff ${i + 1} first period price`} inputMode="decimal" value={r.firstPrice} onChange={(e) => update(r.id, { firstPrice: e.target.value })} />
                      </Labeled>
                      <Labeled label="Extra period (min)">
                        <CellInput label={`Tariff ${i + 1} extra period minutes`} inputMode="decimal" value={r.blockMinutes} onChange={(e) => update(r.id, { blockMinutes: e.target.value })} />
                      </Labeled>
                      <Labeled label="Extra period price">
                        <CellInput label={`Tariff ${i + 1} extra period price`} inputMode="decimal" value={r.blockPrice} onChange={(e) => update(r.id, { blockPrice: e.target.value })} />
                      </Labeled>
                      <Labeled label="Daily max (optional)">
                        <CellInput label={`Tariff ${i + 1} daily maximum`} inputMode="decimal" value={r.dailyMax} onChange={(e) => update(r.id, { dailyMax: e.target.value })} />
                      </Labeled>
                    </>
                  ) : (
                    <Labeled label="Price per day">
                      <CellInput label={`Tariff ${i + 1} flat price`} inputMode="decimal" value={r.flatPrice} onChange={(e) => update(r.id, { flatPrice: e.target.value })} />
                    </Labeled>
                  )}
                  <Labeled label="Free minutes">
                    <CellInput label={`Tariff ${i + 1} free grace minutes`} inputMode="decimal" value={r.grace} onChange={(e) => update(r.id, { grace: e.target.value })} />
                  </Labeled>
                </div>
                {res?.error && <p className="mt-2 text-sm text-danger">{res.error}</p>}
              </li>
            );
          })}
        </ul>
        <div className="mt-4">
          <Btn
            variant="ghost"
            icon="plus"
            onClick={() =>
              setRows((rs) => [...rs, { id: uid(), name: `Tariff ${rs.length + 1}`, kind: "blocks", firstMinutes: "60", firstPrice: "", blockMinutes: "60", blockPrice: "", dailyMax: "", flatPrice: "", grace: "0" }])
            }
          >
            Add tariff
          </Btn>
        </div>
      </ToolPanel>

      <ToolPanel title="Comparison" actions={summary ? <CopyBtn text={summary} label="Copy comparison" /> : undefined}>
        <div className="space-y-5">
          {best ? (
            <>
              <ResultCard label={`Cheapest for ${stayText}`} value={fmt(best.cost, 2)} detail={best.row.name || "Unnamed tariff"} />
              <DataTable
                caption={`Cost of a ${stayText} stay, cheapest first`}
                columns={["Tariff", "Cost", "Difference"]}
                rows={[...valid].sort((a, b) => a.cost - b.cost).map((r) => [r.row.name || "Unnamed", fmt(r.cost, 2), r === best ? "Cheapest" : `+${fmt(r.cost - best.cost, 2)}`])}
              />
            </>
          ) : (
            <Notice>Add at least one complete tariff and a stay length.</Notice>
          )}
          <p className="text-[0.8125rem] text-muted">Check the signs for evening or weekend rates and time limits: this comparison uses only the rules you enter.</p>
          <PrivacyNote stored />
        </div>
      </ToolPanel>
    </div>
  );
}

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 text-[0.8125rem] text-muted">
      <span aria-hidden="true">{label}</span>
      {children}
    </div>
  );
}

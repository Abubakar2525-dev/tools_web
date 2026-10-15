"use client";

import { useMemo } from "react";
import {
  Btn,
  CellInput,
  CopyBtn,
  Notice,
  PrivacyNote,
  ResetBtn,
  ResultCard,
  Segmented,
  StatGrid,
  ToolPanel,
  fmt,
  parseNum,
  uid,
  usePersistentState,
} from "@/components/tools/kit";
import { num } from "@/components/tools/engines/FormulaTool";
import { DataTable } from "./ui";
import { analyzeLog, type Fill } from "./lib/mileage";
import { KM_PER_MI, L_PER_UKGAL, L_PER_USGAL } from "./lib/fuel";

type Row = { id: string; date: string; odo: string; fuel: string; full: boolean; cost: string };
type Units = "metric" | "us" | "uk";
type Saved = { units: Units; rows: Row[] };

const initial: Saved = {
  units: "metric",
  rows: [
    { id: "a", date: "2026-09-01", odo: "12000", fuel: "", full: true, cost: "" },
    { id: "b", date: "2026-09-12", odo: "12610", fuel: "38.4", full: true, cost: "71.04" },
    { id: "c", date: "2026-09-20", odo: "12980", fuel: "20.0", full: false, cost: "37.20" },
    { id: "d", date: "2026-09-29", odo: "13420", fuel: "31.5", full: true, cost: "58.59" },
  ],
};

const U = {
  metric: { dist: "km", vol: "L", eco: "km/L", toKm: 1, toL: 1 },
  us: { dist: "mi", vol: "US gal", eco: "mpg (US)", toKm: KM_PER_MI, toL: L_PER_USGAL },
  uk: { dist: "mi", vol: "UK gal", eco: "mpg (UK)", toKm: KM_PER_MI, toL: L_PER_UKGAL },
};

export default function Tool() {
  const [data, setData, clear] = usePersistentState<Saved>("mileage-and-fuel-consumption-calculator", initial);
  const u = U[data.units];
  const setRows = (fn: (r: Row[]) => Row[]) => setData((d) => ({ ...d, rows: fn(d.rows) }));
  const update = (id: string, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const result = useMemo(() => {
    const fills: Fill[] = [];
    for (const [i, r] of data.rows.entries()) {
      const odo = parseNum(r.odo);
      const fuel = r.fuel.trim() === "" && i === 0 ? 0 : parseNum(r.fuel);
      if (odo === null) return `Fill-up ${i + 1}: enter the odometer reading.`;
      if (fuel === null || fuel < 0) return `Fill-up ${i + 1}: enter the amount of fuel added.`;
      const cost = r.cost.trim() === "" ? null : parseNum(r.cost);
      fills.push({ odo, fuel, full: r.full, cost });
    }
    return analyzeLog(fills);
  }, [data.rows]);

  const l100 = (dist: number, vol: number) => ((vol * u.toL) / (dist * u.toKm)) * 100;
  const ok = typeof result !== "string";
  const summary = ok
    ? `Average: ${num(result.perUnit as number, 4)} ${data.units === "metric" ? "km/L" : u.eco} (${num(l100(result.distance, result.fuel), 4)} L/100 km) over ${num(result.distance)} ${u.dist}`
    : "";

  return (
    <div className="space-y-5">
      <ToolPanel title="Fill-up log" actions={<ResetBtn onClick={clear} label="Reset log" />}>
        <div className="mb-5">
          <Segmented
            label="Units"
            value={data.units}
            onChange={(units) => setData((d) => ({ ...d, units }))}
            options={[
              { value: "metric", label: "km and liters" },
              { value: "us", label: "miles and US gallons" },
              { value: "uk", label: "miles and UK gallons" },
            ]}
          />
        </div>
        <p className="mb-3 text-[0.8125rem] text-muted">
          Start with a full tank (fuel amount can stay empty for that first row). For every later fill, enter the odometer and how much you added. Tick &quot;Full&quot; when you filled to the top.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="text-[0.8125rem] text-muted">
                <th scope="col" className="px-1 pb-2 font-normal">#</th>
                <th scope="col" className="px-1 pb-2 font-normal">Date</th>
                <th scope="col" className="px-1 pb-2 font-normal">Odometer ({u.dist})</th>
                <th scope="col" className="px-1 pb-2 font-normal">Fuel added ({u.vol})</th>
                <th scope="col" className="px-1 pb-2 font-normal">Full</th>
                <th scope="col" className="px-1 pb-2 font-normal">Cost (optional)</th>
                <th scope="col" className="px-1 pb-2 font-normal"><span className="sr-only">Remove</span></th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r, i) => (
                <tr key={r.id}>
                  <td className="px-1 py-1 text-muted">{i + 1}</td>
                  <td className="px-1 py-1">
                    <CellInput label={`Fill-up ${i + 1} date`} type="date" value={r.date} onChange={(e) => update(r.id, { date: e.target.value })} />
                  </td>
                  <td className="px-1 py-1">
                    <CellInput label={`Fill-up ${i + 1} odometer`} inputMode="decimal" value={r.odo} onChange={(e) => update(r.id, { odo: e.target.value })} />
                  </td>
                  <td className="px-1 py-1">
                    <CellInput label={`Fill-up ${i + 1} fuel added`} inputMode="decimal" value={r.fuel} onChange={(e) => update(r.id, { fuel: e.target.value })} />
                  </td>
                  <td className="px-1 py-1 text-center">
                    <input
                      type="checkbox"
                      aria-label={`Fill-up ${i + 1} was a full tank`}
                      checked={r.full}
                      onChange={(e) => update(r.id, { full: e.target.checked })}
                      className="h-5 w-5 cursor-pointer accent-[var(--accent)]"
                    />
                  </td>
                  <td className="px-1 py-1">
                    <CellInput label={`Fill-up ${i + 1} cost`} inputMode="decimal" value={r.cost} onChange={(e) => update(r.id, { cost: e.target.value })} />
                  </td>
                  <td className="px-1 py-1">
                    <Btn variant="danger" icon="trash" aria-label={`Remove fill-up ${i + 1}`} onClick={() => setRows((rs) => rs.filter((x) => x.id !== r.id))} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-4">
          <Btn
            variant="ghost"
            icon="plus"
            onClick={() => setRows((rs) => [...rs, { id: uid(), date: new Date().toISOString().slice(0, 10), odo: "", fuel: "", full: true, cost: "" }])}
          >
            Add fill-up
          </Btn>
        </div>
      </ToolPanel>

      <ToolPanel title="Consumption" actions={summary ? <CopyBtn text={summary} label="Copy summary" /> : undefined}>
        <div className="space-y-5">
          {!ok ? (
            <Notice tone="info">{result}</Notice>
          ) : (
            <>
              <ResultCard
                label="Average fuel economy"
                value={`${num(result.perUnit as number, 4)} ${data.units === "metric" ? "km/L" : u.eco}`}
                detail={`${num(l100(result.distance, result.fuel), 4)} L/100 km across ${result.segments.length} full-to-full segment${result.segments.length === 1 ? "" : "s"}.`}
              />
              <StatGrid
                items={[
                  { label: `Distance (${u.dist})`, value: num(result.distance) },
                  { label: `Fuel (${u.vol})`, value: num(result.fuel, 6) },
                  ...(result.cost !== null
                    ? [
                        { label: "Fuel cost", value: fmt(result.cost) },
                        { label: `Cost per ${u.dist}`, value: fmt(result.cost / result.distance, 3) },
                      ]
                    : []),
                ]}
              />
              <DataTable
                caption="Per segment (from one full tank to the next)"
                columns={["Ends at fill-up", `Distance (${u.dist})`, `Fuel (${u.vol})`, data.units === "metric" ? "km/L" : u.eco, "L/100 km"]}
                rows={result.segments.map((s) => [`#${s.endIndex + 1}${data.rows[s.endIndex]?.date ? ` (${data.rows[s.endIndex].date})` : ""}`, num(s.distance), num(s.fuel, 6), num(s.perUnit, 4), num(l100(s.distance, s.fuel), 4)])}
              />
            </>
          )}
          <p className="text-[0.8125rem] text-muted">
            The full-tank method is the most accurate way to track consumption by hand: the fuel needed to refill equals the fuel burned since the last full tank. Partial fills are added to the next full segment.
          </p>
          <PrivacyNote stored />
        </div>
      </ToolPanel>
    </div>
  );
}

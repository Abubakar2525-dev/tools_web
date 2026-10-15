"use client";

import { useState } from "react";
import {
  Btn,
  CellInput,
  Checkbox,
  CopyBtn,
  EmptyState,
  Notice,
  NumberField,
  PrivacyNote,
  ResetBtn,
  ResultCard,
  Segmented,
  StatGrid,
  ToolPanel,
  parseNum,
  uid,
} from "@/components/tools/kit";
import { fixed, num } from "@/components/tools/engines/FormulaTool";
import { Icon } from "@/components/ui/Icon";
import { checkTiers, settleDraw, tieredCommission, type Tier } from "./lib/calc";

type Mode = "flat" | "marginal" | "full";
type TierRow = { id: string; upTo: string; rate: string };

const initialTiers = (): TierRow[] => [
  { id: "t1", upTo: "10000", rate: "5" },
  { id: "t2", upTo: "25000", rate: "7.5" },
  { id: "t3", upTo: "", rate: "10" },
];

export default function Tool() {
  const [mode, setMode] = useState<Mode>("marginal");
  const [sales, setSales] = useState("");
  const [flatRate, setFlatRate] = useState("8");
  const [tiers, setTiers] = useState<TierRow[]>(initialTiers);
  const [base, setBase] = useState("");
  const [useDraw, setUseDraw] = useState(false);
  const [draw, setDraw] = useState("");
  const [owed, setOwed] = useState("");
  const [recoverable, setRecoverable] = useState(true);

  const reset = () => {
    setMode("marginal");
    setSales("");
    setFlatRate("8");
    setTiers(initialTiers());
    setBase("");
    setUseDraw(false);
    setDraw("");
    setOwed("");
    setRecoverable(true);
  };
  const example = () => {
    reset();
    setSales("30000");
    setBase("2500");
    setUseDraw(true);
    setDraw("2500");
    setOwed("300");
  };

  const result = ((): { error: string } | null | { s: number; basePay: number; commission: number; bands: ReturnType<typeof tieredCommission>["bands"]; effective: number; drawResult: ReturnType<typeof settleDraw> | null; total: number; commissionPaid: number } => {
    const s = parseNum(sales);
    if (sales.trim() === "") return null;
    if (s === null || s < 0) return { error: "Enter total sales as a positive number." };
    const basePay = base.trim() ? parseNum(base) : 0;
    if (basePay === null || basePay < 0) return { error: "Base pay must be a positive number." };
    let commission: number;
    let bands: ReturnType<typeof tieredCommission>["bands"] = [];
    let effective: number;
    if (mode === "flat") {
      const r = parseNum(flatRate);
      if (r === null || r < 0) return { error: "Enter a commission rate of 0% or more." };
      commission = (s * r) / 100;
      effective = r;
    } else {
      const parsed: Tier[] = [];
      for (let i = 0; i < tiers.length; i++) {
        const t = tiers[i];
        const last = i === tiers.length - 1;
        const rate = parseNum(t.rate);
        if (rate === null) return { error: `Tier ${i + 1}: enter a rate.` };
        const upTo = last ? null : parseNum(t.upTo);
        if (!last && upTo === null) return { error: `Tier ${i + 1}: enter the upper limit of the band.` };
        parsed.push({ upTo, rate });
      }
      const err = checkTiers(parsed);
      if (err) return { error: err };
      const r = tieredCommission(s, parsed, mode);
      commission = r.commission;
      bands = r.bands;
      effective = r.effectiveRate;
    }
    let drawResult: ReturnType<typeof settleDraw> | null = null;
    if (useDraw) {
      const d = parseNum(draw);
      const o = owed.trim() ? parseNum(owed) : 0;
      if (d === null || d < 0) return { error: "Enter the draw amount for the period." };
      if (o === null || o < 0) return { error: "The balance owed must be a positive number or empty." };
      drawResult = settleDraw(commission, d, o, recoverable);
    }
    const commissionPaid = drawResult ? drawResult.paid : commission;
    return { s, basePay, commission, bands, effective, drawResult, total: basePay + commissionPaid, commissionPaid };
  })();

  const ok = result && !("error" in result) ? result : null;
  const copyText = ok
    ? [
        `Commission earned: ${fixed(ok.commission)}`,
        `Effective rate: ${num(ok.effective, 6)}%`,
        ok.drawResult ? `Commission or draw paid: ${fixed(ok.drawResult.paid)}; balance owed after: ${fixed(ok.drawResult.owedAfter)}` : "",
        `Total pay: ${fixed(ok.total)}`,
      ]
        .filter(Boolean)
        .join("\n")
    : "";

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <ToolPanel
        title="Inputs"
        actions={
          <>
            <Btn variant="ghost" icon="spark" onClick={example}>
              Load example
            </Btn>
            <ResetBtn onClick={reset} />
          </>
        }
      >
        <div className="space-y-5">
          <Segmented<Mode>
            label="Commission structure"
            value={mode}
            onChange={setMode}
            options={[
              { value: "flat", label: "Flat rate" },
              { value: "marginal", label: "Tiered, marginal" },
              { value: "full", label: "Tiered, full tier" },
            ]}
          />
          <p className="text-sm text-ink-2">
            {mode === "flat"
              ? "One rate applies to all sales."
              : mode === "marginal"
                ? "Each band's rate applies only to the sales inside that band, like tax brackets."
                : "Once sales reach a band, that band's rate applies to every sale in the period."}
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <NumberField label="Total sales for the period" value={sales} onChange={(e) => setSales(e.target.value)} placeholder="30000" />
            {mode === "flat" ? (
              <NumberField label="Commission rate (%)" value={flatRate} onChange={(e) => setFlatRate(e.target.value)} />
            ) : null}
            <NumberField label="Base pay for the period" optional value={base} onChange={(e) => setBase(e.target.value)} />
          </div>

          {mode !== "flat" && (
            <fieldset>
              <legend className="text-sm font-medium text-ink">Tiers</legend>
              <div className="mt-2 overflow-x-auto">
                <table className="w-full min-w-[320px] text-sm">
                  <thead>
                    <tr className="text-left text-muted">
                      <th scope="col" className="pb-2 font-normal">Band</th>
                      <th scope="col" className="pb-2 font-normal">Sales up to</th>
                      <th scope="col" className="pb-2 font-normal">Rate %</th>
                      <th scope="col" className="pb-2 font-normal">
                        <span className="sr-only">Remove</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {tiers.map((t, i) => {
                      const last = i === tiers.length - 1;
                      return (
                        <tr key={t.id}>
                          <td className="pr-2 text-ink-2">{i + 1}</td>
                          <td className="py-1 pr-2">
                            {last ? (
                              <span className="inline-flex h-10 items-center text-ink-2">and above</span>
                            ) : (
                              <CellInput label={`Tier ${i + 1} upper limit`} inputMode="decimal" value={t.upTo} onChange={(e) => setTiers((ts) => ts.map((x) => (x.id === t.id ? { ...x, upTo: e.target.value } : x)))} />
                            )}
                          </td>
                          <td className="py-1 pr-2">
                            <CellInput label={`Tier ${i + 1} rate percent`} inputMode="decimal" value={t.rate} onChange={(e) => setTiers((ts) => ts.map((x) => (x.id === t.id ? { ...x, rate: e.target.value } : x)))} />
                          </td>
                          <td className="py-1">
                            <button
                              type="button"
                              aria-label={`Remove tier ${i + 1}`}
                              disabled={tiers.length === 1}
                              onClick={() => setTiers((ts) => ts.filter((x) => x.id !== t.id))}
                              className="grid h-10 w-10 place-items-center rounded-lg text-danger hover:bg-sunken disabled:opacity-40"
                            >
                              <Icon name="trash" size={18} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="mt-2">
                <Btn
                  variant="ghost"
                  icon="plus"
                  onClick={() =>
                    setTiers((ts) => {
                      const prevLimit = ts.length > 1 ? parseNum(ts[ts.length - 2].upTo) ?? 0 : 0;
                      const copy = [...ts];
                      copy.splice(copy.length - 1, 0, { id: uid(), upTo: String(prevLimit + 10000), rate: copy[copy.length - 1]?.rate ?? "" });
                      return copy;
                    })
                  }
                >
                  Add tier
                </Btn>
              </div>
            </fieldset>
          )}

          <div className="space-y-3 rounded-xl bg-sunken p-4">
            <Checkbox label="Pay a draw against commission" hint="A guaranteed advance paid when commission is lower." checked={useDraw} onChange={setUseDraw} />
            {useDraw && (
              <div className="grid gap-4 sm:grid-cols-2">
                <NumberField label="Draw for the period" value={draw} onChange={(e) => setDraw(e.target.value)} />
                <NumberField label="Balance owed from earlier periods" optional value={owed} onChange={(e) => setOwed(e.target.value)} />
                <div className="sm:col-span-2">
                  <Checkbox
                    label="Recoverable draw"
                    hint="Shortfalls are carried forward and repaid from later commission. A non-recoverable draw is never paid back."
                    checked={recoverable}
                    onChange={setRecoverable}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </ToolPanel>

      <ToolPanel title="Result" actions={copyText ? <CopyBtn text={copyText} label="Copy result" /> : undefined}>
        {!result ? (
          <EmptyState icon="calculator" title="Enter total sales to see the commission">
            Or load the example.
          </EmptyState>
        ) : "error" in result ? (
          <Notice tone="error">{result.error}</Notice>
        ) : (
          <div className="space-y-5">
            <ResultCard label="Total pay for the period" value={fixed(result.total)} detail={`Base ${fixed(result.basePay)} + commission paid ${fixed(result.commissionPaid)}`} />
            <StatGrid
              items={[
                { label: "Commission earned", value: fixed(result.commission) },
                { label: "Effective rate", value: `${num(result.effective, 6)}%` },
                ...(result.drawResult
                  ? [
                      { label: "Paid (commission or draw)", value: fixed(result.drawResult.paid) },
                      { label: "Repaid from balance", value: fixed(result.drawResult.repaid) },
                      { label: "Balance owed after", value: fixed(result.drawResult.owedAfter) },
                    ]
                  : []),
              ]}
            />
            {result.bands.length > 0 && (
              <div className="overflow-x-auto rounded-xl shadow-[0_0_0_1px_var(--line)]">
                <table className="w-full text-left text-sm">
                  <caption className="px-4 pt-3 text-left text-[0.8125rem] text-muted">How the commission is built</caption>
                  <thead>
                    <tr className="border-b border-line">
                      {["Band", "Rate", "Sales in band", "Commission"].map((c) => (
                        <th key={c} scope="col" className="whitespace-nowrap px-4 py-2.5 font-medium text-ink">
                          {c}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {result.bands.map((b, i) => (
                      <tr key={i} className="border-b border-line last:border-0">
                        <td className="whitespace-nowrap px-4 py-2 tabular-nums text-ink-2">
                          {fixed(b.from)} {b.to === null ? "and above" : `to ${fixed(b.to)}`}
                        </td>
                        <td className="px-4 py-2 tabular-nums text-ink-2">{num(b.rate)}%</td>
                        <td className="px-4 py-2 tabular-nums text-ink-2">{fixed(b.amountInBand)}</td>
                        <td className="px-4 py-2 tabular-nums text-ink-2">{fixed(b.commission)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {mode === "full" && <Notice tone="info">Full-tier plans create cliffs: one extra sale that crosses a limit raises the rate on everything, so compare both structures before agreeing to one.</Notice>}
          </div>
        )}
        <div className="mt-6">
          <PrivacyNote />
        </div>
      </ToolPanel>
    </div>
  );
}

"use client";

import { useDeferredValue, useMemo, useState } from "react";
import {
  Btn,
  CellInput,
  CellSelect,
  CopyBtn,
  EmptyState,
  Notice,
  PrivacyNote,
  ResetBtn,
  ResultCard,
  SplitGrid,
  StatGrid,
  TextField,
  ToolPanel,
  parseNum,
} from "@/components/tools/kit";
import { num } from "@/components/tools/engines/FormulaTool";
import { balanceEquation, type BalanceResult } from "./lib/equation";
import { molarMass, prettyFormula } from "./lib/formula";
import { limitingReagent, percentYield } from "./lib/stoich";

type Amount = { value: string; unit: "g" | "mol" };
type Balanced = Extract<BalanceResult, { ok: true }>;
type Row = { s: Balanced["species"][number]; i: number; key: string; coef: number; M: number };
type Calc = {
  r: Balanced;
  reactants: Row[];
  products: Row[];
  moles: (number | null)[];
  lim: ReturnType<typeof limitingReagent>;
  errors: Record<string, string>;
  chosen: Row;
  actualN: number | null;
};

const EXAMPLE = {
  equation: "H2 + O2 -> H2O",
  amounts: { "0:H2": { value: "10", unit: "g" }, "1:O2": { value: "64", unit: "g" } } as Record<string, Amount>,
  product: "2:H2O",
  actual: "65",
};

function parse(eq: string): { kind: "empty" } | { kind: "error"; message: string } | { kind: "ok"; result: Extract<BalanceResult, { ok: true }> } {
  if (!eq.trim()) return { kind: "empty" };
  try {
    const r = balanceEquation(eq);
    if (!r.ok) return { kind: "error", message: r.reason };
    if (r.species.some((s) => s.electron)) return { kind: "error", message: "Half-reactions with free electrons are not supported here. Use a full equation." };
    return { kind: "ok", result: r };
  } catch (e) {
    return { kind: "error", message: e instanceof Error ? e.message : "Could not read the equation." };
  }
}

export default function Tool() {
  const [equation, setEquation] = useState("");
  const [amounts, setAmounts] = useState<Record<string, Amount>>({});
  const [product, setProduct] = useState("");
  const [actual, setActual] = useState("");
  const deferredEq = useDeferredValue(equation);
  const parsed = useMemo(() => parse(deferredEq), [deferredEq]);

  const calc = useMemo((): Calc | null => {
    if (parsed.kind !== "ok") return null;
    const r = parsed.result;
    const species: Row[] = r.species.map((s, i) => ({ s, i, key: `${i}:${s.text}`, coef: r.coefficients[i], M: molarMass(s.counts).molarMass }));
    const reactants = species.filter((x) => x.s.side === "reactant");
    const products = species.filter((x) => x.s.side === "product");
    const errors: Record<string, string> = {};
    const moles = reactants.map((x) => {
      const a = amounts[x.key];
      if (!a || a.value.trim() === "") return null;
      const n = parseNum(a.value);
      if (n === null || n <= 0) {
        errors[x.key] = "Enter a positive number.";
        return null;
      }
      return a.unit === "g" ? n / x.M : n;
    });
    const lim = Object.keys(errors).length ? null : limitingReagent({ coefficients: reactants.map((x) => x.coef), moles });
    const chosen = products.find((p) => p.key === product) ?? products[0];
    const actualN = actual.trim() === "" ? null : parseNum(actual);
    return { r, reactants, products, moles, lim, errors, chosen, actualN };
  }, [parsed, amounts, product, actual]);

  const setAmount = (key: string, patch: Partial<Amount>) =>
    setAmounts((prev) => ({ ...prev, [key]: { ...(prev[key] ?? { value: "", unit: "g" }), ...patch } }));

  const reset = () => {
    setEquation("");
    setAmounts({});
    setProduct("");
    setActual("");
  };

  let summary = "";
  if (calc?.lim) {
    const L = calc.reactants[calc.lim.limiting];
    const P = calc.chosen;
    summary = [
      `Balanced: ${calc.r.equation}`,
      `Limiting reagent: ${prettyFormula(L.s.text)}`,
      `Theoretical yield of ${prettyFormula(P.s.text)}: ${num(calc.lim.extent * P.coef * P.M, 6)} g (${num(calc.lim.extent * P.coef, 6)} mol)`,
    ].join("\n");
  }

  return (
    <SplitGrid>
      <ToolPanel
        title="Reaction"
        actions={
          <>
            <Btn
              variant="ghost"
              icon="spark"
              onClick={() => {
                setEquation(EXAMPLE.equation);
                setAmounts(EXAMPLE.amounts);
                setProduct(EXAMPLE.product);
                setActual(EXAMPLE.actual);
              }}
            >
              Load example
            </Btn>
            <ResetBtn onClick={reset} />
          </>
        }
      >
        <TextField
          label="Chemical equation"
          hint="Balanced or not: it is balanced automatically. Example: Al + Fe2O3 -> Al2O3 + Fe"
          placeholder="e.g. N2 + H2 -> NH3"
          value={equation}
          onChange={(e) => setEquation(e.target.value)}
          spellCheck={false}
          autoComplete="off"
          className="[&_input]:font-mono"
        />
        {parsed.kind === "error" && (
          <div className="mt-4">
            <Notice tone="error">{parsed.message}</Notice>
          </div>
        )}
        {calc && (
          <>
            <p className="mt-5 rounded-lg bg-sunken px-4 py-3 font-mono text-[0.95rem] text-ink">{calc.r.equation}</p>
            <fieldset className="mt-5">
              <legend className="text-sm font-medium text-ink">Reactant amounts</legend>
              <p className="mt-1 text-[0.8125rem] text-muted">Leave a reactant empty if it is in excess.</p>
              <div className="mt-3 space-y-3">
                {calc.reactants.map((x) => {
                  const a = amounts[x.key] ?? { value: "", unit: "g" };
                  const name = prettyFormula(x.s.text);
                  return (
                    <div key={x.key}>
                      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_96px] items-center gap-2">
                        <span className="truncate font-mono text-sm text-ink" title={name}>
                          {name}
                          <span className="ml-1 font-sans text-[0.75rem] text-muted">{num(x.M, 6)} g/mol</span>
                        </span>
                        <CellInput
                          label={`Amount of ${name}`}
                          inputMode="decimal"
                          autoComplete="off"
                          value={a.value}
                          invalid={!!calc.errors[x.key]}
                          onChange={(e) => setAmount(x.key, { value: e.target.value })}
                        />
                        <CellSelect
                          label={`Unit for ${name}`}
                          value={a.unit}
                          onChange={(e) => setAmount(x.key, { unit: e.target.value as Amount["unit"] })}
                          options={[
                            { value: "g", label: "g" },
                            { value: "mol", label: "mol" },
                          ]}
                        />
                      </div>
                      {calc.errors[x.key] && (
                        <p role="alert" className="mt-1 text-sm text-danger">
                          {calc.errors[x.key]}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </fieldset>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-sm font-medium text-ink" htmlFor="stoich-product">
                  Product of interest
                </label>
                <CellSelect
                  id="stoich-product"
                  label="Product of interest"
                  className="mt-2"
                  value={calc.chosen.key}
                  onChange={(e) => setProduct(e.target.value)}
                  options={calc.products.map((p) => ({ value: p.key, label: prettyFormula(p.s.text) }))}
                />
              </div>
              <TextField
                label="Actual yield (g)"
                optional
                inputMode="decimal"
                autoComplete="off"
                value={actual}
                onChange={(e) => setActual(e.target.value)}
                error={actual.trim() !== "" && (calc.actualN === null || calc.actualN < 0) ? "Enter a number of grams." : null}
              />
            </div>
          </>
        )}
      </ToolPanel>

      <ToolPanel title="Result" actions={summary ? <CopyBtn text={summary} label="Copy result" /> : undefined}>
        {!calc || !calc.lim ? (
          <EmptyState icon="atom" title={calc ? "Enter at least one reactant amount" : "Enter a chemical equation"}>
            {calc ? "The limiting reagent and yields appear here." : "Or load the example."}
          </EmptyState>
        ) : (
          <Results calc={calc} lim={calc.lim} />
        )}
        <div className="mt-6">
          <PrivacyNote />
        </div>
      </ToolPanel>
    </SplitGrid>
  );
}

function Results({ calc, lim }: { calc: Calc; lim: NonNullable<ReturnType<typeof limitingReagent>> }) {
  const L = calc.reactants[lim.limiting];
  const P = calc.chosen;
  const theoMol = lim.extent * P.coef;
  const theoG = theoMol * P.M;
  const pct = calc.actualN !== null && calc.actualN >= 0 ? percentYield(calc.actualN, theoG) : null;
  const tie = lim.tiedLimiting.length > 1;
  return (
    <div className="space-y-5">
      <ResultCard
        label="Limiting reagent"
        value={tie ? "Exact ratio" : prettyFormula(L.s.text)}
        detail={tie ? "The given reactants are in exactly the stoichiometric ratio; all run out together." : `It runs out first and sets the maximum product.`}
      />
      <StatGrid
        items={[
          { label: `Theoretical ${prettyFormula(P.s.text)} (g)`, value: num(theoG, 6) },
          { label: `Theoretical ${prettyFormula(P.s.text)} (mol)`, value: num(theoMol, 6) },
          ...(pct !== null ? [{ label: "Percent yield", value: `${num(pct, 4)}%` }] : []),
        ]}
      />
      {pct !== null && pct > 100 && <Notice tone="warning">A yield above 100% usually means the product is still wet or impure, or a mass was mistyped.</Notice>}
      <div className="overflow-x-auto rounded-xl shadow-[0_0_0_1px_var(--line)]">
        <table className="w-full text-left text-sm">
          <caption className="px-4 pt-3 text-left text-[0.8125rem] text-muted">Reactants</caption>
          <thead>
            <tr className="border-b border-line">
              {["Reactant", "Given (mol)", "Used (mol)", "Left over (g)"].map((c) => (
                <th key={c} scope="col" className="whitespace-nowrap px-4 py-2.5 font-medium">{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {calc.reactants.map((x, j) => (
              <tr key={x.key} className="border-b border-line last:border-0">
                <th scope="row" className="whitespace-nowrap px-4 py-2 font-mono font-medium">
                  {prettyFormula(x.s.text)}
                  {j === lim.limiting || lim.tiedLimiting.includes(j) ? <span className="ml-1 font-sans text-[0.75rem] text-accent-strong">limiting</span> : null}
                </th>
                <td className="whitespace-nowrap px-4 py-2 tabular-nums text-ink-2">{calc.moles[j] === null ? "excess" : num(calc.moles[j]!, 6)}</td>
                <td className="whitespace-nowrap px-4 py-2 tabular-nums text-ink-2">{num(lim.consumed[j], 6)}</td>
                <td className="whitespace-nowrap px-4 py-2 tabular-nums text-ink-2">{lim.leftover[j] === null ? "n/a" : num(lim.leftover[j]! * x.M, 6)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="overflow-x-auto rounded-xl shadow-[0_0_0_1px_var(--line)]">
        <table className="w-full text-left text-sm">
          <caption className="px-4 pt-3 text-left text-[0.8125rem] text-muted">Theoretical yield of every product</caption>
          <thead>
            <tr className="border-b border-line">
              {["Product", "mol", "g"].map((c) => (
                <th key={c} scope="col" className="px-4 py-2.5 font-medium">{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {calc.products.map((x) => (
              <tr key={x.key} className="border-b border-line last:border-0">
                <th scope="row" className="px-4 py-2 font-mono font-medium">{prettyFormula(x.s.text)}</th>
                <td className="px-4 py-2 tabular-nums text-ink-2">{num(lim.extent * x.coef, 6)}</td>
                <td className="px-4 py-2 tabular-nums text-ink-2">{num(lim.extent * x.coef * x.M, 6)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <details className="rounded-xl bg-sunken p-4" open>
        <summary className="cursor-pointer text-sm font-medium text-ink">Show the working</summary>
        <ol className="mt-3 space-y-1.5 font-mono text-[0.8125rem] leading-relaxed text-ink-2">
          {calc.reactants.map((x, j) =>
            calc.moles[j] === null ? null : (
              <li key={x.key} className="break-words">
                {prettyFormula(x.s.text)}: {num(calc.moles[j]!, 6)} mol ÷ {x.coef} = {num(calc.moles[j]! / x.coef, 6)} reaction units
              </li>
            ),
          )}
          <li>Smallest value = {num(lim.extent, 6)}, so {prettyFormula(L.s.text)} limits the reaction.</li>
          <li className="break-words">
            {prettyFormula(P.s.text)}: {num(lim.extent, 6)} × {P.coef} = {num(theoMol, 6)} mol × {num(P.M, 6)} g/mol = {num(theoG, 6)} g
          </li>
          {pct !== null && <li>Percent yield = {num(calc.actualN!, 6)} / {num(theoG, 6)} × 100 = {num(pct, 4)}%</li>}
        </ol>
      </details>
    </div>
  );
}

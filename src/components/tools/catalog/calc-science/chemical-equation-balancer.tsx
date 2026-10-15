"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { Btn, CopyBtn, EmptyState, Notice, PrivacyNote, ResetBtn, SplitGrid, TextField, ToolPanel } from "@/components/tools/kit";
import { balanceEquation, formatEquation, type BalanceResult } from "./lib/equation";
import { prettyFormula } from "./lib/formula";

const EXAMPLES = [
  "Fe + O2 -> Fe2O3",
  "C3H8 + O2 -> CO2 + H2O",
  "KMnO4 + HCl -> KCl + MnCl2 + H2O + Cl2",
  "MnO4^- + Fe^2+ + H^+ -> Mn^2+ + Fe^3+ + H2O",
  "Cr2O7^2- + H+ + e- -> Cr3+ + H2O",
  "CuSO4·5H2O -> CuSO4 + H2O",
];

type Outcome = { kind: "empty" } | { kind: "parse"; message: string } | { kind: "done"; result: BalanceResult };

function run(input: string): Outcome {
  if (input.trim() === "") return { kind: "empty" };
  try {
    return { kind: "done", result: balanceEquation(input) };
  } catch (e) {
    return { kind: "parse", message: e instanceof Error ? e.message : "Could not read the equation." };
  }
}

export default function Tool() {
  const [input, setInput] = useState("");
  const deferred = useDeferredValue(input);
  const outcome = useMemo(() => run(deferred), [deferred]);
  const plain = outcome.kind === "done" && outcome.result.ok ? formatEquation(outcome.result.species, outcome.result.coefficients, false).replace("→", "->") : "";

  return (
    <SplitGrid>
      <ToolPanel title="Equation" actions={<ResetBtn onClick={() => setInput("")} />}>
        <TextField
          label="Unbalanced equation"
          hint='Separate species with + and sides with -> or =. Write charges as ^2- or ^+ (Fe3+ and OH- also work); use e- for electrons.'
          placeholder="e.g. C3H8 + O2 -> CO2 + H2O"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          spellCheck={false}
          autoComplete="off"
          className="[&_input]:font-mono"
        />
        <div className="mt-5">
          <p className="text-sm font-medium text-ink">Try an example</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {EXAMPLES.map((ex) => (
              <Btn key={ex} variant="ghost" onClick={() => setInput(ex)} className="h-auto min-h-10 max-w-full !whitespace-normal break-all py-2 text-left font-mono text-[0.8125rem]">
                {ex}
              </Btn>
            ))}
          </div>
        </div>
        <div className="mt-6 space-y-2 text-[0.8125rem] text-muted">
          <p>Coefficients you type are ignored for solving, then checked against the answer.</p>
          <p>For polyatomic ions with a charge above 1, use a caret (SO4^2-), because SO42- is ambiguous.</p>
        </div>
      </ToolPanel>

      <ToolPanel title="Balanced equation" actions={plain ? <CopyBtn text={plain} label="Copy equation" /> : undefined}>
        {outcome.kind === "empty" && (
          <EmptyState icon="atom" title="Type an equation to balance it">
            Or pick one of the examples.
          </EmptyState>
        )}
        {outcome.kind === "parse" && <Notice tone="error">{outcome.message}</Notice>}
        {outcome.kind === "done" && !outcome.result.ok && (
          <Notice tone="error" title="Cannot balance">
            {outcome.result.reason}
          </Notice>
        )}
        {outcome.kind === "done" && outcome.result.ok && (
          <div className="space-y-5">
            <div className="rounded-xl bg-accent-soft p-5" aria-live="polite" aria-atomic="true">
              <p className="text-sm text-ink-2">Balanced</p>
              <p className="mt-1 break-words font-mono text-[1.25rem] font-semibold leading-snug text-ink sm:text-[1.4rem]">{outcome.result.equation}</p>
              <p className="mt-2 text-sm text-ink-2">
                Coefficients: {outcome.result.coefficients.join(", ")}
                {outcome.result.species.every((s) => s.given !== null) &&
                  (outcome.result.givenWasBalanced ? ". Your own coefficients were already correct." : ". Your typed coefficients did not balance.")}
              </p>
            </div>

            <div className="overflow-x-auto rounded-xl shadow-[0_0_0_1px_var(--line)]">
              <table className="w-full text-left text-sm">
                <caption className="px-4 pt-3 text-left text-[0.8125rem] text-muted">Atom count check</caption>
                <thead>
                  <tr className="border-b border-line">
                    <th scope="col" className="px-4 py-2.5 font-medium">Element</th>
                    <th scope="col" className="px-4 py-2.5 font-medium">Reactants</th>
                    <th scope="col" className="px-4 py-2.5 font-medium">Products</th>
                    <th scope="col" className="px-4 py-2.5 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {outcome.result.check.map((r) => (
                    <tr key={r.label} className="border-b border-line last:border-0">
                      <th scope="row" className="px-4 py-2 font-medium">{r.label}</th>
                      <td className="px-4 py-2 tabular-nums text-ink-2">{r.left}</td>
                      <td className="px-4 py-2 tabular-nums text-ink-2">{r.right}</td>
                      <td className="px-4 py-2 text-ink-2">{r.left === r.right ? "Balanced" : "Not balanced"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <details className="rounded-xl bg-sunken p-4">
              <summary className="cursor-pointer text-sm font-medium text-ink">Show the working</summary>
              <ol className="mt-3 space-y-1.5 font-mono text-[0.8125rem] leading-relaxed text-ink-2">
                <li>Unknown coefficients: {outcome.result.species.map((s, i) => `x${i + 1}·${prettyFormula(s.text)}`).join(", ")}</li>
                {outcome.result.check.map((r) => {
                  const terms = (side: "reactant" | "product") =>
                    outcome.result.ok
                      ? outcome.result.species
                          .map((s, i) => ({ s, i }))
                          .filter(({ s }) => s.side === side)
                          .map(({ s, i }) => {
                            const n = r.label === "Charge" ? s.charge : s.counts.get(r.label) ?? 0;
                            return n === 0 ? null : `${n === 1 ? "" : n}x${i + 1}`;
                          })
                          .filter(Boolean)
                          .join(" + ") || "0"
                      : "";
                  return (
                    <li key={r.label} className="break-words">
                      {r.label}: {terms("reactant")} = {terms("product")}
                    </li>
                  );
                })}
                <li>Solved exactly with fractions, then scaled to the smallest whole numbers: {outcome.result.coefficients.join(", ")}</li>
              </ol>
            </details>
          </div>
        )}
        <div className="mt-6">
          <PrivacyNote />
        </div>
      </ToolPanel>
    </SplitGrid>
  );
}

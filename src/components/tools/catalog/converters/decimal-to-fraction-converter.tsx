"use client";

import { useDeferredValue, useState } from "react";
import { CopyBtn, EmptyState, NumberField, PrivacyNote, ResetBtn, StatGrid, TextField, ToolPanel, parseNum } from "@/components/tools/kit";
import { num } from "@/components/tools/engines/FormulaTool";
import { fractionToNumber, limitDenominator, mixed, parseDecimal, rulerFraction } from "./lib/numbers";

const RULERS = [16, 32, 64];

function signedError(e: number) {
  if (Math.abs(e) < 1e-15) return "exact";
  return `${e > 0 ? "+" : "−"}${num(Math.abs(e), 4)}`;
}

export default function Tool() {
  const [input, setInput] = useState("0.1(6)");
  const [maxDen, setMaxDen] = useState("100");
  const v = useDeferredValue(input);

  const md = parseNum(maxDen);
  const mdErr = maxDen.trim() && (md === null || !Number.isInteger(md) || md < 1 || md > 1e12) ? "Use a whole number from 1 to 10^12." : null;

  const parsed = v.trim() ? parseDecimal(v) : null;
  const ok = parsed?.ok ? parsed : null;
  const value = ok ? fractionToNumber(ok.frac) : NaN;
  const exactText = ok ? (ok.frac.den === BigInt(1) ? `${ok.frac.num}` : `${ok.frac.num}/${ok.frac.den}`) : "";
  const approx = ok && md !== null && !mdErr ? limitDenominator(ok.frac, BigInt(md)) : null;
  const approxErr = approx ? fractionToNumber(approx) - value : 0;

  return (
    <div className="space-y-5">
      <ToolPanel
        title="Convert"
        actions={
          <>
            <CopyBtn text={exactText} label="Copy fraction" />
            <ResetBtn
              onClick={() => {
                setInput("0.1(6)");
                setMaxDen("100");
              }}
            />
          </>
        }
      >
        <div className="grid gap-5 sm:grid-cols-[2fr_1fr]">
          <TextField
            label="Decimal"
            hint="Repeating digits: put them in parentheses, 0.1(6), or end with an ellipsis, 0.1666…"
            autoComplete="off"
            spellCheck={false}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            error={parsed && !parsed.ok ? parsed.error : null}
          />
          <NumberField
            label="Max denominator"
            hint="For the approximation."
            value={maxDen}
            onChange={(e) => setMaxDen(e.target.value)}
            error={mdErr}
          />
        </div>

        <div className="mt-6 space-y-5" aria-live="polite">
          {!v.trim() ? (
            <EmptyState icon="percent" title="Type a decimal such as 0.375" />
          ) : ok ? (
            <>
              <div className="rounded-xl bg-accent-soft p-5">
                <p className="text-sm text-ink-2">Exact fraction (simplified)</p>
                <p className="mt-1 break-all font-display text-[2.25rem] font-semibold leading-tight tabular-nums text-ink">{exactText}</p>
                <p className="mt-2 text-sm text-ink-2">
                  Mixed number: <strong className="text-ink">{mixed(ok.frac)}</strong>
                  {ok.repeating && (
                    <>
                      {" "}
                      · Repeating block &ldquo;{ok.repeating}&rdquo;{ok.inferred ? " (detected from the ellipsis)" : ""}
                    </>
                  )}
                </p>
              </div>
              {approx && (
                <StatGrid
                  items={[
                    { label: "Decimal value", value: num(value, 12) },
                    { label: `Best fraction, denominator ≤ ${num(md!)}`, value: mixed(approx) },
                    { label: "Approximation error", value: signedError(approxErr) },
                  ]}
                />
              )}
              <div>
                <h3 className="mb-2 text-sm font-medium text-ink">Nearest ruler fractions</h3>
                <div className="overflow-x-auto rounded-xl shadow-[0_0_0_1px_var(--line)]" tabIndex={0} role="region" aria-label="Nearest ruler fractions">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-line">
                        {["Precision", "Nearest", "Decimal", "Difference"].map((h) => (
                          <th key={h} scope="col" className="whitespace-nowrap px-4 py-2.5 font-medium text-ink">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {RULERS.map((d) => {
                        const r = rulerFraction(value, d);
                        return (
                          <tr key={d} className="border-b border-line last:border-0">
                            <th scope="row" className="whitespace-nowrap px-4 py-2 font-normal text-ink-2">
                              1/{d}
                            </th>
                            <td className="whitespace-nowrap px-4 py-2 font-medium tabular-nums text-ink">{mixed({ num: r.num, den: r.den })}</td>
                            <td className="whitespace-nowrap px-4 py-2 tabular-nums text-ink-2">{num(r.num / r.den, 8)}</td>
                            <td className="whitespace-nowrap px-4 py-2 tabular-nums text-ink-2">{signedError(r.error)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : null}
        </div>
      </ToolPanel>
      <PrivacyNote />
    </div>
  );
}

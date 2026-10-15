"use client";

import { useDeferredValue, useState } from "react";
import { CopyBtn, EmptyState, Notice, PrivacyNote, ResetBtn, ResultCard, Segmented, TextField, ToolPanel } from "@/components/tools/kit";
import { fromRoman, toRoman } from "./lib/numbers";

type Mode = "toRoman" | "toNumber";

const PARTS: [number, string][] = [
  [1000, "M"], [900, "CM"], [500, "D"], [400, "CD"], [100, "C"], [90, "XC"],
  [50, "L"], [40, "XL"], [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"],
];

function breakdown(n: number): string {
  const out: string[] = [];
  for (const [v, s] of PARTS) {
    while (n >= v) {
      out.push(`${s} (${v})`);
      n -= v;
    }
  }
  return out.join(" + ");
}

export default function Tool() {
  const [mode, setMode] = useState<Mode>("toRoman");
  const [numIn, setNumIn] = useState("2026");
  const [romIn, setRomIn] = useState("MCMXCIV");
  const n = useDeferredValue(numIn);
  const r = useDeferredValue(romIn);

  let content: React.ReactNode;
  let copy = "";
  if (mode === "toRoman") {
    const s = n.trim().replace(/,/g, "");
    if (!s) content = <EmptyState icon="hash" title="Type a whole number from 1 to 3999" />;
    else if (!/^\d+$/.test(s)) content = <Notice tone="error">Enter a whole number without decimals or signs, for example 1987.</Notice>;
    else {
      const v = Number(s);
      const roman = toRoman(v);
      if (!roman)
        content = (
          <Notice tone="error">
            Standard Roman numerals cover 1 to 3999. There is no symbol for zero, and larger numbers need a vinculum (a bar over a symbol multiplies it by 1000),
            which this converter does not support.
          </Notice>
        );
      else {
        copy = roman;
        content = <ResultCard label={`${v.toLocaleString("en-US")} in Roman numerals`} value={<span className="break-all">{roman}</span>} detail={breakdown(v)} />;
      }
    }
  } else {
    const s = r.trim();
    if (!s) content = <EmptyState icon="hash" title="Type a Roman numeral such as XLII" />;
    else {
      const p = fromRoman(s);
      if (p.ok) {
        copy = String(p.value);
        content = <ResultCard label={`${s.toUpperCase()} as a number`} value={p.value.toLocaleString("en-US")} detail={breakdown(p.value)} />;
      } else
        content = (
          <Notice tone="error" title="Not a valid standard numeral">
            {p.error}
            {p.suggestion && p.lenientValue !== undefined && (
              <>
                {" "}
                Read loosely it adds up to {p.lenientValue}, which is written <strong>{p.suggestion}</strong>.
              </>
            )}
          </Notice>
        );
    }
  }

  return (
    <div className="space-y-5">
      <ToolPanel
        title="Convert"
        actions={
          <>
            {copy && <CopyBtn text={copy} label="Copy result" />}
            <ResetBtn
              onClick={() => {
                setNumIn("2026");
                setRomIn("MCMXCIV");
              }}
            />
          </>
        }
      >
        <div className="mb-5">
          <Segmented
            label="Direction"
            value={mode}
            onChange={setMode}
            options={[
              { value: "toRoman", label: "Number to Roman" },
              { value: "toNumber", label: "Roman to number" },
            ]}
          />
        </div>
        {mode === "toRoman" ? (
          <TextField label="Number (1 to 3999)" inputMode="numeric" autoComplete="off" value={numIn} onChange={(e) => setNumIn(e.target.value)} />
        ) : (
          <TextField
            label="Roman numeral"
            hint="Uses I, V, X, L, C, D and M. Upper or lower case both work."
            autoComplete="off"
            spellCheck={false}
            value={romIn}
            onChange={(e) => setRomIn(e.target.value)}
          />
        )}
        <div className="mt-6" aria-live="polite">
          {content}
        </div>
      </ToolPanel>
      <ToolPanel title="Symbols and rules">
        <dl className="grid grid-cols-4 gap-px overflow-hidden rounded-xl bg-line shadow-[0_0_0_1px_var(--line)] sm:grid-cols-7">
          {[["I", 1], ["V", 5], ["X", 10], ["L", 50], ["C", 100], ["D", 500], ["M", 1000]].map(([s, v]) => (
            <div key={s} className="bg-surface px-3 py-2 text-center">
              <dt className="font-display text-lg font-semibold text-ink">{s}</dt>
              <dd className="text-sm tabular-nums text-muted">{v}</dd>
            </div>
          ))}
        </dl>
        <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-ink-2">
          <li>I, X, C and M repeat up to three times in a row; V, L and D never repeat.</li>
          <li>Only six subtractive pairs exist: IV (4), IX (9), XL (40), XC (90), CD (400) and CM (900).</li>
          <li>Forms like IIII on clock faces or IC for 99 appear in the wild, but they are not standard, so this tool flags them.</li>
        </ul>
      </ToolPanel>
      <PrivacyNote />
    </div>
  );
}

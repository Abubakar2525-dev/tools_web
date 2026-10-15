"use client";

import { useState } from "react";
import { Btn, Checkbox, CopyBtn, EmptyState, Notice, NumberField, PrivacyNote, ResetBtn, ResultCard, SelectField, ToolPanel, downloadFile, parseNum } from "@/components/tools/kit";
import { cryptoSource, generate } from "./lib/random";

const DEFAULTS = { min: "1", max: "100", count: "1", decimals: "0", unique: false, sort: "none" as "none" | "asc" | "desc", sep: "newline" };

export default function Tool() {
  const [f, setF] = useState(DEFAULTS);
  const [out, setOut] = useState<number[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof typeof DEFAULTS>(k: K, v: (typeof DEFAULTS)[K]) => setF((s) => ({ ...s, [k]: v }));

  const run = () => {
    const min = parseNum(f.min);
    const max = parseNum(f.max);
    const count = parseNum(f.count);
    const decimals = Number(f.decimals);
    if (min === null || max === null) return setError("Enter a minimum and a maximum.");
    if (count === null) return setError("Enter how many numbers to generate.");
    const r = generate({ min, max, count, decimals, unique: f.unique, sort: f.sort }, cryptoSource());
    if (typeof r === "string") {
      setError(r);
      setOut(null);
    } else {
      setError(null);
      setOut(r);
    }
  };

  const sep = f.sep === "comma" ? ", " : f.sep === "space" ? " " : "\n";
  const decimals = Number(f.decimals);
  const text = out ? out.map((n) => n.toFixed(decimals)).join(sep) : "";

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
      <ToolPanel
        title="Settings"
        actions={
          <ResetBtn
            onClick={() => {
              setF(DEFAULTS);
              setOut(null);
              setError(null);
            }}
          />
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <NumberField label="Minimum" value={f.min} onChange={(e) => set("min", e.target.value)} />
          <NumberField label="Maximum" value={f.max} onChange={(e) => set("max", e.target.value)} />
          <NumberField label="How many" value={f.count} onChange={(e) => set("count", e.target.value)} hint="Up to 10,000." />
          <SelectField
            label="Decimal places"
            value={f.decimals}
            onChange={(e) => set("decimals", e.target.value)}
            options={["0", "1", "2", "3", "4", "5", "6"].map((d) => ({ value: d, label: d === "0" ? "Whole numbers" : `${d} decimal${d === "1" ? "" : "s"}` }))}
          />
          <SelectField
            label="Order"
            value={f.sort}
            onChange={(e) => set("sort", e.target.value as typeof f.sort)}
            options={[
              { value: "none", label: "As generated" },
              { value: "asc", label: "Smallest first" },
              { value: "desc", label: "Largest first" },
            ]}
          />
          <SelectField
            label="Separator"
            value={f.sep}
            onChange={(e) => set("sep", e.target.value)}
            options={[
              { value: "newline", label: "New line" },
              { value: "comma", label: "Comma" },
              { value: "space", label: "Space" },
            ]}
          />
          <div className="sm:col-span-2">
            <Checkbox label="No repeats (each number at most once)" checked={f.unique} onChange={(v) => set("unique", v)} />
          </div>
        </div>
        <div className="mt-6">
          <Btn icon="spark" onClick={run}>
            Generate
          </Btn>
        </div>
      </ToolPanel>

      <ToolPanel
        title="Numbers"
        actions={
          text ? (
            <>
              <Btn variant="ghost" icon="download" onClick={() => downloadFile("random-numbers.txt", text)}>
                Download
              </Btn>
              <CopyBtn text={text} />
            </>
          ) : undefined
        }
      >
        <div className="space-y-5">
          {error && <Notice tone="error">{error}</Notice>}
          {!out && !error && <EmptyState icon="hash" title="Press Generate">Numbers come from your browser&apos;s cryptographic random generator.</EmptyState>}
          {out && out.length === 1 && <ResultCard label={`Random number from ${f.min} to ${f.max}`} value={out[0].toFixed(decimals)} />}
          {out && out.length > 1 && (
            <>
              <p className="text-sm text-ink-2" aria-live="polite">
                {out.length.toLocaleString()} numbers{f.unique ? ", no repeats" : ""}.
              </p>
              <div tabIndex={0} aria-label="Generated numbers" className="max-h-[360px] overflow-auto rounded-lg bg-sunken p-4 font-mono text-[0.9rem] leading-relaxed tabular-nums text-ink">
                {f.sep === "newline" ? out.map((n, i) => <div key={i}>{n.toFixed(decimals)}</div>) : text}
              </div>
            </>
          )}
          <PrivacyNote />
        </div>
      </ToolPanel>
    </div>
  );
}

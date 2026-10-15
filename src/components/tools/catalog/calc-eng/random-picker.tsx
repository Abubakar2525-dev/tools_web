"use client";

import { useMemo, useState } from "react";
import { Btn, Checkbox, CopyBtn, EmptyState, Notice, NumberField, PrivacyNote, ResetBtn, ResultCard, Segmented, TextArea, ToolPanel, parseNum, usePersistentState } from "@/components/tools/kit";
import { cryptoSource, parseWeighted, pick, shuffle, splitTeams, weightedPick } from "./lib/random";

type Mode = "pick" | "shuffle" | "teams";
type Out = { mode: Mode; items: string[]; teams?: string[][] };

const SAMPLE = "Ada\nGrace\nLinus\nMargaret\nAlan\nKatherine\nDennis\nBarbara";

export default function Tool() {
  const [list, setList, clearList] = usePersistentState("random-picker", SAMPLE);
  const [mode, setMode] = useState<Mode>("pick");
  const [n, setN] = useState("1");
  const [weighted, setWeighted] = useState(false);
  const [dedupe, setDedupe] = useState(false);
  const [out, setOut] = useState<Out | null>(null);
  const [error, setError] = useState<string | null>(null);

  const entries = useMemo(() => {
    let lines = list
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (dedupe) lines = [...new Set(lines)];
    return lines.map((l) => (weighted ? parseWeighted(l) : { name: l, weight: 1 }));
  }, [list, weighted, dedupe]);

  const run = () => {
    const src = cryptoSource();
    if (entries.length === 0) return setError("Add at least one entry, one per line.");
    const names = entries.map((e) => e.name);
    if (mode === "shuffle") {
      setError(null);
      return setOut({ mode, items: shuffle(names, src) });
    }
    const k = parseNum(n);
    if (k === null || !Number.isInteger(k) || k < 1) return setError(mode === "teams" ? "Enter a whole number of teams (2 or more)." : "Enter how many to pick (a whole number).");
    if (mode === "teams") {
      if (k < 2) return setError("Split into at least 2 teams.");
      if (k > names.length) return setError(`There are only ${names.length} entries, so at most ${names.length} teams.`);
      setError(null);
      return setOut({ mode, items: [], teams: splitTeams(names, k, src) });
    }
    if (k > entries.length) return setError(`You asked for ${k} but the list has ${entries.length} entries. Picks are without repeats.`);
    if (weighted && entries.filter((e) => e.weight > 0).length < k) return setError("Not enough entries with a weight above zero.");
    setError(null);
    setOut({ mode, items: weighted ? weightedPick(entries.map((e) => ({ item: e.name, weight: e.weight })), k, src) : pick(names, k, src) });
  };

  const text = out ? (out.teams ? out.teams.map((t, i) => `Team ${i + 1}: ${t.join(", ")}`).join("\n") : out.items.join("\n")) : "";
  const totalW = entries.reduce((s, e) => s + e.weight, 0);

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
      <ToolPanel
        title="Entries"
        actions={
          <ResetBtn
            onClick={() => {
              clearList();
              setOut(null);
              setError(null);
            }}
          />
        }
      >
        <div className="space-y-5">
          <TextArea
            label="One entry per line"
            hint={weighted ? 'Add a weight after a comma, e.g. "Pizza, 3". Entries without one get weight 1.' : `${entries.length} entr${entries.length === 1 ? "y" : "ies"}.`}
            value={list}
            onChange={(e) => setList(e.target.value)}
          />
          <Segmented
            label="What to do"
            value={mode}
            onChange={setMode}
            options={[
              { value: "pick", label: "Pick" },
              { value: "shuffle", label: "Shuffle all" },
              { value: "teams", label: "Split into teams" },
            ]}
          />
          {mode !== "shuffle" && <NumberField label={mode === "teams" ? "Number of teams" : "How many to pick"} value={n} onChange={(e) => setN(e.target.value)} />}
          {mode === "pick" && <Checkbox label="Weighted picks" hint="Higher weights are proportionally more likely." checked={weighted} onChange={setWeighted} />}
          <Checkbox label="Remove duplicate lines" checked={dedupe} onChange={setDedupe} />
          <Btn icon="spark" onClick={run}>
            {mode === "pick" ? "Pick" : mode === "shuffle" ? "Shuffle" : "Make teams"}
          </Btn>
        </div>
      </ToolPanel>

      <ToolPanel title="Result" actions={text ? <CopyBtn text={text} /> : undefined}>
        <div className="space-y-5">
          {error && <Notice tone="error">{error}</Notice>}
          {!out && !error && <EmptyState icon="spark" title="Nothing picked yet">Choose an action and press the button.</EmptyState>}
          {out && !out.teams && out.items.length === 1 && <ResultCard label="Picked" value={out.items[0]} />}
          {out && !out.teams && out.items.length > 1 && (
            <ol className="list-decimal space-y-1 rounded-lg bg-sunken py-3 pl-10 pr-4 text-ink" aria-live="polite">
              {out.items.map((x, i) => (
                <li key={i}>{x}</li>
              ))}
            </ol>
          )}
          {out?.teams && (
            <div className="grid gap-3 sm:grid-cols-2" aria-live="polite">
              {out.teams.map((t, i) => (
                <div key={i} className="rounded-lg bg-sunken p-4">
                  <p className="font-medium text-ink">
                    Team {i + 1} <span className="font-normal text-muted">({t.length})</span>
                  </p>
                  <ul className="mt-2 space-y-0.5 text-sm text-ink-2">
                    {t.map((x, j) => (
                      <li key={j}>{x}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
          {weighted && mode === "pick" && totalW > 0 && (
            <p className="text-[0.8125rem] text-muted">
              First-pick odds: {entries.filter((e) => e.weight > 0).slice(0, 8).map((e) => `${e.name} ${((e.weight / totalW) * 100).toFixed(1)}%`).join(", ")}
              {entries.length > 8 ? ", ..." : ""}
            </p>
          )}
          <PrivacyNote stored />
        </div>
      </ToolPanel>
    </div>
  );
}

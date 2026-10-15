"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import {
  Btn,
  Checkbox,
  EmptyState,
  Notice,
  PrivacyNote,
  ResetBtn,
  Segmented,
  SplitGrid,
  StatGrid,
  TextArea,
  ToolPanel,
  downloadFile,
  fmt,
} from "@/components/tools/kit";
import { Spinner } from "@/components/tools/engines/files";

type DiffLib = typeof import("diff");
type Part = { value: string; added: boolean; removed: boolean };
type Granularity = "line" | "word" | "char";
type View = "split" | "inline";

type Row = { kind: "same" | "del" | "add" | "change"; left: string | null; right: string | null; ln: number | null; rn: number | null };

const SAMPLE_A = `Shipping policy
Orders ship within 2 business days.
Standard delivery takes 5-7 days.
Returns are accepted for 14 days.
Contact support@example.com for help.`;
const SAMPLE_B = `Shipping policy
Orders ship within 1 business day.
Standard delivery takes 5-7 days.
Express delivery takes 2 days.
Returns are accepted for 30 days.
Contact support@example.com for help.`;

const MAX_CHARS = 400_000;

function normLine(l: string, ws: boolean, ci: boolean) {
  let s = ws ? l.replace(/\s+/g, " ").trim() : l;
  if (ci) s = s.toLocaleLowerCase();
  return s;
}

function splitKeepLines(t: string) {
  const lines = t.replace(/\r\n?/g, "\n").split("\n");
  if (lines.length > 1 && lines[lines.length - 1] === "") lines.pop();
  return lines;
}

/** Pairs removed/added runs so changed lines sit side by side. */
function buildRows(changes: { value: string[]; added: boolean; removed: boolean }[], aLines: string[], bLines: string[]): Row[] {
  const rows: Row[] = [];
  let ai = 0;
  let bi = 0;
  for (let i = 0; i < changes.length; i++) {
    const c = changes[i];
    const n = c.value.length;
    if (!c.added && !c.removed) {
      for (let k = 0; k < n; k++) rows.push({ kind: "same", left: aLines[ai], right: bLines[bi], ln: ++ai, rn: ++bi });
    } else if (c.removed && changes[i + 1]?.added) {
      const m = changes[i + 1].value.length;
      for (let k = 0; k < Math.max(n, m); k++) {
        const l = k < n ? aLines[ai] : null;
        const r = k < m ? bLines[bi] : null;
        rows.push({ kind: l !== null && r !== null ? "change" : l !== null ? "del" : "add", left: l, right: r, ln: l !== null ? ++ai : null, rn: r !== null ? ++bi : null });
      }
      i++;
    } else if (c.removed) {
      for (let k = 0; k < n; k++) rows.push({ kind: "del", left: aLines[ai], right: null, ln: ++ai, rn: null });
    } else {
      for (let k = 0; k < n; k++) rows.push({ kind: "add", left: null, right: bLines[bi], ln: null, rn: ++bi });
    }
  }
  return rows;
}

const delCls = "bg-[color-mix(in_oklch,var(--danger)_14%,transparent)]";
const addCls = "bg-[color-mix(in_oklch,oklch(0.7_0.15_150)_20%,transparent)]";

function InlineParts({ parts, side }: { parts: Part[]; side?: "left" | "right" }) {
  return (
    <>
      {parts.map((p, i) => {
        if (p.removed) {
          if (side === "right") return null;
          return (
            <del key={i} className={`${delCls} rounded-sm decoration-[var(--danger)]`}>
              <span className="sr-only">[removed: </span>
              {p.value}
              <span className="sr-only">]</span>
            </del>
          );
        }
        if (p.added) {
          if (side === "left") return null;
          return (
            <ins key={i} className={`${addCls} rounded-sm underline decoration-dotted`}>
              <span className="sr-only">[added: </span>
              {p.value}
              <span className="sr-only">]</span>
            </ins>
          );
        }
        return <span key={i}>{p.value}</span>;
      })}
    </>
  );
}

export default function Tool() {
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  const [gran, setGran] = useState<Granularity>("line");
  const [view, setView] = useState<View>("split");
  const [ignoreWs, setIgnoreWs] = useState(false);
  const [ignoreCase, setIgnoreCase] = useState(false);
  const [lib, setLib] = useState<DiffLib | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const da = useDeferredValue(a);
  const db = useDeferredValue(b);

  useEffect(() => {
    let alive = true;
    import("diff")
      .then((m) => alive && setLib(m))
      .catch(() => alive && setLoadError("The diff engine could not be loaded. Check your connection and reload the page."));
    return () => {
      alive = false;
    };
  }, []);

  const tooBig = da.length + db.length > MAX_CHARS;

  const result = useMemo(() => {
    if (!lib || (!da && !db) || tooBig) return null;
    if (gran === "line") {
      const aLines = splitKeepLines(da);
      const bLines = splitKeepLines(db);
      const changes = lib.diffArrays(aLines, bLines, { comparator: (x: string, y: string) => normLine(x, ignoreWs, ignoreCase) === normLine(y, ignoreWs, ignoreCase) });
      const rows = buildRows(changes, aLines, bLines);
      // Word-level highlight inside changed line pairs.
      const inner = rows.map((r) =>
        r.kind === "change" && r.left !== null && r.right !== null
          ? (lib.diffWordsWithSpace(r.left, r.right, { ignoreCase }) as Part[])
          : null,
      );
      const added = rows.filter((r) => r.right !== null && r.kind !== "same").length;
      const removed = rows.filter((r) => r.left !== null && r.kind !== "same").length;
      return { kind: "line" as const, rows, inner, added, removed, same: rows.length && added + removed === 0 };
    }
    const parts = (
      gran === "word"
        ? ignoreWs
          ? lib.diffWords(da, db, { ignoreCase })
          : lib.diffWordsWithSpace(da, db, { ignoreCase })
        : lib.diffChars(da, db, { ignoreCase })
    ) as Part[];
    const added = parts.filter((p) => p.added).reduce((n, p) => n + (gran === "char" ? Array.from(p.value).length : p.value.split(/\s+/).filter(Boolean).length), 0);
    const removed = parts.filter((p) => p.removed).reduce((n, p) => n + (gran === "char" ? Array.from(p.value).length : p.value.split(/\s+/).filter(Boolean).length), 0);
    return { kind: "parts" as const, parts, added, removed, same: !parts.some((p) => p.added || p.removed) };
  }, [lib, da, db, gran, ignoreWs, ignoreCase, tooBig]);

  const exportPatch = () => {
    if (!lib) return;
    const patch = lib.createTwoFilesPatch("original.txt", "changed.txt", a, b, undefined, undefined, { context: 3, ignoreWhitespace: ignoreWs });
    downloadFile("changes.diff", patch, "text/x-diff");
  };

  const unit = gran === "line" ? "lines" : gran === "word" ? "words" : "characters";

  return (
    <div className="space-y-5">
      <ToolPanel
        title="Texts to compare"
        actions={
          <>
            <Btn
              variant="ghost"
              icon="spark"
              onClick={() => {
                setA(SAMPLE_A);
                setB(SAMPLE_B);
              }}
            >
              Load sample
            </Btn>
            <Btn
              variant="subtle"
              icon="swap"
              onClick={() => {
                setA(b);
                setB(a);
              }}
            >
              Swap
            </Btn>
            <ResetBtn
              onClick={() => {
                setA("");
                setB("");
              }}
            />
          </>
        }
      >
        <SplitGrid>
          <TextArea label="Original" mono value={a} onChange={(e) => setA(e.target.value)} rows={10} />
          <TextArea label="Changed" mono value={b} onChange={(e) => setB(e.target.value)} rows={10} />
        </SplitGrid>
        <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-4">
          <Segmented
            label="Compare by"
            value={gran}
            onChange={setGran}
            options={[
              { value: "line", label: "Lines" },
              { value: "word", label: "Words" },
              { value: "char", label: "Characters" },
            ]}
          />
          <Segmented
            label="View"
            value={view}
            onChange={setView}
            options={[
              { value: "split", label: "Side by side" },
              { value: "inline", label: "Inline" },
            ]}
          />
          <Checkbox label="Ignore whitespace" checked={ignoreWs} onChange={setIgnoreWs} hint={gran === "char" ? "Not applied in character mode." : undefined} />
          <Checkbox label="Ignore case" checked={ignoreCase} onChange={setIgnoreCase} />
        </div>
      </ToolPanel>

      <ToolPanel
        title="Differences"
        actions={
          <Btn variant="ghost" icon="download" disabled={!lib || (!a && !b)} onClick={exportPatch}>
            Download .diff
          </Btn>
        }
      >
        {loadError ? (
          <Notice tone="error">{loadError}</Notice>
        ) : !lib ? (
          <Spinner label="Loading diff engine" />
        ) : tooBig ? (
          <Notice tone="warning">These texts are very large (over {fmt(MAX_CHARS, 0)} characters together). Compare smaller sections to keep the page responsive.</Notice>
        ) : !result ? (
          <EmptyState icon="swap" title="Nothing to compare yet">
            Paste the original on the left and the changed version on the right.
          </EmptyState>
        ) : (
          <div className="space-y-4">
            {result.same ? (
              <Notice tone="success">No differences found{ignoreWs || ignoreCase ? " with the current ignore options" : ""}.</Notice>
            ) : (
              <StatGrid
                items={[
                  { label: `Added ${unit}`, value: `+${fmt(result.added, 0)}` },
                  { label: `Removed ${unit}`, value: `−${fmt(result.removed, 0)}` },
                  { label: "Compared by", value: unit },
                ]}
              />
            )}
            <p className="text-[0.8125rem] text-muted">
              <span className="font-mono">−</span> marks removed text, <span className="font-mono">+</span> marks added text. Removed text is struck through; added text is underlined.
            </p>
            {result.kind === "line" ? (
              view === "split" ? (
                <div className="max-h-[560px] overflow-auto rounded-lg shadow-[inset_0_0_0_1px_var(--line-strong)]" tabIndex={0} aria-label="Side by side differences">
                  <table className="w-full min-w-[640px] border-collapse font-mono text-[0.8125rem] leading-relaxed">
                    <caption className="sr-only">Original on the left, changed on the right</caption>
                    <thead className="sr-only">
                      <tr>
                        <th scope="col">Original line</th>
                        <th scope="col">Original text</th>
                        <th scope="col">Changed line</th>
                        <th scope="col">Changed text</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.rows.map((r, i) => (
                        <tr key={i} className="align-top">
                          <td className="w-10 select-none px-2 text-right text-muted">{r.ln ?? ""}</td>
                          <td className={`w-1/2 whitespace-pre-wrap break-all px-2 ${r.left !== null && r.kind !== "same" ? delCls : ""}`}>
                            {r.left !== null && r.kind !== "same" && <span aria-hidden="true" className="select-none text-danger">− </span>}
                            {r.left === null ? "" : result.inner[i] ? <InlineParts parts={result.inner[i]!} side="left" /> : r.left}
                          </td>
                          <td className="w-10 select-none border-l border-line px-2 text-right text-muted">{r.rn ?? ""}</td>
                          <td className={`w-1/2 whitespace-pre-wrap break-all px-2 ${r.right !== null && r.kind !== "same" ? addCls : ""}`}>
                            {r.right !== null && r.kind !== "same" && <span aria-hidden="true" className="select-none text-accent-strong">+ </span>}
                            {r.right === null ? "" : result.inner[i] ? <InlineParts parts={result.inner[i]!} side="right" /> : r.right}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="max-h-[560px] overflow-auto rounded-lg p-2 font-mono text-[0.8125rem] leading-relaxed shadow-[inset_0_0_0_1px_var(--line-strong)]" tabIndex={0} aria-label="Inline differences">
                  {result.rows.flatMap((r, i) => {
                    const out: React.ReactNode[] = [];
                    if (r.left !== null && r.kind !== "same")
                      out.push(
                        <div key={`${i}l`} className={`whitespace-pre-wrap break-all px-2 ${delCls}`}>
                          <span className="select-none">− </span>
                          <span className="sr-only">removed: </span>
                          {r.left}
                        </div>,
                      );
                    if (r.right !== null && r.kind !== "same")
                      out.push(
                        <div key={`${i}r`} className={`whitespace-pre-wrap break-all px-2 ${addCls}`}>
                          <span className="select-none">+ </span>
                          <span className="sr-only">added: </span>
                          {r.right}
                        </div>,
                      );
                    if (r.kind === "same")
                      out.push(
                        <div key={i} className="whitespace-pre-wrap break-all px-2 text-ink-2">
                          <span className="select-none">{"  "}</span>
                          {r.right}
                        </div>,
                      );
                    return out;
                  })}
                </div>
              )
            ) : view === "split" ? (
              <SplitGrid>
                <div className="min-w-0">
                  <p className="mb-2 text-sm font-medium">Original (− removed)</p>
                  <div className="max-h-[480px] overflow-auto whitespace-pre-wrap break-words rounded-lg p-3 font-mono text-[0.8125rem] shadow-[inset_0_0_0_1px_var(--line-strong)]">
                    <InlineParts parts={result.parts} side="left" />
                  </div>
                </div>
                <div className="min-w-0">
                  <p className="mb-2 text-sm font-medium">Changed (+ added)</p>
                  <div className="max-h-[480px] overflow-auto whitespace-pre-wrap break-words rounded-lg p-3 font-mono text-[0.8125rem] shadow-[inset_0_0_0_1px_var(--line-strong)]">
                    <InlineParts parts={result.parts} side="right" />
                  </div>
                </div>
              </SplitGrid>
            ) : (
              <div className="max-h-[480px] overflow-auto whitespace-pre-wrap break-words rounded-lg p-3 font-mono text-[0.8125rem] shadow-[inset_0_0_0_1px_var(--line-strong)]">
                <InlineParts parts={result.parts} />
              </div>
            )}
          </div>
        )}
      </ToolPanel>
      <PrivacyNote />
    </div>
  );
}

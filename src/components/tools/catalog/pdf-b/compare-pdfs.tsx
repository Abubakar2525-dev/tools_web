"use client";

import { useState } from "react";
import { Btn, Checkbox, Notice, PrivacyNote, Segmented, StatGrid, ToolPanel, downloadFile } from "@/components/tools/kit";
import { Spinner } from "@/components/tools/engines/files";
import { openPdf } from "@/components/tools/engines/pdf";
import { PdfPicker, type PdfSource } from "./shared";
import { type DiffRow, type TaggedLine, type TextChunk, changesToRows, chunksToLines, compareKey, rowsToReport, sideBySide, summarizeRows } from "./lib/text";

const MAX_ROWS = 4000;

async function extractLines(bytes: Uint8Array): Promise<{ lines: TaggedLine[]; pages: number }> {
  const doc = await openPdf(bytes);
  try {
    const lines: TaggedLine[] = [];
    for (let p = 1; p <= doc.numPages; p++) {
      const page = await doc.getPage(p);
      const tc = await page.getTextContent();
      const chunks: TextChunk[] = [];
      for (const it of tc.items) {
        if (!("str" in it)) continue;
        const t = it.transform as number[];
        chunks.push({ str: it.str, x: t[4], y: t[5], h: it.height || Math.hypot(t[2], t[3]) || 10, w: it.width });
      }
      for (const text of chunksToLines(chunks)) lines.push({ text, page: p });
      page.cleanup();
    }
    return { lines, pages: doc.numPages };
  } finally {
    void doc.loadingTask.destroy().catch(() => undefined);
  }
}

interface Result {
  rows: DiffRow[];
  pagesA: number;
  pagesB: number;
  linesA: number;
  linesB: number;
  key: string;
}

const MARK = { removed: "−", added: "+", same: " " } as const;

export default function Tool() {
  const [a, setA] = useState<PdfSource | null>(null);
  const [b, setB] = useState<PdfSource | null>(null);
  const [ignoreCase, setIgnoreCase] = useState(false);
  const [ignoreWs, setIgnoreWs] = useState(true);
  const [onlyChanges, setOnlyChanges] = useState(true);
  const [view, setView] = useState<"side" | "inline">("side");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);

  const key = a && b ? `${a.file.name}:${a.bytes.length}|${b.file.name}:${b.bytes.length}|${ignoreCase}|${ignoreWs}` : "";
  const fresh = result && result.key === key ? result : null;

  async function compare() {
    if (!a || !b) return;
    setBusy(true);
    setError(null);
    try {
      const [ea, eb] = await Promise.all([extractLines(a.bytes), extractLines(b.bytes)]);
      if (ea.lines.length === 0 && eb.lines.length === 0) throw new Error("Neither PDF has a text layer (they may be scans). Run them through OCR first.");
      const { diffArrays } = await import("diff");
      const changes = diffArrays(
        ea.lines.map((l) => compareKey(l.text, ignoreCase, ignoreWs)),
        eb.lines.map((l) => compareKey(l.text, ignoreCase, ignoreWs)),
      );
      setResult({ rows: changesToRows(changes, ea.lines, eb.lines), pagesA: ea.pages, pagesB: eb.pages, linesA: ea.lines.length, linesB: eb.lines.length, key });
    } catch (e) {
      setError(e instanceof Error ? e.message : "The PDFs could not be compared.");
    } finally {
      setBusy(false);
    }
  }

  const added = fresh ? fresh.rows.filter((r) => r.type === "added").length : 0;
  const removed = fresh ? fresh.rows.filter((r) => r.type === "removed").length : 0;
  const summary = fresh ? summarizeRows(fresh.rows, fresh.pagesA, fresh.pagesB).filter((s) => s.added || s.removed) : [];

  const shownRows = fresh ? (onlyChanges ? withContext(fresh.rows) : fresh.rows.map((r) => ({ row: r, gap: false }))) : [];
  const pairs = fresh ? sideBySide(fresh.rows) : [];
  const shownPairs = onlyChanges ? pairs.filter((p) => p.type !== "same") : pairs;

  return (
    <ToolPanel>
      <div className="space-y-5">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <h2 className="text-sm font-semibold text-ink">Original (A)</h2>
            <PdfPicker source={a} onChange={setA} label="Choose the original PDF" />
          </div>
          <div className="space-y-2">
            <h2 className="text-sm font-semibold text-ink">Changed (B)</h2>
            <PdfPicker source={b} onChange={setB} label="Choose the changed PDF" />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <Checkbox label="Ignore case" checked={ignoreCase} onChange={setIgnoreCase} />
          <Checkbox label="Ignore spacing differences" checked={ignoreWs} onChange={setIgnoreWs} />
          <Btn icon="search" onClick={compare} disabled={!a || !b || busy}>
            {busy ? "Comparing…" : "Compare PDFs"}
          </Btn>
        </div>
        {busy && <Spinner label="Extracting and comparing text" />}
        {error && <Notice tone="error">{error}</Notice>}
        {result && !fresh && !busy && <p className="text-sm text-muted">Files or options changed. Compare again to update the result.</p>}
        {fresh && (
          <div className="space-y-5">
            <StatGrid
              items={[
                { label: "Lines removed (A)", value: removed },
                { label: "Lines added (B)", value: added },
                { label: "Pages A / B", value: `${fresh.pagesA} / ${fresh.pagesB}` },
              ]}
            />
            {added === 0 && removed === 0 ? (
              <Notice tone="success" title="No text differences">
                The text of both PDFs matches line for line{ignoreCase || ignoreWs ? " with the selected options" : ""}. Layout, images and fonts are not compared.
              </Notice>
            ) : (
              <>
                <section aria-label="Changes per page">
                  <h3 className="text-sm font-semibold text-ink">Changes per page</h3>
                  <div className="mt-2 max-h-56 overflow-auto rounded-lg shadow-[0_0_0_1px_var(--line)]">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-sunken text-ink-2">
                        <tr>
                          <th className="px-3 py-2 font-medium">Page</th>
                          <th className="px-3 py-2 font-medium">Removed from A</th>
                          <th className="px-3 py-2 font-medium">Added in B</th>
                        </tr>
                      </thead>
                      <tbody className="tabular-nums">
                        {summary.map((s) => (
                          <tr key={s.page} className="border-t border-line">
                            <td className="px-3 py-1.5">{s.page}</td>
                            <td className="px-3 py-1.5">{s.removed}</td>
                            <td className="px-3 py-1.5">{s.added}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
                <div className="flex flex-wrap items-center gap-4">
                  <Segmented
                    label="Diff view"
                    value={view}
                    onChange={setView}
                    options={[
                      { value: "side", label: "Side by side" },
                      { value: "inline", label: "Inline" },
                    ]}
                  />
                  <Checkbox label="Show changed lines only" checked={onlyChanges} onChange={setOnlyChanges} />
                  <Btn variant="ghost" icon="download" onClick={() => downloadFile("pdf-comparison.diff.txt", rowsToReport(fresh.rows, a?.file.name ?? "A", b?.file.name ?? "B"))}>
                    Download report
                  </Btn>
                </div>
                <p className="text-[0.8125rem] text-muted">
                  Removed lines are marked “− Removed” (from A); added lines “+ Added” (in B). Each line shows its page number.
                </p>
                {view === "side" ? (
                  <div className="max-h-[560px] overflow-auto rounded-lg shadow-[0_0_0_1px_var(--line)]" tabIndex={0} aria-label="Side-by-side differences">
                    <table className="w-full min-w-[640px] table-fixed text-left text-[0.85rem]">
                      <thead className="sticky top-0 bg-sunken text-ink-2">
                        <tr>
                          <th className="w-1/2 px-3 py-2 font-medium">A: {a?.file.name}</th>
                          <th className="w-1/2 px-3 py-2 font-medium">B: {b?.file.name}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {shownPairs.slice(0, MAX_ROWS).map((p, i) => (
                          <tr key={i} className="border-t border-line align-top">
                            <DiffCell line={p.left} kind={p.type === "same" ? "same" : "removed"} />
                            <DiffCell line={p.right} kind={p.type === "same" ? "same" : "added"} />
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <ol className="max-h-[560px] overflow-auto rounded-lg font-mono text-[0.85rem] shadow-[0_0_0_1px_var(--line)]" tabIndex={0} aria-label="Inline differences">
                    {shownRows.slice(0, MAX_ROWS).map(({ row, gap }, i) => {
                      const line = row.type === "added" ? row.b : row.a;
                      return (
                        <li
                          key={i}
                          className={`flex gap-3 border-t border-line px-3 py-1 first:border-t-0 ${gap ? "mt-3" : ""} ${
                            row.type === "added" ? "bg-accent-soft" : row.type === "removed" ? "bg-[color-mix(in_oklch,var(--danger)_10%,transparent)]" : "text-ink-2"
                          }`}
                        >
                          <span className="w-20 shrink-0 font-sans text-[0.75rem] text-muted">
                            {row.type === "same" ? "" : `${MARK[row.type]} ${row.type === "added" ? "Added" : "Removed"}`}
                          </span>
                          <span className="w-10 shrink-0 text-muted">p{line.page}</span>
                          <span className="min-w-0 break-words">{line.text}</span>
                        </li>
                      );
                    })}
                  </ol>
                )}
                {(view === "side" ? shownPairs.length : shownRows.length) > MAX_ROWS && (
                  <p className="text-sm text-muted">Showing the first {MAX_ROWS.toLocaleString()} rows. Download the report for the full comparison.</p>
                )}
              </>
            )}
          </div>
        )}
        <PrivacyNote />
      </div>
    </ToolPanel>
  );
}

function DiffCell({ line, kind }: { line: TaggedLine | null; kind: "same" | "removed" | "added" }) {
  if (!line) return <td className="bg-sunken/60 px-3 py-1 text-muted">&nbsp;</td>;
  const cls =
    kind === "added" ? "bg-accent-soft" : kind === "removed" ? "bg-[color-mix(in_oklch,var(--danger)_10%,transparent)]" : "text-ink-2";
  return (
    <td className={`px-3 py-1 break-words ${cls}`}>
      {kind !== "same" && (
        <span className="mr-1.5 font-medium text-ink">
          {MARK[kind]} <span className="sr-only">{kind === "added" ? "Added" : "Removed"}</span>
        </span>
      )}
      <span className="mr-1.5 text-[0.75rem] text-muted">p{line.page}</span>
      {line.text}
    </td>
  );
}

/** Changed rows with one line of context on each side; `gap` marks a jump. */
function withContext(rows: DiffRow[]) {
  const keep = new Set<number>();
  rows.forEach((r, i) => {
    if (r.type !== "same") {
      keep.add(i - 1);
      keep.add(i);
      keep.add(i + 1);
    }
  });
  const out: { row: DiffRow; gap: boolean }[] = [];
  let last = -2;
  rows.forEach((r, i) => {
    if (!keep.has(i)) return;
    out.push({ row: r, gap: last >= 0 && i !== last + 1 });
    last = i;
  });
  return out;
}

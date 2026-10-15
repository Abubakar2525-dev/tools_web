"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { Btn, Checkbox, EmptyState, Notice, PrivacyNote, ResetBtn, SelectField, StatGrid, TextArea, TextField, ToolPanel, downloadFile } from "@/components/tools/kit";
import { FileDrop, Spinner } from "@/components/tools/engines/files";
import { Icon } from "@/components/ui/Icon";
import { errorMessage, useRunGuard } from "./shared";

const SAMPLE = `city,country,population,area_km2
Lisbon,Portugal,545796,100.05
 Porto ,Portugal,231800,41.42
Oslo,Norway,709037,454
Bergen,Norway,291940,465.3
Lisbon,Portugal,545796,100.05
Utrecht,Netherlands,361699,99.21`;

const DELIMS = [
  { value: "auto", label: "Detect automatically" },
  { value: ",", label: "Comma (,)" },
  { value: ";", label: "Semicolon (;)" },
  { value: "\t", label: "Tab" },
  { value: "|", label: "Pipe (|)" },
];

const MAX_SHOWN = 500;

interface Parsed {
  header: string[];
  rows: string[][];
  delimiter: string;
  warnings: string[];
}

type Sort = { col: number; dir: "asc" | "desc" } | null;

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

export default function Tool() {
  const [text, setText] = useState("");
  const [delim, setDelim] = useState("auto");
  const [hasHeader, setHasHeader] = useState(true);
  const [trim, setTrim] = useState(true);
  const [dedupe, setDedupe] = useState(false);
  const [filter, setFilter] = useState("");
  const [sort, setSort] = useState<Sort>(null);
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const guard = useRunGuard();
  const dFilter = useDeferredValue(filter);

  const parse = async (src = text) => {
    if (!src.trim()) {
      setError("Paste CSV text or choose a file first.");
      setParsed(null);
      return;
    }
    const token = guard.start();
    setBusy(true);
    setError(null);
    try {
      const Papa = (await import("papaparse")).default;
      if (!guard.isCurrent(token)) return;
      const res = Papa.parse<string[]>(src.replace(/^﻿/, ""), { delimiter: delim === "auto" ? "" : delim, skipEmptyLines: "greedy" });
      const data = res.data;
      if (data.length === 0) {
        setError("No rows found.");
        setParsed(null);
        return;
      }
      const width = Math.max(...data.map((r) => r.length));
      const norm = data.map((r) => (r.length < width ? [...r, ...Array(width - r.length).fill("")] : r));
      const header = hasHeader ? norm[0].map((h, i) => h || `Column ${i + 1}`) : Array.from({ length: width }, (_, i) => `Column ${i + 1}`);
      const rows = hasHeader ? norm.slice(1) : norm;
      const warnings = res.errors.slice(0, 4).map((e) => `Row ${(e.row ?? 0) + 1}: ${e.message}`);
      const ragged = data.filter((r) => r.length !== width).length;
      if (ragged) warnings.push(`${ragged} row${ragged === 1 ? " has" : "s have"} fewer fields than the widest row; missing cells were left empty.`);
      setParsed({ header, rows, delimiter: res.meta.delimiter, warnings });
      setSort(null);
    } catch (e) {
      if (guard.isCurrent(token)) setError(errorMessage(e));
    } finally {
      if (guard.isCurrent(token)) setBusy(false);
    }
  };

  const view = useMemo(() => {
    if (!parsed) return null;
    let rows = trim ? parsed.rows.map((r) => r.map((c) => c.trim())) : parsed.rows;
    const header = trim ? parsed.header.map((h) => h.trim()) : parsed.header;
    let removed = 0;
    if (dedupe) {
      const seen = new Set<string>();
      const kept: string[][] = [];
      for (const r of rows) {
        const k = JSON.stringify(r);
        if (seen.has(k)) removed++;
        else {
          seen.add(k);
          kept.push(r);
        }
      }
      rows = kept;
    }
    const q = dFilter.trim().toLowerCase();
    const filtered = q ? rows.filter((r) => r.some((c) => c.toLowerCase().includes(q))) : rows;
    const sorted = sort ? [...filtered].sort((a, b) => (sort.dir === "asc" ? 1 : -1) * collator.compare(a[sort.col] ?? "", b[sort.col] ?? "")) : filtered;
    return { header, rows: sorted, all: rows, removed };
  }, [parsed, trim, dedupe, dFilter, sort]);

  const exportAs = async (kind: "csv" | "tsv" | "json") => {
    if (!view) return;
    if (kind === "json") {
      const objs = view.rows.map((r) => Object.fromEntries(view.header.map((h, i) => [h, r[i] ?? ""])));
      downloadFile("data.json", JSON.stringify(objs, null, 2), "application/json");
      return;
    }
    const Papa = (await import("papaparse")).default;
    const out = Papa.unparse({ fields: view.header, data: view.rows }, { delimiter: kind === "tsv" ? "\t" : ",", newline: "\r\n" });
    downloadFile(kind === "tsv" ? "data.tsv" : "data.csv", out, kind === "tsv" ? "text/tab-separated-values" : "text/csv");
  };

  const toggleSort = (col: number) =>
    setSort((s) => (!s || s.col !== col ? { col, dir: "asc" } : s.dir === "asc" ? { col, dir: "desc" } : null));

  return (
    <div className="space-y-5">
      <ToolPanel
        title="CSV source"
        actions={
          <>
            <Btn
              variant="ghost"
              icon="table"
              onClick={() => {
                setText(SAMPLE);
                void parse(SAMPLE);
              }}
            >
              Load sample
            </Btn>
            <ResetBtn
              onClick={() => {
                setText("");
                setParsed(null);
                setError(null);
                setFilter("");
                setSort(null);
              }}
            />
          </>
        }
      >
        <div className="space-y-4">
          <FileDrop
            compact
            accept=".csv,.tsv,.txt,text/csv,text/plain,text/tab-separated-values"
            maxSizeMB={20}
            label="Choose a CSV or TSV file, or drop it here"
            hint="Up to 20 MB. The file is read in your browser."
            onFiles={async (files) => {
              const t = await files[0].text();
              setText(t);
              void parse(t);
            }}
          />
          <TextArea label="Or paste CSV" mono rows={8} value={text} onChange={(e) => setText(e.target.value)} error={error} />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <SelectField label="Delimiter" value={delim} onChange={(e) => setDelim(e.target.value)} options={DELIMS} />
            <div className="space-y-3 pt-1 lg:col-span-3">
              <Checkbox label="First row is the header" checked={hasHeader} onChange={setHasHeader} />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Btn icon="table" onClick={() => void parse()} disabled={busy}>
              Parse and view
            </Btn>
            {busy && <Spinner label="Parsing" />}
          </div>
        </div>
      </ToolPanel>

      <ToolPanel title="Table">
        {!view || !parsed ? (
          <EmptyState icon="table" title="Nothing to show yet">
            Paste CSV or choose a file, then press Parse and view.
          </EmptyState>
        ) : (
          <div className="space-y-4">
            <StatGrid
              items={[
                { label: "Rows", value: view.all.length.toLocaleString() },
                { label: "Columns", value: view.header.length },
                { label: "Delimiter", value: parsed.delimiter === "\t" ? "Tab" : parsed.delimiter },
                { label: "Matching filter", value: view.rows.length.toLocaleString() },
                { label: "Duplicates removed", value: view.removed.toLocaleString() },
              ]}
            />
            {parsed.warnings.length > 0 && (
              <Notice tone="warning">
                {parsed.warnings.map((w) => (
                  <p key={w}>{w}</p>
                ))}
              </Notice>
            )}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <TextField label="Filter rows" placeholder="Text in any cell" value={filter} onChange={(e) => setFilter(e.target.value)} />
              <div className="space-y-3 pt-1">
                <Checkbox label="Trim spaces around values" checked={trim} onChange={setTrim} />
                <Checkbox label="Remove duplicate rows" checked={dedupe} onChange={setDedupe} />
              </div>
              <div className="flex flex-wrap items-end gap-2">
                <Btn variant="ghost" icon="download" onClick={() => void exportAs("csv")}>
                  CSV
                </Btn>
                <Btn variant="ghost" icon="download" onClick={() => void exportAs("tsv")}>
                  TSV
                </Btn>
                <Btn variant="ghost" icon="download" onClick={() => void exportAs("json")}>
                  JSON
                </Btn>
              </div>
            </div>
            <p className="text-[0.8125rem] text-muted">Exports include the current trim, de-duplication, filter and sort.</p>
            <div className="max-h-[560px] overflow-auto rounded-lg shadow-[inset_0_0_0_1px_var(--line)]" tabIndex={0} aria-label="CSV data table">
              <table className="w-full border-collapse text-left text-[0.875rem]">
                <thead className="sticky top-0 bg-sunken">
                  <tr>
                    <th scope="col" className="px-3 py-2 text-[0.8125rem] font-medium text-muted">
                      #
                    </th>
                    {view.header.map((h, i) => {
                      const active = sort?.col === i;
                      return (
                        <th key={i} scope="col" aria-sort={active ? (sort?.dir === "asc" ? "ascending" : "descending") : "none"} className="p-0">
                          <button type="button" onClick={() => toggleSort(i)} className="flex min-h-10 w-full items-center gap-1 whitespace-nowrap px-3 py-2 font-medium text-ink hover:bg-surface focus-visible:outline-2 focus-visible:outline-accent">
                            {h}
                            <Icon name="chevron" size={14} className={`transition-transform ${active ? (sort?.dir === "asc" ? "rotate-180 text-accent" : "text-accent") : "opacity-30"}`} />
                            <span className="sr-only">{active ? (sort?.dir === "asc" ? ", sorted ascending" : ", sorted descending") : ", sort"}</span>
                          </button>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {view.rows.slice(0, MAX_SHOWN).map((r, ri) => (
                    <tr key={ri} className="border-t border-line">
                      <td className="px-3 py-1.5 tabular-nums text-muted">{ri + 1}</td>
                      {view.header.map((_, ci) => (
                        <td key={ci} className="max-w-[320px] truncate px-3 py-1.5" title={r[ci]}>
                          {r[ci]}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {view.rows.length > MAX_SHOWN && (
              <p className="text-[0.8125rem] text-muted">
                Showing the first {MAX_SHOWN} of {view.rows.length.toLocaleString()} rows. Exports contain every row.
              </p>
            )}
          </div>
        )}
      </ToolPanel>
      <PrivacyNote />
    </div>
  );
}

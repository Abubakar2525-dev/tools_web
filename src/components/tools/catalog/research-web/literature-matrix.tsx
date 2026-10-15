"use client";

import { useMemo, useRef, useState } from "react";
import { Btn, Notice, PrivacyNote, TextArea, TextField, ToolPanel, CellSelect, EmptyState, downloadFile, inputCls, uid, usePersistentState } from "@/components/tools/kit";
import { MATRIX_COLS, emptyRow, fromCsvCells, toCsv, type MatrixKey, type MatrixRow } from "./lib/matrix";
import { entryToSource, parseBibtex } from "./lib/cite";

const MAX_CSV_BYTES = 5 * 1024 * 1024;
type Sort = "manual" | "author" | "year" | "year-desc";

const isRow = (r: unknown): r is MatrixRow => !!r && typeof r === "object" && typeof (r as MatrixRow).id === "string";

export default function Tool() {
  const [stored, setStored] = usePersistentState<MatrixRow[]>("literature-matrix", []);
  const rows = useMemo(() => (Array.isArray(stored) ? stored.filter(isRow).map((r) => ({ ...emptyRow(r.id), ...r })) : []), [stored]);
  const [filter, setFilter] = useState("");
  const [sort, setSort] = useState<Sort>("manual");
  const [msg, setMsg] = useState<{ tone: "success" | "error" | "warning"; text: string } | null>(null);
  const [bib, setBib] = useState("");
  const [showBib, setShowBib] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const update = (fn: (r: MatrixRow[]) => MatrixRow[]) => setStored((prev) => fn(Array.isArray(prev) ? prev.filter(isRow) : []));
  const setCell = (id: string, key: MatrixKey, value: string) => update((list) => list.map((r) => (r.id === id ? { ...r, [key]: value } : r)));
  const move = (id: string, d: number) =>
    update((list) => {
      const i = list.findIndex((r) => r.id === id);
      const j = i + d;
      if (i < 0 || j < 0 || j >= list.length) return list;
      const n = [...list];
      [n[i], n[j]] = [n[j], n[i]];
      return n;
    });

  const shown = useMemo(() => {
    const q = filter.trim().toLowerCase();
    let list = q ? rows.filter((r) => MATRIX_COLS.some((c) => r[c.key].toLowerCase().includes(q))) : rows;
    if (sort !== "manual") {
      list = [...list].sort((a, b) => {
        if (sort === "author") return a.author.localeCompare(b.author) || a.year.localeCompare(b.year);
        const ya = parseInt(a.year, 10) || 0;
        const yb = parseInt(b.year, 10) || 0;
        return sort === "year" ? ya - yb : yb - ya;
      });
    }
    return list;
  }, [rows, filter, sort]);

  const importCsv = async (file: File) => {
    if (file.size > MAX_CSV_BYTES) {
      setMsg({ tone: "error", text: "That file is larger than 5 MB." });
      return;
    }
    if (!/\.(csv|tsv|txt)$/i.test(file.name) && !/csv|text/.test(file.type)) {
      setMsg({ tone: "error", text: "Choose a .csv file." });
      return;
    }
    try {
      const Papa = (await import("papaparse")).default;
      const text = await file.text();
      const parsed = Papa.parse<string[]>(text.replace(/^﻿/, ""), { skipEmptyLines: "greedy" });
      const res = fromCsvCells(parsed.data);
      if (res.error) {
        setMsg({ tone: "error", text: res.error });
        return;
      }
      update((list) => [...list, ...res.rows.map((r) => ({ ...r, id: uid() }))]);
      const notes = [
        `Imported ${res.rows.length} ${res.rows.length === 1 ? "row" : "rows"}.`,
        res.ignored.length ? `Ignored columns: ${res.ignored.join(", ")}.` : "",
        res.skipped ? `Skipped ${res.skipped} empty rows.` : "",
        parsed.errors.length ? `${parsed.errors.length} CSV formatting issue(s), check the result.` : "",
      ].filter(Boolean);
      setMsg({ tone: res.ignored.length || parsed.errors.length ? "warning" : "success", text: notes.join(" ") });
    } catch {
      setMsg({ tone: "error", text: "Could not read that file." });
    }
  };

  const addFromBib = () => {
    const r = parseBibtex(bib);
    if (!r.entries.length) {
      setMsg({ tone: "error", text: r.errors[0] ?? "No BibTeX entries found." });
      return;
    }
    const added = r.entries.map((e) => {
      const s = entryToSource(e, uid());
      const fam = s.authors.map((a) => a.family);
      const author = fam.length > 2 ? `${fam[0]} et al.` : fam.join(" & ");
      return { ...emptyRow(uid()), author, year: s.date.year, title: s.title };
    });
    update((list) => [...list, ...added]);
    setMsg({ tone: r.errors.length ? "warning" : "success", text: `Added ${added.length} ${added.length === 1 ? "row" : "rows"} from BibTeX.${r.errors.length ? ` ${r.errors.length} entries had errors.` : ""}` });
    setBib("");
    setShowBib(false);
  };

  return (
    <div className="space-y-5">
      <ToolPanel
        title={`Literature matrix (${rows.length} ${rows.length === 1 ? "source" : "sources"})`}
        actions={
          <>
            <Btn icon="plus" onClick={() => update((list) => [...list, emptyRow(uid())])}>
              Add row
            </Btn>
            <Btn variant="ghost" icon="download" disabled={!rows.length} onClick={() => downloadFile("literature-matrix.csv", "﻿" + toCsv(rows), "text/csv")}>
              Export CSV
            </Btn>
            <Btn variant="ghost" icon="upload" onClick={() => fileRef.current?.click()}>
              Import CSV
            </Btn>
            <Btn variant="ghost" icon="book" onClick={() => setShowBib((v) => !v)} aria-expanded={showBib}>
              From BibTeX
            </Btn>
          </>
        }
      >
        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv,.txt"
          className="sr-only"
          aria-label="Import a CSV file"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) void importCsv(f);
          }}
        />
        <div className="space-y-4">
          {showBib && (
            <div className="space-y-3 rounded-xl bg-sunken p-4">
              <TextArea label="Paste BibTeX entries" mono rows={6} value={bib} onChange={(e) => setBib(e.target.value)} hint="Author, year and title are filled in; you add the analysis." />
              <Btn icon="plus" disabled={!bib.trim()} onClick={addFromBib}>
                Add rows
              </Btn>
            </div>
          )}
          {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
          <div className="grid gap-3 sm:grid-cols-[1fr_14rem]">
            <TextField label="Filter rows" placeholder="Search any column" value={filter} onChange={(e) => setFilter(e.target.value)} />
            <div>
              <p className="text-sm font-medium text-ink" aria-hidden="true">
                Sort
              </p>
              <CellSelect
                label="Sort rows"
                className="mt-2"
                value={sort}
                onChange={(e) => setSort(e.target.value as Sort)}
                options={[
                  { value: "manual", label: "Your order" },
                  { value: "author", label: "Author A to Z" },
                  { value: "year", label: "Year, oldest first" },
                  { value: "year-desc", label: "Year, newest first" },
                ]}
              />
            </div>
          </div>
          {rows.length === 0 ? (
            <EmptyState icon="table" title="No sources yet">
              Add a row, import a CSV with headers such as Author, Year, Title, Aim, Method, Findings, Gaps, Notes, or paste BibTeX.
            </EmptyState>
          ) : shown.length === 0 ? (
            <p className="text-sm text-muted">No rows match “{filter}”.</p>
          ) : (
            <div className="overflow-x-auto rounded-xl shadow-[0_0_0_1px_var(--line)]" tabIndex={0} aria-label="Literature matrix table, scrolls horizontally">
              <table className="w-full min-w-[1400px] border-collapse text-sm">
                <thead>
                  <tr className="bg-sunken text-left">
                    <th scope="col" className="w-[4.5rem] px-2 py-2 font-medium">
                      #
                    </th>
                    {MATRIX_COLS.map((c) => (
                      <th key={c.key} scope="col" className="px-2 py-2 font-medium">
                        {c.label}
                      </th>
                    ))}
                    <th scope="col" className="px-2 py-2 font-medium">
                      <span className="sr-only">Row actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((r, idx) => (
                    <tr key={r.id} className="border-t border-line align-top">
                      <td className="px-2 py-2 tabular-nums text-muted">{idx + 1}</td>
                      {MATRIX_COLS.map((c) => (
                        <td key={c.key} className="px-1.5 py-1.5">
                          <textarea
                            aria-label={`${c.label}, row ${idx + 1}`}
                            value={r[c.key]}
                            rows={c.wide ? 4 : 2}
                            onChange={(e) => setCell(r.id, c.key, e.target.value)}
                            className={`${inputCls} resize-y px-2.5 py-2 text-[0.9rem] leading-snug ${c.key === "year" ? "min-w-[5rem]" : c.wide ? "min-w-[13rem]" : "min-w-[9rem]"}`}
                          />
                        </td>
                      ))}
                      <td className="px-1.5 py-1.5">
                        <div className="flex flex-col gap-1">
                          <Btn variant="subtle" aria-label={`Move row ${idx + 1} up`} disabled={sort !== "manual" || !!filter} onClick={() => move(r.id, -1)}>
                            ↑
                          </Btn>
                          <Btn variant="subtle" aria-label={`Move row ${idx + 1} down`} disabled={sort !== "manual" || !!filter} onClick={() => move(r.id, 1)}>
                            ↓
                          </Btn>
                          <Btn variant="danger" icon="trash" aria-label={`Delete row ${idx + 1}`} onClick={() => update((list) => list.filter((x) => x.id !== r.id))} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {rows.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              {confirmClear ? (
                <>
                  <span className="text-sm text-ink-2">Delete all {rows.length} rows?</span>
                  <Btn
                    variant="danger"
                    onClick={() => {
                      update(() => []);
                      setConfirmClear(false);
                    }}
                  >
                    Yes, clear matrix
                  </Btn>
                  <Btn variant="ghost" onClick={() => setConfirmClear(false)}>
                    Keep
                  </Btn>
                </>
              ) : (
                <Btn variant="subtle" icon="trash" onClick={() => setConfirmClear(true)}>
                  Clear matrix
                </Btn>
              )}
              <span className="text-[0.8125rem] text-muted">Reordering is available in “Your order” without a filter.</span>
            </div>
          )}
        </div>
      </ToolPanel>
      <PrivacyNote stored />
    </div>
  );
}

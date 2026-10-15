"use client";

import { useRef, useState } from "react";
import type { PDFDocument } from "pdf-lib";
import { Btn, CellInput, Notice, PrivacyNote, ResetBtn, ToolPanel, uid } from "@/components/tools/kit";
import { FileDrop, ProgressBar, fileToBytes, formatBytes } from "@/components/tools/engines/files";
import { getPdfLib, parsePageRanges } from "@/components/tools/engines/pdf";
import { Icon } from "@/components/ui/Icon";
import { TileBtn } from "./PageGrid";
import { DownloadResult, PDF_ACCEPT, friendlyError, loadPdfLib, savePdf, useJob, type Output } from "./shared";
import { moveItem } from "./lib/layout";

type Entry = { id: string; file: File; status: "loading" | "ready" | "error"; pages: number; error?: string; range: string };

export default function Tool() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const docs = useRef(new Map<string, PDFDocument>());
  const [out, setOut] = useState<Output | null>(null);
  const job = useJob();

  const patch = (id: string, p: Partial<Entry>) => setEntries((es) => es.map((e) => (e.id === id ? { ...e, ...p } : e)));

  const add = (files: File[]) => {
    setOut(null);
    const fresh = files.map((file) => ({ id: uid(), file, status: "loading" as const, pages: 0, range: "" }));
    setEntries((es) => [...es, ...fresh]);
    // Load sequentially to keep memory use predictable.
    void (async () => {
      for (const e of fresh) {
        try {
          const doc = await loadPdfLib(await fileToBytes(e.file));
          docs.current.set(e.id, doc);
          patch(e.id, { status: "ready", pages: doc.getPageCount() });
        } catch (err) {
          patch(e.id, { status: "error", error: friendlyError(err) });
        }
      }
    })();
  };

  const remove = (id: string) => {
    docs.current.delete(id);
    setEntries((es) => es.filter((e) => e.id !== id));
    setOut(null);
  };

  const rangeError = (e: Entry) => {
    if (e.status !== "ready" || !e.range.trim()) return null;
    const r = parsePageRanges(e.range, e.pages);
    return typeof r === "string" ? r : null;
  };

  const ready = entries.filter((e) => e.status === "ready");
  const blocked = entries.some((e) => e.status === "loading") || entries.some((e) => rangeError(e));
  const totalPages = ready.reduce((n, e) => {
    const r = e.range.trim() ? parsePageRanges(e.range, e.pages) : null;
    return n + (Array.isArray(r) ? r.length : e.pages);
  }, 0);

  const merge = () =>
    job.run(async ({ alive, progress }) => {
      setOut(null);
      const { PDFDocument } = await getPdfLib();
      const target = await PDFDocument.create();
      for (let i = 0; i < ready.length; i++) {
        if (!alive()) return;
        const e = ready[i];
        const src = docs.current.get(e.id);
        if (!src) continue;
        const r = e.range.trim() ? parsePageRanges(e.range, e.pages) : null;
        const idx = Array.isArray(r) ? r.map((p) => p - 1) : src.getPageIndices();
        const pages = await target.copyPages(src, idx);
        pages.forEach((p) => target.addPage(p));
        progress((i + 1) / (ready.length + 1));
        await new Promise((res) => setTimeout(res, 0));
      }
      const blob = await savePdf(target);
      if (alive()) setOut({ blob, name: "merged.pdf", detail: `${target.getPageCount()} pages from ${ready.length} files` });
    });

  return (
    <ToolPanel
      title="Merge PDFs"
      actions={
        entries.length > 0 && (
          <ResetBtn
            label="Clear all"
            onClick={() => {
              job.cancel();
              docs.current.clear();
              setEntries([]);
              setOut(null);
            }}
          />
        )
      }
    >
      <div className="space-y-5">
        <FileDrop accept={PDF_ACCEPT} multiple maxFiles={60} maxSizeMB={200} compact={entries.length > 0} label="Choose PDFs or drop them here" onFiles={add} />
        {entries.length > 0 && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-ink-2">
                {entries.length} {entries.length === 1 ? "file" : "files"}. Files are joined from top to bottom.
              </p>
              <Btn
                variant="subtle"
                onClick={() => {
                  setEntries((es) => [...es].sort((a, b) => a.file.name.localeCompare(b.file.name, undefined, { numeric: true })));
                  setOut(null);
                }}
              >
                Sort by name
              </Btn>
            </div>
            <ol className="space-y-2" aria-label="Files to merge, in order">
              {entries.map((e, i) => {
                const rErr = rangeError(e);
                return (
                  <li key={e.id} className="rounded-xl p-3 shadow-[0_0_0_1px_var(--line)]">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="w-6 text-sm font-medium tabular-nums text-ink">{i + 1}.</span>
                      <Icon name="file" size={18} className="shrink-0 text-muted" />
                      <span className="min-w-0 flex-1 truncate text-sm text-ink" title={e.file.name}>
                        {e.file.name}
                      </span>
                      <span className="text-sm tabular-nums text-muted">
                        {formatBytes(e.file.size)}
                        {e.status === "ready" && ` · ${e.pages} ${e.pages === 1 ? "page" : "pages"}`}
                        {e.status === "loading" && " · reading…"}
                      </span>
                      <div className="flex gap-1">
                        <TileBtn label={`Move ${e.file.name} up`} disabled={i === 0} onClick={() => { setEntries((es) => moveItem(es, i, -1)); setOut(null); }}>
                          <Icon name="arrow" size={16} className="-rotate-90" />
                        </TileBtn>
                        <TileBtn label={`Move ${e.file.name} down`} disabled={i === entries.length - 1} onClick={() => { setEntries((es) => moveItem(es, i, 1)); setOut(null); }}>
                          <Icon name="arrow" size={16} className="rotate-90" />
                        </TileBtn>
                        <TileBtn label={`Remove ${e.file.name}`} onClick={() => remove(e.id)}>
                          <Icon name="close" size={16} />
                        </TileBtn>
                      </div>
                    </div>
                    {e.status === "error" && (
                      <div className="mt-2">
                        <Notice tone="error">{e.error} This file will be skipped.</Notice>
                      </div>
                    )}
                    {e.status === "ready" && (
                      <div className="mt-2 flex flex-wrap items-center gap-2 pl-8">
                        <CellInput
                          label={`Pages to include from ${e.file.name} (blank for all)`}
                          placeholder={`All pages (1-${e.pages})`}
                          value={e.range}
                          invalid={Boolean(rErr)}
                          onChange={(ev) => {
                            patch(e.id, { range: ev.target.value });
                            setOut(null);
                          }}
                          className="max-w-[16rem]"
                        />
                        {rErr && <span className="text-sm text-danger">{rErr}</span>}
                      </div>
                    )}
                  </li>
                );
              })}
            </ol>
            <div className="flex flex-wrap items-center gap-3">
              <Btn icon="layers" disabled={ready.length < 2 || blocked || job.busy} onClick={merge}>
                Merge {ready.length} {ready.length === 1 ? "file" : "files"}
              </Btn>
              <span className="text-sm text-muted tabular-nums">{totalPages} pages in total</span>
            </div>
            {ready.length < 2 && !job.busy && <p className="text-sm text-muted">Add at least two PDFs to merge them.</p>}
            {job.busy && <ProgressBar value={job.progress ?? 0} label="Merging" />}
            {job.error && <Notice tone="error">{job.error}</Notice>}
            {out && <DownloadResult output={out} />}
          </>
        )}
        <PrivacyNote />
      </div>
    </ToolPanel>
  );
}

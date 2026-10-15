"use client";

import { useState } from "react";
import { Btn, Notice, PrivacyNote, ToolPanel } from "@/components/tools/kit";
import { Spinner } from "@/components/tools/engines/files";
import { PageGrid } from "./PageGrid";
import { SelectionTools, usePageSelection } from "./selection";
import { DownloadResult, PdfSourcePicker, outName, pdfFromPages, savePdf, useJob, usePdfSource, type LoadedPdf, type Output } from "./shared";

export default function Tool() {
  const { state, load, clear } = usePdfSource();
  return (
    <ToolPanel title="Delete pages">
      <div className="space-y-5">
        <PdfSourcePicker state={state} load={load} clear={clear} />
        {state.status === "ready" && <Editor key={state.key} pdf={state} />}
        <PrivacyNote />
      </div>
    </ToolPanel>
  );
}

function Editor({ pdf }: { pdf: LoadedPdf }) {
  const { sel, setSel, toggle } = usePageSelection();
  const [out, setOut] = useState<Output | null>(null);
  const job = useJob();
  const items = Array.from({ length: pdf.pageCount }, (_, i) => ({ id: String(i + 1), page: i + 1 }));
  const keep = items.map((it) => it.page).filter((p) => !sel.has(p));
  const allGone = sel.size >= pdf.pageCount;

  const run = () =>
    job.run(async ({ alive }) => {
      setOut(null);
      if (!pdf.lib) throw new Error("The PDF is not ready yet.");
      const doc = await pdfFromPages(pdf.lib, keep.map((p) => p - 1));
      const blob = await savePdf(doc);
      if (alive()) setOut({ blob, name: outName(pdf.file, "edited"), detail: `${keep.length} of ${pdf.pageCount} pages kept` });
    });

  return (
    <div className="space-y-5">
      <SelectionTools
        pageCount={pdf.pageCount}
        selected={sel}
        rangeLabel="Mark pages to delete"
        onChange={(s) => {
          setSel(s);
          setOut(null);
        }}
      />
      <PageGrid
        doc={pdf.js}
        items={items}
        label="Pages: activate a page to mark it for deletion"
        selected={new Set([...sel].map(String))}
        selectVerb="Mark for deletion:"
        selectStyle="remove"
        onToggle={(id) => {
          toggle(Number(id));
          setOut(null);
        }}
      />
      {allGone && <Notice tone="warning">A PDF needs at least one page. Unmark at least one page to continue.</Notice>}
      <div className="flex flex-wrap items-center gap-3">
        <Btn icon="trash" disabled={sel.size === 0 || allGone || job.busy} onClick={run}>
          Delete {sel.size || ""} {sel.size === 1 ? "page" : "pages"}
        </Btn>
        {job.busy && <Spinner label="Building PDF" />}
      </div>
      {job.error && <Notice tone="error">{job.error}</Notice>}
      {out && <DownloadResult output={out} />}
    </div>
  );
}

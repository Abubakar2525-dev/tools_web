"use client";

import { useState } from "react";
import { Btn, Notice, PrivacyNote, SelectField, ToolPanel } from "@/components/tools/kit";
import { Spinner } from "@/components/tools/engines/files";
import { PageGrid } from "./PageGrid";
import { SelectionTools, usePageSelection } from "./selection";
import { DownloadResult, PdfSourcePicker, outName, pdfFromPages, savePdf, useJob, usePdfSource, type LoadedPdf, type Output } from "./shared";
import { duplicateOrder } from "./lib/layout";

export default function Tool() {
  const { state, load, clear } = usePdfSource();
  return (
    <ToolPanel title="Duplicate pages">
      <div className="space-y-5">
        <PdfSourcePicker state={state} load={load} clear={clear} />
        {state.status === "ready" && <Editor key={state.key} pdf={state} />}
        <PrivacyNote />
      </div>
    </ToolPanel>
  );
}

const COPY_OPTIONS = Array.from({ length: 10 }, (_, i) => ({ value: String(i + 1), label: i === 0 ? "1 extra copy" : `${i + 1} extra copies` }));

function Editor({ pdf }: { pdf: LoadedPdf }) {
  const { sel, setSel, toggle } = usePageSelection();
  const [copies, setCopies] = useState("1");
  const [out, setOut] = useState<Output | null>(null);
  const job = useJob();
  const items = Array.from({ length: pdf.pageCount }, (_, i) => ({ id: String(i + 1), page: i + 1 }));
  const order = duplicateOrder(pdf.pageCount, sel, Number(copies));

  const run = () =>
    job.run(async ({ alive }) => {
      setOut(null);
      if (!pdf.lib) throw new Error("The PDF is not ready yet.");
      const doc = await pdfFromPages(pdf.lib, order.map((p) => p - 1));
      const blob = await savePdf(doc);
      if (alive()) setOut({ blob, name: outName(pdf.file, "duplicated"), detail: `${pdf.pageCount} → ${order.length} pages` });
    });

  return (
    <div className="space-y-5">
      <SelectionTools
        pageCount={pdf.pageCount}
        selected={sel}
        rangeLabel="Pages to duplicate"
        onChange={(s) => {
          setSel(s);
          setOut(null);
        }}
      />
      <PageGrid
        doc={pdf.js}
        items={items}
        label="Pages: activate a page to duplicate it"
        selected={new Set([...sel].map(String))}
        selectVerb="Duplicate"
        onToggle={(id) => {
          toggle(Number(id));
          setOut(null);
        }}
      />
      <div className="flex flex-wrap items-end gap-3">
        <SelectField
          label="Copies of each selected page"
          options={COPY_OPTIONS}
          value={copies}
          onChange={(e) => {
            setCopies(e.target.value);
            setOut(null);
          }}
          className="w-56"
        />
        <Btn icon="copy" className="h-11" disabled={sel.size === 0 || job.busy} onClick={run}>
          Duplicate pages
        </Btn>
        {job.busy && <Spinner label="Building PDF" />}
      </div>
      {sel.size > 0 && (
        <p className="text-sm text-ink-2">
          Copies are inserted right after each original. The new file will have <strong className="tabular-nums">{order.length}</strong> pages.
        </p>
      )}
      {job.error && <Notice tone="error">{job.error}</Notice>}
      {out && <DownloadResult output={out} />}
    </div>
  );
}

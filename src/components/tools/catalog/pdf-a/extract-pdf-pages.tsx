"use client";

import { useState } from "react";
import { Btn, Notice, PrivacyNote, Segmented, ToolPanel } from "@/components/tools/kit";
import { Spinner, zipFiles } from "@/components/tools/engines/files";
import { PageGrid } from "./PageGrid";
import { SelectionTools, usePageSelection } from "./selection";
import { DownloadResult, PdfSourcePicker, outName, pdfFromPages, savePdf, useJob, usePdfSource, type LoadedPdf, type Output } from "./shared";
import { formatRanges } from "./lib/layout";

export default function Tool() {
  const { state, load, clear } = usePdfSource();
  return (
    <ToolPanel title="Extract pages">
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
  const [mode, setMode] = useState<"one" | "each">("one");
  const [out, setOut] = useState<Output | null>(null);
  const job = useJob();
  const items = Array.from({ length: pdf.pageCount }, (_, i) => ({ id: String(i + 1), page: i + 1 }));
  const selectedIds = new Set([...sel].map(String));
  const pages = [...sel].sort((a, b) => a - b);

  const run = () =>
    job.run(async ({ alive, progress }) => {
      setOut(null);
      const src = pdf.lib;
      if (!src) throw new Error("The PDF is not ready yet.");
      if (mode === "one") {
        const doc = await pdfFromPages(src, pages.map((p) => p - 1));
        const blob = await savePdf(doc);
        if (alive()) setOut({ blob, name: outName(pdf.file, `pages-${formatRanges(pages).replace(/, /g, "_")}`.slice(0, 60)), detail: `${pages.length} pages` });
      } else {
        const entries: { name: string; data: Blob }[] = [];
        for (let i = 0; i < pages.length; i++) {
          if (!alive()) return;
          const doc = await pdfFromPages(src, [pages[i] - 1]);
          entries.push({ name: outName(pdf.file, `page-${pages[i]}`), data: await savePdf(doc) });
          progress((i + 1) / pages.length);
        }
        const blob = await zipFiles(entries, 0);
        if (alive()) setOut({ blob, name: outName(pdf.file, "pages", "zip"), detail: `${pages.length} files` });
      }
    });

  return (
    <div className="space-y-5">
      <SelectionTools pageCount={pdf.pageCount} selected={sel} onChange={(s) => { setSel(s); setOut(null); }} />
      <PageGrid
        doc={pdf.js}
        items={items}
        label="Pages: activate a page to select it"
        selected={selectedIds}
        onToggle={(id) => {
          toggle(Number(id));
          setOut(null);
        }}
      />
      <div className="flex flex-wrap items-center gap-3">
        <Segmented
          label="Output"
          value={mode}
          onChange={(v) => {
            setMode(v);
            setOut(null);
          }}
          options={[
            { value: "one", label: "One PDF" },
            { value: "each", label: "One PDF per page (ZIP)" },
          ]}
        />
        <Btn icon="scissors" disabled={pages.length === 0 || job.busy} onClick={run}>
          Extract {pages.length || ""} {pages.length === 1 ? "page" : "pages"}
        </Btn>
        {job.busy && <Spinner label={job.progress !== null ? `Building ${Math.round(job.progress * 100)}%` : "Building PDF"} />}
      </div>
      {job.error && <Notice tone="error">{job.error}</Notice>}
      {out && <DownloadResult output={out} label={mode === "one" ? "Download PDF" : "Download ZIP"} />}
    </div>
  );
}

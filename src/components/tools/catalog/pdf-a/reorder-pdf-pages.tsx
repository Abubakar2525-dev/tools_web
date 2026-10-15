"use client";

import { useState } from "react";
import { Btn, Notice, PrivacyNote, TextField, ToolPanel } from "@/components/tools/kit";
import { Spinner } from "@/components/tools/engines/files";
import { parsePageRanges } from "@/components/tools/engines/pdf";
import { PageGrid } from "./PageGrid";
import { DownloadResult, PdfSourcePicker, outName, pdfFromPages, savePdf, useJob, usePdfSource, type LoadedPdf, type Output } from "./shared";
import { formatRanges, moveItem } from "./lib/layout";

export default function Tool() {
  const { state, load, clear } = usePdfSource();
  return (
    <ToolPanel title="Reorder pages">
      <div className="space-y-5">
        <PdfSourcePicker state={state} load={load} clear={clear} />
        {state.status === "ready" && <Editor key={state.key} pdf={state} />}
        <PrivacyNote />
      </div>
    </ToolPanel>
  );
}

function Editor({ pdf }: { pdf: LoadedPdf }) {
  const initial = Array.from({ length: pdf.pageCount }, (_, i) => i + 1);
  const [order, setOrder] = useState<number[]>(initial);
  const [typed, setTyped] = useState("");
  const [typedErr, setTypedErr] = useState<string | null>(null);
  const [out, setOut] = useState<Output | null>(null);
  const job = useJob();
  const items = order.map((p) => ({ id: String(p), page: p }));
  const unchanged = order.every((p, i) => p === i + 1);

  const update = (next: number[]) => {
    setOrder(next);
    setOut(null);
  };

  const applyTyped = () => {
    const r = parsePageRanges(typed, pdf.pageCount);
    if (typeof r === "string") return setTypedErr(r);
    if (!typed.trim()) return setTypedErr("Type the new order, for example 3, 1, 2, 4-.");
    const seen = new Set<number>();
    const dup: number[] = [];
    for (const p of r) {
      if (seen.has(p)) dup.push(p);
      else seen.add(p);
    }
    const missing = initial.filter((p) => !seen.has(p));
    if (dup.length) return setTypedErr(`Page ${formatRanges(dup)} appears more than once. Use the duplicate tool to repeat pages.`);
    // Pages left out keep their relative order at the end.
    setTypedErr(null);
    update([...r, ...missing]);
  };

  const run = () =>
    job.run(async ({ alive }) => {
      setOut(null);
      if (!pdf.lib) throw new Error("The PDF is not ready yet.");
      const doc = await pdfFromPages(pdf.lib, order.map((p) => p - 1));
      const blob = await savePdf(doc);
      if (alive()) setOut({ blob, name: outName(pdf.file, "reordered"), detail: `${order.length} pages` });
    });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-2">
        <TextField
          label="Type a new order"
          hint="Pages you leave out are kept, in their current order, at the end."
          value={typed}
          error={typedErr}
          placeholder="e.g. 3, 1, 2, 4-"
          onChange={(e) => setTyped(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              applyTyped();
            }
          }}
          className="min-w-0 flex-1 basis-60"
        />
        <Btn variant="ghost" className="h-11" onClick={applyTyped}>
          Apply order
        </Btn>
      </div>
      <div className="flex flex-wrap gap-2">
        <Btn variant="subtle" onClick={() => update([...order].reverse())}>
          Reverse
        </Btn>
        <Btn variant="subtle" icon="reset" disabled={unchanged} onClick={() => update(initial)}>
          Original order
        </Btn>
      </div>
      <p className="text-sm text-muted">Use the arrow buttons under each page to move it earlier or later. Keyboard: Tab to a button, then press Enter or Space.</p>
      <PageGrid doc={pdf.js} items={items} label="Pages in their new order" showPosition onMove={(i, d) => update(moveItem(order, i, d))} />
      <div className="flex flex-wrap items-center gap-3">
        <Btn icon="download" disabled={unchanged || job.busy} onClick={run}>
          Save new order
        </Btn>
        {unchanged && <span className="text-sm text-muted">Move at least one page first.</span>}
        {job.busy && <Spinner label="Building PDF" />}
      </div>
      {job.error && <Notice tone="error">{job.error}</Notice>}
      {out && <DownloadResult output={out} />}
    </div>
  );
}

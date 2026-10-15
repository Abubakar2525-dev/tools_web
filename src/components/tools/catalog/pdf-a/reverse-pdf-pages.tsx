"use client";

import { useState } from "react";
import { Btn, Notice, PrivacyNote, TextField, ToolPanel } from "@/components/tools/kit";
import { Spinner } from "@/components/tools/engines/files";
import { parsePageRanges } from "@/components/tools/engines/pdf";
import { PageGrid } from "./PageGrid";
import { DownloadResult, PdfSourcePicker, outName, pdfFromPages, savePdf, useJob, usePdfSource, type LoadedPdf, type Output } from "./shared";

export default function Tool() {
  const { state, load, clear } = usePdfSource();
  return (
    <ToolPanel title="Reverse page order">
      <div className="space-y-5">
        <PdfSourcePicker state={state} load={load} clear={clear} />
        {state.status === "ready" && <Editor key={state.key} pdf={state} />}
        <PrivacyNote />
      </div>
    </ToolPanel>
  );
}

/** Reverses the pages at the given positions among themselves; other pages stay put. */
function reversedOrder(n: number, subset: number[] | null) {
  const order = Array.from({ length: n }, (_, i) => i + 1);
  if (!subset) return order.reverse();
  const pos = [...new Set(subset)].sort((a, b) => a - b);
  const vals = pos.slice().reverse();
  pos.forEach((p, i) => (order[p - 1] = vals[i]));
  return order;
}

function Editor({ pdf }: { pdf: LoadedPdf }) {
  const [range, setRange] = useState("");
  const [out, setOut] = useState<Output | null>(null);
  const job = useJob();
  const parsed = range.trim() ? parsePageRanges(range, pdf.pageCount) : null;
  const error = typeof parsed === "string" ? parsed : null;
  const order = reversedOrder(pdf.pageCount, Array.isArray(parsed) ? parsed : null);
  const items = order.map((p) => ({ id: String(p), page: p }));

  const run = () =>
    job.run(async ({ alive }) => {
      setOut(null);
      if (!pdf.lib) throw new Error("The PDF is not ready yet.");
      const doc = await pdfFromPages(pdf.lib, order.map((p) => p - 1));
      const blob = await savePdf(doc);
      if (alive()) setOut({ blob, name: outName(pdf.file, "reversed"), detail: `${order.length} pages` });
    });

  return (
    <div className="space-y-5">
      <TextField
        label="Pages to reverse"
        optional
        hint="Leave blank to reverse the whole document, or give a range such as 3-10 to flip only that part."
        value={range}
        error={error}
        placeholder="All pages"
        onChange={(e) => {
          setRange(e.target.value);
          setOut(null);
        }}
      />
      <div className="flex flex-wrap items-center gap-3">
        <Btn icon="swap" disabled={Boolean(error) || job.busy || pdf.pageCount < 2} onClick={run}>
          Reverse and save
        </Btn>
        {pdf.pageCount < 2 && <span className="text-sm text-muted">This PDF has only one page.</span>}
        {job.busy && <Spinner label="Building PDF" />}
      </div>
      {job.error && <Notice tone="error">{job.error}</Notice>}
      {out && <DownloadResult output={out} />}
      <div>
        <h3 className="mb-3 text-sm font-medium text-ink">Preview of the new order</h3>
        <PageGrid doc={pdf.js} items={items} label="Pages in reversed order" showPosition />
      </div>
    </div>
  );
}

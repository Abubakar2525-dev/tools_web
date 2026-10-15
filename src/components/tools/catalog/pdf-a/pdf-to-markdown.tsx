"use client";

import { useState } from "react";
import { Btn, Checkbox, CopyBtn, Notice, OutputBlock, PrivacyNote, StatGrid, TextField, ToolPanel, downloadFile, fmt } from "@/components/tools/kit";
import { ProgressBar } from "@/components/tools/engines/files";
import { parsePageRanges } from "@/components/tools/engines/pdf";
import { extractLines } from "./extract";
import { linesToMarkdown, type Line } from "./lib/text";
import { PdfSourcePicker, outName, useJob, usePdfSource, type LoadedPdf } from "./shared";

export default function Tool() {
  const { state, load, clear } = usePdfSource({ edit: false });
  return (
    <ToolPanel title="PDF to Markdown">
      <div className="space-y-5">
        <PdfSourcePicker state={state} load={load} clear={clear} />
        {state.status === "ready" && <Editor key={state.key} pdf={state} />}
        <PrivacyNote />
      </div>
    </ToolPanel>
  );
}

const PREVIEW_LIMIT = 200_000;

function Editor({ pdf }: { pdf: LoadedPdf }) {
  const [range, setRange] = useState("");
  const [breaks, setBreaks] = useState(false);
  const [pagesLines, setPagesLines] = useState<Line[][] | null>(null);
  const job = useJob();
  const pages = parsePageRanges(range, pdf.pageCount);
  const rangeErr = typeof pages === "string" ? pages : null;

  const run = () =>
    job.run(async ({ alive, progress }) => {
      if (typeof pages === "string") return;
      setPagesLines(null);
      const acc: Line[][] = [];
      for (let i = 0; i < pages.length; i++) {
        if (!alive()) return;
        acc.push(await extractLines(pdf.js, pages[i]));
        progress((i + 1) / pages.length);
      }
      if (alive()) setPagesLines(acc);
    });

  const md = pagesLines ? linesToMarkdown(pagesLines, { pageBreaks: breaks }) : "";
  const headings = (md.match(/^#{1,6} /gm) ?? []).length;
  const listItems = (md.match(/^\s*(?:[-*] |\d+\. )/gm) ?? []).length;
  const noText = pagesLines !== null && !md.trim();

  return (
    <div className="space-y-5">
      <TextField
        label="Pages"
        optional
        hint={`Blank for all ${pdf.pageCount} pages, or ranges like 1-4.`}
        placeholder="All pages"
        value={range}
        error={rangeErr}
        onChange={(e) => setRange(e.target.value)}
      />
      <Checkbox label="Insert a horizontal rule (---) between pages" checked={breaks} onChange={setBreaks} />
      <Btn icon="markdown" disabled={Boolean(rangeErr) || job.busy} onClick={run}>
        Convert to Markdown
      </Btn>
      {job.busy && <ProgressBar value={job.progress ?? 0} label="Reading pages" />}
      {job.error && <Notice tone="error">{job.error}</Notice>}
      {noText && (
        <Notice tone="warning" title="No text layer found">
          These pages contain no selectable text, so there is nothing to convert. Scanned PDFs need OCR first.
        </Notice>
      )}
      {pagesLines && !noText && (
        <div className="space-y-4">
          <StatGrid
            items={[
              { label: "Headings", value: headings },
              { label: "List items", value: listItems },
              { label: "Characters", value: fmt(md.length, 0) },
            ]}
          />
          <div className="flex flex-wrap gap-2">
            <CopyBtn text={md} label="Copy Markdown" />
            <Btn variant="ghost" icon="download" onClick={() => downloadFile(outName(pdf.file, "", "md"), md, "text/markdown")}>
              Download .md
            </Btn>
          </div>
          <OutputBlock label="Markdown output">
            {md.length > PREVIEW_LIMIT ? `${md.slice(0, PREVIEW_LIMIT)}\n\n[Preview truncated. Copy or download for the full text.]` : md}
          </OutputBlock>
          <p className="text-[0.8125rem] text-muted">
            Headings are guessed from font size, so check them before publishing. Tables, images and multi-column layouts are not reconstructed.
          </p>
        </div>
      )}
    </div>
  );
}
